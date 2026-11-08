const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBattery } = require('./mchose-battery.cjs');
test('K87 V3 decodes physical reply and rejects unrelated/corrupt packets', () => {
  const frame = Buffer.from('4d01030204090025004c650000000000000000000000000000000000000000650000000000000000000000000000000000000000000000000000000000000000', 'hex');
  assert.deepEqual(parseBattery(frame, 37), { battery: 76, charging: false, connected: true });
  assert.equal(parseBattery(frame, 38), null);
  assert.equal(parseBattery(frame.subarray(0, 10), 37), null);
  frame[10] ^= 1;
  assert.equal(parseBattery(frame, 37), null);
  frame[8] = 1; frame[9] = 0;
  frame[10] = frame.subarray(2,10).reduce((a,b)=>a^b,0);
  assert.deepEqual(parseBattery(frame,37), {battery:0,charging:true,connected:true});
});
