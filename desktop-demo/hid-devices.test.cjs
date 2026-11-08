const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRapooStatus, parseAulaBattery } = require('./hid-devices.cjs');
test('Rapoo status validates report mode and leaves invalid battery unknown', () => {
  assert.deepEqual(parseRapooStatus(Buffer.from([7,32,3,64,6,64,6,1,77])), { battery: 77, charging: false, connection: '2.4G 接收器', connected: true });
  assert.equal(parseRapooStatus(Buffer.from([7,32,0,0,0,0,0,0,255])).battery, null);
  assert.equal(parseRapooStatus(Buffer.from([7,0,0,0,0,0,0,0,50])), null);
});
test('AULA requires a valid battery reply and distinguishes charging from a real percentage', () => {
  const reply=Buffer.alloc(20); reply[0]=0x13; reply[1]=0x4a; reply[5]=97; reply[6]=1;
  reply[19]=reply.subarray(0,19).reduce((a,b)=>a+b,0)&255;
  assert.equal(parseAulaBattery(reply).battery,97);
  reply[19]++;
  assert.equal(parseAulaBattery(reply),null);
  reply[6]=0x10; reply[19]=reply.subarray(0,19).reduce((a,b)=>a+b,0)&255;
  assert.equal(parseAulaBattery(reply).battery,null);
  assert.equal(parseAulaBattery(reply).charging,true);
});
test('F75 retries a silent startup without input, stops once sampled and refreshes after activity', async t => {
  const HID = require('node-hid');
  const { EventEmitter } = require('node:events');
  const { scanHid, closeHid, recordDeviceActivity } = require('./hid-devices.cjs');
  const device = { vendorId: 0x3554, productId: 0xfa09, product: '2.4G Wireless Receiver', serialNumber: 'test' };
  const interfaces = [
    { ...device, path: 'HID#VID_3554&keyboard#{hid-guid}\\KBD', usagePage: 1, usage: 6 },
    { ...device, path: 'HID#VID_3554&vendor', usagePage: 0xff02, usage: 2 }
  ];
  let present = true;
  let clock = Date.now();
  t.mock.method(Date, "now", () => clock);
  const commands = [];
  t.mock.method(HID, 'devicesAsync', async () => present ? interfaces : []);
  t.mock.method(HID.HIDAsync, 'open', async () => {
    const handle = new EventEmitter();
    handle.write = async packet => { commands.push(packet[1]);
      if (commands.length === 2) return;
      const reply = Buffer.alloc(20);
      reply[0] = 0x13;
      reply[1] = commands.at(-1);
      if (reply[1] === 5) reply[10] = 0xcd;
      else { reply[5] = 75; reply[6] = 1; }
      reply[19] = reply.reduce((a, b) => a + b, 0) & 255;
      handle.emit('data', reply);
    };
    handle.close = async () => {};
    return handle;
  });
  t.after(closeHid);
  assert.equal((await scanHid()).devices[0].battery, null);
  clock += 16000;
  assert.equal((await scanHid()).devices[0].battery, 75);
  await scanHid();
  await scanHid();
  assert.deepEqual(commands, [5, 0x4a, 0x4a]);
  clock += 16000;
  assert.equal((await scanHid()).devices[0].battery, 75);
  assert.deepEqual(commands, [5, 0x4a, 0x4a, 0x4a]);
  clock += 125000;
  assert.equal((await scanHid()).devices[0].connected, null);
  recordDeviceActivity('HID#VID_3554&other#{keyboard-guid}');
  assert.equal((await scanHid()).devices[0].connected, null);
  recordDeviceActivity('HID#VID_3554&keyboard#{keyboard-guid}');
  assert.equal((await scanHid()).devices[0].connected, true);
  assert.deepEqual(commands, [5, 0x4a, 0x4a, 0x4a, 0x4a]);
  present = false;
  await scanHid();
  present = true;
  await scanHid();
  assert.deepEqual(commands, [5, 0x4a, 0x4a, 0x4a, 0x4a, 5, 0x4a]);
});
test('Basilisk 2.4G goes online only on its own mouse input and forgets the session on unplug', async t => {
  const HID = require('node-hid');
  const { scanHid, closeHid, recordDeviceActivity } = require('./hid-devices.cjs');
  const descriptor = { vendorId: 0x1532, productId: 0x83, product: 'Basilisk X HyperSpeed', usagePage: 1, usage: 2,
    path: 'HID#VID_1532&PID_0083&MI_00#instance#{hid-guid}' };
  let attached = true;
  t.mock.method(HID, 'devicesAsync', async () => attached ? [descriptor] : []);
  t.after(closeHid);
  let live;
  const scan = async () => (await scanHid(row => { live = row; })).devices[0];
  assert.equal((await scan()).connected, null);
  recordDeviceActivity('HID#VID_046D&other#{mouse-guid}');
  assert.equal(live, undefined);
  recordDeviceActivity('HID#VID_1532&PID_0083&MI_00#instance#{mouse-guid}');
  assert.equal(live.connected, true);
  assert.equal(live.connection, '2.4G 接收器');
  const later = Date.now() + 125000;
  t.mock.method(Date, 'now', () => later);
  assert.equal((await scan()).status, '上次确认在线');
  attached = false;
  assert.equal(await scan(), undefined);
  attached = true;
  assert.equal((await scan()).connected, null);
});
test('Basilisk battery reply decodes the live MI_00 frame and rejects invalid data', () => {
  const { parseBasiliskBattery } = require('./hid-devices.cjs');
  const report = Buffer.alloc(91);
  report.set([0,2,255,0,0,0,2,7,128,0,242]);
  report[89] = 119;
  assert.equal(parseBasiliskBattery(report), 95);
  report[89] ^= 1;
  assert.equal(parseBasiliskBattery(report), null);
  assert.equal(parseBasiliskBattery(Buffer.alloc(90)), null);
});

