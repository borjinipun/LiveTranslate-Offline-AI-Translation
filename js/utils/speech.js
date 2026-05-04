/**
 * SpeechInputManager — wraps the Web Speech API (SpeechRecognition).
 * Degrades gracefully when the API is unavailable.
 */
export default class SpeechInputManager {
  constructor() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    this.isSupported = !!SpeechRecognition
    this.isListening = false
    this._recognition = null
    this._onInterim = null
    this._onFinal = null
    this._onError = null
    this._onEnd = null

    if (this.isSupported) {
      this._recognition = new SpeechRecognition()
      this._recognition.continuous = true
      this._recognition.interimResults = true

      this._recognition.onresult = (event) => {
        let interim = ''
        let final = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            final += result[0].transcript
          } else {
            interim += result[0].transcript
          }
        }

        if (interim && this._onInterim) this._onInterim(interim)
        if (final && this._onFinal) this._onFinal(final)
      }

      this._recognition.onerror = (event) => {
        if (this._onError) this._onError(event.error)
      }

      this._recognition.onend = () => {
        this.isListening = false
        if (this._onEnd) this._onEnd()
      }
    }
  }

  /**
   * Start listening.
   * @param {object} opts
   * @param {string}   opts.lang       - BCP-47 language code (e.g. 'en-US')
   * @param {Function} opts.onInterim  - Called with partial transcript
   * @param {Function} opts.onFinal    - Called with confirmed transcript segment
   * @param {Function} [opts.onError]  - Called on recognition error
   * @param {Function} [opts.onEnd]    - Called when recognition ends
   */
  start({ lang = 'en-US', onInterim, onFinal, onError, onEnd } = {}) {
    if (!this.isSupported) {
      console.warn('[Speech] SpeechRecognition is not supported in this browser.')
      return false
    }
    if (this.isListening) return false

    this._onInterim = onInterim
    this._onFinal = onFinal
    this._onError = onError
    this._onEnd = onEnd

    this._recognition.lang = lang
    this._recognition.start()
    this.isListening = true
    return true
  }

  /** Stop listening. */
  stop() {
    if (!this.isSupported || !this.isListening) return
    this._recognition.stop()
    this.isListening = false
  }
}
