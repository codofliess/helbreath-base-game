import type { GameObjects, Scene } from 'phaser';
import { Gender, SkinColor, type PivotFrame } from '../Types';
import { PlayerAppearanceManager } from './PlayerAppearanceManager';
import { EventBus } from '../game/EventBus';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../constants/EventNames';
import { ItemTypes, type EquipmentSlot, type InventoryItem } from '../constants/Items';
import { olympiaItemColorToSpriteTint } from '../constants/OlympiaItemName';
import { getPivotData } from './RegistryUtils';
import {
    loadPlayerItemAppearanceOnDemand,
    arePlayerItemAppearanceLoaded,
} from './ItemAssets';
import { LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND } from '../Config';

/** React spriteFrameMap keys for F5 paper-doll. */
export const PAPERDOLL_BODY_KEY = 'paperdoll-body';
export const PAPERDOLL_HAIR_KEY = 'paperdoll-hair';
export const PAPERDOLL_UNDERWEAR_KEY = 'paperdoll-underwear';
/** Full layered idle-south composite (body + gear) — Olympia-style F5 figure. */
export const PAPERDOLL_COMPOSITE_KEY = 'paperdoll-composite';

/** Minimal player surface for live map capture (avoids circular imports with Player). */
export interface PaperDollLivePlayer {
    getVisibleSpritesForPaperDoll(): Array<{ sprite: GameObjects.Sprite; spriteName: string }>;
    getGender(): Gender;
    getHumanSpriteName(): string;
}

/**
 * Olympia human idle uses one spritesheet per direction:
 * sheetIndex = IdlePeaceBase(0) + direction (0–7). South = 4.
 * Armour packs (hair/underwear/gear): sheetIndex = packBase + IdlePeaceBase(0),
 * frameIndex = direction * framesPerDir (south = 32).
 */
const IDLE_SOUTH_DIR = 4;
const FRAMES_PER_DIR = 8;
const IDLE_HUMAN_BASE = 0;
const IDLE_ARMOUR_BASE = 0;

/** Classic menu / world hair brown multiply (menuCharacterPreview). */
const DEFAULT_HAIR_TINT = 0x5a3a28;

type LayerKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

interface CompositeLayer {
    kind: LayerKind;
    spriteName: string;
    sheetPack: number;
    tint?: number;
}

/** Skip identical recaptures (equip/look hash). */
let lastCaptureKey = '';
let lastCompositeOk = false;

function textureKey(spriteName: string, sheetIndex: number): string {
    return `sprite-${spriteName}-${sheetIndex}`;
}

function resolveIdleTexture(
    kind: LayerKind,
    spriteName: string,
    sheetPack: number,
): { textureKey: string; frameIndex: number; spriteSheetIndex: number } {
    const dir = IDLE_SOUTH_DIR;
    let spriteSheetIndex = 0;
    let frameIndex = 0;
    switch (kind) {
        case 'human':
            spriteSheetIndex = IDLE_HUMAN_BASE + dir;
            frameIndex = 0;
            break;
        case 'armour':
            spriteSheetIndex = Math.max(0, sheetPack) + IDLE_ARMOUR_BASE;
            frameIndex = dir * FRAMES_PER_DIR;
            break;
        case 'weapon':
            spriteSheetIndex = Math.max(0, sheetPack) + dir;
            frameIndex = 0;
            break;
        case 'shield':
            spriteSheetIndex = Math.max(0, sheetPack);
            frameIndex = dir * FRAMES_PER_DIR;
            break;
        case 'accessory':
            spriteSheetIndex = 5 * 8 + dir;
            frameIndex = 0;
            break;
    }
    return {
        textureKey: textureKey(spriteName, spriteSheetIndex),
        frameIndex,
        spriteSheetIndex,
    };
}

function getPivotFrame(
    scene: Scene,
    spriteName: string,
    spriteSheetIndex: number,
    frameIndex: number,
): PivotFrame | undefined {
    const pivotData = getPivotData(scene, '', spriteName, false);
    const frames = pivotData?.spriteSheetPivots?.[spriteSheetIndex];
    if (!frames || frames.length === 0) {
        return undefined;
    }
    // Clamp OOB frame (Merien shield / odd packs).
    const safeIdx = Math.max(0, Math.min(frames.length - 1, frameIndex));
    const frame = frames[safeIdx];
    if (!frame || frame.width <= 0 || frame.height <= 0) {
        return undefined;
    }
    return frame;
}

