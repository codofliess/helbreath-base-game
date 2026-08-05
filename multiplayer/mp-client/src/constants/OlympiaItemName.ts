import {
    getGlowEffectColor,
    getGlareEffectColor,
    getTintAppearanceEffectColor,
    getTintInventoryEffectColorWithOverrides,
    type Effect,
    type InventoryItem,
    type Item,
} from './Items';
import type { InventoryItemHoverInfo } from '../ui/store/InventoryItemHoverOverlay.store';
import { ItemTypes } from './Items';
import { OLYMPIA_ITEM_STATS, type OlympiaItemStats } from './OlympiaItemStats.generated';

/** Olympia item name tint palette (Client.cpp m_wR indices 1–8). */
export const OLYMPIA_ITEM_NAME_COLORS: Record<number, string> = {
    1: '#282860',
    2: '#4F4F3E',
    3: '#87681E',
    4: '#7F1200',
    5: '#0A3C0A',
    6: '#282828',
    7: '#2F4F50',
    8: '#B434AA',
};

/**
 * Olympia **weapon/armor sprite** palette (Client.cpp m_wWR / m_wWG / m_wWB).
 * Used for ground drops + equipped appearance tint — NOT the name-text table.
 * Color 4 = Poison → green on the weapon (RGB 70,100,70 in classic).
 */
export const OLYMPIA_WEAPON_SPRITE_TINTS: Record<number, number> = {
    1: 0x8a8aa0, // Agile / light-blue family
    2: 0x8a8aa0, // Light
    3: 0xc8a040, // Sharp gold
    4: 0x66c866, // Poison green (must read as green on ground BH)
    5: 0xe0a820, // Critical
    6: 0x5068c0, // Ancient / heavy-blue
    7: 0xd0d0d0, // Righteous white-gray
    8: 0xd090d0, // Casting Prob violet-pink
};

/** Phaser tint for ground/equip sprites from Olympia m_cItemColor (0 = none). */
export function olympiaItemColorToSpriteTint(itemColor: number | undefined): number | undefined {
    if (itemColor === undefined || itemColor <= 0) {
        return undefined;
    }
    return OLYMPIA_WEAPON_SPRITE_TINTS[itemColor];
}

/** Magic item name highlight (Client.cpp RGB(0,255,50)). */
export const OLYMPIA_MAGIC_NAME_COLOR = '#00FF32';

/** Olympia equip positions from Item.cfg (DEF_EQUIPPOS_*). */
const EQUIPPOS_NONE = 0;
const EQUIPPOS_HEAD = 1;
const EQUIPPOS_BODY = 2;
const EQUIPPOS_ARMS = 3;
const EQUIPPOS_PANTS = 4;
const EQUIPPOS_BOOTS = 5;
const EQUIPPOS_LHAND = 7;
const EQUIPPOS_RHAND = 8;
const EQUIPPOS_TWOHAND = 9;

/** Item.cfg effect type for necklace/ring specials (DEF_ITEMEFFECTTYPE_ADDEFFECT). */
const EFFECT_TYPE_ADDEFFECT = 14;
const EFFECT_TYPE_ATTACK = 1;
const EFFECT_TYPE_ATTACK_MANASAVE = 13;
const EFFECT_TYPE_DEFENSE = 2;

export interface OlympiaItemDisplay {
    name: string;
    /** Magic primary shard line (GetItemName pStr2). */
    statLine1?: string;
    /** Magic secondary fragment line (GetItemName pStr3). */
    statLine2?: string;
    /**
     * Full Olympia PutString block after the name: magic stats + Item.cfg
     * characteristics (damage, defence, light/HP/MP add-effects, Str req, full swing, durability…).
     */
    detailLines: string[];
    isMagic: boolean;
    nameColor?: string;
}

const ARMOR_TYPES = new Set<string>([
    ItemTypes.SHIELD,
    ItemTypes.ARMOR,
    ItemTypes.HAUBERK,
    ItemTypes.LEGGINGS,
    ItemTypes.BOOTS,
    ItemTypes.HELMET,
    ItemTypes.CAPE,
]);

function isWandName(baseName: string): boolean {
    return /wand/i.test(baseName);
}

