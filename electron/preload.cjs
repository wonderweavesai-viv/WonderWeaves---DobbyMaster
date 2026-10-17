const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wwFS', {
  getRoot: () => ipcRenderer.invoke('ww:getRoot'),
  chooseRoot: () => ipcRenderer.invoke('ww:chooseRoot'),
  list: folder => ipcRenderer.invoke('ww:list', folder),
  read: (folder, filename) => ipcRenderer.invoke('ww:read', folder, filename),
  write: (folder, filename, text) => ipcRenderer.invoke('ww:write', folder, filename, text),
  remove: (folder, filename) => ipcRenderer.invoke('ww:remove', folder, filename),
  exists: (folder, filename) => ipcRenderer.invoke('ww:exists', folder, filename),
  reveal: (folder, filename) => ipcRenderer.invoke('ww:reveal', folder, filename),
  saveAs: (suggestedName, text) => ipcRenderer.invoke('ww:saveAs', suggestedName, text),
  onOpenFile: cb => {
    const handler = (_e, file) => cb(file);
    ipcRenderer.on('ww:open-file', handler);
    ipcRenderer.send('ww:renderer-ready');
    return () => ipcRenderer.removeListener('ww:open-file', handler);
  },
});
