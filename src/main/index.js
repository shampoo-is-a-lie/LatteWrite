import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join, dirname } from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import store, { dataPath } from './store.js'
import { startAuthFlow, signOut, isAuthenticated } from './auth.js'
import { syncBundle as gdriveSync } from './drive.js'
import { syncBundle as onedriveSync } from './onedrive.js'
import { readBundle } from './bundle.js'
import { saveDocument } from './autosave.js'
import { exportHTML, exportMarkdown, exportDocx } from './export.js'
import { loadFontCss } from './fonts.js'

const FILTERS = [{ name: 'LatteWrite', extensions: ['latte'] }]

// Enable WebGPU for local Whisper acceleration. On Linux + NVIDIA, Chromium
// blocklists the GPU by default, so we bypass the blocklist and force Vulkan.
// transformers.js falls back to CPU/WASM if this doesn't take.
app.commandLine.appendSwitch('enable-unsafe-webgpu')
app.commandLine.appendSwitch('enable-features', 'Vulkan')
app.commandLine.appendSwitch('ignore-gpu-blocklist')

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
  const { doc, meta } = readBundle(filePath)
  addRecent(filePath)
  return { filePath, doc, meta }
}

ipcMain.handle('doc:save', async (_e, { filePath, doc, meta }) => {
  let target = filePath
  if (!target) {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: join(docsDir(), `${meta?.title || 'Untitled'}.latte`),
      filters: FILTERS
    })
    if (res.canceled || !res.filePath) return null
    target = res.filePath
  }
  saveDocument(target, { doc, meta }, store.get('backupsToKeep'))
  addRecent(target)

  if (store.get('syncOnSave')) { try { await syncCurrent(target) } catch { /* surfaced via sync:now */ } }
  return { filePath: target }
})

ipcMain.handle('doc:saveAs', async (_e, { doc, meta }) => {
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: join(docsDir(), `${meta?.title || 'Untitled'}.latte`),
    filters: FILTERS
  })
  if (res.canceled || !res.filePath) return null
  saveDocument(res.filePath, { doc, meta }, store.get('backupsToKeep'))
  addRecent(res.filePath)
  return { filePath: res.filePath }
})

ipcMain.handle('doc:recent', () => store.get('recentFiles').filter(f => fs.existsSync(f)))

// Search the latte folder by filename.
ipcMain.handle('docs:search', (_e, query) => {
  const dir = docsDir()
  const q = (query || '').toLowerCase()
  try {
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.latte'))
      .filter(f => !q || f.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 40)
      .map(f => ({ name: f.replace(/\.latte$/i, ''), path: join(dir, f) }))
  } catch { return [] }
})

ipcMain.handle('doc:rename', (_e, { filePath, name }) => {
  const clean = (name || '').replace(/[\/\\:*?"<>|]/g, '_').trim() || 'Untitled'
  let target = join(dirname(filePath), clean + '.latte')
  if (target === filePath) return { filePath }
  if (fs.existsSync(target)) target = join(dirname(filePath), `${clean}_${Date.now()}.latte`)
  fs.renameSync(filePath, target)
  store.set('recentFiles', store.get('recentFiles').map(f => f === filePath ? target : f))
  store.set('currentFile', target)
  return { filePath: target }
})

// ── Sync ──────────────────────────────────────────────────────────────────────
async function syncCurrent(filePath) {
  const provider = store.get('syncProvider')
  if (provider === 'gdrive') return gdriveSync(filePath)
  if (provider === 'onedrive') return onedriveSync(filePath)
  throw new Error('No sync provider selected')
}
ipcMain.handle('sync:now', async (_e, filePath) => syncCurrent(filePath))

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
  return out ? exportHTML(out, payload) : null
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
  // Without this, Electron silently denies getUserMedia, so dictation never
  // gets microphone access.
  const MEDIA = ['media', 'audioCapture', 'microphone']
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(MEDIA.includes(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => MEDIA.includes(permission))

  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
