<script>
  import { onMount } from 'svelte'
  import Editor from './components/Editor.svelte'
  import TopBar from './components/TopBar.svelte'
  import PresentationBar from './components/PresentationBar.svelte'
  import StylePicker from './components/StylePicker.svelte'
  import Settings from './components/Settings.svelte'
  import { applyStyle } from './theme.js'
  import { STYLES, isBuiltin, cloneStyle } from './styles.js'
  import { fontStack, ensureFontLoaded } from './fonts.js'
  import { createDictation } from './dictation.js'

  let settings = {}
  let editor = null
  let bump = 0

  let filePath = ''
  let title = 'Untitled'
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
  let audioInputs = []
  let dictAnchor = null
  let dictLen = 0

  let showStyles = false
  let showSettings = false
  let connected = false

  // Presentation modes
  let typewriter = false
  let focusMode = false
  let revealMode = false
  let revealCount = 1
  let scroller = null

  let autosaveTimer = null

  $: revealTotal = (bump, editor) ? (editor?.view?.dom?.children?.length || 0) : 0

  $: curObj = draft || customStyles[style] || STYLES[style] || STYLES.Espresso
  $: stylesMap = { ...STYLES, ...customStyles }
  $: styleOrder = [...Object.keys(STYLES), ...Object.keys(customStyles)]
  $: customSet = new Set(Object.keys(customStyles))
  $: editingLabel = draft ? draftBase + ' (unsaved copy)' : style

  $: micAvailable = (settings.dictationEngine || 'whisper') === 'whisper'
    ? true
    : !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function resolveCurrent() { return draft || customStyles[style] || STYLES[style] || STYLES.Espresso }

  function buildMeta() {
    const obj = resolveCurrent()
    return { title, style, fontScale, bodyFont: fontStack(obj.fonts.body), headingFont: fontStack(obj.fonts.heading), updatedAt: Date.now() }
  }

  function computeTitle() {
    if (!editor) return
    const line = editor.getText().split('\n').find(l => l.trim())
    const fromFile = filePath ? filePath.split('/').pop().replace(/\.latte$/, '') : ''
    title = (line || fromFile || 'Untitled').trim().slice(0, 80)
  }

  function onReady(ed) { editor = ed; computeTitle(); updatePresentation() }
  function onChange() { bump++; dirty = true; computeTitle(); scheduleAutosave(); updatePresentation() }
  function onSelect() { bump++; updatePresentation() }

  // ── Presentation modes ──────────────────────────────────────────────────────
  function currentBlockEl() {
    const { view, state } = editor
    let dom = view.domAtPos(state.selection.head).node
    if (dom.nodeType === 3) dom = dom.parentElement
    while (dom && dom.parentElement && dom.parentElement !== view.dom) dom = dom.parentElement
    return (dom && dom.parentElement === view.dom) ? dom : null
  }

  function currentBlockIndex() {
    const el = currentBlockEl()
    return el ? [...editor.view.dom.children].indexOf(el) : 0
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
    if (!editor) return
    requestAnimationFrame(() => {
      if (!editor) return
      const cur = focusMode ? currentBlockEl() : null
      let i = 0
      for (const el of editor.view.dom.children) {
        el.classList.toggle('focus-line', focusMode && el === cur)
        el.classList.toggle('reveal-hidden', revealMode && i >= revealCount)
        i++
      }
      if (typewriter) scrollCaretToCenter()
    })
  }

  function toggleTypewriter() { typewriter = !typewriter; window.api.settings.set({ typewriter }); updatePresentation() }
  function toggleFocus() { focusMode = !focusMode; window.api.settings.set({ focusMode }); updatePresentation() }
  function toggleReveal() {
    revealMode = !revealMode
    if (revealMode) revealCount = Math.max(1, currentBlockIndex() + 1)
    window.api.settings.set({ revealMode })
    updatePresentation()
  }
  function revealNext() {
    revealCount = Math.min(editor?.view.dom.children.length || 1, revealCount + 1)
    updatePresentation()
    scrollToBlock(revealCount - 1)
  }
  function revealPrev() { revealCount = Math.max(1, revealCount - 1); updatePresentation() }

  function scheduleAutosave() {
    if (!filePath) return
    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveNow(false), settings.autosaveMs || 1200)
  }

  async function saveNow(explicit) {
    if (!editor) return
    if (!filePath && !explicit) return
    saving = true
    const res = await window.api.doc.save({ filePath, doc: editor.getJSON(), meta: buildMeta() })
    if (res) { filePath = res.filePath; dirty = false; computeTitle() }
    saving = false
  }

  async function openDoc() {
    const res = await window.api.doc.open()
    if (res) loadDoc(res)
  }

  function loadDoc(res) {
    filePath = res.filePath
    editor.commands.setContent(res.doc || '')
    const meta = res.meta || {}
    draft = null; draftBase = ''
    if (meta.style && (STYLES[meta.style] || customStyles[meta.style])) style = meta.style
    fontScale = meta.fontScale || 1
    applyCurrent()
    dirty = false
    computeTitle()
  }

  function newDoc() {
    if (!editor) return
    editor.commands.clearContent()
    editor.commands.focus()
    filePath = ''
    dirty = false
    computeTitle()
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
  function setFont(kind, family) {
    const fam = (family || '').trim()
    if (draft) {
      draft.fonts[kind] = fam || (STYLES[draft.base]?.fonts[kind] ?? draft.fonts[kind])
      draft = draft
    } else if (customStyles[style]) {
      const cs = customStyles[style]
      const base = STYLES[cs.base] || STYLES.Espresso
      cs.fonts[kind] = fam || base.fonts[kind]
      customStyles = { ...customStyles }
      window.api.settings.set({ customStyles })
    } else {
      if (!fam) return
      draftBase = style
      draft = cloneStyle(STYLES[style])
      draft.base = style
      draft.fonts[kind] = fam
    }
    applyCurrent()
  }

  function saveStyle(name) {
    name = (name || '').trim()
    if (!name || !draft) return
    if (isBuiltin(name)) { alert('That name belongs to a built-in style. Pick another.'); return }
    const obj = cloneStyle(draft)
    obj.base = draft.base
    customStyles = { ...customStyles, [name]: obj }
    style = name
    draft = null
    draftBase = ''
    window.api.settings.set({ customStyles, style })
    applyCurrent()
  }

  function deleteCustom(name) {
    if (!customStyles[name]) return
    const next = { ...customStyles }
    delete next[name]
    customStyles = next
    window.api.settings.set({ customStyles })
    if (style === name) pickStyle('Espresso')
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
    const payload = { doc: editor.getJSON(), html: editor.getHTML(), text: editor.getText(), meta: buildMeta() }
    if (kind === 'pdf') {
      const prevDraft = draft, prevStyle = style
      draft = null; style = 'Paper'
      applyCurrent()
      await new Promise(r => setTimeout(r, 140))
      await window.api.exports.pdf({ title })
      style = prevStyle; draft = prevDraft
      applyCurrent()
    } else {
      await window.api.exports[kind](payload)
    }
  }

  // ── Presentation ────────────────────────────────────────────────────────────
  async function toggleFullscreen() { fullscreen = await window.api.window.togglePresentation() }
  function toggleChrome() { chromeHidden = !chromeHidden }

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
    if (dictAnchor == null) dictAnchor = editor.state.selection.to
    const from = clampPos(dictAnchor)
    const to = clampPos(dictAnchor + dictLen)
    const out = text.replace(/\s+$/, '') + ' '
    editor.chain().insertContentAt({ from, to }, esc(out)).setTextSelection({ from, to: from + out.length })
      .unsetColor().setTextSelection(from + out.length).run()
    dictAnchor = from + out.length
    dictLen = 0
  }

  async function toggleDictate() {
    if (dictating) {
      dictationCtl?.stop()
      if (editor && dictLen > 0 && dictAnchor != null) {
        const from = clampPos(dictAnchor), to = clampPos(dictAnchor + dictLen)
        editor.chain().setTextSelection({ from, to }).unsetColor().setTextSelection(to).run()
      }
      dictating = false; dictLabel = ''; dictAnchor = null; dictLen = 0
      return
    }
    if (!micAvailable) return
    try {
      dictating = true; dictAnchor = null; dictLen = 0
      dictationCtl = createDictation(settings.dictationEngine || 'whisper', { deviceId: settings.audioDeviceId, model: settings.whisperModel })
      await dictationCtl.start(dictInterim, dictCommit, (s) => { dictLabel = s })
    } catch (e) { dictating = false; dictLabel = ''; alert(e.message) }
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
    catch (e) { alert('Could not connect: ' + e.message) }
  }
  async function disconnectDrive() { await window.api.auth.signOut(); connected = false }
  function openSettings() { enumerateAudioInputs(); showSettings = true }

  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (ctrl && k === 's') { e.preventDefault(); saveNow(true) }
    else if (ctrl && e.shiftKey && k === 'p') { e.preventDefault(); toggleFullscreen() }
    else if (ctrl && e.shiftKey && k === 'h') { e.preventDefault(); toggleChrome() }
    else if (ctrl && e.shiftKey && k === 'x') { e.preventDefault(); editor?.chain().focus().toggleStrike().run() }
    else if (ctrl && k === 'd') { e.preventDefault(); toggleDictate() }
    else if (ctrl && k === 'o') { e.preventDefault(); openDoc() }
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
    applyCurrent()
    connected = await window.api.auth.status()
    window.api.window.onFullscreen(v => { fullscreen = v; chromeHidden = v })
    window.addEventListener('keydown', onKey)
  })
