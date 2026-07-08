<script>
  import { GOOGLE_FONTS } from '../googlefonts.js'
  export let settings = {}
  export let connected = false
  export let inputs = []
  export let headingFamily = ''
  export let bodyFamily = ''
  export let tokens = {}
  export let measure = '46rem'
  export let dark = true
  export let isDraft = false
  export let editingLabel = ''
  export let onPatch = () => {}
  export let onSetFont = () => {}
  export let onSetToken = () => {}
  export let onSetMeasure = () => {}
  export let onSetDark = () => {}
  export let onSaveStyle = () => {}
  export let onSpellcheck = () => {}
  export let onConnect = () => {}
  export let onDisconnect = () => {}
  export let onClose = () => {}

  let clientId = settings.oauthClientId || ''
  let clientSecret = settings.oauthClientSecret || ''
  let syncProvider = settings.syncProvider || 'none'
  let syncOnSave = !!settings.syncOnSave
  let dictationEngine = settings.dictationEngine || 'whisper'
  let whisperModel = settings.whisperModel || 'onnx-community/whisper-base.en'
  let audioDeviceId = settings.audioDeviceId || ''
  let backupsToKeep = settings.backupsToKeep ?? 10
  let fh = headingFamily
  let fb = bodyFamily
  let newStyleName = ''
  let spellcheck = settings.spellcheck !== false
  // Reflect the live style/draft values (e.g. after a fork) back into the inputs.
  $: fh = headingFamily
  $: fb = bodyFamily
  $: colors = { ...tokens }
  $: measureNum = parseFloat(measure) || 46
  $: darkV = !!dark

  const TOKENS = [
    ['bg', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['muted', 'Muted'],
    ['accent', 'Accent'], ['caret', 'Caret'], ['rule', 'Rule']
  ]

  function apply() {
    onPatch({ oauthClientId: clientId, oauthClientSecret: clientSecret, syncProvider, syncOnSave, dictationEngine, whisperModel, audioDeviceId, backupsToKeep: Number(backupsToKeep) })
  }

  let micLevel = 0
  let micTesting = false
  async function testMic() {
    if (micTesting) { micTesting = false; return }
    micTesting = true
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true })
    } catch (e) { micTesting = false; gpuMsg = 'Mic error: ' + e.message; return }
    const ctx = new AudioContext()
    const an = ctx.createAnalyser()
    an.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(an)
    const buf = new Uint8Array(an.fftSize)
    const t0 = performance.now()
    const frame = () => {
      an.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
      micLevel = Math.min(1, Math.sqrt(sum / buf.length) * 5)
      if (micTesting && performance.now() - t0 < 8000) requestAnimationFrame(frame)
      else { micTesting = false; micLevel = 0; stream.getTracks().forEach(t => t.stop()); ctx.close() }
    }
    requestAnimationFrame(frame)
  }

  let pane = 'style'

  let gpuMsg = ''
  async function testGpu() {
    gpuMsg = 'Checking…'
    if (!navigator.gpu) { gpuMsg = 'WebGPU unavailable — navigator.gpu missing (will use CPU)'; return }
    try {
      const a = await navigator.gpu.requestAdapter()
      if (!a) { gpuMsg = 'navigator.gpu present but no adapter (will use CPU)'; return }
      const i = a.info || {}
      gpuMsg = 'WebGPU OK — ' + (i.description || i.device || i.architecture || i.vendor || 'adapter found')
    } catch (e) { gpuMsg = 'WebGPU error: ' + e.message }
  }
</script>

