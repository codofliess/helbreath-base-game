/**
 * Item catalog, bag model, equipment slots, and tint/sprite helpers (merged with server `InitialState` item directory).
 *
 * `InventoryItem`: server item id + unique `itemUid`, optional bag cell and stack count.
 */
export interface InventoryItem {
    itemId: number;
    itemUid: string;
    /** Relative X coordinate within bag container (pixels from left). Undefined = auto grid slot. */
    bagX?: number;
    /** Relative Y coordinate within bag container (pixels from top). Undefined = auto grid slot. */
    bagY?: number;
    /** Number of stacked items. Defaults to 1. Used for stackable items. */
    quantity?: number;
    /** Authoritative bag z-order from the server. Higher numbers render on top. */
    bagZIndex?: number;
    /** Per-instance effect overrides (e.g. Appearance Glow from ItemDialog). Merged with item effects, overrides take precedence. */
    effectOverrides?: Effect[];
    /** Olympia m_dwAttribute bitfield (shards, fragments, rep suffix). */
    itemAttribute?: number;
    /** Olympia item name color tier (1–8); 0 = default catalog name color. */
    itemColor?: number;
    /** Olympia m_wCurLifeSpan for durable gear. */
    curLifeSpan?: number;
    /** Olympia m_wMaxLifeSpan for durable gear. */
    maxLifeSpan?: number;
    /** 0=unbound, 1=soulbound, 2=guildbound (server). */
    bindState?: number;
    /** Guild id when guildbound. */
    boundGuildId?: string;
    /** CIC craft tier 0=none, 3–7. */
    cicLevel?: number;
    /** 0=none, 1=HP, 2=SP, 3=MP. */
    cicStatKind?: number;
    /** e.g. 35 for HP35. */
    cicStatValue?: number;
    /** Mana/HP Vamping gem power 0–15. */
    siphonLevel?: number;
}

export enum ItemTypes {
    WEAPON = 'weapon',
    SHIELD = 'shield',
    ARMOR = 'armor',
    HAUBERK = 'hauberk',
    LEGGINGS = 'leggings',
    HELMET = 'helmet',
    CAPE = 'cape',
    BOOTS = 'boots',
    ACCESSORY = 'accessory',
    NECKLACE = 'necklace',
    /** 4th jewelry slot — Mana/HP Vamping gems (not angel/accessory). */
    GEM = 'gem',
    RING = 'ring',
    MISC = 'misc',
}

/** Weapon type for attack behavior (e.g. BOW spawns arrow projectile). */
export enum WeaponType {
    BOW = 'BOW',
}

/** Ring equipment slot type (left vs right). */
export type RingSlot = 'ring-left' | 'ring-right';

export const RING_SLOT_LEFT: RingSlot = 'ring-left';
export const RING_SLOT_RIGHT: RingSlot = 'ring-right';

/** Equipment slot types. Single-slot items use their ItemTypes; rings use RingSlot. MISC is excluded (not equippable). */
export type EquipmentSlot = Exclude<ItemTypes, ItemTypes.RING | ItemTypes.MISC> | RingSlot;

/** Slots that accept ring items. */
export const RING_SLOTS: [RingSlot, RingSlot] = [RING_SLOT_LEFT, RING_SLOT_RIGHT];

/** Weapon/item effect types. When equipped, triggers special visual/behavior on attack. */
export enum ItemEffect {
    STORM_BRINGER = 'STORM_BRINGER',
    /** Star twinkle: random sparkles pop up over the player constantly (effect5 sheet 5). */
    STAR_TWINKLE = 'STAR_TWINKLE',
    /** Glare effect on equipped weapon (e.g. Dark Knight Templar Sword). Color via effectColor. */
    GLARE = 'GLARE',
    /** Glow effect on equipped sprite (Phaser FX). Oscillating outer strength. Color via effectColor. */
    GLOW = 'GLOW',
    /** Tint item sprite in inventory UI. Color via effectColor (default black). */
    TINT_INVENTORY = 'TINT_INVENTORY',
    /** Tint equipped sprite appearance in-world (multiply). Color via effectColor. */
    TINT_APPEARANCE = 'TINT_APPEARANCE',
}

