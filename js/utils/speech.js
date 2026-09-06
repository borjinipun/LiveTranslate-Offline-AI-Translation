/**
 * SpeechInputManager — 100% Local On-Device Speech Recognition (Whisper ONNX via Web Worker).
 * Features:
 * - Mobile hardware sample rate detection & automatic 16kHz resampling
 * - Voice Activity Detection (VAD) / pause detection for natural meeting turn-taking
 * - Multi-speaker context tagging (speakerId: 'speaker1' | 'speaker2')
 * - Strictly local offline execution with fallback option
 */

/**
 * Resamples an input Float32Array from device sample rate to 16,000 Hz.
 * @param {Float32Array} audioData
 * @param {number} sourceSampleRate
 * @returns {Float32Array}
 */
function resampleTo16k(audioData, sourceSampleRate) {
  if (sourceSampleRate === 16000) {
    return audioData
  }
  const ratio = sourceSampleRate / 16000
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)

  let offsetResult = 0
  let offsetSource = 0

  while (offsetResult < result.length) {
    const nextOffsetSource = Math.round((offsetResult + 1) * ratio)
    let accum = 0
    let count = 0
    for (let i = offsetSource; i < nextOffsetSource && i < audioData.length; i++) {
      accum += audioData[i]
      count++
    }
    result[offsetResult] = count > 0 ? accum / count : (audioData[offsetSource] || 0)
    offsetResult++
    offsetSource = nextOffsetSource
  }

  return result
}

export default class SpeechInputManager {
  constructor() {
    this.isSupportedOffline = typeof navigator !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    this.isSupportedWeb = typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)

    this.isSupported = this.isSupportedOffline || this.isSupportedWeb
    this.useOfflineSTT = true // Local on-device Whisper is primary

    this.isListening = false
    this.activeSpeakerId = null

    this._onInterim = null
    this._onFinal = null
    this._onError = null
    this._onEnd = null
    this._onStatus = null

    // Offline Whisper STT Worker
    this._worker = new Worker('./js/workers/worker-stt.js', { type: 'module' })
    this._isWorkerReady = false
    this._isProcessing = false
    this._isFinalizing = false

    this._audioContext = null
    this._mediaStream = null
    this._sourceNode = null
    this._processorNode = null

    this._audioData = []
    this._lastOfflineText = ''
    this._offlineSilenceTimer = null
    this._hasSpoken = false