function primaryPrefix(type: number, itemType: string, baseName = ''): string {
    const isDefenseGear = ARMOR_TYPES.has(itemType);
    const isWand = !isDefenseGear && (itemType === ItemTypes.WEAPON || itemType === 'weapon') && isWandName(baseName);
    switch (type) {
        case 1:
            return 'Critical ';
        case 2:
            return 'Poisoning ';
        case 3:
            return 'Righteous ';
        case 4:
            // Type 4 Strong is disabled on melee weapons; on wands it is HP Vamp.
            return isWand ? 'HP Vamp ' : '';
        case 5:
            return 'Agile ';
        case 6:
            // Melee Light; wand primary = MP Vamp (product design).
            return isWand ? 'MP Vamp ' : 'Light ';
        case 7:
            return 'Ancient ';
        case 8:
            return isDefenseGear ? 'Endurance ' : 'Sharp ';
        case 9:
            return 'Casting Prob. ';
        case 10:
            // Legacy wand Mana Save primary / armor TransMana.
            return isDefenseGear ? 'Mana Converting ' : isWand ? 'Mana Save ' : '';
        case 11:
            // Armor primary 11 = Mana Converting (equip TransMana).
            // Secondary 11 remains Experience (fragment).
            return isDefenseGear ? 'Mana Converting ' : 'Experience ';
        case 12:
            // Armor primary 12 = Charge Critical (equip). Secondary 12 = Gold fragment.
            return isDefenseGear ? 'Critical Charge ' : 'Gold ';
        default:
            return '';
    }
}

/**
 * Flat base damage for physical weapons (CL product — NOT vanilla "Damage+value×7" tooltip lie).
 * Superior=+1 quality, Exceptional=+2 quality; Sharp +1; Ancient +2 (always Sharp+1 at same tier).
 * → Superior +1 · Superior Sharp +2 · Exceptional Sharp +3 · Exceptional Ancient +4
 */
export function weaponQualityBaseDamage(
    primaryType: number,
    primaryValue: number,
    secondaryType: number,
): number {
    if (primaryType <= 0) {
        return 0;
    }
    const exceptional = secondaryType > 0 || primaryValue >= 7;
    const qualityBase = exceptional ? 2 : 1;
    if (primaryType === 8) {
        return qualityBase + 1;
    }
    if (primaryType === 7) {
        return qualityBase + 2;
    }
    return qualityBase;
}

/**
 * Primary magic shard stat line.
 * Type 8 weapons = Sharp flat base Damage+N (quality-aware); armor = Endurance.
 */
