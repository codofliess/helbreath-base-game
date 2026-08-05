/**
 * Per-character bag layout memory: remembers where the player groups items
 * (potions piles, capes, etc.) across sessions / arena re-entry.
 *
 * Keys by itemId + magic attribute (not UID — arena kits mint new UIDs each enter).
 */
import { getStoredWalletPubkey } from './walletAuth';

const STORAGE_PREFIX = 'helbreath.bagLayout.v1';

export interface BagLayoutPos {
    bagX: number;
    bagY: number;
}

type LayoutMap = Record<string, BagLayoutPos>;

function storageKey(wallet: string, characterName: string): string {
    const w = (wallet || 'guest').trim() || 'guest';
    const n = (characterName || 'unknown').trim().toLowerCase() || 'unknown';
    return `${STORAGE_PREFIX}:${w}:${n}`;
}

/** Stable key for an item instance class (not unique UID). */
export function bagLayoutItemKey(itemId: number, itemAttribute?: number | null): string {
    const attr = itemAttribute != null && itemAttribute !== 0 ? Math.trunc(itemAttribute) >>> 0 : 0;
    return `${itemId}:${attr}`;
}

function loadMap(wallet: string, characterName: string): LayoutMap {
    try {
        const raw = localStorage.getItem(storageKey(wallet, characterName));
        if (!raw) {
            return {};
        }
        const parsed = JSON.parse(raw) as LayoutMap;
        if (!parsed || typeof parsed !== 'object') {
            return {};
        }
        const out: LayoutMap = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (
                v &&
                typeof v === 'object' &&
                typeof (v as BagLayoutPos).bagX === 'number' &&
                typeof (v as BagLayoutPos).bagY === 'number'
            ) {
                out[k] = {
                    bagX: Math.round((v as BagLayoutPos).bagX),
                    bagY: Math.round((v as BagLayoutPos).bagY),
                };
            }
        }
        return out;
    } catch {
        return {};
    }
}

function saveMap(wallet: string, characterName: string, map: LayoutMap): void {
    try {
        localStorage.setItem(storageKey(wallet, characterName), JSON.stringify(map));
    } catch {
        /* quota / private mode */
    }
}

export function rememberBagItemPosition(
    characterName: string | undefined | null,
    itemId: number,
    itemAttribute: number | undefined | null,
    bagX: number,
    bagY: number,
    wallet?: string | null,
): void {
    const name = (characterName ?? '').trim();
    if (!name) {
        return;
    }
    const w = (wallet ?? getStoredWalletPubkey() ?? 'guest').trim() || 'guest';
    const key = bagLayoutItemKey(itemId, itemAttribute);
    const map = loadMap(w, name);
    map[key] = { bagX: Math.round(bagX), bagY: Math.round(bagY) };
    saveMap(w, name, map);
}

export function recallBagItemPosition(
    characterName: string | undefined | null,
    itemId: number,
    itemAttribute: number | undefined | null,
    wallet?: string | null,
): BagLayoutPos | undefined {
    const name = (characterName ?? '').trim();
    if (!name) {
        return undefined;
    }
    const w = (wallet ?? getStoredWalletPubkey() ?? 'guest').trim() || 'guest';
    const map = loadMap(w, name);
    return map[bagLayoutItemKey(itemId, itemAttribute)];
}

/**
 * Apply remembered positions onto a bag list (mutates items that lack coords
 * or that match a remembered signature). Returns items that need a server move.
 */
export function applyRememberedBagLayout<
    T extends {
        itemId: number;
        itemUid: string;
        itemAttribute?: number;
        bagX?: number;
        bagY?: number;
    },
>(
    characterName: string | undefined | null,
    items: T[],
    wallet?: string | null,
): Array<{ itemUid: string; bagX: number; bagY: number }> {
    const name = (characterName ?? '').trim();
    if (!name || items.length === 0) {
        return [];
    }
    const w = (wallet ?? getStoredWalletPubkey() ?? 'guest').trim() || 'guest';
    const map = loadMap(w, name);
    if (Object.keys(map).length === 0) {
        return [];
    }

    // Track how many of each signature we've placed (multiple potions share key).
    const usedCount: Record<string, number> = {};
    const moves: Array<{ itemUid: string; bagX: number; bagY: number }> = [];

    for (const it of items) {
        const key = bagLayoutItemKey(it.itemId, it.itemAttribute);
        const remembered = map[key];
        if (!remembered) {
            continue;
        }
        const n = usedCount[key] ?? 0;
        usedCount[key] = n + 1;
        // Slight offset for stacked same-key items so they pile near the anchor.
        const bagX = remembered.bagX + (n % 3) * 6;
        const bagY = remembered.bagY + Math.floor(n / 3) * 6;
        const needs =
            it.bagX === undefined ||
            it.bagY === undefined ||
            Math.abs((it.bagX ?? 0) - bagX) > 2 ||
            Math.abs((it.bagY ?? 0) - bagY) > 2;
        it.bagX = bagX;
        it.bagY = bagY;
        if (needs) {
            moves.push({ itemUid: it.itemUid, bagX, bagY });
        }
    }
    return moves;
}
