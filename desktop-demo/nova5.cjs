// Protocol facts: Sapd/HeadsetControl, steelseries_arctis_nova_5.hpp and steelseries_protocol.hpp.
// Only the status getter is used; no audio, lighting, pairing or firmware commands.
const HID=require('node-hid');
const sessions=new Map();
function parseNova5Status(bytes){
  if(!bytes||bytes.length<16||bytes[0]!==0xb0)return null;
  if(bytes[1]===2)return {connected:false,battery:null,charging:false,status:'已断开'};
  if(![0,1].includes(bytes[1])||bytes[3]>100||![0,1].includes(bytes[4]))return null;
  return {connected:true,battery:bytes[3],charging:bytes[4]===1};
}
function nova5Identity(entries){
  const d=entries.find(e=>e.vendorId===0x1038&&e.productId===0x2232);
  return d?{brand:'SteelSeries',model:'Arctis Nova 5 Wireless',kind:'耳机',connection:'2.4G 接收器'}:null;
}
async function readNova5(entries,publish){
  const endpoint=entries.find(e=>e.vendorId===0x1038&&e.productId===0x2232&&e.usagePage===0xffc0&&e.usage===1&&e.interface===3);
  if(!endpoint)return {connected:null,battery:null,status:'接收器已识别，状态接口待确认'};
  let s=sessions.get(endpoint.path);
  if(!s){s={handle:null,state:null,at:0,rounds:0,attemptAt:0,publish};sessions.set(endpoint.path,s)}
  s.publish=publish;
  if(s.rounds<3&&(!s.rounds||Date.now()-s.attemptAt>=15000)){
    s.rounds++;s.attemptAt=Date.now();
    try{
      if(!s.handle){
        const h=await HID.HIDAsync.open(endpoint.path);s.handle=h;
        h.on('data',bytes=>{
          if(sessions.get(endpoint.path)!==s||s.handle!==h)return;
          const state=parseNova5Status(bytes);if(!state)return;
          s.state=state;s.at=Date.now();s.publish?.(state,s.at);
        });
        h.on('error',()=>{if(s.handle===h)s.handle=null;h.close().catch(()=>{})});
      }
      await s.handle.write(Buffer.from([0x00,0xb0]));
    }catch{const h=s.handle;s.handle=null;if(h)await h.close().catch(()=>{})}
  }
  if(!s.state)return {connected:null,battery:null,status:'接收器已识别，耳机待确认'};
  return {...s.state,sampledAt:s.at,...(s.state.connected&&Date.now()-s.at>120000?{status:'上次确认在线'}:{})};
}
async function closeNova5(paths){
  for(const [key,s] of sessions){if(paths?.has(key))continue;sessions.delete(key);if(s.handle)await s.handle.close().catch(()=>{})}
}
module.exports={parseNova5Status,nova5Identity,readNova5,closeNova5};
