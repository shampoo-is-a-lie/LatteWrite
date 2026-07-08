<script>
  export let current = 'Espresso'
  export let stylesMap = {}
  export let order = []
  export let customSet = new Set()
  export let onPick = () => {}
  export let onDelete = () => {}
  export let onDuplicate = () => {}
  export let onRename = () => {}
  export let onClose = () => {}

  let renaming = null
  let renameVal = ''

  function startRename(name) { renaming = name; renameVal = name }
  function commitRename() {
    if (renaming) { onRename(renaming, renameVal); renaming = null }
  }
  function focusInput(node) { node.focus(); node.select() }
</script>

<div class="scrim" on:click={onClose}></div>
<div class="style-menu">
  <div class="style-menu-title">STYLE</div>
  {#each order as name}
    <div class="style-row" class:active={name === current}>
      {#if renaming === name}
        <input class="rename-input" bind:value={renameVal} use:focusInput
          on:keydown={(e) => { if (e.key === 'Enter') commitRename(); else if (e.key === 'Escape') renaming = null }}
          on:blur={commitRename} />
      {:else}
        <button class="pick" on:click={() => { onPick(name); onClose() }}>
          <span class="swatch" style="background:{stylesMap[name].tokens.bg};border-color:{stylesMap[name].tokens.rule}">
            <i style="background:{stylesMap[name].tokens.accent}"></i>
          </span>
          <span class="style-name">{name}</span>
        </button>
        <div class="actions">
          <button class="act" title="Duplicate" on:click|stopPropagation={() => { onDuplicate(name); onClose() }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
          </button>
          {#if customSet.has(name)}
            <button class="act" title="Rename" on:click|stopPropagation={() => startRename(name)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
            </button>
            <button class="act del" title="Delete" on:click|stopPropagation={() => onDelete(name)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 400; }
  .style-menu {
    position: fixed; z-index: 401; top: 3.2rem; right: 1rem;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
    padding: 0.5rem; min-width: 250px; max-height: 72vh; overflow-y: auto;
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }
  .style-menu-title { font-size: 0.7rem; letter-spacing: 0.12em; color: var(--muted); padding: 0.4rem 0.6rem; }
  .style-row { display: flex; align-items: center; border-radius: 8px; }
  .style-row:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .style-row.active .style-name { color: var(--accent); }
  .pick {
    display: flex; align-items: center; gap: 0.7rem; flex: 1; min-width: 0;
    background: transparent; border: none; color: var(--text); cursor: pointer;
    padding: 0.55rem 0.6rem; font-family: var(--font-ui); font-size: 0.95rem; text-align: left;
  }
  .style-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid; display: grid; place-items: center; flex: none; }
  .swatch i { width: 9px; height: 9px; border-radius: 50%; display: block; }
  .actions { display: flex; align-items: center; gap: 0.1rem; padding-right: 0.3rem; opacity: 0; }
  .style-row:hover .actions { opacity: 1; }
  .act {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
    background: transparent; border: none; color: var(--muted); cursor: pointer; border-radius: 6px;
  }
  .act:hover { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .act.del:hover { color: #fff; background: #e5484d; }
  .rename-input {
    flex: 1; margin: 0.35rem 0.4rem; background: var(--bg); color: var(--text);
    border: 1px solid var(--accent); border-radius: 7px; padding: 0.45rem 0.6rem;
    font-family: var(--font-ui); font-size: 0.9rem;
  }
</style>
