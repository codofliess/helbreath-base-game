/**
 * Client-side mentor fallback when `/api/mentor/chat` is unreachable.
 * Mirrors the server's follow-me / market-price intents (Spanish).
 */

export interface MentorClientContext {
    playerName?: string;
    level?: number;
    worldId?: string;
    enrolled?: boolean;
    activeTitle?: string;
    activeHint?: string;
}

export type MentorFallbackKind = 'guide' | 'price' | 'chat';

export interface MentorFallbackResult {
    reply: string;
    kind: MentorFallbackKind;
    source: 'client';
}

function fold(text: string): string {
    return text
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .trim();
}

function containsAny(haystack: string, needles: string[]): boolean {
    return needles.some((n) => haystack.includes(n));
}

/** Follow-me / now / conviene / qué hago. */
export function isFollowMePrompt(message: string): boolean {
    const folded = fold(message);
    if (!folded) {
        return true;
    }
    return containsAny(folded, [
        'sigueme',
        'explicame',
        'conviene',
        'que hago',
        'quehago',
        'guiame',
        'follow me',
        'lo que mas me conviene',
        'lo que tengo que hacer',
        'proximo paso',
        'siguiente paso',
        'que hago ahora',
    ]);
}

/** Price / mercado / cuánto pagan. */
export function isPricePrompt(message: string): boolean {
    const folded = fold(message);
    return containsAny(folded, [
        'precio',
        'price',
        'mercado',
        'pagan',
        'cuanto pagan',
        'cuanto vale',
        'cuanto esta',
        'cotiz',
        'listing',
        'subasta',
        'cuanto por',
    ]);
}

export function classifyMentorPrompt(message: string): MentorFallbackKind {
    if (isPricePrompt(message)) {
        return 'price';
    }
    if (isFollowMePrompt(message)) {
        return 'guide';
    }
    return 'chat';
}

/** Local reply when the game HTTP API is down. Prices stay approximate / no-listings. */
export function clientMentorFallback(message: string, ctx: MentorClientContext = {}): MentorFallbackResult {
    const kind = classifyMentorPrompt(message);
    if (kind === 'price') {
        return {
            kind,
            source: 'client',
            reply:
                'El mercado paga un precio aproximado según los listings activos. ' +
                'Ahora no pude leer el tablero; abre Subasta o pregunta de nuevo en un momento. ' +
                'Sin listings no hay cotización.',
        };
    }

    const name = ctx.playerName?.trim() || 'aventurero';
    const title = ctx.activeTitle?.trim();
    const hint = ctx.activeHint?.trim() ?? '';
    if (title) {
        return {
            kind: 'guide',
            source: 'client',
            reply: `${name}, siguiente paso: ${title}.${hint ? ` ${hint}` : ''}`,
        };
    }

    if (ctx.enrolled) {
        return {
            kind: 'guide',
            source: 'client',
            reply: `${name}, sigue el camino principiante en Quest (F5). Si no hay misión activa, el 1→80 ya está completo.`,
        };
    }

    return {
        kind: 'guide',
        source: 'client',
        reply:
            `${name}, siguiente paso: inscríbete en el camino principiante con Enzu en la granja (F5 Quest). ` +
            'Es opcional y sin penalización.',
    };
}

export const MENTOR_GUIDE_STARTER =
    'Sígueme y explícame todo lo que tengo que hacer ahora / lo que más me conviene.';