/** Single item effect with optional color (e.g. hex for GLARE, GLOW, TINT_APPEARANCE). */
export interface Effect {
    effect: ItemEffect;
    /** Hex colour for GLARE, GLOW (e.g. 0x0000ff) or TINT_APPEARANCE (multiply tint). */
    effectColor?: number;
}

/** Default effectColor for TINT_INVENTORY when not specified (black). */
export const TINT_INVENTORY_DEFAULT_COLOR = 0x000000;

/**
 * Merges item effects with per-instance effect overrides. Overrides replace existing effects of the same type.
 */
export function mergeItemEffects(itemEffects?: Effect[], overrides?: Effect[]): Effect[] | undefined {
    const base = itemEffects ?? [];
    if (!overrides?.length) return base.length ? base : undefined;
    const result = [...base];
    for (const ov of overrides) {
        const idx = result.findIndex((e) => e.effect === ov.effect);
        if (idx >= 0) result[idx] = ov;
        else result.push(ov);
    }
    return result.length ? result : undefined;
}

/** GLOW color for hover UI; default 0xffffff. Uses merged effects. */
export function getGlowEffectColor(itemDef: Item, effectOverrides?: Effect[]): number | undefined {
    const merged = mergeItemEffects(itemDef.effects, effectOverrides);
    const eff = merged?.find((e) => e.effect === ItemEffect.GLOW);
    if (!eff) return undefined;
    return eff.effectColor ?? 0xffffff;
}

/** GLARE color for hover UI; default 0x0000ff. */
export function getGlareEffectColor(itemDef: Item, effectOverrides?: Effect[]): number | undefined {
    const merged = mergeItemEffects(itemDef.effects, effectOverrides);
    const eff = merged?.find((e) => e.effect === ItemEffect.GLARE);
    if (!eff) return undefined;
    return eff.effectColor ?? 0x0000ff;
}

/** TINT_APPEARANCE multiply color; default 0xffffff. */
export function getTintAppearanceEffectColor(itemDef: Item, effectOverrides?: Effect[]): number | undefined {
    const merged = mergeItemEffects(itemDef.effects, effectOverrides);
    const eff = merged?.find((e) => e.effect === ItemEffect.TINT_APPEARANCE);
    if (!eff) return undefined;
    return eff.effectColor ?? 0xffffff;
}

/** TINT_INVENTORY tint; default black. */
export function getTintInventoryEffectColorWithOverrides(itemDef: Item, effectOverrides?: Effect[]): number | undefined {
    const merged = mergeItemEffects(itemDef.effects, effectOverrides);
    const eff = merged?.find((e) => e.effect === ItemEffect.TINT_INVENTORY);
    if (!eff) return undefined;
    return eff.effectColor ?? TINT_INVENTORY_DEFAULT_COLOR;
}

/** TINT_INVENTORY from static `Item` effects only. */
export function getTintInventoryEffectColor(item: Item): number | undefined {
    const eff = item.effects?.find((e) => e.effect === ItemEffect.TINT_INVENTORY);
    if (!eff) return undefined;
    return eff.effectColor ?? TINT_INVENTORY_DEFAULT_COLOR;
}

/**
 * Returns true if any equipped item has the given effect (item def + effectOverrides).
 * Used for passive effects like STAR_TWINKLE that trigger while equipped.
 */
export function hasEquippedItemEffect(
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
    effect: ItemEffect
): boolean {
    for (const inv of Object.values(equippedItems)) {
        if (!inv) continue;
        const itemDef = getItemById(inv.itemId);
        const merged = mergeItemEffects(itemDef?.effects, inv.effectOverrides);
        if (merged?.some((e) => e.effect === effect)) return true;
    }
    return false;
}

/** TINT_INVENTORY from definition + instance `effectOverrides` (e.g. drop to ground). */
export function getTintInventoryEffectColorFromInventoryItem(inventoryItem: InventoryItem): number | undefined {
    const itemDef = getItemById(inventoryItem.itemId);
    if (!itemDef) return undefined;
    const merged = mergeItemEffects(itemDef.effects, inventoryItem.effectOverrides);
    const eff = merged?.find((e) => e.effect === ItemEffect.TINT_INVENTORY);
    if (!eff) return undefined;
    return eff.effectColor ?? TINT_INVENTORY_DEFAULT_COLOR;
}

