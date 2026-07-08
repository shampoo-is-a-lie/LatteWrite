import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    start: () => ipcRenderer.invoke('auth:start'),
    signOut: () => ipcRenderer.invoke('auth:signout')
  },
  doc: {
    open: () => ipcRenderer.invoke('doc:open'),
    openPath: (p) => ipcRenderer.invoke('doc:openPath', p),
    save: (payload) => ipcRenderer.invoke('doc:save', payload),
    saveAs: (payload) => ipcRenderer.invoke('doc:saveAs', payload),
    recent: () => ipcRenderer.invoke('doc:recent')
  },
  sync: {
    now: (filePath) => ipcRenderer.invoke('sync:now', filePath)
  },
  exports: {
    pdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
    html: (payload) => ipcRenderer.invoke('export:html', payload),
    markdown: (payload) => ipcRenderer.invoke('export:markdown', payload),
    docx: (payload) => ipcRenderer.invoke('export:docx', payload)
  },
  fonts: {
    load: (family) => ipcRenderer.invoke('fonts:load', family)
  },
  window: {
    togglePresentation: () => ipcRenderer.invoke('window:presentation'),
    onFullscreen: (cb) => {
      const listener = (_e, v) => cb(v)
      ipcRenderer.on('window:fullscreen', listener)
      return () => ipcRenderer.off('window:fullscreen', listener)
    }
  }
})
