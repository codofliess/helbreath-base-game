/**
 * F7 Circle / Gandalf client book helpers.
 *
 * The HUD filters {@link SPELLS} by Olympia Magic.cfg ids in `learnedSpellIds`.
 * InitialState carries Spells.json catalog ids (Energy Bolt = 0, Heal = 29).
 * Those must be mapped and **unioned** into the book — never used as a replace
 * list — or a later Energy-Bolt-only snapshot wipes Circle One (Missile/Heal).
 *
 * Gandalf spends bag catalog id 90. Persist `Gold` is not a client field.
 */

export const GOLD_ITEM_ID = 90;

/** Circle One shop ids: Magic Missile, Heal, Create Food. */
export const CIRCLE_ONE_OLYMPIA_IDS = [0, 1, 2] as const;

export function isGoldBagItemId(itemId: unknown): boolean {
    return Number(itemId) === GOLD_ITEM_ID;
}

export function goldStackQuantity(quantity: unknown): number {
    if (quantity == null || quantity === '') {
        return 1;
    }
    const n = Number(quantity);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Sum bag stacks whose catalog id is 90 (number, numeric string, or bigint). */
export function countBagGold(
    items: ReadonlyArray<{ itemId?: unknown; quantity?: unknown }>,
): number {
    let total = 0;
    for (const item of items) {
        if (isGoldBagItemId(item.itemId)) {
            total += goldStackQuantity(item.quantity);
        }
    }
    return total;
}

/**
 * Union existing Olympia book ids with mapped combat-catalog ids.
 * Does not drop Missile/Heal/Create Food when the catalog snapshot omits them.
 */
export function mergeOlympiaBookFromServerCatalog(
    currentLearnedOlympiaIds: readonly number[],
    serverSpellIds: readonly number[],
    mapServerToOlympia: (serverSpellId: number) => number | undefined,
    energyBoltOlympiaId: number,
    extraOlympiaIds: readonly number[] = [],
): number[] {
    const mapped: number[] = [energyBoltOlympiaId];
    for (const sid of serverSpellIds) {
        const olympia = mapServerToOlympia(sid);
        if (olympia !== undefined) {
            mapped.push(olympia);
        }
    }
    return [...new Set([...currentLearnedOlympiaIds, ...mapped, ...extraOlympiaIds])];
}