function primaryStatLine(
    type: number,
    value: number,
    itemType = '',
    baseName = '',
    secondaryType = 0,
): string | undefined {
    const isDefenseGear = ARMOR_TYPES.has(itemType);
    const isWand = !isDefenseGear && (itemType === ItemTypes.WEAPON || itemType === 'weapon') && isWandName(baseName);
    switch (type) {
        case 1:
            // Weapons: Critical Hit Damage; shields can roll Critical → charge-crit style
            if (isDefenseGear) {
                return `Crit. Increase Chance+${Math.min(20, value)}%`;
            }
            return `Damage+${weaponQualityBaseDamage(1, value, secondaryType)} · Critical Hit Damage+${value}`;
        case 2: {
            // Poison: Olympia nibble → 5% steps; clamp display 20%–70% (value 4–14).
            if (isDefenseGear) {
                return undefined;
            }
            const poisonPct = Math.min(70, Math.max(20, value * 5));
            return `Damage+${weaponQualityBaseDamage(2, value, secondaryType)} · Poison Damage+${poisonPct}%`;
        }
        case 3:
            // Righteous: name/color + quality base damage on physical weapons
            return isDefenseGear || isWand
                ? undefined
                : `Damage+${weaponQualityBaseDamage(3, value, secondaryType)}`;
        case 4:
            // Strong disabled on melee; wands = HP Vamp primary
            return isWand ? `HP Vamp+${value * 7}%` : undefined;
        case 5:
            // Agile: quality base damage + physical swing speed
            return isDefenseGear
                ? undefined
                : `Damage+${weaponQualityBaseDamage(5, value, secondaryType)} · Attack Speed-1 (Agile)`;
        case 6:
            if (isWand) {
                return `MP Vamp+${value * 7}%`;
            }
            // Light: quality base + less weight / full swing with less Str
            return isDefenseGear
                ? `Light (Str req -${value * 4})`
                : `Damage+${weaponQualityBaseDamage(6, value, secondaryType)} · Weight-${value * 4} · Full swing Str -${value * 4}`;
        case 7: {
            if (isDefenseGear) {
                return undefined;
            }
            const dmg = weaponQualityBaseDamage(7, value, secondaryType);
            return `Damage+${dmg}`; // Ancient: always 1 more than Sharp at same quality
        }
        case 8:
            if (isDefenseGear) {
                // Drop magic: *7 scale, hard cap 91. Merien stones can push total durability higher
                // (shown via Endurance cur/max lifespan lines, not this magic %).
                const endu = Math.min(91, Math.min(13, Math.max(0, value)) * 7);
                return `Endurance+${endu}%`;
            }
            // Sharp: flat base (Superior Sharp +2 / Exceptional Sharp +3) — NOT value×7
            return `Damage+${weaponQualityBaseDamage(8, value, secondaryType)}`;
        case 9:
            // Weapons/wands: Casting Probability; defense: minor CP
            return `Casting Probability+${value}`;
        case 10:
            // Legacy wand Mana Save primary / armor Mana Converting
            return isDefenseGear
                ? `Mana Converting+${value}%`
                : isWand
                    ? `Mana Save+${value}%`
                    : undefined;
        case 11:
            // Armor equip: TransMana (damage→MP %). Weapon naming: Experience (rare primary).
            return isDefenseGear
                ? `Mana Converting+${value}%`
                : `Experience+${value * 10}%`;
        case 12:
            // Armor equip: Charge Critical %. Weapon naming: Gold/Rep (rare primary).
            return isDefenseGear
                ? `Crit. Increase Chance+${Math.min(20, value)}%`
                : `Gold+${value * 10}%`;
        default:
            // Other primaries on physical weapons still show quality base Damage+ when Superior/Exceptional
            if (!isDefenseGear && !isWand && type > 0) {
                const dmg = weaponQualityBaseDamage(type, value, secondaryType);
                if (dmg > 0 && type !== 1 && type !== 2 && type !== 5 && type !== 6 && type !== 9) {
                    return `Damage+${dmg}`;
                }
            }
            return undefined;
    }
}

/**
 * Secondary fragment labels — matches Server.cpp CalcTotalItemEffect dwType2
 * (Poison Res / Hit / Def / HP / SP / MP / MR / PA / MA / CAD / Exp / Gold).
 */
/**
 * Secondary fragment (bits 12–15 / 8–11). Values 1–13 → display scales.
 * Weapons/wands typically roll: HR(2), CAD(10), Exp(11), Gold/Rep(12).
 * Armor: full defense set. Value display capped for +1..+7 feel on CAD.
 */
function secondaryStatLine(type: number, value: number, _itemType = ''): string | undefined {
    // Weapon/wand secondary product band: +1..+7 for HR / CAD / Exp / Gold(Rep).
    const n = Math.min(7, Math.max(1, value));
    // Defense fragments: hard caps — *7 stats ≤ 91 (nibble 13), PA/MA ≤ 39≈40 (nibble 13).
    const frag7 = Math.min(13, Math.max(0, value));
    const fragAbs = Math.min(13, Math.max(0, value));
    switch (type) {
        case 1:
            return `Poison Resistance+${frag7 * 7}`;
        case 2:
            // Hitting Probability +1..+7 → display value*7 like Olympia %
            return `Hitting Probability+${n * 7}`;
        case 3:
            return `Defense Ratio+${frag7 * 7}`;
        case 4:
            return `HP Recovery+${frag7 * 7}%`;
        case 5:
            return `SP Recovery+${frag7 * 7}`;
        case 6:
            return `MP Recovery+${frag7 * 7}%`;
        case 7:
            return `Magic Resistance+${frag7 * 7}`;
        case 8:
            return `Physical Absorption+${fragAbs * 3}`;
        case 9:
            return `Magic Absorption+${fragAbs * 3}`;
        case 10:
            // CAD +1..+7 (flat consecutive attack damage)
            return `Consecutive Attack Damage+${n}`;
        case 11:
            return `Experience+${n * 10}%`;
        case 12:
            // Gold / Rep-style find (some private servers label this “Rep”)
            return `Gold+${n * 10}%`;
        default:
            return undefined;
    }
}

