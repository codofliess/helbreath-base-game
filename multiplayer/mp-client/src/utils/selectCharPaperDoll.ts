/**
 * Phaser-free idle-south paper-doll for the Explorer hub title.
 * Same layer order and sheet indexes as F5 `paperDollCapture` / the SELECTCHAR
 * menu preview, decoded from the real `.spr` packs (no placeholder art).
 */

import { olympiaItemColorToSpriteTint } from '../constants/OlympiaItemName';
import { getItemById, ItemTypes } from '../constants/Items';
import { Gender, SkinColor } from '../Types';
import type { CharacterSlotSummary } from './characterListApi';
import { fetchGameAssetArrayBuffer } from './gameAssetHttp';
import { heroItemToSide, resolveHeroKitSide } from './heroFactionKit';
import {
    getHumanSpriteName,
    resolveGearFromEquippedItems,
} from './playerAppearanceLook';
import { sliceSprSheets, type SprSheetFrameMeta } from './sprSheetSlice';

const IDLE_SOUTH_DIR = 4;
const FRAMES_PER_DIR = 8;
const HAIR_TINT = 0x5a3a28;
const AVATAR_ID = 'selectchar-kindgem-avatar';

export type SelectCharDollKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

export interface SelectCharDollLayer {
    kind: SelectCharDollKind;
    spriteName: string;
    /** Pack offset before the idle-south sheet is chosen. */
    sheetPack: number;
    tint?: number;
}

export interface SelectCharDollLook {
    gender: number;
    skinColor: number;
    hairStyleIndex: number;
    underwearColorIndex: number;
    citizenshipSide?: string;
    equipped?: ReadonlyArray<{ slot: string; itemId: number; itemColor?: number }>;
}

const BODY_SLOTS: ReadonlyArray<ItemTypes> = [
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

function genderOf(gender: number): Gender {
    return gender === 1 ? Gender.FEMALE : Gender.MALE;
}

function skinOf(skinColor: number): SkinColor {
    if (skinColor === 2) {
        return SkinColor.Dark;
    }
    if (skinColor === 1) {
        return SkinColor.Tanned;
    }
    return SkinColor.Light;
}

function equipSlot(slot: string): ItemTypes | undefined {
    const key = slot.trim().toLowerCase();
    if (key === 'helm') {
        return ItemTypes.HELMET;
    }
    return BODY_SLOTS.find((type) => type === key);
}

function equippedMap(look: SelectCharDollLook): Partial<Record<ItemTypes, { itemId: number; itemColor?: number }>> {
    const rows = look.equipped ?? [];
    const kitSide = resolveHeroKitSide(
        look.citizenshipSide,
        rows.map((row) => row.itemId).filter((id) => id > 0),
    );
    const map: Partial<Record<ItemTypes, { itemId: number; itemColor?: number }>> = {};
    for (const row of rows) {
        const slot = equipSlot(row.slot);
        if (!slot || row.itemId <= 0) {
            continue;
        }
        const itemId = kitSide ? heroItemToSide(row.itemId, kitSide) : row.itemId;
        map[slot] = { itemId, itemColor: row.itemColor };
    }
    return map;
}

function gearTint(
    map: Partial<Record<ItemTypes, { itemId: number; itemColor?: number }>>,
    slot: ItemTypes,
): number | undefined {
    return olympiaItemColorToSpriteTint(map[slot]?.itemColor);
}

/**
 * Idle-south layers for one character list slot.
 * Order matches F5 south: body, hair, underwear, then worn gear.
 * With no visible gear, shirt + trousers are the same default clothes the desk preview wears.
 */
export function selectCharPaperDollLayers(look: SelectCharDollLook): SelectCharDollLayer[] {
    const gender = genderOf(look.gender);
    const human = getHumanSpriteName(gender, skinOf(look.skinColor));
    const hair = gender === Gender.MALE ? 'mhr' : 'whr';
    const underwear = gender === Gender.MALE ? 'mpt' : 'wpt';
    const hairIndex = Math.max(0, Math.min(7, look.hairStyleIndex ?? 0));
    const underIndex = Math.max(0, Math.min(7, look.underwearColorIndex ?? 0));
    const map = equippedMap(look);
    const resolved = resolveGearFromEquippedItems(
        {
            human,
            underwear,
            underwearColorIndex: underIndex,
            hairStyleIndex: hairIndex,
        },
        map,
        gender,
    );
    const hasGear = BODY_SLOTS.some((slot) => (map[slot]?.itemId ?? 0) > 0);
    const layers: SelectCharDollLayer[] = [{ kind: 'human', spriteName: human, sheetPack: 0 }];
    if (hairIndex !== 2) {
        layers.push({
            kind: 'armour',
            spriteName: hair,
            sheetPack: (hairIndex === 2 ? 0 : hairIndex) * 12,
            tint: HAIR_TINT,
        });
    }
    layers.push({ kind: 'armour', spriteName: underwear, sheetPack: underIndex * 12 });
    if (!hasGear) {
        layers.push({
            kind: 'armour',
            spriteName: gender === Gender.MALE ? 'mshirt' : 'wshirt',
            sheetPack: 0,
        });
        layers.push({
            kind: 'armour',
            spriteName: gender === Gender.MALE ? 'mhtrouser' : 'whtrouser',
            sheetPack: 0,
        });
        return layers;
    }
    if (resolved.cape) {
        layers.push({ kind: 'armour', spriteName: resolved.cape, sheetPack: 0, tint: gearTint(map, ItemTypes.CAPE) });
    }
    if (resolved.hauberk) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.hauberk,
            sheetPack: 0,
            tint: gearTint(map, ItemTypes.HAUBERK),
        });
    }
    if (resolved.leggings) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.leggings,
            sheetPack: 0,
            tint: gearTint(map, ItemTypes.LEGGINGS),
        });
    }
    if (resolved.boots) {
        layers.push({ kind: 'armour', spriteName: resolved.boots, sheetPack: 0, tint: gearTint(map, ItemTypes.BOOTS) });
    }
    if (resolved.helm) {
        layers.push({ kind: 'armour', spriteName: resolved.helm, sheetPack: 0, tint: gearTint(map, ItemTypes.HELMET) });
    }
    if (resolved.armor) {
        layers.push({ kind: 'armour', spriteName: resolved.armor, sheetPack: 0, tint: gearTint(map, ItemTypes.ARMOR) });
    }
    if (resolved.shield) {
        layers.push({
            kind: 'shield',
            spriteName: resolved.shield,
            sheetPack: Math.max(0, resolved.shieldStartSpriteSheetIndex ?? 0),
            tint: gearTint(map, ItemTypes.SHIELD),
        });
    }
    if (resolved.weapon) {
        layers.push({
            kind: 'weapon',
            spriteName: resolved.weapon,
            sheetPack: Math.max(0, resolved.weaponStartSpriteSheetIndex ?? 0),
            tint: gearTint(map, ItemTypes.WEAPON),
        });
    }
    if (resolved.accessory) {
        layers.push({
            kind: 'accessory',
            spriteName: resolved.accessory,
            sheetPack: 0,
            tint: gearTint(map, ItemTypes.ACCESSORY),
        });
    }
    return layers;
}

