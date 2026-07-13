<script>
  import { onMount } from 'svelte'
  import { EditorState } from '@tiptap/pm/state'
  import Editor from './components/Editor.svelte'
  import TopBar from './components/TopBar.svelte'
  import PresentationBar from './components/PresentationBar.svelte'
  import StylePicker from './components/StylePicker.svelte'
  import Settings from './components/Settings.svelte'
  import ContextMenu from './components/ContextMenu.svelte'
  import ConfirmDialog from './components/ConfirmDialog.svelte'
  import Drawing from './components/Drawing.svelte'
  import VersionHistory from './components/VersionHistory.svelte'
  import { applyStyle } from './theme.js'
  import { STYLES, isBuiltin, cloneStyle } from './styles.js'
  import { fontStack, ensureFontLoaded } from './fonts.js'
  import { DEFAULT_TEXT_COLORS, DEFAULT_HL_COLORS } from './colors.js'
  import { createDictation } from './dictation.js'

  let settings = {}
  let editor = null
  let bump = 0

  // Saved favourite colours for the text/highlight pickers (most-recent first).
  let favText = DEFAULT_TEXT_COLORS
  let favHl = DEFAULT_HL_COLORS
  function addFav(list, hex, key) {
    const next = [hex, ...list.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, 15)
    window.api.settings.set({ [key]: next })
    return next
  }
  const addFavText = (hex) => { favText = addFav(favText, hex, 'favTextColors') }
  const addFavHl = (hex) => { favHl = addFav(favHl, hex, 'favHighlightColors') }

  let filePath = ''
  let title = 'Untitled'
  let titleManual = false  // true once the user renames the doc explicitly
  let fontScale = 1

  // Style state: `style` is the selected name (built-in or custom). `draft` is an
  // unsaved fork of a built-in being edited (built-ins are immutable).
  let customStyles = {}
  let style = 'Espresso'
  let draft = null
  let draftBase = ''

  let saving = false
  let dirty = false
  let fullscreen = false
  let chromeHidden = false
  let dictating = false
  let dictLabel = ''
  let dictationCtl = null
  let dictRestarting = false
  let dictAutoRestarts = 0
  let audioInputs = []
  let dictAnchor = null
  let dictLen = 0

  let showStyles = false
  let showSettings = false
  let connected = false
  let maximized = false
  let drawMode = false
  let drawings = []
  let dialog = null  // themed alert/confirm

  // Version history — one snapshot per day (the day's final content), newest 10.
  let versions = []
  let lastSaveDate = null
  let lastSaveDoc = null
  let showVersions = false

  const ymd = (t = Date.now()) => {
    const d = new Date(t), p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  function upsertVersion(date, doc) {
    versions = [{ date, savedAt: Date.now(), doc }, ...versions.filter(v => v.date !== date)]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 10)
  }

  function onDrawChange() { dirty = true; scheduleAutosave() }

  function restoreVersion(v) {
    showConfirm({
      title: 'Restore version', danger: true, confirmLabel: 'RESTORE',
      message: `Replace the current document with the version from ${v.date}? The current content will be replaced.`,
      onConfirm: () => { editor.commands.setContent(v.doc || ''); dirty = true; showVersions = false; saveNow(false) }
    })
  }
  function deleteVersion(v) {
    showConfirm({
      title: 'Delete version', danger: true, confirmLabel: 'DELETE',
      message: `Delete the saved version from ${v.date}?`,
      onConfirm: () => { versions = versions.filter(x => x.date !== v.date); saveNow(false) }
    })
  }

  function showAlert(title, message) {
    dialog = { title, message, confirmLabel: 'OK', cancelLabel: '', danger: false, onConfirm: () => dialog = null }
  }
  function showConfirm({ title, message, confirmLabel, danger, onConfirm }) {
    dialog = { title, message, confirmLabel, cancelLabel: 'CANCEL', danger, onConfirm: () => { dialog = null; onConfirm() } }
  }

  // Presentation modes
  let typewriter = false
  let focusMode = false
  let revealMode = false
  let revealCount = 1
  let scroller = null

  let autosaveTimer = null

  $: revealTotal = (bump, editor) ? (editor?.view?.dom?.children?.length || 0) : 0

  $: curObj = draft || customStyles[style] || STYLES[style] || STYLES.Espresso
  $: bgEffect = settings?.bgEffect || 'none'
  $: stylesMap = { ...STYLES, ...customStyles }
  $: styleOrder = [...Object.keys(STYLES), ...Object.keys(customStyles)]
  $: customSet = new Set(Object.keys(customStyles))
  $: editingLabel = draft ? draftBase + ' (unsaved copy)' : style

  $: micAvailable = (settings.dictationEngine || 'whisper') === 'whisper'

  // Window title (what KDE shows in the taskbar) reflects the current document.
  // Electron mirrors the page title to the native window title automatically.
  $: document.title = (title && title.trim()) ? `${title.trim()} — LatteWrite` : 'LatteWrite'
    ? true
    : !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function resolveCurrent() { return draft || customStyles[style] || STYLES[style] || STYLES.Espresso }

  function buildMeta() {
    const obj = resolveCurrent()
    return { title, titleManual, style, fontScale, drawings, bodyFont: fontStack(obj.fonts.body), headingFont: fontStack(obj.fonts.heading), bodyFamily: obj.fonts.body, headingFamily: obj.fonts.heading, updatedAt: Date.now() }
  }

  // Auto-derive the name from the first line — unless the user has set it explicitly.
  function computeTitle() {
    if (!editor || titleManual) return
    const line = editor.getText().split('\n').find(l => l.trim())
    const fromFile = filePath ? filePath.split('/').pop().replace(/\.latte$/, '') : ''
    title = (line || fromFile || 'Untitled').trim().slice(0, 80)
  }

  // User renamed the document in the top bar → fix the title and rename the file.
  async function commitTitle(name) {
    name = (name || '').trim()
    if (!name || name === title) return
    title = name
    titleManual = true
    if (filePath) {
      const res = await window.api.doc.rename({ filePath, name })
      if (res) filePath = res.filePath
      saveNow(false)
    }
  }

  function onReady(ed) { editor = ed; computeTitle(); updatePresentation() }
  function onChange() {
    bump++; dirty = true; computeTitle(); updatePresentation()
    if (!filePath) createDraft()
    else scheduleAutosave()
  }

  // First edit of an unsaved document → create an autosaved draft in /latte
  // straight away (named from the auto-title), so no work is ever lost.
  let creatingDraft = false
  async function createDraft() {
    if (filePath || creatingDraft || !editor) return
    creatingDraft = true
    const doc = editor.getJSON()
    const res = await window.api.doc.autoNew({ doc, meta: { ...buildMeta(), savedDate: ymd() } })
    if (res) { filePath = res.filePath; dirty = false; versions = []; lastSaveDate = ymd(); lastSaveDoc = doc }
    creatingDraft = false
    scheduleAutosave()
  }
  function onSelect() { bump++; updatePresentation() }

  // ── Presentation modes ──────────────────────────────────────────────────────
  // Focus/reveal styling is done by the Presentation ProseMirror extension (via
  // the focus/reveal/revealCount props on <Editor>) — external DOM edits get
  // reverted by ProseMirror. Here we only handle typewriter scroll + reveal nav.
  function currentBlockIndex() {
    return editor ? editor.state.selection.$head.index(0) : 0
  }

  function scrollCaretToCenter() {
    if (!editor || !scroller) return
    let coords
    try { coords = editor.view.coordsAtPos(editor.state.selection.head) } catch { return }
    const rect = scroller.getBoundingClientRect()
    const caretY = coords.top - rect.top + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, caretY - scroller.clientHeight / 2), behavior: 'smooth' })
  }

  function scrollToBlock(i) {
    if (!editor || !scroller) return
    const el = editor.view.dom.children[i]
    if (!el) return
    const rect = scroller.getBoundingClientRect()
    const y = el.getBoundingClientRect().top - rect.top + scroller.scrollTop
    scroller.scrollTo({ top: Math.max(0, y - scroller.clientHeight / 2 + el.offsetHeight / 2), behavior: 'smooth' })
  }

  function updatePresentation() {
    if (typewriter) requestAnimationFrame(scrollCaretToCenter)
  }

  function toggleTypewriter() { typewriter = !typewriter; window.api.settings.set({ typewriter }); updatePresentation() }
  function toggleFocus() { focusMode = !focusMode; window.api.settings.set({ focusMode }) }
  function toggleReveal() {
    revealMode = !revealMode
    if (revealMode) revealCount = Math.max(1, currentBlockIndex() + 1)
    window.api.settings.set({ revealMode })
  }
  function revealNext() {
    revealCount = Math.min(editor?.view.dom.children.length || 1, revealCount + 1)
    scrollToBlock(revealCount - 1)
  }
  function revealPrev() { revealCount = Math.max(1, revealCount - 1) }

  function scheduleAutosave() {
    if (!filePath) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveNow(false), settings.autosaveMs || 1200)
  }

  async function saveNow(explicit) {
    if (!editor) return
    if (!filePath && !explicit) return
    saving = true
    // Until the user names it, keep the draft's filename following the auto-title.
    if (filePath && !titleManual) {
      const base = filePath.split('/').pop().replace(/\.latte$/i, '')
      const want = title.trim()
      if (want && want !== base) {
        const r = await window.api.doc.rename({ filePath, name: want, soft: true })
        if (r) filePath = r.filePath
      }
    }
    const today = ymd()
    const curDoc = editor.getJSON()
    // First save of a new day → freeze the previous day's final content.
    if (lastSaveDate && lastSaveDate !== today && lastSaveDoc) upsertVersion(lastSaveDate, lastSaveDoc)
    const res = await window.api.doc.save({ filePath, doc: curDoc, meta: { ...buildMeta(), savedDate: today }, versions })
    if (res) { filePath = res.filePath; dirty = false; computeTitle() }
    lastSaveDate = today
    lastSaveDoc = curDoc
    saving = false
  }

  // Write the current document to a directory/name of the user's choosing.
  // Returns the new path, or null if cancelled. Shared by Save As / Save a copy.
  async function writeToNewLocation() {
    const curDoc = editor.getJSON()
    const today = ymd()
    const res = await window.api.doc.saveAs({ doc: curDoc, meta: { ...buildMeta(), savedDate: today }, versions })
    return res ? { path: res.filePath, curDoc, today } : null
  }

  // Save As… — MOVE the document to the chosen location and edit it there. The
  // original in /latte is removed (it stays findable in search if the new home is
  // a /latte subfolder, since search now recurses).
  async function saveAsDoc() {
    if (!editor) return
    saving = true
    const prev = filePath
    const res = await writeToNewLocation()
    if (res) {
      filePath = res.path
      // Adopt the chosen filename as the title, treated as user-set so autosave
      // keeps the file where the user put it instead of renaming from line 1.
      title = filePath.split('/').pop().replace(/\.latte$/i, '')
      titleManual = true
      lastSaveDate = res.today
      lastSaveDoc = res.curDoc
      dirty = false
      await saveNow(false)   // persist the adopted title/manual flag into the new file
      if (prev && prev !== filePath) await window.api.doc.delete(prev)
    }
    saving = false
  }

  // Save a copy… — write a copy to the chosen location but keep editing the
  // ORIGINAL file; nothing is removed from /latte.
  async function saveCopyDoc() {
    if (!editor) return
    saving = true
    await writeToNewLocation()
    saving = false
  }

  async function openDoc() {
    const res = await window.api.doc.open()
    if (res) loadDoc(res)
  }

  async function openByPath(path) {
    const res = await window.api.doc.openPath(path)
    if (res) loadDoc(res)
  }

  // Replace the document AND wipe undo/redo history. Without the wipe, Ctrl+Z
  // can walk back past the load point into the previously-open file's content,
  // which autosave would then persist over the current file — destroying it.
  // Recreating the EditorState resets every plugin's state, including history.
  function setDocument(content) {
    editor.commands.setContent(content || '', false)
    const view = editor.view
    view.updateState(EditorState.create({ doc: view.state.doc, plugins: view.state.plugins }))
    bump++; updatePresentation()
  }

  function loadDoc(res) {
    filePath = res.filePath
    setDocument(res.doc)
    const meta = res.meta || {}
    draft = null; draftBase = ''
    if (meta.style && (STYLES[meta.style] || customStyles[meta.style])) style = meta.style
    fontScale = meta.fontScale || 1
    drawings = meta.drawings || []
    versions = res.versions || []
    lastSaveDate = meta.savedDate || null
    lastSaveDoc = res.doc
    applyCurrent()
    dirty = false
    titleManual = !!meta.titleManual
    if (titleManual && meta.title) title = meta.title
    else computeTitle()
  }

  function newWindow() { window.api.window.newWindow() }

  function newDoc() {
    if (!editor) return
    setDocument('')
    editor.commands.focus()
    filePath = ''
    dirty = false
    titleManual = false
    drawings = []
    versions = []
    lastSaveDate = null
    lastSaveDoc = null
    computeTitle()
  }

  function openDocsFolder() { window.api.doc.openFolder() }

  // Delete the current .latte (with a themed confirm). Unsaved buffers just clear.
  function requestDeleteDoc() {
    if (!filePath) { newDoc(); return }
    const name = filePath.split('/').pop().replace(/\.latte$/i, '')
    showConfirm({
      title: 'Delete document',
      message: `Delete “${name}”? The file and its backups are moved to your system trash, and the editor resets to a new document.`,
      confirmLabel: 'DELETE',
      danger: true,
      onConfirm: deleteCurrentDoc
    })
  }
  async function deleteCurrentDoc() {
    const target = filePath
    clearTimeout(autosaveTimer)   // don't let a pending autosave re-create the file
    filePath = ''                 // stop scheduleAutosave from touching it mid-delete
    await window.api.doc.delete(target)
    newDoc()
  }

  // ── Styles & fonts ────────────────────────────────────────────────────────
  function applyCurrent() {
    const obj = resolveCurrent()
    applyStyle(obj, fontScale)
    ensureFontLoaded(obj.fonts.heading)
    ensureFontLoaded(obj.fonts.body)
    ensureFontLoaded(obj.fonts.ui)
  }

  function pickStyle(name) {
    draft = null
    draftBase = ''
    style = name
    applyCurrent()
    window.api.settings.set({ style })
  }

  // Change a font. Built-ins are immutable → fork an unsaved draft. Custom styles
  // are edited in place. Blank family reverts that slot to the base built-in's font.
  function hexToRgba(hex, a) {
    const h = hex.replace('#', '')
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h
    const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${a})`
  }

  // Apply a mutation to the current editable style: edit a custom style in place,
  // or fork an immutable built-in into an unsaved draft first.
  function editStyle(mutate) {
    if (draft) {
      mutate(draft)
      draft = draft
    } else if (customStyles[style]) {
      const cs = { ...customStyles[style], fonts: { ...customStyles[style].fonts }, tokens: { ...customStyles[style].tokens } }
      mutate(cs)
      customStyles = { ...customStyles, [style]: cs }
      window.api.settings.set({ customStyles })
    } else {
      draftBase = style
      draft = cloneStyle(STYLES[style])
      draft.base = style
      mutate(draft)
    }
    applyCurrent()
  }

  function setFont(kind, family) {
    const fam = (family || '').trim()
    if (!fam && !draft && !customStyles[style]) return // clearing an unedited built-in
    editStyle(s => { s.fonts[kind] = fam || (STYLES[s.base]?.fonts[kind] ?? STYLES[style].fonts[kind]) })
  }

  function setToken(key, value) {
    editStyle(s => {
      s.tokens[key] = value
      if (key === 'accent') s.tokens.selection = hexToRgba(value, 0.28) // keep selection tied to accent
    })
  }
  function setMeasure(value) { editStyle(s => { s.measure = value }) }
  function setDark(v) { editStyle(s => { s.dark = v }) }

  function saveStyle(name) {
    name = (name || '').trim()
    if (!name || !draft) return
    if (isBuiltin(name)) { showAlert('Style', 'That name belongs to a built-in style. Pick another.'); return }
    const obj = cloneStyle(draft)
    obj.base = draft.base
    customStyles = { ...customStyles, [name]: obj }
    style = name
    draft = null
    draftBase = ''
    window.api.settings.set({ customStyles, style })
    applyCurrent()
  }

  function requestDeleteCustom(name) {
    showConfirm({
      title: 'Delete style',
      message: `Delete the custom style "${name}"? This can't be undone.`,
      confirmLabel: 'DELETE', danger: true,
      onConfirm: () => deleteCustom(name)
    })
  }

  function deleteCustom(name) {
    if (!customStyles[name]) return
    const next = { ...customStyles }
    delete next[name]
    customStyles = next
    window.api.settings.set({ customStyles })
    if (style === name) pickStyle('Espresso')
  }

  function uniqueStyleName(base) {
    let n = base, i = 2
    while (STYLES[n] || customStyles[n]) n = `${base} ${i++}`
    return n
  }

  // Duplicate any style (built-in or custom) into a new editable custom style.
  function duplicateStyle(name) {
    const src = customStyles[name] || STYLES[name]
    if (!src) return
    const obj = cloneStyle(src)
    obj.base = src.base || (isBuiltin(name) ? name : 'Espresso')
    const newName = uniqueStyleName(`${name} copy`)
    customStyles = { ...customStyles, [newName]: obj }
    style = newName
    draft = null; draftBase = ''
    window.api.settings.set({ customStyles, style })
    applyCurrent()
  }

  function renameStyle(oldName, newName) {
    newName = (newName || '').trim()
    if (!newName || !customStyles[oldName] || newName === oldName) return
    if (STYLES[newName] || customStyles[newName]) { showAlert('Style', 'A style with that name already exists.'); return }
    const next = { ...customStyles }
    next[newName] = next[oldName]
    delete next[oldName]
    customStyles = next
    if (style === oldName) style = newName
    window.api.settings.set({ customStyles, style })
  }

  // ── Zoom (editor text only) ─────────────────────────────────────────────────
  function zoomBy(d) {
    fontScale = Math.min(2.5, Math.max(0.6, Math.round((fontScale + d) * 10) / 10))
    applyCurrent()
    window.api.settings.set({ fontScale })
  }
  function zoomReset() { fontScale = 1; applyCurrent(); window.api.settings.set({ fontScale }) }

  async function setSpellcheck(v) {
    await window.api.spell.set(v)
    settings = { ...settings, spellcheck: v }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function exportAs(kind) {
    if (!editor) return
    if (kind === 'pdf' || kind === 'pdfPlain') {
      // The document-only PDF comes from the print stylesheet; 'plain' swaps to
      // white paper (fonts kept). No interface, no style-switching flash.
      document.documentElement.setAttribute('data-print', kind === 'pdfPlain' ? 'plain' : 'styled')
      await new Promise(r => setTimeout(r, 50))
      await window.api.exports.pdf({ title })
      document.documentElement.removeAttribute('data-print')
      return
    }
    const payload = { doc: editor.getJSON(), html: editor.getHTML(), text: editor.getText(), meta: buildMeta() }
    await window.api.exports[kind](payload)
  }

  // ── Presentation ────────────────────────────────────────────────────────────
  async function toggleFullscreen() { fullscreen = await window.api.window.togglePresentation() }
  function toggleChrome() { chromeHidden = !chromeHidden }
  const winMin = () => window.api.window.minimize()
  const winMax = () => window.api.window.maximize()
  const winClose = () => window.api.window.close()

  // ── Dictation ────────────────────────────────────────────────────────────────
  function clampPos(p) { return Math.max(0, Math.min(p, editor.state.doc.content.size)) }
  function greyColor() { return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#888888' }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

  function dictInterim(text) {
    if (!editor || !text) return
    if (dictAnchor == null) dictAnchor = editor.state.selection.to
    const from = clampPos(dictAnchor)
    const to = clampPos(dictAnchor + dictLen)
    const t = text.replace(/^\s+/, '')
    editor.chain().insertContentAt({ from, to }, esc(t)).setTextSelection({ from, to: from + t.length })
      .setColor(greyColor()).setTextSelection(from + t.length).run()
    dictLen = t.length
  }

  function dictCommit(text) {
    if (!editor || !text) return
    dictAutoRestarts = 0   // a successful commit means the engine is healthy again
    if (dictAnchor == null) dictAnchor = editor.state.selection.to
    const from = clampPos(dictAnchor)
    const to = clampPos(dictAnchor + dictLen)
    const out = text.replace(/\s+$/, '') + ' '
    editor.chain().insertContentAt({ from, to }, esc(out)).setTextSelection({ from, to: from + out.length })
      .unsetColor().setTextSelection(from + out.length).run()
    dictAnchor = from + out.length
    dictLen = 0
  }

  // Turn whatever grey interim text is on screen into normal committed text.
  function settleInterim() {
    if (editor && dictLen > 0 && dictAnchor != null) {
      const from = clampPos(dictAnchor), to = clampPos(dictAnchor + dictLen)
      editor.chain().setTextSelection({ from, to }).unsetColor().setTextSelection(to).run()
      dictAnchor = to
    }
    dictLen = 0
  }

  async function beginDictation() {
    dictationCtl = createDictation(settings.dictationEngine || 'whisper', { deviceId: settings.audioDeviceId, model: settings.whisperModel })
    await dictationCtl.start(dictInterim, dictCommit, (s) => { dictLabel = s }, onDictError)
  }

  // The engine reported it's wedged (WebGPU device loss / repetition loop).
  // Restart it automatically — same effect as reopening the app.
  function onDictError() {
    if (!dictating || dictRestarting) return
    if (++dictAutoRestarts > 3) {
      dictationCtl?.stop()
      dictating = false; dictLabel = ''; dictAnchor = null; dictLen = 0
      showAlert('Dictation', 'The speech engine kept failing and was stopped. Try again, or pick a different mic/model in Settings.')
      return
    }
    restartDictation()
  }

  // Tear the engine down and load a fresh one, keeping the cursor where it was.
  // If the GPU session is dead, the reload falls back to CPU on its own.
  async function restartDictation() {
    if (dictRestarting || !dictating) return
    dictRestarting = true
    try { dictationCtl?.stop() } catch {}
    settleInterim()
    dictLabel = 'RESTARTING…'
    await new Promise(r => setTimeout(r, 200))   // let the mic device release
    try {
      await beginDictation()
    } catch (e) {
      dictating = false; dictLabel = ''; showAlert('Dictation', e.message)
    }
    dictRestarting = false
  }

  async function toggleDictate() {
    if (dictating) {
      dictationCtl?.stop()
      settleInterim()
      dictating = false; dictLabel = ''; dictAnchor = null; dictLen = 0
      return
    }
    if (!micAvailable) return
    try {
      dictating = true; dictAnchor = null; dictLen = 0; dictAutoRestarts = 0
      await beginDictation()
    } catch (e) { dictating = false; dictLabel = ''; showAlert('Dictation', e.message) }
  }

  async function enumerateAudioInputs() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach(t => t.stop())
    } catch {}
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioInputs = devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }))
  }

  // ── Settings & auth ──────────────────────────────────────────────────────────
  async function patchSettings(patch) { settings = await window.api.settings.set(patch) }
  async function connectDrive() {
    try { await window.api.auth.start(); connected = await window.api.auth.status() }
    catch (e) { showAlert('Cloud sync', 'Could not connect: ' + e.message) }
  }
  async function disconnectDrive() { await window.api.auth.signOut(); connected = false }
  function openSettings() { enumerateAudioInputs(); showSettings = true }

  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (ctrl && e.shiftKey && k === 's') { e.preventDefault(); saveAsDoc() }
    else if (ctrl && k === 's') { e.preventDefault(); saveNow(true) }
    else if (ctrl && e.shiftKey && k === 'p') { e.preventDefault(); toggleFullscreen() }
    else if (ctrl && e.shiftKey && k === 'h') { e.preventDefault(); toggleChrome() }
    else if (ctrl && e.shiftKey && k === 'x') { e.preventDefault(); editor?.chain().focus().toggleStrike().run() }
    else if (ctrl && k === 'd') { e.preventDefault(); toggleDictate() }
    else if (ctrl && k === 'o') { e.preventDefault(); openDoc() }
    else if (ctrl && e.shiftKey && k === 'n') { e.preventDefault(); newWindow() }
    else if (ctrl && k === 'n') { e.preventDefault(); newDoc() }
    else if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); zoomBy(0.1) }
    else if (ctrl && k === '-') { e.preventDefault(); zoomBy(-0.1) }
    else if (ctrl && k === '0') { e.preventDefault(); zoomReset() }
    else if (revealMode && e.key === 'PageDown') { e.preventDefault(); revealNext() }
    else if (revealMode && e.key === 'PageUp') { e.preventDefault(); revealPrev() }
    else if (e.key === 'Escape') { showStyles = false; showSettings = false }
  }

  onMount(async () => {
    settings = await window.api.settings.get()
    customStyles = settings.customStyles || {}
    style = settings.style || 'Espresso'
    if (!STYLES[style] && !customStyles[style]) style = 'Espresso'
    fontScale = settings.fontScale || 1
    typewriter = !!settings.typewriter
    focusMode = !!settings.focusMode
    revealMode = !!settings.revealMode
    if (settings.favTextColors?.length) favText = settings.favTextColors
    if (settings.favHighlightColors?.length) favHl = settings.favHighlightColors
    applyCurrent()
    connected = await window.api.auth.status()
    maximized = await window.api.window.isMaximized()
    window.api.window.onFullscreen(v => { fullscreen = v; chromeHidden = v })
    window.api.window.onMaximized(v => { maximized = v })
    window.addEventListener('keydown', onKey)
    const initial = await window.api.doc.initialFile()
    if (initial) openByPath(initial)
  })
