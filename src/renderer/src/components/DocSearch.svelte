<script>
  import { onMount, onDestroy } from 'svelte'

  export let onOpen = () => {}

  let q = ''
  let results = []
  let open = false
  let wrap
  let timer

  function run() {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      results = await window.api.doc.search(q.trim())
      open = results.length > 0
    }, 150)
  }
  function focusOpen() { run() }
  function pick(r) { open = false; q = ''; results = []; onOpen(r.path) }
  function onKey(e) {
    if (e.key === 'Enter' && results.length) pick(results[0])
    else if (e.key === 'Escape') open = false
  }
  const onDown = (e) => { if (wrap && !wrap.contains(e.target)) open = false }

  onMount(() => window.addEventListener('mousedown', onDown))
  onDestroy(() => window.removeEventListener('mousedown', onDown))
</script>

<div class="search" bind:this={wrap}>
  <span class="ico">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  </span>
  <input type="text" placeholder="Search documents…" bind:value={q} on:input={run} on:focus={focusOpen} on:keydown={onKey} />
  {#if open}
    <div class="results">
      {#each results as r}
        <button class="res" on:click={() => pick(r)}>{r.name}</button>
      {:else}
        <div class="empty">No .latte files found</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .search { position: relative; display: flex; align-items: center; -webkit-app-region: no-drag; }
  .ico { position: absolute; left: 0.6rem; color: var(--muted); display: flex; pointer-events: none; }
  input {
    width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--rule);
    border-radius: 8px; padding: 0.4rem 0.7rem 0.4rem 2rem; font-family: var(--font-ui); font-size: 0.82rem;
  }
  input:focus { outline: none; border-color: var(--accent); }
  .results {
    position: absolute; z-index: 320; top: calc(100% + 4px); left: 0; right: 0;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px; padding: 0.3rem;
    max-height: 320px; overflow-y: auto; box-shadow: 0 16px 40px rgba(0,0,0,0.45);
  }
  .res {
    display: block; width: 100%; text-align: left; background: transparent; border: none;
    color: var(--text); font-family: var(--font-ui); font-size: 0.85rem; padding: 0.45rem 0.6rem;
    border-radius: 6px; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .res:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .empty { padding: 0.5rem 0.6rem; font-size: 0.8rem; color: var(--muted); }
</style>
