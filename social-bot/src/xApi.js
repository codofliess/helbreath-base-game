/**
 * X API v2 — post as @ChainLordsHQ via OAuth 1.0a user context.
 *
 * Env (from Developer Console → app → Keys and tokens):
 *   X_API_KEY              Consumer Key
 *   X_API_SECRET           Consumer Secret
 *   X_ACCESS_TOKEN         Access Token (user @ChainLordsHQ)
 *   X_ACCESS_TOKEN_SECRET  Access Token Secret
 *
 * Pricing (pay-per-use): text post ~$0.015; post with URL ~$0.20
 * Docs: https://docs.x.com/x-api/getting-started/pricing
 */
import crypto from 'crypto';

const API_BASE = 'https://api.x.com/2';

/**
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
/** Resolve env with common aliases (user may paste OAuth 2.0 labels). */
function envFirst(...keys) {
  for (const k of keys) {
    const v = (process.env[k] || '').trim();
    if (v) return v;
  }
  return '';
}

export function getXCredentials() {
  // Prefer explicit OAuth 1.0a names; accept OAuth 2.0 Client* only as last-resort aliases
  // (on X they are sometimes the same app credentials, sometimes not — PIN flow needs consumer key/secret).
  return {
    apiKey: envFirst('X_API_KEY', 'X_CONSUMER_KEY', 'TWITTER_API_KEY', 'X_CLIENT_ID', 'ClientID'),
    apiSecret: envFirst(
      'X_API_SECRET',
      'X_CONSUMER_SECRET',
      'TWITTER_API_SECRET',
      'X_CLIENT_SECRET',
      'ClientSecret',
    ),
    accessToken: envFirst('X_ACCESS_TOKEN', 'TWITTER_ACCESS_TOKEN'),
    accessSecret: envFirst('X_ACCESS_TOKEN_SECRET', 'TWITTER_ACCESS_TOKEN_SECRET'),
  };
}

export function getXApiStatus() {
  const { apiKey, apiSecret, accessToken, accessSecret } = getXCredentials();
  const missing = [];
  if (!apiKey) missing.push('X_API_KEY (Consumer/API Key)');
  if (!apiSecret) missing.push('X_API_SECRET (Consumer/API Secret)');
  if (!accessToken) missing.push('X_ACCESS_TOKEN (from PIN as @ChainLordsHQ)');
  if (!accessSecret) missing.push('X_ACCESS_TOKEN_SECRET (from PIN)');
  if (missing.length) {
    return {
      ok: false,
      reason: `Missing: ${missing.join('; ')}. OAuth 2.0 ClientID/ClientSecret alone are not enough — use Keys (Consumer) + PIN access tokens. See docs/social/X-API-SETUP.md`,
    };
  }
  return { ok: true };
}

function percentEncode(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * OAuth 1.0a Authorization header for a request.
 * @param {'GET'|'POST'} method
 * @param {string} url absolute URL without query for signature base (params go in oauth/body)
 * @param {Record<string, string>} extraParams extra oauth or body form params included in signature
 */
function buildOAuthHeader(method, url, extraParams = {}) {
  const { apiKey, apiSecret, accessToken, accessSecret } = getXCredentials();
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    throw new Error('X credentials incomplete.');
  }

  const oauth = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const all = { ...extraParams, ...oauth };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(all[k])}`)
    .join('&');

  const base = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
  oauth.oauth_signature = signature;

  const header =
    'OAuth ' +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(', ');

  return header;
}

/**
 * Create a post on X (max 280 for standard; caller should pre-trim).
 * @param {string} text
 * @returns {Promise<{ id: string, text: string, url: string }>}
 */
export async function createPost(text) {
  const status = getXApiStatus();
  if (!status.ok) {
    throw new Error(status.reason);
  }

  const bodyText = (text || '').trim();
  if (!bodyText) {
    throw new Error('Empty post text.');
  }
  if (bodyText.length > 280) {
    throw new Error(`Post too long (${bodyText.length}/280). Use /content show and trim.`);
  }

  const url = `${API_BASE}/tweets`;
  // JSON body is NOT included in OAuth 1.0a signature params for X API v2
  const auth = buildOAuthHeader('POST', url, {});

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      'User-Agent': 'ChainLordsSocialBot/0.1',
    },
    body: JSON.stringify({ text: bodyText }),
  });

  const raw = await res.text();
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`X API non-JSON ${res.status}: ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    const detail =
      json?.detail ||
      json?.title ||
      json?.errors?.[0]?.message ||
      raw.slice(0, 240);
    throw new Error(`X API ${res.status}: ${detail}`);
  }

  const id = json?.data?.id;
  const posted = json?.data?.text || bodyText;
  if (!id) {
    throw new Error(`X API success but no id: ${raw.slice(0, 200)}`);
  }

  return {
    id: String(id),
    text: posted,
    url: `https://x.com/ChainLordsHQ/status/${id}`,
  };
}

/**
 * Rough cost hint for ops (official pay-per-use; subject to change).
 */
export function estimatePostCost(text) {
  const hasUrl = /https?:\/\//i.test(text || '');
  return {
    hasUrl,
    approxUsd: hasUrl ? 0.2 : 0.015,
    note: hasUrl
      ? 'Posts with URLs cost ~$0.20 each on pay-per-use.'
      : 'Text-only posts cost ~$0.015 each on pay-per-use.',
  };
}
