<script>
  export let dictating = false
  export let dictLabel = ''
  export let fullscreen = false
  export let chromeHidden = false
  export let saving = false
  export let micAvailable = true
  export let onDictate = () => {}
  export let onPresent = () => {}
  export let onToggleChrome = () => {}
</script>

<div class="pbar" class:dim={fullscreen || chromeHidden}>
  {#if saving}<span class="dot" title="Saving"></span>{/if}
  <button class="pill" class:on={dictating} disabled={!micAvailable}
          title={micAvailable ? 'Dictate (Ctrl+D)' : 'Dictation unavailable'} on:click={onDictate}>
    <span class="mic"></span>{dictating ? (dictLabel || 'LISTENING') : 'DICTATE'}
  </button>
  <button class="pill" on:click={onToggleChrome} title="Hide interface (Ctrl+Shift+H)">
    {chromeHidden ? 'SHOW UI' : 'HIDE UI'}
  </button>
  <button class="pill" on:click={onPresent} title="Fullscreen (Ctrl+Shift+P)">
    {fullscreen ? 'EXIT' : 'PRESENT'}
  </button>
</div>

<style>
  .pbar {
    position: fixed; bottom: 1.1rem; right: 1.1rem; z-index: 350;
    display: flex; align-items: center; gap: 0.5rem;
    opacity: 0.3; transition: opacity 0.25s;
  }
  .pbar:hover { opacity: 1; }
  .pbar.dim { opacity: 0.12; }
  .pbar.dim:hover { opacity: 1; }
  .pill {
    font-family: var(--font-ui); font-size: 0.72rem; letter-spacing: 0.08em;
    background: var(--surface); color: var(--text);
    border: 1px solid var(--rule); border-radius: 999px;
    padding: 0.5rem 0.9rem; cursor: pointer;
    display: inline-flex; align-items: center; gap: 0.45rem;
    box-shadow: 0 8px 26px rgba(0,0,0,0.35);
    max-width: 22rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pill:hover { border-color: var(--accent); }
  .pill:disabled { opacity: 0.45; cursor: not-allowed; }
  .pill.on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .mic { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
  .pill.on .mic { animation: pulse 1s infinite; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); opacity: 0.8; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
