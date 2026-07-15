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
  CustomTable, ResizableImage, TableRow, TableHeader, TableCell, TextFx, handleImagePaste
} from '../src/renderer/src/editor-extensions.js'
import { fontStack } from '../src/renderer/src/fonts.js'

// ── App state ────────────────────────────────────────────────────────────────
let editor = null
let currentName = null
let meta = {}
let versions = []

const el = (id) => document.getElementById(id)
const root = document.documentElement

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
    TextFx
  ]
}

// Rebuild the editor from scratch on every document load. Recreating the instance
// wipes undo history, so Ctrl+Z can never reach back into a previously open file.
function buildEditor(content) {
  if (editor) editor.destroy()
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

function applyMeta(m) {
  // Poppins is the app's default Style, so new/font-less files match it here too.
  const body = m.bodyFamily || 'Poppins'
  const heading = m.headingFamily || 'Poppins'
  const code = m.codeFamily || 'JetBrains Mono'
  loadGoogleFont(body)
  loadGoogleFont(heading)
  loadGoogleFont(code)
  root.style.setProperty('--font-body', fontStack(body))
  root.style.setProperty('--font-heading', fontStack(heading))
  root.style.setProperty('--font-code', fontStack(code))
  root.style.setProperty('--font-scale', String(m.fontScale || 1))
  const name = m.title || currentName || 'Untitled'
  el('filename').textContent = name
  document.title = name + ' — LatteWrite Web'
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
    applyMeta(meta)
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
  applyMeta(meta)
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
document.addEventListener('click', () => { el('table-menu').hidden = true })

el('btn-theme').addEventListener('click', () => {
  const light = root.getAttribute('data-theme') === 'light'
  root.setAttribute('data-theme', light ? 'dark' : 'light')
  el('btn-theme').textContent = light ? 'LIGHT' : 'DARK'
})

function zoom(delta) {
  const cur = parseFloat(getComputedStyle(root).getPropertyValue('--font-scale')) || 1
  const next = Math.min(2.5, Math.max(0.6, Math.round((cur + delta) * 10) / 10))
  root.style.setProperty('--font-scale', String(next))
}
el('btn-zoom-in').addEventListener('click', () => zoom(0.1))
el('btn-zoom-out').addEventListener('click', () => zoom(-0.1))

// Keyboard: Ctrl/Cmd+S saves (a download) instead of the browser's save-page.
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveLatte() }
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

// Start with an empty editor and the open hint.
buildEditor('')
applyMeta({})