function extractFrameToCanvas(
    scene: Scene,
    texKey: string,
    frameIndex: number,
): { canvas: HTMLCanvasElement; cutW: number; cutH: number } | undefined {
    if (!scene.textures.exists(texKey)) {
        return undefined;
    }
    try {
        const texture = scene.textures.get(texKey);
        let frame = texture.get(frameIndex);
        if (!frame || frame.cutWidth <= 0 || frame.cutHeight <= 0) {
            frame = texture.get(0);
        }
        if (!frame || frame.cutWidth <= 0) {
            return undefined;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, frame.cutWidth);
        canvas.height = Math.max(1, frame.cutHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return undefined;
        }
        ctx.imageSmoothingEnabled = false;
        const source = texture.getSourceImage() as CanvasImageSource;
        ctx.drawImage(
            source,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            0,
            0,
            frame.cutWidth,
            frame.cutHeight,
        );
        return { canvas, cutW: frame.cutWidth, cutH: frame.cutHeight };
    } catch {
        return undefined;
    }
}

function extractFrameDataUrl(scene: Scene, texKey: string, frameIndex: number): string | undefined {
    const extracted = extractFrameToCanvas(scene, texKey, frameIndex);
    if (!extracted) {
        return undefined;
    }
    try {
        return extracted.canvas.toDataURL('image/png');
    } catch {
        return undefined;
    }
}

/**
 * True multiply tint preserving alpha (better hair than source-atop wash).
 */
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
    ctx.globalCompositeOperation = 'source-over';
    return out;
}

/**
 * Idle-south peace layer order mirrors PlayerAppearanceManager.getGearRenderOrder(dir=4):
 * human → hair → uw → cape → hauberk → leggings → boots → helm → armor → shield → weapon → accessory
 */
function buildCompositeLayers(
    gender: Gender,
    skinColor: SkinColor,
    hairStyleIndex: number,
    underwearColorIndex: number,
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
): CompositeLayer[] {
    const human = PlayerAppearanceManager.getHumanSpriteName(gender, skinColor);
    const hair = gender === Gender.MALE ? 'mhr' : 'whr';
    const underwear = gender === Gender.MALE ? 'mpt' : 'wpt';
    const underPack = Math.max(0, Math.min(7, underwearColorIndex)) * 12;
    const hairPack =
        Math.max(0, Math.min(7, hairStyleIndex === 2 ? 0 : hairStyleIndex)) * 12;

    const resolved = PlayerAppearanceManager.resolveGearFromEquippedItems(
        {
            human,
            underwear,
            underwearColorIndex,
            hairStyleIndex,
        },
        equippedItems,
        gender,
    );

    const layers: CompositeLayer[] = [];
    layers.push({ kind: 'human', spriteName: human, sheetPack: 0 });
    if (hairStyleIndex !== 2) {
        layers.push({
            kind: 'armour',
            spriteName: hair,
            sheetPack: hairPack,
            tint: DEFAULT_HAIR_TINT,
        });
    }
    layers.push({ kind: 'armour', spriteName: underwear, sheetPack: underPack });

    // South idle mantle order 0: cape behind torso gear.
    // Olympia m_cItemColor multiplies onto worn gear (poison BH green, etc.).
    if (resolved.cape) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.cape,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.CAPE]?.itemColor),
        });
    }
    if (resolved.hauberk) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.hauberk,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.HAUBERK]?.itemColor),
        });
    }
    if (resolved.leggings) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.leggings,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.LEGGINGS]?.itemColor),
        });
    }
    if (resolved.boots) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.boots,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.BOOTS]?.itemColor),
        });
    }
    if (resolved.helm) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.helm,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.HELMET]?.itemColor),
        });
    }
    if (resolved.armor) {
        layers.push({
            kind: 'armour',
            spriteName: resolved.armor,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.ARMOR]?.itemColor),
        });
    }
    // South: shield before weapon.
    if (resolved.shield) {
        layers.push({
            kind: 'shield',
            spriteName: resolved.shield,
            sheetPack: Math.max(0, resolved.shieldStartSpriteSheetIndex ?? 0),
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.SHIELD]?.itemColor),
        });
    }
    if (resolved.weapon) {
        layers.push({
            kind: 'weapon',
            spriteName: resolved.weapon,
            sheetPack: Math.max(0, resolved.weaponStartSpriteSheetIndex ?? 0),
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.WEAPON]?.itemColor),
        });
    }
    if (resolved.accessory) {
        layers.push({
            kind: 'accessory',
            spriteName: resolved.accessory,
            sheetPack: 0,
            tint: olympiaItemColorToSpriteTint(equippedItems[ItemTypes.ACCESSORY]?.itemColor),
        });
    }
    return layers;
}