/**
 * Common / Superior / Exceptional quality label (naming + base-damage tier).
 * - Common: no magic
 * - Superior: single magic (physical weapons: +1 base; Sharp +2; Ancient +3)
 * - Exceptional: dual magic OR primary value ≥ 7 (Sharp +3; Ancient +4)
 * Quality is the damage tier name — not "number of magics" as the player-facing meaning.
 */
export function olympiaQualityTier(itemAttribute: number): 'common' | 'superior' | 'exceptional' {
    if (!itemAttribute || (itemAttribute & 0x00f0_f000) === 0) {
        return 'common';
    }
    const type1 = (itemAttribute & 0x00f0_0000) >>> 20;
    if (type1 === 0) {
        return 'common';
    }
    const value1 = (itemAttribute & 0x000f_0000) >>> 16;
    const type2 = (itemAttribute & 0x0000_f000) >>> 12;
    if (type2 !== 0 || value1 >= 7) {
        return 'exceptional';
    }
    return 'superior';
}

/** Item.cfg effect-type 14 (ADDEFFECT) subtype → tooltip line. */
function addEffectStatLine(subtype: number, value: number): string | undefined {
    if (value === 0 && subtype !== 5) {
        return undefined;
    }
    switch (subtype) {
        case 1:
            return `Magic Resistance +${value}`;
        case 2:
            return `Mana Save +${value}%`;
        case 3:
            return `Physical Damage +${value}`;
        case 4:
            return `Defense Ratio +${value}`;
        case 5:
            return value !== 0 ? 'Lucky Effect' : undefined;
        case 6:
            return `Magical Damage +${value}`;
        case 7:
            return `Light Protection +${value}%`;
        case 8:
            return `Earth Protection +${value}%`;
        case 9:
            return `Fire Protection +${value}%`;
        case 10:
            return `Ice Protection +${value}%`;
        case 11:
            return `Poison Resistance +${value}`;
        case 12:
            return `Hitting Probability +${value}`;
        default:
            return undefined;
    }
}

function formatDice(throws: number, range: number, bonus: number, suffix: string): string {
    if (bonus !== 0) {
        return `${throws}D${range}+${bonus} (${suffix})`;
    }
    return `${throws}D${range} (${suffix})`;
}

/** Weight stones used for Str-to-lift / full-swing min (Client.cpp weight/100, round up). */
function weightStones(weight: number): number {
    return Math.floor(weight / 100) + (weight % 100 !== 0 ? 1 : 0);
}

function isWeaponEquipPos(equipPos: number): boolean {
    return equipPos === EQUIPPOS_RHAND || equipPos === EQUIPPOS_TWOHAND;
}

function isArmorEquipPos(equipPos: number): boolean {
    return (
        equipPos === EQUIPPOS_HEAD
        || equipPos === EQUIPPOS_BODY
        || equipPos === EQUIPPOS_ARMS
        || equipPos === EQUIPPOS_PANTS
        || equipPos === EQUIPPOS_BOOTS
    );
}

/**
 * Builds Item.cfg characteristic lines (shop + bag PutString extras).
 * Order mirrors Client.cpp bag hover then shop combat block.
 */
