import { Gender, SkinColor } from '../../Types';
import { ItemTypes } from '../../constants/Items';
import { getHumanSpriteName, resolveGearFromEquippedItems } from '../../utils/playerAppearanceLook';
import type { CharacterEquipPreview, CharacterSlotSummary } from '../../utils/characterListApi';

const IDLE_SOUTH_DIR = 4;
const FRAMES_PER_DIR = 8;
const DEFAULT_HAIR_TINT = 0x5a3a28;

export type SelectCharAvatarLayerKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

export interface SelectCharAvatarLayer {
    kind: SelectCharAvatarLayerKind;
    spriteName: string;
    sheetIndex: number;
    frameIndex: number;
    tint?: number;
}

export interface SelectCharAvatarLook {
    gender: Gender;
    skinColor: SkinColor;
    hairStyleIndex: number;
    underwearColorIndex: number;
    layers: SelectCharAvatarLayer[];
}

const VISIBLE_EQUIP_SLOTS: readonly ItemTypes[] = [
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

export function genderFromSlot(gender: number | undefined): Gender {
    return gender === 1 ? Gender.FEMALE : Gender.MALE;
}

export function skinColorFromSlot(skinColor: number | undefined): SkinColor {
    if (skinColor === 2) {
        return SkinColor.Dark;
    }
    if (skinColor === 1) {
        return SkinColor.Tanned;
    }
    return SkinColor.Light;
}

function normalizeEquipSlot(slot: string): ItemTypes | undefined {
    const key = slot.trim().toLowerCase();
    if (key === 'helm') {
        return ItemTypes.HELMET;
    }
    for (const t of VISIBLE_EQUIP_SLOTS) {
        if (t === key) {
            return t;
        }
    }
    return undefined;
}

function equippedMapFromPreview(
    equipped: ReadonlyArray<CharacterEquipPreview> | undefined,
): Partial<Record<ItemTypes, { itemId: number }>> {
    const map: Partial<Record<ItemTypes, { itemId: number }>> = {};
    for (const row of equipped ?? []) {
        if (!row || row.itemId <= 0 || !row.slot) {
            continue;
        }
        const slot = normalizeEquipSlot(row.slot);
        if (!slot) {
            continue;
        }
        map[slot] = { itemId: row.itemId };
    }
    return map;
}

const WALK_HUMAN_BASE = 16;
const WALK_ARMOUR_BASE = 2;
const WALK_ARMAMENT_STATE = 2;
const WALK_ANGELIC_STATE = 5;

function poseLayer(
    kind: SelectCharAvatarLayerKind,
    spriteName: string,
    sheetPack: number,
    tint: number | undefined,
    walkFrame: number | undefined,
): SelectCharAvatarLayer {
    if (walkFrame === undefined) {
        return idleLayer(kind, spriteName, sheetPack, tint);
    }
    const f = Math.max(0, Math.min(FRAMES_PER_DIR - 1, walkFrame));
    const dir = IDLE_SOUTH_DIR;
    let sheetIndex = 0;
    let frameIndex = 0;
    switch (kind) {
        case 'human':
            sheetIndex = WALK_HUMAN_BASE + dir;
            frameIndex = f;
            break;
        case 'armour':
            sheetIndex = Math.max(0, sheetPack) + WALK_ARMOUR_BASE;
            frameIndex = dir * FRAMES_PER_DIR + f;
            break;
        case 'weapon':
            sheetIndex = Math.max(0, sheetPack) + WALK_ARMAMENT_STATE * 8 + dir;
            frameIndex = f;
            break;
        case 'shield':
            sheetIndex = Math.max(0, sheetPack) + WALK_ARMAMENT_STATE;
            frameIndex = dir * FRAMES_PER_DIR + f;
            break;
        case 'accessory':
            sheetIndex = WALK_ANGELIC_STATE * 8 + dir;
            frameIndex = f;
            break;
    }
    return { kind, spriteName, sheetIndex, frameIndex, tint };
}

function idleLayer(
    kind: SelectCharAvatarLayerKind,
    spriteName: string,
    sheetPack: number,
    tint?: number,
): SelectCharAvatarLayer {
    let sheetIndex = 0;
    let frameIndex = 0;
    switch (kind) {
        case 'human':
            sheetIndex = IDLE_SOUTH_DIR;
            frameIndex = 0;
            break;
        case 'armour':
            sheetIndex = Math.max(0, sheetPack);
            frameIndex = IDLE_SOUTH_DIR * FRAMES_PER_DIR;
            break;
        case 'weapon':
            sheetIndex = Math.max(0, sheetPack) + IDLE_SOUTH_DIR;
            frameIndex = 0;
            break;
        case 'shield':
            sheetIndex = Math.max(0, sheetPack);
            frameIndex = IDLE_SOUTH_DIR * FRAMES_PER_DIR;
            break;
        case 'accessory':
            sheetIndex = 5 * 8 + IDLE_SOUTH_DIR;
            frameIndex = 0;
            break;
    }
    return { kind, spriteName, sheetIndex, frameIndex, tint };
}

/**
 * Idle-south layers matching paperDollCapture / menuCharacterPreview
 * (body, hair, underwear, worn gear, default shirt/pants when unequipped).
 */
export function selectCharAvatarLookFromSlot(
    slot: CharacterSlotSummary,
    opts?: { walkFrame?: number },
): SelectCharAvatarLook {
    const gender = genderFromSlot(slot.gender);
    const skinColor = skinColorFromSlot(slot.skinColor);
    const hairStyleIndex = Math.max(0, Math.min(7, slot.hairStyleIndex ?? 0));
    const underwearColorIndex = Math.max(0, Math.min(7, slot.underwearColorIndex ?? 0));
    const human = getHumanSpriteName(gender, skinColor);
    const hair = gender === Gender.MALE ? 'mhr' : 'whr';
    const underwear = gender === Gender.MALE ? 'mpt' : 'wpt';
    const underPack = underwearColorIndex * 12;
    const hairPack = (hairStyleIndex === 2 ? 0 : hairStyleIndex) * 12;
    const equippedMap = equippedMapFromPreview(slot.equipped);
    const resolved = resolveGearFromEquippedItems(
        { human, underwear, underwearColorIndex, hairStyleIndex },
        equippedMap,
        gender,
    );
    const hasVisibleGear = VISIBLE_EQUIP_SLOTS.some((s) => (equippedMap[s]?.itemId ?? 0) > 0);

    const walkFrame = opts?.walkFrame;
    const layer = (
        kind: SelectCharAvatarLayerKind,
        spriteName: string,
        sheetPack: number,
        tint?: number,
    ) => poseLayer(kind, spriteName, sheetPack, tint, walkFrame);

    const layers: SelectCharAvatarLayer[] = [layer('human', human, 0)];
    if (hairStyleIndex !== 2) {
        layers.push(layer('armour', hair, hairPack, DEFAULT_HAIR_TINT));
    }
    layers.push(layer('armour', underwear, underPack));

    if (!hasVisibleGear) {
        const shirt = gender === Gender.MALE ? 'mshirt' : 'wshirt';
        const pants = gender === Gender.MALE ? 'mhtrouser' : 'whtrouser';
        layers.push(layer('armour', shirt, 0));
        layers.push(layer('armour', pants, 0));
    } else {
        if (resolved.hauberk) {
            layers.push(layer('armour', resolved.hauberk, 0));
        }
        if (resolved.leggings) {
            layers.push(layer('armour', resolved.leggings, 0));
        }
        if (resolved.boots) {
            layers.push(layer('armour', resolved.boots, 0));
        }
        if (resolved.helm) {
            layers.push(layer('armour', resolved.helm, 0));
        }
        if (resolved.armor) {
            layers.push(layer('armour', resolved.armor, 0));
        }
        if (resolved.shield) {
            layers.push(layer('shield', resolved.shield, resolved.shieldStartSpriteSheetIndex ?? 0));
        }
        if (resolved.cape) {
            layers.push(layer('armour', resolved.cape, 0));
        }
        if (resolved.weapon) {
            layers.push(layer('weapon', resolved.weapon, resolved.weaponStartSpriteSheetIndex ?? 0));
        }
        if (resolved.accessory) {
            layers.push(layer('accessory', resolved.accessory, 0));
        }
    }

    return { gender, skinColor, hairStyleIndex, underwearColorIndex, layers };
}
