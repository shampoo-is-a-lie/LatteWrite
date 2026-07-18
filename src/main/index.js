import { app, shell, BrowserWindow, ipcMain, dialog, session, protocol } from 'electron'
import { join, dirname, basename, extname, relative, isAbsolute } from 'path'
import { spawn } from 'child_process'
import fs from 'fs'
import AdmZip from 'adm-zip'
import store, { dataPath } from './store.js'
import { startAuthFlow, signOut, isAuthenticated } from './auth.js'
import { syncBundle as gdriveSync, removeRemote as gdriveRemove, renameRemote as gdriveRename, twoWaySync as gdriveTwoWay } from './drive.js'
import { syncBundle as onedriveSync } from './onedrive.js'
import { readBundle } from './bundle.js'
import { saveDocument } from './autosave.js'
import { exportHTML, exportMarkdown, exportDocx } from './export.js'
import { loadFontCss, fontCatalog } from './fonts.js'

const FILTERS = [{ name: 'LatteWrite', extensions: ['latte'] }]

// Enable WebGPU for local Whisper acceleration. On Linux + NVIDIA, Chromium
// blocklists the GPU by default, so we bypass the blocklist and force Vulkan.
// transformers.js falls back to CPU/WASM if this doesn't take.
app.commandLine.appendSwitch('enable-unsafe-webgpu')
app.commandLine.appendSwitch('enable-features', 'Vulkan')
app.commandLine.appendSwitch('ignore-gpu-blocklist')

// Serves the bundled Whisper model + ORT wasm to the renderer so dictation runs
// offline. Must be registered as a privileged (standard, fetchable) scheme
// before app-ready; the handler is installed in whenReady below.
protocol.registerSchemesAsPrivileged([
  { scheme: 'latte-asset', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
])
const ASSET_MIME = { '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.json': 'application/json', '.onnx': 'application/octet-stream', '.txt': 'text/plain' }
function whisperBase() {
  return app.isPackaged ? join(process.resourcesPath, 'whisper') : join(__dirname, '../../resources/whisper')
}

// A .latte passed on the command line (file association / "open with"). Consumed
// once by the renderer on startup.
let initialFile = process.argv.slice(1).find(a => a.endsWith('.latte') && fs.existsSync(a)) || null

let mainWindow = null
let saveBoundsOnClose = true

function createWindow() {
  const b = store.get('windowBounds') || {}
  mainWindow = new BrowserWindow({
    width: b.width || 1200,
    height: b.height || 820,
    x: b.x,
    y: b.y,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#17100a',
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })
  if (b.maximized) mainWindow.maximize()

  mainWindow.on('close', () => {
    // Skip during restore so we don't overwrite the just-restored config.
    if (saveBoundsOnClose) store.set('windowBounds', { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() })
  })

  const ses = mainWindow.webContents.session
  ses.setSpellCheckerLanguages(['en-US'])
  ses.setSpellCheckerEnabled(store.get('spellcheck'))

  // Route right-clicks to the renderer so the context menu can be fully themed.
  mainWindow.webContents.on('context-menu', (_e, params) => {
    mainWindow.webContents.send('context-menu', {
      x: params.x, y: params.y,
      misspelledWord: params.misspelledWord,
      suggestions: params.dictionarySuggestions || [],
      isEditable: params.isEditable,
      canCut: params.editFlags.canCut,
      canCopy: params.editFlags.canCopy,
      canPaste: params.editFlags.canPaste,
      canSelectAll: params.editFlags.canSelectAll
    })
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false))
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('window:fullscreen', true))
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('window:fullscreen', false))

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// The "latte" folder next to the AppImage (cwd in dev) — where documents live
// and what the top-bar search looks through.
function docsDir() {
  const dir = process.env.APPIMAGE ? join(dirname(process.env.APPIMAGE), 'latte') : join(process.cwd(), 'latte')
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}
  return dir
}