export function selectCharPaperDollLookKey(slot: CharacterSlotSummary): string {
    const gear = (slot.equipped ?? [])
        .map((row) => `${row.slot}:${row.itemId}`)
        .join(',');
    return [
        slot.slotIndex,
        slot.name,
        slot.gender,
        slot.skinColor,
        slot.hairStyleIndex,
        slot.underwearColorIndex,
        slot.citizenshipSide ?? '',
        gear,
    ].join('|');
}

function idleSheet(layer: SelectCharDollLayer): { sheetIndex: number; frameIndex: number } {
    const pack = Math.max(0, layer.sheetPack);
    switch (layer.kind) {
        case 'human':
            return { sheetIndex: IDLE_SOUTH_DIR, frameIndex: 0 };
        case 'armour':
            return { sheetIndex: pack, frameIndex: IDLE_SOUTH_DIR * FRAMES_PER_DIR };
        case 'weapon':
            return { sheetIndex: pack + IDLE_SOUTH_DIR, frameIndex: 0 };
        case 'shield':
            return { sheetIndex: pack, frameIndex: IDLE_SOUTH_DIR * FRAMES_PER_DIR };
        case 'accessory':
            return { sheetIndex: 5 * 8 + IDLE_SOUTH_DIR, frameIndex: 0 };
        default:
            return { sheetIndex: pack, frameIndex: 0 };
    }
}

interface DecodedSheet {
    image: CanvasImageSource;
    frames: SprSheetFrameMeta[];
}

const sheetCache = new Map<string, Promise<DecodedSheet | undefined>>();
const dollCache = new Map<string, Promise<string | undefined>>();

