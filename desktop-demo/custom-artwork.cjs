const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
function artworkKey(d){return JSON.stringify([d.brandKey||d.brand||'',d.model||'',d.kind||''].map(s=>String(s).trim().toLowerCase().replace(/\s+/g,' ')))}
function createArtworkStore(directory,nativeImage){
 async function readAll(){
  const result={};
  for(const file of await fs.readdir(directory).catch(()=>[])){
   if(!/^[a-f0-9]{64}\.json$/.test(file))continue;
   try{const data=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));if(typeof data.key==='string'&&typeof data.src==='string'&&data.src.startsWith('data:image/png;base64,'))result[data.key]=data.src}catch{}
  }
  return result;
 }
 async function save(device,file){
  if((await fs.stat(file)).size>32*1024*1024)throw Error('请选择小于 32 MB 的图片');
  let image=nativeImage.createFromBuffer(await fs.readFile(file));
  if(image.isEmpty())throw Error('无法读取图片，请选择 PNG、JPG 或 WebP 图片');
  const {width,height}=image.getSize();
  if(Math.max(width,height)>1600)image=image.resize(width>=height?{width:1600}:{height:1600});
  const key=artworkKey(device),data={key,src:'data:image/png;base64,'+image.toPNG().toString('base64')};
  await fs.mkdir(directory,{recursive:true});
  const target=path.join(directory,createHash('sha256').update(key).digest('hex')+'.json'),temp=target+'.'+randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(data));await fs.rename(temp,target)}finally{await fs.rm(temp,{force:true})}
  return data;
 }
 return {readAll,save};
}
module.exports={createArtworkStore,artworkKey};
