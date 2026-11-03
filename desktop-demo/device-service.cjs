const { EventEmitter } = require('node:events');

// A manifest declares what an adapter can report or change. Real VID/PID values
// belong here only after they have been verified against a physical device.
const manifests = Object.freeze([
  { id: 'logitech-gpro', brand: 'logitech G', model: 'G Pro X Superlight', kind: '鼠标', capabilities: ['battery', 'signal', 'dpi'] },
  { id: 'keychron-k2', brand: 'Keychron', model: 'K2 Wireless', kind: '键盘', capabilities: ['battery', 'signal'] },
  { id: 'steelseries-nova7', brand: 'steelseries', model: 'Arctis Nova 7', kind: '耳机', capabilities: ['battery', 'signal'] },
  { id: 'razer-v3pro', brand: 'RAZER', model: 'DeathAdder V3 Pro', kind: '鼠标', capabilities: ['battery', 'signal', 'dpi'] }
]);

const initial = Object.freeze({
  'logitech-gpro': { battery: 82, signal: 4, status: '已连接', connection: '2.4G 接收器', updated: '刚刚', dpi: 1200 },
  'keychron-k2': { battery: 64, signal: 3, status: '已连接', connection: '2.4G 接收器', updated: '1 分钟前' },
  'steelseries-nova7': { battery: 18, signal: 2, status: '需要关注', connection: '2.4G 接收器', updated: '3 分钟前' },
  'razer-v3pro': { battery: null, signal: 0, status: '已断开', connection: '最后连接：昨天', updated: '昨天', dpi: 800 }
});
const scenarios = Object.freeze(['混合状态', '全部在线', '全部断开', '无设备']);
const dpiSteps = new Set([800, 1200, 1600, 2400]);

class MockAdapter {
  constructor(manifest) {
    this.manifest = manifest;
    this.state = { ...initial[manifest.id] };
  }

  readState() {
    return { ...this.manifest, ...this.state };
  }

  applyScenario(index) {
    this.state = { ...initial[this.manifest.id] };
    if (index === 1) {
      this.state = { ...this.state, battery: Math.max(this.state.battery ?? 0, 70), signal: 4, status: '已连接', connection: '2.4G 接收器' };
    } else if (index === 2) {
      this.state = { ...this.state, battery: null, signal: 0, status: '已断开', connection: '等待连接' };
    }
  }

  setDpi(value) {
    if (!this.manifest.capabilities.includes('dpi')) throw new Error('该设备不支持 DPI 设置');
    if (this.state.status === '已断开') throw new Error('设备已断开，无法切换 DPI');
    if (!Number.isInteger(value) || !dpiSteps.has(value)) throw new Error('不支持的 DPI 档位');
    this.state.dpi = value;
    return this.readState();
  }
}

class DeviceService extends EventEmitter {
  constructor(adapters = manifests.map(manifest => new MockAdapter(manifest))) {
    super();
    this.adapters = new Map(adapters.map(adapter => [adapter.manifest.id, adapter]));
    this.scenario = 0;
  }

  snapshot() {
    return { scenario: this.scenario, scenarioName: scenarios[this.scenario], devices: this.scenario === 3 ? [] : [...this.adapters.values()].map(adapter => adapter.readState()) };
  }

  nextScenario() {
    this.scenario = (this.scenario + 1) % scenarios.length;
    for (const adapter of this.adapters.values()) adapter.applyScenario(this.scenario);
    const snapshot = this.snapshot();
    this.emit('changed', snapshot);
    return snapshot;
  }

  setDpi(id, value) {
    if (this.scenario === 3) throw new Error('设备不存在');
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error('设备不存在');
    const device = adapter.setDpi(value);
    this.emit('changed', this.snapshot());
    return device;
  }
}

module.exports = { DeviceService, MockAdapter, manifests };
