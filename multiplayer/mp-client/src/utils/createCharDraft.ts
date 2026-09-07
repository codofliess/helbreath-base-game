/** Classic Helbreath point-buy: base 10 each, max 14, sum 70. */

export const CREATE_STAT_KEYS = ['str', 'vit', 'dex', 'int', 'mag', 'chr'] as const;
export type CreateStatKey = (typeof CREATE_STAT_KEYS)[number];

export const CREATE_STAT_LABELS: Record<CreateStatKey, string> = {
    str: 'Strength',
    vit: 'Vitality',
    dex: 'Dexterity',
    int: 'Intelligence',
    mag: 'Magic',
    chr: 'Charisma',
};

export const CREATE_STAT_BASE = 10;
export const CREATE_STAT_MAX = 14;
export const CREATE_STAT_BUDGET = 70;
export const CREATE_NAME_MAX_LEN = 10;

export type CreateCharStats = Record<CreateStatKey, number>;

export function initialCreateCharStats(): CreateCharStats {
    return {
        str: CREATE_STAT_BASE,
        vit: CREATE_STAT_BASE,
        dex: CREATE_STAT_BASE,
        int: CREATE_STAT_BASE,
        mag: CREATE_STAT_BASE,
        chr: CREATE_STAT_BASE,
    };
}

export function remainingCreateStatPoints(stats: CreateCharStats): number {
    let used = 0;
    for (const key of CREATE_STAT_KEYS) {
        used += stats[key];
    }
    return CREATE_STAT_BUDGET - used;
}

export function adjustCreateCharStat(
    stats: CreateCharStats,
    key: CreateStatKey,
    delta: number,
): CreateCharStats {
    const next = { ...stats };
    if (delta > 0) {
        if (remainingCreateStatPoints(next) <= 0 || next[key] >= CREATE_STAT_MAX) {
            return stats;
        }
        next[key] += 1;
        return next;
    }
    if (delta < 0) {
        if (next[key] <= CREATE_STAT_BASE) {
            return stats;
        }
        next[key] -= 1;
        return next;
    }
    return stats;
}

export function sanitizeCreateCharName(raw: string): string {
    return raw.replace(/[^A-Za-z0-9]/g, '').slice(0, CREATE_NAME_MAX_LEN);
}

export function validateCreateCharName(name: string): { ok: boolean; message: string } {
    if (name.length === 0) {
        return { ok: false, message: 'Type a name (2–10 letters/numbers).' };
    }
    if (name.length < 2) {
        return { ok: false, message: 'Name must be at least 2 characters.' };
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
        return { ok: false, message: 'Name must start with a letter (letters/numbers only).' };
    }
    return { ok: true, message: 'Name looks valid.' };
}

export function createCharVitals(stats: CreateCharStats): { hp: number; mp: number; sp: number } {
    return {
        hp: stats.vit * 3 + 2 + Math.floor(stats.str / 2),
        mp: stats.mag * 2 + 2 + Math.floor(stats.int / 2),
        sp: stats.str * 2 + 2,
    };
}