export function buildOlympiaItemCfgDetailLines(
    stats: OlympiaItemStats,
    curLifeSpan?: number,
    maxLifeSpanOverride?: number,
): string[] {
    const lines: string[] = [];
    const [v1, v2, v3, v4, v5, v6] = stats.effectValues;
    const stones = weightStones(stats.weight);

    if (stats.effectType === EFFECT_TYPE_ADDEFFECT) {
        const addLine = addEffectStatLine(v1, v2);
        if (addLine) {
            lines.push(addLine);
        }
    }

    if (isWeaponEquipPos(stats.equipPos) && (stats.effectType === EFFECT_TYPE_ATTACK || stats.effectType === EFFECT_TYPE_ATTACK_MANASAVE)) {
        lines.push(`Damage: ${formatDice(v1, v2, v3, 'S-M')}`);
        lines.push(`Damage: ${formatDice(v4, v5, v6, 'L')}`);
        if (stats.speed === 0) {
            lines.push('Speed(Min.~Max.): 0(10~10)');
        } else {
            const swingMin = Math.floor(stats.weight / 100);
            const swingMax = stats.speed * 13;
            lines.push(`Speed(Min.~Max.): ${stats.speed}(${swingMin} ~ ${swingMax})`);
            lines.push(`Required Str: ${swingMin} (${swingMax} full speed)`);
        }
        if (stats.effectType === EFFECT_TYPE_ATTACK_MANASAVE && v4 !== 0) {
            lines.push(`Mana Save +${v4}%`);
        }
    }

    if (stats.equipPos === EQUIPPOS_LHAND || (isArmorEquipPos(stats.equipPos) && stats.effectType === EFFECT_TYPE_DEFENSE)) {
        lines.push(`Defence: +${v1}%`);
        // Body armor Item.cfg v2 = Physical Absorption % (shield PA is derived from v1 server-side).
        if (isArmorEquipPos(stats.equipPos) && stats.effectType === EFFECT_TYPE_DEFENSE && v2 > 0) {
            lines.push(`Physical Absorption: +${v2}%`);
        }
        if (stats.equipPos === EQUIPPOS_LHAND && v1 > 0) {
            const shieldPa = v1 - Math.floor(v1 / 3);
            if (shieldPa > 0) {
                lines.push(`Physical Absorption: +${shieldPa}%`);
            }
        }
    }

    if (isArmorEquipPos(stats.equipPos) && stats.effectType === EFFECT_TYPE_DEFENSE && v5 !== 0) {
        switch (v4) {
            case 10:
                lines.push(`Available for above Str ${v5}`);
                break;
            case 11:
                lines.push(`Available for above Dex ${v5}`);
                break;
            case 12:
                lines.push(`Available for above Vit ${v5}`);
                break;
            case 13:
                lines.push(`Available for above Int ${v5}`);
                break;
            case 14:
                lines.push(`Available for above Mag ${v5}`);
                break;
            case 15:
                lines.push(`Available for above Chr ${v5}`);
                break;
            default:
                break;
        }
    }

    if (stats.levelLimit !== 0) {
        lines.push(`Level: ${stats.levelLimit}`);
    }

    if (stats.equipPos !== EQUIPPOS_NONE && stats.weight >= 1100 && !isWeaponEquipPos(stats.equipPos)) {
        lines.push(`Required Str: ${stones}`);
    }

    if (stats.equipPos !== EQUIPPOS_NONE && stats.maxLifeSpan > 1) {
        const max = maxLifeSpanOverride !== undefined && maxLifeSpanOverride > 1 ? maxLifeSpanOverride : stats.maxLifeSpan;
        const cur = curLifeSpan !== undefined ? curLifeSpan : max;
        lines.push(`Endurance: ${cur}/${max}`);
    }

    if (stats.weight > 0) {
        lines.push(`Weight: ${Math.floor(stats.weight / 100)} Stone`);
    }

    return lines;
}

function applyRepSuffix(name: string, repBonus: number): string {
    if (repBonus <= 0) {
        return name;
    }
    const plusMatch = /\+(\d+)$/.exec(name);
    if (plusMatch) {
        const combined = Number.parseInt(plusMatch[1], 10) + repBonus;
        return `${name.slice(0, -plusMatch[0].length)}+${combined}`;
    }
    return `${name}+${repBonus}`;
}

/**
 * Ports Helbreath Olympia Client.cpp GetItemName (attribute bitfield) plus
 * Item.cfg characteristic lines used by bag/shop PutString tooltips.
 *
 * Naming rules (Olympia parity — important):
 * - Exactly ONE primary magic prefix (type1). Dual magic is primary + secondary
 *   fragment, NOT two prefixes. Secondary never becomes a name prefix.
 * - "Righteous Light Axe" is valid: magic = Righteous, base item name = "Light Axe"
 *   (catalog weapon id 59). Light is not a second magic when it is the base name.
 * - Primary type 6 = "Light " magic (Weight-N); only applies when base is NOT already
 *   a "Light *" catalog name still gets prefix "Light Light Axe" only if type1=6 on
 *   a Light Axe — Olympia does the same; rare/confusing but bitfield-correct.
 */
