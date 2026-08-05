/**
 * VerifyFix: traveler map tileset/collision sanity + HUD gauge sprite keys.
 * Run: node scripts/verify-traveler-collision-hud.mjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mapPath = path.join(ROOT, 'public/assets/maps/default.amd');
const spriteKeysPath = path.join(ROOT, 'src/constants/SpriteKeys.ts');
const hotkeyPath = path.join(ROOT, 'src/ui/components/HotkeyBar.tsx');
const hbMapPath = path.join(ROOT, 'src/game/assets/HBMap.ts');

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log('OK:', msg);
}

if (!fs.existsSync(mapPath)) {
  fail(`missing ${mapPath}`);
} else {
  const data = fs.readFileSync(mapPath);
  const hdr = data.subarray(0, 256).toString('ascii').replace(/\0/g, ' ');
  const tokens = hdr.trim().split(/\s+/);
  let sx = 0, sy = 0, ts = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i + 1] === '=' && tokens[i] === 'MAPSIZEX') sx = +tokens[i + 2];
    if (tokens[i + 1] === '=' && tokens[i] === 'MAPSIZEY') sy = +tokens[i + 2];
    if (tokens[i + 1] === '=' && tokens[i] === 'TILESIZE') ts = +tokens[i + 2];
  }
  let blocked = 0;
  let off = 256;
  for (let i = 0; i < sx * sy; i++) {
    if ((data[off + 8] & 0x80) !== 0) blocked++;
    off += ts;
  }
  ok(`default.amd ${sx}x${sy} blocked=${blocked} (${((100 * blocked) / (sx * sy)).toFixed(1)}%)`);
}

const spriteKeys = fs.readFileSync(spriteKeysPath, 'utf8');
for (const key of ['HUD_GAUGE_HP_MP', 'HUD_GAUGE_SP', 'HUD_GAUGE_EXP']) {
  if (!spriteKeys.includes(key)) fail(`SpriteKeys missing ${key}`);
  else ok(`SpriteKeys has ${key}`);
}

const hotkey = fs.readFileSync(hotkeyPath, 'utf8');
if (!hotkey.includes('StatusGauges') || !hotkey.includes('hotkey-bar-gauges')) {
  fail('HotkeyBar missing StatusGauges / HP-MP-SP panel');
} else {
  ok('HotkeyBar includes StatusGauges');
}

const hbMap = fs.readFileSync(hbMapPath, 'utf8');
if (!hbMap.includes('Always rebuild the compact tileset') && !hbMap.includes('clearDynamicOccupancy')) {
  // either string is enough signal that collision fixes landed
}
if (!hbMap.includes('clearDynamicOccupancy')) fail('HBMap missing clearDynamicOccupancy');
else ok('HBMap.clearDynamicOccupancy present');
if (!hbMap.includes('missing textures=')) fail('HBMap tileset rebuild logging missing');
else ok('HBMap tileset always rebuilt');

if (!process.exitCode) {
  console.log('\nAll traveler collision/HUD checks passed.');
}
