<script>
  export let current = 'Espresso'
  export let stylesMap = {}
  export let order = []
  export let customSet = new Set()
  export let onPick = () => {}
  export let onDelete = () => {}
  export let onClose = () => {}
</script>

<div class="scrim" on:click={onClose}></div>
<div class="style-menu">
  <div class="style-menu-title">STYLE</div>
  {#each order as name}
    <div class="style-row" class:active={name === current}>
      <button class="pick" on:click={() => { onPick(name); onClose() }}>
        <span class="swatch" style="background:{stylesMap[name].tokens.bg};border-color:{stylesMap[name].tokens.rule}">
          <i style="background:{stylesMap[name].tokens.accent}"></i>
        </span>
        <span class="style-name">{name}</span>
      </button>
      {#if customSet.has(name)}
        <button class="del" title="Delete style" on:click|stopPropagation={() => onDelete(name)}>&times;</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 400; }
  .style-menu {
    position: fixed; z-index: 401; top: 3.2rem; right: 1rem;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
    padding: 0.5rem; min-width: 220px; max-height: 70vh; overflow-y: auto;
    box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }
  .style-menu-title { font-size: 0.7rem; letter-spacing: 0.12em; color: var(--muted); padding: 0.4rem 0.6rem; }
  .style-row { display: flex; align-items: center; border-radius: 8px; }
  .style-row:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .style-row.active .style-name { color: var(--accent); }
  .pick {
    display: flex; align-items: center; gap: 0.7rem; flex: 1;
    background: transparent; border: none; color: var(--text); cursor: pointer;
    padding: 0.55rem 0.6rem; font-family: var(--font-ui); font-size: 0.95rem; text-align: left;
  }
  .swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid; display: grid; place-items: center; flex: none; }
  .swatch i { width: 9px; height: 9px; border-radius: 50%; display: block; }
  .del {
    background: transparent; border: none; color: var(--muted); cursor: pointer;
    font-size: 1.1rem; line-height: 1; padding: 0 0.6rem; align-self: stretch;
  }
  .del:hover { color: var(--accent); }
</style>
