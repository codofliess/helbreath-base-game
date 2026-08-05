/**
 * F6 Item Drops log rules (Chain Lords / product):
 *
 * Only these pickups appear in the F6 "Item Drops" panel:
 * - **Legendary** named endgame bases (see list below)
 * - **Stated armor / stated weapon** with magic rolls that hit thresholds
 * - **CIC4+** cape/shield/body armor craft pieces
 * - **All PA / MA** rolls (any amount)
 * - **HP / MP / DR / MR ≥ 35** (display % = nibble × 7)
 * - **Stones**: Zem / Xelima / Merien / Blonde / Integrity (and other *Stone* catalog
 *   rows except Vortex — Vortex does not exist on this server until product says so)
 *
 * Low dual-magic junk, white gear, potions, etc. must NOT flood the log.
 *
 * NFT tier mapping (lazy mint): legendary → super_rare, everything else notable → rare.
 */

import { ITEMS, ItemTypes } from '../constants/Items';

/**
 * Legendary bases — F6 label "Legendary".
 * Product list: Berserk wands, Neck of Xelima, Ring of Abaddon, Neck of Ice Elemental,
 * Devastator, Medusa neck, Cancel / Inhibition manuals, Stormbringer, Bane (+ related
 * endgame manuals when catalog has them).
 */
export const OLYMPIA_LEGENDARY_ITEM_IDS = new Set<number>([
    // Berserk Wand MS20 / MS10
    861, 862,
    // Necklace of Xelima
    860,
    // Ring of the Abaddon
    631,
    // Necklace of Ice Elemental
    643,
    // The Devastator / Bane hammer
    846, 872,
    // Necklace of Medusa
    641,
    // Storm Bringer
    845,
    // Manuals: Cancel, Inhibition, Mass Blizzard, Sleep, Ice Storm
    852, 857, 873, 874, 380,
    // Xelima weapons / Merien plate & shield / Kloness line (endgame named)
    610, 611, 612,
    620, 621, 622,
    849, 850, 851, 859, 863, 864,
    // Dark Knight set (M/W)
    706, 707, 708, 709, 710, 717, 718, 737,
    724, 725, 726, 727, 728,
    // Ring of Xelima / Merien neck (named rares treated legendary with the set)
    630, 858,
]);

/** Keep alias used by SelectChar desk / NFT code. */
export const OLYMPIA_SUPER_RARE_ITEM_IDS = OLYMPIA_LEGENDARY_ITEM_IDS;

/**
 * Crafting / sacrifice stones always go to Item Drops (anti-snipe visibility).
 * Vortex Gem is intentionally excluded — not on this server.
 */
export const OLYMPIA_STONE_ITEM_IDS = new Set<number>([
    650, // Zemstone of Sacrifice
    656, // Stone of Xelima
    657, // Stone of Merien
    507, // Blonde Stone
    1112, // Stone of Integrity
]);

/** Extra "Rare" named items that are not full legendaries but should still log. */
export const OLYMPIA_RARE_NAMED_ITEM_IDS = new Set<number>([
    490, 491, 492, // Blood Sword / Axe / Rapier
    613, 614, // Medusa sword / Ice Elemental sword
    633, 735, // Demonpower / Dragonpower rings
    847, // Dark Executor
    382, // Bloody Shock Wave Manual
    853, // E.S.W Manual
    762, // Giant Battle Hammer (gen9–10 rare — not common gear path)
    843, // Barbarian Hammer (gen10 rare)
    861, 862, // Berserk Wand MS.20 / MS.10 (also legendary list — rare path loot)
    1314, 1315, 1316, // MS22 charge wands (Inhib / Cancel / MIM)
    1320, 1321, 1322, // Devlin / Superior / Exceptional Devlin Shield
]);

export type OlympiaNftTier = 'rare' | 'super_rare';

