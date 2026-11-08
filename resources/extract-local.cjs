// Read-only extraction from installed drivers. Never executes their bundled code.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = __dirname;
const entries = [], unique = new Map();
function save(brand, model, relative, source, data) {
  data ||= fs.readFileSync(source);
  const png = data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const webp = data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (!png && !webp) throw new Error('Invalid image: ' + source);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const file = brand + '/' + relative;
  const dest = path.join(root, file);
  if (!dest.startsWith(root + path.sep)) throw new Error('Invalid destination');
  fs.mkdirSync(path.dirname(dest), {recursive:true});
  if (!fs.existsSync(dest)) {
    if (unique.has(sha256)) fs.linkSync(unique.get(sha256), dest);
    else fs.writeFileSync(dest, data);
  }
  if (!fs.readFileSync(dest).equals(data)) throw new Error('Existing file differs: ' + dest);
  unique.set(sha256, dest);
  entries.push({brand, model, file, source, sha256, bytes:data.length,
    ...(png ? {width:data.readUInt32BE(16), height:data.readUInt32BE(20)} : {})});
}
const rapoo = 'D:/AHUB/RAPOO AHUB 2.0/resources/web/assets';
const bundle = rapoo + '/js/index-B1AV7SwT.js';
const js = fs.readFileSync(bundle, 'utf8');
const vars = new Map([...js.matchAll(/([\w$]+)=""\+new URL\("\.\.\/images\/([^"\n]+)",import.meta.url\).href/g)].map(m=>[m[1],m[2]]));
for (const m of js.matchAll(/"\.\.\/assets\/images\/manifests\/([^"\n]+\/(?:func_|thumb_)[^"\n]+\.png)":([\w$]+)/g)) {
  const model = m[1].split('/')[0], file = vars.get(m[2]);
  if (file) save('rapoo', model, m[1], rapoo + '/images/' + file);
  else {
    const escaped = m[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inline = js.match(new RegExp(escaped + '="data:image/png;base64,([^"\\s]+)"'));
    if (!inline) throw new Error('Unresolved Rapoo image: ' + m[1]);
    save('rapoo', model, m[1], bundle + '#' + m[2], Buffer.from(inline[1], 'base64'));
  }
}
const logi = 'C:/ProgramData/LGHUB/depots/554622/core_assets/thumbnails';
for (const file of fs.readdirSync(logi).sort()) {
  if (/\.(png|webp)$/i.test(file) && !/^[a-f0-9]{8}-/i.test(file))
    save('logitech', path.parse(file).name, file, logi + '/' + file);
}
save('aula', 'F75', 'F75/keyimg.png', 'C:/Program Files (x86)/AULA/F75/Dev/kb/1/keyimg.png');
// Preserve resources imported later from other manufacturers.
const previousManifest=fs.existsSync(path.join(root,'manifest.json'))?JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')):{entries:[]};
entries.push(...previousManifest.entries.filter(e=>!['rapoo','logitech','aula'].includes(e.brand)));
const manifest = {generatedAt:new Date().toISOString(), entries,
  unavailable:[{brand:'razer',reason:'Only installer remnants and app icons found in local Razer installation directories; no device product images found.'}]};
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
const escape = s => s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fs.writeFileSync(path.join(root,'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>驱动原始设备图库</title><style>body{font:15px system-ui;background:#e8eaf0;color:#17202b;margin:32px}input{padding:12px;width:320px;border:1px solid #aaa;border-radius:12px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:24px}figure{margin:0;background:#fff8;padding:18px;border-radius:16px}img{width:100%;height:190px;object-fit:contain}figcaption{overflow-wrap:anywhere}small{color:#586778}a{color:inherit}</style><h1>驱动原始设备图库</h1><p>罗技 / 雷柏 / 狼蛛 · ${entries.length} 张图片 · 保留原图与透明通道</p><p>雷蛇：本机已扫描目录未找到设备图片；不使用其他型号替代。</p><input placeholder="搜索品牌、型号、配色" aria-label="搜索图片"><main>${entries.map(e=>`<figure data-search="${escape((e.brand+' '+e.model+' '+e.file).toLowerCase())}"><a href="${e.file.split('/').map(encodeURIComponent).join('/')}"><img loading="lazy" src="${e.file.split('/').map(encodeURIComponent).join('/')}" alt="${escape(e.model)}"></a><figcaption>${escape(e.brand+' · '+e.model)}<br><small>${escape(path.basename(e.file))}${e.width?' · '+e.width+' × '+e.height:''}</small></figcaption></figure>`).join('')}</main><script>document.querySelector('input').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('figure').forEach(f=>f.hidden=!f.dataset.search.includes(q))}</script></html>`);
console.log(JSON.stringify({images:entries.length,uniqueImages:unique.size,brands:entries.reduce((r,e)=>(r[e.brand]=(r[e.brand]||0)+1,r),{}),rapooModels:new Set(entries.filter(e=>e.brand==='rapoo').map(e=>e.model)).size},null,2));
