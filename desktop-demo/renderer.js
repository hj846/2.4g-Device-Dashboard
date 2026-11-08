const icons = {
  XIAOMI: './assets/xiaomi.png',
  MORKBLADE: './assets/morkblade.ico',
  HYPERX: './assets/hyperx.svg',
  ATK: './assets/atk.ico',
  RAPOO: './assets/rapoo.svg',
  AULA: './assets/aula.ico',
  MCHOSE: './assets/mchose.png',
  LOGITECH: './assets/logitech.png',
  KEYCHRON: './assets/keychron.png',
  STEELSERIES: './assets/steelseries-hires.png',
  RAZER: './assets/razer.png'
};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let snapshot={devices:[],scanning:true},filter='on',selected=null;
let deviceColors={};
try{const saved=JSON.parse(localStorage.getItem('nexus.deviceColors')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))deviceColors=saved}catch{}
const colorKey=d=>JSON.stringify([d.brandKey,d.id,window.deviceArtwork.find(d)]);
const artworkKey=d=>JSON.stringify([d.brandKey||d.brand||'',d.model||'',d.kind||''].map(s=>String(s).trim().toLowerCase().replace(/\s+/g,' ')));
let customArtwork={},uploading=false;
const failedPictures=new Set();
function genericPicture(d){
 const kind=/键盘|keyboard/i.test(d.kind)?'keyboard':/音响|音箱|扬声器|speaker/i.test(d.kind)?'speaker':/耳机|耳麦|headset|headphone/i.test(d.kind)?'headset':'mouse';
 return {src:'assets/products/generic/'+kind+'.png',generic:true,note:'通用示意图 · 点击上传真实展示图'};
}
const colorNames={Black:'黑色',White:'白色',Blue:'蓝色',Lilac:'淡紫色',Mint:'薄荷绿',Magenta:'品红色',Fluorescent_Yellow:'炽光黄',Lava_Red:'熔岩红',Raspberry_Pink:'树莓粉',Flame_Orange:'焰影橙',Ice_Berry_Pink:'冰莓粉',Morning_Mist_Blue:'晨雾蓝',Metallic_Iridescent:'幻境蓝'};
function colorName(value){return colorNames[value]||colorNames[value[0]?.toUpperCase()+value.slice(1)]||value.replaceAll('_',' ')}
function picture(d){
 const custom=customArtwork[artworkKey(d)];
 if(custom&&!failedPictures.has(custom))return {src:custom,custom:true,note:'自定义展示图 · 点击更换'};
 const official=window.deviceArtwork.find(d);
 if(official&&!failedPictures.has(official)){
  const colors=window.deviceArtwork.colors(d);
  const choice=colors.find(c=>c.src===deviceColors[colorKey(d)])||colors.find(c=>c.src===official)||colors[0];
  if(failedPictures.has(choice?.src))return genericPicture(d);
  return {src:choice?.src||official,switchable:colors.length>1,note:(colors.length>1?colorName(choice.color)+' · ':'')+'点击图片上传展示图'};
 }
 if(/basilisk x hyperspeed/i.test(d.model)&&!failedPictures.has('assets/products/basilisk.png'))return {src:'assets/products/basilisk.png',note:''};
 return genericPicture(d);
}
// Preserve existing elements during live updates so animations and images do not restart.
function updateMarkup(container,html){
 const template=document.createElement('template');template.innerHTML=html;
 function patch(parent,next){
  for(let i=0;i<next.childNodes.length;i++){
   const incoming=next.childNodes[i],current=parent.childNodes[i];
   if(!current){parent.appendChild(incoming.cloneNode(true));continue}
   if(current.nodeType!==incoming.nodeType||current.nodeName!==incoming.nodeName){current.replaceWith(incoming.cloneNode(true));continue}
   if(current.nodeType===Node.TEXT_NODE){if(current.nodeValue!==incoming.nodeValue)current.nodeValue=incoming.nodeValue;continue}
   if(current.nodeType===Node.ELEMENT_NODE){
    for(const attr of Array.from(current.attributes))if(!incoming.hasAttribute(attr.name))current.removeAttribute(attr.name);
    for(const attr of incoming.attributes)if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
    patch(current,incoming);
   }
  }
  while(parent.childNodes.length>next.childNodes.length)parent.lastChild.remove();
 }
 patch(container,template.content);
}
let renderedDevice=null;
const listed=()=>snapshot.devices.filter(d=>(d.connected===true)===(filter==='on'));
function render(){
 const ds=listed();if(!ds.some(d=>d.id===selected))selected=ds[0]?.id;
 const index=ds.findIndex(d=>d.id===selected),d=ds[index];
 const previousFocus=document.activeElement?.dataset.device;
 const scroll=$('strip').scrollLeft;
 if(d){
 const pic=picture(d),sig=Number.isInteger(d.signal)?['无信号','很弱','偏弱','良好','强'][d.signal]:'未知';
 const heroMarkup='<div class="info '+(d.connected?'':'offline')+'"><div class="identity">'+(icons[d.brandKey]?'<img class="brand-logo" src="'+icons[d.brandKey]+'" alt="">':'')+'<div><p class="brand">'+esc(d.brand)+'</p><h2>'+esc(d.model)+'</h2><p class="kind">'+esc(d.kind)+'</p><div class="status"><i class="dot"></i>'+esc(d.status||'状态待确认')+'</div></div></div><div class="metrics">'+(d.isWired?'':'<div class="metric"><small>电量</small><strong>'+(d.battery==null?'未知':'<span class="battery" style="--level:'+Number(d.battery)+'%"><i></i></span>'+Number(d.battery)+'%')+'</strong></div>')+'<div class="metric"><small>连接方式</small><strong>'+esc(d.connection)+'</strong></div>'+(d.isWired?'':'<div class="metric"><small>信号</small><strong>'+esc(sig)+'</strong></div>')+'</div><p class="updated">最近同步 · '+esc(d.updated||'刚刚')+'</p></div><div class="visual '+(pic.custom?'custom-visual ':'')+(d.brandKey==='LOGITECH'?'logitech-visual ':d.brandKey==='MORKBLADE'?'morkblade-visual ':'')+(!pic.generic&&!pic.custom&&/official|basilisk/.test(pic.src)?(/键盘|keyboard/i.test(d.kind)?'keyboard-stage':/耳机|headset/i.test(d.kind)?'headset-stage':'mouse-stage'):'')+'">'+'<button class="product-switch" type="button" aria-label="'+esc(pic.note)+'" title="'+esc(pic.note)+'">'+'<img class="product" src="'+esc(pic.src)+'" alt="'+esc(d.model)+'">'+'</button>'+(pic.switchable?'<button class="color-switch" type="button">切换配色</button>':'')+'<span class="visual-note">'+esc(pic.note)+'</span></div>';
 if(renderedDevice===d.id)updateMarkup($('hero'),heroMarkup);else $('hero').innerHTML=heroMarkup;
 renderedDevice=d.id;
 }else {renderedDevice=null;updateMarkup($('hero'),'<div class="empty">'+(snapshot.scanning?'正在识别设备…':'当前筛选下没有设备')+'</div>');}
 updateMarkup($('strip'),ds.map(x=>'<button class="tile" data-device="'+esc(x.id)+'" aria-pressed="'+(x.id===selected)+'"><img class="thumb" src="'+picture(x).src+'" alt=""><div><small>'+esc(x.brand)+'</small><b title="'+esc(x.model)+'">'+esc(x.model)+'</b><span class="tile-power">'+(x.isWired?'有线连接':'<span class="battery" aria-hidden="true" style="--level:'+(x.battery==null?0:Math.max(0,Math.min(100,Number(x.battery))))+'%"><i></i></span>'+(x.battery==null?'电量未知':Number(x.battery)+'%'))+'</span></div></button>').join(''));
 $('strip').scrollLeft=scroll;
 $('strip').querySelectorAll('button').forEach(b=>{b.onclick=()=>select(b.dataset.device);if(b.dataset.device===previousFocus)b.focus({preventScroll:true})});
 document.querySelectorAll('.product,.thumb').forEach(img=>{img.onerror=()=>{const source=img.getAttribute('src');if(source.includes('/generic/'))return;failedPictures.add(source);render()}});
 $('prev').disabled=index<=0;$('next').disabled=index<0||index>=ds.length-1;
 $('position').textContent=(index<0?'00':String(index+1).padStart(2,'0'))+' / '+String(ds.length).padStart(2,'0');
 $('scanStatus').textContent=snapshot.error||(snapshot.scanning?'正在更新设备状态…':'本机设备 · 状态随设备上报更新');
}
function select(id){selected=id;render();$('strip').querySelector('[aria-pressed=true]')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})}
function cycleColor(){
 const d=listed().find(d=>d.id===selected);if(!d)return;
 const colors=window.deviceArtwork.colors(d);if(colors.length<2)return;
 const i=colors.findIndex(c=>c.src===picture(d).src);
 deviceColors[colorKey(d)]=colors[(i+1)%colors.length].src;
 try{localStorage.setItem('nexus.deviceColors',JSON.stringify(deviceColors))}catch{}
 render();
}
async function uploadArtwork(){
 const d=listed().find(d=>d.id===selected);if(!d||uploading)return;
 uploading=true;
 try{const result=await window.deviceAPI.chooseArtwork(d.id);if(result){customArtwork[result.key]=result.src;failedPictures.delete(result.src);render()}}
 catch(error){$('scanStatus').textContent='展示图上传失败：'+error.message}
 finally{uploading=false}
}
$('hero').addEventListener('click',e=>{if(e.target.closest('.color-switch'))cycleColor();else if(e.target.closest('.product-switch'))uploadArtwork()});
function move(step){const ds=listed(),i=ds.findIndex(d=>d.id===selected);if(ds[i+step])select(ds[i+step].id)}
$('prev').onclick=()=>move(-1);$('next').onclick=()=>move(1);
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',x===b));render()});
$('settings').onclick=()=>$('preferences').showModal();
document.addEventListener('keydown',e=>{if($('preferences').open)return;if(e.key==='ArrowRight'){e.preventDefault();move(1)}if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}});
window.deviceAPI.onChanged(next=>{snapshot=next;render()});
window.deviceAPI.snapshot().then(next=>{snapshot=next;render()}).catch(()=>{$('scanStatus').textContent='设备读取失败，请重新启动应用'});
render();
window.deviceAPI.artwork?.().then(saved=>{customArtwork={...saved,...customArtwork};render()}).catch(()=>{});