/** UI labels for F6 Item Drops rows. */
export type OlympiaDropCategory =
    | 'legendary'
    | 'rare'
    | 'stated_armor'
    | 'stated_weapon'
    | 'stone';

export type OlympiaDropRarity = 'common' | 'rare' | 'legendary';

const ARMOR_BAG_TYPES = new Set<string>([
    ItemTypes.ARMOR,
    ItemTypes.HAUBERK,
    ItemTypes.LEGGINGS,
    ItemTypes.HELMET,
    ItemTypes.BOOTS,
    ItemTypes.CAPE,
    ItemTypes.SHIELD,
]);

const WEAPON_BAG_TYPES = new Set<string>([
    ItemTypes.WEAPON,
]);

function parseAttr(itemAttribute: number) {
    return {
        primaryType: (itemAttribute >>> 20) & 0xf,
        primaryValue: (itemAttribute >>> 16) & 0xf,
        secondaryType: (itemAttribute >>> 12) & 0xf,
        secondaryValue: (itemAttribute >>> 8) & 0xf,
        rep: (itemAttribute >>> 28) & 0xf,
    };
}

/**
 * Secondary fragment display (OlympiaItemName secondaryStatLine):
 * DR(3)/HP(4)/MP(6)/MR(7) → value×7 ; PA(8)/MA(9) → value×3.
 */
function secondaryPercentHpMpDrMr(type: number, value: number): number {
    if (value <= 0) {
        return 0;
    }
    if (type === 3 || type === 4 || type === 6 || type === 7) {
        return value * 7;
    }
    return 0;
}

function isPaOrMa(type: number, value: number): boolean {
    return value > 0 && (type === 8 || type === 9);
}

/**
 * Stated gear thresholds for F6:
 * - any PA / MA
 * - HP / MP / DR / MR display ≥ 35
 * (CIC4+ handled separately via cicLevel)
 */
export function isStatedGearThreshold(itemAttribute: number): boolean {
    if (!itemAttribute) {
        return false;
    }
    const { primaryType, primaryValue, secondaryType, secondaryValue } = parseAttr(itemAttribute);

    if (isPaOrMa(secondaryType, secondaryValue) || isPaOrMa(primaryType, primaryValue)) {
        return true;
    }

    if (secondaryPercentHpMpDrMr(secondaryType, secondaryValue) >= 35) {
        return true;
    }
    if (secondaryPercentHpMpDrMr(primaryType, primaryValue) >= 35) {
        return true;
    }

    return false;
}

/** @deprecated dual-magic no longer auto-qualifies — use isStatedGearThreshold. */
export function isOlympiaMagicRollNftCandidate(itemAttribute: number): boolean {
    return isStatedGearThreshold(itemAttribute);
}

function catalogItemType(itemId: number): string {
    return ITEMS.find((i) => i.id === itemId)?.itemType ?? '';
}

function isStoneItemId(itemId: number): boolean {
    if (OLYMPIA_STONE_ITEM_IDS.has(itemId)) {
        return true;
    }
    const name = ITEMS.find((i) => i.id === itemId)?.name ?? '';
    // Other *Stone* catalog rows, never Vortex.
    if (/vortex/i.test(name)) {
        return false;
    }
    return /\bstone\b/i.test(name) || /zemstone/i.test(name);
}

/**
 * Full F6 classification. Returns null when the pickup must not appear in Item Drops.
 */
