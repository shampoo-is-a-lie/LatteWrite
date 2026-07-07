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

  let settings = {}
  let editor = null
  let bump = 0

  let filePath = ''
  let title = 'Untitled'
  let style = 'Espresso'
  let fontScale = 1

  let saving = false
  let dirty = false
  let presentation = false
  let dictating = false
  let dictationCtl = null

  let showStyles = false
  let showSettings = false
  let connected = false

  let autosaveTimer = null

  $: micAvailable = (settings.dictationEngine || 'webspeech') === 'whisper'
    ? false
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
    window.api.settings.set({ style })
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

  async function togglePresent() {
    presentation = await window.api.window.togglePresentation()
  }

  function toggleDictate() {
    if (dictating) {
      dictationCtl?.stop()
      dictating = false
      return
    }
    if (!micAvailable) return
    try {
      dictationCtl = createDictation(settings.dictationEngine || 'webspeech')
      dictationCtl.start(
        () => {},
        (finalText) => {
          if (editor && finalText) editor.commands.insertContent(finalText.replace(/\s+$/, '') + ' ')
        }
      )
      dictating = true
    } catch (e) {
      dictating = false
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

  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow(true) }
    else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); togglePresent() }
    else if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); toggleDictate() }
    else if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openDoc() }
    else if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); newDoc() }
    else if (e.key === 'Escape') { showStyles = false; showSettings = false }
  }

  onMount(async () => {
    settings = await window.api.settings.get()
    style = settings.style || 'Espresso'
    fontScale = settings.fontScale || 1
    applyStyle(style, fontScale)
    connected = await window.api.auth.status()
    window.api.window.onFullscreen(v => presentation = v)
    window.addEventListener('keydown', onKey)
  })
</script>

<div class="app-shell" class:presentation>
  <TopBar
    {editor} {bump} {title} {saving} {dirty}
    onNew={newDoc} onOpen={openDoc} onSave={() => saveNow(true)}
    onExport={exportAs} onStyles={() => showStyles = true}
    onSettings={() => showSettings = true} onPresent={togglePresent} />

  <div class="editor-scroll">
    <Editor {onReady} {onChange} {onSelect} />
  </div>

  <PresentationBar {dictating} {presentation} {saving} {micAvailable}
    onDictate={toggleDictate} onPresent={togglePresent} />

  {#if showStyles}
    <StylePicker current={style} onPick={pickStyle} onClose={() => showStyles = false} />
  {/if}
  {#if showSettings}
    <Settings {settings} {connected} onPatch={patchSettings}
      onConnect={connectDrive} onDisconnect={disconnectDrive} onClose={() => showSettings = false} />
  {/if}
</div>
