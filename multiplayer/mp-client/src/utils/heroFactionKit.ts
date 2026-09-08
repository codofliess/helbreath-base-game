/**
 * City-locked Hero kit ids. `a Hero *` / Aresden cape = Aresden; `e Hero *` / Elvine cape = Elvine.
 * A character kit may be one side only — never both.
 */

export type HeroFaction = 'aresden' | 'elvine';

/** Aresden id → Elvine sibling (same slot + gender). Reverse is derived. */
const ARESDEN_TO_ELVINE: Readonly<Record<number, number>> = {
    400: 401, // Hero Cape
    403: 405, // Helm(M)
    404: 406, // Helm(W)
    407: 409, // Cap(M)
    408: 410, // Cap(W)
    411: 413, // Armor(M)
    412: 414, // Armor(W)
    415: 417, // Robe(M)
    416: 418, // Robe(W)
    419: 421, // Hauberk(M)
    420: 422, // Hauberk(W)
    423: 425, // Leggings(M)
    424: 426, // Leggings(W)
    427: 428, // Hero Cape+1
};

const ELVINE_TO_ARESDEN: Readonly<Record<number, number>> = Object.fromEntries(
    Object.entries(ARESDEN_TO_ELVINE).map(([a, e]) => [e, Number(a)]),
);

export function heroFactionOf(itemId: number): HeroFaction | null {
    if (itemId <= 0) {
        return null;
    }
    if (ARESDEN_TO_ELVINE[itemId] !== undefined) {
        return 'aresden';
    }
    if (ELVINE_TO_ARESDEN[itemId] !== undefined) {
        return 'elvine';
    }
    return null;
}

export function isHeroFactionItem(itemId: number): boolean {
    return heroFactionOf(itemId) !== null;
}

/** Rewrite a Hero piece to the given city side. Neutral items are unchanged. */
export function heroItemToSide(itemId: number, side: HeroFaction): number {
    const faction = heroFactionOf(itemId);
    if (faction === null || faction === side) {
        return itemId;
    }
    if (side === 'elvine') {
        return ARESDEN_TO_ELVINE[itemId] ?? itemId;
    }
    return ELVINE_TO_ARESDEN[itemId] ?? itemId;
}

export function normalizeHeroFaction(side: string | undefined | null): HeroFaction | null {
    const s = (side ?? '').trim().toLowerCase();
    return s === 'aresden' || s === 'elvine' ? s : null;
}

/**
 * Lock side: citizenship papers first, else majority of the listed hero ids,
 * else the first hero id. Null = no hero pieces and no city (do not convert).
 */
export function resolveHeroKitSide(
    citizenshipSide: string | undefined | null,
    itemIds: readonly number[],
): HeroFaction | null {
    const papers = normalizeHeroFaction(citizenshipSide);
    if (papers) {
        return papers;
    }
    let aresden = 0;
    let elvine = 0;
    let first: HeroFaction | null = null;
    for (const id of itemIds) {
        const faction = heroFactionOf(id);
        if (!faction) {
            continue;
        }
        first ??= faction;
        if (faction === 'aresden') {
            aresden += 1;
        } else {
            elvine += 1;
        }
    }
    if (aresden > elvine) {
        return 'aresden';
    }
    if (elvine > aresden) {
        return 'elvine';
    }
    return first;
}

/** Rewrite every city Hero id onto one kit side (papers, else majority). */
export function rewriteHeroItemIds(
    itemIds: readonly number[],
    citizenshipSide?: string | null,
): number[] {
    const side = resolveHeroKitSide(citizenshipSide, itemIds);
    if (!side) {
        return itemIds.slice();
    }
    return itemIds.map((id) => heroItemToSide(id, side));
}

/** True when a bag of ids already contains both city Hero lines. */
export function kitHasCrossFactionHeroItems(itemIds: readonly number[]): boolean {
    let sawAresden = false;
    let sawElvine = false;
    for (const id of itemIds) {
        const faction = heroFactionOf(id);
        if (faction === 'aresden') {
            sawAresden = true;
        } else if (faction === 'elvine') {
            sawElvine = true;
        }
        if (sawAresden && sawElvine) {
            return true;
        }
    }
    return false;
}

/**
 * Equip gate: city papers lock the kit; travelers lock to the first / majority Hero side already owned.
 */
export function canEquipHeroItemOnKit(
    itemId: number,
    citizenshipSide: string | undefined | null,
    ownedItemIds: readonly number[],
): boolean {
    const faction = heroFactionOf(itemId);
    if (!faction) {
        return true;
    }
    const side = resolveHeroKitSide(citizenshipSide, ownedItemIds);
    return side === null || faction === side;
}

/** Suffix `1` = Elvine sheets, `2` = Aresden (classic Helbreath hero packs). */
export function heroAppearanceFaction(spriteName: string | undefined): HeroFaction | null {
    const name = (spriteName ?? '').trim().toLowerCase();
    if (!name) {
        return null;
    }
    if (
        /^(mh|wh)(helm|cap|pmail|robe|hauberk|leggings)1$/.test(name) ||
        name === 'mmantle02' ||
        name === 'wmantle02' ||
        name === 'mmantle03' ||
        name === 'wmantle03'
    ) {
        return 'elvine';
    }
    if (
        /^(mh|wh)(helm|cap|pmail|robe|hauberk|leggings)2$/.test(name) ||
        name === 'mmantle01' ||
        name === 'wmantle01' ||
        name === 'mmantle04' ||
        name === 'wmantle04'
    ) {
        return 'aresden';
    }
    return null;
}
