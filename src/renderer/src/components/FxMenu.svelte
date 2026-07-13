<script>
  export let active = false
  export let onApply = () => {}
  export let onClear = () => {}
  export let onGrabSel = () => {}

  const EFFECTS = [
    { id: 'glow', label: 'Glow' },
    { id: 'neon', label: 'Neon' },
    { id: 'shadow', label: 'Shadow' },
    { id: 'outline', label: 'Outline' },
    { id: 'emboss', label: 'Emboss' },
    { id: 'chrome', label: 'Chrome' }
  ]

  let open = false
  const grab = () => onGrabSel()
  const toggle = () => { open = !open }
  const pick = (id) => { onApply(id); open = false }
</script>

<div class="fxwrap">
  <button class="fxbtn" class:on={active} title="Text effects" on:mousedown={grab} on:click={toggle}>FX</button>
  {#if open}
    <div class="fxmenu">
      {#each EFFECTS as e}
        <button class="fxopt" on:click={() => pick(e.id)}>
          <span class={'fx-' + e.id}>{e.label}</span>
        </button>
      {/each}
      <button class="fxopt clear" on:click={() => { onClear(); open = false }}>None</button>
    </div>
  {/if}
</div>

{#if open}<div class="scrim" on:click={() => open = false}></div>{/if}

<style>
  /* Own no-drag: the toolbar is a drag region and TopBar's exception is scoped. */
  .fxwrap, .fxbtn, .fxmenu, .fxopt, .scrim { -webkit-app-region: no-drag; }
  .fxwrap { position: relative; display: inline-flex; }
  .fxbtn {
    display: inline-flex; align-items: center; justify-content: center; min-width: 2rem; height: 1.85rem;
    padding: 0 0.4rem; border-radius: 7px; cursor: pointer; background: transparent;
    border: 1px solid transparent; color: var(--text); font-weight: 700; font-size: 0.78rem; letter-spacing: 0.06em;
  }
  .fxbtn:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .fxbtn.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, transparent); }

  .fxmenu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.4rem; box-shadow: 0 12px 30px rgba(0,0,0,0.35); min-width: 9rem;
    display: flex; flex-direction: column; gap: 0.15rem;
  }
  .fxopt {
    text-align: left; padding: 0.4rem 0.55rem; border-radius: 7px; border: 1px solid transparent;
    background: transparent; color: var(--text); cursor: pointer; font-size: 0.95rem;
  }
  .fxopt:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .fxopt.clear { color: var(--muted); font-size: 0.78rem; letter-spacing: 0.04em; border-top: 1px solid var(--rule); border-radius: 0 0 7px 7px; margin-top: 0.15rem; }
  .scrim { position: fixed; inset: 0; z-index: 250; }
</style>
