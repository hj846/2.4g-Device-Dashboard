const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowsDeviceService } = require('./windows-device-service.cjs');
test('real readings preserve unknown values, track removal and retain data on scan failure', async () => {
  let rows = [{ id: 'mouse', model: 'Mouse', connected: true, battery: 55, rssi: -65, connection: '蓝牙' }];
  const service = new WindowsDeviceService(async () => { if (rows instanceof Error) throw rows; return rows; });
  await service.refresh();
  assert.equal(service.snapshot().devices[0].signal, 3);
  assert.equal(service.snapshot().devices[0].battery, 55);
  rows = new Error('scan failed');
  await service.refresh();
  assert.equal(service.snapshot().error, 'scan failed');
  assert.equal(service.snapshot().devices[0].battery, 55);
  rows = [];
  await service.refresh();
  assert.equal(service.snapshot().devices[0].status, '已断开');
  assert.equal(service.snapshot().devices[0].signal, null);
  rows = [{ id: 'usb', status: '系统已识别', connected: null, battery: null, rssi: null }];
  await service.refresh();
  assert.equal(service.snapshot().devices[1].battery, null);
  assert.equal(service.snapshot().devices[1].status, '系统已识别');
});
test('overlapping refreshes do not start concurrent scans', async () => {
  let finish;
  let calls = 0;
  const service = new WindowsDeviceService(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = service.refresh();
  await service.refresh();
  assert.equal(calls, 1);
  finish([]);
  await first;
});
test('slow Bluetooth scan allows USB refresh and removal before Bluetooth completes', async () => {
  let rows = [{ id: 'keyboard', model: '狼蛛 F75', brand: 'AULA', battery: 75, connected: true }];
  let finish;
  const service = new WindowsDeviceService(async () => rows, () => new Promise(resolve => { finish = resolve; }));
  const pending = service.refresh();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.snapshot().devices[0].brandKey, 'AULA');
  rows = [];
  await service.refresh();
  assert.equal(service.snapshot().devices[0].status, '已断开');
  assert.equal(service.snapshot().devices[0].battery, null);
  finish({ devices: [], warnings: [] });
  await pending;
});
test('live sample is published before scan completes and survives an older scan result', async () => {
  let send, finish;
  const service = new WindowsDeviceService(report => {
    send = report;
    return new Promise(resolve => { finish = resolve; });
  });
  const frames = [];
  service.on('changed', snapshot => frames.push(snapshot.devices[0]?.experimentalSignalRaw));
  const pending = service.refresh();
  const row = { id: 'rapoo', connected: true, sampledAt: Date.now(), experimentalSignalRaw: -62 };
  send(row);
  assert.deepEqual(frames, [-62]);
  finish([{ ...row, experimentalSignalRaw: -72, sampledAt: row.sampledAt - 1 }]);
  await pending;
  assert.equal(service.snapshot().devices[0].experimentalSignalRaw, -62);
  send({ ...row, experimentalSignalRaw: -68 });
  assert.equal(frames.at(-1), -68);
});
test('VT3S experimental scale uses near and far calibration, bounded at either end', async () => {
  const readings = [-100, -90, -77, -66, -64, -56];
  const service = new WindowsDeviceService(async () => readings.map(raw => ({
    id: String(raw), experimentalSignalRaw: raw, connected: true
  })));
  const { devices } = await service.refresh();
  assert.deepEqual(devices.map(d => d.signalScore), [100, 100, 50, 8, 0, 0]);
  assert.deepEqual(devices.map(d => d.signal), [4, 4, 3, 1, 1, 1]);
});
