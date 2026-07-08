import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import fs from 'fs'
import store from './store.js'
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#17100a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
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
      defaultPath: `${meta?.title || 'Untitled'}.latte`,
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
    defaultPath: `${meta?.title || 'Untitled'}.latte`,
    filters: FILTERS
  })
  if (res.canceled || !res.filePath) return null
  saveDocument(res.filePath, { doc, meta }, store.get('backupsToKeep'))
  addRecent(res.filePath)
  return { filePath: res.filePath }
})

ipcMain.handle('doc:recent', () => store.get('recentFiles').filter(f => fs.existsSync(f)))

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
