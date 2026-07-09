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

/** Magic item name highlight (Client.cpp RGB(0,255,50)). */
export const OLYMPIA_MAGIC_NAME_COLOR = '#00FF32';

export interface OlympiaItemDisplay {
    name: string;
    statLine1?: string;
    statLine2?: string;
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

function primaryPrefix(type: number, itemType: string): string {
    switch (type) {
        case 1:
            return 'Critical ';
        case 2:
            return 'Poisoning ';
        case 3:
            return 'Righteous ';
        case 5:
            return 'Agile ';
        case 6:
            return 'Light ';
        case 7:
            return 'Ancient ';
        case 8:
            return ARMOR_TYPES.has(itemType) ? 'Endurance ' : 'Sharp ';
        case 9:
            return 'Casting Prob. ';
        case 10:
            return 'Mana Converting ';
        case 11:
            return 'Experience ';
        case 12:
            return 'Gold ';
        default:
            return '';
    }
}

function primaryStatLine(type: number, value: number): string | undefined {
    switch (type) {
        case 1:
            return `Critical Hit Damage +${value}`;
        case 2:
            return `Poison Damage +${value * 5}`;
        case 3:
            return undefined;
        case 5:
            return 'Attack Speed -1';
        case 6:
            return `Weight -${value * 4}`;
        case 7:
            return 'Damage +2';
        case 8:
            return `Damage +${value * 7}`;
        case 9:
            return 'Hitting Probability +1';
        case 10:
            return `Mana Converting +${value * 3}`;
        case 11:
            return `Experience +${value}`;
        case 12:
            return `Gold +${value}`;
        default:
            return undefined;
    }
}

function secondaryStatLine(type: number, value: number): string | undefined {
    switch (type) {
        case 1:
            return `HP Recovery +${value * 7}`;
        case 2:
            return `SP Recovery +${value * 7}`;
        case 3:
            return `Magic Resistance +${value * 7}`;
        case 4:
            return `Defense Ratio +${value * 7}`;
        case 5:
            return `Spell Accuracy +${value * 7}`;
        case 6:
            return `Melee Accuracy +${value * 7}`;
        case 7:
            return `Magic Absorption +${value * 7}`;
        case 8:
            return `Physical Absorption +${value * 3}`;
        case 9:
            return `Poison Resistance +${value * 3}`;
        case 10:
            return `Experience +${value}`;
        case 11:
            return `Crush Damage +${value * 10}`;
        case 12:
            return `Gold +${value * 10}%`;
        default:
            return undefined;
    }
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

/** Ports Helbreath Olympia Client.cpp GetItemName (attribute bitfield). */
export function getOlympiaItemDisplay(
    baseName: string,
    itemAttribute = 0,
    itemColor = 0,
    itemType = '',
): OlympiaItemDisplay {
    if (itemAttribute === 0) {
        return { name: baseName, isMagic: false };
    }

    const type1 = (itemAttribute & 0x00f0_0000) >>> 20;
    const value1 = (itemAttribute & 0x000f_0000) >>> 16;
    const type2 = (itemAttribute & 0x0000_f000) >>> 12;
    const value2 = (itemAttribute & 0x0000_0f00) >>> 8;
    const repBonus = (itemAttribute & 0xf000_0000) >>> 28;

    let name = baseName;
    let statLine1: string | undefined;
    let statLine2: string | undefined;

    if ((itemAttribute & 0x00f0_f000) !== 0 && type1 !== 0) {
        name = `${primaryPrefix(type1, itemType)}${baseName}`;
        statLine1 = primaryStatLine(type1, value1);
        if (type2 !== 0) {
            statLine2 = secondaryStatLine(type2, value2);
        }
    }

    name = applyRepSuffix(name, repBonus);

    const nameColor = itemColor > 0
        ? OLYMPIA_ITEM_NAME_COLORS[itemColor] ?? OLYMPIA_MAGIC_NAME_COLOR
        : OLYMPIA_MAGIC_NAME_COLOR;

    return {
        name,
        statLine1,
        statLine2,
        isMagic: true,
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
    );

    return {
        itemName: display.name,
        magicStatLine1: display.statLine1,
        magicStatLine2: display.statLine2,
        itemNameColor: display.isMagic ? display.nameColor : undefined,
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
    item: Pick<InventoryItem, 'itemId' | 'itemUid' | 'itemAttribute' | 'itemColor' | 'effectOverrides' | 'quantity'>,
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
        source: 'inventory',
        mouseX,
        mouseY,
    });
}