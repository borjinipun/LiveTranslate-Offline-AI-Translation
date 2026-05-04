export default class TTSManager {
  constructor() {
    this.synth = window.speechSynthesis
    this.isSupported = !!this.synth
    this.enabled = false
    this.queue = []
    this.isSpeaking = false
  }

  toggle(enabled) {
    this.enabled = enabled
    if (!this.enabled) {
      this.stop()
    } else {
      // Unlock audio context on user gesture
      if (this.isSupported) {
        const unlock = new SpeechSynthesisUtterance('')
        this.synth.speak(unlock)
      }
    }
  }

  speak(text, lang) {
    if (!this.isSupported || !this.enabled || !text.trim()) {
      console.log('[TTS] Speak skipped:', { isSupported: this.isSupported, enabled: this.enabled, text });
      return
    }

    console.log('[TTS] Queueing text:', text, lang);
    this.queue.push({ text: text.trim(), lang })
    this._processQueue()
  }

  _processQueue() {
    if (this.isSpeaking || this.queue.length === 0) {
      console.log('[TTS] Process queue skipped:', { isSpeaking: this.isSpeaking, queueLength: this.queue.length });
      return
    }

    this.isSpeaking = true
    const { text, lang } = this.queue.shift()
    console.log('[TTS] Speaking now:', text, lang);

    const utterance = new SpeechSynthesisUtterance(text)
    
    utterance.lang = lang

    utterance.onend = () => {
      this.isSpeaking = false
      this._processQueue()
    }

    utterance.onerror = (err) => {
      console.warn('[TTS] Error:', err)
      this.isSpeaking = false
      this._processQueue()
    }

    this.synth.speak(utterance)
  }

  stop() {
    if (this.synth) {
      this.synth.cancel()
    }
    this.queue = []
    this.isSpeaking = false
  }
}
