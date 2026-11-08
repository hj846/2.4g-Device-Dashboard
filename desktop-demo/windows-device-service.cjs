const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const path = require('node:path');
const { identifyBrand, brandNames } = require('./identify-brand.cjs');
const { scanHid, closeHid, recordDeviceActivity } = require('./hid-devices.cjs');

function scanScript(name, timeout, preview) {
  const script = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), name);
  return new Promise((resolve, reject) => {
    const child = execFile('powershell.exe', ['-Mta', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ProgressFrames'],
      { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        if (error) return reject(new Error('Windows 设备扫描失败，请稍后重试'));
        try { const rows = JSON.parse(stdout.trim().split(/\r?\n/).at(-1)); if (!Array.isArray(rows.devices)) throw new Error(); resolve(rows); }
        catch { reject(new Error('设备扫描结果无法解析')); }
      });
    require('node:readline').createInterface({ input: child.stdout }).on('line', line => {
      let frame;
      try { frame = JSON.parse(line.replace(/^\uFEFF/, '')); } catch { return; }
      if (Array.isArray(frame.preview)) preview?.(frame.preview);
    });
  });
}

function normalizeDevice(row, previous) {
  const isWired = row.connection === 'USB 有线';
  const battery = !isWired && Number.isFinite(row.battery) && row.battery >= 0 && row.battery <= 100 ? row.battery : null;
  const rssi = !isWired && Number.isFinite(row.rssi) && row.rssi < 0 && row.rssi >= -127 ? row.rssi : null;
  // User-calibrated endpoints for the VT3S V2 vendor byte, independent of Bluetooth RSSI.
  const signalScore = !isWired && Number.isInteger(row.experimentalSignalRaw)
    ? Math.max(0, Math.min(100, Math.round(100 * (-64 - row.experimentalSignalRaw) / 26)))
    : null;
  const connected = row.connected === true;
  const lastBattery = connected && battery !== null ? { percent: battery, at: row.sampledAt || Date.now() } : previous?.lastBattery;
  const recent = row.status === '状态待确认' && lastBattery && Date.now() - lastBattery.at < 120000;
  const brandKey = identifyBrand(row);
  return {
    ...row,
    isWired,
    brandKey, brand: brandNames[brandKey] || row.brand,
    battery: isWired ? null : row.cachedBattery ?? (recent ? lastBattery.percent : connected ? battery : null),
    lastBattery: isWired ? null : lastBattery,
    rssi,
    signalScore,
    signal: signalScore !== null ? Math.min(4, 1 + Math.floor(signalScore / 25)) : rssi === null ? null : rssi >= -55 ? 4 : rssi >= -67 ? 3 : rssi >= -80 ? 2 : 1,
    status: row.status || (connected ? (battery !== null && battery < 25 ? '需要关注' : '已连接') : '已断开'),
    capabilities: [],
    updated: row.cachedBattery != null ? new Date(row.sampledAt).toLocaleTimeString('zh-CN') : recent || (lastBattery && connected && Date.now() - lastBattery.at > 120000)
      ? new Date(lastBattery.at).toLocaleTimeString('zh-CN') : '刚刚'
  };
}

class WindowsDeviceService extends EventEmitter {
  constructor(scan = scanHid, bluetoothScan = scan === scanHid ? (_report, preview) => scanScript('scan-bluetooth.ps1', 90000, preview) : null) {
    super();
    this.sources = [scan, bluetoothScan].filter(Boolean).map(read => ({
      read, devices: new Map(), busy: false, error: null
    }));
    this.stopped = false;
  }

  snapshot() {
    return {
      devices: this.sources.flatMap(source => [...source.devices.values()]),
      error: this.sources.map(source => source.error).filter(Boolean).join(' · ') || null,
      scanning: this.sources.some(source => source.busy),
      mode: 'real'
    };
  }

  async refreshSource(source) {
    if (source.busy || this.stopped) return;
    source.busy = true;
    try {
      const scanStartedAt = Date.now();
      const result = await source.read(row => {
        if (this.stopped) return;
        source.devices.set(row.id, normalizeDevice(row, source.devices.get(row.id)));
        this.emit('changed', this.snapshot());
      }, rows => {
        if (this.stopped) return;
        for (const row of rows) {
          const previous = source.devices.get(row.id);
          const sample = previous?.connected && row.connected && previous.lastBattery;
          source.devices.set(row.id, normalizeDevice(sample ? { ...row, battery: sample.percent, sampledAt: sample.at } : row, previous));
        }
        this.emit('changed', this.snapshot());
      });
      if (this.stopped) return;
      const rows = Array.isArray(result) ? result : result.devices;
      source.error = result.warnings?.join(' · ') || null;
      const seen = new Set();
      for (const row of rows) {
        seen.add(row.id);
        const previous = source.devices.get(row.id);
        // A live report may arrive while another device is still being enumerated.
        if (previous?.sampledAt >= scanStartedAt && previous.sampledAt > (row.sampledAt ?? 0)) continue;
        source.devices.set(row.id, normalizeDevice(row, previous));
      }
      for (const [id, device] of source.devices) {
        if (!seen.has(id)) source.devices.set(id, { ...device, status: source.error ? '状态待确认' : '已断开', connected: false, lastBattery: null,
          battery: null, signal: null, signalScore: null, rssi: null, experimentalSignalRaw: null, charging: false, updated: '上次扫描' });
      }
    } catch (error) {
      source.error = error.message;
    } finally {
      source.busy = false;
      if (!this.stopped) this.emit('changed', this.snapshot());
    }
  }

  async refresh() {
    await Promise.all(this.sources.map(source => this.refreshSource(source)));
    return this.snapshot();
  }

  start() {
    this.stopped = false;
    if (this.sources[0].read === scanHid && process.platform === 'win32') {
      const script = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'keyboard-activity.ps1');
      const watcher = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', script, '-OwnerPid', String(process.pid)], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      this.activityWatcher = watcher;
      require('node:readline').createInterface({ input: watcher.stdout }).on('line', line => {
        if (this.stopped || line === 'READY') return;
        if (line === 'DEVICES_CHANGED') {
          clearTimeout(this.deviceChangeTimer);
          this.deviceChangeTimer = setTimeout(() => this.refreshSource(this.sources[0]), 500);
        } else recordDeviceActivity(line);
      });
      watcher.on('error', () => { /* Continue with HID status packets when Raw Input is unavailable. */ });
    }
    this.refresh();
    // Device notifications handle insertion/removal; periodic enumeration is a fallback.
    // Live vendor reports and input activity still publish immediately.
    this.timer = setInterval(() => this.refreshSource(this.sources[0]), 15000);
    if (this.sources[1]) this.bluetoothTimer = setInterval(() => this.refreshSource(this.sources[1]), 15000);
  }

  stop() { this.stopped = true; clearInterval(this.timer); clearInterval(this.bluetoothTimer); clearTimeout(this.deviceChangeTimer); this.activityWatcher?.kill(); closeHid(); }
  setDpi() { throw new Error('该设备尚未接入 DPI 控制协议'); }
}

module.exports = { WindowsDeviceService };
