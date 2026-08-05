/**
 * Arena kit catalog — keep in sync with server Config/ArenaKitCatalog.json.
 * Client uses this for the kit builder; server validates on loadout apply.
 */

export const ARENA_STARTER_CREDITS = 1000;
/** L150 fully spent: 70 create + (150-1)×3 LU = 517. */
export const ARENA_STAT_TOTAL = 517;
export const ARENA_STAT_MIN = 10;
export const ARENA_LEVEL = 150;
export const ARENA_POTION_POOL = 30;
export const ARENA_SKILLS_100 = 4;
export const ARENA_SKILLS_50 = 4;

/**
 * PvP-legal skill ids (excludes gathering / craft / Physical Absorption).
 * Combat masteries: Magic, Hammer, Sword, Axe, Bow, Staff, Shield, MagRes, PoisonRes,
 * Fencing, Pretend Corpse. Hammer (6) is required for GBH / Battle Hammer SA builds.
 */
export const ARENA_PVP_SKILL_IDS = [4, 6, 9, 10, 11, 12, 13, 14, 16, 17, 18] as const;

export type ArenaPath = 'war' | 'mage';

export type ArenaMageFreeSpell = 'blizzard' | 'esw';

export interface ArenaCatalogSku {
    sku: string;
    label: string;
    cost: number;
    tags: string[];
    itemId?: number;
    plus?: number;
    perUse?: boolean;
    stackable?: boolean;
    durationMs?: number;
    saDurationMs?: number;
    saCooldownMs?: number;
    arenaUsesPerRound?: number;
    bundleSkus?: string[];
    note?: string;
}

export const ARENA_POTION_CHOICES = [
    { itemId: 92, sku: 'big-red' as const, name: 'Big Red Potion' },
    { itemId: 94, sku: 'big-blue' as const, name: 'Big Blue Potion' },
    { itemId: 782, sku: 'green-candy' as const, name: 'Green Candy (50% SP)' },
] as const;

/**
 * Free bag capes for every arena fighter (not worn by default).
 * NEVER plain Cape (id 400). CIC+7 also carries HP Recovery 50%.
 * Olympia Charge Critical total soft-cap = 20 (fastest SA charge regen).
 */
export const ARENA_FREE_CAPES = [
    {
        itemId: 402,
        label: 'Arena Cape CIC+7 / HP Recovery 50%',
        manaConvertPct: 0,
        hpRegenPct: 50,
        mpRegenPct: 0,
        criticalIncrease: 7,
    },
    {
        itemId: 402,
        label: 'Arena Cape MC20 / MP Recovery 50%',
        manaConvertPct: 20,
        hpRegenPct: 0,
        mpRegenPct: 50,
        criticalIncrease: 0,
    },
] as const;

/**
 * Free armor in bag — path-filtered on server:
 * Mage: Hat/Chain/Hauberk/Legs × HP50 + MP50 only.
 * War: Wings/Plate/Hauberk/Legs × HP50 + MP50 only.
 * Never both layouts on one fighter (no plate/wings on mage, no hat/chain on war free grants).
 */
export const ARENA_FREE_ARMOR_SETS_MAGE = [
    { id: 'mage-hp50', label: 'Mage set HP50 (Hat / Chain / Hauberk / Plate Legs)', magic: 'hp50' as const },
    { id: 'mage-mp50', label: 'Mage set MP50 (Hat / Chain / Hauberk / Plate Legs)', magic: 'mp50' as const },
] as const;

export const ARENA_FREE_ARMOR_SETS_WAR = [
    { id: 'war-hp50', label: 'War set HP50 (Wings / Plate / Hauberk / Plate Legs)', magic: 'hp50' as const },
    { id: 'war-mp50', label: 'War set MP50 (Wings / Plate / Hauberk / Plate Legs)', magic: 'mp50' as const },
] as const;

/**
 * Olympia Hero set preview (Item2.cfg).
 * War: Helm + Armor (DR/PA 18/24, 45/48, …). Mage: Cap + Robe (12/15, 20/20, …).
 */
