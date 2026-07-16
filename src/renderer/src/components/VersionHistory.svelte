<script>
  export let versions = []
  export let onView = () => {}
  export let onDelete = () => {}
  export let onClose = () => {}

  let query = ''

  function fmtDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return d }
  }
  function fmtTime(t) {
    try { return new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  // Whole plain text of a snapshot, whitespace-normalised — used for both the
  // preview and the search (so a multi-word phrase matches across line breaks).
  function fullText(doc) {
    let out = ''
    const walk = (n) => {
      if (!n) return
      if (n.text) out += n.text
      if (Array.isArray(n.content)) { n.content.forEach(walk); if (n.type === 'paragraph' || n.type === 'heading') out += ' ' }
    }
    if (doc && Array.isArray(doc.content)) doc.content.forEach(walk)
    return out.replace(/\s+/g, ' ').trim()
  }

  function occurrences(hay, needle) {
    const h = hay.toLowerCase(), n = needle.toLowerCase()
    let c = 0, i = 0
    while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length }
    return c
  }

  // Parse the query into terms. A "quoted run" is one exact phrase (an exact
  // sequence of words); every other whitespace-separated word is its own term.
  // A version matches only when it contains ALL terms (phrases, in order).
  function parseTerms(raw) {
    const terms = []
    let rest = ''
    const re = /"([^"]+)"/g
    let m, last = 0
    while ((m = re.exec(raw)) !== null) {
      rest += ' ' + raw.slice(last, m.index)
      const phrase = m[1].trim().replace(/\s+/g, ' ')
      if (phrase) terms.push(phrase)
      last = re.lastIndex
    }
    rest += ' ' + raw.slice(last)
    for (const w of rest.split(/\s+/)) { const t = w.replace(/"/g, ''); if (t) terms.push(t) }
    return terms
  }

  // Split a window of text into plain / highlighted parts across every term.
  function highlightParts(win, terms) {
    const lower = win.toLowerCase()
    const ranges = []
    for (const t of terms) {
      const n = t.toLowerCase()
      let i = 0
      while ((i = lower.indexOf(n, i)) !== -1) { ranges.push([i, i + n.length]); i += n.length }
    }
    if (!ranges.length) return [{ text: win, hit: false }]
    ranges.sort((a, b) => a[0] - b[0])
    const merged = []
    for (const r of ranges) {
      const last = merged[merged.length - 1]
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
      else merged.push([r[0], r[1]])
    }
    const parts = []
    let pos = 0
    for (const [a, b] of merged) {
      if (a > pos) parts.push({ text: win.slice(pos, a), hit: false })
      parts.push({ text: win.slice(a, b), hit: true })
      pos = b
    }
    if (pos < win.length) parts.push({ text: win.slice(pos), hit: false })
    return parts
  }

  // A snippet centred on the earliest matched term, with every term highlighted.
  function snippet(text, terms) {
    const lower = text.toLowerCase()
    let anchor = -1
    for (const t of terms) {
      const i = lower.indexOf(t.toLowerCase())
      if (i !== -1 && (anchor === -1 || i < anchor)) anchor = i
    }
    if (anchor === -1) return null
    const start = Math.max(0, anchor - 42)
    const end = Math.min(text.length, anchor + 96)
    return { lead: start > 0 ? '… ' : '', parts: highlightParts(text.slice(start, end), terms), tail: end < text.length ? ' …' : '' }
  }

  const focusInput = (node) => node.focus()
  function onSearchKey(e) {
    // Esc clears the search first; only closes the modal once it's already empty.
    if (e.key === 'Escape' && query) { query = ''; e.stopPropagation() }
  }

  $: terms = parseTerms(query)
  $: searching = terms.length > 0
  $: rows = versions.map(v => ({ v, text: fullText(v.doc) }))
  $: shown = searching
    ? rows.reduce((acc, r) => {
        const lower = r.text.toLowerCase()
        if (terms.every(t => lower.includes(t.toLowerCase())))
          acc.push({ ...r, count: terms.reduce((s, t) => s + occurrences(r.text, t), 0), snip: snippet(r.text, terms) })
        return acc
      }, [])
    : rows.map(r => ({ ...r, count: 0, snip: null }))
  $: totalHits = shown.reduce((s, r) => s + r.count, 0)
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

  {#if versions.length}
    <div class="vh-search">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
      <input type="text" placeholder={'Search words, or "an exact phrase"…'}
        bind:value={query} on:keydown={onSearchKey} use:focusInput spellcheck="false" />
      {#if query}
        <button class="vh-clear" title="Clear" on:click={() => query = ''}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      {/if}
    </div>
    {#if searching}
      <div class="vh-count">{shown.length} version{shown.length === 1 ? '' : 's'} · {totalHits} match{totalHits === 1 ? '' : 'es'}</div>
    {/if}
  {/if}

  <div class="vh-list">
    {#if !versions.length}
      <div class="vh-empty">No earlier versions yet — a snapshot is kept the first time you edit on a new day.</div>
    {:else if searching && !shown.length}
      <div class="vh-empty">No earlier version contains “{query}”.</div>
    {:else}
      {#each shown as r (r.v.date)}
        <div class="vh-row">
          <div class="vh-info">
            <div class="vh-date">
              {fmtDate(r.v.date)} <span class="vh-time">· {fmtTime(r.v.savedAt)}</span>
              {#if r.count}<span class="vh-hits">{r.count} match{r.count === 1 ? '' : 'es'}</span>{/if}
            </div>
            {#if r.snip}
              <div class="vh-snip">{r.snip.lead}{#each r.snip.parts as p}{#if p.hit}<span class="hit">{p.text}</span>{:else}{p.text}{/if}{/each}{r.snip.tail}</div>
            {:else}
              <div class="vh-preview">{r.text.slice(0, 140) || 'Empty'}</div>
            {/if}
          </div>
          <div class="vh-actions">
            <button class="solid" on:click={() => onView(r.v)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              VIEW
            </button>
            <button class="ghost" title="Delete version" on:click={() => onDelete(r.v)}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      {/each}
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
  .vh-note { margin: 0 1.3rem 0.7rem; font-size: 0.78rem; color: var(--muted); line-height: 1.5; }

  .vh-search {
    display: flex; align-items: center; gap: 0.55rem; margin: 0 1.3rem;
    padding: 0.5rem 0.7rem; background: var(--bg); border: 1px solid var(--rule); border-radius: 10px; color: var(--muted);
  }
  .vh-search:focus-within { border-color: var(--accent); color: var(--accent); }
  .vh-search input {
    flex: 1; min-width: 0; background: transparent; border: none; outline: none;
    color: var(--text); font-family: var(--font-ui); font-size: 0.88rem;
  }
  .vh-search input::placeholder { color: var(--muted); }
  .vh-clear { display: grid; place-items: center; background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 0; }
  .vh-clear:hover { color: var(--accent); }
  .vh-count { margin: 0.5rem 1.3rem 0; font-size: 0.72rem; color: var(--muted); letter-spacing: 0.03em; text-transform: uppercase; }

  .vh-list { overflow-y: auto; padding: 0.5rem 0.8rem 1rem; margin-top: 0.2rem; }
  .vh-row { display: flex; align-items: center; gap: 1rem; padding: 0.7rem 0.6rem; border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  .vh-info { flex: 1; min-width: 0; }
  .vh-date { font-size: 0.9rem; color: var(--text); display: flex; align-items: center; gap: 0.5rem; }
  .vh-time { color: var(--muted); font-size: 0.8rem; }
  .vh-hits { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: 999px; padding: 0.05rem 0.45rem; }
  .vh-preview { font-size: 0.8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.15rem; }
  .vh-snip {
    font-size: 0.8rem; color: var(--muted); margin-top: 0.2rem; line-height: 1.45;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .vh-snip .hit { background: var(--accent); color: var(--bg); border-radius: 3px; padding: 0 2px; font-weight: 600; }
  .vh-actions { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  .solid { display: inline-flex; align-items: center; gap: 0.4rem; background: var(--accent); color: var(--bg); border: none; cursor: pointer; font-family: var(--font-ui); font-weight: 700; letter-spacing: 0.05em; font-size: 0.72rem; padding: 0.5rem 0.9rem; border-radius: 8px; }
  .ghost { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .ghost:hover { color: #fff; background: #e5484d; border-color: #e5484d; }
  .vh-empty { padding: 1.4rem 0.8rem; color: var(--muted); font-size: 0.9rem; text-align: center; }
</style>