</script>

<div class="bg-fx" data-bg={bgEffect}></div>

<div class="app-shell">
  {#if !chromeHidden}
    <TopBar
      {editor} {bump} {title} {saving} {dirty} {maximized} zoom={fontScale}
      onNew={newDoc} onNewWindow={newWindow} onOpen={openDoc} onSave={() => saveNow(true)} onSaveAs={saveAsDoc}
      onSaveCopy={saveCopyDoc} onOpenFolder={openDocsFolder} onDeleteDoc={requestDeleteDoc}
      onExport={exportAs} onStyles={() => showStyles = true}
      onSettings={openSettings} onPresent={toggleFullscreen}
      onZoomIn={() => zoomBy(0.1)} onZoomOut={() => zoomBy(-0.1)} onZoomReset={zoomReset}
      onMinimize={winMin} onMaximize={winMax} onClose={winClose} onRename={commitTitle}
      onOpenDoc={openByPath} drawing={drawMode} onDraw={() => drawMode = !drawMode}
      favText={favText} favHl={favHl} onAddFavText={addFavText} onAddFavHl={addFavHl}
      onVersions={() => showVersions = true} />
  {/if}

  <div class="editor-scroll" class:typewriter bind:this={scroller}>
    <div class="draw-host">
      <Editor {onReady} {onChange} {onSelect} focus={focusMode} reveal={revealMode} {revealCount} />
      <Drawing active={drawMode} bind:shapes={drawings} on:change={onDrawChange} onExit={() => drawMode = false} />
    </div>
  </div>

  <PresentationBar
    {dictating} {dictLabel} {fullscreen} {chromeHidden} {saving} {micAvailable}
    {typewriter} {focusMode} {revealMode} {revealCount} {revealTotal}
    onDictate={toggleDictate} onRestartDictate={restartDictation} onPresent={toggleFullscreen} onToggleChrome={toggleChrome}
    onToggleTypewriter={toggleTypewriter} onToggleFocus={toggleFocus} onToggleReveal={toggleReveal}
    onRevealNext={revealNext} onRevealPrev={revealPrev} />

  {#if showStyles}
    <StylePicker current={style} {stylesMap} order={styleOrder} {customSet}
      onPick={pickStyle} onDelete={requestDeleteCustom} onDuplicate={duplicateStyle}
      onRename={renameStyle} onClose={() => showStyles = false} />
  {/if}
  {#if showSettings}
    <Settings {settings} {connected} inputs={audioInputs}
      headingFamily={curObj.fonts.heading} bodyFamily={curObj.fonts.body}
      tokens={curObj.tokens} measure={curObj.measure} dark={curObj.dark}
      isDraft={!!draft} {editingLabel}
      onPatch={patchSettings} onSetFont={setFont} onSaveStyle={saveStyle} onSpellcheck={setSpellcheck}
      onSetToken={setToken} onSetMeasure={setMeasure} onSetDark={setDark}
      onConnect={connectDrive} onDisconnect={disconnectDrive} onClose={() => showSettings = false} />
  {/if}

  <ContextMenu />

  {#if showVersions}
    <VersionHistory {versions} onRestore={restoreVersion} onDelete={deleteVersion} onClose={() => showVersions = false} />
  {/if}

  {#if dialog}
    <ConfirmDialog title={dialog.title} message={dialog.message}
      confirmLabel={dialog.confirmLabel} cancelLabel={dialog.cancelLabel} danger={dialog.danger}
      onConfirm={dialog.onConfirm} onCancel={() => dialog = null} />
  {/if}
</div>