export const ARENA_HERO_SET_PREVIEW = {
    war: {
        male: [
            { slot: 'helmet', itemId: 403 },
            { slot: 'armor', itemId: 411 },
            { slot: 'hauberk', itemId: 419 },
            { slot: 'leggings', itemId: 423 },
            { slot: 'boots', itemId: 451 },
            { slot: 'weapon', itemId: 762 },
        ],
        female: [
            { slot: 'helmet', itemId: 404 },
            { slot: 'armor', itemId: 412 },
            { slot: 'hauberk', itemId: 420 },
            { slot: 'leggings', itemId: 424 },
            { slot: 'boots', itemId: 451 },
            { slot: 'weapon', itemId: 762 },
        ],
    },
    mage: {
        male: [
            { slot: 'helmet', itemId: 407 },
            { slot: 'armor', itemId: 415 },
            { slot: 'hauberk', itemId: 419 },
            { slot: 'leggings', itemId: 423 },
            { slot: 'boots', itemId: 451 },
            { slot: 'weapon', itemId: 259 },
        ],
        female: [
            { slot: 'helmet', itemId: 408 },
            { slot: 'armor', itemId: 416 },
            { slot: 'hauberk', itemId: 420 },
            { slot: 'leggings', itemId: 424 },
            { slot: 'boots', itemId: 451 },
            { slot: 'weapon', itemId: 259 },
        ],
    },
} as const;

export const ARENA_MAGE_FREE_SPELLS: ReadonlyArray<{ id: ArenaMageFreeSpell; label: string }> = [
    { id: 'blizzard', label: 'Blizzard' },
    { id: 'esw', label: 'Energy Strike Wave' },
];

