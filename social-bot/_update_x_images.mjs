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

async function postForm(url, formFields) {
  const auth = oauthHeader('POST', url, formFields);
  const body = new URLSearchParams(formFields);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ChainLordsSocialBot/0.1',
    },
    body,
  });
  const text = await res.text();
  console.log(url, res.status, text.slice(0, 400));
}

const avatarB64 = fs.readFileSync('C:/Users/54116/helbreath-base-game/branding/abaddon-icon/abaddon-256.png').toString('base64');
const bannerB64 = fs.readFileSync('C:/Users/54116/helbreath-base-game/branding/abaddon-icon/x-header-abaddon-1500x500.jpg').toString('base64');
await postForm('https://api.twitter.com/1.1/account/update_profile_image.json', { image: avatarB64 });
await postForm('https://api.twitter.com/1.1/account/update_profile_banner.json', { banner: bannerB64 });
