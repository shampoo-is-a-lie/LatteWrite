import JSZip from 'jszip'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import FontFamily from '@tiptap/extension-font-family'

// Reuse the renderer's exact extension code so the ProseMirror schema is identical
// to the desktop app — a file edited here re-opens losslessly there and vice-versa.
import { Presentation } from '../src/renderer/src/presentation-extension.js'
import {
  CustomTable, ResizableImage, TableRow, TableHeader, TableCell, TextFx, Find, handleImagePaste,
  setFindQuery, stepFind, closeFind, scrollToFindMatch, findState
} from '../src/renderer/src/editor-extensions.js'
import { fontStack } from '../src/renderer/src/fonts.js'
// Themes are pure data (colours + Google font names) + a CSS-var applier — both
// import cleanly in the browser. The "Systems" skins are filtered out (they need
// bundled bitmap fonts and shell chrome this build doesn't carry).
import { STYLES, DEFAULT_STYLE, STYLE_CATEGORIES } from '../src/renderer/src/styles.js'
import { applyStyle } from '../src/renderer/src/theme.js'

const el = (id) => document.getElementById(id)
const root = document.documentElement

// ── App state ────────────────────────────────────────────────────────────────
let editor = null
let currentName = null
let meta = {}
let versions = []
// Preferred theme + zoom are cached per-browser. New/blank docs open in the
// preferred theme (Poppins on a fresh browser); picking a theme updates the
// preference; opening a .latte uses the file's own theme without changing it.
let preferredStyle = cachedStyle()
let currentStyle = preferredStyle   // the theme currently applied
let themeTouched = false            // did the user pick a theme for the open doc this session?
let zoomFactor = cachedZoom()       // user zoom, multiplies the style's own scale
let curScale = 1                    // the current style's base scale

function cachedStyle() {
  const saved = localStorage.getItem('lw-web-style')
  return (saved && STYLES[saved] && !STYLES[saved].skin) ? saved : DEFAULT_STYLE
}
function cachedZoom() {
  const z = parseFloat(localStorage.getItem('lw-web-zoom'))
  return z >= 0.6 && z <= 2.5 ? z : 1
}

// The extension list mirrors src/renderer/src/components/Editor.svelte exactly.
function extensions() {
  return [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontFamily,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({ placeholder: 'Start writing…' }),
    Presentation,
    CustomTable.configure({ resizable: false }),
    TableRow, TableHeader, TableCell,
    ResizableImage,
    TextFx,
    Find
  ]
}

// Rebuild the editor from scratch on every document load. Recreating the instance
// wipes undo history, so Ctrl+Z can never reach back into a previously open file.
function buildEditor(content) {
  if (editor) editor.destroy()
  el('findbar').hidden = true      // a fresh editor drops the find highlights
  editor = new Editor({
    element: el('editor'),
    extensions: extensions(),
    content: content || '',
    autofocus: 'end',
    editorProps: { handlePaste: (view, event) => handleImagePaste(view, event) },
    onSelectionUpdate: refreshToolbar,
    onTransaction: refreshToolbar
  })
  refreshToolbar()
}

// ── Fonts & metadata ─────────────────────────────────────────────────────────
// Bitmap/system families the app bundles locally aren't on Google Fonts; they just
// fall back to the generic stack, which is fine for a lightweight web viewer.
function loadGoogleFont(family) {
  if (!family) return
  const id = 'gf-' + family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=' +
    encodeURIComponent(family).replace(/%20/g, '+') + ':ital,wght@0,400;0,600;0,700;1,400&display=swap'
  document.head.appendChild(link)
}

// ── Themes ─────────────────────────────────────────────────────────────────────
// Apply a built-in Style: colours + Google fonts + measure + light/dark, via the
// shared applyStyle (identical CSS vars to the desktop app).
function applyTheme(name) {
  const obj = STYLES[name]
  if (!obj) return
  currentStyle = name
  curScale = obj.scale || 1
  applyStyle(obj, zoomFactor)
  loadGoogleFont(obj.fonts.heading)
  loadGoogleFont(obj.fonts.body)
  loadGoogleFont(obj.fonts.code || 'JetBrains Mono')
  markActiveTheme()
}

