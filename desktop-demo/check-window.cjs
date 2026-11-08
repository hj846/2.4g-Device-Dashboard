const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
app.whenReady().then(async()=>{
 const w=new BrowserWindow({width:1225,height:768,resizable:false,maximizable:true,show:false,titleBarStyle:'hidden',titleBarOverlay:true});
 w.setMaximizable(true);
 assert.equal(w.isResizable(),false);assert.equal(w.isMaximizable(),true);
 const normal=w.getBounds();
 w.maximize();await new Promise(r=>setTimeout(r,300));
 assert.equal(w.isMaximized(),true);
 w.unmaximize();await new Promise(r=>setTimeout(r,300));
 assert.equal(w.isMaximized(),false);
 assert.equal(w.getBounds().width,normal.width);assert.equal(w.getBounds().height,normal.height);
 w.destroy();console.log('Fixed-size window: maximization and restore passed');app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
