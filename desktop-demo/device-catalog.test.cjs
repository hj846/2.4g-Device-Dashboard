const test = require('node:test');
const assert = require('node:assert/strict');
const { identifyBrand } = require('./identify-brand.cjs');
const { scanHid } = require('./hid-devices.cjs');

test('recognizes brand names across transports without assigning all HP products to HyperX', () => {
  for (const [model, key] of [['Mi Portable Mouse','XIAOMI'], ['mi rc','XIAOMI'], ['MorkBlade Keyboard','MORKBLADE'],
    ['HyperX Cloud','HYPERX'], ['Steel Series Rival','STEELSERIES'], ['MX Master 3S','LOGITECH']]) {
    assert.equal(identifyBrand({ brand:'Bluetooth', model }), key);
  }
  assert.equal(identifyBrand({hardwareId:'03f0:1234', model:'HP Keyboard'}), undefined);
});
test('generic USB names resolve by product ID but a shared receiver cannot confirm a paired mouse', async t => {
  const HID = require('node-hid');
  t.mock.method(HID, 'devicesAsync', async () => [[0xc33c,'USB Keyboard',6],[0xc08f,'Mouse',2],
    [0xc52b,'USB Receiver',2]].map(([productId,product,usage]) => ({
      productId,product,usage,vendorId:0x046d,path:'HID#VID_046D&PID_'+productId,usagePage:1
    })));
  const { devices: [kbd, mouse, receiver] } = await scanHid();
  assert.equal(kbd.model,'G513');
  assert.equal(mouse.model,'G403 HERO');
  assert.equal(mouse.connected,true);
  assert.equal(receiver.connected,null);
  assert.equal(receiver.model,'USB Receiver');
  assert.equal(identifyBrand(receiver),'LOGITECH');
});
