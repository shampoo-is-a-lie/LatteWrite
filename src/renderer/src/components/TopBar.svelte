<script>
  import DocSearch from './DocSearch.svelte'
  import ColorMenu from './ColorMenu.svelte'
  import FxMenu from './FxMenu.svelte'
  import { adaptiveColor } from '../colors.js'
  import { fileToImageSrc } from '../editor-extensions.js'
  export let editor = null
  export let bump = 0
  export let title = 'Untitled'
  export let saving = false
  export let dirty = false
  export let zoom = 1
  export let maximized = false
  export let onNew = () => {}
  export let onNewWindow = () => {}
  export let onOpen = () => {}
  export let onSave = () => {}
  export let onSaveAs = () => {}
  export let onSaveCopy = () => {}
  export let onOpenFolder = () => {}
  export let onDeleteDoc = () => {}
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
  export let onRename = () => {}
  export let onOpenDoc = () => {}
  export let onVersions = () => {}
  export let onRecover = () => {}
  export let drawing = false
  export let onDraw = () => {}
  export let favText = []
  export let favHl = []
  export let onAddFavText = () => {}
  export let onAddFavHl = () => {}

  let showFile = false
  let titleVal = title
  let editingTitle = false
  $: if (!editingTitle) titleVal = title

  let savedSel = null

  const cmd = (fn) => () => { if (editor) fn(editor.chain().focus()).run() }
  const grabSel = () => { if (editor) savedSel = { from: editor.state.selection.from, to: editor.state.selection.to } }
  const sel = () => savedSel || { from: editor.state.selection.from, to: editor.state.selection.to }
  // Colours are stored theme-adaptively (lightness comes from the Style), so they
  // invert legibly when switching between light and dark Styles.
  const applyTextColor = (hex) => { if (editor) editor.chain().focus().setTextSelection(sel()).setColor(adaptiveColor(hex, 'text')).run() }
  const clearTextColor = () => { if (editor) editor.chain().focus().setTextSelection(sel()).unsetColor().run() }
  const applyHighlight = (hex) => { if (editor) editor.chain().focus().setTextSelection(sel()).setHighlight({ color: adaptiveColor(hex, 'highlight') }).run() }
  const clearHighlight = () => { if (editor) editor.chain().focus().setTextSelection(sel()).unsetHighlight().run() }
  const applyFx = (id) => { if (editor) editor.chain().focus().setTextSelection(sel()).setFx(id).run() }
  const clearFx = () => { if (editor) editor.chain().focus().setTextSelection(sel()).unsetFx().run() }
  const clearFormat = () => { if (editor) editor.chain().focus().unsetAllMarks().clearNodes().unsetTextAlign().run() }
  const fileDo = (fn) => { showFile = false; fn() }

  let showTable = false
  let fileInput
  let hr = 0, hc = 0 // hovered rows/cols in the size grid
  const GRID = [1, 2, 3, 4, 5, 6, 7, 8]
  const tableDo = (fn) => { showTable = false; if (editor) fn(editor.chain().focus()).run() }
  function insertTableSize(rows, cols) {
    showTable = false; hr = 0; hc = 0
    if (editor) editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
  }
  const toggleBorders = () => {
    showTable = false
    if (!editor) return
    const b = editor.getAttributes('table').borderless
    editor.chain().focus().updateAttributes('table', { borderless: !b }).run()
  }
  function pickImage() { fileInput && fileInput.click() }
  function onImageFile(e) {
    const f = e.target.files && e.target.files[0]
    // Same downscale-and-re-encode as a paste — inserting from disk is where the
    // biggest originals come in.
    if (f && editor) fileToImageSrc(f).then(src => editor.chain().focus().setImage({ src }).run())
    e.target.value = ''
  }

  $: s = (bump, editor) ? {
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'),
    underline: editor?.isActive('underline'), strike: editor?.isActive('strike'),
    code: editor?.isActive('code'),
    highlight: editor?.isActive('highlight'),
    h1: editor?.isActive('heading', { level: 1 }), h2: editor?.isActive('heading', { level: 2 }),
    sub: editor?.isActive('heading', { level: 3 }),
    quote: editor?.isActive('blockquote'), bullet: editor?.isActive('bulletList'), ordered: editor?.isActive('orderedList'),
    left: editor?.isActive({ textAlign: 'left' }), center: editor?.isActive({ textAlign: 'center' }),
    right: editor?.isActive({ textAlign: 'right' }), fx: editor?.isActive('textFx')
  } : {}
