import fs from 'fs';
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/,(\s*),/g, ',$1');
// Keep trailing commas inside objects (prettier style) — only fix ",," patterns above.
fs.writeFileSync(p, s);
const m = s.match(/id:\s*462,[\s\S]{0,320}/);
console.log(m?.[0]);
const m2 = s.match(/id:\s*483,[\s\S]{0,320}/);
console.log(m2?.[0]);
