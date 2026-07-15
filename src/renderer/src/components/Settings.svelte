<script>
  import Select from './Select.svelte'
  import FontBrowser from './FontBrowser.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import { fontStack } from '../fonts.js'
  export let settings = {}
  export let connected = false
  export let inputs = []
  export let headingFamily = ''
  export let bodyFamily = ''
  export let codeFamily = ''
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
  let bg = settings.bgEffect || 'none'
  const BACKGROUNDS = ['none', 'gradient', 'glow', 'aurora', 'grid', 'dots', 'vignette']
  const setBg = (v) => { bg = v; onPatch({ bgEffect: v }) }
  let fh = headingFamily
  let fb = bodyFamily
  let fc = codeFamily
  let newStyleName = ''
  let spellcheck = settings.spellcheck !== false
  // Reflect the live style/draft values (e.g. after a fork) back into the inputs.
  $: fh = headingFamily
  $: fb = bodyFamily
  $: fc = codeFamily
  $: colors = { ...tokens }
  $: measureNum = parseFloat(measure) || 46
  $: darkV = !!dark

  const TOKENS = [
    ['bg', 'Background'], ['surface', 'Surface'], ['text', 'Text'], ['muted', 'Muted'],
    ['accent', 'Accent'], ['caret', 'Caret'], ['rule', 'Rule']
  ]

  const ENGINE_OPTS = [
    { value: 'whisper', label: 'Local Whisper (offline, recommended)' },
    { value: 'webspeech', label: 'Web Speech (online — unreliable in Electron)' }
  ]
  const MODEL_OPTS = [
    { value: 'onnx-community/whisper-tiny.en', label: 'Tiny — fastest, lower accuracy' },
    { value: 'onnx-community/whisper-base.en', label: 'Base — balanced' },
    { value: 'onnx-community/whisper-small.en', label: 'Small — most accurate, slowest' }
  ]
  const PROVIDER_OPTS = [
    { value: 'none', label: 'None' },
    { value: 'gdrive', label: 'Google Drive' },
    { value: 'onedrive', label: 'OneDrive (phase 2)' }
  ]
  $: micOpts = [{ value: '', label: 'System default' }, ...inputs.map(d => ({ value: d.deviceId, label: d.label }))]

  let shortcutQuery = ''
  const SHORTCUTS = [
    { group: 'File', items: [
      { keys: 'Ctrl N', desc: 'New document' },
      { keys: 'Ctrl O', desc: 'Open a document' },
      { keys: 'Ctrl S', desc: 'Save' }
    ] },
    { group: 'Text', items: [
      { keys: 'Ctrl B', desc: 'Bold' },
      { keys: 'Ctrl I', desc: 'Italic' },
      { keys: 'Ctrl U', desc: 'Underline' },
      { keys: 'Ctrl Shift X', desc: 'Strikethrough' }
    ] },
    { group: 'Paragraph', items: [
      { keys: 'Ctrl Alt 1', desc: 'Heading 1' },
      { keys: 'Ctrl Alt 2', desc: 'Heading 2' },
      { keys: 'Ctrl Alt 3', desc: 'Heading 3' },
      { keys: 'Ctrl Shift 7', desc: 'Numbered list' },
      { keys: 'Ctrl Shift 8', desc: 'Bullet list' },
      { keys: 'Ctrl Shift B', desc: 'Quote (blockquote)' },
      { keys: 'Ctrl Alt C', desc: 'Code block' },
      { keys: 'Ctrl Shift L', desc: 'Align left' },
      { keys: 'Ctrl Shift E', desc: 'Align center' },
      { keys: 'Ctrl Shift R', desc: 'Align right' },
      { keys: 'Ctrl Shift J', desc: 'Justify' }
    ] },
    { group: 'Editing', items: [
      { keys: 'Ctrl Z', desc: 'Undo' },
      { keys: 'Ctrl Shift Z', desc: 'Redo' },
      { keys: 'Ctrl D', desc: 'Dictate (toggle)' }
    ] },
    { group: 'View', items: [
      { keys: 'Ctrl +', desc: 'Zoom in' },
      { keys: 'Ctrl -', desc: 'Zoom out' },
      { keys: 'Ctrl 0', desc: 'Reset zoom' }
    ] },
    { group: 'Presentation', items: [
      { keys: 'Ctrl Shift P', desc: 'Toggle fullscreen (present)' },
      { keys: 'Ctrl Shift H', desc: 'Hide / show the interface' },
      { keys: 'Page Down', desc: 'Reveal next paragraph (Script mode)' },
      { keys: 'Page Up', desc: 'Reveal previous paragraph (Script mode)' }
    ] }
  ]
  $: scGroups = (() => {
    const q = shortcutQuery.trim().toLowerCase()
    return SHORTCUTS
      .map(g => ({ group: g.group, items: g.items.filter(i => !q || i.desc.toLowerCase().includes(q) || i.keys.toLowerCase().includes(q)) }))
      .filter(g => g.items.length)
  })()

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
  let fontModal = null // 'heading' | 'body' | null

  let backupMsg = ''
  let confirmRestore = false
  async function doBackup() {
    const p = await window.api.backup.create()
    backupMsg = p ? 'Backup saved to ' + p : ''
  }
  async function reallyRestore() {
    confirmRestore = false
    await window.api.backup.restore()
  }

  let desktopMsg = ''
  async function installDesktop() {
    const res = await window.api.desktop.install()
    desktopMsg = res?.ok
      ? 'Added. Look for LatteWrite in your application menu, and .latte files now open with it.'
      : (res?.error || 'Could not add the shortcut.')
  }

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
      <button class="cp-rail-item" class:active={pane === 'shortcuts'} on:click={() => pane = 'shortcuts'}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="10"/><line x1="10" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="14" y2="10"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/></svg><span>Shortcuts</span>
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
    <div class="field">
      <span>Heading font</span>
      <button class="fontbtn" style={fh ? `font-family:${fontStack(fh)}` : ''} on:click={() => fontModal = 'heading'}>{fh || 'Style default'}</button>
    </div>
    <div class="field">
      <span>Body font</span>
      <button class="fontbtn" style={fb ? `font-family:${fontStack(fb)}` : ''} on:click={() => fontModal = 'body'}>{fb || 'Style default'}</button>
    </div>
    <div class="field">
      <span>Code font</span>
      <button class="fontbtn" style={`font-family:${fontStack(fc || 'JetBrains Mono')}`} on:click={() => fontModal = 'code'}>{fc || 'JetBrains Mono'}</button>
    </div>

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

    <div class="subhead">Background</div>
    <p class="note">A subtle decorative backdrop behind your writing — nice for live/online presentation. Hidden in exports.</p>
    <div class="bgrow">
      {#each BACKGROUNDS as b}
        <button class="bgopt" class:on={bg === b} on:click={() => setBg(b)}>{b}</button>
      {/each}
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
    <div class="field">
      <span>Engine</span>
      <Select value={dictationEngine} options={ENGINE_OPTS} onChange={(v) => { dictationEngine = v; apply() }} />
    </div>
    {#if dictationEngine === 'whisper'}
      <div class="field">
        <span>Whisper model</span>
        <Select value={whisperModel} options={MODEL_OPTS} onChange={(v) => { whisperModel = v; apply() }} />
      </div>
    {/if}
    <div class="field">
      <span>Microphone</span>
      <Select value={audioDeviceId} options={micOpts} onChange={(v) => { audioDeviceId = v; apply() }} />
    </div>
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

      <section class="cp-pane" class:active={pane === 'shortcuts'}>
        <div class="cp-pane-title">Keyboard Shortcuts</div>
        <input class="sc-search" type="text" placeholder="Search shortcuts…" bind:value={shortcutQuery} />
        {#each scGroups as g}
          <div class="sc-group">{g.group}</div>
          {#each g.items as it}
            <div class="sc-row">
              <span class="sc-desc">{it.desc}</span>
              <span class="sc-keys">{#each it.keys.split(' ') as k}<kbd>{k}</kbd>{/each}</span>
            </div>
          {/each}
        {:else}
          <p class="note">No shortcuts match "{shortcutQuery}".</p>
        {/each}
      </section>

      <section class="cp-pane" class:active={pane === 'sync'}>
        <div class="cp-pane-title">Cloud Sync</div>
    <div class="field">
      <span>Provider</span>
      <Select value={syncProvider} options={PROVIDER_OPTS} onChange={(v) => { syncProvider = v; apply() }} />
    </div>
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

        <div class="subhead">Full app backup</div>
        <p class="note">Save all settings, custom styles and cached fonts as a single .zip — or restore everything from one (this replaces current data and restarts the app).</p>
        <div class="row">
          <button class="solid" on:click={doBackup}>BACK UP (.ZIP)</button>
          <button class="solid" on:click={() => confirmRestore = true}>RESTORE…</button>
        </div>
        {#if backupMsg}<p class="note">{backupMsg}</p>{/if}

        <div class="subhead">Desktop integration</div>
        <p class="note">Add LatteWrite to your desktop's application menu (KDE, GNOME, …) with its icon, and set it as the handler for .latte files. AppImages don't do this on their own.</p>
        <div class="row">
          <button class="solid" on:click={installDesktop}>ADD TO APPLICATIONS MENU</button>
        </div>
        {#if desktopMsg}<p class="note">{desktopMsg}</p>{/if}
      </section>
    </div>
  </div>
</div>

{#if confirmRestore}
  <ConfirmDialog
    title="Restore backup"
    message="This replaces ALL current settings, custom styles and cached fonts with the backup, then restarts LatteWrite. This cannot be undone."
    confirmLabel="RESTORE & RESTART" danger
    onConfirm={reallyRestore} onCancel={() => confirmRestore = false} />
{/if}

{#if fontModal}
  <FontBrowser
    title={fontModal === 'heading' ? 'Heading font' : fontModal === 'code' ? 'Code font' : 'Body font'}
    current={fontModal === 'heading' ? fh : fontModal === 'code' ? fc : fb}
    onPick={(f) => onSetFont(fontModal, f)}
    onClose={() => fontModal = null} />
{/if}

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
  .fontbtn {
    width: 100%; text-align: left; background: var(--bg); color: var(--text);
    border: 1px solid var(--rule); border-radius: 8px; padding: 0.55rem 0.75rem;
    font-size: 1.05rem; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .fontbtn:hover { border-color: var(--accent); }
  .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text); margin-bottom: 0.7rem; }
  .note { font-size: 0.75rem; color: var(--muted); margin: 0.2rem 0 0; line-height: 1.4; }
  .editing { font-size: 0.8rem; color: var(--muted); margin: 0 0 0.7rem; }
  .editing b { color: var(--accent); }
  .subhead { font-size: 0.7rem; letter-spacing: 0.12em; color: var(--muted); margin: 0.9rem 0 0.5rem; text-transform: uppercase; }
  .bgrow { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .bgopt { text-transform: capitalize; padding: 0.35rem 0.7rem; border-radius: 7px; border: 1px solid var(--rule); background: transparent; color: var(--text); cursor: pointer; font-size: 0.82rem; }
  .bgopt:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .bgopt.on { background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 700; }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.6rem; }
  .swatch { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; cursor: pointer; }
  .swatch input[type=color] { width: 100%; height: 32px; border: 1px solid var(--rule); border-radius: 8px; background: none; cursor: pointer; padding: 2px; }
  .swatch span { font-size: 0.68rem; color: var(--muted); }
  .tworow { display: flex; gap: 1rem; align-items: flex-end; margin-top: 0.7rem; }
  .tworow .field { flex: 1; margin-bottom: 0; }
  .darkcheck { margin-bottom: 0.5rem; white-space: nowrap; }
  .sc-search { margin-bottom: 0.8rem; }
  .sc-group { font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); margin: 1rem 0 0.4rem; }
  .sc-group:first-of-type { margin-top: 0.2rem; }
  .sc-row { display: flex; align-items: center; gap: 1rem; padding: 0.4rem 0.2rem; border-bottom: 1px solid color-mix(in srgb, var(--rule) 50%, transparent); }
  .sc-desc { flex: 1; font-size: 0.88rem; color: var(--text); }
  .sc-keys { display: flex; gap: 0.25rem; flex: none; }
  .sc-keys kbd {
    font-family: 'JetBrains Mono', monospace; font-size: 0.72rem; color: var(--text);
    background: var(--bg); border: 1px solid var(--rule); border-bottom-width: 2px;
    border-radius: 5px; padding: 0.15rem 0.4rem; min-width: 1.1rem; text-align: center;
  }
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