/**
 * Olympia m_cItemColor → inventory/bag multiply tint (mirrors Client.cpp m_wWR).
 * Kept here (not imported from OlympiaItemName) to avoid circular deps with Items.
 * Color 4 = Poison green on Battle Hammer / weapons.
 */
const OLYMPIA_ITEM_COLOR_INVENTORY_TINTS: Record<number, number> = {
    1: 0x8a8aa0,
    2: 0x8a8aa0,
    3: 0xc8a040,
    4: 0x66c866,
    5: 0xe0a820,
    6: 0x5068c0,
    7: 0xd0d0d0,
    8: 0xd090d0,
};

/** Phaser/UI bag tint from Olympia itemColor tier (0/undefined = none). */
export function getOlympiaItemColorInventoryTint(itemColor: number | undefined): number | undefined {
    if (itemColor === undefined || itemColor <= 0) {
        return undefined;
    }
    return OLYMPIA_ITEM_COLOR_INVENTORY_TINTS[itemColor];
}

/** Inventory texture key; delegates to `getItemInventorySpriteKeyWithOverrides`. */
export function getItemInventorySpriteKey(item: Item, gender: Gender): string | undefined {
    return getItemInventorySpriteKeyWithOverrides(item, gender);
}

/**
 * `sprite-item-pack-{sheet}-{frame}` with optional `-{hex}` suffix when tinted.
 * Priority: Olympia `itemColor` (poison=green weapon palette) → TINT_INVENTORY effect overrides.
 */
export function getItemInventorySpriteKeyWithOverrides(
    itemDef: Item,
    gender: Gender,
    effectOverrides?: Effect[],
    itemColor?: number,
): string | undefined {
    const sheetIndex = getItemSheetIndex(itemDef, gender);
    const spriteIndex = getItemSpriteIndex(itemDef, gender);
    if (sheetIndex === undefined || spriteIndex === undefined) return undefined;
    const baseKey = `sprite-item-pack-${sheetIndex}-${spriteIndex}`;
    const olympiaTint = getOlympiaItemColorInventoryTint(itemColor);
    if (olympiaTint !== undefined) {
        const effectColorHex = olympiaTint.toString(16).padStart(6, '0');
        return `${baseKey}-${effectColorHex}`;
    }
    const merged = effectOverrides?.length ? mergeItemEffects(itemDef.effects, effectOverrides) : itemDef.effects;
    const eff = merged?.find((e) => e.effect === ItemEffect.TINT_INVENTORY);
    if (!eff) return baseKey;
    const effectColor = eff.effectColor ?? TINT_INVENTORY_DEFAULT_COLOR;
    const effectColorHex = effectColor.toString(16).padStart(6, '0');
    return `${baseKey}-${effectColorHex}`;
}

/**
 * Bag sprite key — always item-pack (classic DrawDialogBox_Inventory).
 * Ground size preference only affects world drops, not bag chrome icons.
 */
export function getBagItemSpriteKeyWithOverrides(
    itemDef: Item,
    gender: Gender,
    effectOverrides: Effect[] | undefined,
    _displaySize?: GroundItemDisplaySize,
    itemColor?: number,
): string | undefined {
    return getItemInventorySpriteKeyWithOverrides(itemDef, gender, effectOverrides, itemColor);
}

/** Maps equippable ItemTypes to equipment slot IDs. MISC is excluded (not equippable). */
export const ITEM_TYPE_TO_SLOT_ID: Record<Exclude<ItemTypes, ItemTypes.MISC>, string> = {
    [ItemTypes.WEAPON]: 'weapon',
    [ItemTypes.SHIELD]: 'shield',
    [ItemTypes.ARMOR]: 'armor',
    [ItemTypes.HAUBERK]: 'hauberk',
    [ItemTypes.LEGGINGS]: 'leggings',
    [ItemTypes.HELMET]: 'helmet',
    [ItemTypes.CAPE]: 'cape',
    [ItemTypes.BOOTS]: 'boots',
    [ItemTypes.ACCESSORY]: 'accessory',
    [ItemTypes.NECKLACE]: 'necklace',
    [ItemTypes.GEM]: 'gem',
    [ItemTypes.RING]: 'ring',
};

