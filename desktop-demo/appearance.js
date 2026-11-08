let wallpaperData=null;
function theme(t){
 const radio=Array.from(document.querySelectorAll('[name=theme]')).find(r=>r.value===t);
 if(!radio)return;
 radio.checked=true;document.body.dataset.theme=t;
 window.deviceAPI.appearanceTheme(t).catch(()=>{});
 try{localStorage.setItem('nexus.background',t==='purple'?'aurora':t)}catch{}
}
function setWallpaper(data){
 wallpaperData=data;
 document.querySelector('.wallpaper').style.backgroundImage=data?'url("'+data+'")':'none';
 document.getElementById('wallpaperStatus').textContent=data?'已保存壁纸，可随时切换回渐变背景。':'尚未选择壁纸';
}
async function chooseWallpaper(){
 const button=document.getElementById('chooseWallpaper');button.disabled=true;
 try{const data=await window.deviceAPI.chooseWallpaper();if(data){setWallpaper(data);theme('wallpaper')}}
 catch{document.getElementById('wallpaperStatus').textContent='图片读取失败，请选择小于 32 MB 的 PNG、JPG 或 WebP 图片。'}
 finally{button.disabled=false}
}
let savedTheme='mint';
try{const saved=localStorage.getItem('nexus.background');savedTheme=saved==='aurora'?'purple':saved||'mint'}catch{}
theme(savedTheme);
window.deviceAPI.wallpaper().then(data=>{setWallpaper(data);if(document.body.dataset.theme==='wallpaper'&&!data)theme('mint')}).catch(()=>{if(document.body.dataset.theme==='wallpaper')theme('mint')});
document.getElementById('chooseWallpaper').onclick=chooseWallpaper;
document.getElementById('preferences').onchange=e=>{
 if(e.target.name!=='theme')return;
 if(e.target.value==='wallpaper'&&!wallpaperData){theme(document.body.dataset.theme||'mint');chooseWallpaper();return}
 theme(e.target.value);
};
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('paused',document.hidden));
