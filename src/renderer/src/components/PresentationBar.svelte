<script>
  export let dictating = false
  export let dictLabel = ''
  export let fullscreen = false
  export let chromeHidden = false
  export let saving = false
  export let micAvailable = true
  export let typewriter = false
  export let focusMode = false
  export let revealMode = false
  export let revealCount = 1
  export let revealTotal = 0
  export let onDictate = () => {}
  export let onPresent = () => {}
  export let onToggleChrome = () => {}
  export let onToggleTypewriter = () => {}
  export let onToggleFocus = () => {}
  export let onToggleReveal = () => {}
  export let onRevealNext = () => {}
  export let onRevealPrev = () => {}
</script>

<div class="pbar" class:dim={fullscreen || chromeHidden}>
  {#if saving}<span class="dot" title="Saving"></span>{/if}

  {#if revealMode}
    <div class="nav">
      <button class="pill" on:click={onRevealPrev} title="Reveal previous (PageUp)">&lsaquo;</button>
      <span class="count">{Math.min(revealCount, revealTotal)}/{revealTotal}</span>
      <button class="pill" on:click={onRevealNext} title="Reveal next (PageDown)">&rsaquo;</button>
    </div>
  {/if}

  <div class="modes">
    <button class="pill sm" class:on={typewriter} on:click={onToggleTypewriter} title="Typewriter scrolling">TYPE</button>
    <button class="pill sm" class:on={focusMode} on:click={onToggleFocus} title="Focus — dim other paragraphs">FOCUS</button>
    <button class="pill sm" class:on={revealMode} on:click={onToggleReveal} title="Teleprompter reveal">SCRIPT</button>
  </div>

  <button class="pill" class:on={dictating} disabled={!micAvailable}
          title={micAvailable ? 'Dictate (Ctrl+D)' : 'Latte Dictate is not installed'} on:click={onDictate}>
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
    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;
    max-width: 90vw; opacity: 0.3; transition: opacity 0.25s;
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
  .pill.sm { padding: 0.5rem 0.7rem; }
  .pill.icon { padding: 0.45rem 0.6rem; }
  .pill.icon svg { display: block; }
  .pill:hover { border-color: var(--accent); }
  .pill:disabled { opacity: 0.45; cursor: not-allowed; }
  .pill.on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .modes { display: flex; gap: 0.25rem; }
  .nav { display: flex; align-items: center; gap: 0.35rem; }
  .nav .pill { padding: 0.4rem 0.7rem; font-size: 0.9rem; }
  .count { font-family: var(--font-ui); font-size: 0.72rem; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 2.5rem; text-align: center; }
  .mic { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }
  .pill.on .mic { animation: pulse 1s infinite; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); opacity: 0.8; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
</style>
