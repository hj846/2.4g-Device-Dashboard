const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const HID=require('node-hid');
const {parseNova5Status,closeNova5}=require('./nova5.cjs');
const {scanHid,closeHid}=require('./hid-devices.cjs');
function frame(level=75,online=1,charging=0){const b=Buffer.alloc(16);b[0]=0xb0;b[1]=online;b[3]=level;b[4]=charging;return b}
test('Nova 5 validates status command, length, percent, charging and offline state',()=>{
  assert.deepEqual(parseNova5Status(frame()),{connected:true,battery:75,charging:false});
  assert.deepEqual(parseNova5Status(frame(0,1,1)),{connected:true,battery:0,charging:true});
  assert.deepEqual(parseNova5Status(frame(255,2)),{connected:false,battery:null,charging:false,status:'已断开'});
  assert.equal(parseNova5Status(frame(101)),null);
  assert.equal(parseNova5Status(frame(50,9)),null);
  assert.equal(parseNova5Status(frame().subarray(0,6)),null);
  const unrelated=frame();unrelated[0]=0x20;assert.equal(parseNova5Status(unrelated),null);
});
test('Nova 5 audio-only HID group is detected; three queries then passive reports; unplug resets session',async t=>{
  let now=Date.now(),present=true,writes=0,closed=0,handle,live;
  t.mock.method(Date,'now',()=>now);
  t.mock.method(HID,'devicesAsync',async()=>present?[{vendorId:0x1038,productId:0x2232,path:'HID#VID_1038&PID_2232&MI_03',usagePage:0xffc0,usage:1,interface:3}]:[]);
  t.mock.method(HID.HIDAsync,'open',async()=>{handle=new EventEmitter();handle.write=async b=>{assert.deepEqual([...b],[0,0xb0]);writes++};handle.close=async()=>{closed++};return handle});
  t.after(closeHid);
  const scan=async()=>(await scanHid(r=>{live=r})).devices[0];
  assert.equal((await scan()).connected,null);
  handle.emit('data',frame(73));
  assert.equal(live.kind,'耳机');assert.equal(live.connection,'2.4G 接收器');assert.equal(live.battery,73);
  for(let i=0;i<6;i++){now+=15000;await scan()}
  assert.equal(writes,3);
  handle.emit('data',frame(61));assert.equal((await scan()).battery,61);
  handle.emit('data',frame(61,2));assert.equal((await scan()).connected,false);
  present=false;await scan();assert.equal(closed,1);
  present=true;assert.equal((await scan()).battery,null);assert.equal(writes,4);
});
test('Nova 5 never opens a media-control interface as the status interface',async t=>{
  t.mock.method(HID,'devicesAsync',async()=>[{vendorId:0x1038,productId:0x2232,path:'HID#VID_1038&PID_2232&MI_04',usagePage:12,usage:1,interface:4}]);
  let opens=0;t.mock.method(HID.HIDAsync,'open',async()=>{opens++;throw Error('unexpected')});
  t.after(closeNova5);
  const row=(await scanHid()).devices[0];assert.equal(row.model,'Arctis Nova 5 Wireless');assert.equal(row.connected,null);assert.equal(opens,0);
});
test('Bold TKL HE uses exact firmware names, USB wired and no battery writes; generic chipset is not relabeled',async t=>{
  t.mock.method(HID,'devicesAsync',async()=>['Mork Blade Bold TKL HE','Bold TKL','USB Keyboard','Other Bold TKL clone'].map((product,i)=>({product,vendorId:0x1ca6,productId:0x1504+i,path:'HID#VID_1CA6#'+i,usagePage:1,usage:6})));
  let opens=0;t.mock.method(HID.HIDAsync,'open',async()=>{opens++;throw Error('unexpected')});
  const {devices}=await scanHid();
  for(const row of devices.slice(0,2)){assert.equal(row.brand,'MorkBlade');assert.equal(row.model,'Bold TKL HE');assert.equal(row.connection,'USB 有线');assert.equal(row.connected,true);assert.equal(row.battery,null)}
  assert.equal(devices[2].model,'USB Keyboard');assert.equal(devices[3].model,'Other Bold TKL clone');assert.equal(opens,0);
});
