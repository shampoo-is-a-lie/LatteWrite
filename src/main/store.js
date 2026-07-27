import Store from 'electron-store'
import path from 'path'

// When running as AppImage, keep data next to the binary. Fall back to cwd in dev.
export const dataPath = process.env.APPIMAGE
  ? path.join(path.dirname(process.env.APPIMAGE), 'LW_DATA')
  : path.join(process.cwd(), 'LW_DATA')

const store = new Store({
  cwd: dataPath,
  defaults: {
    // Google Drive OAuth (user supplies their own client credentials)
    oauthClientId: '',
    oauthClientSecret: '',
    oauthToken: null,

    // Appearance
    style: 'Poppins',         // built-in name or a custom style name
    fontScale: 1,
    customStyles: {},          // user-saved styles: { name: styleObject }

    // Editing
    currentFile: '',
    recentFiles: [],
    autosaveMs: 1200,
    backupsToKeep: 10,
    spellcheck: true,

    // Window
    windowBounds: null, // { x, y, width, height, maximized }

    // Presentation modes
    typewriter: false,   // keep the caret vertically centered
    focusMode: false,    // dim every paragraph but the caret's
    revealMode: false,   // teleprompter: reveal blocks one at a time

    // Dictation runs in the sibling Latte Dictate app, which owns the engine,
    // the microphone and the language model. Nothing to configure here.

    // Sync
    syncProvider: 'none', // 'none' | 'gdrive' | 'onedrive'
    syncOnSave: false
  }
})

export default store
