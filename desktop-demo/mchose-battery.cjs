// K87 V3: M HUB CZ SDK Qhw getBattery (0x0904), vendor collection FF80/1.
// Header and XOR checksum verified against the official SDK and a physical K87 V3.
const HID = require('node-hid');
let sequence = 0;
function parseBattery(bytes, seq) {
  if (!bytes || bytes.length < 11 || bytes[0] !== 77 || bytes[1] !== 1 ||
      bytes[2] !== 3 || bytes[3] !== 2 || bytes[4] !== 4 || bytes[5] !== 9 ||
      bytes[6] !== 0 || bytes[7] !== seq || bytes[8] > 2 || bytes[9] > 100) return null;
  if (bytes.subarray(2, 10).reduce((a, b) => a ^ b, 0) !== bytes[10]) return null;
  return { battery: bytes[9], charging: bytes[8] === 1, connected: true };
}
async function queryBattery(path) {
  let handle;
  try {
    handle = await HID.HIDAsync.open(path);
    const seq = sequence++ & 255;
    const packet = Buffer.alloc(32);
    packet.set([77, 1, 3, 0, 4, 9, 0, seq]);
    packet[8] = 3 ^ 4 ^ 9 ^ seq;
    await handle.write(packet);
    const deadline = Date.now() + 1200;
    while (Date.now() < deadline) {
      const reply = await handle.read(Math.max(1, deadline - Date.now()));
      const state = parseBattery(reply, seq);
      if (state) return state;
    }
    return null;
  } catch { return null; }
  finally { if (handle) await handle.close().catch(() => {}); }
}
module.exports = { parseBattery, queryBattery };