/** Maps EquipmentSlot to slot IDs for the inventory UI. */
export const EQUIPMENT_SLOT_TO_SLOT_ID: Record<EquipmentSlot, string> = {
    ...Object.fromEntries(
        (Object.keys(ITEM_TYPE_TO_SLOT_ID) as (keyof typeof ITEM_TYPE_TO_SLOT_ID)[]).filter((t) => t !== ItemTypes.RING).map((t) => [t, ITEM_TYPE_TO_SLOT_ID[t]]),
    ),
    [RING_SLOT_LEFT]: 'ring-left',
    [RING_SLOT_RIGHT]: 'ring-right',
} as Record<EquipmentSlot, string>;

/** Equipment slots that can display equipped items. */
export const EQUIPPABLE_SLOTS: EquipmentSlot[] = [
    ItemTypes.WEAPON, ItemTypes.SHIELD, ItemTypes.ARMOR, ItemTypes.HAUBERK, ItemTypes.LEGGINGS,
    ItemTypes.HELMET, ItemTypes.CAPE, ItemTypes.BOOTS, ItemTypes.ACCESSORY, ItemTypes.NECKLACE,
    ItemTypes.GEM,
    RING_SLOT_LEFT, RING_SLOT_RIGHT,
];

/** Visible slots currently synced to nearby players for remote appearance. */
export const REMOTE_VISIBLE_EQUIPMENT_SLOTS: ItemTypes[] = [
    ItemTypes.WEAPON,
    ItemTypes.SHIELD,
    ItemTypes.ARMOR,
    ItemTypes.HAUBERK,
    ItemTypes.LEGGINGS,
    ItemTypes.BOOTS,
    ItemTypes.HELMET,
    ItemTypes.CAPE,
    ItemTypes.ACCESSORY,
];

export function isEquipmentSlot(value: string): value is EquipmentSlot {
    return EQUIPPABLE_SLOTS.includes(value as EquipmentSlot);
}

/**
 * True when catalog `itemType` may occupy `slot`.
 * Rings only fit ring-left/ring-right; every other equippable type only fits the slot named like the type.
 * MISC is never equippable.
 */
export function isItemTypeCompatibleWithSlot(itemType: ItemTypes, slot: EquipmentSlot): boolean {
    if (itemType === ItemTypes.MISC) {
        return false;
    }
    if (itemType === ItemTypes.RING) {
        return slot === RING_SLOT_LEFT || slot === RING_SLOT_RIGHT;
    }
    if (itemType === ItemTypes.GEM) {
        return slot === ItemTypes.GEM;
    }
    return slot === itemType;
}

import type { GroundItemDisplaySize } from './GroundItemDisplay';
import { Gender } from '../Types';
import { OLYMPIA_GENERATED_ITEMS, type OlympiaGeneratedItemRow } from './OlympiaItems.generated';
import { PlayerGender, type ItemDirectoryEntry } from '../proto/generated/network';

/**
 * Item data structure with sprite references for pack, ground, and equipped states.
 */
export interface Item {
    id: number;
    name: string;
    itemType: ItemTypes;
    itemSheetIndexMale?: number;
    itemSheetIndexFemale?: number;
    itemSpriteIndexMale?: number;
    itemSpriteIndexFemale?: number;
    /** Sprite index when dropped on ground. Falls back to itemSpriteIndex* when not set. */
    droppedItemSpriteIndexMale?: number;
    /** Sprite index when dropped on ground. Falls back to itemSpriteIndex* when not set. */
    droppedItemSpriteIndexFemale?: number;
    gender?: Gender;
    equippedSpriteMale?: string;
    equippedSpriteFemale?: string;
    /** When set, weapon animation uses 56 consecutive sprites starting from this index (for shared sprites). */
    startSpriteSheetIndex?: number;
    /** Slots this item blocks when equipped; set from server InitialState items_directory. */
    blockedItemSlots?: ItemTypes[];
    /** Sprite offset X for appearance rendering (e.g. angelic pendant). Applied when equipped. */
    offsetX?: number;
    /** Sprite offset Y for appearance rendering (e.g. angelic pendant). Applied when equipped. */
    offsetY?: number;
    /** Sprite scale for inventory display. 1 = 100%, 0.5 = 50% smaller, 1.5 = 50% larger, 2 = 2x size. */
    scale?: number;
    /** When true, multiple instances of this item stack in a single bag slot (server items_directory). */
    stackable?: boolean;
    /** When true, item can be consumed (double-click in bag). Must be MISC type (server items_directory). */
    consumable?: true;
    /** Sound name to play when item is consumed (e.g. 'E28'). */
    consumptionSound?: string;
    /** Item effects (server items_directory; indices match ItemEffect wire order). */
    effects?: Effect[];
    /** Weapon type for attack behavior; server uses 0 = melee, 1 = bow (client WeaponType.BOW). */
    weaponType?: WeaponType;
}

