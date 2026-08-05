/**
 * Chat language options for Holy Spirit-style translation preferences.
 * `tag` is the short parenthetical shown to other viewers (e.g. eng, arg, bra).
 * `mtCode` is the LibreTranslate-compatible language code used by the translator.
 */

export interface ChatLanguageOption {
    /** Stable preference id stored in localStorage. */
    id: string;
    /** Short locale tag shown in parentheses next to translated lines. */
    tag: string;
    /** Human-readable label for SysMenu. */
    label: string;
    /** Machine-translation language code (LibreTranslate-compatible). */
    mtCode: string;
}

export const CHAT_LANGUAGE_OPTIONS: readonly ChatLanguageOption[] = [
    { id: 'en', tag: 'eng', label: 'English', mtCode: 'en' },
    { id: 'es', tag: 'spa', label: 'Spanish', mtCode: 'es' },
    { id: 'es-AR', tag: 'arg', label: 'Spanish (AR)', mtCode: 'es' },
    { id: 'pt', tag: 'por', label: 'Portuguese', mtCode: 'pt' },
    { id: 'pt-BR', tag: 'bra', label: 'Portuguese (BR)', mtCode: 'pt' },
] as const;

const OPTIONS_BY_ID = new Map(CHAT_LANGUAGE_OPTIONS.map((option) => [option.id, option]));
const OPTIONS_BY_TAG = new Map(CHAT_LANGUAGE_OPTIONS.map((option) => [option.tag.toLowerCase(), option]));

/** Resolves a preference id to a known option, or undefined when unknown. */
export function getChatLanguageById(id: string | undefined): ChatLanguageOption | undefined {
    if (!id) {
        return undefined;
    }
    return OPTIONS_BY_ID.get(id);
}

/** Resolves a speaker tag (eng/arg/bra/…) to a known option. */
export function getChatLanguageByTag(tag: string | undefined): ChatLanguageOption | undefined {
    if (!tag) {
        return undefined;
    }
    return OPTIONS_BY_TAG.get(tag.trim().toLowerCase());
}

/** Picks the closest chat language from the browser locale. */
export function detectDefaultChatLanguageId(): string {
    if (typeof navigator === 'undefined') {
        return 'en';
    }

    const locale = (navigator.language || 'en').toLowerCase();
    if (locale.startsWith('es-ar') || locale.startsWith('es-419')) {
        return 'es-AR';
    }
    if (locale.startsWith('es')) {
        return 'es';
    }
    if (locale.startsWith('pt-br')) {
        return 'pt-BR';
    }
    if (locale.startsWith('pt')) {
        return 'pt';
    }
    return 'en';
}

/** True when two language ids/tags share the same MT target (no translation needed). */
export function shareChatMtCode(a: string | undefined, b: string | undefined): boolean {
    const left = getChatLanguageById(a) ?? getChatLanguageByTag(a);
    const right = getChatLanguageById(b) ?? getChatLanguageByTag(b);
    if (!left || !right) {
        return false;
    }
    return left.mtCode === right.mtCode;
}