// For a document whose Style we can't reproduce (custom or a Systems skin), keep the
// current theme's colours but honour the fonts saved in the file's meta.
function applyDocFonts(m) {
  if (m.bodyFamily) { loadGoogleFont(m.bodyFamily); root.style.setProperty('--font-body', fontStack(m.bodyFamily)) }
  if (m.headingFamily) { loadGoogleFont(m.headingFamily); root.style.setProperty('--font-heading', fontStack(m.headingFamily)) }
  if (m.codeFamily) { loadGoogleFont(m.codeFamily); root.style.setProperty('--font-code', fontStack(m.codeFamily)) }
}

// Choose the theme for a freshly opened document. Zoom stays a browser preference,
// so the file's saved fontScale doesn't override it.
function themeForDoc(m) {
  if (m.style && STYLES[m.style] && !STYLES[m.style].skin) {
    applyTheme(m.style)        // the file's own built-in Style
  } else {
    applyTheme(preferredStyle) // unknown/custom/Systems → the user's preferred colours…
    applyDocFonts(m)           // …but match the document's saved fonts
  }
  themeTouched = false
}

function setDocMeta(m) {
  const name = m.title || (currentName || 'Untitled').replace(/\.latte$/i, '')
  el('filename').textContent = name
  document.title = name + ' — LatteWrite Web'
}

// Build the chooser: every category except the bitmap-font "Systems" skins.
function buildThemeMenu() {
  const menu = el('theme-menu')
  menu.innerHTML = ''
  for (const [cat, names] of Object.entries(STYLE_CATEGORIES)) {
    if (cat === 'Systems') continue
    const usable = names.filter((n) => STYLES[n] && !STYLES[n].skin)
    if (!usable.length) continue
    const head = document.createElement('div')
    head.className = 'theme-cat'
    head.textContent = cat
    menu.appendChild(head)
    for (const n of usable) {
      const t = STYLES[n].tokens
      const b = document.createElement('button')
      b.className = 'theme-item'
      b.dataset.style = n
      b.innerHTML =
        `<span class="sw" style="background:${t.bg};color:${t.text};border-color:${t.rule}">Aa` +
        `<span class="sw-dot" style="background:${t.accent}"></span></span>` +
        `<span class="theme-name">${n}</span>`
      menu.appendChild(b)
    }
  }
}

function markActiveTheme() {
  for (const b of document.querySelectorAll('#theme-menu button[data-style]')) {
    b.classList.toggle('on', b.dataset.style === currentStyle)
  }
}

// ── Open / Save / New ─────────────────────────────────────────────────────────
async function openLatte(file) {
  try {
    const zip = await JSZip.loadAsync(file)
    const docEntry = zip.file('doc.json')
    if (!docEntry) throw new Error('missing doc.json')
    const doc = JSON.parse(await docEntry.async('string'))
    const metaEntry = zip.file('meta.json')
    const verEntry = zip.file('versions.json')
    meta = metaEntry ? JSON.parse(await metaEntry.async('string')) : {}
    versions = verEntry ? JSON.parse(await verEntry.async('string')) : []
    currentName = file.name
    buildEditor(doc)
    themeForDoc(meta)
    setDocMeta(meta)
    el('hint').classList.add('hidden')
  } catch (e) {
    alert('Could not open this file — it does not look like a valid .latte bundle.\n\n' + e.message)
  }
}

