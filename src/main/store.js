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
    style: 'Espresso',
    fontScale: 1,
    fontHeading: '', // Google font override; '' = use the Style's font
    fontBody: '',

    // Editing
    currentFile: '',
    recentFiles: [],
    autosaveMs: 1200,
    backupsToKeep: 10,

    // Dictation: 'webspeech' (online, free) or 'whisper' (offline, local)
    dictationEngine: 'whisper',
    whisperModel: 'onnx-community/whisper-base.en',
    audioDeviceId: '',

    // Sync
    syncProvider: 'none', // 'none' | 'gdrive' | 'onedrive'
    syncOnSave: false
  }
})

export default store
