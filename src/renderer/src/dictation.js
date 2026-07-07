// Speech-to-text. Two engines behind one interface:
//   webspeech — Chromium's webkitSpeechRecognition. Online, zero-install, but in
//               Electron it often fails ('network') because Electron ships without
//               Chrome's Google Speech API key, and it always uses the OS default
//               input (no device selection).
//   whisper   — local, offline, runs Whisper via transformers.js in the renderer.
//               Fully controls the input device, so the device selector applies.
// The editor only ever sees onInterim / onFinal.

const WHISPER_MODEL = 'onnx-community/whisper-base.en'

export function createDictation(engine = 'webspeech', opts = {}) {
  if (engine === 'whisper') return new WhisperDictation(opts)
  return new WebSpeechDictation(opts)
}

class WebSpeechDictation {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    this.supported = !!SR
    this.SR = SR
    this.active = false
  }

  async start(onInterim, onFinal) {
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
  constructor(opts = {}) {
    this.deviceId = opts.deviceId || ''
    this.model = opts.model || WHISPER_MODEL
    this.active = false
    this.busy = false
  }

  async start(onInterim, onFinal) {
    this.active = true
    onInterim('LOADING MODEL…')
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    this.transcriber = await pipeline('automatic-speech-recognition', this.model)
    if (!this.active) return
    onInterim('')

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: this.deviceId ? { deviceId: { exact: this.deviceId } } : true
    })
    const ctx = new AudioContext()
    this.ctx = ctx
    const source = ctx.createMediaStreamSource(this.stream)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    this.proc = proc

    this.chunks = []
    this.samples = 0
    const windowSamples = ctx.sampleRate * 5 // transcribe every ~5s

    proc.onaudioprocess = (e) => {
      if (!this.active) return
      this.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      this.samples += e.inputBuffer.length
      if (this.samples >= windowSamples && !this.busy) this.flush(ctx.sampleRate, onFinal)
    }
    source.connect(proc)
    proc.connect(ctx.destination)
  }

  async flush(rate, onFinal) {
    this.busy = true
    const merged = mergeFloat32(this.chunks)
    this.chunks = []
    this.samples = 0
    try {
      const audio = downsample(merged, rate, 16000)
      const out = await this.transcriber(audio)
      const text = (out.text || '').trim()
      if (text && this.active) onFinal(text + ' ')
    } catch { /* skip this window */ }
    this.busy = false
  }

  stop() {
    this.active = false
    try { if (this.proc) { this.proc.onaudioprocess = null; this.proc.disconnect() } } catch {}
    try { if (this.ctx) this.ctx.close() } catch {}
    try { if (this.stream) this.stream.getTracks().forEach(t => t.stop()) } catch {}
  }
}

function mergeFloat32(chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Float32Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

function downsample(buffer, inRate, outRate) {
  if (outRate >= inRate) return buffer
  const ratio = inRate / outRate
  const len = Math.round(buffer.length / ratio)
  const out = new Float32Array(len)
  for (let i = 0; i < len; i++) out[i] = buffer[Math.floor(i * ratio)]
  return out
}
