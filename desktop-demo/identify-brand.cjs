function identifyBrand(device) {
  const name = [device.brand, device.model].join(' ').normalize('NFKC').toLowerCase();
  for (const [key, pattern] of [
    ['RAPOO', /rapoo|雷柏/], ['AULA', /aula|狼蛛/], ['MCHOSE', /mchose|迈从/],
    ['LOGITECH', /logitech|logicool|\blogi\b|罗技|羅技|\bmx (?:master|anywhere|keys)\b/], ['RAZER', /razer|雷蛇/], ['KEYCHRON', /keychron/],
    ['STEELSERIES', /steel[ -]?series|\barctis\s+nova\s*5\b|赛睿|賽睿/], ['ATK', /\batk\b|艾泰克/],
    ['XIAOMI', /xiaomi|小米|redmi|红米|\bmi\s+(?:rc|portable mouse|dual mode wireless mouse)\b/],
    ['MORKBLADE', /mork[ -]?blade|墨刃/], ['HYPERX', /hyper[ -]?x\b|极度未知/],
    ['CORSAIR', /corsair|美商海盗船/], ['AKKO', /\bakko\b|艾酷/], ['DARMOSHARK', /darmoshark|达摩鲨/]
  ]) {
    if (pattern.test(name)) return key;
  }
  return ({ '046d': 'LOGITECH', '1532': 'RAZER', '24ae': 'RAPOO', '1038': 'STEELSERIES',
    '2717': 'XIAOMI', '1b1c': 'CORSAIR' })[device.hardwareId?.toLowerCase().split(':')[0]];
}

const brandNames = { RAPOO: 'Rapoo', AULA: 'AULA', MCHOSE: 'MCHOSE', LOGITECH: 'Logitech',
  RAZER: 'Razer', KEYCHRON: 'Keychron', STEELSERIES: 'SteelSeries', ATK: 'ATK', XIAOMI: '小米',
  MORKBLADE: '墨刃 MorkBlade', HYPERX: 'HyperX', CORSAIR: 'Corsair', AKKO: 'Akko', DARMOSHARK: 'Darmoshark' };
module.exports = { identifyBrand, brandNames };
