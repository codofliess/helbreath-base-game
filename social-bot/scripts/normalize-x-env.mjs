/**
 * Normalize X credentials in .env to X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET.
 * Does not print secret values. Backs up .env to .env.bak-x
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const bakPath = path.join(root, '.env.bak-x');

const raw = fs.readFileSync(envPath, 'utf8');
fs.writeFileSync(bakPath, raw);

const lines = raw.split(/\r?\n/);
const map = {};

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

for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 1) continue;
  const k = t.slice(0, eq).trim();
  const v = stripQuotes(t.slice(eq + 1));
  if (v) map[k] = v;
}

function pick(keys) {
  for (const k of keys) {
    if (map[k]) return { from: k, value: map[k] };
  }
  return null;
}

// Prefer canonical; then aliases user might have pasted
const apiKey = pick([
  'X_API_KEY',
  'X_CONSUMER_KEY',
  'TWITTER_API_KEY',
  'API_KEY',
  'ConsumerKey',
  'CONSUMER_KEY',
  'X_CLIENT_ID',
  'ClientID',
  'CLIENT_ID',
  'OAuth2_ClientID',
  'OAUTH_CLIENT_ID',
]);
const apiSecret = pick([
  'X_API_SECRET',
  'X_CONSUMER_SECRET',
  'TWITTER_API_SECRET',
  'API_SECRET',
  'API_KEY_SECRET',
  'ConsumerSecret',
  'CONSUMER_SECRET',
  'X_CLIENT_SECRET',
  'ClientSecret',
  'CLIENT_SECRET',
  'OAuth2_ClientSecret',
  'OAUTH_CLIENT_SECRET',
]);
const accessToken = pick([
  'X_ACCESS_TOKEN',
  'TWITTER_ACCESS_TOKEN',
  'ACCESS_TOKEN',
  'AccessToken',
]);
const accessSecret = pick([
  'X_ACCESS_TOKEN_SECRET',
  'TWITTER_ACCESS_TOKEN_SECRET',
  'ACCESS_TOKEN_SECRET',
  'AccessTokenSecret',
  'ACCESS_SECRET',
]);

// Heuristic: if only ClientID+ClientSecret and long access-looking tokens under weird names, keep pick only

console.log('Mapped:');
console.log('  X_API_KEY              <-', apiKey ? `${apiKey.from} (len ${apiKey.value.length})` : 'MISSING');
console.log('  X_API_SECRET           <-', apiSecret ? `${apiSecret.from} (len ${apiSecret.value.length})` : 'MISSING');
console.log('  X_ACCESS_TOKEN         <-', accessToken ? `${accessToken.from} (len ${accessToken.value.length})` : 'MISSING');
console.log('  X_ACCESS_TOKEN_SECRET  <-', accessSecret ? `${accessSecret.from} (len ${accessSecret.value.length})` : 'MISSING');

// Rebuild .env: drop duplicate X-ish keys, write canonical block at end
const drop = new Set([
  'X_API_KEY',
  'X_API_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_TOKEN_SECRET',
  'X_CONSUMER_KEY',
  'X_CONSUMER_SECRET',
  'X_CLIENT_ID',
  'X_CLIENT_SECRET',
  'ClientID',
  'ClientSecret',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'OAuth2_ClientID',
  'OAuth2_ClientSecret',
  'ConsumerKey',
  'ConsumerSecret',
  'AccessToken',
  'AccessTokenSecret',
  'API_KEY',
  'API_SECRET',
  'API_KEY_SECRET',
  'ACCESS_TOKEN',
  'ACCESS_TOKEN_SECRET',
  'TWITTER_API_KEY',
  'TWITTER_API_SECRET',
  'TWITTER_ACCESS_TOKEN',
  'TWITTER_ACCESS_TOKEN_SECRET',
  'BEARER_TOKEN',
  'X_BEARER_TOKEN',
]);

const out = [];
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) {
    // skip old X comment blocks that we'll replace
    if (/X API|OAuth|ChainLordsHQ posting|Consumer|Access Token/i.test(t) && t.startsWith('#')) {
      continue;
    }
    out.push(line);
    continue;
  }
  const eq = t.indexOf('=');
  if (eq < 1) {
    out.push(line);
    continue;
  }
  const k = t.slice(0, eq).trim();
  if (drop.has(k)) continue;
  out.push(line);
}

// trim trailing empties
while (out.length && out[out.length - 1].trim() === '') out.pop();

out.push('');
out.push('# ========== X API @ChainLordsHQ (OAuth 1.0a — bot posting) ==========');
out.push('# Normalized by scripts/normalize-x-env.mjs');
out.push(`X_API_KEY=${apiKey?.value || ''}`);
out.push(`X_API_SECRET=${apiSecret?.value || ''}`);
out.push(`X_ACCESS_TOKEN=${accessToken?.value || ''}`);
out.push(`X_ACCESS_TOKEN_SECRET=${accessSecret?.value || ''}`);
out.push('OFFICIAL_X_URL=https://x.com/ChainLordsHQ');
out.push('');

fs.writeFileSync(envPath, out.join('\n'), 'utf8');
console.log('Wrote', envPath);
console.log('Backup', bakPath);

// Verify load
process.env.X_API_KEY = apiKey?.value || '';
process.env.X_API_SECRET = apiSecret?.value || '';
process.env.X_ACCESS_TOKEN = accessToken?.value || '';
process.env.X_ACCESS_TOKEN_SECRET = accessSecret?.value || '';
const { getXApiStatus } = await import('../src/xApi.js');
console.log('status', getXApiStatus());
