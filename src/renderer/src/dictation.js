// Speech-to-text. Two engines behind one interface:
//   whisper   — local/offline via transformers.js. Streaming: it re-transcribes
//               the growing current phrase every ~0.5s (shown as live interim
//               text) and commits on a voice-activity pause. Prefers WebGPU.
//   webspeech — Chromium's webkitSpeechRecognition; unreliable in Electron.
// Callbacks: onInterim(text), onFinal(text), onStatus(text)

const WHISPER_MODEL = 'onnx-community/whisper-base.en'

const VOICE_RMS = 0.01     // per-block RMS above this counts as speech
const SILENCE_MS = 900     // pause this long (after speech) → commit
const MIN_VOICED_S = 0.3   // need this much actual voice before transcribing
const GROWTH_S = 0.25      // re-transcribe once this much new audio arrived
const MAX_PHRASE_S = 18    // force a commit on very long unbroken speech
const TICK_MS = 500

export function createDictation(engine = 'whisper', opts = {}) {
  if (engine === 'whisper') return new WhisperDictation(opts)
  return new WebSpeechDictation(opts)
}

// Whisper emits these markers for music/noise/silence — drop them.
function cleanText(raw) {
  const s = (raw || '')
    .replace(/\[[^\]]*\]/g, ' ')   // [BLANK_AUDIO], [Music]
    .replace(/\([^)]*\)/g, ' ')    // (upbeat music)
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const junk = new Set(['thanks for watching', 'thank you for watching', 'please subscribe', 'you'])
  if (!s || junk.has(s.toLowerCase())) return ''
  return s
}

class WebSpeechDictation {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    this.supported = !!SR
    this.SR = SR
    this.active = false
  }

  async start(onInterim, onFinal, onStatus) {
    if (!this.supported) throw new Error('Web Speech is not available in this build')
    this.active = true
    onStatus('LISTENING')
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

  async start(onInterim, onFinal, onStatus) {
    this.active = true
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    this.transcriber = await this.load(pipeline, onStatus)
    if (!this.active) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: this.deviceId ? { deviceId: { exact: this.deviceId } } : true
    })
    const ctx = new AudioContext()
    this.ctx = ctx
    this.rate = ctx.sampleRate
    const source = ctx.createMediaStreamSource(this.stream)
    const proc = ctx.createScriptProcessor(4096, 1, 1)
    this.proc = proc

    this.reset()
    this.lastVoice = 0

    proc.onaudioprocess = (e) => {
      if (!this.active) return
      const data = e.inputBuffer.getChannelData(0)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
      const rms = Math.sqrt(sum / data.length)
      if (rms > VOICE_RMS) { this.lastVoice = performance.now(); this.voiced += data.length }
      this.phrase.push(new Float32Array(data))
      this.samples += data.length
    }
    // A muted sink keeps the ScriptProcessor pulling without echoing the mic.
    const sink = ctx.createGain()
    sink.gain.value = 0
    source.connect(proc)
    proc.connect(sink)
    sink.connect(ctx.destination)

    onStatus(`LISTENING · ${this.device}`)
    this.loop = setInterval(() => this.tick(onInterim, onFinal), TICK_MS)
  }

  reset() { this.phrase = []; this.samples = 0; this.processed = 0; this.voiced = 0 }

  async load(pipeline, onStatus) {
    const attempts = [
      { device: 'webgpu', dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }, label: 'GPU' },
      { device: 'webgpu', dtype: 'fp32', label: 'GPU' },
      { device: 'wasm', dtype: 'q8', label: 'CPU' }
    ]
    let lastErr
    for (const a of attempts) {
      try {
        onStatus(`LOADING · ${a.label}…`)
        const t = await pipeline('automatic-speech-recognition', this.model, { device: a.device, dtype: a.dtype })
        this.device = a.label
        return t
      } catch (e) { lastErr = e; if (a.device === 'webgpu') console.warn('[dictation] WebGPU load failed:', e) }
    }
    throw lastErr || new Error('Could not initialise Whisper')
  }

  async tick(onInterim, onFinal) {
    if (this.busy || !this.active) return

    const hasVoice = this.voiced > this.rate * MIN_VOICED_S
    if (!hasVoice) {
      // No speech yet — don't feed silence to Whisper. Trim the idle buffer.
      if (this.samples > this.rate * 2) this.reset()
      return
    }

    const now = performance.now()
    const silent = (now - this.lastVoice) > SILENCE_MS
    const tooLong = this.samples > this.rate * MAX_PHRASE_S
    const grew = this.samples - this.processed > this.rate * GROWTH_S
    if (!grew && !silent && !tooLong) return

    this.busy = true
    this.processed = this.samples
    try {
      const audio = downsample(mergeFloat32(this.phrase), this.rate, 16000)
      const out = await this.transcriber(audio)
      const text = cleanText(out.text)
      if (silent || tooLong) {
        if (text) onFinal(text)
        this.reset()
      } else if (text) {
        onInterim(text)
      }
    } catch { /* skip this pass */ }
    this.busy = false
  }

  stop() {
    this.active = false
    clearInterval(this.loop)
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