// Re-zip with the same three entries writeBundle() produces, preserving the meta
// and version history we read in, then hand the browser a download.
async function saveLatte() {
  if (!editor) return
  meta = { ...meta, title: meta.title || (currentName || 'Untitled').replace(/\.latte$/i, ''), updatedAt: Date.now() }
  // Only write the theme into the file if the user picked one here — otherwise the
  // document's original Style (incl. custom/Systems ones) is preserved untouched.
  if (themeTouched) {
    const obj = STYLES[currentStyle]
    meta.style = currentStyle
    meta.bodyFamily = obj.fonts.body
    meta.headingFamily = obj.fonts.heading
    meta.codeFamily = obj.fonts.code
    meta.fontScale = zoomFactor
  }
  const zip = new JSZip()
  zip.file('doc.json', JSON.stringify(editor.getJSON()))
  zip.file('meta.json', JSON.stringify(meta, null, 2))
  zip.file('versions.json', JSON.stringify(versions))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const name = currentName && /\.latte$/i.test(currentName) ? currentName : (currentName || 'document') + '.latte'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function newDoc() {
  currentName = 'Untitled.latte'
  meta = {}
  versions = []
  buildEditor('')
  applyTheme(preferredStyle)
  themeTouched = false
  setDocMeta({})
  el('hint').classList.remove('hidden')
}

// ── Toolbar ───────────────────────────────────────────────────────────────────
const COMMANDS = {
  undo: (c) => c.undo(),
  redo: (c) => c.redo(),
  p: (c) => c.setParagraph(),
  h1: (c) => c.toggleHeading({ level: 1 }),
  h2: (c) => c.toggleHeading({ level: 2 }),
  h3: (c) => c.toggleHeading({ level: 3 }),
  bold: (c) => c.toggleBold(),
  italic: (c) => c.toggleItalic(),
  underline: (c) => c.toggleUnderline(),
  strike: (c) => c.toggleStrike(),
  bullet: (c) => c.toggleBulletList(),
  ordered: (c) => c.toggleOrderedList(),
  quote: (c) => c.toggleBlockquote(),
  code: (c) => c.toggleCodeBlock(),
  rule: (c) => c.setHorizontalRule(),
  left: (c) => c.setTextAlign('left'),
  center: (c) => c.setTextAlign('center'),
  right: (c) => c.setTextAlign('right')
}

// Which editor state marks a button "active", for the highlighted toolbar state.
const ACTIVE = {
  h1: ['heading', { level: 1 }], h2: ['heading', { level: 2 }], h3: ['heading', { level: 3 }],
  bold: ['bold'], italic: ['italic'], underline: ['underline'], strike: ['strike'],
  bullet: ['bulletList'], ordered: ['orderedList'], quote: ['blockquote'], code: ['codeBlock'],
  left: [{ textAlign: 'left' }], center: [{ textAlign: 'center' }], right: [{ textAlign: 'right' }]
}

function refreshToolbar() {
  if (!editor) return
  for (const btn of document.querySelectorAll('#toolbar button[data-cmd]')) {
    const q = ACTIVE[btn.dataset.cmd]
    btn.classList.toggle('on', !!q && editor.isActive(...q))
  }
  el('btn-table').classList.toggle('on', editor.isActive('table'))
  el('btn-save').disabled = false
  findPaint()
}

// ── Wiring ─────────────────────────────────────────────────────────────────────
el('toolbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-cmd]')
  if (!btn || !editor) return
  const run = COMMANDS[btn.dataset.cmd]
  if (run) run(editor.chain().focus()).run()
})

el('btn-open').addEventListener('click', () => el('file-input').click())
el('file-input').addEventListener('change', (e) => {
  const f = e.target.files[0]
  if (f) openLatte(f)
  e.target.value = ''
})

el('btn-save').addEventListener('click', saveLatte)
el('btn-new').addEventListener('click', newDoc)

el('btn-image').addEventListener('click', () => el('image-input').click())
el('image-input').addEventListener('change', (e) => {
  const f = e.target.files[0]
  if (f && editor) {
    const r = new FileReader()
    r.onload = () => editor.chain().focus().setImage({ src: r.result }).run()
    r.readAsDataURL(f)
  }
  e.target.value = ''
})

