const {app,BrowserWindow,ipcMain}=require('electron'),assert=require('node:assert/strict'),path=require('path');
app.whenReady().then(async()=>{
let wallpaper=null;
ipcMain.handle('artwork:list',()=>({}));
ipcMain.handle('appearance:theme',()=>{});
ipcMain.handle('appearance:wallpaper',()=>wallpaper);
ipcMain.handle('appearance:choose-wallpaper',()=>{wallpaper='data:image/png;base64,'+require('fs').readFileSync(path.join(__dirname,'assets/products/official/mchose/K87 V3/White.png')).toString('base64');return wallpaper});
ipcMain.handle('devices:snapshot',()=>({devices:[{id:'a',model:'MCHOSE K87 V3',brand:'MCHOSE',brandKey:'MCHOSE',kind:'键盘',battery:76,connection:'2.4G 接收器',connected:true},{id:'b',model:'Basilisk X HyperSpeed',brandKey:'RAZER',brand:'Razer',kind:'鼠标',connected:true,battery:94,connection:'2.4G 接收器'}, {id:'c',model:'雷柏 VT3S V2',brandKey:'RAPOO',brand:'Rapoo',kind:'鼠标',connected:true,battery:85,connection:'2.4G 接收器'}, {id:'d',model:'狼蛛 F75',brandKey:'AULA',brand:'AULA',kind:'键盘',connected:true,battery:76,connection:'2.4G 接收器'}, {id:'e',model:'G Pro X Superlight',brandKey:'LOGITECH',brand:'Logitech',kind:'鼠标',connected:true,battery:82,connection:'2.4G 接收器'}]}));
const w=new BrowserWindow({show:false,width:1050,height:760,webPreferences:{partition:"artwork-colors-test",offscreen:true,backgroundThrottling:false,preload:path.join(__dirname,'preload.cjs')}});
await w.loadFile(path.join(__dirname,'index.html'));
await new Promise(r=>setTimeout(r,600));
assert(await w.webContents.executeJavaScript('Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)'));
assert(await w.webContents.executeJavaScript('document.documentElement.scrollHeight<=innerHeight'));
for(let i=0;i<6;i++){
 await w.webContents.executeJavaScript("document.querySelector('.color-switch').click()");
 await new Promise(r=>setTimeout(r,80));
 assert(await w.webContents.executeJavaScript("document.querySelector('.product').naturalWidth>0 && document.querySelector('.product').src.includes('/mchose/')"));
}
await w.webContents.executeJavaScript("document.getElementById('next').click()");
assert.equal(await w.webContents.executeJavaScript("document.querySelector('h2').textContent"),'Basilisk X HyperSpeed');
for (const name of ['雷柏 VT3S V2','狼蛛 F75','G Pro X Superlight']) {
 await w.webContents.executeJavaScript("document.getElementById('next').click()");
 await new Promise(r=>setTimeout(r,250));
 assert.equal(await w.webContents.executeJavaScript("document.querySelector('h2').textContent"),name);
 assert(await w.webContents.executeJavaScript("document.querySelector('.product').src.includes('/official/') && document.querySelector('.product').naturalWidth>0"));
 assert(await w.webContents.executeJavaScript('document.documentElement.scrollHeight<=innerHeight'));
}
const originalColor=await w.webContents.executeJavaScript("document.querySelector('.product').src");
await w.webContents.executeJavaScript("document.querySelector('.color-switch').click()");
const selectedColor=await w.webContents.executeJavaScript("document.querySelector('.product').src");
assert.notEqual(selectedColor,originalColor);
assert.equal(await w.webContents.executeJavaScript("document.querySelector('.tile[aria-pressed=true] img').src"),selectedColor);
await w.webContents.executeJavaScript("window.savedNodes={info:document.querySelector('.info'),product:document.querySelector('.product'),status:document.querySelector('.status')}");
for(const battery of [81,80,80]){
 w.webContents.send('devices:changed',{devices:[{id:'e',model:'G Pro X Superlight',brandKey:'LOGITECH',brand:'Logitech',kind:'鼠标',connected:true,battery,connection:'2.4G 接收器',status:'已连接'}]});
 await new Promise(r=>setTimeout(r,80));
 assert(await w.webContents.executeJavaScript("savedNodes.info===document.querySelector('.info') && savedNodes.product===document.querySelector('.product') && savedNodes.status===document.querySelector('.status')"));
 assert(await w.webContents.executeJavaScript("document.querySelector('.metrics').textContent.includes('"+battery+"%')"));
}
assert.equal(await w.webContents.executeJavaScript("document.querySelector('.product').src"),selectedColor);
await w.loadFile(path.join(__dirname,'index.html'));
await new Promise(r=>setTimeout(r,400));
await w.webContents.executeJavaScript("document.querySelector('[data-device=b]').click()");
assert.equal(await w.webContents.executeJavaScript("document.querySelector('.color-switch')===null"),true);
await w.webContents.executeJavaScript("document.querySelector('[data-device=e]').click()");
assert.equal(await w.webContents.executeJavaScript("document.querySelector('.product').src"),selectedColor);
console.log('Color selection persists across updates and reload; single-image devices are not switchable');
console.log('Live updates preserve info, image and status elements');
await w.webContents.insertCSS('*{animation:none!important;transition:none!important}');
await new Promise(r=>setTimeout(r,500));
require('fs').writeFileSync(path.join(__dirname,'../resources/ui-official-preview.png'),(await w.webContents.capturePage()).toPNG());
await w.webContents.executeJavaScript("theme('glass')");
await new Promise(r=>setTimeout(r,300));
assert(await w.webContents.executeJavaScript("getComputedStyle(document.querySelector('.glass-orbit')).display!=='none'"));
require('fs').writeFileSync(path.join(__dirname,'../resources/ui-glass-preview.png'),(await w.webContents.capturePage()).toPNG());
await w.webContents.executeJavaScript("chooseWallpaper()");
assert(await w.webContents.executeJavaScript("document.body.dataset.theme==='wallpaper' && getComputedStyle(document.querySelector('.wallpaper')).backgroundImage.includes('data:image/png')"));
await w.loadFile(path.join(__dirname,'index.html'));
await new Promise(r=>setTimeout(r,500));
assert(await w.webContents.executeJavaScript("document.body.dataset.theme==='wallpaper' && getComputedStyle(document.querySelector('.wallpaper')).backgroundImage.includes('data:image/png')"));
await w.webContents.executeJavaScript("theme('glass');document.getElementById('settings').click()");
await new Promise(r=>setTimeout(r,300));
require('fs').writeFileSync(path.join(__dirname,'../resources/ui-settings-preview.png'),(await w.webContents.capturePage()).toPNG());
await w.webContents.executeJavaScript("document.getElementById('preferences').close()");
w.webContents.send('devices:changed',{devices:[{id:'nova5',model:'Arctis Nova 5 Wireless',brand:'SteelSeries',brandKey:'STEELSERIES',kind:'耳机',connected:true,battery:69,connection:'2.4G 接收器',status:'已连接'},{id:'bold',model:'Bold TKL HE',brand:'墨刃 MorkBlade',brandKey:'MORKBLADE',kind:'键盘',connected:true,isWired:true,battery:null,connection:'USB 有线',status:'已连接'}]});
await new Promise(r=>setTimeout(r,400));
assert(await w.webContents.executeJavaScript("document.querySelector('.product').src.includes('/steelseries/') && document.querySelector('.product').naturalWidth>0 && document.querySelector('.metrics').textContent.includes('69%')"));
require('fs').writeFileSync(path.join(__dirname,'../resources/ui-nova5-preview.png'),(await w.webContents.capturePage()).toPNG());
await w.webContents.executeJavaScript("document.getElementById('next').click()");
await new Promise(r=>setTimeout(r,400));
assert(await w.webContents.executeJavaScript("document.querySelector('.product').src.includes('/morkblade/') && document.querySelector('.product').naturalWidth>0 && document.querySelectorAll('.metric').length===1 && document.querySelector('.metric').textContent.includes('USB 有线')"));
assert(await w.webContents.executeJavaScript("Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0)"));
require('fs').writeFileSync(path.join(__dirname,'../resources/ui-bold-preview.png'),(await w.webContents.capturePage()).toPNG());
console.log('Nova 5 and Bold TKL artwork, logos and wired metrics passed (simulated devices)');
console.log('Glass theme, wallpaper selection and persistence passed');
await w.webContents.executeJavaScript("document.getElementById('prev').click()");
for(const palette of ['mint','night','purple']){
 await w.webContents.executeJavaScript(`theme('${palette}')`);
 await new Promise(r=>setTimeout(r,150));
 assert(await w.webContents.executeJavaScript("getComputedStyle(document.querySelector('.glass-orbit')).display==='block' && getComputedStyle(document.querySelector('.glass-ribbon')).display==='block' && getComputedStyle(document.querySelector('.ambient'),'::before').display==='none'"));
 require('fs').writeFileSync(path.join(__dirname,'../resources/ui-'+palette+'-glass-preview.png'),(await w.webContents.capturePage()).toPNG());
}
console.log('UI official images, viewport and selection passed');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