</script>

<div class="app-shell">
  {#if !chromeHidden}
    <TopBar
      {editor} {bump} {title} {saving} {dirty} zoom={fontScale}
      onNew={newDoc} onOpen={openDoc} onSave={() => saveNow(true)}
      onExport={exportAs} onStyles={() => showStyles = true}
      onSettings={openSettings} onPresent={toggleFullscreen}
      onZoomIn={() => zoomBy(0.1)} onZoomOut={() => zoomBy(-0.1)} onZoomReset={zoomReset} />
  {/if}

  <div class="editor-scroll" class:typewriter class:focus-mode={focusMode} class:reveal-mode={revealMode} bind:this={scroller}>
    <Editor {onReady} {onChange} {onSelect} />
  </div>

  <PresentationBar
    {dictating} {dictLabel} {fullscreen} {chromeHidden} {saving} {micAvailable}
    {typewriter} {focusMode} {revealMode} {revealCount} {revealTotal}
    onDictate={toggleDictate} onPresent={toggleFullscreen} onToggleChrome={toggleChrome}
    onToggleTypewriter={toggleTypewriter} onToggleFocus={toggleFocus} onToggleReveal={toggleReveal}
    onRevealNext={revealNext} onRevealPrev={revealPrev} />

  {#if showStyles}
    <StylePicker current={style} {stylesMap} order={styleOrder} {customSet}
      onPick={pickStyle} onDelete={deleteCustom} onClose={() => showStyles = false} />
  {/if}
  {#if showSettings}
    <Settings {settings} {connected} inputs={audioInputs}
      headingFamily={curObj.fonts.heading} bodyFamily={curObj.fonts.body}
      isDraft={!!draft} {editingLabel}
      onPatch={patchSettings} onSetFont={setFont} onSaveStyle={saveStyle} onSpellcheck={setSpellcheck}
      onConnect={connectDrive} onDisconnect={disconnectDrive} onClose={() => showSettings = false} />
  {/if}
</div>