<div class="scrim" on:click={onClose}></div>
<div class="panel">
  <div class="cp-header">
    <h2 class="cp-title">Settings</h2>
    <button class="cp-close" title="Close" on:click={() => { apply(); onClose() }}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <div class="cp-body">
    <nav class="cp-rail">
      <button class="cp-rail-item" class:active={pane === 'style'} on:click={() => pane = 'style'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg><span>Style</span>
      </button>
      <button class="cp-rail-item" class:active={pane === 'dictation'} on:click={() => pane = 'dictation'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg><span>Dictation</span>
      </button>
      <button class="cp-rail-item" class:active={pane === 'editor'} on:click={() => pane = 'editor'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span>Editor</span>
      </button>
      <button class="cp-rail-item" class:active={pane === 'sync'} on:click={() => pane = 'sync'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg><span>Cloud Sync</span>
      </button>
      <button class="cp-rail-item" class:active={pane === 'backups'} on:click={() => pane = 'backups'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg><span>Backups</span>
      </button>
    </nav>

    <div class="cp-content">
      <section class="cp-pane" class:active={pane === 'style'}>
        <div class="cp-pane-title">Style</div>
        <p class="editing">Editing <b>{editingLabel}</b></p>

        <div class="subhead">Fonts</div>
    <label class="field">
      <span>Heading font</span>
      <input list="gfonts" bind:value={fh} on:change={() => onSetFont('heading', fh)} placeholder="Style default" />
    </label>
    <label class="field">
      <span>Body font</span>
      <input list="gfonts" bind:value={fb} on:change={() => onSetFont('body', fb)} placeholder="Style default" />
    </label>
    <datalist id="gfonts">{#each GOOGLE_FONTS as f}<option value={f}></option>{/each}</datalist>

    <div class="subhead">Colours</div>
    <div class="swatches">
      {#each TOKENS as [key, label]}
        <label class="swatch">
          <input type="color" value={colors[key]} on:input={(e) => onSetToken(key, e.target.value)} />
          <span>{label}</span>
        </label>
      {/each}
    </div>

    <div class="tworow">
      <label class="field">
        <span>Reading width (rem)</span>
        <input type="number" min="24" max="80" bind:value={measureNum} on:change={() => onSetMeasure(measureNum + 'rem')} />
      </label>
      <label class="check darkcheck">
        <input type="checkbox" bind:checked={darkV} on:change={() => onSetDark(darkV)} /> Dark style
      </label>
    </div>

    {#if isDraft}
      <div class="row">
        <input bind:value={newStyleName} placeholder="Name your style" on:keydown={(e) => e.key === 'Enter' && onSaveStyle(newStyleName)} />
        <button class="solid" on:click={() => onSaveStyle(newStyleName)}>SAVE STYLE</button>
      </div>
      <p class="note">Built-in styles are immutable, so this is an unsaved copy. Name and save it to keep it in your Style menu.</p>
    {:else}
      <p class="note">Editing a built-in forks a saveable copy; custom styles update live. Fonts accept any Google family (cached offline). Selection colour follows the accent.</p>
    {/if}
  </section>

      <section class="cp-pane" class:active={pane === 'dictation'}>
        <div class="cp-pane-title">Dictation</div>
    <label class="field">
      <span>Engine</span>
      <select bind:value={dictationEngine} on:change={apply}>
        <option value="whisper">Local Whisper (offline, recommended)</option>
        <option value="webspeech">Web Speech (online — unreliable in Electron)</option>
      </select>
    </label>
    {#if dictationEngine === 'whisper'}
      <label class="field">
        <span>Whisper model</span>
        <select bind:value={whisperModel} on:change={apply}>
          <option value="onnx-community/whisper-tiny.en">Tiny — fastest, lower accuracy</option>
          <option value="onnx-community/whisper-base.en">Base — balanced</option>
          <option value="onnx-community/whisper-small.en">Small — most accurate, slowest</option>
        </select>
      </label>
    {/if}
    <label class="field">
      <span>Microphone</span>
      <select bind:value={audioDeviceId} on:change={apply}>
        <option value="">System default</option>
        {#each inputs as d}
          <option value={d.deviceId}>{d.label}</option>
        {/each}
      </select>
    </label>
    <div class="row">
      <button class="solid" on:click={testMic}>{micTesting ? 'STOP' : 'TEST MIC'}</button>
      <div class="meter"><div class="meter-fill" style="width:{micLevel * 100}%"></div></div>
    </div>
    <p class="note">Speak — the bar should move. If it stays flat, pick a different microphone above.</p>
    <p class="note">Device selection only applies to the Whisper engine — Web Speech always uses the system default input. Switching model downloads it on first use.</p>
    {#if dictationEngine === 'whisper'}
      <div class="row">
        <button class="solid" on:click={testGpu}>TEST GPU</button>
        {#if gpuMsg}<span class="note" style="margin:0">{gpuMsg}</span>{/if}
      </div>
    {/if}
  </section>

      <section class="cp-pane" class:active={pane === 'editor'}>
        <div class="cp-pane-title">Editor</div>
    <label class="check">
      <input type="checkbox" bind:checked={spellcheck} on:change={() => onSpellcheck(spellcheck)} /> Check spelling (red underline)
    </label>
    <p class="note">Right-click an underlined word for suggestions and "Add to dictionary".</p>
  </section>

      <section class="cp-pane" class:active={pane === 'sync'}>
        <div class="cp-pane-title">Cloud Sync</div>
    <label class="field">
      <span>Provider</span>
      <select bind:value={syncProvider} on:change={apply}>
        <option value="none">None</option>
        <option value="gdrive">Google Drive</option>
        <option value="onedrive">OneDrive (phase 2)</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={syncOnSave} on:change={apply} /> Sync on every save
    </label>

    <div class="creds">
      <label class="field"><span>Google Client ID</span><input bind:value={clientId} on:change={apply} placeholder="xxxx.apps.googleusercontent.com" /></label>
      <label class="field"><span>Google Client Secret</span><input type="password" bind:value={clientSecret} on:change={apply} /></label>
    </div>
    <div class="row">
      {#if connected}
        <span class="ok">CONNECTED</span>
        <button class="solid" on:click={onDisconnect}>DISCONNECT</button>
      {:else}
        <button class="solid" on:click={() => { apply(); onConnect() }}>CONNECT GOOGLE DRIVE</button>
      {/if}
    </div>
  </section>

      <section class="cp-pane" class:active={pane === 'backups'}>
        <div class="cp-pane-title">Backups</div>
    <label class="field">
      <span>Keep last</span>
      <input type="number" min="1" max="100" bind:value={backupsToKeep} on:change={apply} />
    </label>
    <p class="note">Every save keeps a rolling ring of timestamped backups in a sibling .backups folder next to your document.</p>
      </section>
    </div>
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 500; }
  .panel {
    position: fixed; z-index: 501; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(820px, 95vw); height: min(82vh, 660px);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 16px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.55);
  }
  .cp-header { display: flex; align-items: center; gap: 14px; padding: 1rem 1.2rem; border-bottom: 1px solid var(--rule); flex-shrink: 0; }
  .cp-title { margin: 0; flex: 1; color: var(--accent); text-transform: uppercase; letter-spacing: 0.15em; font-size: 0.85rem; font-family: var(--font-ui); }
  .cp-close { width: 32px; height: 32px; flex-shrink: 0; padding: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .cp-close:hover { color: var(--accent); border-color: var(--accent); }
  .cp-body { flex: 1; display: flex; min-height: 0; }
  .cp-rail { width: 180px; flex-shrink: 0; border-right: 1px solid var(--rule); padding: 0.8rem 0.6rem; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
  .cp-rail-item { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; padding: 0.6rem 0.75rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.04em; background: transparent; border: 1px solid transparent; border-radius: 8px; color: var(--muted); cursor: pointer; font-family: var(--font-ui); transition: background-color 0.15s, color 0.15s; }
  .cp-rail-item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--text); }
  .cp-rail-item.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .cp-rail-item svg { flex-shrink: 0; }
  .cp-content { flex: 1; overflow-y: auto; padding: 1.2rem 1.4rem; min-width: 0; }
  .cp-pane { display: none; flex-direction: column; }
  .cp-pane.active { display: flex; }
  .cp-pane-title { margin: 0 0 0.9rem; font-size: 0.72rem; letter-spacing: 0.14em; color: var(--accent); text-transform: uppercase; font-family: var(--font-ui); }
  .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.7rem; }
  .field span { font-size: 0.8rem; color: var(--muted); }
  input, select {
    background: var(--bg); color: var(--text); border: 1px solid var(--rule);
    border-radius: 8px; padding: 0.55rem 0.7rem; font-family: var(--font-ui); font-size: 0.9rem;
  }
  .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text); margin-bottom: 0.7rem; }
  .note { font-size: 0.75rem; color: var(--muted); margin: 0.2rem 0 0; line-height: 1.4; }
  .editing { font-size: 0.8rem; color: var(--muted); margin: 0 0 0.7rem; }
  .editing b { color: var(--accent); }
  .subhead { font-size: 0.7rem; letter-spacing: 0.12em; color: var(--muted); margin: 0.9rem 0 0.5rem; text-transform: uppercase; }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }
  .swatch { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; cursor: pointer; }
  .swatch input[type=color] { width: 100%; height: 32px; border: 1px solid var(--rule); border-radius: 8px; background: none; cursor: pointer; padding: 2px; }
  .swatch span { font-size: 0.68rem; color: var(--muted); }
  .tworow { display: flex; gap: 1rem; align-items: flex-end; margin-top: 0.7rem; }
  .tworow .field { flex: 1; margin-bottom: 0; }
  .darkcheck { margin-bottom: 0.5rem; white-space: nowrap; }
  .meter { flex: 1; height: 10px; background: var(--bg); border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
  .meter-fill { height: 100%; background: var(--accent); transition: width 0.06s linear; }
  .creds { margin-top: 0.5rem; }
  .row { display: flex; align-items: center; gap: 0.9rem; margin-top: 0.5rem; }
  .ok { color: var(--accent); font-size: 0.8rem; letter-spacing: 0.1em; }
  .solid {
    background: var(--accent); color: var(--bg); border: none; cursor: pointer;
    font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.06em; font-size: 0.8rem;
    padding: 0.6rem 1.1rem; border-radius: 9px;
  }
</style>