function compositeIdleSouth(scene: Scene, layers: CompositeLayer[]): string | undefined {
    type Placed = {
        canvas: HTMLCanvasElement;
        x: number;
        y: number;
    };
    const placed: Placed[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const layer of layers) {
        const resolved = resolveIdleTexture(layer.kind, layer.spriteName, layer.sheetPack);
        let extracted = extractFrameToCanvas(scene, resolved.textureKey, resolved.frameIndex);
        // Fallback: try sheet 0 / frame 0 if pack index missing (OOB startSprite).
        if (!extracted && layer.sheetPack !== 0) {
            const fb = resolveIdleTexture(layer.kind, layer.spriteName, 0);
            extracted = extractFrameToCanvas(scene, fb.textureKey, fb.frameIndex);
            if (extracted) {
                console.debug(
                    `[paperdoll] fallback sheet0 for ${layer.spriteName} (pack ${layer.sheetPack})`,
                );
            }
        }
        if (!extracted) {
            console.debug(
                `[paperdoll] missing texture ${resolved.textureKey} frame ${resolved.frameIndex}`,
            );
            continue;
        }
        let canvas = extracted.canvas;
        if (layer.tint !== undefined) {
            canvas = applyMultiplyTint(canvas, layer.tint);
        }
        const pivot = getPivotFrame(
            scene,
            layer.spriteName,
            resolved.spriteSheetIndex,
            resolved.frameIndex,
        );
        const px = pivot?.pivotX ?? -extracted.cutW / 2;
        const py = pivot?.pivotY ?? -extracted.cutH;
        placed.push({ canvas, x: px, y: py });
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px + extracted.cutW);
        maxY = Math.max(maxY, py + extracted.cutH);
    }

    if (placed.length === 0 || !Number.isFinite(minX)) {
        return undefined;
    }

    const pad = 6;
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

    for (const p of placed) {
        const dx = Math.round(p.x - minX + pad);
        const dy = Math.round(p.y - minY + pad);
        ctx.drawImage(p.canvas, dx, dy);
    }

    try {
        return out.toDataURL('image/png');
    } catch {
        return undefined;
    }
}

function equipHash(
    gender: Gender,
    skinColor: SkinColor,
    hairStyleIndex: number,
    underwearColorIndex: number,
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
): string {
    const parts: string[] = [
        String(gender),
        String(skinColor),
        String(hairStyleIndex),
        String(underwearColorIndex),
    ];
    const slots = Object.keys(equippedItems).sort();
    for (const s of slots) {
        const it = equippedItems[s as EquipmentSlot];
        if (!it) continue;
        parts.push(
            `${s}:${it.itemId}:${it.itemUid ?? 0}:${it.itemAttribute ?? 0}:${it.itemColor ?? 0}`,
        );
    }
    return parts.join('|');
}

/**
 * Snapshot the **exact** map avatar (current textures/frames/gear on the live Player).
 * Prefer this over rebuilt idle-south layers — store skin/hair can lag and produce a wrong mannequin.
 */
export function capturePaperDollFromLivePlayer(
    scene: Scene,
    player: PaperDollLivePlayer,
    force = false,
): boolean {
    const layers = player.getVisibleSpritesForPaperDoll();
    if (layers.length === 0) {
        return false;
    }
    const liveKey = `live|${player.getGender()}|${player.getHumanSpriteName()}|${layers
        .map((l) => `${l.spriteName}:${l.sprite.texture?.key ?? ''}:${String(l.sprite.frame?.name ?? '')}`)
        .join(',')}`;
    if (!force && liveKey === lastCaptureKey && lastCompositeOk) {
        return true;
    }

    const url = compositePhaserSprites(layers.map((l) => l.sprite));
    if (!url) {
        return false;
    }
    lastCaptureKey = liveKey;
    lastCompositeOk = true;
    EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_COMPOSITE_KEY, url);

    // Body-only fallback keys from the human layer when present.
    const human = layers.find((l) =>
        ['wm', 'ym', 'bm', 'ww', 'yw', 'bw'].includes(l.spriteName),
    );
    if (human) {
        const bodyUrl = extractSpriteFrameDataUrl(human.sprite);
        if (bodyUrl) {
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_BODY_KEY, bodyUrl);
        }
    }
    return true;
}