export function getOlympiaItemDisplay(
    baseName: string,
    itemAttribute = 0,
    itemColor = 0,
    itemType = '',
    itemId?: number,
    curLifeSpan?: number,
    maxLifeSpan?: number,
): OlympiaItemDisplay {
    const type1 = (itemAttribute & 0x00f0_0000) >>> 20;
    const value1 = (itemAttribute & 0x000f_0000) >>> 16;
    const type2 = (itemAttribute & 0x0000_f000) >>> 12;
    const value2 = (itemAttribute & 0x0000_0f00) >>> 8;
    const repBonus = (itemAttribute & 0xf000_0000) >>> 28;

    let name = baseName;
    let statLine1: string | undefined;
    let statLine2: string | undefined;
    let isMagic = false;
    let magicPrefixLabel: string | undefined;

    const quality = olympiaQualityTier(itemAttribute);

    // Primary magic (type1) and/or secondary-only fragment (type2) both count as magic.
    // Arena free HP/MP and DR pieces used secondary-only attrs — old code hid them as "plain clothes".
    if (itemAttribute !== 0 && (itemAttribute & 0x00f0_f000) !== 0) {
        isMagic = true;
        const isDefenseGear = ARMOR_TYPES.has(itemType);
        if (type1 !== 0) {
            magicPrefixLabel = primaryPrefix(type1, itemType, baseName).trim();
            // Weapons/wands: Superior/Exceptional quality prefix + primary magic.
            // Defense gear: NEVER Superior/Exceptional — only magic prefix (Endurance / Light / …).
            const qualityPrefix =
                !isDefenseGear && (quality === 'exceptional' || quality === 'superior')
                    ? quality === 'exceptional'
                        ? 'Exceptional '
                        : 'Superior '
                    : '';
            const pfx = primaryPrefix(type1, itemType, baseName);
            name = `${qualityPrefix}${pfx}${baseName}`;
            statLine1 = primaryStatLine(type1, value1, itemType, baseName, type2);
            // Non-Sharp/Ancient physical weapons still get quality base Damage+N on the tooltip.
            if (
                !statLine1
                && (itemType === ItemTypes.WEAPON || itemType === 'weapon')
                && !isWandName(baseName)
                && type1 !== 2
                && type1 !== 5
                && type1 !== 6
                && type1 !== 9
            ) {
                const dmg = weaponQualityBaseDamage(type1, value1, type2);
                if (dmg > 0) {
                    statLine1 = `Damage+${dmg}`;
                }
            }
        }
        if (type2 !== 0) {
            // Secondary = fragment stats (DR / HP Recovery / MP Recovery / MR / …).
            statLine2 = secondaryStatLine(type2, value2, itemType);
            // Secondary-only armor (no primary): still green name + fragment line.
            if (type1 === 0 && statLine2) {
                magicPrefixLabel = statLine2.split('+')[0]?.trim() || 'Magic';
                name = baseName; // keep base name; green color marks magic
            }
        }
    }

    if (repBonus > 0) {
        isMagic = true;
        name = applyRepSuffix(name, repBonus);
    }

    const detailLines: string[] = [];
    // Player-facing tooltip: show magic name + stats only.
    // Hide Quality line and Color tier text (sprite tint still applies on icon/avatar).
    if (isMagic && magicPrefixLabel) {
        detailLines.push(`Magic: ${magicPrefixLabel}`);
        detailLines.push(`Base: ${baseName}`);
    }
    if (statLine1) {
        detailLines.push(statLine1);
    }
    if (statLine2) {
        detailLines.push(statLine2);
    }
    // Merien +N on defense gear (not Superior/Exceptional): DR / PA from upgrade nibble.
    if (repBonus > 0 && ARMOR_TYPES.has(itemType)) {
        detailLines.push(`Merien +${repBonus}: Defense Ratio+${repBonus}`);
        if (repBonus >= 5) {
            const paMerien = Math.min(6, repBonus - 4);
            detailLines.push(`Merien PA+${paMerien} (+5→1 … +10→6)`);
        }
    }

    if (itemId !== undefined) {
        const stats = OLYMPIA_ITEM_STATS[itemId];
        if (stats) {
            detailLines.push(...buildOlympiaItemCfgDetailLines(stats, curLifeSpan, maxLifeSpan));
        }
    }

    const nameColor = isMagic || itemColor > 0
        ? (itemColor > 0
            ? OLYMPIA_ITEM_NAME_COLORS[itemColor] ?? OLYMPIA_MAGIC_NAME_COLOR
            : OLYMPIA_MAGIC_NAME_COLOR)
        : undefined;

    return {
        name,
        statLine1,
        statLine2,
        detailLines,
        isMagic,
        nameColor,
    };
}

