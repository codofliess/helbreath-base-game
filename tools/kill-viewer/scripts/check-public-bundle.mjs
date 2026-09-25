// Fails if the PUBLIC web bundle or PUBLIC API artifact references any private/location field.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const targets = process.argv.length > 2 ? process.argv.slice(2) : ['dist/public', 'dist/server/public-api.mjs'];
const mapNames = ['middleland', 'huntzone1', 'huntzone3', 'arefarm', 'elvfarm', 'dglv2', 'bisle'];

const forbidden = [
  /map_id/, /\bmap_name\b/, /kill_location/, /internal_ops/, /v_kill_full/, /recorded_at/, /private-types/,
  /\bADMIN_[A-Z_]+/, /ITEM_VALUE_ZEM/, /computeFlags/, /\/admin\/api/, /ops_admin/,
  /["']location["']\s*:/, /[{,]\s*location\s*:\s*[{"'`\[]/, /\.location\.(map|x|y)\b/, /["'](x|y)["']\s*:/,
  ...mapNames.map((m) => new RegExp(`\\b${m}\\b`)),
];

const files = [];
const walk = (p) => statSync(p).isDirectory() ? readdirSync(p).forEach((f) => walk(join(p, f))) : files.push(p);
for (const t of targets) { if (!existsSync(t)) { console.error(`missing build output: ${t} (run npm run build)`); process.exit(1); } walk(t); }

let bad = 0;
for (const f of files.filter((f) => /\.(m?js|html|css|json|map)$/.test(f))) {
  const src = readFileSync(f, 'utf8').replace(/FORBIDDEN_PUBLIC_KEYS\s*=\s*\[[^\]]*\]/g, 'FORBIDDEN_PUBLIC_KEYS=[/*denylist*/]');
  for (const re of forbidden) {
    const m = src.match(re);
    if (m) { bad++; console.error(`✗ ${f}: forbidden token ${re} near "${src.slice(Math.max(0, m.index - 40), m.index + 40)}"`); }
  }
}
if (bad) { console.error(`public bundle check FAILED (${bad} hits)`); process.exit(1); }
console.log(`✓ public bundle check passed: ${files.length} files, ${forbidden.length} forbidden patterns (incl. ${mapNames.length} sample map ids)`);
