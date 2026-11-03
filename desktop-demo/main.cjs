const path = require('node:path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { DeviceService } = require('./device-service.cjs');

const service = new DeviceService();
let window;

function createWindow() {
  window = new BrowserWindow({
    title: 'NEXUS · 多品牌设备中心',
    width: 1440,
    height: 1060,
    minWidth: 1050,
    minHeight: 760,
    backgroundColor: '#eef1ef',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  window.setMenuBarVisibility(false);
  window.loadFile(path.join(__dirname, 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

ipcMain.handle('devices:snapshot', () => service.snapshot());
ipcMain.handle('devices:next-scenario', () => service.nextScenario());
ipcMain.handle('devices:set-dpi', (_event, id, value) => service.setDpi(id, value));
service.on('changed', snapshot => {
  if (window && !window.isDestroyed()) window.webContents.send('devices:changed', snapshot);
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
