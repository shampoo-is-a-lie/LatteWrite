<script>
  export let editor = null
  export let bump = 0
  export let title = 'Untitled'
  export let saving = false
  export let dirty = false
  export let zoom = 1
  export let maximized = false
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
  export let onMinimize = () => {}
  export let onMaximize = () => {}
  export let onClose = () => {}

  let showFile = false
  let textColor = '#e06c75'
  let hlColor = '#ffe08a'
  let savedSel = null

  const cmd = (fn) => () => { if (editor) fn(editor.chain().focus()).run() }
  const grabSel = () => { if (editor) savedSel = { from: editor.state.selection.from, to: editor.state.selection.to } }
  const sel = () => savedSel || { from: editor.state.selection.from, to: editor.state.selection.to }
  const setTextColor = (v) => { textColor = v; if (editor) editor.chain().focus().setTextSelection(sel()).setColor(v).run() }
  const clearTextColor = () => { if (editor) editor.chain().focus().setTextSelection(sel()).unsetColor().run() }
  const setHighlight = (v) => { hlColor = v; if (editor) editor.chain().focus().setTextSelection(sel()).setHighlight({ color: v }).run() }
  const clearHighlight = () => { if (editor) editor.chain().focus().setTextSelection(sel()).unsetHighlight().run() }
  const clearFormat = () => { if (editor) editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run() }
  const fileDo = (fn) => { showFile = false; fn() }

  $: s = (bump, editor) ? {
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'), strike: editor?.isActive('strike'),
    highlight: editor?.isActive('highlight'),
    h1: editor?.isActive('heading', { level: 1 }), h2: editor?.isActive('heading', { level: 2 }),
    quote: editor?.isActive('blockquote'), bullet: editor?.isActive('bulletList'), ordered: editor?.isActive('orderedList'),
    left: editor?.isActive({ textAlign: 'left' }), center: editor?.isActive({ textAlign: 'center' })
  } : {}
</script>

<div class="topbar">
  <div class="group">
    <div class="filewrap">
      <button on:click={() => showFile = !showFile}>FILE</button>
      {#if showFile}
        <div class="menu">
          <button on:click={() => fileDo(onNew)}>New</button>
          <button on:click={() => fileDo(onOpen)}>Open…</button>
          <button on:click={() => fileDo(onSave)}>Save</button>
          <div class="menu-sep"></div>
          <button on:click={() => fileDo(() => onExport('pdf'))}>Export PDF</button>
          <button on:click={() => fileDo(() => onExport('docx'))}>Export DOCX</button>
          <button on:click={() => fileDo(() => onExport('html'))}>Export HTML</button>
          <button on:click={() => fileDo(() => onExport('markdown'))}>Export Markdown</button>
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
    <label class="colorbtn" title="Text color" on:mousedown={grabSel}>
      <span class="ci" style="border-bottom-color:{textColor}">A</span>
      <input type="color" value={textColor} on:mousedown={grabSel} on:input={e => setTextColor(e.target.value)} />
    </label>
    <button class="clr" on:mousedown|preventDefault={grabSel} on:click={clearTextColor} title="Clear text color">A&times;</button>
    <label class="colorbtn" class:on={s.highlight} title="Highlight" on:mousedown={grabSel}>
      <span class="hi" style="background:{hlColor}">H</span>
      <input type="color" value={hlColor} on:mousedown={grabSel} on:input={e => setHighlight(e.target.value)} />
    </label>
    <button class="clr" on:mousedown|preventDefault={grabSel} on:click={clearHighlight} title="Clear highlight">H&times;</button>
    <span class="sep"></span>
    <button class:on={s.h1} on:click={cmd(c => c.toggleHeading({ level: 1 }))} title="Heading 1">H1</button>
    <button class:on={s.h2} on:click={cmd(c => c.toggleHeading({ level: 2 }))} title="Heading 2">H2</button>
    <button class:on={s.quote} on:click={cmd(c => c.toggleBlockquote())} title="Quote">&ldquo;</button>
    <button class:on={s.bullet} on:click={cmd(c => c.toggleBulletList())} title="Bullet list">&bull;</button>
    <button class:on={s.ordered} on:click={cmd(c => c.toggleOrderedList())} title="Numbered list">1.</button>
    <span class="sep"></span>
    <button class:on={s.left} on:click={cmd(c => c.setTextAlign('left'))} title="Align left">&#8676;</button>
    <button class:on={s.center} on:click={cmd(c => c.setTextAlign('center'))} title="Align center">&#8677;</button>
    <span class="sep"></span>
    <button on:click={clearFormat} title="Clear formatting — reset selection to the Style default">CLEAR</button>
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
    <div class="winctl">
      <button class="wc" on:click={onMinimize} title="Minimize">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="wc" on:click={onMaximize} title={maximized ? 'Restore' : 'Maximize'}>
        {#if maximized}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="5" width="11" height="11" rx="1.5"/><path d="M16 19H6a1.5 1.5 0 0 1-1.5-1.5V8"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>
        {/if}
      </button>
      <button class="wc wc-close" on:click={onClose} title="Close">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </button>
    </div>
  </div>
</div>

{#if showFile}<div class="scrim" on:click={() => showFile = false}></div>{/if}

<style>
  .topbar {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.5rem 0.9rem; background: var(--surface);
    border-bottom: 1px solid var(--rule); flex-wrap: wrap;
    -webkit-app-region: drag;
  }
  .topbar button, .topbar input, .topbar label, .topbar .menu, .topbar .zoom, .topbar .filewrap { -webkit-app-region: no-drag; }
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
  .title { color: var(--muted); font-size: 0.8rem; margin-right: 0.4rem; max-width: 13rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .colorbtn { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 1.85rem; border-radius: 7px; cursor: pointer; }
  .colorbtn:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .colorbtn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .ci { font-weight: 700; border-bottom: 3px solid; line-height: 1; padding-bottom: 1px; }
  .hi { font-weight: 700; color: #1a1a1a; border-radius: 3px; padding: 0 3px; }
  .clr { min-width: auto; padding: 0.35rem 0.4rem; font-size: 0.68rem; color: var(--muted); }

  .zoom { display: flex; align-items: center; gap: 0.15rem; border: 1px solid var(--rule); border-radius: 8px; padding: 0.1rem; margin-right: 0.4rem; }
  .zoom button { min-width: 1.7rem; padding: 0.25rem 0.4rem; }
  .zoom .zval { min-width: 3rem; font-variant-numeric: tabular-nums; }

  .filewrap { position: relative; }
  .menu {
    position: absolute; top: 2.2rem; left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.3rem; display: flex; flex-direction: column; min-width: 168px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }
  .menu button { text-align: left; }
  .menu-sep { height: 1px; background: var(--rule); margin: 0.3rem 0.2rem; }
  .scrim { position: fixed; inset: 0; z-index: 250; }

  .winctl { display: flex; align-items: center; gap: 0.15rem; margin-left: 0.5rem; }
  .wc {
    min-width: auto; width: 28px; height: 28px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--muted); border-radius: 7px;
  }
  .wc:hover { background: color-mix(in srgb, var(--muted) 22%, transparent); color: var(--text); }
  .wc-close:hover { background: #e5484d; color: #fff; }
</style>
