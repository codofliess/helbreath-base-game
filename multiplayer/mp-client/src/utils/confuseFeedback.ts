import { TemporaryEffectType } from '../Types';

/** Olympia-style notify lines shown when a confuse-family effect lands on the local player. */
const CONFUSE_APPLY_TOAST: Partial<Record<TemporaryEffectType, string>> = {
    [TemporaryEffectType.ConfuseLanguage]:
        'No one understands you because of language confusion magic!',
    [TemporaryEffectType.Confusion]:
        'Confusion magic casted — impossible to determine allegiance.',
    [TemporaryEffectType.Illusion]:
        'Illusion magic casted — impossible to tell who is who!',
    [TemporaryEffectType.IllusionMovement]:
        'You are thrown into confusion, and you are flustered yourself.',
};

const CONFUSE_EXPIRE_TOAST: Partial<Record<TemporaryEffectType, string>> = {
    [TemporaryEffectType.ConfuseLanguage]: 'Language confusion magic has vanished.',
    [TemporaryEffectType.Confusion]: 'Confusion magic has vanished.',
    [TemporaryEffectType.Illusion]: 'Illusion magic has vanished.',
    [TemporaryEffectType.IllusionMovement]: 'Illusion movement magic has vanished.',
};

const GARBLE_SYLLABLES = ['wa', 'wu', 'wo', 'ya', 'yu', 'yo'] as const;

/**
 * Olympia Confuse Language chat garble: with ~2/3 probability, replace non-space character pairs
 * with nonsense syllables so nearby players cannot read the intended text.
 */
export function garbleConfuseLanguageChat(text: string): string {
    if (Math.floor(Math.random() * 3) + 1 === 2) {
        return text;
    }

    let result = '';
    let i = 0;
    while (i < text.length) {
        const ch = text[i]!;
        if (ch === ' ') {
            result += ' ';
            i += 1;
            continue;
        }

        const next = text[i + 1];
        if (next !== undefined && next !== ' ') {
            result += GARBLE_SYLLABLES[Math.floor(Math.random() * GARBLE_SYLLABLES.length)]!;
            i += 2;
            continue;
        }

        result += ch;
        i += 1;
    }

    return result;
}

/** Toast copy when a confuse-family effect is applied to self; undefined for other effect types. */
export function confuseApplyToastMessage(effectType: number): string | undefined {
    return CONFUSE_APPLY_TOAST[effectType as TemporaryEffectType];
}

/** Toast copy when a confuse-family effect expires on self. */
export function confuseExpireToastMessage(effectType: number): string | undefined {
    return CONFUSE_EXPIRE_TOAST[effectType as TemporaryEffectType];
}

/** Stable-looking fake name for Illusion hover spoofing. */
export function illusionSpoofName(seed: string): string {
    const pool = ['Traveler', 'Wanderer', 'Stranger', 'Shadow', 'Echo', 'Mirage'];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return pool[Math.abs(hash) % pool.length]!;
}
