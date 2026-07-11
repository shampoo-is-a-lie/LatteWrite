<script>
  import { adaptiveColor } from '../colors.js'

  export let label = 'A'
  export let kind = 'text'          // 'text' | 'highlight'
  export let active = false
  export let favorites = []
  export let onApply = () => {}
  export let onClear = () => {}
  export let onAddFavorite = () => {}
  export let onGrabSel = () => {}

  let open = false
  let picker                        // hidden native <input type=color>

  // Snapshot the editor selection before focus leaves for the popover.
  const grab = () => onGrabSel()
  const toggle = () => { open = !open }
  const pick = (hex) => { onApply(hex); open = false }
  const addCustom = (hex) => { onAddFavorite(hex); onApply(hex); open = false }

  $: face = kind === 'highlight' ? adaptiveColor(favorites[0] || '#d9a83f', 'highlight') : null
</script>

<div class="cwrap">
  <button class="colorbtn" class:on={active} title={kind === 'highlight' ? 'Highlight' : 'Text colour'}
          on:mousedown={grab} on:click={toggle}>
    {#if kind === 'highlight'}
      <span class="hi" style="background:{face}">{label}</span>
    {:else}
      <span class="ci" style="border-bottom-color:{adaptiveColor(favorites[0] || '#9b5de5', 'text')}">{label}</span>
    {/if}
  </button>

  {#if open}
    <div class="cmenu">
      <div class="sw-grid">
        {#each favorites as hex}
          <button class="sw" style="background:{adaptiveColor(hex, kind)}" title={hex}
                  on:click={() => pick(hex)}></button>
        {/each}
      </div>
      <div class="cmenu-row">
        <button class="cbtn" on:click={() => picker.click()}>+ Custom</button>
        <button class="cbtn" on:click={() => { onClear(); open = false }}>Clear</button>
      </div>
      <input type="color" bind:this={picker}
             on:change={(e) => addCustom(e.target.value)} style="display:none" />
    </div>
  {/if}
</div>

{#if open}<div class="scrim" on:click={() => open = false}></div>{/if}

<style>
  /* The toolbar is a frameless-window drag region; TopBar's no-drag exception is
     scoped to its own elements and doesn't reach this child component, so mark
     our interactive parts no-drag or the OS eats the clicks. */
  .cwrap, .colorbtn, .cmenu, .sw, .cbtn, .scrim { -webkit-app-region: no-drag; }
  .cwrap { position: relative; display: inline-flex; }
  .colorbtn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 1.85rem; border-radius: 7px; cursor: pointer; background: transparent; border: 1px solid transparent; color: var(--text); }
  .colorbtn:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .colorbtn.on { background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .ci { font-weight: 700; border-bottom: 3px solid; line-height: 1; padding-bottom: 1px; }
  .hi { font-weight: 700; color: var(--hl-ink); border-radius: 3px; padding: 0 3px; }

  .cmenu {
    position: absolute; top: calc(100% + 4px); left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.5rem; box-shadow: 0 12px 30px rgba(0,0,0,0.35); min-width: 10.5rem;
  }
  .sw-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.3rem; }
  .sw { width: 1.5rem; height: 1.5rem; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--text) 25%, transparent); cursor: pointer; padding: 0; }
  .sw:hover { transform: scale(1.08); }
  .cmenu-row { display: flex; gap: 0.3rem; margin-top: 0.5rem; }
  .cbtn { flex: 1; font-size: 0.72rem; padding: 0.35rem 0.4rem; border-radius: 7px; border: 1px solid var(--rule); background: transparent; color: var(--text); cursor: pointer; letter-spacing: 0.02em; }
  .cbtn:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .scrim { position: fixed; inset: 0; z-index: 250; }
</style>
