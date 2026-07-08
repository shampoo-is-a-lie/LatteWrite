<script>
  export let editor = null
  export let bump = 0
  export let title = 'Untitled'
  export let saving = false
  export let dirty = false
  export let zoom = 1
  export let onNew = () => {}
  export let onOpen = () => {}
  export let onSave = () => {}
  export let onExport = () => {}
  export let onStyles = () => {}
  export let onSettings = () => {}
  export let onPresent = () => {}
  export let onZoomIn = () => {}
  export let onZoomOut = () => {}
  export let onZoomReset = () => {}

  let showExport = false
  let textColor = '#e06c75'
  let hlColor = '#ffe08a'

  const cmd = (fn) => () => { if (editor) fn(editor.chain().focus()).run() }
  const setTextColor = (v) => { textColor = v; if (editor) editor.chain().focus().setColor(v).run() }
  const clearTextColor = () => { if (editor) editor.chain().focus().unsetColor().run() }
  const setHighlight = (v) => { hlColor = v; if (editor) editor.chain().focus().setHighlight({ color: v }).run() }
  const clearHighlight = () => { if (editor) editor.chain().focus().unsetHighlight().run() }

  $: s = (bump, editor) ? {
    bold: editor?.isActive('bold'),
    italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'),
    strike: editor?.isActive('strike'),
    highlight: editor?.isActive('highlight'),
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
    <button on:click={onNew} title="New (Ctrl+N)">NEW</button>
    <button on:click={onOpen} title="Open (Ctrl+O)">OPEN</button>
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
    <button class:on={s.bold} on:click={cmd(c => c.toggleBold())} title="Bold (Ctrl+B)"><b>B</b></button>
    <button class:on={s.italic} on:click={cmd(c => c.toggleItalic())} title="Italic (Ctrl+I)"><i>I</i></button>
    <button class:on={s.underline} on:click={cmd(c => c.toggleUnderline())} title="Underline (Ctrl+U)"><u>U</u></button>
    <button class:on={s.strike} on:click={cmd(c => c.toggleStrike())} title="Strikethrough (Ctrl+Shift+X)"><s>S</s></button>
    <span class="sep"></span>
    <label class="colorbtn" title="Text color">
      <span class="ci" style="border-bottom-color:{textColor}">A</span>
      <input type="color" value={textColor} on:input={e => setTextColor(e.target.value)} />
    </label>
    <button class="clr" on:click={clearTextColor} title="Clear text color">A&times;</button>
    <label class="colorbtn" class:on={s.highlight} title="Highlight">
      <span class="hi" style="background:{hlColor}">H</span>
      <input type="color" value={hlColor} on:input={e => setHighlight(e.target.value)} />
    </label>
    <button class="clr" on:click={clearHighlight} title="Clear highlight">H&times;</button>
    <span class="sep"></span>
    <button class:on={s.h1} on:click={cmd(c => c.toggleHeading({ level: 1 }))} title="Heading 1 (Ctrl+Alt+1)">H1</button>
    <button class:on={s.h2} on:click={cmd(c => c.toggleHeading({ level: 2 }))} title="Heading 2 (Ctrl+Alt+2)">H2</button>
    <button class:on={s.quote} on:click={cmd(c => c.toggleBlockquote())} title="Quote">&ldquo;</button>
    <button class:on={s.bullet} on:click={cmd(c => c.toggleBulletList())} title="Bullet list">&bull;</button>
    <button class:on={s.ordered} on:click={cmd(c => c.toggleOrderedList())} title="Numbered list">1.</button>
    <span class="sep"></span>
    <button class:on={s.left} on:click={cmd(c => c.setTextAlign('left'))} title="Align left">&#8676;</button>
    <button class:on={s.center} on:click={cmd(c => c.setTextAlign('center'))} title="Align center">&#8677;</button>
  </div>

  <div class="group right">
    <div class="zoom">
      <button on:click={onZoomOut} title="Zoom out (Ctrl -)">&minus;</button>
      <button class="zval" on:click={onZoomReset} title="Reset zoom (Ctrl 0)">{Math.round(zoom * 100)}%</button>
      <button on:click={onZoomIn} title="Zoom in (Ctrl +)">+</button>
    </div>
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
    border-bottom: 1px solid var(--rule); transition: opacity 0.25s; flex-wrap: wrap;
  }
  .group { display: flex; align-items: center; gap: 0.3rem; }
  .group.right { margin-left: auto; }
  button {
    font-family: var(--font-ui); font-size: 0.78rem; letter-spacing: 0.04em;
    background: transparent; color: var(--text); border: 1px solid transparent;
    padding: 0.35rem 0.6rem; border-radius: 7px; cursor: pointer; min-width: 2rem;
  }
  button:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  button.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, transparent); }
  button.present { background: var(--accent); color: var(--bg); font-weight: 700; }
  .sep { width: 1px; height: 20px; background: var(--rule); margin: 0 0.35rem; }
  .title { color: var(--muted); font-size: 0.8rem; margin-right: 0.4rem; max-width: 14rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .colorbtn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 1.85rem; border-radius: 7px; cursor: pointer; }
  .colorbtn:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .colorbtn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .ci { font-weight: 700; border-bottom: 3px solid; line-height: 1; padding-bottom: 1px; }
  .hi { font-weight: 700; color: #1a1a1a; border-radius: 3px; padding: 0 3px; }
  .clr { min-width: auto; padding: 0.35rem 0.4rem; font-size: 0.68rem; color: var(--muted); }

  .zoom { display: flex; align-items: center; gap: 0.15rem; border: 1px solid var(--rule); border-radius: 8px; padding: 0.1rem; margin-right: 0.4rem; }
  .zoom button { min-width: 1.7rem; padding: 0.25rem 0.4rem; }
  .zoom .zval { min-width: 3rem; font-variant-numeric: tabular-nums; }

  .exportwrap { position: relative; }
  .menu {
    position: absolute; top: 2.2rem; left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.3rem; display: flex; flex-direction: column; min-width: 150px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }
  .menu button { text-align: left; }
</style>