</script>

<div class="topbar">
  <div class="row main">
    <div class="filewrap">
      <button on:click={() => showFile = !showFile}>FILE</button>
      {#if showFile}
        <div class="menu">
          <button on:click={() => fileDo(onNew)}>New</button>
          <button on:click={() => fileDo(onNewWindow)}>New Window</button>
          <button on:click={() => fileDo(onOpen)}>Open…</button>
          <button on:click={() => fileDo(onOpenFolder)}>Open files folder</button>
          <button on:click={() => fileDo(onSave)}>{saving ? 'Saving…' : 'Save'}</button>
          <button on:click={() => fileDo(onSaveAs)}>Save as… (move)</button>
          <button on:click={() => fileDo(onSaveCopy)}>Save a copy…</button>
          <button on:click={() => fileDo(onVersions)}>Version history…</button>
          <button on:click={() => fileDo(onRecover)}>Recover documents…</button>
          <button class="danger" on:click={() => fileDo(onDeleteDoc)}>Delete document…</button>
          <div class="menu-sep"></div>
          <button on:click={() => fileDo(() => onExport('pdf'))}>Export PDF — current style</button>
          <button on:click={() => fileDo(() => onExport('pdfPlain'))}>Export PDF — plain (white)</button>
          <button on:click={() => fileDo(() => onExport('docx'))}>Export DOCX</button>
          <button on:click={() => fileDo(() => onExport('html'))}>Export HTML</button>
          <button on:click={() => fileDo(() => onExport('markdown'))}>Export Markdown</button>
        </div>
      {/if}
    </div>
    <input class="title-input" bind:value={titleVal} spellcheck="false" title="Rename document"
      on:focus={() => editingTitle = true}
      on:blur={() => { editingTitle = false; onRename(titleVal) }}
      on:keydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { titleVal = title; e.currentTarget.blur() } }} />
    {#if dirty}<span class="dirty" title="Unsaved changes">*</span>{/if}

    <div class="spacer"></div>
    <div class="searchwrap"><DocSearch onOpen={onOpenDoc} /></div>
    <div class="spacer"></div>

    <button class:on={drawing} on:click={onDraw} title="Draw over the text">DRAW</button>
    <button on:click={onStyles}>STYLE</button>
    <button on:click={onSettings}>SETTINGS</button>
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

  <div class="row fmt">
    <button class:on={s.bold} on:click={cmd(c => c.toggleBold())} title="Bold (Ctrl+B)"><b>B</b></button>
    <button class:on={s.italic} on:click={cmd(c => c.toggleItalic())} title="Italic (Ctrl+I)"><i>I</i></button>
    <button class:on={s.underline} on:click={cmd(c => c.toggleUnderline())} title="Underline (Ctrl+U)"><u>U</u></button>
    <button class:on={s.strike} on:click={cmd(c => c.toggleStrike())} title="Strikethrough (Ctrl+Shift+X)"><s>S</s></button>
    <button class:on={s.code} on:click={cmd(c => c.toggleCode())} title="Inline code (Ctrl+E)"><code>&lt;/&gt;</code></button>
    <span class="sep"></span>
    <ColorMenu label="A" kind="text" favorites={favText}
               onApply={applyTextColor} onClear={clearTextColor} onAddFavorite={onAddFavText} onGrabSel={grabSel} />
    <ColorMenu label="H" kind="highlight" active={s.highlight} favorites={favHl}
               onApply={applyHighlight} onClear={clearHighlight} onAddFavorite={onAddFavHl} onGrabSel={grabSel} />
    <FxMenu active={s.fx} onApply={applyFx} onClear={clearFx} onGrabSel={grabSel} />
    <span class="sep"></span>
    <button class:on={s.h1} on:click={cmd(c => c.toggleHeading({ level: 1 }))} title="Heading 1">H1</button>
    <button class:on={s.h2} on:click={cmd(c => c.toggleHeading({ level: 2 }))} title="Heading 2">H2</button>
    <button class:on={s.sub} on:click={cmd(c => c.toggleHeading({ level: 3 }))} title="Subtitle (small)">Sub</button>
    <button class:on={s.quote} on:click={cmd(c => c.toggleBlockquote())} title="Quote">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6.5 6C4 6 2.5 8 2.5 10.4c0 2.2 1.6 3.8 3.7 3.8.5 0 .9-.1 1.2-.2-.4 2-1.8 3.4-3.7 4l.7 2c3.6-1.1 6.1-4.4 6.1-8.4C10.5 8.3 8.8 6 6.5 6z"/><path d="M17.5 6c-2.5 0-4 2-4 4.4 0 2.2 1.6 3.8 3.7 3.8.5 0 .9-.1 1.2-.2-.4 2-1.8 3.4-3.7 4l.7 2c3.6-1.1 6.1-4.4 6.1-8.4C21.5 8.3 19.8 6 17.5 6z"/></svg>
    </button>
    <button class:on={s.bullet} on:click={cmd(c => c.toggleBulletList())} title="Bullet list">&bull;</button>
    <button class:on={s.ordered} on:click={cmd(c => c.toggleOrderedList())} title="Numbered list">1.</button>
    <span class="sep"></span>
    <button class:on={s.left} on:click={cmd(c => c.setTextAlign('left'))} title="Align left"><span class="ali ali-left"></span></button>
    <button class:on={s.center} on:click={cmd(c => c.setTextAlign('center'))} title="Align center"><span class="ali ali-center"></span></button>
    <button class:on={s.right} on:click={cmd(c => c.setTextAlign('right'))} title="Align right"><span class="ali ali-right"></span></button>
    <span class="sep"></span>
    <div class="tablewrap">
      <button class:on={editor?.isActive('table')} on:click={() => showTable = !showTable} title="Table">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9.5" x2="21" y2="9.5"/><line x1="9.5" y1="9.5" x2="9.5" y2="20"/><line x1="15.5" y1="9.5" x2="15.5" y2="20"/></svg>
      </button>
      {#if showTable}
        <div class="menu tablemenu">
          <div class="grid-label">{hc && hr ? `${hc} × ${hr}` : 'Insert table'}</div>
          <div class="grid-pick" on:mouseleave={() => { hr = 0; hc = 0 }}>
            {#each GRID as r}
              <div class="grid-row">
                {#each GRID as c}
                  <div class="grid-cell" class:hot={c <= hc && r <= hr}
                    on:mouseenter={() => { hc = c; hr = r }}
                    on:click={() => insertTableSize(r, c)}></div>
                {/each}
              </div>
            {/each}
          </div>
          <div class="menu-sep"></div>
          <button on:click={() => tableDo(c => c.addRowAfter())}>Add row</button>
          <button on:click={() => tableDo(c => c.addColumnAfter())}>Add column</button>
          <button on:click={() => tableDo(c => c.deleteRow())}>Delete row</button>
          <button on:click={() => tableDo(c => c.deleteColumn())}>Delete column</button>
          <div class="menu-sep"></div>
          <button on:click={toggleBorders}>Toggle borders</button>
          <button on:click={() => tableDo(c => c.deleteTable())}>Delete table</button>
        </div>
      {/if}
    </div>
    <button on:click={pickImage} title="Insert image">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
    </button>
    <span class="sep"></span>
    <button on:click={clearFormat} title="Clear formatting — reset selection to the Style default">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21l-4.3-4.3a1.9 1.9 0 0 1 0-2.7l9.6-9.6a1.9 1.9 0 0 1 2.7 0l5.6 5.6a1.9 1.9 0 0 1 0 2.7L13 21"/><line x1="21" y1="21" x2="7" y2="21"/><line x1="5" y1="11" x2="14" y2="20"/></svg>
    </button>
    <input type="file" accept="image/*" bind:this={fileInput} on:change={onImageFile} style="display:none" />

    <div class="zoom">
      <button on:click={onZoomOut} title="Zoom out (Ctrl -)">&minus;</button>
      <button class="zval" on:click={onZoomReset} title="Reset zoom (Ctrl 0)">{Math.round(zoom * 100)}%</button>
      <button on:click={onZoomIn} title="Zoom in (Ctrl +)">+</button>
    </div>
  </div>
</div>

{#if showFile}<div class="scrim" on:click={() => showFile = false}></div>{/if}
{#if showTable}<div class="scrim" on:click={() => showTable = false}></div>{/if}

<style>
  .topbar {
    display: flex; flex-direction: column;
    background: var(--surface); border-bottom: 1px solid var(--rule);
    -webkit-app-region: drag;
  }
  .topbar button, .topbar input, .topbar label, .topbar .menu, .topbar .zoom, .topbar .filewrap { -webkit-app-region: no-drag; }
  .row { display: flex; align-items: center; gap: 0.3rem; padding: 0.4rem 0.9rem; }
  .row.main { gap: 0.55rem; }
  .row.fmt { flex-wrap: wrap; border-top: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  .spacer { flex: 1; align-self: stretch; min-width: 0.5rem; }
  .searchwrap { flex: 0 1 320px; min-width: 140px; }

  button {
    font-family: var(--font-ui); font-size: 0.78rem; letter-spacing: 0.04em;
    background: transparent; color: var(--text); border: 1px solid transparent;
    padding: 0.35rem 0.6rem; border-radius: 7px; cursor: pointer; min-width: 2rem;
  }
  button:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  button.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, transparent); }
  button.present { background: var(--accent); color: var(--bg); font-weight: 700; }
  .sep { width: 1px; height: 20px; background: var(--rule); margin: 0 0.35rem; }

  .title-input {
    background: transparent; border: 1px solid transparent; color: var(--muted);
    font-family: var(--font-ui); font-size: 0.82rem; padding: 0.3rem 0.5rem; border-radius: 6px;
    max-width: 22rem; min-width: 6rem;
  }
  .title-input:hover { border-color: var(--rule); }
  .title-input:focus { outline: none; border-color: var(--accent); color: var(--text); background: var(--bg); }
  .dirty { color: var(--accent); font-size: 0.9rem; margin-left: -0.15rem; }

  /* Alignment icons: three ink lines anchored to the alignment side. */
  .ali {
    display: inline-block; width: 15px; height: 12px;
    background:
      linear-gradient(currentColor, currentColor) no-repeat,
      linear-gradient(currentColor, currentColor) no-repeat,
      linear-gradient(currentColor, currentColor) no-repeat;
    background-size: 100% 2px, 65% 2px, 85% 2px;
  }
  .ali-left   { background-position: left 0, left 5px, left 10px; }
  .ali-center { background-position: center 0, center 5px, center 10px; }
  .ali-right  { background-position: right 0, right 5px, right 10px; }

  .zoom { display: flex; align-items: center; gap: 0.15rem; border: 1px solid var(--rule); border-radius: 8px; padding: 0.1rem; margin-left: auto; }
  .zoom button { min-width: 1.7rem; padding: 0.25rem 0.4rem; }
  .zoom .zval { min-width: 3rem; font-variant-numeric: tabular-nums; }

  .filewrap, .tablewrap { position: relative; }
  .menu {
    position: absolute; top: 2.2rem; left: 0; z-index: 300;
    background: var(--surface); border: 1px solid var(--rule); border-radius: 10px;
    padding: 0.3rem; display: flex; flex-direction: column; min-width: 168px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }
  .menu button { text-align: left; }
  .menu button.danger { color: #e5484d; }
  .menu button.danger:hover { background: #e5484d; color: #fff; }
  .menu-sep { height: 1px; background: var(--rule); margin: 0.3rem 0.2rem; }
  .tablemenu { min-width: auto; }
  .grid-label { font-size: 0.72rem; color: var(--muted); text-align: center; padding: 0.2rem 0 0.4rem; letter-spacing: 0.04em; }
  .grid-pick { display: flex; flex-direction: column; gap: 3px; padding: 0.1rem 0.3rem 0.3rem; }
  .grid-row { display: flex; gap: 3px; }
  .grid-cell { width: 17px; height: 17px; border: 1px solid var(--rule); border-radius: 3px; cursor: pointer; background: var(--bg); }
  .grid-cell.hot { background: var(--accent); border-color: var(--accent); }
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
