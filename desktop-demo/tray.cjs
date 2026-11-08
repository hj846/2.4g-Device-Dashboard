const path=require('node:path');
const {Tray,Menu,BrowserWindow,nativeImage,screen,ipcMain}=require('electron');
function popupBounds(anchor,area,height){
  const width=300;
  const x=Math.max(area.x,Math.min(area.x+area.width-width,Math.round(anchor.x+anchor.width/2-width/2)));
  let y=anchor.y-height-8;
  if(y<area.y)y=anchor.y+anchor.height+8;
  y=Math.max(area.y,Math.min(area.y+area.height-height,y));
  return {x:Math.round(x),y:Math.round(y),width,height};
}
function makeIcon(){
  const size=32,pixels=Buffer.alloc(size*size*4);
  for(let y=2;y<30;y++)for(let x=2;x<30;x++){
    if((x<6||x>25)&&(y<6||y>25))continue;
    const ink=y>=8&&y<=23&&((x>=8&&x<=11)||(x>=21&&x<=24)||Math.abs(x-(10+(y-8)*.8))<=1.7);
    const i=(y*size+x)*4;pixels[i]=ink?245:52;pixels[i+1]=ink?250:49;pixels[i+2]=ink?248:35;pixels[i+3]=255;
  }
  return nativeImage.createFromBitmap(pixels,{width:size,height:size,scaleFactor:1});
}
function createTray({snapshot,openMain,quit}){
  const tray=new Tray(makeIcon());
  const popup=new BrowserWindow({width:300,height:130,frame:false,transparent:true,backgroundColor:'#00000000',show:false,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,alwaysOnTop:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'tray-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  let ready=false;
  function layout(){
    const rows=snapshot().devices.filter(d=>d.connected===true).length;
    const anchor=tray.getBounds();
    popup.setBounds(popupBounds(anchor,screen.getDisplayMatching(anchor).workArea,Math.min(6,Math.max(1,rows))*48+78));
  }
  function update(data){
    const online=data.devices.filter(d=>d.connected===true);
    tray.setToolTip(('NEXUS'+(online.length?'\n'+online.slice(0,4).map(d=>`${d.model} · ${d.isWired?'有线':d.battery==null?'电量未知':d.battery+'%'}`).join('\n'):' · 暂无已连接设备')).slice(0,120));
    if(ready&&!popup.isDestroyed())popup.webContents.send('tray:snapshot',data);
    if(popup.isVisible())layout();
  }
  function open(){popup.hide();openMain()}
  ipcMain.handle('tray:snapshot',event=>event.sender===popup.webContents?snapshot():null);
  ipcMain.on('tray:open',event=>{if(event.sender===popup.webContents)open()});
  ipcMain.on('tray:quit',event=>{if(event.sender===popup.webContents)quit()});
  ipcMain.on('tray:hide',event=>{if(event.sender===popup.webContents)popup.hide()});
  popup.loadFile(path.join(__dirname,'tray.html'));
  popup.webContents.on('did-finish-load',()=>{ready=true;update(snapshot())});
  popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  popup.on('blur',()=>popup.hide());
  tray.on('click',()=>{if(popup.isVisible()){popup.hide();return}layout();update(snapshot());popup.show();popup.focus()});
  tray.on('double-click',open);
  const menu=Menu.buildFromTemplate([{label:'打开 NEXUS',click:open},{type:'separator'},{label:'退出',click:quit}]);
  tray.on('right-click',()=>{popup.hide();tray.popUpContextMenu(menu)});
  update(snapshot());
  return {update,destroy(){ipcMain.removeHandler('tray:snapshot');ipcMain.removeAllListeners('tray:open');ipcMain.removeAllListeners('tray:quit');ipcMain.removeAllListeners('tray:hide');popup.destroy();tray.destroy()}};
}
module.exports={createTray,popupBounds};
