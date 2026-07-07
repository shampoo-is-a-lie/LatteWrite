<script>
  export let editor = null
  export let bump = 0
  export let title = 'Untitled'
  export let saving = false
  export let dirty = false
  export let onNew = () => {}
  export let onOpen = () => {}
  export let onSave = () => {}
  export let onExport = () => {}
  export let onStyles = () => {}
  export let onSettings = () => {}
  export let onPresent = () => {}

  let showExport = false

  const cmd = (fn) => () => { if (editor) fn(editor.chain().focus()).run() }

  $: s = (bump, editor) ? {
    bold: editor?.isActive('bold'),
    italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'),
    h1: editor?.isActive('heading', { level: 1 }),
    h2: editor?.isActive('heading', { level: 2 }),
    quote: editor?.isActive('blockquote'),
    bullet: editor?.isActive('bulletList'),
    ordered: editor?.isActive('orderedList'),
    left: editor?.isActive({ textAlign: 'left' }),
    center: editor?.isActive({ textAlign: 'center' })
  } : {}
</script>

<div class="topbar">
  <div class="group">
    <button on:click={onNew} title="New">NEW</button>
    <button on:click={onOpen} title="Open">OPEN</button>
    <button on:click={onSave} title="Save (Ctrl+S)">{saving ? 'SAVING…' : 'SAVE'}</button>
    <div class="exportwrap">
      <button on:click={() => showExport = !showExport}>EXPORT</button>
      {#if showExport}
        <div class="menu">
          <button on:click={() => { showExport = false; onExport('pdf') }}>PDF</button>
          <button on:click={() => { showExport = false; onExport('docx') }}>DOCX</button>
          <button on:click={() => { showExport = false; onExport('html') }}>HTML</button>
          <button on:click={() => { showExport = false; onExport('markdown') }}>MARKDOWN</button>
        </div>
      {/if}
    </div>
  </div>

  <div class="group fmt">
    <button class:on={s.bold} on:click={cmd(c => c.toggleBold())}><b>B</b></button>
    <button class:on={s.italic} on:click={cmd(c => c.toggleItalic())}><i>I</i></button>
    <button class:on={s.underline} on:click={cmd(c => c.toggleUnderline())}><u>U</u></button>
    <span class="sep"></span>
    <button class:on={s.h1} on:click={cmd(c => c.toggleHeading({ level: 1 }))}>H1</button>
    <button class:on={s.h2} on:click={cmd(c => c.toggleHeading({ level: 2 }))}>H2</button>
    <button class:on={s.quote} on:click={cmd(c => c.toggleBlockquote())}>&ldquo;</button>
    <button class:on={s.bullet} on:click={cmd(c => c.toggleBulletList())}>&bull;</button>
    <button class:on={s.ordered} on:click={cmd(c => c.toggleOrderedList())}>1.</button>
    <span class="sep"></span>
    <button class:on={s.left} on:click={cmd(c => c.setTextAlign('left'))}>&#8676;</button>
    <button class:on={s.center} on:click={cmd(c => c.setTextAlign('center'))}>&#8677;</button>
  </div>

  <div class="group right">
    <span class="title">{title}{dirty ? ' *' : ''}</span>
    <button on:click={onStyles}>STYLE</button>
    <button on:click={onSettings}>SETTINGS</button>
    <button class="present" on:click={onPresent}>PRESENT</button>
  </div>
</div>

<style>
  .topbar {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.5rem 0.9rem; background: var(--surface);
    border-bottom: 1px solid var(--rule); transition: opacity 0.25s;
    flex-wrap: wrap;
  }
  .group { display: flex; align-items: center; gap: 0.3rem; }
  .group.right { margin-left: auto; }
  .fmt { flex: 0 1 auto; }
  button {
    font-family: var(--font-ui); font-size: 0.78rem; letter-spacing: 0.04em;
    background: transparent; color: var(--text); border: 1px solid transparent;
    padding: 0.35rem 0.6rem; border-radius: 7px; cursor: pointer; min-width: 2rem;
  }
  button:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  button.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, transparent); }
  button.present { background: var(--accent); color: var(--bg); font-weight: 700; }
  .sep { width: 1px; height: 20px; background: var(--rule); margin: 0 0.35rem; }
  .title { color: var(--muted); font-size: 0.8rem; margin-right: 0.4rem; max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exportwrap { position: relative; }
  .menu {
    position: absolute; top: 2.2rem; left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.3rem; display: flex; flex-direction: column; min-width: 150px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }
  .menu button { text-align: left; }
</style>