function sanitizeName(name) {
  return (name || '').replace(/[\/\\:*?"<>|\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

function addRecent(filePath) {
  const recent = [filePath, ...store.get('recentFiles').filter(f => f !== filePath)].slice(0, 12)
  store.set('recentFiles', recent)
  store.set('currentFile', filePath)
}

// ── Settings ──────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => store.store)
ipcMain.handle('settings:set', (_e, patch) => {
  for (const [k, v] of Object.entries(patch)) store.set(k, v)
  return store.store
})

// ── Auth ──────────────────────────────────────────────────────────────────────
ipcMain.handle('auth:status', () => isAuthenticated())
ipcMain.handle('auth:start', async () => { await startAuthFlow(); return true })
ipcMain.handle('auth:signout', () => { signOut(); return true })

// ── Documents ─────────────────────────────────────────────────────────────────
ipcMain.handle('doc:open', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: FILTERS })
  if (res.canceled || !res.filePaths[0]) return null
  return openPath(res.filePaths[0])
})

ipcMain.handle('doc:openPath', (_e, filePath) => openPath(filePath))

function openPath(filePath) {
  if (!fs.existsSync(filePath)) return null
  const { doc, meta, versions } = readBundle(filePath)
  addRecent(filePath)
  return { filePath, doc, meta, versions }
}

ipcMain.handle('doc:save', async (_e, { filePath, doc, meta, versions }) => {
  let target = filePath
  if (!target) {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: join(docsDir(), `${meta?.title || 'Untitled'}.latte`),
      filters: FILTERS
    })
    if (res.canceled || !res.filePath) return null
    target = res.filePath
  }
  saveDocument(target, { doc, meta, versions }, store.get('backupsToKeep'))
  addRecent(target)

  if (store.get('syncOnSave')) { try { await syncCurrent(target) } catch { /* surfaced via sync:now */ } }
  return { filePath: target }
})

ipcMain.handle('doc:saveAs', async (_e, { doc, meta, versions }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(docsDir(), `${meta?.title || 'Untitled'}.latte`),
    filters: FILTERS
  })
  if (res.canceled || !res.filePath) return null
  saveDocument(res.filePath, { doc, meta, versions }, store.get('backupsToKeep'))
  addRecent(res.filePath)
  return { filePath: res.filePath }
})

// Persist a document (e.g. a version snapshot) to a fresh, non-colliding file in
// the latte folder, then open it in a brand-new window (a second instance) — so
// an old version can be edited on its own without touching the current document.
ipcMain.handle('doc:openInNewWindow', (_e, { doc, meta }) => {
  const base = sanitizeName(meta?.title) || 'Untitled'
  let target = join(docsDir(), `${base}.latte`)
  for (let i = 2; fs.existsSync(target); i++) target = join(docsDir(), `${base} (${i}).latte`)
  saveDocument(target, { doc, meta, versions: [] }, store.get('backupsToKeep'))
  addRecent(target)
  const exe = process.env.APPIMAGE
  if (exe) spawn(exe, [target], { detached: true, stdio: 'ignore' }).unref()
  else spawn(process.execPath, [...process.argv.slice(1), target], { detached: true, stdio: 'ignore' }).unref()
  return { filePath: target }
})

ipcMain.handle('doc:recent', () => store.get('recentFiles').filter(f => fs.existsSync(f)))

// A .latte the app was launched with (double-click / "open with"); one-shot.
ipcMain.handle('doc:initialFile', () => {
  const f = initialFile
  initialFile = null
  return f && fs.existsSync(f) ? f : null
})

// Search the latte folder (and its subdirectories) by filename. Recursing lets
// Save As targets that land in a latte subfolder stay findable; .backups and
// other dot-folders are skipped.
ipcMain.handle('docs:search', (_e, query) => {
  const dir = docsDir()
  const q = (query || '').toLowerCase()
  try {
    return fs.readdirSync(dir, { recursive: true })
      .map(f => String(f).split('\\').join('/'))
      .filter(f => f.toLowerCase().endsWith('.latte'))
      .filter(f => !/(^|\/)\./.test(f))   // exclude hidden dirs like .backups
      .filter(f => !q || f.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 40)
      .map(f => ({ name: f.replace(/\.latte$/i, ''), path: join(dir, f) }))
  } catch { return [] }
})