/** Latest server item rows from InitialState; merged into lookups by id. */
let serverItemDirectoryById: Map<number, ItemDirectoryEntry> | undefined;

const ITEM_EFFECT_FROM_PROTO_INDEX: readonly ItemEffect[] = [
    ItemEffect.STORM_BRINGER,
    ItemEffect.STAR_TWINKLE,
    ItemEffect.GLARE,
    ItemEffect.GLOW,
    ItemEffect.TINT_INVENTORY,
    ItemEffect.TINT_APPEARANCE,
];

export function effectsFromDirectoryEntries(entries: ReadonlyArray<{ effect: number; effectColor?: number }>): Effect[] | undefined {
    const effects: Effect[] = [];
    for (const entry of entries) {
        const effect = ITEM_EFFECT_FROM_PROTO_INDEX[entry.effect];
        if (effect === undefined) {
            continue;
        }

        const row: Effect = { effect };
        if (entry.effectColor !== undefined) {
            row.effectColor = entry.effectColor;
        }
        effects.push(row);
    }
    return effects.length ? effects : undefined;
}

function itemTypeFromDirectoryString(s: string): ItemTypes {
    if ((Object.values(ItemTypes) as string[]).includes(s)) {
        return s as ItemTypes;
    }
    console.warn(`[Items] Unknown item_type in directory: ${s}`);
    return ItemTypes.MISC;
}

function mergeWithItemDirectory(base: Item): Item {
    const sv = serverItemDirectoryById?.get(base.id);
    if (!sv) {
        return base;
    }
    const blocked: ItemTypes[] = [];
    for (const s of sv.blockedItemSlots ?? []) {
        const t = itemTypeFromDirectoryString(s);
        if (!blocked.includes(t)) {
            blocked.push(t);
        }
    }
    const effects: Effect[] = [];
    effects.push(...(effectsFromDirectoryEntries(sv.effects ?? []) ?? []));
    const weaponType = sv.weaponType === 1 ? WeaponType.BOW : undefined;
    const serverEquipGender =
        sv.equipGender !== undefined && sv.equipGender !== PlayerGender.UNRECOGNIZED
            ? (sv.equipGender === PlayerGender.PLAYER_GENDER_FEMALE ? Gender.FEMALE : Gender.MALE)
            : undefined;
    return {
        ...base,
        name: sv.name,
        itemType: itemTypeFromDirectoryString(sv.itemType),
        blockedItemSlots: blocked.length ? blocked : undefined,
        // Prefer server flags when present; never wipe catalog consumable/stackable with falsey proto defaults.
        // Cash tablets always consumable; Integrity never free-consumable (upgrade reconfirm only).
        stackable: sv.stackable === true ? true : base.stackable,
        consumable:
            base.id === 1112
                ? false
                : base.id >= 1310 && base.id <= 1313
                  ? true
                  : sv.consumable === true
                    ? true
                    : base.consumable,
        effects: effects.length ? effects : undefined,
        weaponType,
        ...(serverEquipGender !== undefined ? { gender: serverEquipGender } : {}),
    };
}

/** Replaces the cached item directory from InitialState (NetworkManager). */
export function applyItemDirectory(entries: readonly ItemDirectoryEntry[]): void {
    serverItemDirectoryById = new Map(entries.map((e) => [e.id, e]));
}

/** Full list with sprite rows merged with item directory (for UI pickers). */
export function getMergedItems(): Item[] {
    return ITEMS.map((base) => mergeWithItemDirectory(base));
}

/** Item pack sheet index for gender; falls back to the other column when one is missing. */
export function getItemSheetIndex(item: Item, gender: Gender): number | undefined {
    const male = item.itemSheetIndexMale;
    const female = item.itemSheetIndexFemale;
    if (gender === Gender.MALE) return male ?? female;
    return female ?? male;
}

