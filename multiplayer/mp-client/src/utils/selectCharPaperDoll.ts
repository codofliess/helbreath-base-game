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

interface SheetLoad {
    sheet?: DecodedSheet;
    error?: string;
}

/** Browser canvas result. `reason` is set when no image could be produced. */
export interface SelectCharPaperDollImage {
    url?: string;
    reason?: string;
}

const sheetCache = new Map<string, Promise<SheetLoad>>();
const dollCache = new Map<string, Promise<SelectCharPaperDollImage>>();

/**
 * Portrait column height. The grid row matches the detail card, which is often
 * taller than the scrollport; sizing the doll to that row centers the sprite
 * below the fold. Use the scrollport's content box instead.
 */
export function explorerDollViewportHeight(
    scrollClientHeight: number,
    paddingTop: number,
    paddingBottom: number,
): number {
    if (!Number.isFinite(scrollClientHeight) || scrollClientHeight <= 0) {
        return 0;
    }
    const pad =
        (Number.isFinite(paddingTop) ? paddingTop : 0) +
        (Number.isFinite(paddingBottom) ? paddingBottom : 0);
    return Math.max(0, Math.floor(scrollClientHeight - pad));
}

/** Fit a composite into the canvas cap. Oversized gear is scaled down, not dropped. */
export function selectCharDollOutputSize(
    width: number,
    height: number,
): { width: number; height: number } | undefined {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return undefined;
    }
    const cap = 1024;
    if (width <= cap && height <= cap) {
        return { width: Math.ceil(width), height: Math.ceil(height) };
    }
    const scale = Math.min(cap / width, cap / height);
    return {
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale)),
    };
}

async function loadSheet(spriteName: string, sheetIndex: number): Promise<SheetLoad> {
    const key = `${spriteName}:${sheetIndex}`;
    const cached = sheetCache.get(key);
    if (cached) {
        return cached;
    }
    const pending = (async (): Promise<SheetLoad> => {
        try {
            const buffer = await fetchGameAssetArrayBuffer('sprites', `${spriteName}.spr`);
            const slices = sliceSprSheets(buffer, new Set([sheetIndex]));
            const slice = slices.find((row) => row.sheetIndex === sheetIndex);
            if (!slice || slice.frames.length === 0) {
                return { error: `${spriteName}.spr has no frames on sheet ${sheetIndex}` };
            }
            if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
                return { error: 'browser image decode is unavailable' };
            }
            const blob = new Blob([slice.png], { type: 'image/png' });
            const image = await createImageBitmap(blob);
            if (image.width <= 0 || image.height <= 0) {
                return { error: `${spriteName}.spr sheet ${sheetIndex} decoded empty` };
            }
            return { sheet: { image, frames: slice.frames } };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'sprite fetch failed';
            return { error: `${spriteName}.spr sheet ${sheetIndex}: ${message}` };
        }
    })();
    sheetCache.set(key, pending);
    const decoded = await pending;
    if (!decoded.sheet) {
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

async function composeLook(look: SelectCharDollLook): Promise<SelectCharPaperDollImage> {
    if (typeof document === 'undefined') {
        return { reason: 'no document (paper-doll needs a browser canvas)' };
    }
    type Placed = { canvas: HTMLCanvasElement; x: number; y: number };
    const placed: Placed[] = [];
    const missed: string[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const layer of selectCharPaperDollLayers(look)) {
        const idle = idleSheet(layer);
        const loaded = await loadSheet(layer.spriteName, idle.sheetIndex);
        if (!loaded.sheet) {
            missed.push(loaded.error ?? `${layer.spriteName}#${idle.sheetIndex}`);
            continue;
        }
        let canvas = frameCanvas(loaded.sheet, idle.frameIndex);
        if (!canvas) {
            missed.push(`${layer.spriteName}#${idle.sheetIndex} frame ${idle.frameIndex} is empty`);
            continue;
        }
        if (layer.tint !== undefined) {
            canvas = applyMultiplyTint(canvas, layer.tint);
        }
        const frame = loaded.sheet.frames[idle.frameIndex] ?? loaded.sheet.frames[0];
        const x = frame?.pivotX ?? -canvas.width / 2;
        const y = frame?.pivotY ?? -canvas.height;
        placed.push({ canvas, x, y });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + canvas.width);
        maxY = Math.max(maxY, y + canvas.height);
    }
    if (placed.length === 0 || !Number.isFinite(minX)) {
        return { reason: `no sprite frames decoded (${missed.join(', ') || 'no layers'})` };
    }
    const pad = 2;
    const boundsW = Math.ceil(maxX - minX) + pad * 2;
    const boundsH = Math.ceil(maxY - minY) + pad * 2;
    const output = selectCharDollOutputSize(boundsW, boundsH);
    if (!output) {
        return { reason: `composite bounds ${boundsW}×${boundsH} are not drawable` };
    }
    const fit = output.width / boundsW;
    const out = document.createElement('canvas');
    out.width = output.width;
    out.height = output.height;
    const ctx = out.getContext('2d');
    if (!ctx) {
        return { reason: 'canvas 2d context is unavailable' };
    }
    ctx.imageSmoothingEnabled = false;
    for (const part of placed) {
        const dx = Math.round((part.x - minX + pad) * fit);
        const dy = Math.round((part.y - minY + pad) * fit);
        const dw = Math.max(1, Math.round(part.canvas.width * fit));
        const dh = Math.max(1, Math.round(part.canvas.height * fit));
        ctx.drawImage(part.canvas, dx, dy, dw, dh);
    }
    try {
        return { url: out.toDataURL('image/png') };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'tainted or unsupported';
        return { reason: `canvas export failed (${message})` };
    }
}

/** Composite the selected character. Cached per look so slot changes reuse the other figure. */
export function renderSelectCharPaperDoll(slot: CharacterSlotSummary): Promise<SelectCharPaperDollImage> {
    const key = selectCharPaperDollLookKey(slot);
    const cached = dollCache.get(key);
    if (cached) {
        return cached;
    }
    const pending = composeLook(slot)
        .then((image) => {
            if (!image.url) {
                dollCache.delete(key);
            }
            return image;
        })
        .catch((error: unknown) => {
            dollCache.delete(key);
            const message = error instanceof Error ? error.message : 'paper-doll failed';
            return { reason: message };
        });
    dollCache.set(key, pending);
    return pending;
}
