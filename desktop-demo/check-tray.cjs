const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createTray,popupBounds}=require('./tray.cjs');
app.whenReady().then(async()=>{
 let controller;
 try {
  for(const area of [{x:0,y:0,width:1920,height:1040},{x:-1920,y:-200,width:1920,height:1040}]){
   for(const anchor of [{x:area.x,y:area.y,width:24,height:24},{x:area.x+area.width-24,y:area.y+area.height,width:24,height:24}]){
    const b=popupBounds(anchor,area,366);
    assert(b.x>=area.x&&b.x+b.width<=area.x+area.width);
    assert(b.y>=area.y&&b.y+b.height<=area.y+area.height);
   }
  }
  let data={devices:[{model:'K87 V3',kind:'键盘',connected:true,battery:74}]};
  let opened=0,quit=0;
  controller=createTray({snapshot:()=>data,openMain:()=>opened++,quit:()=>quit++});
  const w=BrowserWindow.getAllWindows()[0];
  await new Promise(resolve=>w.webContents.once('did-finish-load',resolve));
  const js=s=>w.webContents.executeJavaScript(s);
  await new Promise(r=>setTimeout(r,200));
  assert.equal(await js("document.querySelector('.power').textContent"),'74%');
  w.setSize(300,126);
  fs.writeFileSync(path.join(__dirname,'../resources/ui-tray-preview.png'),(await w.webContents.capturePage()).toPNG());
  data={devices:[{model:'Wired',connected:true,isWired:true,battery:99},{model:'Unknown',connected:true},{model:'Offline',connected:false,battery:88}]};
  controller.update(data);
  await new Promise(r=>setTimeout(r,100));
  assert.deepEqual(await js("Array.from(document.querySelectorAll('.power'),e=>e.textContent)"),['有线','未知']);
  await js("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await js("document.getElementById('open').click();document.getElementById('quit').click()");
  await new Promise(r=>setTimeout(r,100));
  assert(!w.isDestroyed());assert.equal(opened,1);assert.equal(quit,1);
  data={devices:[]};controller.update(data);
  await new Promise(r=>setTimeout(r,100));
  assert.equal(await js("document.querySelector('.empty').textContent"),'暂无已连接设备');
  console.log('Tray checks passed: rendering, empty/wired/unknown/offline states, IPC, Escape, multi-monitor bounds.');
 }catch(error){console.error(error);process.exitCode=1}
 finally{controller?.destroy();app.quit()}
});