/** Frame index within the pack sheet; same fallback rules as `getItemSheetIndex`. */
export function getItemSpriteIndex(item: Item, gender: Gender): number | undefined {
    const male = item.itemSpriteIndexMale;
    const female = item.itemSpriteIndexFemale;
    if (gender === Gender.MALE) return male ?? female;
    return female ?? male;
}

/** Ground drop frame: `droppedItemSpriteIndex*` else `itemSpriteIndex*`. */
export function getDroppedItemSpriteIndex(item: Item, gender: Gender): number | undefined {
    const male = item.droppedItemSpriteIndexMale ?? item.itemSpriteIndexMale;
    const female = item.droppedItemSpriteIndexFemale ?? item.itemSpriteIndexFemale;
    if (gender === Gender.MALE) return male ?? female;
    return female ?? male;
}

/**
 * Last-write-wins catalog index so cash-shop appends (950–955, 1310+) override any
 * earlier generated row with the same id (prevents bag "?" from a blank first match).
 */
const ITEM_BY_ID: Map<number, Item> = new Map();

function rebuildItemByIdIndex(): void {
    ITEM_BY_ID.clear();
    for (const item of ITEMS) {
        ITEM_BY_ID.set(item.id, item);
    }
}

/** Static row from `ITEMS` merged with server item directory when present. */
export function getItemById(id: number): Item | undefined {
    if (ITEM_BY_ID.size === 0) {
        rebuildItemByIdIndex();
    }
    const base = ITEM_BY_ID.get(id);
    if (!base) {
        return undefined;
    }
    return mergeWithItemDirectory(base);
}

/** Resolve by `equippedSpriteMale` / `equippedSpriteFemale` basename. */
export function getItemByEquippedSprite(spriteName: string): Item | undefined {
    const base = ITEMS.find((i) => i.equippedSpriteMale === spriteName || i.equippedSpriteFemale === spriteName);
    if (!base) {
        return undefined;
    }
    return mergeWithItemDirectory(base);
}

/**
 * Overwrites for broken male weapon sprites. When the player is in the given state with the male sprite equipped,
 * the female sprite is rendered instead.
 * Key: PlayerState name (e.g. 'IdleCombatMode'). Value: array of { maleSprite, femaleSprite } mappings.
 */
export const WEAPON_SPRITE_OVERWRITES: Record<string, Array<{ maleSprite: string; femaleSprite: string }>> = {
    IdleCombatMode: [
        { maleSprite: 'maxe1', femaleSprite: 'waxe1' },
        { maleSprite: 'maxe2', femaleSprite: 'waxe2' },
        { maleSprite: 'maxe3', femaleSprite: 'waxe3' },
        { maleSprite: 'maxe4', femaleSprite: 'waxe4' },
        { maleSprite: 'maxe5', femaleSprite: 'waxe5' },
    ],
};

function mapGeneratedItem(row: OlympiaGeneratedItemRow): Item {
    const itemType = itemTypeFromDirectoryString(row.itemType);
    const blocked = row.blockedItemSlots?.map((s) => itemTypeFromDirectoryString(s)).filter(Boolean) as ItemTypes[] | undefined;
    const effects = row.effects?.map((eff) => {
        if (eff.effect === 'STORM_BRINGER') {
            return { effect: ItemEffect.STORM_BRINGER };
        }
        if (eff.effect === 'GLARE') {
            return { effect: ItemEffect.GLARE, effectColor: eff.effectColor };
        }
        if (eff.effect === 'GLOW') {
            return { effect: ItemEffect.GLOW, effectColor: eff.effectColor };
        }
        return undefined;
    }).filter((e): e is Effect => e !== undefined);
    return {
        id: row.id,
        name: row.name,
        itemType,
        itemSheetIndexMale: row.itemSheetIndexMale,
        itemSheetIndexFemale: row.itemSheetIndexFemale,
        itemSpriteIndexMale: row.itemSpriteIndexMale,
        itemSpriteIndexFemale: row.itemSpriteIndexFemale,
        gender: row.gender === 1 ? Gender.FEMALE : row.gender === 0 ? Gender.MALE : undefined,
        equippedSpriteMale: row.equippedSpriteMale,
        equippedSpriteFemale: row.equippedSpriteFemale,
        startSpriteSheetIndex: row.startSpriteSheetIndex,
        scale: row.scale,
        offsetX: row.offsetX,
        offsetY: row.offsetY,
        consumptionSound: row.consumptionSound,
        blockedItemSlots: blocked?.length ? blocked : undefined,
        stackable: row.stackable,
        consumable: row.consumable ? true : undefined,
        weaponType: row.weaponType === 'BOW' ? WeaponType.BOW : undefined,
        effects: effects?.length ? effects : undefined,
    };
}

