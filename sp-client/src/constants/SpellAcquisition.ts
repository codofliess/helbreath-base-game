/**
 * Spell acquisition sources — shop vs rare drop.
 * For now ALL spells are purchasable at the Magic Shop (Wizard Tower / Gandalf).
 * Rare drop list will be filled when user confirms which spells are exclusives.
 */

import type { SpellAcquisition } from './Spells';
import { SPELLS } from './Spells';

export interface SpellDropSource {
    spellId: number;
    monsters: string[];
    dropType: 'manual' | 'scroll';
}

/** Rare drops — empty for now; user will define later */
export const SPELL_RARE_DROPS: SpellDropSource[] = [];

/** Shop prices from Magic.cfg (ReqInt, Gold cost). Cost -1 in cfg → usable shop price. */
export const MAGIC_SHOP_PRICES: Record<number, { reqInt: number; cost: number }> = {
    0: { reqInt: 18, cost: 100 },
    1: { reqInt: 20, cost: 100 },
    2: { reqInt: 18, cost: 100 },
    10: { reqInt: 24, cost: 200 },
    11: { reqInt: 22, cost: 200 },
    12: { reqInt: 20, cost: 120 },
    13: { reqInt: 26, cost: 200 },
    14: { reqInt: 25, cost: 400 },
    20: { reqInt: 26, cost: 500 },
    21: { reqInt: 28, cost: 500 },
    23: { reqInt: 20, cost: 300 },
    24: { reqInt: 20, cost: 300 },
    25: { reqInt: 26, cost: 500 },
    26: { reqInt: 26, cost: 500 },
    27: { reqInt: 29, cost: 700 },
    28: { reqInt: 30, cost: 800 },
    30: { reqInt: 34, cost: 1000 },
    31: { reqInt: 38, cost: 1000 },
    32: { reqInt: 30, cost: 800 },
    33: { reqInt: 32, cost: 850 },
    34: { reqInt: 30, cost: 700 },
    35: { reqInt: 36, cost: 1000 },
    36: { reqInt: 35, cost: 700 },
    37: { reqInt: 38, cost: 1100 },
    38: { reqInt: 33, cost: 1000 },
    40: { reqInt: 45, cost: 1200 },
    41: { reqInt: 48, cost: 1400 },
    42: { reqInt: 42, cost: 1300 },
    43: { reqInt: 47, cost: 1700 },
    44: { reqInt: 46, cost: 1500 },
    45: { reqInt: 50, cost: 2000 },
    46: { reqInt: 49, cost: 1800 },
    47: { reqInt: 45, cost: 1700 },
    50: { reqInt: 59, cost: 2200 },
    51: { reqInt: 58, cost: 2500 },
    53: { reqInt: 52, cost: 2100 },
    54: { reqInt: 56, cost: 2300 },
    55: { reqInt: 59, cost: 2500 },
    56: { reqInt: 53, cost: 3000 },
    57: { reqInt: 60, cost: 4200 },
    60: { reqInt: 67, cost: 5000 },
    61: { reqInt: 85, cost: 6000 },
    62: { reqInt: 75, cost: 7500 },
    63: { reqInt: 93, cost: 9800 },
    64: { reqInt: 97, cost: 12000 },
    65: { reqInt: 112, cost: 13500 },
    66: { reqInt: 97, cost: 20000 },
    67: { reqInt: 70, cost: 7500 },
    70: { reqInt: 105, cost: 8000 },
    71: { reqInt: 130, cost: 15000 },
    72: { reqInt: 133, cost: 21000 },
    73: { reqInt: 120, cost: 20000 },
    74: { reqInt: 123, cost: 35000 },
    76: { reqInt: 135, cost: 50000 },
    77: { reqInt: 160, cost: 27000 },
    78: { reqInt: 150, cost: 30000 },
    80: { reqInt: 150, cost: 27000 },
    81: { reqInt: 169, cost: 40000 },
    82: { reqInt: 185, cost: 45000 },
    83: { reqInt: 180, cost: 50000 },
    90: { reqInt: 180, cost: 35000 },
    91: { reqInt: 195, cost: 43000 },
    94: { reqInt: 200, cost: 60000 },
    95: { reqInt: 200, cost: 27000 },
    96: { reqInt: 200, cost: 55000 },
    97: { reqInt: 200, cost: 60000 },
};

/** All spells available in Magic Shop for now */
export const MAGIC_SHOP_SPELL_IDS: number[] = SPELLS.map((s) => s.id);

export function getMagicShopPrice(spellId: number): { reqInt: number; cost: number } {
    const spell = SPELLS.find((s) => s.id === spellId);
    return MAGIC_SHOP_PRICES[spellId] ?? { reqInt: spell?.circle ? spell.circle * 10 : 10, cost: spell?.mpCost ? spell.mpCost * 10 : 100 };
}

export function getSpellAcquisition(spellId: number): SpellAcquisition {
    if (MAGIC_SHOP_SPELL_IDS.includes(spellId)) {
        return 'shop';
    }
    if (SPELL_RARE_DROPS.some((d) => d.spellId === spellId)) {
        return 'drop';
    }
    return 'default';
}

export function getMagicShopSpells() {
    return SPELLS.filter((s) => MAGIC_SHOP_SPELL_IDS.includes(s.id));
}