/**
 * Extract X credentials pasted as free-form "Copy / label / value" from console dialogs
 * into canonical X_API_* KEY=value lines. Never prints secret values.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const bakPath = path.join(root, '.env.bak-x-extract');

const raw = fs.readFileSync(envPath, 'utf8');
fs.writeFileSync(bakPath, raw);

const lines = raw.split(/\r?\n/);

/** @type {Record<string, string>} */
const found = {};

function looksLikeToken(s) {
  const t = s.trim();
  if (t.length < 15) return false;
  if (/^(copy|client id|client secret|consumer key|access token|oauth|save them|treat them|your new|do not|if security|generate|regenerate|did you)/i.test(t)) {
    return false;
  }
  // typical X keys: alnum, dash, underscore
  return /^[A-Za-z0-9_\-]{15,200}$/.test(t);
}

// Pass 1: KEY=value lines
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!v) continue;
  if (k === 'X_API_KEY' || k === 'ClientID' || k === 'CLIENT_ID') found.apiKey = v;
  if (k === 'X_API_SECRET' || k === 'ClientSecret' || k === 'CLIENT_SECRET') found.apiSecret = v;
  if (k === 'X_ACCESS_TOKEN') found.accessToken = v;
  if (k === 'X_ACCESS_TOKEN_SECRET') found.accessSecret = v;
}

// Pass 2: free-form paste (label then value on following non-empty lines, skip "Copy")
const labels = [
  { re: /^client\s*id\s*$/i, key: 'oauth2ClientId' },
  { re: /^client\s*secret\s*$/i, key: 'oauth2ClientSecret' },
  { re: /^consumer\s*key(\s*secret)?\s*$/i, key: null }, // special
  { re: /^access\s*token(\s*secret)?\s*$/i, key: null },
];

for (let i = 0; i < lines.length; i++) {
  const t = lines[i].trim();
  if (!t) continue;

  if (/^consumer\s*key\s*secret\s*$/i.test(t) || /^consumer\s*secret\s*$/i.test(t) || /^api\s*key\s*secret\s*$/i.test(t)) {
    // next token-looking line
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.apiSecret = v;
        break;
      }
    }
    continue;
  }
  if (/^consumer\s*key\s*$/i.test(t) || /^api\s*key\s*$/i.test(t)) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.apiKey = v;
        break;
      }
    }
    continue;
  }
  if (/^access\s*token\s*secret\s*$/i.test(t)) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.accessSecret = v;
        break;
      }
    }
    continue;
  }
  if (/^access\s*token\s*$/i.test(t)) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.accessToken = v;
        break;
      }
    }
    continue;
  }
  if (/^client\s*id\s*$/i.test(t)) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.oauth2ClientId = v;
        break;
      }
    }
  }
  if (/^client\s*secret\s*$/i.test(t)) {
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const v = lines[j].trim();
      if (!v || /^copy$/i.test(v)) continue;
      if (looksLikeToken(v)) {
        found.oauth2ClientSecret = v;
        break;
      }
    }
  }
}

// Prefer OAuth 1.0 consumer over OAuth 2.0 client if both present
// (bot uses OAuth 1.0a). If only oauth2 present, keep as apiKey/apiSecret fallback.
if (!found.apiKey && found.oauth2ClientId) found.apiKey = found.oauth2ClientId;
if (!found.apiSecret && found.oauth2ClientSecret) found.apiSecret = found.oauth2ClientSecret;

console.log('Extracted:');
console.log('  apiKey       ', found.apiKey ? `yes len=${found.apiKey.length}` : 'NO');
console.log('  apiSecret    ', found.apiSecret ? `yes len=${found.apiSecret.length}` : 'NO');
console.log('  accessToken  ', found.accessToken ? `yes len=${found.accessToken.length}` : 'NO');
console.log('  accessSecret ', found.accessSecret ? `yes len=${found.accessSecret.length}` : 'NO');

// Rebuild clean .env: keep proper KEY=value non-X lines
const keep = [];
const skipKey = new Set([
  'X_API_KEY',
  'X_API_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_TOKEN_SECRET',
  'ClientID',
  'ClientSecret',
  'CLIENT_ID',
  'CLIENT_SECRET',
  'OFFICIAL_X_URL',
]);

for (const line of lines) {
  const t = line.trim();
  if (!t) {
    // skip blank-heavy paste region later
    keep.push(line);
    continue;
  }
  if (t.startsWith('#')) {
    // drop old X paste instruction comments in the middle of freeform — keep normal comments
    if (/After PIN|Normalized by|X API @ChainLords|OAuth 1\.0a/i.test(t)) continue;
    keep.push(line);
    continue;
  }
  const eq = t.indexOf('=');
  if (eq >= 1) {
    const k = t.slice(0, eq).trim();
    if (skipKey.has(k)) continue;
    keep.push(line);
    continue;
  }
  // Drop free-form X credential paste lines
  if (
    /oauth|client id|client secret|consumer key|access token|copy|save them|treat them|your new credentials|do not store|if security has been compromised|generate an access|did you save|desde la x account|api key and secret/i.test(
      t,
    )
  ) {
    continue;
  }
  if (looksLikeToken(t)) {
    // bare secret lines from paste — drop (we extracted them)
    continue;
  }
  // unknown prose — drop if looks like X dialog
  if (/^from the x account/i.test(t)) continue;
  keep.push(line);
}

// compact multiple blanks
const compact = [];
let blanks = 0;
for (const line of keep) {
  if (line.trim() === '') {
    blanks += 1;
    if (blanks <= 1) compact.push('');
  } else {
    blanks = 0;
    compact.push(line);
  }
}
while (compact.length && compact[compact.length - 1].trim() === '') compact.pop();

compact.push('');
compact.push('# ========== X API @ChainLordsHQ (OAuth 1.0a) ==========');
compact.push('# Extracted from console paste by scripts/extract-x-paste.mjs');
compact.push(`X_API_KEY=${found.apiKey || ''}`);
compact.push(`X_API_SECRET=${found.apiSecret || ''}`);
compact.push(`X_ACCESS_TOKEN=${found.accessToken || ''}`);
compact.push(`X_ACCESS_TOKEN_SECRET=${found.accessSecret || ''}`);
compact.push('OFFICIAL_X_URL=https://x.com/ChainLordsHQ');
compact.push('');

fs.writeFileSync(envPath, compact.join('\n'), 'utf8');
console.log('Wrote clean .env + backup', bakPath);

// verify
process.env.X_API_KEY = found.apiKey || '';
process.env.X_API_SECRET = found.apiSecret || '';
process.env.X_ACCESS_TOKEN = found.accessToken || '';
process.env.X_ACCESS_TOKEN_SECRET = found.accessSecret || '';
const { getXApiStatus } = await import('../src/xApi.js');
console.log('status', getXApiStatus());
