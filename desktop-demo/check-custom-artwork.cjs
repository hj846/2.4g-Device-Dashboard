const {app,BrowserWindow,ipcMain,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createArtworkStore,artworkKey}=require('./custom-artwork.cjs');
app.whenReady().then(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nexus-artwork-'));
 try{
  const store=createArtworkStore(dir,nativeImage);
  const devices=['鼠标','键盘','耳机','音响'].map((kind,i)=>({id:String(i),brandKey:'TEST',brand:'Test',model:'Unknown '+i,kind,connected:true,battery:74,connection:'蓝牙'}));
  let cancel=false,delayed=false,release;
  ipcMain.handle('artwork:list',()=>store.readAll());
  ipcMain.handle('artwork:choose',async(_,id)=>{if(cancel)return null;if(delayed)await new Promise(r=>release=r);return store.save(devices.find(d=>d.id===id),path.join(__dirname,'assets/products/generic/keyboard.png'))});
  ipcMain.handle('devices:snapshot',()=>({devices}));
  ipcMain.handle('appearance:wallpaper',()=>null);ipcMain.handle('appearance:theme',()=>{});
  const w=new BrowserWindow({show:false,width:1200,height:800,webPreferences:{offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs')}});
  const js=s=>w.webContents.executeJavaScript(s),settle=()=>new Promise(r=>setTimeout(r,250));
  await w.loadFile(path.join(__dirname,'index.html'));await settle();
  assert.deepEqual(await js("Array.from(document.querySelectorAll('.thumb'),i=>i.getAttribute('src'))"),['mouse','keyboard','headset','speaker'].map(k=>'assets/products/generic/'+k+'.png'));
  assert(await js('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)'));
  await w.webContents.insertCSS('*{animation:none!important;transition:none!important}');await settle();
  await fs.writeFile(path.join(__dirname,'../resources/ui-generic-preview.png'),(await w.webContents.capturePage()).toPNG());
  cancel=true;await js("document.querySelector('.product-switch').click()");await settle();
  assert.deepEqual(await store.readAll(),{});
  cancel=false;delayed=true;await js("document.querySelector('.product-switch').click()");await settle();
  await js("document.getElementById('next').click()");release();await settle();
  assert((await js("document.querySelector('.product').getAttribute('src')")).includes('/generic/keyboard.png'));
  await js("document.getElementById('prev').click()");await settle();
  const source=await js("document.querySelector('.product').getAttribute('src')");assert(source.startsWith('data:image/png;base64,'));
  assert.equal(await js("document.querySelector('.tile[aria-pressed=true] img').getAttribute('src')"),source);
  await w.loadFile(path.join(__dirname,'index.html'));await settle();
  assert.equal(await js("document.querySelector('.product').getAttribute('src')"),source);
  assert.equal((await createArtworkStore(dir,nativeImage).readAll())[artworkKey({...devices[0],id:'new-usb-path'})],source);
  const invalid=path.join(dir,'bad.png');await fs.writeFile(invalid,'not an image');await assert.rejects(store.save(devices[0],invalid));
  assert.equal((await store.readAll())[artworkKey(devices[0])],source);
  console.log('Artwork checks passed: four categories, image decoding, cancel, upload, device switch race, thumbnails, reload persistence and invalid-image preservation.');
  w.destroy();
 }finally{await fs.rm(dir,{recursive:true,force:true})}
 app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
