const {app,nativeImage}=require('electron');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
app.whenReady().then(async()=>{
 const dir=fs.mkdtempSync('D:/NEXUS-build/wallpaper-check-');
 const handlers=new Map();let canceled=false;
 const fakeApp={getPath:()=>dir,requestSingleInstanceLock:()=>false,quit(){},on(){}};
 class Service{on(){}stop(){}}
 const dialog={showOpenDialog:async()=>({canceled,filePaths:[path.join(__dirname,'assets/products/official/mchose/K87 V3/White.png')]})};
 const load=name=>name==='electron'?{app:fakeApp,ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},dialog,nativeImage}:name==='./windows-device-service.cjs'?{WindowsDeviceService:Service}:name==='./hid-devices.cjs'?{loadKnownKeyboards(){}}:require(name);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),{require:load,__dirname,console});
 assert.equal(await handlers.get('appearance:wallpaper')(),null);
 const result=await handlers.get('appearance:choose-wallpaper')();
 assert(result.startsWith('data:image/png;base64,'));
 assert.equal(await handlers.get('appearance:wallpaper')(),result);
 canceled=true;assert.equal(await handlers.get('appearance:choose-wallpaper')(),null);
 assert.equal(await handlers.get('appearance:wallpaper')(),result);
 console.log('Native wallpaper decoding, saved copy and cancellation passed');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