test('Basilisk bounds silent startup attempts and retries after a movement between scans', async t => {
  const HID = require('node-hid');
  const { scanHid, closeHid, recordDeviceActivity } = require('./hid-devices.cjs');
  const path = 'HID#VID_1532&PID_0083&MI_00#mouse';
  t.mock.method(HID, 'devicesAsync', async () => [{ path, vendorId: 0x1532, productId: 0x83, usagePage: 1, usage: 2 }]);
  let attempts = 0, reads = 0, clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  t.mock.method(HID.HIDAsync, 'open', async () => {
    if (++attempts !== 4) throw Error('no response');
    return { sendFeatureReport: async () => {}, close: async () => {}, getFeatureReport: async () => {
      const frame = Buffer.alloc(91);
      if (++reads === 2) { frame.set([0,2,255,0,0,0,2,7,128,0,240]); frame[89] = 117; }
      return frame;
    } };
  });
  t.after(closeHid);
  const scan = async () => (await scanHid()).devices[0];
  for (let i = 0; i < 5; i++) { assert.equal((await scan()).battery, null); clock += 16000; }
  assert.equal(attempts, 3);
  recordDeviceActivity(path);
  clock += 45000;
  const sample = await scan();
  assert.equal(sample.battery, 94);
  clock += 125000;
  assert.equal((await scan()).sampledAt, sample.sampledAt);
  assert.equal(attempts, 4);
});

test('wired G502 is enumerated without opening or writing its HID interfaces', async t => {
  const HID = require('node-hid');
  const { scanHid, closeHid } = require('./hid-devices.cjs');
  t.after(closeHid);
  t.mock.method(HID,'devicesAsync',async()=>[{vendorId:0x046d,productId:0xc08b,path:'HID#VID_046D&PID_C08B',usagePage:1,usage:2}]);
  let opens=0;
  t.mock.method(HID.HIDAsync,'open',async()=>{opens++;throw Error('unexpected open')});
  const result=await scanHid();
  assert.equal(result.devices[0].model,'G502 HERO');
  assert.equal(result.devices[0].connection,'USB 有线');
  assert.equal(opens,0);
});

test('mouse checks keep three startup rounds then throttle activity to one query per minute', async t => {
  const HID = require('node-hid');
  const {scanHid,closeHid,recordDeviceActivity}=require('./hid-devices.cjs');
  const path='HID#VID_1532&PID_0083&MI_00#rate-test';
  let clock=Date.now(),attempts=0;
  t.mock.method(Date,'now',()=>clock);
  t.mock.method(HID,'devicesAsync',async()=>[{path,vendorId:0x1532,productId:0x83,usagePage:1,usage:2}]);
  t.mock.method(HID.HIDAsync,'open',async()=>{attempts++;throw Error('asleep')});
  t.after(closeHid);
  for(let i=0;i<3;i++){await scanHid();clock+=15000}
  assert.equal(attempts,3);
  for(let i=0;i<3;i++){recordDeviceActivity(path);await scanHid();clock+=15000}
  assert.equal(attempts,3);
  recordDeviceActivity(path);await scanHid();
  assert.equal(attempts,4);
  clock+=180000;await scanHid();
  assert.equal(attempts,4);
});
