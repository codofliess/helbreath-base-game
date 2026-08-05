/**
 * Client mirror of Olympia NPC buy-back gold (Server.cpp ReqSellItemPrice).
 * Server `OlympiaSellPrice` / `Shop.HandleSellBagItemRequest` is authoritative.
 */

/** Value-nibble → percent addend (Olympia sell cases 1–13). */
function valuePercent(sweValue: number): number {
    switch (sweValue) {
        case 1:
            return 10;
        case 2:
            return 20;
        case 3:
            return 30;
        case 4:
            return 35;
        case 5:
            return 40;
        case 6:
            return 50;
        case 7:
            return 100;
        case 8:
            return 200;
        case 9:
            return 300;
        case 10:
            return 400;
        case 11:
            return 500;
        case 12:
            return 700;
        case 13:
            return 900;
        default:
            return 0;
    }
}

function primaryTypeMultiplier(sweType: number): number {
    switch (sweType) {
        case 6:
        case 8:
            return 2;
        case 5:
            return 3;
        case 1:
            return 4;
        case 7:
            return 5;
        case 2:
            return 6;
        case 3:
            return 15;
        case 9:
            return 20;
        default:
            return 1;
    }
}

function secondaryTypeMultiplier(sweType: number): number {
    switch (sweType) {
        case 1:
        case 12:
            return 2;
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
            return 4;
        case 8:
        case 9:
        case 10:
        case 11:
            return 6;
        default:
            return 1;
    }
}

/** `add - add/3` retention used by Olympia v2.03 sell. */
function attributePremium(basePrice: number, typeMul: number, sweValue: number): number {
    if (basePrice <= 0 || typeMul <= 0) {
        return 0;
    }
    const pct = valuePercent(sweValue);
    const d1 = basePrice * typeMul;
    const add = Math.trunc(d1 + d1 * (pct / 100));
    return add - Math.trunc(add / 3);
}

export interface OlympiaSellQuoteInput {
    listPrice: number;
    category: number;
    itemAttribute?: number;
    curLifeSpan?: number;
    maxLifeSpan?: number;
    quantity?: number;
}

export interface OlympiaSellQuote {
    ok: boolean;
    gold: number;
    error?: string;
}

/**
 * Quotes gold for one bag stack using Olympia buy-back rules.
 * Upgrade (+N from high nibble) scales list price before half/durability math.
 */
export function quoteOlympiaSellGold(input: OlympiaSellQuoteInput): OlympiaSellQuote {
    const qty = Math.max(1, input.quantity ?? 1);
    const category = input.category ?? 0;
    const listPrice = Math.max(0, input.listPrice ?? 0);
    const attr = (input.itemAttribute ?? 0) >>> 0;

    if (category < 1 || category > 50) {
        return { ok: false, gold: 0, error: 'That item cannot be sold for gold.' };
    }

    const upgrade = (attr & 0xf000_0000) >>> 28;
    const effectiveList = listPrice > 0 ? listPrice * (1 + upgrade) : 0;

    let unitPrice = 0;
    if (category >= 11 && category <= 50) {
        unitPrice = effectiveList > 0 ? Math.max(1, Math.trunc(effectiveList / 2)) : 0;
    } else {
        // Category 1–10: weapons/armor — durability-scaled half price + magic premiums.
        const max = (input.maxLifeSpan ?? 0) > 0 ? (input.maxLifeSpan as number) : 1;
        // Unknown durability (client preview) → assume full; explicit 0 → broken.
        const cur = input.curLifeSpan !== undefined ? input.curLifeSpan : max;
        if (cur <= 0) {
            return { ok: false, gold: 0, error: 'Broken items cannot be sold.' };
        }
        if (effectiveList <= 0) {
            return { ok: false, gold: 0, error: 'That item has no sell value.' };
        }
        let basePrice = Math.trunc((cur / max) * 0.5 * effectiveList);
        if (basePrice <= 0) {
            basePrice = 1;
        }

        let add1 = 0;
        let add2 = 0;
        if ((attr & 0x00f0_0000) !== 0) {
            const sweType = (attr & 0x00f0_0000) >>> 20;
            const sweValue = (attr & 0x000f_0000) >>> 16;
            add1 = attributePremium(basePrice, primaryTypeMultiplier(sweType), sweValue);
        }
        if ((attr & 0x0000_f000) !== 0) {
            const sweType = (attr & 0x0000_f000) >>> 12;
            const sweValue = (attr & 0x0000_0f00) >>> 8;
            add2 = attributePremium(basePrice, secondaryTypeMultiplier(sweType), sweValue);
        }
        unitPrice = basePrice + add1 + add2;
    }

    if (unitPrice <= 0) {
        return { ok: false, gold: 0, error: 'That item has no sell value.' };
    }
    if (unitPrice > 1_000_000) {
        unitPrice = 1_000_000;
    }

    const gold = Math.min(Number.MAX_SAFE_INTEGER, unitPrice * qty);
    return gold > 0 ? { ok: true, gold } : { ok: false, gold: 0, error: 'That item has no sell value.' };
}
