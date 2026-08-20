import Store from 'electron-store'
import { dataPath } from './paths.js'

export { dataPath }

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
    backupIntervalMs: 300000,  // at most one rotated backup per 5 min per document
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