function extractSpriteFrameDataUrl(sprite: GameObjects.Sprite): string | undefined {
    try {
        const texture = sprite.texture;
        const frame = sprite.frame;
        if (!texture || !frame || frame.cutWidth <= 0 || frame.cutHeight <= 0) {
            return undefined;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, frame.cutWidth);
        canvas.height = Math.max(1, frame.cutHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return undefined;
        }
        ctx.imageSmoothingEnabled = false;
        const source = texture.getSourceImage() as CanvasImageSource;
        ctx.drawImage(
            source,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            0,
            0,
            frame.cutWidth,
            frame.cutHeight,
        );
        return canvas.toDataURL('image/png');
    } catch {
        return undefined;
    }
}

/**
 * Composite live Phaser sprites (same pixels as on the map) into a single data URL.
 */
function compositePhaserSprites(sprites: GameObjects.Sprite[]): string | undefined {
    type Placed = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number };
    const placed: Placed[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const spr of sprites) {
        if (!spr.visible || spr.alpha < 0.05) {
            continue;
        }
        const frame = spr.frame;
        if (!frame || frame.cutWidth <= 0 || frame.cutHeight <= 0) {
            continue;
        }
        const tex = spr.texture;
        if (!tex) {
            continue;
        }
        try {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, frame.cutWidth);
            canvas.height = Math.max(1, frame.cutHeight);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                continue;
            }
            ctx.imageSmoothingEnabled = false;
            const source = tex.getSourceImage() as CanvasImageSource;
            ctx.drawImage(
                source,
                frame.cutX,
                frame.cutY,
                frame.cutWidth,
                frame.cutHeight,
                0,
                0,
                frame.cutWidth,
                frame.cutHeight,
            );
            // GameAsset uses origin (0,0); sprite.x/y already include pivot offset → top-left of frame.
            const x = spr.x;
            const y = spr.y;
            placed.push({ canvas, x, y, w: frame.cutWidth, h: frame.cutHeight });
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + frame.cutWidth);
            maxY = Math.max(maxY, y + frame.cutHeight);
        } catch {
            // skip broken layer
        }
    }

    if (placed.length === 0 || !Number.isFinite(minX)) {
        return undefined;
    }

    const pad = 4;
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
    for (const p of placed) {
        ctx.drawImage(p.canvas, Math.round(p.x - minX + pad), Math.round(p.y - minY + pad));
    }
    try {
        return out.toDataURL('image/png');
    } catch {
        return undefined;
    }
}

/**
 * Captures nude base + hair + underwear + **full gear composite** for the F5 paper-doll.
 * Emits {@link OUT_SPRITE_FRAME_EXTRACTED} so React `spriteFrameMap` updates.
 * Prefer {@link capturePaperDollFromLivePlayer} when the local Player exists.
 */