export const ITEMS: Item[] = [
    ...OLYMPIA_GENERATED_ITEMS.map(mapGeneratedItem),
    // Chain Lords special gems (4th jewelry slot) + residues for disenchant → vamping shards.
    { id: 1200, name: 'Mana Vamping Gem', itemType: ItemTypes.GEM },
    { id: 1201, name: 'HP Vamping Gem', itemType: ItemTypes.GEM },
    { id: 1202, name: 'Mana Vamping Residue', itemType: ItemTypes.MISC },
    { id: 1203, name: 'HP Vamping Residue', itemType: ItemTypes.MISC },
    // Cash Shop gear + tickets / tablets — bag icons from item-pack (same frames as classic Cape/Shoes/Boots/Ancient Tablet).
    {
        id: 950,
        name: 'Shoes Exp+30% + MP Recovery+40% (bound)',
        itemType: ItemTypes.BOOTS,
        itemSheetIndexMale: 4,
        itemSheetIndexFemale: 4,
        itemSpriteIndexMale: 0,
        itemSpriteIndexFemale: 0,
        equippedSpriteMale: 'mshoes',
        equippedSpriteFemale: 'wshoes',
    },
    {
        id: 951,
        name: 'Shoes Exp+30% + HP Recovery+40% (bound)',
        itemType: ItemTypes.BOOTS,
        itemSheetIndexMale: 4,
        itemSheetIndexFemale: 4,
        itemSpriteIndexMale: 0,
        itemSpriteIndexFemale: 0,
        equippedSpriteMale: 'mshoes',
        equippedSpriteFemale: 'wshoes',
    },
    {
        id: 952,
        name: 'Boots Exp+30% + MP Recovery+40% (bound)',
        itemType: ItemTypes.BOOTS,
        itemSheetIndexMale: 4,
        itemSheetIndexFemale: 4,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        equippedSpriteMale: 'mlboots',
        equippedSpriteFemale: 'wlboots',
    },
    {
        id: 953,
        name: 'Boots Exp+30% + HP Recovery+40% (bound)',
        itemType: ItemTypes.BOOTS,
        itemSheetIndexMale: 4,
        itemSheetIndexFemale: 4,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        equippedSpriteMale: 'mlboots',
        equippedSpriteFemale: 'wlboots',
    },
    {
        id: 954,
        name: 'Cape Exp+40% + MP Recovery+50% (bound)',
        itemType: ItemTypes.CAPE,
        itemSheetIndexMale: 17,
        itemSheetIndexFemale: 17,
        itemSpriteIndexMale: 2,
        itemSpriteIndexFemale: 2,
        equippedSpriteMale: 'mmantle03',
        equippedSpriteFemale: 'wmantle03',
    },
    {
        id: 955,
        name: 'Cape Exp+40% + HP Recovery+50% (bound)',
        itemType: ItemTypes.CAPE,
        itemSheetIndexMale: 17,
        itemSheetIndexFemale: 17,
        itemSpriteIndexMale: 2,
        itemSpriteIndexFemale: 2,
        equippedSpriteMale: 'mmantle03',
        equippedSpriteFemale: 'wmantle03',
    },
    { id: 1300, name: 'Binding Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1301, name: 'Guild Bind Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1302, name: 'Unbound Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1304, name: 'Unlearn Talent Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1305, name: 'Stat Change Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1306, name: 'Name Change Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1307, name: 'Town Change Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1308, name: 'Guild Name Change Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    { id: 1309, name: 'Item into NFT Ticket', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 155, itemSpriteIndexFemale: 155 },
    // Exp/HP/MP/Berserk tablets — same Ancient Tablet base frame (sheet 5 / 155) with Olympia-style color tint
    // (keeps roughness/shine; multiply tint: light green / blood red / blue / yellow).
    {
        id: 1310,
        name: 'Exp Tablet',
        itemType: ItemTypes.MISC,
        stackable: true,
        consumable: true,
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 155,
        itemSpriteIndexFemale: 155,
        consumptionSound: 'magic',
        effects: [{ effect: ItemEffect.TINT_INVENTORY, effectColor: 0x7cff7c }], // light green
    },
    {
        id: 1311,
        name: 'HP Tablet',
        itemType: ItemTypes.MISC,
        stackable: true,
        consumable: true,
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 155,
        itemSpriteIndexFemale: 155,
        consumptionSound: 'magic',
        effects: [{ effect: ItemEffect.TINT_INVENTORY, effectColor: 0xc41e3a }], // blood red
    },
    {
        id: 1312,
        name: 'MP Tablet',
        itemType: ItemTypes.MISC,
        stackable: true,
        consumable: true,
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 155,
        itemSpriteIndexFemale: 155,
        consumptionSound: 'magic',
        effects: [{ effect: ItemEffect.TINT_INVENTORY, effectColor: 0x3a7cff }], // blue
    },
    {
        id: 1313,
        name: 'Berserk Tablet',
        itemType: ItemTypes.MISC,
        stackable: true,
        consumable: true,
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 155,
        itemSpriteIndexFemale: 155,
        consumptionSound: 'magic',
        effects: [{ effect: ItemEffect.TINT_INVENTORY, effectColor: 0xffcc33 }], // yellow
    },
    // MS22 charge wands (server catalog) — same inventory/equip art as Magic Wand(MS20).
    // 1314–1316 were wrongly mapped to tickets (looked like cracked stone). Tickets moved to 1317+.
    {
        id: 1314,
        name: 'Magic Wand(MS22) Inhibition',
        itemType: ItemTypes.WEAPON,
        itemSheetIndexMale: 16,
        itemSheetIndexFemale: 16,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        equippedSpriteMale: 'mstaff2',
        equippedSpriteFemale: 'wstaff2',
        startSpriteSheetIndex: 0,
    },
    {
        id: 1315,
        name: 'Magic Wand(MS22) Cancellation',
        itemType: ItemTypes.WEAPON,
        itemSheetIndexMale: 16,
        itemSheetIndexFemale: 16,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        equippedSpriteMale: 'mstaff2',
        equippedSpriteFemale: 'wstaff2',
        startSpriteSheetIndex: 0,
    },
    {
        id: 1316,
        name: 'Magic Wand(MS22) MIM',
        itemType: ItemTypes.WEAPON,
        itemSheetIndexMale: 16,
        itemSheetIndexFemale: 16,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        equippedSpriteMale: 'mstaff2',
        equippedSpriteFemale: 'wstaff2',
        startSpriteSheetIndex: 0,
    },
    { id: 1317, name: 'Reputation Ticket (100)', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 5, itemSheetIndexFemale: 5, itemSpriteIndexMale: 154, itemSpriteIndexFemale: 154 },
    { id: 1318, name: 'Armor Sex Change Potion', itemType: ItemTypes.MISC, stackable: true, consumable: true, itemSheetIndexMale: 0, itemSheetIndexFemale: 0, itemSpriteIndexMale: 1, itemSpriteIndexFemale: 1 },
    // Integrity: bag presence only; spent on upgrade reconfirm — never free-consume from bag.
    {
        id: 1112,
        name: 'Stone of Integrity',
        itemType: ItemTypes.MISC,
        stackable: true,
        consumable: false,
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        effects: [{ effect: ItemEffect.TINT_INVENTORY, effectColor: 0x9400ff }],
    },
];

/** Cash-shop tablets (Exp/HP/MP/Berserk) — always treat as bag consumables. */
export const CASH_TABLET_ITEM_IDS = new Set([1310, 1311, 1312, 1313]);

/** Stone of Integrity — upgrade protection only (not a free bag consumable). */
export const STONE_OF_INTEGRITY_ITEM_ID = 1112;

/** True when the item can be double-clicked / Consume from the bag. */
export function isBagConsumableItem(itemDef: Item | undefined, itemId?: number): boolean {
    const id = itemDef?.id ?? itemId;
    if (id === STONE_OF_INTEGRITY_ITEM_ID) {
        return false;
    }
    if (id !== undefined && CASH_TABLET_ITEM_IDS.has(id)) {
        return true;
    }
    return !!(itemDef && itemDef.itemType === ItemTypes.MISC && itemDef.consumable);
}

// Build last-write-wins id index after cash-shop overrides are appended.
rebuildItemByIdIndex();







