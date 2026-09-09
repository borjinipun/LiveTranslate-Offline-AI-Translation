/**
 * TranslationEngine — WebGPU-powered local translation via WebLLM.
 * Replaces the old LLMModel chat/RAG class.
 */
import { CreateMLCEngine } from 'https://esm.run/@mlc-ai/web-llm@0.2.85'
import { logDebug, logError, logStatus } from '../utils/logger.js'
import { calculateRemainingTime, updateProgress, checkWebGPUSupport } from '../utils/ui.js'
import { isModelDownloaded, markModelDownloaded } from '../utils/db.js'
import { buildTranslationPrompt } from '../config.js'

export default class TranslationEngine {
  constructor() {
    this.engine = null
    this.elements = {}
  }

  /** @param {object} elements - Mapped DOM element references */
  setElements(elements) {
    this.elements = elements
  }

  /** @returns {boolean} */
  isReady() {
    return this.engine !== null
  }

  /**
   * Load (or reuse cached) a model by ID.
   * @param {string} modelId
   */
  async loadModel(modelId) {
    try {
      checkWebGPUSupport()

      const selectedOption = Array.from(this.elements.modelSelect.options).find(
        (opt) => opt.value === modelId,
      )
      const downloadSize = selectedOption ? selectedOption.dataset.size : '?'
      const isDownloaded = await isModelDownloaded(modelId)

      if (isDownloaded) {
        logStatus('Loading model from cache…', true)
      } else {
        logStatus(`Downloading model (${downloadSize}). This may take a while…`, true)
      }

      let downloadStartTime = Date.now()

      // Show progress bars
      this.elements.progressContainer.style.display = 'block'
      if (this.elements.statusProgressContainer) {
        this.elements.statusProgressContainer.style.display = 'block'
      }
      this.elements.progressFill.className = 'progress-fill indeterminate'
      if (this.elements.statusProgressFill) {
        this.elements.statusProgressFill.className = 'progress-fill indeterminate'
      }

      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress) => {
          logDebug(`Progress: ${JSON.stringify(progress)}`)

          let percent = 0
          if (progress && typeof progress === 'object' && progress.text) {
            const cacheMatch = progress.text.match(/\[(\d+)\/(\d+)\]/)
            if (cacheMatch) {
              percent = Math.floor((parseInt(cacheMatch[1]) / parseInt(cacheMatch[2])) * 100)
            } else if ('progress' in progress) {
              percent = Math.floor(progress.progress * 100)
            } else {
              const pct = progress.text.match(/(\d+)% completed/)
              if (pct) percent = parseInt(pct[1])
            }
          } else if (typeof progress === 'number') {
            percent = Math.floor(progress * 100)
          }

          percent = Math.max(0, Math.min(100, percent))

          const elapsed = Date.now() - downloadStartTime
          const remaining = calculateRemainingTime(elapsed, percent)

          this.elements.progressFill.className = 'progress-fill'
          this.elements.progressFill.style.marginLeft = '0'
          if (this.elements.statusProgressFill) {
            this.elements.statusProgressFill.className = 'progress-fill'
            this.elements.statusProgressFill.style.marginLeft = '0'
          }

          updateProgress(
            this.elements.progressFill,
            this.elements.progressText,
            this.elements.progressContainer,
            percent,
          )
          if (this.elements.statusProgressFill) {
            updateProgress(
              this.elements.statusProgressFill,
              this.elements.statusProgressText,
              this.elements.statusProgressContainer,
              percent,
            )
          }

          const prefix = isDownloaded ? 'Loading from cache' : 'Downloading model'
          logStatus(`${prefix}… ${percent}%${remaining}`, true)
        },
        useIndexedDBCache: true,
      })

      // Finalise progress UI
      this.elements.progressFill.className = 'progress-fill'
      this.elements.progressFill.style.marginLeft = '0'
      this.elements.progressFill.style.width = '100%'
      if (this.elements.statusProgressFill) {
        this.elements.statusProgressFill.className = 'progress-fill'
        this.elements.statusProgressFill.style.marginLeft = '0'
        this.elements.statusProgressFill.style.width = '100%'
      }
      if (this.elements.progressText) this.elements.progressText.textContent = '100%'
      if (this.elements.statusProgressText) this.elements.statusProgressText.textContent = '100%'

      setTimeout(() => {
        this.elements.progressContainer.style.display = 'none'
        if (this.elements.statusProgressContainer) {
          this.elements.statusProgressContainer.style.display = 'none'
        }
        if (this.elements.statusContainer) {
          this.elements.statusContainer.style.display = 'none'
        }
      }, 1000)

      const loadTime = ((Date.now() - downloadStartTime) / 1000).toFixed(1)
      if (!isDownloaded) {
        await markModelDownloaded(modelId)
        logStatus(`Model downloaded and ready in ${loadTime}s ✓`, true)
      } else {
        logStatus(`Model loaded from cache in ${loadTime}s ✓`, true)
      }

      return true
    } catch (error) {
      logError(`Failed to load model: ${error.message}`, true)
      logDebug(`Detailed error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`)
      throw error
    }
  }

  /**
   * Translate text, streaming tokens to a container element.
   * @param {object} opts
   * @param {string}      opts.text        - Source text to translate
   * @param {string}      opts.sourceName  - e.g. "English"
   * @param {string}      opts.targetName  - e.g. "French"
   * @param {HTMLElement} opts.outputEl    - Element to stream tokens into
   * @param {Function}    [opts.onSentence] - Called with each translated sentence
   * @returns {Promise<string>} The full translated text
   */
  async translate({ text, sourceName, targetName, outputEl, onSentence }) {
    if (!this.engine) throw new Error('No model loaded.')
    if (!text || !text.trim()) return ''

    const systemPrompt = buildTranslationPrompt(sourceName, targetName)

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: text.trim() },
    ]

    // Clear output and show shimmer
    outputEl.textContent = ''
    outputEl.classList.add('streaming')

    const stream = await this.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.1,   // Low temp for more deterministic translation
      max_tokens: 2048,
    })

    let result = ''
    let isFirst = true
    let sentenceBuffer = ''

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || ''
      result += token
      sentenceBuffer += token

      if (onSentence) {
        let match
        while ((match = sentenceBuffer.match(/([^.!?。！？\n]+[.!?。！？\n]+)(\s*)/))) {
          const sentence = match[1].trim()
          if (sentence) onSentence(sentence)
          sentenceBuffer = sentenceBuffer.substring(match[0].length)
        }
      }

      if (isFirst) {
        outputEl.classList.remove('streaming')
        isFirst = false
      }

      outputEl.textContent = result
      outputEl.scrollTop = outputEl.scrollHeight
    }

    if (onSentence && sentenceBuffer.trim()) {
      onSentence(sentenceBuffer.trim())
    }

    outputEl.classList.remove('streaming')
    return result
  }
}