ipcMain.handle('doc:rename', async (_e, { filePath, name, soft }) => {
  const clean = sanitizeName(name) || 'Untitled'
  let target = join(dirname(filePath), clean + '.latte')
  if (target === filePath) return { filePath }
  if (fs.existsSync(target)) {
    if (soft) return { filePath } // auto-naming: don't collide, keep the current name
    target = join(dirname(filePath), `${clean}_${Date.now()}.latte`)
  }
  fs.renameSync(filePath, target)
  store.set('recentFiles', store.get('recentFiles').map(f => f === filePath ? target : f))
  store.set('currentFile', target)
  // Rename the Drive copy in place so the cloud tracks the new name.
  const oldRel = relInDocs(filePath)
  if (liveSyncOn() && oldRel) { try { await gdriveRename(oldRel, basename(target)) } catch { /* next save reconciles */ } }
  return { filePath: target }
})

// Send the current file (and its rolling backups) to the OS trash. Trash rather
// than unlink so a mistaken delete is recoverable from the system trash.
ipcMain.handle('doc:delete', async (_e, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return { ok: true }
  try { await shell.trashItem(filePath) } catch { try { fs.unlinkSync(filePath) } catch {} }
  try {
    const base = basename(filePath, extname(filePath))
    const bdir = join(dirname(filePath), '.backups')
    if (fs.existsSync(bdir)) {
      for (const f of fs.readdirSync(bdir)) {
        if (f.startsWith(base + '_') && f.endsWith('.latte')) { try { fs.unlinkSync(join(bdir, f)) } catch {} }
      }
    }
  } catch {}
  store.set('recentFiles', store.get('recentFiles').filter(f => f !== filePath))
  if (store.get('currentFile') === filePath) store.set('currentFile', '')
  // Trash the Drive copy too so the cloud tracks the deletion.
  const rel = relInDocs(filePath)
  if (liveSyncOn() && rel) { try { await gdriveRemove(rel) } catch { /* next mirror reconciles */ } }
  return { ok: true }
})

// Reveal the default documents folder in the host file manager.
ipcMain.handle('doc:openFolder', () => { shell.openPath(docsDir()); return true })

// Create an autosaved draft in the latte folder immediately (unique name).
ipcMain.handle('doc:autoNew', (_e, { doc, meta }) => {
  const dir = docsDir()
  const base = sanitizeName(meta?.title) || 'Untitled'
  let name = base, i = 1
  while (fs.existsSync(join(dir, name + '.latte'))) { name = `${base}_${String(i).padStart(2, '0')}`; i++ }
  const target = join(dir, name + '.latte')
  saveDocument(target, { doc, meta }, store.get('backupsToKeep'))
  addRecent(target)
  return { filePath: target }
})

// ── Sync ──────────────────────────────────────────────────────────────────────
async function syncCurrent(filePath) {
  const provider = store.get('syncProvider')
  // Path relative to the latte folder, so the provider mirrors any subfolders.
  // A file saved outside the latte folder has no place in the tree, so it syncs
  // flat by basename.
  const rel = relInDocs(filePath) || basename(filePath)
  if (provider === 'gdrive') return gdriveSync(filePath, rel)
  if (provider === 'onedrive') return onedriveSync(filePath, rel)
  throw new Error('No sync provider selected')
}
ipcMain.handle('sync:now', async (_e, filePath) => syncCurrent(filePath))

// Baseline manifest for two-way sync: each path's Drive id + checksum as of the
// last successful reconcile. Kept in LW_DATA (not the latte folder, so it never
// syncs itself). Lets us tell a new file from a remotely-deleted one.
const SYNC_STATE = join(dataPath, 'drive-sync-state.json')
function readSyncState() { try { return JSON.parse(fs.readFileSync(SYNC_STATE, 'utf8')) } catch { return {} } }
function writeSyncState(obj) { try { fs.writeFileSync(SYNC_STATE, JSON.stringify(obj)) } catch { /* best effort */ } }

// Send a document Drive just pulled/changed to the OS trash locally (recoverable),
// falling back to a hard unlink if trashing isn't available.
async function trashLocal(abs) {
  try { await shell.trashItem(abs) } catch { try { fs.unlinkSync(abs) } catch { /* gone already */ } }
}

// Run the full two-way reconcile against Drive, persisting the new baseline.
// Returns the stats summary.
async function runTwoWaySync() {
  const { stats, manifest } = await gdriveTwoWay(docsDir(), readSyncState(), { trashLocal })
  writeSyncState(manifest)
  return stats
}

function broadcast(channel, payload) {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
}

