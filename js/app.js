/**
 * Live Translation App — Main Application Controller
 * Supports Standard Translation Mode and Real-Time Meeting / Interpreter Mode.
 */
import {
  MODEL_DATA,
  MODEL_SIZES,
  ELEMENT_IDS,
  SUPPORTED_LANGUAGES,
  APP_MODES,
} from './config.js'
import { initLogger, logDebug, logBrowserInfo, logStatus } from './utils/logger.js'
import { populateModelSelect } from './utils/ui.js'
import TranslationEngine from './models/llm-model.js'
import SpeechInputManager from './utils/speech.js'
import TranscriptHistory from './utils/transcript.js'
import TTSManager from './utils/tts.js'
import MeetingManager from './utils/meeting.js'

class TranslationApp {
  constructor() {
    this.elements = {}
    this.engine = new TranslationEngine()
    this.speech = new SpeechInputManager()
    this.history = new TranscriptHistory()
    this.tts = new TTSManager()
    this.meeting = new MeetingManager()

    this.currentMode = APP_MODES.TRANSLATE
    this.isModelLoading = false
    this.isTranslating = false
    this.isMeetingTranslating = false
    this._pendingTranslation = null
    this.warningDismissed = false

    // Translate mode interim and debounce
    this._interimText = ''
    this._debounceTimer = null
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  async init() {
    this._bindElements()
    this._populateLanguageSelects()
    this._attachListeners()
    this._updateMicUI()

    initLogger({
      debug:     this.elements.debug,
      status:    this.elements.status,
      output:    null,
      topStatus: this.elements.topStatus,
    })

    populateModelSelect(this.elements.modelSelect, MODEL_DATA)
    this.engine.setElements(this.elements)

    logBrowserInfo()
    logDebug(`Media API supported: ${this.speech.isSupported}`)

    // Pre-select fastest recommended model for mobile and desktop (0.5B)
    const defaultId = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC'
    for (let i = 0; i < this.elements.modelSelect.options.length; i++) {
      if (this.elements.modelSelect.options[i].value === defaultId) {
        this.elements.modelSelect.selectedIndex = i
        this._updateResourceWarning()
        break
      }
    }

    // Connect local STT status
    if (this.elements.sttStatus) {
      this.speech.onStatus((data) => {
        if (data.status === 'ready') {
          this.elements.sttStatus.textContent = 'STT: Whisper Ready'
          this.elements.sttStatus.classList.add('ready')
        } else if (data.status === 'progress') {
          const pct = Math.round(data.progress || 0)
          this.elements.sttStatus.textContent = `STT: ${pct}%`
        }
      })
    }

    // Connect local TTS status
    if (this.elements.ttsStatus) {
      this.tts.onStatus((data) => {
        if (data.status === 'ready') {
          this.elements.ttsStatus.textContent = 'TTS: Local OS'
          this.elements.ttsStatus.classList.add('ready')
        }
      })
    }

    // Meeting manager bindings
    this.meeting.onTimerTick((timeStr) => {
      if (this.elements.meetingTimer) {
        this.elements.meetingTimer.textContent = timeStr
      }
    })

    this.meeting.onDialogueUpdate(() => {
      this.meeting.render(this.elements.meetingDialogueList, (text, bcp47) => {
        this.tts.speak(text, bcp47)
      })
    })

    // Initial renders
    this.history.render(this.elements.transcriptList)
    this.meeting.render(this.elements.meetingDialogueList)
    this._updateMeetingBadges()
  }

  // ── DOM binding ────────────────────────────────────────────────────────────

  _bindElements() {
    Object.keys(ELEMENT_IDS).forEach((key) => {
      this.elements[key] = document.getElementById(ELEMENT_IDS[key])
    })
    this.elements.dismissWarningBtn = document.getElementById('dismiss-warning')
  }

  _populateLanguageSelects() {
    const {
      sourceLangSelect,
      targetLangSelect,
      meetingSpeaker1Lang,
      meetingSpeaker2Lang,
    } = this.elements

    SUPPORTED_LANGUAGES.forEach((lang) => {
      sourceLangSelect.appendChild(new Option(`${lang.flag}  ${lang.name}`, lang.code))
      targetLangSelect.appendChild(new Option(`${lang.flag}  ${lang.name}`, lang.code))
      if (meetingSpeaker1Lang) {
        meetingSpeaker1Lang.appendChild(new Option(`${lang.flag}  ${lang.name}`, lang.code))
      }
      if (meetingSpeaker2Lang) {
        meetingSpeaker2Lang.appendChild(new Option(`${lang.flag}  ${lang.name}`, lang.code))
      }
    })

    // Translate mode defaults: English → Spanish
    sourceLangSelect.value = 'en'
    targetLangSelect.value = 'es'

    // Meeting mode defaults: Speaker 1 (English), Speaker 2 (Spanish)
    if (meetingSpeaker1Lang) meetingSpeaker1Lang.value = 'en'
    if (meetingSpeaker2Lang) meetingSpeaker2Lang.value = 'es'

    this.meeting.setLanguages('en', 'es')
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  _attachListeners() {
    // Mode Switcher Tabs
    if (this.elements.navTranslateBtn) {
      this.elements.navTranslateBtn.addEventListener('click', () => {
        this._switchMode(APP_MODES.TRANSLATE)
      })
    }
    if (this.elements.navMeetingBtn) {
      this.elements.navMeetingBtn.addEventListener('click', () => {
        this._switchMode(APP_MODES.MEETING)
      })
    }

    // Load Model
    this.elements.loadModelBtn.addEventListener('click', () => this._loadModel())
    this.elements.modelSelect.addEventListener('change', () => this._updateResourceWarning())
    if (this.elements.dismissWarningBtn) {
      this.elements.dismissWarningBtn.addEventListener('click', () => {
        this.elements.resourceWarning.style.display = 'none'
        this.warningDismissed = true
      })
    }

    // STT Engine Toggle
    if (this.elements.sttEngineToggle) {
      this.elements.sttEngineToggle.addEventListener('change', (e) => {
        this.speech.setEngine(e.target.checked)
      })
    }

    // Translate Mode: Language swap
    this.elements.swapLangsBtn.addEventListener('click', () => this._swapLanguages())

    // Translate Mode: Translate button
    this.elements.translateBtn.addEventListener('click', () => this._doTranslate())

    // Translate Mode: Auto-translate on input
    this.elements.sourceInput.addEventListener('input', () => {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        if (this.elements.sourceInput.value.trim()) this._doTranslate()
      }, 800)
    })

    this.elements.sourceInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        clearTimeout(this._debounceTimer)
        this._doTranslate()
      }
    })

    // Translate Mode: Mic
    this.elements.micBtn.addEventListener('click', () => this._toggleMic())

    // Translate Mode: Clear
    this.elements.clearBtn.addEventListener('click', () => {
      this.elements.sourceInput.value = ''
      this.elements.translationOutput.textContent = ''
      this.elements.translationOutput.classList.remove('streaming', 'has-content')
      this._showPlaceholder(true)
    })

    // Translate Mode: History clear
    this.elements.clearHistoryBtn.addEventListener('click', () => {
      this.history.clear()
      this.history.render(this.elements.transcriptList)
    })

    // Translate Mode: TTS toggle
    if (this.elements.ttsToggleBtn) {
      this.elements.ttsToggleBtn.addEventListener('click', () => {
        this.tts.toggle(!this.tts.enabled)
        this.elements.ttsToggleBtn.classList.toggle('active', this.tts.enabled)
      })
    }

    // ── Meeting / Interpreter Listeners ──────────────────────────────────────
    if (this.elements.meetingSpeaker1Lang) {
      this.elements.meetingSpeaker1Lang.addEventListener('change', (e) => {
        this.meeting.speaker1.langCode = e.target.value
        this._updateMeetingBadges()
      })
    }

    if (this.elements.meetingSpeaker2Lang) {
      this.elements.meetingSpeaker2Lang.addEventListener('change', (e) => {
        this.meeting.speaker2.langCode = e.target.value
        this._updateMeetingBadges()
      })
    }

    if (this.elements.meetingSwapBtn) {
      this.elements.meetingSwapBtn.addEventListener('click', () => {
        this._swapMeetingLanguages()
      })
    }

    // Flip 180° for Tabletop smartphone use
    if (this.elements.invertSpeaker2Btn) {
      this.elements.invertSpeaker2Btn.addEventListener('click', () => {
        this._toggleTabletopInvert()
      })
    }

    // Meeting Push-to-Talk Mics
    if (this.elements.s1MicBtn) {
      this.elements.s1MicBtn.addEventListener('click', () => {
        this._toggleMeetingMic('speaker1')
      })
    }

    if (this.elements.s2MicBtn) {
      this.elements.s2MicBtn.addEventListener('click', () => {
        this._toggleMeetingMic('speaker2')
      })
    }

    // Auto-Turn Hands-Free toggle
    if (this.elements.autoTurnToggle) {
      this.elements.autoTurnToggle.addEventListener('change', (e) => {
        this.meeting.autoTurn = e.target.checked
      })
    }

    // Auto-Speak toggle
    if (this.elements.meetingAutoTtsToggle) {
      this.elements.meetingAutoTtsToggle.addEventListener('change', (e) => {
        this.meeting.autoSpeak = e.target.checked
      })
    }

    // Clear Meeting
    if (this.elements.clearMeetingBtn) {
      this.elements.clearMeetingBtn.addEventListener('click', () => {
        if (confirm('Reset meeting conversation and timer?')) {
          this.meeting.resetMeeting()
          this._clearMeetingDisplays()
        }
      })
    }

    // Export Meeting
    if (this.elements.exportMeetingBtn) {
      this.elements.exportMeetingBtn.addEventListener('click', () => {
        this.meeting.exportTranscript('markdown')
      })
    }
  }

  // ── Mode Switching ─────────────────────────────────────────────────────────

  _switchMode(newMode) {
    if (this.currentMode === newMode) return

    // Stop microphone if listening
    if (this.speech.isListening) {
      this.speech.stop()
      this._updateMicUI(false)
      this._resetMeetingMicUI()
    }

    this.currentMode = newMode

    if (newMode === APP_MODES.TRANSLATE) {
      this.elements.navTranslateBtn.classList.add('active')
      this.elements.navTranslateBtn.setAttribute('aria-selected', 'true')
      this.elements.navMeetingBtn.classList.remove('active')
      this.elements.navMeetingBtn.setAttribute('aria-selected', 'false')

      this.elements.workspaceTranslate.style.display = 'grid'
      this.elements.workspaceMeeting.style.display = 'none'
    } else {
      this.elements.navMeetingBtn.classList.add('active')
      this.elements.navMeetingBtn.setAttribute('aria-selected', 'true')
      this.elements.navTranslateBtn.classList.remove('active')
      this.elements.navTranslateBtn.setAttribute('aria-selected', 'false')

      this.elements.workspaceTranslate.style.display = 'none'
      this.elements.workspaceMeeting.style.display = 'flex'

      this._updateMeetingBadges()
    }
  }

  // ── Model Loading ──────────────────────────────────────────────────────────

  async _loadModel() {
    if (this.isModelLoading) return
    const modelId = this.elements.modelSelect.value
    if (!modelId) return

    this.isModelLoading = true
    this.elements.modelSelect.disabled = true
    this.elements.loadModelBtn.disabled = true
    this.elements.loadModelBtn.textContent = 'Loading…'

    if (this.elements.statusContainer) {
      this.elements.statusContainer.style.display = 'block'
    }

    try {
      await this.engine.loadModel(modelId)
      this._setTranslateEnabled(true)
      this.elements.loadModelBtn.textContent = '✓ Loaded'
      this.elements.loadModelBtn.classList.add('loaded')
      logDebug('Model ready for translation & meetings')
    } catch (err) {
      logDebug(`Model load error: ${err.message}`)
      this.elements.loadModelBtn.textContent = 'Load Model'
      this.elements.loadModelBtn.disabled = false
    } finally {
      this.isModelLoading = false
      this.elements.modelSelect.disabled = false
    }
  }

  _updateResourceWarning() {
    if (this.warningDismissed) return
    const size = MODEL_SIZES[this.elements.modelSelect.value]
    this.elements.resourceWarning.style.display = size === 'medium' ? 'flex' : 'none'
  }

  // ── Translate Mode Translation ─────────────────────────────────────────────

  async _doTranslate(isFinal = true) {
    if (!this.engine.isReady()) {
      if (isFinal) {
        logStatus('Please load a model first.')
        this._flashLoadBtn()
      }
      return
    }

    const text = this.elements.sourceInput.value.trim()
    if (!text) return

    if (this.isTranslating) {
      this._pendingTranslation = { isFinal }
      if (this.engine.engine && typeof this.engine.engine.interruptGenerate === 'function') {
        this.engine.engine.interruptGenerate()
      }
      return
    }

    this.isTranslating = true
    this._pendingTranslation = null

    const sourceLang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.sourceLangSelect.value)
    const targetLang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.targetLangSelect.value)

    if (!sourceLang || !targetLang) {
      this.isTranslating = false
      return
    }

    if (isFinal) {
      this._setTranslateEnabled(false)
    }
    this._showPlaceholder(false)

    try {
      const translated = await this.engine.translate({
        text,
        sourceName: sourceLang.name,
        targetName: targetLang.name,
        outputEl:   this.elements.translationOutput,
        onSentence: (sentence) => {
          if (isFinal && this.tts && this.tts.enabled) {
            this.tts.speak(sentence, targetLang.bcp47)
          }
        },
      })

      if (isFinal && !this._pendingTranslation && translated.trim()) {
        this.history.add({
          original:   text,
          translated: translated.trim(),
          sourceLang: `${sourceLang.flag} ${sourceLang.name}`,
          targetLang: `${targetLang.flag} ${targetLang.name}`,
        })
        this.history.render(this.elements.transcriptList)
      }
    } catch (err) {
      logDebug(`Translation error: ${err.message}`)
      if (isFinal) {
        this.elements.translationOutput.textContent = '⚠ Translation failed. Please try again.'
      }
    } finally {
      this.isTranslating = false
      if (isFinal) {
        this._setTranslateEnabled(true)
      }

      if (this._pendingTranslation) {
        const next = this._pendingTranslation
        this._pendingTranslation = null
        this._doTranslate(next.isFinal)
      }
    }
  }

  _setTranslateEnabled(enabled) {
    this.elements.translateBtn.disabled = !enabled
    this.elements.sourceInput.disabled  = !enabled
    if (!this.speech.isListening) {
      this.elements.micBtn.disabled = !enabled
    }
  }

  _showPlaceholder(show) {
    const out = this.elements.translationOutput
    if (show) {
      out.classList.remove('has-content')
    } else {
      out.classList.add('has-content')
    }
  }

  _flashLoadBtn() {
    this.elements.loadModelBtn.classList.add('flash')
    setTimeout(() => this.elements.loadModelBtn.classList.remove('flash'), 600)
  }

  _swapLanguages() {
    const src = this.elements.sourceLangSelect.value
    const tgt = this.elements.targetLangSelect.value
    this.elements.sourceLangSelect.value = tgt
    this.elements.targetLangSelect.value = src

    const srcText = this.elements.sourceInput.value
    const tgtText = this.elements.translationOutput.textContent
    this.elements.sourceInput.value = tgtText
    this.elements.translationOutput.textContent = srcText

    this.elements.swapLangsBtn.classList.add('spinning')
    setTimeout(() => this.elements.swapLangsBtn.classList.remove('spinning'), 400)
  }

  _toggleMic() {
    if (!this.speech.isSupported) {
      logStatus('Microphone input is not supported in this browser.')
      return
    }
    if (this.speech.isListening) {
      this.speech.stop()
      this._updateMicUI(false)
    } else {
      const langCode = this.elements.sourceLangSelect.value
      const sourceLang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode)
      const speechLang = sourceLang ? sourceLang.bcp47 : 'en-US'

      this._hapticFeedback()
      const started = this.speech.start({
        lang: speechLang,
        onInterim: (interim) => {
          if (!interim.trim()) return
          if (this._interimText !== interim) {
            this._interimText = interim
            this.elements.sourceInput.value = this._interimText
            this.elements.sourceInput.classList.add('interim')

            clearTimeout(this._debounceTimer)
            this._debounceTimer = setTimeout(() => this._doTranslate(false), 800)
          }
        },
        onFinal: (final) => {
          clearTimeout(this._debounceTimer)
          if (final.trim()) {
            this._interimText = ''
            this.elements.sourceInput.value = final
            this.elements.sourceInput.classList.remove('interim')
            this._doTranslate(true)
          }
        },
        onError: (err) => {
          logDebug(`[Speech] Error: ${err}`)
          this._updateMicUI(false)
        },
        onEnd: () => {
          this._updateMicUI(false)
        },
      })
      if (started) this._updateMicUI(true)
    }
  }

  _updateMicUI(listening = false) {
    const btn    = this.elements.micBtn
    const status = this.elements.micStatus

    if (!this.speech.isSupported) {
      btn.title   = 'Mic not supported in this browser'
      btn.classList.add('unsupported')
      if (status) status.textContent = 'Mic unavailable'
      return
    }

    btn.classList.toggle('listening', listening)
    if (status) {
      status.textContent = listening ? 'Listening…' : ''
    }
    btn.setAttribute('aria-label', listening ? 'Stop microphone' : 'Start microphone')
  }

  // ── Meeting Mode Logic ─────────────────────────────────────────────────────

  _updateMeetingBadges() {
    const s1 = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker1Lang.value)
    const s2 = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker2Lang.value)

    if (s1 && this.elements.s1StatusBadge) {
      this.elements.s1StatusBadge.textContent = `${s1.flag} ${s1.name}`
    }
    if (s2 && this.elements.s2StatusBadge) {
      this.elements.s2StatusBadge.textContent = `${s2.flag} ${s2.name}`
    }
  }

  _swapMeetingLanguages() {
    const s1Val = this.elements.meetingSpeaker1Lang.value
    const s2Val = this.elements.meetingSpeaker2Lang.value
    this.elements.meetingSpeaker1Lang.value = s2Val
    this.elements.meetingSpeaker2Lang.value = s1Val

    this.meeting.setLanguages(s2Val, s1Val)
    this._updateMeetingBadges()

    this.elements.meetingSwapBtn.classList.add('spinning')
    setTimeout(() => this.elements.meetingSwapBtn.classList.remove('spinning'), 400)
  }

  _toggleTabletopInvert() {
    this.meeting.isInverted = !this.meeting.isInverted
    const s2Pane = this.elements.s2Pane
    const btn = this.elements.invertSpeaker2Btn

    if (this.meeting.isInverted) {
      s2Pane.classList.add('inverted')
      btn.classList.add('active')
      btn.title = 'Speaker 2 panel is inverted for face-to-face table use (Click to reset)'
    } else {
      s2Pane.classList.remove('inverted')
      btn.classList.remove('active')
      btn.title = 'Rotate Speaker 2 panel 180° for tabletop smartphone face-to-face meetings'
    }
  }

  _clearMeetingDisplays() {
    if (this.elements.s1OriginalText) this.elements.s1OriginalText.textContent = ''
    if (this.elements.s1TranslatedText) {
      this.elements.s1TranslatedText.innerHTML = '<span class="stage-placeholder">Translated speech for Speaker 1 appears here…</span>'
    }
    if (this.elements.s2OriginalText) this.elements.s2OriginalText.textContent = ''
    if (this.elements.s2TranslatedText) {
      this.elements.s2TranslatedText.innerHTML = '<span class="stage-placeholder">Translated speech for Speaker 2 appears here…</span>'
    }
  }

  _resetMeetingMicUI() {
    if (this.elements.s1MicBtn) this.elements.s1MicBtn.classList.remove('listening')
    if (this.elements.s2MicBtn) this.elements.s2MicBtn.classList.remove('listening')
    if (this.elements.s1Pane) this.elements.s1Pane.classList.remove('listening')
    if (this.elements.s2Pane) this.elements.s2Pane.classList.remove('listening')

    const s1Status = this.elements.s1Pane?.querySelector('.speaker-status-indicator')
    const s2Status = this.elements.s2Pane?.querySelector('.speaker-status-indicator')
    if (s1Status) s1Status.textContent = 'Ready'
    if (s2Status) s2Status.textContent = 'Ready'
  }

  _toggleMeetingMic(speakerId) {
    this._hapticFeedback()

    if (!this.engine.isReady()) {
      alert('Please load a translation model first via the top bar.')
      this._flashLoadBtn()
      return
    }

    // If already listening on this speaker, stop
    if (this.speech.isListening && this.speech.activeSpeakerId === speakerId) {
      this.speech.stop()
      this._resetMeetingMicUI()
      return
    }

    // Start meeting timer if not already active
    this.meeting.startMeeting()

    const s1Lang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker1Lang.value)
    const s2Lang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker2Lang.value)
    const activeLang = speakerId === 'speaker1' ? s1Lang : s2Lang

    this._resetMeetingMicUI()

    // Highlight active speaker pane
    if (speakerId === 'speaker1') {
      this.elements.s1MicBtn.classList.add('listening')
      this.elements.s1Pane.classList.add('listening')
      const status = this.elements.s1Pane.querySelector('.speaker-status-indicator')
      if (status) status.textContent = '● Listening…'
    } else {
      this.elements.s2MicBtn.classList.add('listening')
      this.elements.s2Pane.classList.add('listening')
      const status = this.elements.s2Pane.querySelector('.speaker-status-indicator')
      if (status) status.textContent = '● Listening…'
    }

    this.speech.start({
      lang: activeLang.bcp47,
      speakerId,
      onInterim: (interim, activeSpeaker) => {
        if (!interim.trim()) return
        const origEl = activeSpeaker === 'speaker1' ? this.elements.s1OriginalText : this.elements.s2OriginalText
        if (origEl) origEl.textContent = `“${interim}”`
      },
      onFinal: (finalText, activeSpeaker) => {
        if (finalText && finalText.trim()) {
          const origEl = activeSpeaker === 'speaker1' ? this.elements.s1OriginalText : this.elements.s2OriginalText
          if (origEl) origEl.textContent = `“${finalText.trim()}”`
          this._doMeetingTranslate(activeSpeaker, finalText.trim())
        }
      },
      onError: (err, activeSpeaker) => {
        logDebug(`[Meeting STT] Error on ${activeSpeaker}: ${err}`)
        this._resetMeetingMicUI()
      },
      onEnd: () => {
        this._resetMeetingMicUI()
      },
    })
  }

  async _doMeetingTranslate(speakerId, text) {
    if (!this.engine.isReady() || !text || this.isMeetingTranslating) return

    this.isMeetingTranslating = true

    const s1Lang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker1Lang.value)
    const s2Lang = SUPPORTED_LANGUAGES.find((l) => l.code === this.elements.meetingSpeaker2Lang.value)

    const sourceLang = speakerId === 'speaker1' ? s1Lang : s2Lang
    const targetLang = speakerId === 'speaker1' ? s2Lang : s1Lang
    const targetOutputEl = speakerId === 'speaker1' ? this.elements.s2TranslatedText : this.elements.s1TranslatedText

    try {
      targetOutputEl.innerHTML = ''
      const translated = await this.engine.translate({
        text,
        sourceName: sourceLang.name,
        targetName: targetLang.name,
        outputEl:   targetOutputEl,
      })

      if (translated && translated.trim()) {
        // Record conversational turn in meeting history
        this.meeting.addTurn({
          speakerId,
          original:   text,
          translated: translated.trim(),
          sourceLang,
          targetLang,
        })

        // Auto-Speak in the partner's language
        const shouldAutoSpeak = this.meeting.autoSpeak && this.tts.enabled
        if (shouldAutoSpeak) {
          this.tts.speak(translated.trim(), targetLang.bcp47, () => {
            // After TTS finishes speaking: check if Hands-Free Auto-Turn is active
            if (this.meeting.autoTurn && this.currentMode === APP_MODES.MEETING) {
              const nextSpeaker = speakerId === 'speaker1' ? 'speaker2' : 'speaker1'
              setTimeout(() => {
                this._toggleMeetingMic(nextSpeaker)
              }, 400)
            }
          })
        } else {
          // If not auto-speaking, still trigger auto-turn if enabled
          if (this.meeting.autoTurn && this.currentMode === APP_MODES.MEETING) {
            const nextSpeaker = speakerId === 'speaker1' ? 'speaker2' : 'speaker1'
            setTimeout(() => {
              this._toggleMeetingMic(nextSpeaker)
            }, 600)
          }
        }
      }
    } catch (err) {
      logDebug(`Meeting translation error: ${err.message}`)
      targetOutputEl.textContent = '⚠ Translation failed.'
    } finally {
      this.isMeetingTranslating = false
    }
  }

  _hapticFeedback() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(25)
      } catch (_) {}
    }
  }
}

// Bootstrap
const app = new TranslationApp()
document.addEventListener('DOMContentLoaded', () => app.init())
export default app
