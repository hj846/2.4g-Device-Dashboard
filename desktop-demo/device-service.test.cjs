const test = require('node:test');
const assert = require('node:assert/strict');
const { DeviceService } = require('./device-service.cjs');

test('manifest adapters expose only supported controls and preserve a DPI write', () => {
  const service = new DeviceService();
  const first = service.snapshot().devices;
  assert.equal(first.length, 4);
  assert.equal(first[0].battery, 82);
  assert.equal(service.setDpi('logitech-gpro', 1600).dpi, 1600);
  assert.equal(service.snapshot().devices[0].dpi, 1600);
  assert.throws(() => service.setDpi('keychron-k2', 800), /不支持/);
  assert.throws(() => service.setDpi('razer-v3pro', 800), /已断开/);
  assert.throws(() => service.setDpi('logitech-gpro', 1500), /不支持/);
});

test('scenes change adapter readings and restore initial state', () => {
  const service = new DeviceService();
  assert.equal(service.nextScenario().scenarioName, '全部在线');
  assert.equal(service.snapshot().devices[3].status, '已连接');
  assert.equal(service.nextScenario().scenarioName, '全部断开');
  assert.equal(service.snapshot().devices[0].battery, null);
  assert.equal(service.nextScenario().devices.length, 0);
  assert.equal(service.nextScenario().devices[0].battery, 82);
});