// The SYNC ALL button: a manual full two-way reconcile (Google Drive only).
ipcMain.handle('sync:all', async () => {
  const provider = store.get('syncProvider')
  if (provider === 'none') return { ok: false, error: 'No sync provider selected' }
  if (provider !== 'gdrive') return { ok: false, error: 'Two-way sync is only available for Google Drive' }
  try {
    const stats = await runTwoWaySync()
    broadcast('sync:updated')   // let open windows reload anything that changed on disk
    return { ok: true, ...stats }
  } catch (e) { return { ok: false, error: e.message } }
})

// Pull-on-open: reconcile once at launch so this device picks up whatever the
// other device (e.g. the phone) changed. Only when Drive sync is active; runs
// after the window has loaded so the renderer's listener is ready to refresh.
let startupSynced = false
function maybeStartupSync() {
  if (startupSynced || !liveSyncOn() || !isAuthenticated()) return
  startupSynced = true
  const go = async () => { try { await runTwoWaySync(); broadcast('sync:updated') } catch { /* offline etc. */ } }
  if (mainWindow && !mainWindow.webContents.isLoading()) go()
  else mainWindow?.webContents.once('did-finish-load', go)
}

// Path of a file relative to the latte folder, or null if it lives outside the
// tree (a custom Save As location) and so has no mirrored place on Drive.
function relInDocs(filePath) {
  const rel = relative(docsDir(), filePath)
  return (!rel || rel.startsWith('..') || isAbsolute(rel)) ? null : rel
}

// True when changes should sync to/from Drive (Google Drive connected + enabled).
function liveSyncOn() {
  return store.get('syncOnSave') && store.get('syncProvider') === 'gdrive'
}

// ── Export ────────────────────────────────────────────────────────────────────
async function pickExportPath(defaultName, ext) {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${defaultName}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  return res.canceled ? null : res.filePath
}

ipcMain.handle('export:pdf', async (e, { title }) => {
  const out = await pickExportPath(title || 'Untitled', 'pdf')
  if (!out) return null
  const data = await e.sender.printToPDF({ printBackground: true, preferCSSPageSize: true })
  fs.writeFileSync(out, data)
  return out
})

ipcMain.handle('export:html', async (_e, payload) => {
  const out = await pickExportPath(payload.meta?.title || 'Untitled', 'html')
  return out ? await exportHTML(out, payload) : null
})
ipcMain.handle('export:markdown', async (_e, payload) => {
  const out = await pickExportPath(payload.meta?.title || 'Untitled', 'md')
  return out ? exportMarkdown(out, payload) : null
})
ipcMain.handle('export:docx', async (_e, payload) => {
  const out = await pickExportPath(payload.meta?.title || 'Untitled', 'docx')
  return out ? exportDocx(out, payload) : null
})

// ── Fonts ─────────────────────────────────────────────────────────────────────
ipcMain.handle('fonts:load', (_e, family) => loadFontCss(family))
ipcMain.handle('fonts:catalog', () => fontCatalog())

// ── Spellcheck / edit (for the themed context menu) ───────────────────────────
ipcMain.handle('spell:set', (_e, enabled) => {
  store.set('spellcheck', enabled)
  session.defaultSession.setSpellCheckerEnabled(enabled)
  return enabled
})
ipcMain.handle('spell:replace', (_e, word) => mainWindow.webContents.replaceMisspelling(word))
ipcMain.handle('spell:add', (_e, word) => session.defaultSession.addWordToSpellCheckerDictionary(word))
ipcMain.handle('edit:cut', () => mainWindow.webContents.cut())
ipcMain.handle('edit:copy', () => mainWindow.webContents.copy())
ipcMain.handle('edit:paste', () => mainWindow.webContents.paste())
ipcMain.handle('edit:selectAll', () => mainWindow.webContents.selectAll())

// ── Full backup / restore (settings, custom styles, cached fonts) ─────────────
ipcMain.handle('backup:create', async () => {
  const stamp = new Date().toISOString().slice(0, 10)
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(app.getPath('home'), `LatteWrite-backup-${stamp}.zip`),
    filters: [{ name: 'Zip', extensions: ['zip'] }]
  })
  if (res.canceled || !res.filePath) return null
  const zip = new AdmZip()
  zip.addLocalFolder(dataPath) // config.json (settings + custom styles) + fonts/
  zip.writeZip(res.filePath)
  return res.filePath
})

