<script>
  import { onMount } from 'svelte'

  export let filePath = null          // the open document, for its earlier saves
  export let onOpen = () => {}        // open a restored file
  export let onRollback = () => {}    // load an earlier save into the open document
  export let onClose = () => {}

  let tab = 'missing'
  let missing = []
  let snapshots = []
  let loading = true
  let notice = ''
  let query = ''
  let showStale = false

  const SOURCES = {
    mirror: { label: 'MIRROR TWIN', hint: 'the read-only copy written on every save' },
    trash: { label: 'TRASH', hint: 'still in the system trash' },
    backup: { label: 'SNAPSHOT', hint: 'the newest .backups snapshot' }
  }

  async function load() {
    loading = true
    const res = await window.api.recover.list()
    missing = Array.isArray(res) ? res : []
    snapshots = filePath ? await window.api.recover.snapshots(filePath) : []
    loading = false
  }
  onMount(load)

  function fmt(t) {
    if (!t) return ''
    try { return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }
  const kb = (n) => `${Math.max(1, Math.round(n / 1024))} KB`

  async function restore(row) {
    const res = await window.api.recover.restore({ file: row.file, origin: row.origin })
    if (res?.error) { notice = res.error; return }
    notice = `Recovered to ${res.filePath}`
    await load()
    onOpen(res.filePath)
  }

  async function discard(row) {
    const res = await window.api.recover.discard(row.file)
    if (res?.error) { notice = res.error; return }
    notice = `Moved that copy to the trash.`
    await load()
  }

  async function rollback(snap) {
    const res = await window.api.recover.read(snap.file)
    if (res?.error) { notice = res.error; return }
    onRollback(res, snap)
  }

  // A mirror twin or a trashed file means the document really is gone. A lone
  // snapshot usually just means the document was renamed before renames carried
  // their history along, so those sit behind a toggle instead of burying a real loss.
  $: lost = missing.filter((r) => r.source !== 'backup')
  $: stale = missing.filter((r) => r.source === 'backup')
  $: pool = showStale ? missing : lost
  $: shown = query.trim()
    ? pool.filter((r) => (r.name + ' ' + (r.preview || '')).toLowerCase().includes(query.trim().toLowerCase()))
    : pool
</script>

<div class="scrim" on:click={onClose}></div>
<div class="rc">
  <div class="rc-head">
    <h2>Recover documents</h2>
    <button class="rc-close" title="Close" on:click={onClose}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
  </div>

  <div class="rc-tabs">
    <button class:on={tab === 'missing'} on:click={() => tab = 'missing'}>MISSING DOCUMENTS</button>
    <button class:on={tab === 'earlier'} on:click={() => tab = 'earlier'}>EARLIER SAVES OF THIS ONE</button>
  </div>

  {#if tab === 'missing'}
    <p class="rc-note">
      Every save also writes a read-only twin in <code>.mirror</code> that nothing deletes or renames.
      Anything here is a document that is no longer in your latte folder but still exists somewhere.
    </p>

    {#if missing.length > 4}
      <div class="rc-search">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
        <input type="text" placeholder="Filter by name or content…" bind:value={query} spellcheck="false" />
      </div>
    {/if}

    {#if stale.length}
      <label class="rc-toggle">
        <input type="checkbox" bind:checked={showStale} />
        Also list {stale.length} old snapshot{stale.length === 1 ? '' : 's'} with no document — most are just documents that were renamed
      </label>
    {/if}

    <div class="rc-list">
      {#if loading}
        <div class="rc-empty">Looking through the mirror twins, the trash and the snapshots…</div>
      {:else if !shown.length}
        <div class="rc-empty">{pool.length ? 'Nothing matches that.' : 'Nothing is missing — every document you have saved is where it should be.'}</div>
      {:else}
        {#each shown as r (r.file)}
          <div class="rc-row">
            <div class="rc-info">
              <div class="rc-title">
                {r.name}
                <span class="chip" title={SOURCES[r.source]?.hint}>{SOURCES[r.source]?.label}</span>
                {#if r.alternatives.length}<span class="alt">+{r.alternatives.length} other cop{r.alternatives.length === 1 ? 'y' : 'ies'}</span>{/if}
              </div>
              <div class="rc-meta">{fmt(r.date)} · {kb(r.size)} · {r.folder}</div>
              <div class="rc-preview">{r.preview || 'Empty document'}</div>
            </div>
            <div class="rc-actions">
              <button class="solid" on:click={() => restore(r)}>RESTORE</button>
              {#if r.source === 'mirror'}
                <button class="ghost" title="Discard this twin" on:click={() => discard(r)}>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              {/if}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {:else}
    <p class="rc-note">
      Every save of the open document, newest first. Restoring loads that state into the editor — the
      current one is kept as a snapshot of its own, so this is never a one-way door.
    </p>
    <div class="rc-list">
      {#if !filePath}
        <div class="rc-empty">Save this document first and its earlier saves will appear here.</div>
      {:else if !snapshots.length}
        <div class="rc-empty">No earlier saves yet.</div>
      {:else}
        {#each snapshots as s (s.file)}
          <div class="rc-row">
            <div class="rc-info">
              <div class="rc-title">
                {fmt(s.at)}
                {#if s.mirror}<span class="chip" title="the read-only twin of the last save">MIRROR TWIN</span>{/if}
              </div>
              <div class="rc-meta">{kb(s.size)}</div>
              <div class="rc-preview">{s.preview || 'Empty document'}</div>
            </div>
            <div class="rc-actions">
              <button class="solid" on:click={() => rollback(s)}>RESTORE</button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  {#if notice}<div class="rc-notice">{notice}</div>{/if}
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 620; -webkit-app-region: no-drag; }
  .rc {
    position: fixed; z-index: 621; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(720px, 94vw); max-height: 84vh; display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 16px; box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    font-family: var(--font-ui); -webkit-app-region: no-drag;
  }
  .rc-head { display: flex; align-items: center; padding: 1.1rem 1.3rem 0.5rem; }
  .rc-head h2 { margin: 0; flex: 1; color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.85rem; }
  .rc-close { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .rc-close:hover { color: var(--accent); border-color: var(--accent); }

  .rc-tabs { display: flex; gap: 0.4rem; padding: 0.2rem 1.3rem 0.6rem; }
  .rc-tabs button {
    background: transparent; border: 1px solid var(--rule); color: var(--muted);
    font-family: var(--font-ui); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em;
    padding: 0.45rem 0.8rem; border-radius: 8px; cursor: pointer;
  }
  .rc-tabs button.on { background: var(--accent); border-color: var(--accent); color: var(--bg); }

  .rc-note { margin: 0 1.3rem 0.7rem; font-size: 0.78rem; color: var(--muted); line-height: 1.55; }
  .rc-note code { font-family: var(--font-code); font-size: 0.9em; color: var(--text); }

  .rc-search {
    display: flex; align-items: center; gap: 0.55rem; margin: 0 1.3rem 0.3rem;
    padding: 0.5rem 0.7rem; background: var(--bg); border: 1px solid var(--rule); border-radius: 10px; color: var(--muted);
  }
  .rc-search:focus-within { border-color: var(--accent); color: var(--accent); }
  .rc-search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--text); font-family: var(--font-ui); font-size: 0.88rem; }

  .rc-toggle {
    display: flex; align-items: center; gap: 0.5rem; margin: 0.6rem 1.3rem 0.1rem;
    font-size: 0.74rem; color: var(--muted); cursor: pointer; line-height: 1.4;
  }
  .rc-toggle input { accent-color: var(--accent); flex: none; }

  .rc-list { overflow-y: auto; padding: 0.4rem 0.8rem 1rem; }
  .rc-row { display: flex; align-items: center; gap: 1rem; padding: 0.7rem 0.6rem; border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  .rc-info { flex: 1; min-width: 0; }
  .rc-title { font-size: 0.92rem; color: var(--text); display: flex; align-items: center; gap: 0.5rem; }
  .chip {
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.07em; color: var(--accent);
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: 999px; padding: 0.08rem 0.45rem;
  }
  .alt { font-size: 0.68rem; color: var(--muted); }
  .rc-meta { font-size: 0.72rem; color: var(--muted); margin-top: 0.2rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc-preview {
    font-size: 0.8rem; color: var(--muted); margin-top: 0.25rem; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rc-actions { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  .solid { background: var(--accent); color: var(--bg); border: none; cursor: pointer; font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.05em; font-size: 0.72rem; padding: 0.55rem 0.95rem; border-radius: 8px; }
  .ghost { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .ghost:hover { color: #fff; background: #e5484d; border-color: #e5484d; }
  .rc-empty { padding: 1.6rem 0.8rem; color: var(--muted); font-size: 0.88rem; text-align: center; line-height: 1.5; }
  .rc-notice { padding: 0.7rem 1.3rem; border-top: 1px solid var(--rule); font-size: 0.78rem; color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
