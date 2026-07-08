<script>
  import { onDestroy } from 'svelte'
  import { GOOGLE_FONTS } from '../googlefonts.js'
  import { ensureFontLoaded, fontStack } from '../fonts.js'

  export let title = 'Font'
  export let current = ''
  export let onPick = () => {}
  export let onClose = () => {}

  let q = ''
  let loaded = new Set()

  $: query = q.trim().toLowerCase()
  $: list = GOOGLE_FONTS.filter(f => !query || f.toLowerCase().includes(query))
  $: exact = GOOGLE_FONTS.some(f => f.toLowerCase() === query)

  // Load each font only when its row scrolls into view.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      const fam = e.target.dataset.family
      io.unobserve(e.target)
      ensureFontLoaded(fam).then(() => { loaded = new Set(loaded).add(fam) })
    }
  }, { rootMargin: '250px' })

  function preview(node, family) {
    node.dataset.family = family
    io.observe(node)
    return { destroy() { io.unobserve(node) } }
  }
  onDestroy(() => io.disconnect())

  const choose = (f) => { onPick(f); onClose() }
  const SAMPLE = 'The quick brown fox jumps over the lazy dog · 1234567890'
</script>

<div class="scrim" on:click={onClose}></div>
<div class="fp">
  <div class="fp-head">
    <h2>{title}</h2>
    <button class="fp-close" title="Close" on:click={onClose}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
    </button>
  </div>

  <div class="fp-searchwrap">
    <span class="fp-sico"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
    <input class="fp-search" type="text" placeholder="Search fonts, or type any Google family…" bind:value={q} autofocus />
  </div>

  <div class="fp-list">
    <button class="fp-item deflt" class:sel={!current} on:click={() => choose('')}>
      <span class="fp-name">Use the Style's default font</span>
    </button>

    {#if q.trim() && !exact}
      <button class="fp-item" use:preview={q.trim()} on:click={() => choose(q.trim())}>
        <span class="fp-name" style={loaded.has(q.trim()) ? 'font-family:' + fontStack(q.trim()) : ''}>Use “{q.trim()}”</span>
        <span class="fp-sample" style={loaded.has(q.trim()) ? 'font-family:' + fontStack(q.trim()) : ''}>{SAMPLE}</span>
      </button>
    {/if}

    {#each list as f (f)}
      <button class="fp-item" class:sel={f === current} use:preview={f} on:click={() => choose(f)}>
        <span class="fp-name" style={loaded.has(f) ? 'font-family:' + fontStack(f) : ''}>{f}</span>
        <span class="fp-sample" style={loaded.has(f) ? 'font-family:' + fontStack(f) : ''}>{SAMPLE}</span>
      </button>
    {/each}

    {#if !list.length && (exact || !q.trim())}
      <div class="fp-empty">No fonts match.</div>
    {/if}
  </div>
</div>

<style>
  .scrim { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 600; }
  .fp {
    position: fixed; z-index: 601; top: 50%; left: 50%; transform: translate(-50%, -50%);
    width: min(600px, 94vw); height: min(80vh, 660px);
    display: flex; flex-direction: column; overflow: hidden;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 16px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.6);
  }
  .fp-head { display: flex; align-items: center; padding: 1rem 1.2rem 0.7rem; }
  .fp-head h2 { margin: 0; flex: 1; color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.85rem; font-family: var(--font-ui); }
  .fp-close { width: 32px; height: 32px; display: grid; place-items: center; background: transparent; border: 1px solid var(--rule); color: var(--muted); border-radius: 8px; cursor: pointer; }
  .fp-close:hover { color: var(--accent); border-color: var(--accent); }

  .fp-searchwrap { position: relative; padding: 0 1.2rem 0.8rem; }
  .fp-sico { position: absolute; left: 1.8rem; top: 50%; transform: translateY(-60%); color: var(--muted); display: flex; pointer-events: none; }
  .fp-search {
    width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--rule);
    border-radius: 10px; padding: 0.65rem 0.8rem 0.65rem 2.4rem; font-family: var(--font-ui); font-size: 0.95rem;
  }
  .fp-search:focus { outline: none; border-color: var(--accent); }

  .fp-list { flex: 1; overflow-y: auto; padding: 0.3rem 0.7rem 0.8rem; }
  .fp-item {
    display: flex; flex-direction: column; gap: 0.15rem; width: 100%; text-align: left;
    background: transparent; border: 1px solid transparent; border-radius: 10px;
    padding: 0.65rem 0.8rem; cursor: pointer; color: var(--text); font-family: inherit;
  }
  .fp-item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
  .fp-item.sel { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .fp-name { font-size: 1.25rem; line-height: 1.2; }
  .fp-sample { font-size: 0.95rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fp-item.deflt { align-items: flex-start; }
  .fp-item.deflt .fp-name { font-size: 0.95rem; color: var(--muted); }
  .fp-empty { padding: 1rem; color: var(--muted); font-size: 0.9rem; }
</style>