export function capturePaperDollBodyLayers(
    scene: Scene,
    gender: Gender,
    skinColor: SkinColor,
    hairStyleIndex: number,
    underwearColorIndex: number,
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>> = {},
    force = false,
): void {
    const key = equipHash(gender, skinColor, hairStyleIndex, underwearColorIndex, equippedItems);
    if (!force && key === lastCaptureKey && lastCompositeOk) {
        return;
    }

    const human = PlayerAppearanceManager.getHumanSpriteName(gender, skinColor);
    const hair = gender === Gender.MALE ? 'mhr' : 'whr';
    const underwear = gender === Gender.MALE ? 'mpt' : 'wpt';

    const humanSheet = IDLE_HUMAN_BASE + IDLE_SOUTH_DIR;
    // Try south idle pack, then common sheet indices (assets may only load used packs).
    let bodyUrl: string | undefined;
    for (const sheet of [humanSheet, 4, 0, 1, 2, 3, 5, 6, 7, 8]) {
        bodyUrl =
            extractFrameDataUrl(scene, textureKey(human, sheet), 0) ??
            extractFrameDataUrl(scene, textureKey(human, sheet), 1);
        if (bodyUrl) {
            break;
        }
    }
    // Last resort: any loaded texture whose key starts with sprite-{human}-
    if (!bodyUrl && scene.textures) {
        try {
            const tex = scene.textures as Phaser.Textures.TextureManager & {
                getTextureKeys?: () => string[];
                list?: Record<string, unknown>;
            };
            const keys =
                typeof tex.getTextureKeys === 'function'
                    ? tex.getTextureKeys()
                    : Object.keys(tex.list ?? {});
            const hit = keys.find((k) => k.startsWith(`sprite-${human}-`));
            if (hit) {
                bodyUrl = extractFrameDataUrl(scene, hit, 0) ?? extractFrameDataUrl(scene, hit, 1);
            }
        } catch {
            // ignore
        }
    }
    if (bodyUrl) {
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_BODY_KEY, bodyUrl);
    }

    if (hairStyleIndex !== 2) {
        const hairStyle = Math.max(0, Math.min(7, hairStyleIndex));
        const hairSheet = hairStyle * 12 + IDLE_ARMOUR_BASE;
        const hairFrame = IDLE_SOUTH_DIR * FRAMES_PER_DIR;
        const hairUrl =
            extractFrameDataUrl(scene, textureKey(hair, hairSheet), hairFrame) ??
            extractFrameDataUrl(scene, textureKey(hair, hairSheet), 0) ??
            extractFrameDataUrl(scene, textureKey(hair, 0), 0);
        if (hairUrl) {
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_HAIR_KEY, hairUrl);
        }
    } else {
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_HAIR_KEY, '');
    }

    const uwColor = Math.max(0, Math.min(7, underwearColorIndex));
    const uwSheet = uwColor * 12 + IDLE_ARMOUR_BASE;
    const uwFrame = IDLE_SOUTH_DIR * FRAMES_PER_DIR;
    const uwUrl =
        extractFrameDataUrl(scene, textureKey(underwear, uwSheet), uwFrame) ??
        extractFrameDataUrl(scene, textureKey(underwear, uwSheet), 0) ??
        extractFrameDataUrl(scene, textureKey(underwear, 0), 0);
    if (uwUrl) {
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_UNDERWEAR_KEY, uwUrl);
    }

    const layers = buildCompositeLayers(
        gender,
        skinColor,
        hairStyleIndex,
        underwearColorIndex,
        equippedItems,
    );

    const baseNames = new Set(['wm', 'ym', 'bm', 'ww', 'yw', 'bw', 'mhr', 'whr', 'mpt', 'wpt']);
    const pending: string[] = [];
    const reemitComposite = () => {
        const url = compositeIdleSouth(scene, layers);
        if (url) {
            lastCaptureKey = key;
            lastCompositeOk = true;
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_COMPOSITE_KEY, url);
        }
    };

    if (LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
        for (const layer of layers) {
            if (baseNames.has(layer.spriteName)) {
                continue;
            }
            if (!arePlayerItemAppearanceLoaded(scene, layer.spriteName)) {
                pending.push(layer.spriteName);
            }
        }
        // Load all missing gear packs, then re-composite once (real clothes, not bag icons).
        if (pending.length > 0) {
            console.debug('[paperdoll] loading gear textures:', pending.join(', '));
            void Promise.all(
                pending.map((name) =>
                    loadPlayerItemAppearanceOnDemand(scene, name).catch(() => undefined),
                ),
            ).then(() => {
                reemitComposite();
            });
        }
    }

    const compositeUrl = compositeIdleSouth(scene, layers);
    if (compositeUrl) {
        lastCaptureKey = key;
        lastCompositeOk = pending.length === 0;
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_COMPOSITE_KEY, compositeUrl);
    } else if (bodyUrl) {
        // Nude/underwear body while gear loads — still real human, never bag icons.
        lastCaptureKey = key;
        lastCompositeOk = pending.length === 0;
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, PAPERDOLL_COMPOSITE_KEY, bodyUrl);
    } else {
        lastCompositeOk = false;
    }
}

/** Force next capture even if equip hash unchanged (e.g. after asset pack load). */
export function invalidatePaperDollCache(): void {
    lastCaptureKey = '';
    lastCompositeOk = false;
}
