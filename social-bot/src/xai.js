/**
 * Minimal OpenAI-compatible chat completion against xAI API.
 * @param {{ apiKey: string, baseUrl: string, model: string, system: string, messages: {role:string,content:string}[], temperature?: number, maxTokens?: number, channel?: string }} opts
 */
import { logXaiUsage } from './usageLog.js';

export async function chatCompletion(opts) {
  const {
    apiKey,
    baseUrl,
    model,
    system,
    messages,
    temperature = 0.4,
    maxTokens = 500,
    channel = 'faq',
  } = opts;
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const promptChars = (system?.length || 0) + messages.reduce((n, m) => n + (m.content?.length || 0), 0);
  const t0 = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
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
      throw new Error(`xAI API ${res.status}: ${text.slice(0, 400)}`);
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
      throw new Error('xAI API: empty completion');
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
    return out;
  } catch (e) {
    if (!String(e.message || '').startsWith('xAI API')) {
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
