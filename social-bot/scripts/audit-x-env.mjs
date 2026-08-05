import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
config({ path: path.join(root, '.env') });

const raw = fs.readFileSync(path.join(root, '.env'), 'utf8');
const lines = raw.split(/\r?\n/);

function stripQuotes(v) {
  const t = (v ?? '').trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

console.log('=== ALL KEY NAMES IN .env (values redacted) ===');
for (const line of lines) {
  const t = line.trim();
  if (!t) {
    console.log('(blank)');
    continue;
  }
  if (t.startsWith('#')) {
    console.log('//', t.slice(0, 80));
    continue;
  }
  const eq = t.indexOf('=');
  if (eq < 1) {
    console.log('?', t.slice(0, 40));
    continue;
  }
  const k = t.slice(0, eq).trim();
  const v = stripQuotes(t.slice(eq + 1));
  console.log(k.padEnd(34), v ? `SET len=${v.length}` : 'EMPTY');
}

const { getXApiStatus, getXCredentials } = await import('../src/xApi.js');
const c = getXCredentials();
console.log('\n=== Resolved for bot posting ===');
console.log('X_API_KEY             ', c.apiKey ? `SET len=${c.apiKey.length}` : 'MISSING');
console.log('X_API_SECRET          ', c.apiSecret ? `SET len=${c.apiSecret.length}` : 'MISSING');
console.log('X_ACCESS_TOKEN        ', c.accessToken ? `SET len=${c.accessToken.length}` : 'MISSING');
console.log('X_ACCESS_TOKEN_SECRET ', c.accessSecret ? `SET len=${c.accessSecret.length}` : 'MISSING');
console.log('\nstatus:', getXApiStatus());
