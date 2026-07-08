<script>
  import { onMount, tick } from 'svelte'
  import Editor from './components/Editor.svelte'
  import TopBar from './components/TopBar.svelte'
  import PresentationBar from './components/PresentationBar.svelte'
  import StylePicker from './components/StylePicker.svelte'
  import Settings from './components/Settings.svelte'
  import { applyStyle } from './theme.js'
  import { STYLES } from './styles.js'
  import { createDictation } from './dictation.js'
  import { applyFont } from './fonts.js'

  let settings = {}
  let editor = null
  let bump = 0

  let filePath = ''
  let title = 'Untitled'
  let style = 'Espresso'
  let fontScale = 1
  let fontHeading = ''
  let fontBody = ''

  let saving = false
  let dirty = false
  let fullscreen = false
  let chromeHidden = false
  let dictating = false
  let dictLabel = ''
  let dictationCtl = null
  let audioInputs = []
  let dictAnchor = null   // doc position where the current phrase's interim begins
  let dictLen = 0         // length of the currently-shown interim text

  let showStyles = false
  let showSettings = false
  let connected = false

  let autosaveTimer = null

  $: micAvailable = (settings.dictationEngine || 'whisper') === 'whisper'
    ? true
    : !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  function buildMeta() {
    const f = STYLES[style]?.fonts || {}
    return { title, style, fontScale, bodyFont: f.body, headingFont: f.heading, updatedAt: Date.now() }
  }

  function computeTitle() {
    if (!editor) return
    const line = editor.getText().split('\n').find(l => l.trim())
    const fromFile = filePath ? filePath.split('/').pop().replace(/\.latte$/, '') : ''
    title = (line || fromFile || 'Untitled').trim().slice(0, 80)
  }

  function onReady(ed) { editor = ed; computeTitle() }
  function onChange() { bump++; dirty = true; computeTitle(); scheduleAutosave() }
  function onSelect() { bump++ }

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
    if (meta.style && STYLES[meta.style]) style = meta.style
    fontScale = meta.fontScale || 1
    applyStyle(style, fontScale)
    refreshFonts()
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

  function pickStyle(name) {
    style = name
    applyStyle(style, fontScale)
    refreshFonts()
    window.api.settings.set({ style })
  }

  // Re-apply any Google-font overrides on top of the current Style's fonts.
  function refreshFonts() {
    if (fontHeading) applyFont('heading', fontHeading)
    if (fontBody) applyFont('body', fontBody)
  }

  async function setFont(kind, family) {
    if (kind === 'heading') fontHeading = family
    else fontBody = family
    await window.api.settings.set(kind === 'heading' ? { fontHeading: family } : { fontBody: family })
    if (family) {
      await applyFont(kind, family)
    } else {
      applyStyle(style, fontScale) // cleared → back to Style defaults, then re-apply the other override
      refreshFonts()
    }
  }

  async function exportAs(kind) {
    if (!editor) return
    const payload = { doc: editor.getJSON(), html: editor.getHTML(), text: editor.getText(), meta: buildMeta() }
    if (kind === 'pdf') {
      const prev = style
      applyStyle('Paper', 1)
      await tick()
      await new Promise(r => setTimeout(r, 120))
      await window.api.exports.pdf({ title })
      applyStyle(prev, fontScale)
    } else {
      await window.api.exports[kind](payload)
    }
  }

  async function toggleFullscreen() {
    fullscreen = await window.api.window.togglePresentation()
  }

  function toggleChrome() { chromeHidden = !chromeHidden }

  async function enumerateAudioInputs() {
    try {
      // A one-shot getUserMedia unlocks device labels.
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      s.getTracks().forEach(t => t.stop())
    } catch { /* labels may stay blank */ }
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioInputs = devices.filter(d => d.kind === 'audioinput')
      .map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }))
  }

  function clampPos(p) {
    return Math.max(0, Math.min(p, editor.state.doc.content.size))
  }
  function greyColor() {
    return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#888888'
  }
  // Tiptap parses inserted strings as HTML; escape so speech text stays literal.
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // Live hypothesis: replace the current interim range with new greyed text.
  function dictInterim(text) {
    if (!editor || !text) return
    if (dictAnchor == null) dictAnchor = editor.state.selection.to
    const from = clampPos(dictAnchor)
    const to = clampPos(dictAnchor + dictLen)
    const t = text.replace(/^\s+/, '')
    editor.chain()
      .insertContentAt({ from, to }, esc(t))
      .setTextSelection({ from, to: from + t.length })
      .setColor(greyColor())
      .setTextSelection(from + t.length)
      .run()
    dictLen = t.length
  }

  // Commit: replace the interim range with final, un-greyed text + a trailing space.
  function dictCommit(text) {
    if (!editor || !text) return
    if (dictAnchor == null) dictAnchor = editor.state.selection.to
    const from = clampPos(dictAnchor)
    const to = clampPos(dictAnchor + dictLen)
    const out = text.replace(/\s+$/, '') + ' '
    editor.chain()
      .insertContentAt({ from, to }, esc(out))
      .setTextSelection({ from, to: from + out.length })
      .unsetColor()
      .setTextSelection(from + out.length)
      .run()
    dictAnchor = from + out.length
    dictLen = 0
  }

  async function toggleDictate() {
    if (dictating) {
      dictationCtl?.stop()
      // Keep any un-committed interim as normal (un-greyed) text.
      if (editor && dictLen > 0 && dictAnchor != null) {
        const from = clampPos(dictAnchor)
        const to = clampPos(dictAnchor + dictLen)
        editor.chain().setTextSelection({ from, to }).unsetColor().setTextSelection(to).run()
      }
      dictating = false
      dictLabel = ''
      dictAnchor = null
      dictLen = 0
      return
    }
    if (!micAvailable) return
    try {
      dictating = true
      dictAnchor = null
      dictLen = 0
      dictationCtl = createDictation(settings.dictationEngine || 'whisper', { deviceId: settings.audioDeviceId, model: settings.whisperModel })
      await dictationCtl.start(dictInterim, dictCommit, (s) => { dictLabel = s })
    } catch (e) {
      dictating = false
      dictLabel = ''
      alert(e.message)
    }
  }

  async function patchSettings(patch) {
    settings = await window.api.settings.set(patch)
  }

  async function connectDrive() {
    try {
      await window.api.auth.start()
      connected = await window.api.auth.status()
    } catch (e) { alert('Could not connect: ' + e.message) }
  }
  async function disconnectDrive() {
    await window.api.auth.signOut()
    connected = false
  }

  function openSettings() { enumerateAudioInputs(); showSettings = true }

  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (ctrl && k === 's') { e.preventDefault(); saveNow(true) }
    else if (ctrl && e.shiftKey && k === 'p') { e.preventDefault(); toggleFullscreen() }
    else if (ctrl && e.shiftKey && k === 'h') { e.preventDefault(); toggleChrome() }
    else if (ctrl && k === 'd') { e.preventDefault(); toggleDictate() }
    else if (ctrl && k === 'o') { e.preventDefault(); openDoc() }
    else if (ctrl && k === 'n') { e.preventDefault(); newDoc() }
    else if (e.key === 'Escape') { showStyles = false; showSettings = false }
  }

  onMount(async () => {
    settings = await window.api.settings.get()
    style = settings.style || 'Espresso'
    fontScale = settings.fontScale || 1
    fontHeading = settings.fontHeading || ''
    fontBody = settings.fontBody || ''
    applyStyle(style, fontScale)
    refreshFonts()
    connected = await window.api.auth.status()
    window.api.window.onFullscreen(v => { fullscreen = v; chromeHidden = v })
    window.addEventListener('keydown', onKey)
  })
</script>

<div class="app-shell">
  {#if !chromeHidden}
    <TopBar
      {editor} {bump} {title} {saving} {dirty}
      onNew={newDoc} onOpen={openDoc} onSave={() => saveNow(true)}
      onExport={exportAs} onStyles={() => showStyles = true}
      onSettings={openSettings} onPresent={toggleFullscreen} />
  {/if}

  <div class="editor-scroll">
    <Editor {onReady} {onChange} {onSelect} />
  </div>

  <PresentationBar
    {dictating} {dictLabel} {fullscreen} {chromeHidden} {saving} {micAvailable}
    onDictate={toggleDictate} onPresent={toggleFullscreen} onToggleChrome={toggleChrome} />

  {#if showStyles}
    <StylePicker current={style} onPick={pickStyle} onClose={() => showStyles = false} />
  {/if}
  {#if showSettings}
    <Settings {settings} {connected} inputs={audioInputs} {fontHeading} {fontBody}
      onPatch={patchSettings} onSetFont={setFont}
      onConnect={connectDrive} onDisconnect={disconnectDrive} onClose={() => showSettings = false} />
  {/if}
</div>
