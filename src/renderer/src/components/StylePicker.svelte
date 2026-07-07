<script>
  import { STYLE_NAMES, STYLES } from '../styles.js'
  export let current = 'Espresso'
  export let onPick = () => {}
  export let onClose = () => {}
</script>

<div class="scrim" on:click={onClose}></div>
<div class="style-menu">
  <div class="style-menu-title">STYLE</div>
  {#each STYLE_NAMES as name}
    <button class="style-row" class:active={name === current} on:click={() => { onPick(name); onClose() }}>
      <span class="swatch" style="background:{STYLES[name].tokens.bg};border-color:{STYLES[name].tokens.rule}">
        <i style="background:{STYLES[name].tokens.accent}"></i>
      </span>
      <span class="style-name">{name}</span>
    </button>
  {/each}
</div>

<style>
  .scrim { position: fixed; inset: 0; z-index: 400; }
  .style-menu {
    position: fixed; z-index: 401; top: 3.2rem; right: 1rem;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 12px;
    padding: 0.5rem; min-width: 200px; box-shadow: 0 18px 50px rgba(0,0,0,0.45);
  }
  .style-menu-title { font-size: 0.7rem; letter-spacing: 0.12em; color: var(--muted); padding: 0.4rem 0.6rem; }
  .style-row {
    display: flex; align-items: center; gap: 0.7rem; width: 100%;
    background: transparent; border: none; color: var(--text); cursor: pointer;
    padding: 0.55rem 0.6rem; border-radius: 8px; font-family: var(--font-ui); font-size: 0.95rem;
  }
  .style-row:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .style-row.active { color: var(--accent); }
  .swatch { width: 22px; height: 22px; border-radius: 6px; border: 1px solid; display: grid; place-items: center; }
  .swatch i { width: 9px; height: 9px; border-radius: 50%; display: block; }
</style>
