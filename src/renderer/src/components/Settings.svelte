<script>
  export let settings = {}
  export let connected = false
  export let inputs = []
  export let onPatch = () => {}
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

  function apply() {
    onPatch({ oauthClientId: clientId, oauthClientSecret: clientSecret, syncProvider, syncOnSave, dictationEngine, whisperModel, audioDeviceId, backupsToKeep: Number(backupsToKeep) })
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
  <h2>SETTINGS</h2>

  <section>
    <h3>DICTATION</h3>
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
    <p class="note">Device selection only applies to the Whisper engine — Web Speech always uses the system default input. Switching model downloads it on first use.</p>
    {#if dictationEngine === 'whisper'}
      <div class="row">
        <button class="solid" on:click={testGpu}>TEST GPU</button>
        {#if gpuMsg}<span class="note" style="margin:0">{gpuMsg}</span>{/if}
      </div>
    {/if}
  </section>

  <section>
    <h3>CLOUD SYNC</h3>
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

  <section>
    <h3>BACKUPS</h3>
    <label class="field">
      <span>Keep last</span>
      <input type="number" min="1" max="100" bind:value={backupsToKeep} on:change={apply} />
    </label>
  </section>

  <div class="foot"><button class="solid" on:click={() => { apply(); onClose() }}>DONE</button></div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 500; }
  .panel {
    position: fixed; z-index: 501; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(560px, 92vw); max-height: 88vh; overflow-y: auto;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 16px;
    padding: 1.5rem 1.7rem; box-shadow: 0 30px 80px rgba(0,0,0,0.55);
  }
  h2 { margin: 0 0 1rem; font-family: var(--font-ui); letter-spacing: 0.1em; font-size: 1rem; color: var(--muted); }
  h3 { margin: 0 0 0.7rem; font-family: var(--font-ui); font-size: 0.72rem; letter-spacing: 0.12em; color: var(--accent); }
  section { padding: 0.9rem 0; border-top: 1px solid var(--rule); }
  section:first-of-type { border-top: none; }
  .field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.7rem; }
  .field span { font-size: 0.8rem; color: var(--muted); }
  input, select {
    background: var(--bg); color: var(--text); border: 1px solid var(--rule);
    border-radius: 8px; padding: 0.55rem 0.7rem; font-family: var(--font-ui); font-size: 0.9rem;
  }
  .check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text); margin-bottom: 0.7rem; }
  .note { font-size: 0.75rem; color: var(--muted); margin: 0.2rem 0 0; line-height: 1.4; }
  .creds { margin-top: 0.5rem; }
  .row { display: flex; align-items: center; gap: 0.9rem; margin-top: 0.5rem; }
  .ok { color: var(--accent); font-size: 0.8rem; letter-spacing: 0.1em; }
  .foot { display: flex; justify-content: flex-end; margin-top: 1rem; }
  .solid {
    background: var(--accent); color: var(--bg); border: none; cursor: pointer;
    font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.06em; font-size: 0.8rem;
    padding: 0.6rem 1.1rem; border-radius: 9px;
  }
</style>
