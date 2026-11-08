const HID = require('node-hid');
const fs = require('node:fs');
const path = require('node:path');
const { queryBattery: queryMchoseBattery } = require('./mchose-battery.cjs');
const { nova5Identity, readNova5, closeNova5 } = require('./nova5.cjs');

let identityFile;
let knownKeyboards = {};
function loadKnownKeyboards(directory) {
  identityFile = path.join(directory, 'receiver-models.json');
  try {
    const saved = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    knownKeyboards = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch { knownKeyboards = {}; }
}

function rememberKeyboard(receiver, model) {
  if (!identityFile || model == null || knownKeyboards[receiver] === model) return;
  knownKeyboards[receiver] = model;
  const temp = identityFile + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temp, JSON.stringify(knownKeyboards));
    fs.renameSync(temp, identityFile);
  } catch { /* A read-only profile must not interrupt hardware discovery. */ }
}

function parseRapooStatus(bytes) {
  if (!bytes || bytes.length < 9 || bytes[0] !== 7 || ![0x10, 0x20].includes(bytes[1] & 0xf0)) return null;
  const state = { battery: bytes[8] >= 2 && bytes[8] <= 100 ? bytes[8] : null,
    charging: Boolean(bytes[7] & 2) || [1, 2].includes(bytes[9]),
    connection: (bytes[1] & 0xf0) === 0x20 ? '2.4G 接收器' : 'USB 有线', connected: true };
  if (bytes.length === 19 && (bytes[1] & 0xf0) === 0x20) {
    // Experimental signed interpretation of the final byte in VT3S V2 radio reports.
    state.experimentalSignalRaw = bytes[18] >= 128 ? bytes[18] - 256 : bytes[18];
  }
  return state;
}


const listeners = new Map();
const aulaSessions = new Map();
const basiliskSessions = new Map();
const mchoseSessions = new Map();
// A scan only consumes a pending input once. HID replies cannot schedule more writes.
function takeBatteryCheck(session, activeInterval = 15000) {
  const now = Date.now();
  const rounds = session.rounds || 0;
  if (rounds && (now - session.attemptAt < (rounds < 3 ? 14000 : activeInterval) ||
      (rounds >= 3 && !session.inputPending))) return false;
  session.rounds = Math.min(3, rounds + 1);
  session.attemptAt = now;
  session.inputPending = false;
  return true;
}

// The VT3S V2 read command asks for one byte of the active profile index.
async function probeRapoo(entries) {
  const control = entries.find(d => d.usagePage === 0xff00 && d.usage === 0x0e);
  if (!control) return;
  let handle;
  try {
    handle = await HID.HIDAsync.open(control.path);
    const packet = Buffer.alloc(33);
    packet.set([0x06, 0xa5, 0xa4, 1, 0x0c, 0x01]);
    await handle.write(packet);
  } catch { /* Passive status reports are still available if the control interface is busy. */ }
  finally { if (handle) await handle.close().catch(() => {}); }
}
async function readRapoo(descriptors, publish) {
  const endpoint = descriptors.find(d => d.usagePage === 0xff00 && d.usage === 2);
  if (!endpoint) return {};
  let listener = listeners.get(endpoint.path);
  if (!listener) {
    try {
      const handle = await HID.HIDAsync.open(endpoint.path);
      listener = { handle, state: null, at: 0, mice: new Set(descriptors.filter(d => d.usagePage === 1 && d.usage === 2).map(d => inputPath(d.path))) };
      listeners.set(endpoint.path, listener);
      handle.on('data', bytes => {
        const state = parseRapooStatus(bytes);
        if (state && listeners.get(endpoint.path) === listener) {
          listener.state = state;
          listener.at = Date.now();
          publish(state, listener.at);
        }
      });
      handle.on('error', () => { listeners.delete(endpoint.path); handle.close().catch(() => {}); });
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch { return { status: '读取受限' }; }
  }
  if (listener.state?.connection !== 'USB 有线' && takeBatteryCheck(listener, 60000)) await probeRapoo(descriptors);
  return listener.state && Date.now() - listener.at < 120000 ? { ...listener.state, sampledAt: listener.at } :
    { cachedBattery: listener.state?.battery ?? null, sampledAt: listener.at, status: '状态待确认' };
}

function parseAulaBattery(bytes) {
  if (!bytes || bytes.length !== 20 || bytes[0] !== 0x13 || (bytes[1] & 0x7f) !== 0x4a) return null;
  if ((bytes.subarray(0, 19).reduce((sum, byte) => sum + byte, 0) & 255) !== bytes[19]) return null;
  if (bytes[6] === 0x10) return { connected: true, battery: null, charging: true };
  if (bytes[6] !== 1 || bytes[5] < 1 || bytes[5] > 100) return null;
  return { connected: true, battery: bytes[5], charging: false };
}

// Both commands are getters. Reject unrelated traffic and frames with a bad checksum.
function aulaQuery(command) {
  const question = Buffer.alloc(20);
  question[0] = 0x13;
  question[1] = command;
  question[2] = command === 0x05 ? 1 : 0;
  question[19] = question[0] + command + question[2];
  return question;
}

function inputPath(value) {
  // Raw Input uses the keyboard interface GUID; node-hid uses the HID interface GUID.
  return value.toLowerCase().split('#{')[0].replace(/\\kbd$/, '');
}

// Basilisk X HyperSpeed (1532:0083), MI_00 feature report: read battery, class 07 / command 80.
function parseBasiliskBattery(report) {
  if (report.length !== 91 || report[0] !== 0 || report[1] !== 2 || report[2] !== 0xff ||
      report[6] !== 2 || report[7] !== 7 || report[8] !== 0x80) return null;
  const crc = report.subarray(3, 89).reduce((value, byte) => value ^ byte, 0);
  return crc === report[89] ? Math.round(report[10] * 100 / 255) : null;
}

async function updateBasiliskBattery(session) {
  let handle;
  try {
    handle = await HID.HIDAsync.open(session.endpoint);
    const query = Buffer.alloc(91);
    query[2] = 0xff;
    query.set([2, 7, 0x80], 6);
    query[89] = 2 ^ 7 ^ 0x80;
    await handle.sendFeatureReport(query);
    for (const delay of [35, 100, 250]) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const battery = parseBasiliskBattery(await handle.getFeatureReport(0, 91));
      if (battery === null) continue;
      session.battery = battery;
      session.sampledAt = Date.now();
      break;
    }
  } catch { /* An asleep or busy receiver may not answer. Retain the last timestamped sample. */ }
  finally { if (handle) await handle.close().catch(() => {}); }
}

