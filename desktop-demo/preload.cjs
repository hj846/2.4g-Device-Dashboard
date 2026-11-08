const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deviceAPI', {
  snapshot: () => ipcRenderer.invoke('devices:snapshot'),
  refresh: () => ipcRenderer.invoke('devices:refresh'),
  artwork: () => ipcRenderer.invoke('artwork:list'),
  chooseArtwork: id => ipcRenderer.invoke('artwork:choose', id),
  setDpi: (id, value) => ipcRenderer.invoke('devices:set-dpi', id, value),
  wallpaper: () => ipcRenderer.invoke('appearance:wallpaper'),
  chooseWallpaper: () => ipcRenderer.invoke('appearance:choose-wallpaper'),
  appearanceTheme: mode => ipcRenderer.invoke('appearance:theme', mode),
  onChanged: callback => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('devices:changed', listener);
    return () => ipcRenderer.removeListener('devices:changed', listener);
  }
});
