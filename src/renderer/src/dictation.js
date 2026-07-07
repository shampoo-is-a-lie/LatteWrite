// Speech-to-text. Two engines behind one interface:
//   webspeech — online, free, streaming (Chromium's webkitSpeechRecognition)
//   whisper   — offline/local (phase 2: driven from the main process)
// The editor only ever sees onInterim / onFinal, so it never cares which ran.

export function createDictation(engine = 'webspeech') {
  if (engine === 'whisper') return new WhisperDictation()
  return new WebSpeechDictation()
}

class WebSpeechDictation {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    this.supported = !!SR
    this.SR = SR
    this.active = false
  }

  start(onInterim, onFinal) {
    if (!this.supported) throw new Error('Web Speech is not available in this build')
    this.active = true
    const rec = new this.SR()
    rec.lang = 'en-US'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onFinal(r[0].transcript)
        else interim += r[0].transcript
      }
      if (interim) onInterim(interim)
    }
    // Sessions time out ~60s; restart while the user still wants to dictate.
    rec.onend = () => { if (this.active) rec.start() }
    rec.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.stop() }

    this.rec = rec
    rec.start()
  }

  stop() {
    this.active = false
    if (this.rec) { this.rec.onend = null; this.rec.stop(); this.rec = null }
  }
}

class WhisperDictation {
  constructor() { this.supported = false }
  start() { throw new Error('Local Whisper dictation is not wired yet (phase 2)') }
  stop() {}
}
