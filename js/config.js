/**
 * Live Translation — Configuration
 */

// ── Supported Languages ──────────────────────────────────────────────────────
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇬🇧', bcp47: 'en-US' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸', bcp47: 'es-ES' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳', bcp47: 'zh-CN' },
  { code: 'fr', name: 'French',     flag: '🇫🇷', bcp47: 'fr-FR' },
  { code: 'de', name: 'German',     flag: '🇩🇪', bcp47: 'de-DE' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵', bcp47: 'ja-JP' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷', bcp47: 'ko-KR' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦', bcp47: 'ar-SA' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹', bcp47: 'pt-BR' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺', bcp47: 'ru-RU' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳', bcp47: 'hi-IN' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹', bcp47: 'it-IT' },
]

// ── Translation Prompt Builder ───────────────────────────────────────────────
/**
 * Build a system prompt that instructs the model to act as a pure translator.
 * @param {string} sourceName  - Human-readable source language
 * @param {string} targetName  - Human-readable target language
 * @returns {string}
 */
export function buildTranslationPrompt(sourceName, targetName) {
  return (
    `You are a professional real-time interpreter. Your ONLY task is to translate text ` +
    `from ${sourceName} to ${targetName}.\n\n` +
    `Rules:\n` +
    `- Output ONLY the translated text, nothing else.\n` +
    `- Do not add explanations, notes, apologies, or commentary.\n` +
    `- Preserve the conversational tone, punctuation, and meaning.\n` +
    `- If the input is already in ${targetName}, output it unchanged.\n` +
    `- If the input is empty or unintelligible, output nothing.`
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
    group: 'Mobile & Fast (Recommended)',
    models: [
      { id: 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC', name: 'Qwen2.5 0.5B — 1.1 GB (Best for Smartphones & Fast)', size: '1.1 GB' },
      { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', name: 'Qwen2.5 1.5B — 1.9 GB (Balanced Quality)', size: '1.9 GB' },
    ],
  },
  {
    group: 'High Quality (Requires Dedicated GPU)',
    models: [
      { id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',   name: 'Qwen2.5 3B — 3.1 GB',  size: '3.1 GB' },
      { id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',   name: 'Qwen2.5 7B — 5.9 GB',  size: '5.9 GB' },
    ],
  },
]

// ── WebLLM Version ───────────────────────────────────────────────────────────
export const WEB_LLM_VERSION = '0.2.79'

// ── App Modes ────────────────────────────────────────────────────────────────
export const APP_MODES = {
  TRANSLATE: 'translate',
  MEETING:   'meeting',
}

// ── DOM Element IDs ──────────────────────────────────────────────────────────
export const ELEMENT_IDS = {
  // Mode switcher
  navTranslateBtn:         'nav-translate-btn',
  navMeetingBtn:           'nav-meeting-btn',
  workspaceTranslate:      'workspace-translate',
  workspaceMeeting:        'workspace-meeting',

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

  // Offline Engine Status Badges
  sttStatus:               'stt-status',
  ttsStatus:               'tts-status',
  sttEngineToggle:         'stt-engine-toggle',
  topStatus:               'top-status',
  debug:                   'debug',

  // Translate Mode Workspace
  sourceLangSelect:        'source-lang-select',
  targetLangSelect:        'target-lang-select',
  swapLangsBtn:            'swap-langs-btn',
  sourceInput:             'source-input',
  translateBtn:            'translate-btn',
  translationOutput:       'translation-output',
  micBtn:                  'mic-btn',
  micStatus:               'mic-status',
  clearBtn:                'clear-btn',
  ttsToggleBtn:            'tts-toggle-btn',
  transcriptList:          'transcript-list',
  clearHistoryBtn:         'clear-history-btn',

  // Meeting / Interpreter Workspace
  meetingSpeaker1Lang:     'meeting-s1-lang',
  meetingSpeaker2Lang:     'meeting-s2-lang',
  meetingSwapBtn:          'meeting-swap-btn',
  meetingTimer:            'meeting-timer',
  meetingStats:            'meeting-stats',
  clearMeetingBtn:         'clear-meeting-btn',
  exportMeetingBtn:        'export-meeting-btn',
  autoTurnToggle:          'auto-turn-toggle',
  meetingAutoTtsToggle:    'meeting-auto-tts-toggle',
  invertSpeaker2Btn:       'invert-speaker2-btn',

  // Split Panels
  s1Pane:                  'meeting-pane-s1',
  s2Pane:                  'meeting-pane-s2',
  s1OriginalText:          'meeting-s1-original',
  s1TranslatedText:        'meeting-s1-translated',
  s2OriginalText:          'meeting-s2-original',
  s2TranslatedText:        'meeting-s2-translated',
  s1MicBtn:                'meeting-s1-mic',
  s2MicBtn:                'meeting-s2-mic',
  s1StatusBadge:           'meeting-s1-badge',
  s2StatusBadge:           'meeting-s2-badge',

  // Meeting Dialogue Stream
  meetingDialogueList:     'meeting-dialogue-list',
}
