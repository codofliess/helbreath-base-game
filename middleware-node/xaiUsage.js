/**
 * Append-only xAI usage log + model resolution for FAQ / market / in-game channels.
 */
const fs = require('fs');
const path = require('path');

const LOG_PATH =
  process.env.XAI_USAGE_LOG || path.join(__dirname, 'data', 'xai-usage.jsonl');

/** Cheap high-volume (Discord FAQ + market NL). */
function modelFaq() {
  return (
    process.env.XAI_MODEL_FAQ ||
    process.env.XAI_MODEL ||
    'grok-4-1-fast-non-reasoning'
  ).trim();
}

/** Market advisor — default same as FAQ. */
function modelMarket() {
  return (process.env.XAI_MODEL_MARKET || modelFaq()).trim();
}

/** In-game assistant — quality tier (PO: Grok 4.3). */
function modelIngame() {
  return (process.env.XAI_MODEL_INGAME || 'grok-4.3').trim();
}

function logXaiUsage(entry) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(
      LOG_PATH,
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
      'utf8'
    );
  } catch (e) {
    console.warn('[xai-usage]', e.message);
  }
}

/**
 * @param {{ apiKey: string, model: string, channel: string, system: string, user: string, temperature?: number, maxTokens?: number }} opts
 */
async function chatCompletion(opts) {
  const base = (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const {
    apiKey,
    model,
    channel,
    system,
    user,
    temperature = 0.4,
    maxTokens = 500,
  } = opts;
  const promptChars = (system?.length || 0) + (user?.length || 0);
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      logXaiUsage({
        channel,
        model,
        ok: false,
        latencyMs: Date.now() - t0,
        promptChars,
        replyChars: 0,
        error: `HTTP ${res.status}`,
      });
      throw new Error(`xAI ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      logXaiUsage({
        channel,
        model,
        ok: false,
        latencyMs: Date.now() - t0,
        promptChars,
        replyChars: 0,
        error: 'empty',
      });
      throw new Error('xAI empty completion');
    }
    const out = content.trim();
    logXaiUsage({
      channel,
      model,
      ok: true,
      latencyMs: Date.now() - t0,
      promptChars,
      replyChars: out.length,
      usage: data.usage || null,
    });
    return { content: out, model, usage: data.usage || null };
  } catch (e) {
    if (!String(e.message || '').startsWith('xAI')) {
      logXaiUsage({
        channel,
        model,
        ok: false,
        latencyMs: Date.now() - t0,
        promptChars,
        replyChars: 0,
        error: String(e.message || e).slice(0, 200),
      });
    }
    throw e;
  }
}

/** Summarize jsonl for ops reports. */
function summarizeUsage(limitLines = 5000) {
  if (!fs.existsSync(LOG_PATH)) {
    return { file: LOG_PATH, total: 0, byChannel: {}, byModel: {} };
  }
  const lines = fs.readFileSync(LOG_PATH, 'utf8').trim().split(/\n/).filter(Boolean);
  const slice = lines.slice(-limitLines);
  const byChannel = {};
  const byModel = {};
  let ok = 0;
  let fail = 0;
  let prompt = 0;
  let reply = 0;
  for (const line of slice) {
    try {
      const r = JSON.parse(line);
      const ch = r.channel || 'unknown';
      const m = r.model || 'unknown';
      byChannel[ch] = (byChannel[ch] || 0) + 1;
      byModel[m] = (byModel[m] || 0) + 1;
      if (r.ok) ok += 1;
      else fail += 1;
      prompt += r.promptChars || 0;
      reply += r.replyChars || 0;
    } catch {
      /* skip */
    }
  }
  return {
    file: LOG_PATH,
    total: slice.length,
    ok,
    fail,
    promptChars: prompt,
    replyChars: reply,
    byChannel,
    byModel,
  };
}

module.exports = {
  modelFaq,
  modelMarket,
  modelIngame,
  logXaiUsage,
  chatCompletion,
  summarizeUsage,
  LOG_PATH,
};