// Table controls. Insert drops a 3×3 with a header row; the rest act on the table
// the caret is in (mirrors the desktop app's TABLE menu).
const TABLE_CMDS = {
  insert: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  addRow: (c) => c.addRowAfter(),
  addCol: (c) => c.addColumnAfter(),
  delRow: (c) => c.deleteRow(),
  delCol: (c) => c.deleteColumn(),
  delTable: (c) => c.deleteTable()
}
el('btn-table').addEventListener('click', (e) => {
  e.stopPropagation()
  const m = el('table-menu')
  m.hidden = !m.hidden
})
el('table-menu').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tcmd]')
  if (!btn || !editor) return
  if (btn.dataset.tcmd === 'borders') {
    const b = editor.getAttributes('table').borderless
    editor.chain().focus().updateAttributes('table', { borderless: !b }).run()
  } else {
    TABLE_CMDS[btn.dataset.tcmd](editor.chain().focus()).run()
  }
  el('table-menu').hidden = true
})
// Theme chooser
el('btn-theme').addEventListener('click', (e) => {
  e.stopPropagation()
  const m = el('theme-menu')
  m.hidden = !m.hidden
})
el('theme-menu').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-style]')
  if (!b) return
  themeTouched = true
  preferredStyle = b.dataset.style
  localStorage.setItem('lw-web-style', preferredStyle)
  applyTheme(preferredStyle)
  el('theme-menu').hidden = true
})
document.addEventListener('click', () => {
  el('table-menu').hidden = true
  el('theme-menu').hidden = true
})

function zoom(delta) {
  zoomFactor = Math.min(2.5, Math.max(0.6, Math.round((zoomFactor + delta) * 10) / 10))
  root.style.setProperty('--font-scale', String(curScale * zoomFactor))
  localStorage.setItem('lw-web-zoom', String(zoomFactor))
}
el('btn-zoom-in').addEventListener('click', () => zoom(0.1))
el('btn-zoom-out').addEventListener('click', () => zoom(-0.1))

// ── Find in document ─────────────────────────────────────────────────────────
let findCase = false

// Also called on every transaction, so editing the document keeps the tally honest.
function findPaint() {
  if (!editor || el('findbar').hidden) return
  const s = findState(editor)
  const total = s.matches.length
  const count = el('find-count')
  count.textContent = !s.query ? ' ' : total ? `${s.index + 1} / ${total}` : 'none'
  count.classList.toggle('none', !!s.query && !total)
  el('find-prev').disabled = el('find-next').disabled = !total
}

function findRun() {
  if (!editor) return
  setFindQuery(editor, el('find-input').value, findCase)
  findPaint()
  scrollToFindMatch(editor)
}

function findStep(dir) {
  if (!editor) return
  stepFind(editor, dir)
  findPaint()
  scrollToFindMatch(editor)
}

function openFind() {
  const sel = editor && editor.state.selection
  const seed = sel && !sel.empty ? editor.state.doc.textBetween(sel.from, sel.to, ' ').trim() : ''
  if (seed && !seed.includes('\n')) el('find-input').value = seed
  el('findbar').hidden = false
  el('find-input').select()
  findRun()
}

function hideFind() {
  el('findbar').hidden = true
  if (editor) closeFind(editor)
}

el('find-input').addEventListener('input', findRun)
el('find-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1) }
  else if (e.key === 'Escape') { e.preventDefault(); hideFind() }
})
el('find-prev').addEventListener('click', () => findStep(-1))
el('find-next').addEventListener('click', () => findStep(1))
el('find-close').addEventListener('click', hideFind)
el('find-case').addEventListener('click', () => {
  findCase = !findCase
  el('find-case').classList.toggle('on', findCase)
  findRun()
})

// Keyboard: Ctrl/Cmd+S saves (a download) instead of the browser's save-page,
// Ctrl/Cmd+F searches the document instead of the whole page.
window.addEventListener('keydown', (e) => {
  const ctrl = e.ctrlKey || e.metaKey
  const k = e.key.toLowerCase()
  if (ctrl && k === 's') { e.preventDefault(); saveLatte() }
  else if (ctrl && k === 'f') { e.preventDefault(); openFind() }
  else if (e.key === 'Escape' && !el('findbar').hidden) hideFind()
})

// Drag a .latte onto the window to open it.
window.addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging') })
window.addEventListener('dragleave', (e) => { if (e.relatedTarget === null) document.body.classList.remove('dragging') })
window.addEventListener('drop', (e) => {
  e.preventDefault()
  document.body.classList.remove('dragging')
  const f = e.dataTransfer.files[0]
  if (f && /\.latte$/i.test(f.name)) openLatte(f)
})

// Start with an empty editor, the chooser populated, and the preferred theme applied.
buildThemeMenu()
buildEditor('')
applyTheme(preferredStyle)
setDocMeta({})