async function loadSheet(spriteName: string, sheetIndex: number): Promise<DecodedSheet | undefined> {
    const key = `${spriteName}:${sheetIndex}`;
    const cached = sheetCache.get(key);
    if (cached) {
        return cached;
    }
    const pending = (async () => {
        try {
            const buffer = await fetchGameAssetArrayBuffer('sprites', `${spriteName}.spr`);
            const slices = sliceSprSheets(buffer, new Set([sheetIndex]));
            const slice = slices.find((row) => row.sheetIndex === sheetIndex);
            if (!slice || slice.frames.length === 0 || typeof document === 'undefined') {
                return undefined;
            }
            const blob = new Blob([slice.png], { type: 'image/png' });
            const image = await createImageBitmap(blob);
            return { image, frames: slice.frames };
        } catch {
            return undefined;
        }
    })();
    sheetCache.set(key, pending);
    const decoded = await pending;
    if (!decoded) {
        sheetCache.delete(key);
    }
    return decoded;
}

function frameCanvas(sheet: DecodedSheet, frameIndex: number): HTMLCanvasElement | undefined {
    const frame = sheet.frames[frameIndex] ?? sheet.frames[0];
    if (!frame || frame.width <= 0 || frame.height <= 0) {
        return undefined;
    }
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return undefined;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet.image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    return canvas;
}

function applyMultiplyTint(src: HTMLCanvasElement, tintRgb: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d');
    if (!ctx) {
        return src;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `#${tintRgb.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(src, 0, 0);
    return out;
}

async function composeLook(look: SelectCharDollLook): Promise<string | undefined> {
    if (typeof document === 'undefined') {
        return undefined;
    }
    type Placed = { canvas: HTMLCanvasElement; x: number; y: number };
    const placed: Placed[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const layer of selectCharPaperDollLayers(look)) {
        const idle = idleSheet(layer);
        const sheet = await loadSheet(layer.spriteName, idle.sheetIndex);
        if (!sheet) {
            continue;
        }
        let canvas = frameCanvas(sheet, idle.frameIndex);
        if (!canvas) {
            continue;
        }
        if (layer.tint !== undefined) {
            canvas = applyMultiplyTint(canvas, layer.tint);
        }
        const frame = sheet.frames[idle.frameIndex] ?? sheet.frames[0];
        const x = frame?.pivotX ?? -canvas.width / 2;
        const y = frame?.pivotY ?? -canvas.height;
        placed.push({ canvas, x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + canvas.width);
        maxY = Math.max(maxY, y + canvas.height);
    }
    if (placed.length === 0 || !Number.isFinite(minX)) {
        return undefined;
    }
    const pad = 2;
    const width = Math.ceil(maxX - minX) + pad * 2;
    const height = Math.ceil(maxY - minY) + pad * 2;
    if (width <= 0 || height <= 0 || width > 1024 || height > 1024) {
        return undefined;
    }
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) {
        return undefined;
    }
    ctx.imageSmoothingEnabled = false;
    for (const part of placed) {
        ctx.drawImage(part.canvas, Math.round(part.x - minX + pad), Math.round(part.y - minY + pad));
    }
    try {
        return out.toDataURL('image/png');
    } catch {
        return undefined;
    }
}

/** Composite the selected character. Cached per look so slot changes reuse the other figure. */
export function renderSelectCharPaperDoll(slot: CharacterSlotSummary): Promise<string | undefined> {
    const key = selectCharPaperDollLookKey(slot);
    const cached = dollCache.get(key);
    if (cached) {
        return cached;
    }
    const pending = composeLook(slot).then((url) => {
        if (!url) {
            dollCache.delete(key);
        }
        return url;
    });
    dollCache.set(key, pending);
    return pending;
}

/**
 * Hang the paper-doll on the cream KindGem banner, to the left of the title text.
 * `textContent` paints wipe children, so callers append this after that write.
 * The image has no alt text, so the banner string KindGem reads stays exact.
 */
export function mountSelectCharKindGemAvatar(
    banner: HTMLElement,
    url: string | undefined,
    characterName: string,
): void {
    const existing = banner.querySelector<HTMLImageElement>(`#${AVATAR_ID}`);
    if (!url) {
        existing?.remove();
        banner.removeAttribute('data-selectchar-avatar');
        return;
    }
    const img = existing ?? document.createElement('img');
    img.id = AVATAR_ID;
    img.className = 'selectchar-kindgem-avatar';
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    if (img.getAttribute('src') !== url) {
        img.src = url;
    }
    img.dataset.character = characterName;
    if (!existing) {
        banner.appendChild(img);
    }
    banner.setAttribute('data-selectchar-avatar', characterName);
}
