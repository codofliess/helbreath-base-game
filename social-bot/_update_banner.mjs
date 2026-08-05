import fs from 'fs';
import crypto from 'crypto';
import { getXCredentials } from './src/xApi.js';
function percentEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}
function oauthHeader(method, url, extra = {}) {
  const { apiKey, apiSecret, accessToken, accessSecret } = getXCredentials();
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const all = { ...extra, ...oauth };
  const paramString = Object.keys(all).sort().map(k => `${percentEncode(k)}=${percentEncode(all[k])}`).join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${percentEncode(k)}="${percentEncode(oauth[k])}"`).join(', ');
}
const url = 'https://api.twitter.com/1.1/account/update_profile_banner.json';
const banner = fs.readFileSync('C:/Users/54116/helbreath-base-game/branding/abaddon-icon/x-header-abaddon-1500x500.jpg').toString('base64');
const fields = { banner };
const auth = oauthHeader('POST', url, fields);
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ChainLordsSocialBot/0.1' },
  body: new URLSearchParams(fields),
});
console.log('banner', res.status, (await res.text()).slice(0, 120));
