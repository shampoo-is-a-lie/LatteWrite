<script>
  export let versions = []
  export let onView = () => {}
  export let onDelete = () => {}
  export let onClose = () => {}

  function fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return d }
  }
  function fmtTime(t) {
    try { return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }
  function docText(doc) {
    let out = ''
    const walk = (n) => {
      if (!n) return
      if (n.text) out += n.text
      if (Array.isArray(n.content)) { n.content.forEach(walk); if (n.type === 'paragraph' || n.type === 'heading') out += ' ' }
    }
    if (doc && Array.isArray(doc.content)) doc.content.forEach(walk)
    return out.replace(/\s+/g, ' ').trim().slice(0, 140)
  }
</script>

<div class="scrim" on:click={onClose}></div>
<div class="vh">
  <div class="vh-head">
    <h2>Version history</h2>
    <button class="vh-close" title="Close" on:click={onClose}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
  </div>
  <p class="vh-note">One snapshot per day the document was edited, kept for the last 20 days. Today's live document is your current version.</p>

  <div class="vh-list">
    {#if versions.length}
      {#each versions as v}
        <div class="vh-row">
          <div class="vh-info">
            <div class="vh-date">{fmtDate(v.date)} <span class="vh-time">· {fmtTime(v.savedAt)}</span></div>
            <div class="vh-preview">{docText(v.doc) || 'Empty'}</div>
          </div>
          <div class="vh-actions">
            <button class="solid" on:click={() => onView(v)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              VIEW
            </button>
            <button class="ghost" title="Delete version" on:click={() => onDelete(v)}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      {/each}
    {:else}
      <div class="vh-empty">No earlier versions yet — a snapshot is kept the first time you edit on a new day.</div>
    {/if}
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 620; }
  .vh {
    position: fixed; z-index: 621; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(620px, 94vw); max-height: 84vh; display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    font-family: var(--font-ui);
  }
  .vh-head { display: flex; align-items: center; padding: 1.1rem 1.3rem 0.5rem; }
  .vh-head h2 { margin: 0; flex: 1; color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.85rem; }
  .vh-close { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .vh-close:hover { color: var(--accent); border-color: var(--accent); }
  .vh-note { margin: 0 1.3rem 0.6rem; font-size: 0.78rem; color: var(--muted); line-height: 1.5; }
  .vh-list { overflow-y: auto; padding: 0.3rem 0.8rem 1rem; }
  .vh-row { display: flex; align-items: center; gap: 1rem; padding: 0.7rem 0.6rem; border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  .vh-info { flex: 1; min-width: 0; }
  .vh-date { font-size: 0.9rem; color: var(--text); }
  .vh-time { color: var(--muted); font-size: 0.8rem; }
  .vh-preview { font-size: 0.8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.15rem; }
  .vh-actions { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  .solid { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--accent); color: var(--bg); border: none; cursor: pointer; font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.05em; font-size: 0.72rem; padding: 0.5rem 0.9rem; border-radius: 8px; }
  .ghost { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .ghost:hover { color: #fff; background: #e5484d; border-color: #e5484d; }
  .vh-empty { padding: 1.4rem 0.8rem; color: var(--muted); font-size: 0.9rem; text-align: center; }
</style>
