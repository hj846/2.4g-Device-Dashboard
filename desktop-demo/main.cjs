const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const { WindowsDeviceService } = require('./windows-device-service.cjs');

const { loadKnownKeyboards } = require('./hid-devices.cjs');

const service = new WindowsDeviceService();
let window;
let trayController;
let quitting=false;
function openMain(){
  if(!window||window.isDestroyed())createWindow();
  if(window.isMinimized())window.restore();
  window.show();window.focus();
}

function createWindow() {
  window = new BrowserWindow({
    title: 'NEXUS · 多品牌设备中心',
    width: 1225,
    height: 768,
    resizable: false,
    maximizable: true,
    backgroundColor: '#eef1ef',
    accentColor: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#eef1ef',
      symbolColor: '#28352d',
      height: 40
    },
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
  window.setMaximizable(true);
  window.loadFile(path.join(__dirname, 'index.html'));
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('close',event=>{if(!quitting&&trayController){event.preventDefault();window.hide()}});
}

ipcMain.handle('devices:snapshot', () => service.snapshot());
ipcMain.handle('devices:refresh', () => service.refresh());
ipcMain.handle('devices:set-dpi', (_event, id, value) => service.setDpi(id, value));
let artworkStore;
const getArtworkStore=()=>artworkStore??=require('./custom-artwork.cjs').createArtworkStore(path.join(app.getPath('userData'),'product-artwork'),nativeImage);
ipcMain.handle('artwork:list',()=>getArtworkStore().readAll());
let choosingArtwork=false;
ipcMain.handle('artwork:choose',async(event,id)=>{
  if(event.sender!==window?.webContents||choosingArtwork)return null;
  const device=service.snapshot().devices.find(d=>d.id===id);
  if(!device)throw Error('设备已移除，请重新选择设备');
  choosingArtwork=true;
  try{
    const result=await dialog.showOpenDialog(window,{title:'选择 '+device.model+' 的展示图',properties:['openFile'],filters:[{name:'产品图片',extensions:['png','jpg','jpeg','webp','bmp']}]});
    if(result.canceled||!result.filePaths[0])return null;
    return await getArtworkStore().save(device,result.filePaths[0]);
  }finally{choosingArtwork=false}
});
const wallpaperPath = () => path.join(app.getPath('userData'), 'wallpaper.png');
ipcMain.handle('appearance:wallpaper', async () => {
  try { return 'data:image/png;base64,' + (await fs.readFile(wallpaperPath())).toString('base64'); }
  catch { return null; }
});
ipcMain.handle('appearance:choose-wallpaper', async () => {
  const result = await dialog.showOpenDialog(window, {title:'选择背景壁纸',properties:['openFile'],filters:[{name:'图片',extensions:['png','jpg','jpeg','webp','bmp']}]});
  if(result.canceled || !result.filePaths[0])return null;
  const file=result.filePaths[0];
  if((await fs.stat(file)).size>32*1024*1024)throw Error('请选择小于 32 MB 的图片');
  let img=nativeImage.createFromBuffer(await fs.readFile(file));
  if(img.isEmpty())throw Error('无法读取这张图片，请换一张图片');
  const {width,height}=img.getSize();
  if(Math.max(width,height)>2560)img=img.resize(width>=height?{width:2560}:{height:2560});
  const png=img.toPNG();
  await fs.writeFile(wallpaperPath()+'.tmp',png);
  await fs.rename(wallpaperPath()+'.tmp',wallpaperPath());
  return 'data:image/png;base64,'+png.toString('base64');
});
ipcMain.handle('appearance:theme', (_event, mode) => {
  const dark=['mint','night','purple','glass','wallpaper'].includes(mode);
  window?.setTitleBarOverlay({color:'#00000000',symbolColor:dark?'#f1f4fa':'#28352d',height:40});
});
service.on('changed', snapshot => {
  if (window && !window.isDestroyed()) window.webContents.send('devices:changed', snapshot);
  trayController?.update(snapshot);
});

const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
else {
app.on('second-instance', openMain);
app.whenReady().then(() => {
  loadKnownKeyboards(app.getPath('userData'));
  createWindow();
  trayController=require('./tray.cjs').createTray({snapshot:()=>service.snapshot(),openMain,quit:()=>app.quit()});
  service.start();
});
}
app.on('before-quit', () => {quitting=true;service.stop();trayController?.destroy();trayController=null});
app.on('window-all-closed', () => {if(!trayController)app.quit()});