function recordDeviceActivity(devicePath) {
  const path = inputPath(devicePath);
  const keyboard = mchoseSessions.get(path);
  if (keyboard) {
    keyboard.inputPending = true;
    keyboard.at = Date.now();
    keyboard.publish({ ...keyboard.state, connected: true }, keyboard.sampledAt || keyboard.at);
  }
  for (const session of listeners.values()) {
    if (session.mice.has(path)) session.inputPending = true;
  }
  const mouse = basiliskSessions.get(path);
  if (mouse) {
    mouse.inputPending = true;
    mouse.activeAt = Date.now();
    mouse.publish({ connected: true, battery: mouse.battery }, mouse.sampledAt || mouse.activeAt);
    return;
  }
  for (const session of aulaSessions.values()) {
    if (!session.keyboards.has(path)) continue;
    session.inputPending = true;
    session.activeAt = Date.now();
    session.publish({ ...(session.state || {}), connected: true }, session.at || session.activeAt);
  }
}

async function readAula(entries, publish) {
  const endpoint = entries.find(d => d.usagePage === 0xff02 && d.usage === 2);
  if (!endpoint) return {};
  let session = aulaSessions.get(endpoint.path);
  if (!session) {
    session = {
      handle: null, state: null, at: 0, activeAt: 0, model: null, publish,
      keyboards: new Set(entries.filter(d => d.usagePage === 1 && d.usage === 6).map(d => inputPath(d.path)))
    };
    aulaSessions.set(endpoint.path, session);
  }
  session.publish = publish;
  if (takeBatteryCheck(session)) {
    try {
      if (!session.handle) {
        const handle = await HID.HIDAsync.open(endpoint.path);
        session.handle = handle;
        handle.on('error', () => {
          if (session.handle !== handle) return;
          session.handle = null;
          handle.close().catch(() => {});
        });
        handle.on('data', bytes => {
          if (aulaSessions.get(endpoint.path) !== session || session.handle !== handle) return;
          if (bytes.length === 20 && bytes[0] === 0x13 && (bytes[1] & 127) === 5 &&
              (bytes.subarray(0, 19).reduce((a, b) => a + b, 0) & 255) === bytes[19]) {
            session.model = bytes[10];
            rememberKeyboard(endpoint.path, session.model);
            return;
          }
          const state = parseAulaBattery(bytes);
          if (!state) return;
          session.state = state;
          session.at = Date.now();
          session.publish({ ...state, ...(session.model === 0xcd ? { model: '狼蛛 F75', brand: 'AULA' } : {}) }, session.at);
        });
      }
      if (session.model == null) {
        await session.handle.write(aulaQuery(5));
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      await session.handle.write(aulaQuery(0x4a));
    } catch {
      const failed = session.handle;
      session.handle = null;
      if (failed) await failed.close().catch(() => {});
    }
  }
  const previousF75 = session.model == null && knownKeyboards[endpoint.path] === 0xcd;
  const identity = session.model === 0xcd || previousF75
    ? { model: previousF75 ? '狼蛛 F75（上次识别）' : '狼蛛 F75', brand: 'AULA', kind: '键盘' } : {};
  if (session.state && Date.now() - session.at < 120000) {
    return { ...identity, ...session.state, sampledAt: session.at };
  }
  if (Date.now() - session.activeAt < 120000) {
    return { ...identity, ...(session.state || {}), connected: true, sampledAt: session.at || session.activeAt };
  }
  return { ...identity, cachedBattery: session.state?.battery ?? null, sampledAt: session.at,
    status: session.handle ? '状态待确认' : '读取受限' };
}

async function closeHid() {
  await closeNova5();
  const handles = [...listeners.values(), ...aulaSessions.values()].filter(item => item.handle);
  aulaSessions.clear();
  basiliskSessions.clear();
  mchoseSessions.clear();
  listeners.clear();
  // node-hid schedules readStart on nextTick after adding a data listener.
  await new Promise(resolve => setImmediate(resolve));
  await Promise.allSettled(handles.map(item => item.handle.close()));
}

// Verified wired IDs. Receiver IDs stay on the wireless path even though both enumerate over USB.
const wiredDevices = new Map([
  // USB identifiers from libratbag/data/devices. Regional G102/G203 names share IDs.
  ...['c084', 'c092', 'c09d'].map(pid => ['046d:' + pid, { kind: '鼠标', brand: 'Logitech', model: 'G102 / G203' }]),
  ['046d:c07e', { kind: '鼠标', brand: 'Logitech', model: 'G402' }],
  ['046d:c08f', { kind: '鼠标', brand: 'Logitech', model: 'G403 HERO' }],
  ['046d:c24a', { kind: '鼠标', brand: 'Logitech', model: 'G600' }],
  ['046d:c339', { kind: '键盘', brand: 'Logitech', model: 'G PRO Keyboard' }],
  ['046d:c33c', { kind: '键盘', brand: 'Logitech', model: 'G513' }],
  ['046d:c08b', { kind: '鼠标', brand: 'Logitech', model: 'G502 HERO' }],
  ['03f0:0b92', { kind: 'USB 声卡', brand: 'HyperX', model: 'HyperX Virtual Surround Sound' }],
  ['258a:010c', { kind: '键盘' }],
  ['24ae:4606', { kind: '鼠标', brand: 'Rapoo', model: '雷柏 VT3S' }],
  ['24ae:4611', { kind: '鼠标', brand: 'Rapoo', model: '雷柏 VT3S' }]
]);

async function scanHid(onReport) {
  const descriptors = await HID.devicesAsync();
  const paths = new Set(descriptors.map(d => d.path));
  await closeNova5(paths);
  const inputs = new Set(descriptors.map(d => inputPath(d.path)));
  for (const path of basiliskSessions.keys()) if (!inputs.has(path)) basiliskSessions.delete(path);
  for (const path of mchoseSessions.keys()) if (!inputs.has(path)) mchoseSessions.delete(path);
  for (const [path, session] of aulaSessions) {
    if (paths.has(path)) continue;
    aulaSessions.delete(path);
    if (session.handle) await session.handle.close().catch(() => {});
  }
  for (const [path, listener] of listeners) {
    if (!paths.has(path)) { listeners.delete(path); await listener.handle.close().catch(() => {}); }
  }
  const groups = new Map();
  for (const descriptor of descriptors) {
    // Bluetooth endpoints are read through the Windows Bluetooth backend.
    if (!descriptor.path.toUpperCase().includes('VID_') || descriptor.path.toUpperCase().includes('BTH')) continue;
    const key = `${descriptor.vendorId}:${descriptor.productId}:${descriptor.serialNumber || descriptor.product || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(descriptor);
  }
  const devices = await Promise.all(Array.from(groups, async ([key, entries]) => {
    const d = entries[0];
    const hardwareId = [d.vendorId, d.productId].map(id => id.toString(16).padStart(4, '0')).join(':');
    const wired = wiredDevices.get(hardwareId);
    const isMouse = entries.some(item => item.usagePage === 1 && item.usage === 2);
    const isKeyboard = entries.some(item => item.usagePage === 1 && item.usage === 6);
    const nova5 = nova5Identity(entries);
    if (!wired && !isMouse && !isKeyboard && !nova5) return null;
    const rapoo = d.vendorId === 0x24ae && d.productId === 0x1464;
    const basilisk = hardwareId === '1532:0083';
    const aula = d.vendorId === 0x3554 && d.productId === 0xfa09;
    const row = { id: `hid:${key}`, model: rapoo ? '雷柏 VT3S V2' : d.product || 'HID 设备',
      brand: rapoo ? 'Rapoo' : d.manufacturer || 'HID',
      kind: rapoo || basilisk ? '鼠标' : aula ? '键盘' : isMouse && !isKeyboard ? '鼠标' : isKeyboard && !isMouse ? '键盘' : '输入设备', connected: null,
      connection: rapoo || aula || basilisk ? '2.4G 接收器' : 'USB（有线 / 接收器待确认）', battery: null, rssi: null,
      hardwareId,
      source: 'USB HID', status: '系统已识别' };
    if (!wired && !aula && !rapoo && !basilisk && /receiver|dongle|接收器/i.test(d.product || '')) {
      row.connection = 'USB 无线接收器';
      row.status = '配对设备待确认';
    }
    if (hardwareId === '3837:1015') {
      row.kind = '键盘';
      row.connection = '2.4G 接收器';
      row.status = '状态待确认';
    }
    const publish = (state, sampledAt) => onReport?.({
      ...row, experimentalSignalRaw: null, status: undefined, ...state, sampledAt
    });
    if(nova5){
      Object.assign(row,nova5,{status:'接收器已识别，耳机待确认'});
      Object.assign(row,await readNova5(entries,publish));
    }
    // These firmware names identify the wired model. A shared chipset VID/PID alone does not.
    const boldName=(d.product||'').normalize('NFKC');
    const boldTKL=isKeyboard && /\bBold[\s_-]*TKL(?:[\s_-]*HE)?\b/i.test(boldName) &&
      (/mork[\s_-]*blade|墨刃/i.test([d.manufacturer,boldName].join(' ')) ||
       /^Bold[\s_-]*TKL(?:[\s_-]*HE)?(?:[\s_-]+(?:keyboard|usb))?$/i.test(boldName.trim()));
    if(boldTKL)Object.assign(row,{brand:'MorkBlade',model:'Bold TKL HE',kind:'键盘',connection:'USB 有线',connected:true});
    if (hardwareId === '3837:1015' && /K87 V3 2\.4G/i.test(d.product || '')) {
      const keyboards = entries.filter(e => e.usagePage === 1 && e.usage === 6);
      const endpoint = entries.find(e => e.usagePage === 0xff80 && e.usage === 1);
      if (keyboards.length && endpoint) {
        const session = mchoseSessions.get(inputPath(keyboards[0].path)) || { at: 0, sampledAt: 0 };
        session.publish = publish;
        for (const keyboard of keyboards) mchoseSessions.set(inputPath(keyboard.path), session);
        if (takeBatteryCheck(session)) {
          const state = await queryMchoseBattery(endpoint.path);
          if (state) {
            session.state = state;
            session.sampledAt = Date.now();
            publish(state, session.sampledAt);
          }
        }
        if (session.state) Object.assign(row, session.state, { sampledAt: session.sampledAt });
        else if (session.at && Date.now() - session.at < 120000) row.connected = true;
      }
    }
    if (basilisk) {
      const endpoint = entries.find(item => item.usagePage === 1 && item.usage === 2);
      if (endpoint) {
        const path = inputPath(endpoint.path);
        const session = basiliskSessions.get(path) || { activeAt: 0, endpoint: endpoint.path, battery: null, sampledAt: 0 };
        session.publish = publish;
        basiliskSessions.set(path, session);
        if (takeBatteryCheck(session, 60000)) {
          await updateBasiliskBattery(session);
        }
        row.battery = session.battery;
        row.sampledAt = session.sampledAt;
        row.connected = session.activeAt > 0 || session.sampledAt > 0 ? true : null;
        if (row.connected) row.lastInputAt = Math.max(session.activeAt, session.sampledAt);
        row.status = '状态待确认';
      }
    }
    if (rapoo) Object.assign(row, await readRapoo(entries, publish));
    if (aula) Object.assign(row, await readAula(entries, publish));
    const namedWired = /\b(wired|corded)\b|有线/i.test(d.product || '') &&
      !/receiver|dongle|wireless|接收器|无线/i.test(d.product || '');
    if (!basilisk && !rapoo && !aula && !nova5 && !boldTKL && (wired || namedWired)) {
      Object.assign(row, { kind: isMouse ? '鼠标' : '键盘', ...wired, connected: true, connection: 'USB 有线' });
    }
    if (row.connected && !(nova5 && row.status==='上次确认在线')) delete row.status;
    if (basilisk && row.lastInputAt && Date.now() - row.lastInputAt >= 120000) row.status = '上次确认在线';
    return row;
  }));
  return { devices: devices.filter(Boolean), warnings: [] };
}

module.exports = { parseBasiliskBattery, recordDeviceActivity, loadKnownKeyboards, scanHid, parseRapooStatus, parseAulaBattery, closeHid };
