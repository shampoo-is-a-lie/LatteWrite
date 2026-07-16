<script>
  import Editor from './Editor.svelte'

  export let version = null      // { date, savedAt, doc }
  export let title = ''          // current document title (the version has no title of its own)
  export let onRestore = () => {}
  export let onSaveAs = () => {}
  export let onOpenNewWindow = () => {}
  export let onClose = () => {}

  function fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return d }
  }
  function fmtTime(t) {
    try { return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }
</script>

<div class="vv-scrim" on:click={onClose}></div>
<div class="vv" role="dialog" aria-label="Previous version">
  <header class="vv-bar">
    <div class="vv-meta">
      <div class="vv-eyebrow">
        <span>Previous version</span>
        <span class="vv-badge">READ ONLY</span>
      </div>
      <div class="vv-name" title={title}>{title || 'Untitled'}</div>
      <div class="vv-when">{fmtDate(version.date)} · {fmtTime(version.savedAt)}</div>
    </div>
    <div class="vv-actions">
      <button class="vv-btn ghost" on:click={() => onOpenNewWindow(version)}>OPEN IN A NEW WINDOW</button>
      <button class="vv-btn ghost" on:click={() => onSaveAs(version)}>SAVE AS…</button>
      <button class="vv-btn solid" on:click={() => onRestore(version)}>RESTORE</button>
      <button class="vv-x" title="Close (Esc)" on:click={onClose}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>
  </header>

  <div class="vv-scroll">
    <Editor content={version.doc} editable={false} />
  </div>
</div>

<style>
  .vv-scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.66); backdrop-filter: blur(2px); z-index: 640; }
  .vv {
    position: fixed; z-index: 641; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(960px, 96vw); height: min(92vh, 1100px);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--bg); border: 1px solid var(--rule); border-radius: 16px;
    box-shadow: 0 40px 110px rgba(0,0,0,0.7);
    font-family: var(--font-ui);
  }

  .vv-bar {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.85rem 1.1rem; flex: none;
    background: var(--surface); border-bottom: 1px solid var(--rule);
  }
  .vv-meta { flex: 1; min-width: 0; }
  .vv-eyebrow {
    display: flex; align-items: center; gap: 0.55rem;
    color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.68rem; font-weight: 700;
  }
  .vv-badge {
    color: var(--muted); border: 1px solid var(--rule); border-radius: 999px;
    padding: 0.08rem 0.5rem; letter-spacing: 0.12em; font-size: 0.6rem;
  }
  .vv-name {
    margin-top: 0.2rem; color: var(--text); font-size: 1.02rem; font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .vv-when { margin-top: 0.1rem; color: var(--muted); font-size: 0.78rem; }

  .vv-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 0.6rem; flex: none; }
  .vv-btn {
    font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.06em; font-size: 0.74rem;
    padding: 0.55rem 1rem; border-radius: 9px; cursor: pointer;
  }
  .ghost { background: transparent; color: var(--text); border: 1px solid var(--rule); }
  .ghost:hover { border-color: var(--accent); color: var(--accent); }
  .solid { background: var(--accent); color: var(--bg); border: none; }
  .vv-x {
    width: 34px; height: 34px; display: grid; place-items: center; flex: none;
    background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 9px; cursor: pointer;
  }
  .vv-x:hover { color: var(--accent); border-color: var(--accent); }

  .vv-scroll { flex: 1; overflow-y: auto; scroll-behavior: smooth; }

  /* The read-only document reuses the live editor's page/ProseMirror styling, so
     it looks exactly as it did — just trim the editor's huge writing-room padding
     and suppress edit-only affordances. */
  .vv-scroll :global(.editor-page) { padding: 2.4rem 2.4rem 3rem; }
  .vv-scroll :global(.ProseMirror) { caret-color: transparent; }
  .vv-scroll :global(.img-resize) { display: none !important; }
</style>
