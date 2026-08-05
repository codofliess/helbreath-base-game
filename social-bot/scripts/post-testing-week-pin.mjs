/**
 * Official Testing Week 1 pin thread for @ChainLordsHQ
 */
import 'dotenv/config';
import crypto from 'crypto';
import { createPost, getXApiStatus, estimatePostCost } from '../src/xApi.js';

function percentEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function envFirst(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

function buildOAuthHeader(method, url) {
  const apiKey = envFirst('X_API_KEY', 'ClientID');
  const apiSecret = envFirst('X_API_SECRET', 'ClientSecret');
  const accessToken = envFirst('X_ACCESS_TOKEN');
  const accessSecret = envFirst('X_ACCESS_TOKEN_SECRET');
  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauth[k])}`)
    .join('&');
  const base = [method, percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  return (
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(', ')
  );
}

async function postTweet(text, replyToId = null) {
  if (text.length > 280) throw new Error(`Too long ${text.length}/280`);
  if (!replyToId) {
    return createPost(text);
  }
  const url = 'https://api.x.com/2/tweets';
  const payload = { text, reply: { in_reply_to_tweet_id: replyToId } };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildOAuthHeader('POST', url),
      'Content-Type': 'application/json',
      'User-Agent': 'ChainLordsSocialBot/0.1',
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  const json = JSON.parse(raw);
  if (!res.ok) {
    throw new Error(
      `X ${res.status}: ${json?.detail || json?.title || json?.errors?.[0]?.message || raw.slice(0, 240)}`,
    );
  }
  const id = json.data.id;
  return { id, text: json.data.text || text, url: `https://x.com/ChainLordsHQ/status/${id}` };
}

// Hashtags: #Solana #SolanaGaming #Web3Gaming (used by Solana game accounts / @solanagaming)
// Avoid #PlayToEarn / price tags (freeze). Helbreath named carefully — not official product.

const t1 = `Helbreath Chain Lords is LIVE — Testing Week 1.

Browser MMO on Solana: open PvP/PvM + Phantom.
Helbreath-inspired. Own brand — not an official Helbreath product.

play.chainlords.net · discord.gg/F4NwwbfKtj
#Solana #SolanaGaming #Web3Gaming`;

const t2 = `Credits (UTC day) — utility only:

Login +1 · AFK +10/4h (max 6)
100 kills +10 (farm cap 50)
10+ monster classes → 2× day credits
EK +10 (max 10/day; testing only)

Settle → pending possible TGE/airdrop.
Not guaranteed · not salary · not investment advice
chainlords.net/#news`;

const t3 = `How to join:
1) Phantom (Solana)
2) play.chainlords.net → Play Now
3) Create char → World

Follow @ChainLordsHQ for news + utility-claim eligibility (optional to play).
Staff never DMs first for seeds.

Welcome, Lords. #Solana #SolanaGaming`;

async function main() {
  console.log('status', getXApiStatus());
  for (const [i, t] of [t1, t2, t3].entries()) {
    console.log(`t${i + 1}`, t.length, t.length > 280 ? 'LONG' : 'ok', '~$', estimatePostCost(t).approxUsd);
  }
  const r1 = await postTweet(t1);
  console.log('ROOT', r1.url);
  const r2 = await postTweet(t2, r1.id);
  console.log('R2', r2.url);
  const r3 = await postTweet(t3, r2.id);
  console.log('R3', r3.url);
  console.log('PIN_THIS', r1.url);
}

main().catch((e) => {
  console.error('FAIL', e.message || e);
  process.exit(1);
});
