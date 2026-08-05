/**
 * Holy Spirit-style chat translation proxy.
 * Forwards to a LibreTranslate-compatible endpoint when CHAT_TRANSLATE_URL is set;
 * otherwise answers from a small offline phrase table so the MVP works without paid keys.
 */

const DEMO_PHRASES = [
    { en: 'hi im martin', es: 'hola soy martin', pt: 'eu sou martin' },
    { en: 'hello', es: 'hola', pt: 'ola' },
    { en: 'hi', es: 'hola', pt: 'oi' },
    { en: 'thanks', es: 'gracias', pt: 'obrigado' },
    { en: 'thank you', es: 'gracias', pt: 'obrigado' },
    { en: 'good luck', es: 'buena suerte', pt: 'boa sorte' },
    { en: 'gg', es: 'gg', pt: 'gg' },
    { en: 'help', es: 'ayuda', pt: 'ajuda' },
    { en: 'where are you', es: 'donde estas', pt: 'onde voce esta' },
    { en: 'lets go', es: 'vamos', pt: 'vamos' },
    { en: 'wait', es: 'espera', pt: 'espera' },
    { en: 'yes', es: 'si', pt: 'sim' },
    { en: 'no', es: 'no', pt: 'nao' },
];

function normalizePhraseKey(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[¡!¿?.,;:'"`]/g, '')
        .replace(/\s+/g, ' ');
}

function demoTranslate(q, source, target) {
    const key = normalizePhraseKey(q);
    for (const row of DEMO_PHRASES) {
        const candidates = [
            { mt: 'en', value: row.en },
            { mt: 'es', value: row.es },
            { mt: 'pt', value: row.pt },
        ];
        const match = candidates.find((c) => normalizePhraseKey(c.value) === key);
        if (!match) {
            continue;
        }
        if (source && source !== 'auto' && match.mt !== source) {
            continue;
        }
        const translated = candidates.find((c) => c.mt === target)?.value;
        if (translated) {
            return translated;
        }
    }
    return q;
}

function registerChatTranslateRoutes(app) {
    app.post('/chat/translate', async (req, res) => {
        const q = typeof req.body?.q === 'string' ? req.body.q : '';
        const source = typeof req.body?.source === 'string' ? req.body.source : 'auto';
        const target = typeof req.body?.target === 'string' ? req.body.target : '';
        const format = typeof req.body?.format === 'string' ? req.body.format : 'text';

        if (!q.trim() || !target.trim()) {
            res.status(400).json({ error: 'q and target are required' });
            return;
        }

        const upstream = (process.env.CHAT_TRANSLATE_URL || '').trim();
        if (!upstream) {
            res.json({ translatedText: demoTranslate(q, source, target), provider: 'demo-phrases' });
            return;
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            const apiKey = (process.env.CHAT_TRANSLATE_API_KEY || '').trim();
            const body = {
                q,
                source: source || 'auto',
                target,
                format: format || 'text',
            };
            if (apiKey) {
                body.api_key = apiKey;
            }

            const response = await fetch(upstream, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                console.warn('[chat/translate] upstream', response.status, payload);
                res.json({
                    translatedText: demoTranslate(q, source, target),
                    provider: 'demo-phrases-fallback',
                });
                return;
            }

            const translatedText =
                typeof payload.translatedText === 'string' ? payload.translatedText : demoTranslate(q, source, target);
            res.json({ translatedText, provider: 'libretranslate' });
        } catch (error) {
            console.warn('[chat/translate] upstream failed', error);
            res.json({
                translatedText: demoTranslate(q, source, target),
                provider: 'demo-phrases-fallback',
            });
        }
    });
}

module.exports = { registerChatTranslateRoutes };
