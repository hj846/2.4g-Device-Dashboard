const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('trayAPI',{
 snapshot:()=>ipcRenderer.invoke('tray:snapshot'),
 onChanged:callback=>{ipcRenderer.on('tray:snapshot',(_event,data)=>callback(data))},
 open:()=>ipcRenderer.send('tray:open'),quit:()=>ipcRenderer.send('tray:quit'),hide:()=>ipcRenderer.send('tray:hide')
});
