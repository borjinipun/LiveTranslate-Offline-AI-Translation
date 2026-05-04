/**
 * Live Translation App — Main Application Controller
 */
import { prebuiltAppConfig } from 'https://esm.run/@mlc-ai/web-llm@0.2.79'
import {
  MODEL_DATA,
  MODEL_SIZES,
  ELEMENT_IDS,
  SUPPORTED_LANGUAGES,
} from './config.js'
import { initLogger, logDebug, logBrowserInfo, logStatus } from './utils/logger.js'
import { populateModelSelect } from './utils/ui.js'
import TranslationEngine from './models/llm-model.js'
import SpeechInputManager from './utils/speech.js'
import TranscriptHistory from './utils/transcript.js'
import TTSManager from './utils/tts.js'

class TranslationApp {
  constructor() {
    this.elements = {}
    this.engine = new TranslationEngine()
    this.speech = new SpeechInputManager()
    this.history = new TranscriptHistory()
    this.tts = new TTSManager()

    this.isModelLoading = false
    this.isTranslating = false
    this._pendingTranslation = null
    this.warningDismissed = false

    // Current interim mic text (not yet finalized)
    this._interimText = ''
    // Base text before the current speech segment started
    this._baseText = ''
    // Debounce timer for auto-translate on text input
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
      output:    null, // no chat output
      topStatus: this.elements.topStatus,
    })

    populateModelSelect(this.elements.modelSelect, MODEL_DATA)
    this.engine.setElements(this.elements)

    logBrowserInfo()
    logDebug(`Speech API supported: ${this.speech.isSupported}`)

    // Pre-select default model
    const defaultId = 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'
    for (let i = 0; i < this.elements.modelSelect.options.length; i++) {
      if (this.elements.modelSelect.options[i].value === defaultId) {
        this.elements.modelSelect.selectedIndex = i
        this._updateResourceWarning()
        break
      }
    }

    // Initial empty transcript render
    this.history.render(this.elements.transcriptList)
  }

  // ── DOM binding ────────────────────────────────────────────────────────────

  _bindElements() {
    Object.keys(ELEMENT_IDS).forEach((key) => {
      this.elements[key] = document.getElementById(ELEMENT_IDS[key])
    })
    this.elements.dismissWarningBtn = document.getElementById('dismiss-warning')
  }

  _populateLanguageSelects() {
    const { sourceLangSelect, targetLangSelect } = this.elements

    SUPPORTED_LANGUAGES.forEach((lang) => {
      const optA = new Option(`${lang.flag}  ${lang.name}`, lang.code)
      const optB = new Option(`${lang.flag}  ${lang.name}`, lang.code)
      sourceLangSelect.appendChild(optA)
      targetLangSelect.appendChild(optB)
    })

    // Defaults: English → Spanish
    sourceLangSelect.value = 'en'
    targetLangSelect.value = 'es'
  }

  // ── Event Listeners ────────────────────────────────────────────────────────

  _attachListeners() {
    // Load model
    this.elements.loadModelBtn.addEventListener('click', () => this._loadModel())
    this.elements.modelSelect.addEventListener('change', () => this._updateResourceWarning())
    if (this.elements.dismissWarningBtn) {
      this.elements.dismissWarningBtn.addEventListener('click', () => {
        this.elements.resourceWarning.style.display = 'none'
        this.warningDismissed = true
      })
    }

    // Language swap
    this.elements.swapLangsBtn.addEventListener('click', () => this._swapLanguages())

    // Translate button
    this.elements.translateBtn.addEventListener('click', () => this._doTranslate())

    // Auto-translate on input (debounced 800 ms)
    this.elements.sourceInput.addEventListener('input', () => {
      clearTimeout(this._debounceTimer)
      this._debounceTimer = setTimeout(() => {
        if (this.elements.sourceInput.value.trim()) this._doTranslate()
      }, 800)
    })

    // Ctrl/Cmd + Enter to translate immediately
    this.elements.sourceInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        clearTimeout(this._debounceTimer)
        this._doTranslate()
      }
    })

    // Mic
    this.elements.micBtn.addEventListener('click', () => this._toggleMic())

    // Clear current text
    this.elements.clearBtn.addEventListener('click', () => {
      this.elements.sourceInput.value = ''
      this.elements.translationOutput.textContent = ''
      this.elements.translationOutput.classList.remove('streaming', 'has-content')
      this._showPlaceholder(true)
    })

    // Clear history
    this.elements.clearHistoryBtn.addEventListener('click', () => {
      this.history.clear()
      this.history.render(this.elements.transcriptList)
    })

    // TTS Toggle
    if (this.elements.ttsToggleBtn) {
      this.elements.ttsToggleBtn.addEventListener('click', () => {
        this.tts.toggle(!this.tts.enabled)
        const btn = this.elements.ttsToggleBtn
        if (this.tts.enabled) {
          btn.classList.add('active')
          btn.title = 'Read Aloud Translated Text (Enabled)'
        } else {
          btn.classList.remove('active')
          btn.title = 'Read Aloud Translated Text (Disabled)'
        }
      })
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

    // Show status panel
    if (this.elements.statusContainer) {
      this.elements.statusContainer.style.display = 'block'
    }

    try {
      await this.engine.loadModel(modelId)
      this._setTranslateEnabled(true)
      this.elements.loadModelBtn.textContent = '✓ Loaded'
      this.elements.loadModelBtn.classList.add('loaded')
      logDebug('Model ready for translation')
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

  // ── Translation ────────────────────────────────────────────────────────────

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
      // If a translation is already in progress, queue the new request
      // and try to interrupt the current one.
      this._pendingTranslation = { isFinal }
      if (this.engine.engine && typeof this.engine.engine.interruptGenerate === 'function') {
        this.engine.engine.interruptGenerate()
      }
      return
    }

    this.isTranslating = true
    this._pendingTranslation = null

    const sourceLang = SUPPORTED_LANGUAGES.find(
      (l) => l.code === this.elements.sourceLangSelect.value,
    )
    const targetLang = SUPPORTED_LANGUAGES.find(
      (l) => l.code === this.elements.targetLangSelect.value,
    )

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
        }
      })

      // Add to history only if it's a final translation
      // Also ensure we weren't interrupted by checking _pendingTranslation
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

      // Process queued translation if any
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
    this.elements.micBtn.disabled       = !enabled
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

  // ── Language Swap ──────────────────────────────────────────────────────────

  _swapLanguages() {
    const src = this.elements.sourceLangSelect.value
    const tgt = this.elements.targetLangSelect.value
    this.elements.sourceLangSelect.value = tgt
    this.elements.targetLangSelect.value = src

    // Also swap text content
    const srcText = this.elements.sourceInput.value
    const tgtText = this.elements.translationOutput.textContent
    this.elements.sourceInput.value = tgtText
    this.elements.translationOutput.textContent = srcText

    // Animate swap button
    this.elements.swapLangsBtn.classList.add('spinning')
    setTimeout(() => this.elements.swapLangsBtn.classList.remove('spinning'), 400)
  }

  // ── Microphone ─────────────────────────────────────────────────────────────

  _toggleMic() {
    if (!this.speech.isSupported) {
      logStatus('Microphone input is not supported in this browser (use Chrome or Edge).')
      return
    }
    if (this.speech.isListening) {
      this.speech.stop()
      this._updateMicUI(false)
    } else {
      const langCode = this.elements.sourceLangSelect.value
      const sourceLang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode)
      const speechLang = sourceLang ? sourceLang.bcp47 : 'en-US'
      
      const started = this.speech.start({
        lang: speechLang,
        onInterim: (interim) => {
          this._interimText = interim
          // Show interim in source box
          this.elements.sourceInput.value = this._interimText
          this.elements.sourceInput.classList.add('interim')
          
          // Debounce interim translation (live translation)
          clearTimeout(this._debounceTimer)
          this._debounceTimer = setTimeout(() => this._doTranslate(false), 800)
        },
        onFinal: (final) => {
          this._interimText = ''
          this.elements.sourceInput.value = final
          this.elements.sourceInput.classList.remove('interim')
          
          // Auto-translate on final segment
          clearTimeout(this._debounceTimer)
          this._debounceTimer = setTimeout(() => this._doTranslate(true), 400)
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
    btn.title = listening ? 'Click to stop' : 'Click to speak'
  }
}

// Bootstrap
const app = new TranslationApp()
document.addEventListener('DOMContentLoaded', () => app.init())
export default app
