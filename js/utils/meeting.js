/**
 * MeetingManager — Real-time Interpreter & Meeting Translation System.
 * Manages dual-participant turns, face-to-face tabletop orientation, live dialogue stream,
 * automated turn-taking, session timers, and transcript export.
 */

export default class MeetingManager {
  constructor() {
    this.dialogue = []
    this.speaker1 = { id: 'speaker1', name: 'Speaker 1', langCode: 'en' }
    this.speaker2 = { id: 'speaker2', name: 'Speaker 2', langCode: 'es' }

    this.activeSpeaker = null
    this.autoTurn = false
    this.autoSpeak = true
    this.isInverted = false

    this.startTime = null
    this.timerInterval = null
    this.elapsedSeconds = 0

    this._onTimerTick = null
    this._onDialogueUpdate = null
  }

  setLanguages(s1LangCode, s2LangCode) {
    this.speaker1.langCode = s1LangCode
    this.speaker2.langCode = s2LangCode
  }

  startMeeting() {
    if (!this.startTime) {
      this.startTime = new Date()
      this.elapsedSeconds = 0
    }
    if (this.timerInterval) clearInterval(this.timerInterval)
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++
      if (this._onTimerTick) {
        this._onTimerTick(this.getFormattedTime())
      }
    }, 1000)
  }

  stopMeeting() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval)
      this.timerInterval = null
    }
  }

  resetMeeting() {
    this.stopMeeting()
    this.startTime = null
    this.elapsedSeconds = 0
    this.dialogue = []
    this.activeSpeaker = null
    if (this._onTimerTick) this._onTimerTick('00:00')
    if (this._onDialogueUpdate) this._onDialogueUpdate()
  }

  onTimerTick(callback) {
    this._onTimerTick = callback
  }

  onDialogueUpdate(callback) {
    this._onDialogueUpdate = callback
  }

  getFormattedTime() {
    const mins = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0')
    const secs = (this.elapsedSeconds % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  getStats() {
    const s1Turns = this.dialogue.filter((d) => d.speakerId === 'speaker1').length
    const s2Turns = this.dialogue.filter((d) => d.speakerId === 'speaker2').length
    return {
      totalTurns: this.dialogue.length,
      s1Turns,
      s2Turns,
    }
  }

  /**
   * Add a completed conversational turn to dialogue
   * @param {object} item
   */
  addTurn({ speakerId, original, translated, sourceLang, targetLang }) {
    if (!this.startTime) {
      this.startMeeting()
    }

    const entry = {
      id: 'turn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      speakerId,
      speakerName: speakerId === 'speaker1' ? 'Speaker 1' : 'Speaker 2',
      original: original.trim(),
      translated: translated.trim(),
      sourceLang, // { code, name, flag, bcp47 }
      targetLang, // { code, name, flag, bcp47 }
      timestamp: new Date(),
    }

    this.dialogue.push(entry)
    if (this._onDialogueUpdate) {
      this._onDialogueUpdate()
    }
    return entry
  }

  /**
   * Render the meeting timeline/chat bubbles
   * @param {HTMLElement} containerEl
   * @param {Function} onReplay - (text, bcp47) => void
   */
  render(containerEl, onReplay = null) {
    if (!containerEl) return
    containerEl.innerHTML = ''

    if (this.dialogue.length === 0) {
      const emptyState = document.createElement('div')
      emptyState.className = 'meeting-empty-state'
      emptyState.innerHTML = `
        <div class="empty-icon">🎙️</div>
        <h3>Live Meeting Interpreter Ready</h3>
        <p>Tap either microphone below or enable <strong>Hands-Free Auto-Turn</strong> to begin dual-language interpretation.</p>
        <span class="empty-hint">Tip: Use <strong>Tabletop Invert</strong> on smartphones for face-to-face meetings!</span>
      `
      containerEl.appendChild(emptyState)
      return
    }

    this.dialogue.forEach((turn) => {
      const bubble = document.createElement('div')
      const isS1 = turn.speakerId === 'speaker1'
      bubble.className = `dialogue-bubble ${isS1 ? 'bubble-s1' : 'bubble-s2'}`

      const timeStr = turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

      bubble.innerHTML = `
        <div class="bubble-header">
          <div class="bubble-speaker">
            <span class="speaker-tag">${isS1 ? '🔵 Speaker 1' : '🟣 Speaker 2'}</span>
            <span class="speaker-lang">${turn.sourceLang.flag} ${turn.sourceLang.name} → ${turn.targetLang.flag} ${turn.targetLang.name}</span>
          </div>
          <span class="bubble-time">${timeStr}</span>
        </div>
        <div class="bubble-body">
          <div class="bubble-original">${escapeHtml(turn.original)}</div>
          <div class="bubble-translated">${escapeHtml(turn.translated)}</div>
        </div>
        <div class="bubble-actions">
          <button class="bubble-audio-btn" title="Replay Translation Audio" aria-label="Replay speech">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
            </svg>
            Play
          </button>
        </div>
      `

      const playBtn = bubble.querySelector('.bubble-audio-btn')
      if (playBtn && onReplay) {
        playBtn.addEventListener('click', () => {
          onReplay(turn.translated, turn.targetLang.bcp47)
        })
      }

      containerEl.appendChild(bubble)
    })

    // Scroll to latest utterance
    containerEl.scrollTop = containerEl.scrollHeight
  }

  /**
   * Export the entire meeting conversation
   * @param {'markdown'|'txt'} format
   */
  exportTranscript(format = 'markdown') {
    if (this.dialogue.length === 0) {
      alert('No meeting dialogue to export yet.')
      return
    }

    const dateStr = new Date().toISOString().split('T')[0]
    let content = ''
    let filename = `live-translate-meeting-${dateStr}`

    if (format === 'markdown') {
      filename += '.md'
      content = `# 🎙️ LiveTranslate — Meeting Transcript\n\n`
      content += `- **Date:** ${new Date().toLocaleString()}\n`
      content += `- **Duration:** ${this.getFormattedTime()}\n`
      content += `- **Speaker 1 Language:** ${this.speaker1.langCode.toUpperCase()}\n`
      content += `- **Speaker 2 Language:** ${this.speaker2.langCode.toUpperCase()}\n`
      content += `- **Total Utterances:** ${this.dialogue.length}\n\n`
      content += `---\n\n`

      this.dialogue.forEach((d, idx) => {
        const time = d.timestamp.toLocaleTimeString()
        content += `### ${idx + 1}. ${d.speakerName} (${d.sourceLang.name} → ${d.targetLang.name}) — *${time}*\n`
        content += `**Original:**\n> ${d.original}\n\n`
        content += `**Translation:**\n> ${d.translated}\n\n`
      })
    } else {
      filename += '.txt'
      content = `LiveTranslate — Meeting Transcript (${new Date().toLocaleString()})\n`
      content += `Duration: ${this.getFormattedTime()} | Total: ${this.dialogue.length} utterances\n\n`

      this.dialogue.forEach((d, idx) => {
        const time = d.timestamp.toLocaleTimeString()
        content += `[${time}] ${d.speakerName} (${d.sourceLang.name} -> ${d.targetLang.name}):\n`
        content += `  Original: ${d.original}\n`
        content += `  Translated: ${d.translated}\n\n`
      })
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
