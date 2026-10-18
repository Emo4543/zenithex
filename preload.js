const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  send: (code) => ipcRenderer.invoke('send', code),
  status: () => ipcRenderer.invoke('status'),
  openFile: () => ipcRenderer.invoke('open'),
  saveFile: (d) => ipcRenderer.invoke('save', d),
  onResult: (cb) => ipcRenderer.on('result', (_e, d) => cb(d)),
});
