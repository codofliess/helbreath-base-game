import fs from 'fs';
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');
// Any non-comma end of line before equippedSprite / startSpriteSheetIndex
s = s.replace(/([^,\s])\r?\n(\s+equippedSprite)/g, '$1,\n$2');
s = s.replace(/([^,\s])\r?\n(\s+startSpriteSheetIndex)/g, '$1,\n$2');
s = s.replace(/,(\s*),/g, ',$1');
fs.writeFileSync(p, s);
console.log('fixed commas');
// syntax smoke: count unbalanced braces roughly
const open = (s.match(/\{/g) || []).length;
const close = (s.match(/\}/g) || []).length;
console.log({ open, close });
