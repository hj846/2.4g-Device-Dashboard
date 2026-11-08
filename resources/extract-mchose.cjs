// Extract complete product PNGs from the local M HUB Chromium cache, without running driver code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cache=path.join(process.env.APPDATA,'MCHOSEHUB/Cache/Cache_Data');
const index=fs.readFileSync(path.join(cache,'data_1'));
const colors={Black:'黑色',White:'白色',WhiteBlue:'白蓝色',Blue:'蓝色',PinkPeach:'蜜桃粉',Green:'绿色'};
const found=new Map();
// This installed version uses Chromium's block-file cache: 8192-byte header, 256-byte entries.
for(let offset=8192;offset+256<=index.length;offset+=256){
  const keyLength=index.readUInt32LE(offset+32);
  if(keyLength<1||keyLength>1024||offset+96+keyLength>index.length)continue;
  const key=index.subarray(offset+96,offset+96+keyLength).toString();
  const match=key.match(/https:\/\/cdn\.mchose\.com\.cn\/configCenter\/static\/images\/K87V3(WhiteBlue|White|Black|Blue|PinkPeach|Green)Full_[a-z0-9]+\.png/);
  if(!match)continue;
  const size=index.readUInt32LE(offset+44),address=index.readUInt32LE(offset+60);
  // Only standalone body files are accepted. Ignore partial or unsupported cache records.
  if((address>>>28)!==8)continue;
  const source=path.join(cache,'f_'+(address&0x0fffffff).toString(16).padStart(6,'0'));
  const data=fs.readFileSync(source);
  if(data.length!==size||!data.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('Invalid cached PNG: '+source);
  const file='mchose/K87 V3/'+match[1]+'.png';
  const dest=path.join(__dirname,file);
  fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data);
  found.set(file,{brand:'mchose',model:'K87 V3',color:colors[match[1]],file,source,sourceUrl:match[0],sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length,width:data.readUInt32BE(16),height:data.readUInt32BE(20)});
}
if(found.size!==6)throw Error('Expected six complete K87 V3 color images; found '+found.size);
const manifestPath=path.join(__dirname,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
manifest.entries=manifest.entries.filter(e=>!found.has(e.file)).concat([...found.values()]);
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
const htmlPath=path.join(__dirname,'index.html');let html=fs.readFileSync(htmlPath,'utf8');
html=html.replace(/<!-- mchose:start -->[\s\S]*?<!-- mchose:end -->/,'');
const cards=[...found.values()].map(e=>`<figure data-search="mchose 迈从 k87 v3 ${e.color}"><a href="${e.file.split('/').map(encodeURIComponent).join('/')}"><img loading="lazy" src="${e.file.split('/').map(encodeURIComponent).join('/')}" alt="K87 V3 ${e.color}"></a><figcaption>MCHOSE · K87 V3 · ${e.color}<br><small>${e.width} × ${e.height}</small></figcaption></figure>`).join('');
html=html.replace('</main>','<!-- mchose:start -->'+cards+'<!-- mchose:end --></main>').replace(/罗技 \/ 雷柏 \/ 狼蛛(?: \/ 迈从)? · \d+ 张图片/,'罗技 / 雷柏 / 狼蛛 / 迈从 · '+manifest.entries.length+' 张图片');
fs.writeFileSync(htmlPath,html);console.log('Extracted MCHOSE K87 V3:',found.size,'original color images');
