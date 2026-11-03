const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deviceAPI', {
  snapshot: () => ipcRenderer.invoke('devices:snapshot'),
  nextScenario: () => ipcRenderer.invoke('devices:next-scenario'),
  setDpi: (id, value) => ipcRenderer.invoke('devices:set-dpi', id, value),
  onChanged: callback => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('devices:changed', listener);
    return () => ipcRenderer.removeListener('devices:changed', listener);
  }
});
