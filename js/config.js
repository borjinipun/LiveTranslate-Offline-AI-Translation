/**
 * Live Translation — Configuration
 */

// ── Supported Languages ──────────────────────────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇬🇧' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', name: 'French',     flag: '🇫🇷' },
  { code: 'de', name: 'German',     flag: '🇩🇪' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹' },
]

// ── Translation Prompt Builder ───────────────────────────────────────────────
/**
 * Build a system prompt that instructs the model to act as a pure translator.
 * @param {string} sourceCode  - BCP-47 language code for source
 * @param {string} sourceName  - Human-readable source language
 * @param {string} targetName  - Human-readable target language
 * @returns {string}
 */
export function buildTranslationPrompt(sourceCode, sourceName, targetName) {
  return (
    `You are a professional translator. Your ONLY task is to translate text ` +
    `from ${sourceName} to ${targetName}.\n\n` +
    `Rules:\n` +
    `- Output ONLY the translated text, nothing else.\n` +
    `- Do not add explanations, notes, or commentary.\n` +
    `- Preserve the original punctuation, line breaks, and formatting.\n` +
    `- If the input is already in ${targetName}, output it unchanged.\n` +
    `- If the input is empty or meaningless, output nothing.`
  )
}

// ── Model Configuration ──────────────────────────────────────────────────────
export const MODEL_SIZES = {
  'Qwen2.5-0.5B-Instruct-q4f32_1-MLC': 'small',
  'Qwen2.5-1.5B-Instruct-q4f32_1-MLC': 'small',
  'Qwen2.5-3B-Instruct-q4f32_1-MLC':   'medium',
  'Qwen2.5-7B-Instruct-q4f32_1-MLC':   'medium',
}

export const MODEL_DATA = [
  {
    group: 'Fast (Recommended)',
    models: [
      { id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', name: 'Qwen2.5 0.5B — 1.1 GB (Fastest)', size: '1.1 GB' },
      { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', name: 'Qwen2.5 1.5B — 1.9 GB (Balanced)', size: '1.9 GB' },
    ],
  },
  {
    group: 'High Quality (Requires faster GPU)',
    models: [
      { id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',   name: 'Qwen2.5 3B — 3.1 GB',  size: '3.1 GB' },
      { id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',   name: 'Qwen2.5 7B — 5.9 GB',  size: '5.9 GB' },
    ],
  },
]

// ── WebLLM Version ───────────────────────────────────────────────────────────
export const WEB_LLM_VERSION = '0.2.79'

// ── DOM Element IDs ──────────────────────────────────────────────────────────
export const ELEMENT_IDS = {
  // Model loading
  modelSelect:             'model-select',
  loadModelBtn:            'load-model-btn',
  resourceWarning:         'resource-warning',
  statusContainer:         'status-container',
  status:                  'status',
  progressContainer:       'progress-container',
  progressFill:            'progress-fill',
  progressText:            'progress-text',
  statusProgressContainer: 'status-progress-container',
  statusProgressFill:      'status-progress-fill',
  statusProgressText:      'status-progress-text',

  // Translation UI
  sourceLangSelect:  'source-lang-select',
  targetLangSelect:  'target-lang-select',
  swapLangsBtn:      'swap-langs-btn',
  sourceInput:       'source-input',
  translateBtn:      'translate-btn',
  translationOutput: 'translation-output',
  micBtn:            'mic-btn',
  micStatus:         'mic-status',
  clearBtn:          'clear-btn',

  // Transcript history
  transcriptPanel:   'transcript-panel',
  transcriptList:    'transcript-list',
  clearHistoryBtn:   'clear-history-btn',

  // Debug
  debug:             'debug',
  topStatus:         'top-status',
}
