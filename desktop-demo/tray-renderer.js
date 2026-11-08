const shapes={keyboard:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h1m3 0h1m3 0h1m3 0h1M5 12h1m3 0h1m3 0h1m3 0h1M6 16h12"/>',mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M7 10h10"/>',headset:'<path d="M4 14V10a8 8 0 0 1 16 0v4M4 12H2v8h4v-8zm16 0h2v8h-4v-8z"/>',device:'<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M10 18h4"/>'};
function renderTray(snapshot){
 const box=document.getElementById('devices');
 const rows=(snapshot?.devices||[]).filter(d=>d.connected===true);
 box.replaceChildren();
 if(!rows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=snapshot?.scanning?'正在识别设备…':'暂无已连接设备';box.append(empty);return}
 for(const d of rows){
  const row=document.createElement('div');row.className='device';
  const type=/键盘|keyboard/i.test(d.kind)?'keyboard':/鼠标|mouse/i.test(d.kind)?'mouse':/耳机|headset/i.test(d.kind)?'headset':'device';
  const icon=document.createElement('span');icon.className='kind';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24">'+shapes[type]+'</svg>';
  const name=document.createElement('span');name.className='name';name.textContent=d.model;name.title=d.model;
  const power=document.createElement('span');power.className='power';
  const valid=Number.isFinite(d.battery)&&d.battery>=0&&d.battery<=100;
  if(!d.isWired&&valid){
   const battery=document.createElement('span');battery.className='battery';battery.style.setProperty('--level',d.battery+'%');battery.append(document.createElement('i'));power.append(battery);
   if(d.charging)power.classList.add('charging');else if(d.battery<25)power.classList.add('low');
  }
  power.append(document.createTextNode(d.isWired?'有线':valid?d.battery+'%':'未知'));
  power.title=d.isWired?'USB 有线，无需电池':d.charging?'充电中':valid?'电量 '+d.battery+'%':'尚未取得电量';
  row.append(icon,name,power);box.append(row);
 }
}
document.getElementById('open').onclick=()=>window.trayAPI.open();
document.getElementById('quit').onclick=()=>window.trayAPI.quit();
window.trayAPI.onChanged(renderTray);
window.trayAPI.snapshot().then(renderTray).catch(()=>renderTray(null));
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.trayAPI.hide()});
