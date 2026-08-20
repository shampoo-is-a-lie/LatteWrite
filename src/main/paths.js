import os from 'os'
import path from 'path'

// Where the app keeps its documents and its settings.
//
// On Linux both live beside the AppImage, and that is the point: move the binary
// and its folder and the whole app moves with it, settings and all. A macOS .app
// bundle cannot do that — it is signed and treated as read-only, and writing next
// to it invalidates the signature — so on macOS the same layout sits in $HOME.
//
// The *shape* is identical either way (`latte/` beside `LW_DATA/`), which is what
// lets a Drive-synced tree line up across machines and a .latte copied by hand
// land where the other side expects it.
export const APP_HOME = process.platform === 'darwin'
  ? path.join(os.homedir(), 'LatteWrite')
  : (process.env.APPIMAGE ? path.dirname(process.env.APPIMAGE) : process.cwd())

export const dataPath = path.join(APP_HOME, 'LW_DATA')
export const docsPath = path.join(APP_HOME, 'latte')
