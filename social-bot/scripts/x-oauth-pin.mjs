/**
 * OAuth 1.0a PIN flow — authorize @ChainLordsHQ under an app owned by your personal developer account.
 *
 * Usage:
 *   cd social-bot
 *   # put only app consumer keys in .env (or export):
 *   # X_API_KEY=...  X_API_SECRET=...
 *   node scripts/x-oauth-pin.mjs
 *
 * Then open the URL while logged in as @ChainLordsHQ, paste the PIN, get Access Token + Secret.
 */
import 'dotenv/config';
import crypto from 'crypto';
import readline from 'readline';

const REQUEST_TOKEN_URL = 'https://api.x.com/oauth/request_token';
const AUTHORIZE_URL = 'https://api.x.com/oauth/authorize';
const ACCESS_TOKEN_URL = 'https://api.x.com/oauth/access_token';

function envFirst(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

const apiKey = envFirst('X_API_KEY', 'X_CONSUMER_KEY', 'X_CLIENT_ID', 'ClientID');
const apiSecret = envFirst('X_API_SECRET', 'X_CONSUMER_SECRET', 'X_CLIENT_SECRET', 'ClientSecret');

if (!apiKey || !apiSecret) {
  console.error(
    'Set X_API_KEY + X_API_SECRET in social-bot/.env\n' +
      '(Consumer/API Key + Secret from the app Keys page — not only OAuth 2.0 labels if they differ).\n' +
      'Also accepted: X_CLIENT_ID / X_CLIENT_SECRET or ClientID / ClientSecret',
  );
  process.exit(1);
}

function percentEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function oauthHeader(method, url, extra = {}, tokenSecret = '') {
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
    ...extra,
  };
  const all = { ...oauth };
  // Include query/body oauth params already in oauth object
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(String(all[k]))}`)
    .join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(tokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(String(oauth[k]))}"`)
      .join(', ')
  );
}

function parseForm(body) {
  const out = {};
  for (const part of body.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return out;
}

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(q, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  console.log('=== X OAuth PIN — authorize posting account ===\n');
  console.log('1) App stays on your PERSONAL developer account (billing / SuperGrok ecosystem).');
  console.log('2) You will authorize as @ChainLordsHQ in the browser.\n');

  // Request token (oob = PIN)
  const auth1 = oauthHeader('POST', REQUEST_TOKEN_URL, { oauth_callback: 'oob' });
  const r1 = await fetch(REQUEST_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: auth1 },
  });
  const t1 = await r1.text();
  if (!r1.ok) {
    console.error('request_token failed', r1.status, t1);
    process.exit(1);
  }
  const req = parseForm(t1);
  if (!req.oauth_token || !req.oauth_token_secret) {
    console.error('Unexpected request_token response:', t1);
    process.exit(1);
  }

  const url = `${AUTHORIZE_URL}?oauth_token=${req.oauth_token}`;
  console.log('Open this URL in a browser where you are logged in as **@ChainLordsHQ**:\n');
  console.log(url);
  console.log('\nAuthorize the app, then copy the PIN.\n');

  const pin = await ask('PIN: ');
  if (!pin) {
    console.error('No PIN');
    process.exit(1);
  }

  const auth2 = oauthHeader(
    'POST',
    ACCESS_TOKEN_URL,
    {
      oauth_token: req.oauth_token,
      oauth_verifier: pin,
    },
    req.oauth_token_secret,
  );
  const r2 = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: auth2 },
  });
  const t2 = await r2.text();
  if (!r2.ok) {
    console.error('access_token failed', r2.status, t2);
    process.exit(1);
  }
  const acc = parseForm(t2);
  console.log('\n=== SUCCESS — paste into social-bot/.env ===\n');
  console.log(`X_API_KEY=${apiKey}`);
  console.log(`X_API_SECRET=${apiSecret}`);
  console.log(`X_ACCESS_TOKEN=${acc.oauth_token}`);
  console.log(`X_ACCESS_TOKEN_SECRET=${acc.oauth_token_secret}`);
  console.log(`# screen_name=${acc.screen_name || '?'} user_id=${acc.user_id || '?'}`);
  console.log('\nVerify screen_name is ChainLordsHQ. Then: npm start → /content x-status\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
