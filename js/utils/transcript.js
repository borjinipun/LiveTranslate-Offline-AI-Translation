/**
 * TranscriptHistory — manages the in-memory session log of translation pairs.
 */
export default class TranscriptHistory {
  constructor() {
    /** @type {Array<{original: string, translated: string, sourceLang: string, targetLang: string, timestamp: Date}>} */
    this.entries = []
  }

  /**
   * Add a new translation pair.
   * @param {object} entry
   * @param {string} entry.original    - Source text
   * @param {string} entry.translated  - Translated text
   * @param {string} entry.sourceLang  - Source language name
   * @param {string} entry.targetLang  - Target language name
   */
  add({ original, translated, sourceLang, targetLang }) {
    this.entries.push({ original, translated, sourceLang, targetLang, timestamp: new Date() })
  }

  /** Clear all entries. */
  clear() {
    this.entries = []
  }

  /**
   * Render the full session history into a container element.
   * @param {HTMLElement} containerEl
   */
  render(containerEl) {
    containerEl.innerHTML = ''

    if (this.entries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'transcript-empty'
      empty.textContent = 'No translations yet. Start translating to see history.'
      containerEl.appendChild(empty)
      return
    }

    // Newest first
    ;[...this.entries].reverse().forEach((entry, i) => {
      const card = document.createElement('div')
      card.className = 'transcript-card'
      card.setAttribute('data-index', this.entries.length - 1 - i)

      const meta = document.createElement('div')
      meta.className = 'transcript-meta'

      const langs = document.createElement('span')
      langs.className = 'transcript-langs'
      langs.textContent = `${entry.sourceLang} → ${entry.targetLang}`

      const time = document.createElement('span')
      time.className = 'transcript-time'
      time.textContent = entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      meta.appendChild(langs)
      meta.appendChild(time)

      const original = document.createElement('div')
      original.className = 'transcript-original'
      original.textContent = entry.original

      const arrow = document.createElement('div')
      arrow.className = 'transcript-arrow'
      arrow.innerHTML = '↓'

      const translated = document.createElement('div')
      translated.className = 'transcript-translated'
      translated.textContent = entry.translated

      card.appendChild(meta)
      card.appendChild(original)
      card.appendChild(arrow)
      card.appendChild(translated)
      containerEl.appendChild(card)
    })
  }
}