    this._setupWorker()
  }

  _setupWorker() {
    this._worker.addEventListener('message', (event) => {
      const msg = event.data

      if (msg.type === 'progress') {
        if (this._onStatus) this._onStatus(msg.data)
      } else if (msg.type === 'ready') {
        this._isWorkerReady = true
        if (this._onStatus) this._onStatus({ status: 'ready' })
      } else if (msg.type === 'result') {
        this._isProcessing = false
        const text = (msg.text || '').trim()
        const speakerId = msg.speakerId || this.activeSpeakerId

        if (this._isFinalizing) {
          if (this._onFinal) this._onFinal(text, speakerId)
          if (this._onEnd) this._onEnd(speakerId)
          this._isFinalizing = false
          this.activeSpeakerId = null
        } else {
          if (text && text !== this._lastOfflineText) {
            this._lastOfflineText = text
            if (this._onInterim) this._onInterim(text, speakerId)

            // Dynamic silence detection for auto-turn in meetings
            clearTimeout(this._offlineSilenceTimer)
            this._offlineSilenceTimer = setTimeout(() => {
              if (this.isListening && this.useOfflineSTT) {
                if (this._onFinal) this._onFinal(text, speakerId)
                this._lastOfflineText = ''
                this.clearBuffer()
              }
            }, 1400)
          }
        }
      } else if (msg.type === 'error') {
        this._isProcessing = false
        if (this._onError) this._onError(new Error(msg.error), msg.speakerId)
        if (this._onEnd) this._onEnd(msg.speakerId)
      }
    })

    // Start background local model download/load
    this._worker.postMessage({ type: 'load' })
  }

  setEngine(useOffline) {
    if (this.isListening) {
      this.stop()
    }
    this.useOfflineSTT = useOffline
  }

  onStatus(callback) {
    this._onStatus = callback
    if (this._isWorkerReady) {
      callback({ status: 'ready' })
    }
  }

  isReady() {
    return this._isWorkerReady
  }

  /**
   * Start listening
   * @param {object} opts
   * @param {string} [opts.lang='en'] - e.g. 'en-US' or 'es'
   * @param {string} [opts.speakerId=null] - Tag for meeting participant ('speaker1' | 'speaker2')
   * @param {Function} [opts.onInterim]
   * @param {Function} [opts.onFinal]
   * @param {Function} [opts.onError]
   * @param {Function} [opts.onEnd]
   */
  async start({ lang = 'en', speakerId = null, onInterim, onFinal, onError, onEnd } = {}) {
    if (!this.isSupported) {
      console.warn('[Speech] Microphone access is not supported in this browser.')
      return false
    }

    if (this.isListening) {
      // If switching speakers, quickly stop previous
      this.stop()
      await new Promise((r) => setTimeout(r, 100))
    }

    this._onInterim = onInterim
    this._onFinal = onFinal
    this._onError = onError
    this._onEnd = onEnd
    this._lang = lang
    this.activeSpeakerId = speakerId

    this.isListening = true
    this._hasSpoken = false

    // Local Whisper STT flow
    if (this.useOfflineSTT || !this.isSupportedWeb) {
      if (!this._isWorkerReady) {
        console.warn('[Speech] Local STT model is still loading...')
        // Still allow attempt; model will finish loading
      }

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        this._mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        this._audioContext = new AudioContextClass()
        if (this._audioContext.state === 'suspended') {
          await this._audioContext.resume()
        }

        const deviceSampleRate = this._audioContext.sampleRate
        this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream)

        // Use 4096 buffer size for smooth streaming on mobile and desktop
        this._processorNode = this._audioContext.createScriptProcessor(4096, 1, 1)
        this._audioData = []
        this._isProcessing = false
        this._isFinalizing = false
        this._lastOfflineText = ''

        let lastProcessTime = Date.now()

        this._processorNode.onaudioprocess = (e) => {
          if (!this.isListening || !this.useOfflineSTT) return

          const inputChannel = e.inputBuffer.getChannelData(0)

          // Simple RMS energy calculation to detect speaking
          let sumSquares = 0
          for (let i = 0; i < inputChannel.length; i++) {
            sumSquares += inputChannel[i] * inputChannel[i]
          }
          const rms = Math.sqrt(sumSquares / inputChannel.length)
          if (rms > 0.015) {
            this._hasSpoken = true
          }

          // Resample chunk to 16,000 Hz
          const resampledChunk = resampleTo16k(inputChannel, deviceSampleRate)
          this._audioData.push(resampledChunk)

          const now = Date.now()
          // Send accumulated audio to worker every ~900ms if not actively decoding
          if (now - lastProcessTime > 900 && !this._isProcessing && this._hasSpoken) {
            lastProcessTime = now
            this._sendAudioToWorker(false)
          }
        }

        this._sourceNode.connect(this._processorNode)
        this._processorNode.connect(this._audioContext.destination)

        return true
      } catch (err) {
        console.error('[Speech] Error acquiring microphone:', err)
        if (this._onError) this._onError(err, this.activeSpeakerId)
        this.isListening = false
        this.activeSpeakerId = null
        return false
      }
    } else {
      // Web Speech API fallback if explicitly chosen
      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        this._recognition = new SpeechRecognition()
        this._recognition.continuous = true
        this._recognition.interimResults = true
        this._recognition.lang = lang

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
          if (interim && this._onInterim) this._onInterim(interim, this.activeSpeakerId)
          if (final && this._onFinal) this._onFinal(final, this.activeSpeakerId)
        }

        this._recognition.onerror = (e) => {
          if (this._onError) this._onError(new Error(e.error), this.activeSpeakerId)
        }

        this._recognition.onend = () => {
          if (this.isListening && !this.useOfflineSTT) {
            this.isListening = false
            if (this._onEnd) this._onEnd(this.activeSpeakerId)
            this.activeSpeakerId = null
          }
        }

        this._recognition.start()
        return true
      } catch (err) {
        console.error('[Speech] Web Speech API start error:', err)
        this.isListening = false
        this.activeSpeakerId = null
        return false
      }
    }
  }

  _sendAudioToWorker(isFinal) {
    const totalLength = this._audioData.reduce((acc, val) => acc + val.length, 0)
    if (totalLength === 0) {
      if (isFinal && this._isFinalizing) {
        if (this._onFinal) this._onFinal('', this.activeSpeakerId)
        if (this._onEnd) this._onEnd(this.activeSpeakerId)
        this._isFinalizing = false
        this.activeSpeakerId = null
      }
      return
    }

    const audioFloat32 = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this._audioData) {
      audioFloat32.set(chunk, offset)
      offset += chunk.length
    }

    this._isProcessing = true
    this._isFinalizing = isFinal

    // Clean ISO code for Whisper (e.g. "en", "es", "zh")
    const langCode = (this._lang || 'en').split('-')[0].toLowerCase()

    this._worker.postMessage({
      type: 'transcribe',
      audio: audioFloat32,
      language: langCode,
      speakerId: this.activeSpeakerId,
    })
  }

  stop() {
    if (!this.isListening) return
    this.isListening = false

    if (!this.useOfflineSTT && this._recognition) {
      try {
        this._recognition.stop()
      } catch (_) {}
    } else if (this.useOfflineSTT) {
      clearTimeout(this._offlineSilenceTimer)

      if (this._processorNode) {
        try {
          this._processorNode.disconnect()
          this._processorNode.onaudioprocess = null
        } catch (_) {}
      }
      if (this._sourceNode) {
        try {
          this._sourceNode.disconnect()
        } catch (_) {}
      }
      if (this._audioContext) {
        try {
          this._audioContext.close()
        } catch (_) {}
      }
      if (this._mediaStream) {
        try {
          this._mediaStream.getTracks().forEach((track) => track.stop())
        } catch (_) {}
      }

      // Send final audio chunk for transcription
      this._sendAudioToWorker(true)
    }
  }

  clearBuffer() {
    this._audioData = []
    this._hasSpoken = false
  }
}
