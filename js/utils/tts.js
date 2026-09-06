/**
 * TTSManager — High-performance, 100% local on-device Text-to-Speech.
 * Uses the Web Speech Synthesis API powered by local OS voices (iOS, Android, macOS, Windows).
 * Zero network requests, zero download, instant response, and supports all configured languages.
 */
export default class TTSManager {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    this.isSupported = !!this.synth
    this.enabled = true // Enabled by default for interpreter / meeting experience
    this.queue = []
    this.isSpeaking = false
    this._onStatus = null
    this.voices = []

    if (this.isSupported) {
      this._loadVoices()
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this._loadVoices()
      }
    }
  }

  _loadVoices() {
    if (!this.synth) return
    this.voices = this.synth.getVoices()
    if (this._onStatus) {
      this._onStatus({ status: 'ready', count: this.voices.length })
    }
  }

  onStatus(callback) {
    this._onStatus = callback
    if (this.isSupported) {
      // Immediate ready signal for local OS engine
      callback({ status: 'ready', count: this.voices.length })
    } else {
      callback({ status: 'error', error: 'Speech synthesis not supported' })
    }
  }

  toggle(enabled) {
    this.enabled = enabled
    if (!this.enabled) {
      this.stop()
    }
  }

  /**
   * Find the best local voice for the given BCP-47 language tag
   * @param {string} bcp47 - e.g. "es-ES", "ja-JP", "en-US"
   * @returns {SpeechSynthesisVoice|null}
   */
  getBestVoice(bcp47) {
    if (!this.voices || this.voices.length === 0) {
      this._loadVoices()
    }
    if (!this.voices || this.voices.length === 0) return null

    const langLower = (bcp47 || 'en-US').toLowerCase()
    const langPrefix = langLower.split('-')[0]

    // 1. Exact match and localService preferred
    let match = this.voices.find(
      (v) => v.lang.toLowerCase().replace('_', '-') === langLower && v.localService,
    )
    if (match) return match

    // 2. Exact match
    match = this.voices.find(
      (v) => v.lang.toLowerCase().replace('_', '-') === langLower,
    )
    if (match) return match

    // 3. Prefix match (e.g. "es" for "es-US" / "es-ES") with localService
    match = this.voices.find(
      (v) => v.lang.toLowerCase().startsWith(langPrefix) && v.localService,
    )
    if (match) return match

    // 4. Any prefix match
    match = this.voices.find(
      (v) => v.lang.toLowerCase().startsWith(langPrefix),
    )
    return match || null
  }

  /**
   * Speak text in the requested language
   * @param {string} text
   * @param {string} lang - BCP-47 language tag (e.g. 'es-ES')
   * @param {Function} [onEndCallback] - Called when utterance finishes
   */
  speak(text, lang = 'en-US', onEndCallback = null) {
    if (!this.isSupported || !this.enabled || !text || !text.trim()) {
      if (onEndCallback) onEndCallback()
      return
    }

    this.queue.push({
      text: text.trim(),
      lang,
      onEndCallback,
    })

    this._processQueue()
  }

  _processQueue() {
    if (this.isSpeaking || this.queue.length === 0) {
      return
    }

    const item = this.queue.shift()
    this.isSpeaking = true

    // Clean up synth in case it was stuck in paused state (mobile Safari bug)
    if (this.synth && this.synth.paused) {
      this.synth.resume()
    }

    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.lang = item.lang || 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0

    const voice = this.getBestVoice(item.lang)
    if (voice) {
      utterance.voice = voice
    }

    const finish = () => {
      this.isSpeaking = false
      if (item.onEndCallback) {
        try {
          item.onEndCallback()
        } catch (e) {
          console.error('[TTS] Callback error:', e)
        }
      }
      this._processQueue()
    }

    utterance.onend = finish
    utterance.onerror = (e) => {
      // Don't log if cancelled intentionally
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('[TTS] Synthesis error:', e.error)
      }
      finish()
    }

    try {
      this.synth.speak(utterance)
    } catch (err) {
      console.error('[TTS] Failed to speak:', err)
      finish()
    }
  }

  stop() {
    this.queue = []
    if (this.synth) {
      this.synth.cancel()
    }
    this.isSpeaking = false
  }
}