ipcMain.handle('backup:restore', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'], filters: [{ name: 'Zip', extensions: ['zip'] }]
  })
  if (res.canceled || !res.filePaths[0]) return false
  const zip = new AdmZip(res.filePaths[0])
  zip.extractAllTo(dataPath, true)
  saveBoundsOnClose = false
  app.relaunch()
  app.exit(0)
  return true
})

// Install a desktop-menu shortcut + icon and register the .latte file type, so
// the app shows up in the DE menu (KDE/GNOME/…) and .latte files open with it.
// AppImages don't self-integrate, so this is opt-in from Settings.
ipcMain.handle('desktop:install', () => {
  const appimage = process.env.APPIMAGE
  if (!appimage) return { error: 'Run the packaged .AppImage to install the menu shortcut.' }
  const home = app.getPath('home')
  const share = join(home, '.local', 'share')
  const iconDest = join(share, 'icons', 'lattewrite.png')
  const appsDir = join(share, 'applications')
  const mimeRoot = join(share, 'mime')
  const iconSrc = join(process.resourcesPath, 'icon.png')

  fs.mkdirSync(join(share, 'icons'), { recursive: true })
  fs.mkdirSync(appsDir, { recursive: true })
  fs.mkdirSync(join(mimeRoot, 'packages'), { recursive: true })
  if (fs.existsSync(iconSrc)) fs.copyFileSync(iconSrc, iconDest)

  fs.writeFileSync(join(mimeRoot, 'packages', 'lattewrite.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-latte">
    <comment>LatteWrite document</comment>
    <glob pattern="*.latte"/>
    <icon name="lattewrite"/>
  </mime-type>
</mime-info>
`, 'utf8')

  fs.writeFileSync(join(appsDir, 'lattewrite.desktop'), [
    '[Desktop Entry]',
    'Type=Application',
    'Name=LatteWrite',
    'Comment=Presentation-first word processor',
    `Exec="${appimage}" %f`,
    `Icon=${iconDest}`,
    'Terminal=false',
    'Categories=Office;WordProcessor;',
    'MimeType=application/x-latte;',
    'StartupWMClass=LatteWrite',
  ].join('\n') + '\n', 'utf8')

  const run = (cmd, args) => { try { spawn(cmd, args, { stdio: 'ignore' }).unref() } catch {} }
  run('update-desktop-database', [appsDir])
  run('update-mime-database', [mimeRoot])
  run('xdg-mime', ['default', 'lattewrite.desktop', 'application/x-latte'])
  run('gtk-update-icon-cache', ['-f', '-t', join(share, 'icons')])
  run('kbuildsycoca6', [])
  return { ok: true }
})

// Launch a second, fully independent instance (its own editor/undo history) so a
// different file can be edited alongside this one.
ipcMain.handle('window:new', () => {
  const exe = process.env.APPIMAGE
  if (exe) spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
  else spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: 'ignore' }).unref()
  return true
})

// ── Window controls (frameless) ───────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow.minimize())
ipcMain.handle('window:maximize', () => { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize() })
ipcMain.handle('window:close', () => mainWindow.close())
ipcMain.handle('window:isMaximized', () => mainWindow.isMaximized())

// ── Window ────────────────────────────────────────────────────────────────────
ipcMain.handle('window:presentation', () => {
  const on = !mainWindow.isFullScreen()
  mainWindow.setFullScreen(on)
  return on
})

app.whenReady().then(() => {
  protocol.handle('latte-asset', async (request) => {
    const u = new URL(request.url)
    const base = whisperBase()
    const filePath = join(base, decodeURIComponent(u.host + u.pathname))
    if (!filePath.startsWith(base)) return new Response('forbidden', { status: 403 })
    try {
      const data = await fs.promises.readFile(filePath)
      const ext = filePath.slice(filePath.lastIndexOf('.'))
      return new Response(data, { headers: { 'Content-Type': ASSET_MIME[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })

  // Without this, Electron silently denies getUserMedia, so dictation never
  // gets microphone access.
  const MEDIA = ['media', 'audioCapture', 'microphone']
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(MEDIA.includes(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => MEDIA.includes(permission))

  createWindow()
  maybeStartupSync()   // pull anything the other device changed, once per launch
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