export const ARENA_CATALOG: readonly ArenaCatalogSku[] = [
    { sku: 'wand-ms22-cp40-hr91-p5', label: 'Wand MS22 CP40 HR91 +5', cost: 100, tags: ['mage', 'weapon'], itemId: 259, plus: 5 },
    { sku: 'berserk-ms20', label: 'Berserk Wand (MS.20)', cost: 400, tags: ['mage', 'weapon'], itemId: 861 },
    { sku: 'resur-wand-1use', label: 'Resurrection Wand (1 use / round)', cost: 300, tags: ['mage', 'consumable'], itemId: 865, arenaUsesPerRound: 1 },
    { sku: 'inhibition-cast', label: 'Inhibition Casting (per use, 10s)', cost: 100, tags: ['mage', 'spell', 'perUse'], perUse: true, durationMs: 10000 },
    { sku: 'cancellation', label: 'Cancellation (per use)', cost: 50, tags: ['mage', 'spell', 'perUse'], perUse: true },
    { sku: 'sleep', label: 'Sleep (per use)', cost: 100, tags: ['mage', 'spell', 'perUse'], perUse: true },
    { sku: 'gbh-p7', label: 'Giant Battle Hammer +7', cost: 300, tags: ['war', 'weapon'], itemId: 762, plus: 7 },
    { sku: 'storm-p7', label: 'Storm Bringer +7', cost: 300, tags: ['war', 'weapon'], itemId: 845, plus: 7 },
    { sku: 'devastator', label: 'The Devastator', cost: 700, tags: ['war', 'weapon'], itemId: 846 },
    {
        sku: 'blood-rapier-p7',
        label: 'Blood Rapier +7 (high HR)',
        cost: 50,
        tags: ['war', 'mage', 'weapon', 'rapier'],
        itemId: 492,
        plus: 7,
    },
    {
        sku: 'ring-of-thirst',
        label: 'Ring of Thirst',
        cost: 150,
        tags: ['utility', 'ring'],
        itemId: 1216,
        note: 'Arena staple — life-steal ring',
    },
    { sku: 'merien-shield', label: 'Merien Shield (SA 20s / CD 5m)', cost: 100, tags: ['war', 'shield'], itemId: 620, saDurationMs: 20000, saCooldownMs: 300000 },
    { sku: 'invi-pot', label: 'Invisibility Potion', cost: 50, tags: ['utility', 'stackable'], itemId: 273, stackable: true },
    {
        sku: 'set-dr50',
        label: 'Set DR 50% + Cape MCon15/DR70',
        cost: 300,
        tags: ['armor', 'set', 'dr'],
        bundleSkus: [
            'piece-dr50-hat',
            'piece-dr50-chain',
            'piece-dr50-hauberk',
            'piece-dr50-legs',
            'cape-mcon15-dr70',
        ],
        note: 'HP/MP armor is free in bag — credits buy DR/MR only',
    },
    { sku: 'piece-dr50-hat', label: 'Hat DR 50%', cost: 50, tags: ['armor', 'dr'] },
    { sku: 'piece-dr50-chain', label: 'Chain Mail DR 50%', cost: 50, tags: ['armor', 'dr'] },
    { sku: 'piece-dr50-hauberk', label: 'Hauberk DR 50%', cost: 50, tags: ['armor', 'dr'] },
    { sku: 'piece-dr50-legs', label: 'Plate Leggings DR 50%', cost: 50, tags: ['armor', 'dr'] },
    {
        sku: 'cape-mcon15-dr70',
        label: 'Cape MCon15 / DR70',
        cost: 100,
        tags: ['armor', 'dr', 'cape'],
        itemId: 402,
        note: 'Mana Convert 15 + Defense Ratio 70',
    },
    {
        sku: 'set-mr50',
        label: 'Set MR 50% + Cape MCon15/MR70',
        cost: 300,
        tags: ['armor', 'set', 'mr'],
        bundleSkus: [
            'piece-mr50-wings',
            'piece-mr50-plate',
            'piece-mr50-hauberk',
            'piece-mr50-legs',
            'cape-mcon15-mr70',
        ],
    },
    { sku: 'piece-mr50-wings', label: 'Wings MR 50%', cost: 50, tags: ['armor', 'mr'] },
    { sku: 'piece-mr50-plate', label: 'Plate Mail MR 50%', cost: 50, tags: ['armor', 'mr'] },
    { sku: 'piece-mr50-hauberk', label: 'Hauberk MR 50%', cost: 50, tags: ['armor', 'mr'] },
    { sku: 'piece-mr50-legs', label: 'Plate Leggings MR 50%', cost: 50, tags: ['armor', 'mr'] },
    {
        sku: 'cape-mcon15-mr70',
        label: 'Cape MCon15 / MR70',
        cost: 100,
        tags: ['armor', 'mr', 'cape'],
        itemId: 402,
        note: 'Mana Convert 15 + Magic Resist 70',
    },
];

export const ARENA_MAPS = [
    { id: 'arena-duel-s', label: 'Duel Small', map: 'fightzone4', size: 'small' },
    { id: 'arena-duel-m', label: 'Colosseum Medium', map: 'fightzone1', size: 'medium' },
    { id: 'arena-duel-l', label: 'Duel Large', map: 'fightzone5', size: 'large' },
    { id: 'arena-tourney', label: 'Tournament Field', map: 'fightzone8', size: 'large' },
    { id: 'arena-btfield', label: 'Open Battlefield', map: 'btfield', size: 'xlarge' },
    /** Social hub clone of Bleeding Island — hang out, arrange duels, fight outside safe. */
    { id: 'arena-bleeding', label: 'Bleeding Island (Arena)', map: 'bisle', size: 'xlarge' },
] as const;

/** Preferred world id for the free social lobby (kit loadout, open PvP outside safe). */
export const ARENA_BLEEDING_WORLD_ID = 'arena-bleeding';

export function getArenaCatalogSku(sku: string): ArenaCatalogSku | undefined {
    return ARENA_CATALOG.find((c) => c.sku === sku);
}

export function computeCatalogSpend(purchases: ReadonlyArray<{ sku: string; qty: number }>): number {
    let total = 0;
    for (const p of purchases) {
        const row = getArenaCatalogSku(p.sku);
        if (!row) {
            continue;
        }
        total += row.cost * Math.max(0, Math.floor(p.qty));
    }
    return total;
}
