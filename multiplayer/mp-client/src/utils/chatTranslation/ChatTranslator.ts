import {
    getChatLanguageById,
    getChatLanguageByTag,
    shareChatMtCode,
} from '../../constants/ChatLanguages';

/**
 * Pluggable chat machine-translation backend for Holy Spirit-style incoming chat.
 */
export interface ChatTranslator {
    translate(text: string, sourceTagOrId: string | undefined, targetLanguageId: string): Promise<string>;
}

/** Shared demo phrases so MVP works without an external MT API. */
const DEMO_PHRASES: ReadonlyArray<{ en: string; es: string; pt: string }> = [
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

function normalizePhraseKey(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[¡!¿?.,;:'"`]/g, '')
        .replace(/\s+/g, ' ');
}

function resolveMtCode(tagOrId: string | undefined): string | undefined {
    const option = getChatLanguageById(tagOrId) ?? getChatLanguageByTag(tagOrId);
    return option?.mtCode;
}

/**
 * Offline phrase-table translator used when no LibreTranslate-compatible endpoint is configured.
 */
export class DemoPhraseChatTranslator implements ChatTranslator {
    public async translate(
        text: string,
        sourceTagOrId: string | undefined,
        targetLanguageId: string,
    ): Promise<string> {
        if (shareChatMtCode(sourceTagOrId, targetLanguageId)) {
            return text;
        }

        const targetMt = resolveMtCode(targetLanguageId);
        if (!targetMt) {
            return text;
        }

        const key = normalizePhraseKey(text);
        for (const row of DEMO_PHRASES) {
            const candidates: Array<{ mt: string; value: string }> = [
                { mt: 'en', value: row.en },
                { mt: 'es', value: row.es },
                { mt: 'pt', value: row.pt },
            ];
            const match = candidates.find((c) => normalizePhraseKey(c.value) === key);
            if (!match) {
                continue;
            }
            const translated = candidates.find((c) => c.mt === targetMt)?.value;
            if (translated) {
                return preserveCasingHint(text, translated);
            }
        }

        return text;
    }
}

/**
 * LibreTranslate-compatible HTTP translator (`POST { q, source, target, format }` → `{ translatedText }`).
 * Point `VITE_CHAT_TRANSLATE_URL` at a LibreTranslate instance or the middleware `/chat/translate` proxy.
 */
export class LibreTranslateChatTranslator implements ChatTranslator {
    private readonly endpoint: string;
    private readonly fallback: ChatTranslator;

    public constructor(endpoint: string, fallback: ChatTranslator = new DemoPhraseChatTranslator()) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.fallback = fallback;
    }

    public async translate(
        text: string,
        sourceTagOrId: string | undefined,
        targetLanguageId: string,
    ): Promise<string> {
        if (shareChatMtCode(sourceTagOrId, targetLanguageId)) {
            return text;
        }

        const targetMt = resolveMtCode(targetLanguageId);
        if (!targetMt) {
            return text;
        }

        const sourceMt = resolveMtCode(sourceTagOrId) ?? 'auto';

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    q: text,
                    source: sourceMt,
                    target: targetMt,
                    format: 'text',
                }),
            });

            if (!response.ok) {
                console.warn('[ChatTranslator] translate HTTP', response.status);
                return this.fallback.translate(text, sourceTagOrId, targetLanguageId);
            }

            const payload = (await response.json()) as { translatedText?: string };
            const translated = payload.translatedText?.trim();
            if (!translated) {
                return this.fallback.translate(text, sourceTagOrId, targetLanguageId);
            }
            return translated;
        } catch (error) {
            console.warn('[ChatTranslator] translate failed', error);
            return this.fallback.translate(text, sourceTagOrId, targetLanguageId);
        }
    }
}

let cachedTranslator: ChatTranslator | undefined;

/** Returns the process-wide chat translator (explicit URL, else offline demo phrases). */
export function getChatTranslator(): ChatTranslator {
    if (cachedTranslator) {
        return cachedTranslator;
    }

    const explicit = (import.meta.env.VITE_CHAT_TRANSLATE_URL ?? '').toString().trim();
    if (explicit) {
        cachedTranslator = new LibreTranslateChatTranslator(explicit);
        return cachedTranslator;
    }

    // Default MVP path: offline phrase table (no network). Point VITE_CHAT_TRANSLATE_URL at
    // middleware `/chat/translate` or a LibreTranslate instance for full MT.
    cachedTranslator = new DemoPhraseChatTranslator();
    return cachedTranslator;
}

/** Formats a chat line with an optional speaker language tag: `text (eng)`. */
export function formatChatDisplayMessage(
    text: string,
    sourceLanguageTag: string | undefined,
    showSpeakerLanguageTag: boolean,
): string {
    if (!showSpeakerLanguageTag || !sourceLanguageTag) {
        return text;
    }
    return `${text} (${sourceLanguageTag})`;
}

function preserveCasingHint(original: string, translated: string): string {
    if (original.length > 0 && original[0] === original[0].toUpperCase()) {
        return translated.charAt(0).toUpperCase() + translated.slice(1);
    }
    return translated;
}