export function hasOlympiaMagic(itemAttribute = 0): boolean {
    return itemAttribute !== 0 && (itemAttribute & 0x00f0_f000) !== 0;
}

export function buildItemHoverInfo(
    itemDef: Item,
    options: {
        itemId: number;
        itemUid: string;
        itemAttribute?: number;
        itemColor?: number;
        effectOverrides?: Effect[];
        quantity?: number;
        curLifeSpan?: number;
        maxLifeSpan?: number;
        cicLevel?: number;
        cicStatKind?: number;
        cicStatValue?: number;
        siphonLevel?: number;
        source?: InventoryItemHoverInfo['source'];
        mouseX: number;
        mouseY: number;
    },
): InventoryItemHoverInfo {
    const display = getOlympiaItemDisplay(
        itemDef.name,
        options.itemAttribute ?? 0,
        options.itemColor ?? 0,
        itemDef.itemType,
        options.itemId,
        options.curLifeSpan,
        options.maxLifeSpan,
    );

    const extraDetails = [...(display.detailLines ?? [])];
    if (options.cicLevel && options.cicLevel >= 3) {
        const kind =
            options.cicStatKind === 1 ? 'HP' : options.cicStatKind === 2 ? 'SP' : options.cicStatKind === 3 ? 'MP' : '?';
        const val = options.cicStatValue ?? 0;
        extraDetails.unshift(`CIC${options.cicLevel} ${kind}${val}`);
    }
    if (options.siphonLevel && options.siphonLevel > 0) {
        extraDetails.unshift(`Vamping Lv.${options.siphonLevel}`);
    } else if (options.itemId === 1200 || options.itemId === 1201) {
        extraDetails.unshift(options.itemId === 1200 ? 'Mana Vamping (INT 113+)' : 'HP Vamping (STR 130+)');
    }

    return {
        itemName: display.name,
        magicStatLine1: display.statLine1,
        magicStatLine2: display.statLine2,
        detailLines: extraDetails,
        itemNameColor: display.nameColor,
        itemType: itemDef.itemType,
        itemId: options.itemId,
        itemUid: options.itemUid,
        source: options.source,
        gender: itemDef.gender,
        quantity: options.quantity ?? 1,
        stackable: itemDef.stackable,
        consumable: itemDef.consumable,
        appearanceGlowColor: getGlowEffectColor(itemDef, options.effectOverrides),
        appearanceGlareColor: getGlareEffectColor(itemDef, options.effectOverrides),
        appearanceTintColor: getTintAppearanceEffectColor(itemDef, options.effectOverrides),
        inventoryTintColor: getTintInventoryEffectColorWithOverrides(itemDef, options.effectOverrides),
        mouseX: options.mouseX,
        mouseY: options.mouseY,
    };
}

export function buildInventoryItemHoverInfo(
    itemDef: Item,
    item: Pick<
        InventoryItem,
        | 'itemId'
        | 'itemUid'
        | 'itemAttribute'
        | 'itemColor'
        | 'effectOverrides'
        | 'quantity'
        | 'curLifeSpan'
        | 'maxLifeSpan'
        | 'cicLevel'
        | 'cicStatKind'
        | 'cicStatValue'
        | 'siphonLevel'
    >,
    mouseX: number,
    mouseY: number,
): InventoryItemHoverInfo {
    return buildItemHoverInfo(itemDef, {
        itemId: item.itemId,
        itemUid: item.itemUid,
        itemAttribute: item.itemAttribute,
        itemColor: item.itemColor,
        effectOverrides: item.effectOverrides,
        quantity: item.quantity,
        curLifeSpan: item.curLifeSpan,
        maxLifeSpan: item.maxLifeSpan,
        cicLevel: item.cicLevel,
        cicStatKind: item.cicStatKind,
        cicStatValue: item.cicStatValue,
        siphonLevel: item.siphonLevel,
        source: 'inventory',
        mouseX,
        mouseY,
    });
}
