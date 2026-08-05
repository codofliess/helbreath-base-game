/**
 * In-game assistant (quality model — default Grok 4.3).
 * POST /assistant/ingame  { message, characterName?, locale? }
 */
const { chatCompletion, modelIngame, summarizeUsage } = require('./xaiUsage');

const INGAME_SYSTEM = `You are the **Helbreath Chain Lords** in-game assistant for players in the browser MMO soft test.

Help with: UI (F-keys), beginner path, cities Aresden/Elvine, traveler zone, timed challenges, PvP Academy desks, auction/market (high level), AFK rules, wallet login, bugs → report calmly.

NEVER: combat exploits, gold dupe, bot scripts, scams, investment/financial advice, or instructions to harm other players' accounts.
Keep answers practical, short-to-medium. Match user language (EN or ES).
Official site: chainlords.net. Soft test = bugs expected; be honest and kind.`;

function registerAssistantRoutes(app) {
  app.post('/assistant/ingame', async (req, res) => {
    const message = String(req.body?.message || req.body?.text || '').trim();
    if (!message) {
      return res.status(400).json({ ok: false, error: 'message required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ ok: false, error: 'message too long' });
    }

    const apiKey = (process.env.XAI_API_KEY || '').trim();
    if (apiKey.length < 8) {
      return res.status(503).json({
        ok: false,
        error: 'In-game assistant offline (no XAI_API_KEY)',
        fallback:
          'Try Discord /faq or #support. Official: https://www.chainlords.net',
      });
    }

    const characterName = String(req.body?.characterName || '').slice(0, 40);
    const locale = String(req.body?.locale || '').slice(0, 8);
    const model = modelIngame();
    const userBlock = [
      locale ? `locale=${locale}` : '',
      characterName ? `character=${characterName}` : '',
      message,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { content, usage } = await chatCompletion({
        apiKey,
        model,
        channel: 'ingame',
        system: INGAME_SYSTEM,
        user: userBlock,
        temperature: 0.45,
        maxTokens: Number(process.env.XAI_INGAME_MAX_TOKENS || 700),
      });
      res.json({
        ok: true,
        reply: content,
        model,
        usage: usage || null,
      });
    } catch (e) {
      console.warn('[assistant/ingame]', e.message);
      res.status(502).json({
        ok: false,
        error: 'assistant_error',
        detail: String(e.message || e).slice(0, 200),
        model,
      });
    }
  });

  /** Ops: usage summary for model routing reports. */
  app.get('/assistant/usage-report', (req, res) => {
    const secret = (req.headers['x-market-sync-secret'] || req.query?.secret || '').toString();
    const expected = (process.env.MARKET_SYNC_SECRET || process.env.REALM_STATS_SECRET || '').trim();
    if (expected && secret !== expected) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    res.json({
      ok: true,
      policy: {
        faq: process.env.XAI_MODEL_FAQ || process.env.XAI_MODEL || 'grok-4-1-fast-non-reasoning',
        market: process.env.XAI_MODEL_MARKET || 'same-as-faq',
        ingame: process.env.XAI_MODEL_INGAME || 'grok-4.3',
      },
      summary: summarizeUsage(),
    });
  });

  console.log(
    `✅ Assistant: POST /assistant/ingame (model=${modelIngame()}) · GET /assistant/usage-report`
  );
}

module.exports = { registerAssistantRoutes };