export function evaluateOlympiaDropCategory(
    itemId: number,
    itemAttribute = 0,
    cicLevel = 0,
): OlympiaDropCategory | null {
    if (OLYMPIA_LEGENDARY_ITEM_IDS.has(itemId)) {
        return 'legendary';
    }

    if (isStoneItemId(itemId)) {
        return 'stone';
    }

    if (OLYMPIA_RARE_NAMED_ITEM_IDS.has(itemId)) {
        return 'rare';
    }

    // CIC4+ craft pieces (cape / shield / body) always notable.
    if (cicLevel >= 4) {
        const t = catalogItemType(itemId);
        if (ARMOR_BAG_TYPES.has(t) || t === ItemTypes.SHIELD || t === ItemTypes.CAPE) {
            return 'stated_armor';
        }
        if (WEAPON_BAG_TYPES.has(t)) {
            return 'stated_weapon';
        }
        return 'stated_armor';
    }

    if (!isStatedGearThreshold(itemAttribute)) {
        return null;
    }

    const t = catalogItemType(itemId);
    if (WEAPON_BAG_TYPES.has(t)) {
        return 'stated_weapon';
    }
    if (ARMOR_BAG_TYPES.has(t) || t === ItemTypes.SHIELD || t === ItemTypes.CAPE) {
        return 'stated_armor';
    }
    // Stated jewelry / misc with PA-MA / high HP-MR still "Rare"
    return 'rare';
}

/** Mirrors server NftDropEvaluator.EvaluateNftTier (legendary = super_rare). */
export function evaluateOlympiaNftTier(
    itemId: number,
    itemAttribute: number,
    cicLevel = 0,
): OlympiaNftTier | null {
    const cat = evaluateOlympiaDropCategory(itemId, itemAttribute, cicLevel);
    if (cat === null) {
        return null;
    }
    if (cat === 'legendary') {
        return 'super_rare';
    }
    return 'rare';
}

/** UI-facing rarity bucket (common never logs). */
export function evaluateOlympiaDropRarity(
    itemId: number,
    itemAttribute: number,
    cicLevel = 0,
): OlympiaDropRarity {
    const cat = evaluateOlympiaDropCategory(itemId, itemAttribute, cicLevel);
    if (cat === 'legendary') {
        return 'legendary';
    }
    if (cat !== null) {
        return 'rare';
    }
    return 'common';
}

/** @deprecated */
export function isOlympiaNftCandidate(itemAttribute: number): boolean {
    return isStatedGearThreshold(itemAttribute);
}

/**
 * Whether a bag pickup should appear in the F6 Item Drops log.
 */
export function isOlympiaNotableDrop(
    itemId: number,
    _effectOverrides?: unknown,
    itemAttribute?: number,
    cicLevel?: number,
): boolean {
    return (
        evaluateOlympiaDropCategory(itemId, itemAttribute ?? 0, cicLevel ?? 0) !== null
    );
}

export function isOlympiaSuperRareItemId(itemId: number): boolean {
    return OLYMPIA_LEGENDARY_ITEM_IDS.has(itemId);
}

export function olympiaDropCategoryLabel(category: OlympiaDropCategory): string {
    switch (category) {
        case 'legendary':
            return 'Legendary';
        case 'rare':
            return 'Rare';
        case 'stated_armor':
            return 'Stated Armor';
        case 'stated_weapon':
            return 'Stated Weapon';
        case 'stone':
            return 'Stone';
        default:
            return 'Rare';
    }
}

export function olympiaDropRarityLabel(rarity: OlympiaDropRarity): string | undefined {
    if (rarity === 'legendary') {
        return 'Legendary';
    }
    if (rarity === 'rare') {
        return 'Rare';
    }
    return undefined;
}

/**
 * Post-test mint gate (PO draft — full NFT design TBD).
 */
export function isPostTestNftMintEligible(itemAttribute: number): boolean {
    if (itemAttribute === 0) {
        return false;
    }

    const { primaryType, primaryValue, secondaryType, secondaryValue, rep } =
        parseAttr(itemAttribute);

    if (rep >= 6) {
        return true;
    }

    if (isPaOrMa(secondaryType, secondaryValue) && secondaryValue * 3 >= 20) {
        return true;
    }
    if (secondaryPercentHpMpDrMr(secondaryType, secondaryValue) >= 40) {
        return true;
    }
    if ((primaryType === 1 || primaryType === 5 || primaryType === 7 || primaryType === 9) &&
        primaryValue * 7 >= 40) {
        return true;
    }

    return false;
}
