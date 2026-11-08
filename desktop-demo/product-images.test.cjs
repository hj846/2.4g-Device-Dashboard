const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {find,catalog} = require('./product-images.js');
const {colors} = require('./product-images.js');
test('color variants stay within the exact model and all variant images are bundled',()=>{
  assert.match(find({brandKey:'MCHOSE',model:'MCHOSE K87 V3 2.4G'}),/mchose\/K87%20V3/);
  assert.equal(colors({brandKey:'MCHOSE',model:'迈从 K87 V3'}).length,6);
  const rapoo=colors({brandKey:'RAPOO',model:'雷柏 VT3S V2'});
  assert.equal(rapoo.length,5);
  assert(rapoo.every(c=>c.src.includes('/VT3S%20V2/')));
  assert.equal(colors({brandKey:'LOGITECH',model:'G Pro X Superlight'}).length,3);
  assert.equal(colors({brandKey:'LOGITECH',model:'G Pro X Superlight 2'}).length,0);
  assert.equal(colors({brandKey:'AULA',model:'F75'}).length,0);
  for(const [brandKey,models] of Object.entries(catalog))for(const model of Object.keys(models))for(const c of colors({brandKey,model})){
    assert(fs.existsSync(path.join(__dirname,decodeURIComponent(c.src))),c.src);
  }
});
test('driver artwork matches model and generation without borrowing unrelated pictures',()=>{
  assert.match(find({brandKey:'STEELSERIES',model:'SteelSeries Arctis Nova 5 Wireless'}),/steelseries/);
  assert.match(find({brandKey:'MORKBLADE',model:'Mork Blade Bold TKL HE'}),/morkblade/);
  assert.equal(find({brandKey:'STEELSERIES',model:'Arctis Nova 5X'}),null);
  assert.match(find({brandKey:'RAPOO',model:'雷柏 VT3S V2'}), /VT3S%20V2/);
  assert.match(find({brandKey:'RAPOO',model:'Rapoo VT3S'}), /VT3S\//);
  assert.match(find({brandKey:'AULA',model:'狼蛛 F75（上次识别）'}), /F75/);
  assert.match(find({brandKey:'LOGITECH',model:'Logitech G502 HERO'}), /g502_hero/);
  assert.match(find({brandKey:'LOGITECH',model:'G Pro X Superlight'}), /pro_x_wireless_mouse/);
  for (const d of [{brandKey:'LOGITECH',model:'G Pro X Superlight 2'}, {brandKey:'AULA',model:'F75 Pro'}, {brandKey:'MCHOSE',model:'K87 V4 2.4G'}]) assert.equal(find(d),null);
});
test('every bundled catalog image is present and is a real PNG or WebP',()=>{
  for(const src of new Set(Object.values(catalog).flatMap(v=>Object.values(v)))) {
    const b=fs.readFileSync(path.join(__dirname,decodeURIComponent(src)));
    assert(b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) || b.toString('ascii',8,12)==='WEBP', src);
  }
});
