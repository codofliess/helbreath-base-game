import { GameObjects, type Scene } from 'phaser';
import { Gender, SkinColor, type PivotFrame } from '../../Types';
import { Direction } from '../../utils/CoordinateUtils';
import { getPivotData } from '../../utils/RegistryUtils';
import { PlayerAppearanceManager, type GearConfig } from '../../utils/PlayerAppearanceManager';
import { ItemTypes } from '../../constants/Items';
import {
    arePlayerItemAppearanceLoaded,
    loadPlayerItemAppearanceOnDemand,
} from '../../utils/ItemAssets';
import { LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND } from '../../Config';

/**
 * Classic Client.cpp menu walk timer:
 *   every 100ms → frame++; when frame>=8 → frame=0, dirCnt++; when dirCnt>8 → dir++, dirCnt=1
 */
export const MENU_WALK_FRAME_MS = 100;
export const MENU_WALK_FRAMES = 8;
/** Classic holds each facing for 8 full walk cycles before rotating. */
export const MENU_WALK_CYCLES_PER_DIR = 8;

/** WalkPeaceMode bases (PlayerAppearanceManager). */
const WALK_HUMAN_BASE = 16;
const WALK_ARMOUR_BASE = 2;
const WALK_ARMAMENT_STATE = 2;
const WALK_ANGELIC_STATE = 5;
const DIR_FRAMES = 8;

/** IdlePeaceMode — used by ND_NEWCHAR static oval. */
const IDLE_HUMAN_BASE = 0;
const IDLE_ARMOUR_BASE = 0;

const DEFAULT_HAIR_TINT = 0x5a3a28;

const BODY_PACK_SPRITES = new Set(['mhr', 'whr', 'mpt', 'wpt', 'wm', 'ym', 'bm', 'ww', 'yw', 'bw']);

/**
 * While SELECTCHAR scales body sheets up, use LINEAR so Chrome isn’t brick-pixelated.
 * Ref-counted so concurrent previews don’t stomp each other; restore NEAREST for GameWorld.
 * Numeric filter modes (0=NEAREST, 1=LINEAR) — avoid fragile Phaser named exports.
 */
const FILTER_NEAREST = 0;
const FILTER_LINEAR = 1;
const linearFilterRefCount = new Map<string, number>();

function acquireLinearFilter(scene: Scene, textureKey: string): void {
    if (!scene.textures.exists(textureKey)) {
        return;
    }
    const next = (linearFilterRefCount.get(textureKey) ?? 0) + 1;
    linearFilterRefCount.set(textureKey, next);
    if (next === 1) {
        try {
            scene.textures.get(textureKey).setFilter(FILTER_LINEAR as 0 | 1);
        } catch {
            // ignore — keep NEAREST rather than break SELECTCHAR
        }
    }
}

function releaseLinearFilter(scene: Scene, textureKey: string): void {
    const cur = linearFilterRefCount.get(textureKey) ?? 0;
    if (cur <= 1) {
        linearFilterRefCount.delete(textureKey);
        if (scene.textures.exists(textureKey)) {
            try {
                scene.textures.get(textureKey).setFilter(FILTER_NEAREST as 0 | 1);
            } catch {
                // ignore
            }
        }
        return;
    }
    linearFilterRefCount.set(textureKey, cur - 1);
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

export interface MenuEquipPreview {
    slot: string;
    itemId: number;
}

export interface MenuPreviewLook {
    gender: Gender;
    skinColor: SkinColor;
    hairStyleIndex: number;
    underwearColorIndex: number;
    /**
     * When true (SELECTCHAR with no gear yet), stack default shirt + pants so the oval
     * is not underwear-only. Ignored when equipped rows resolve clothing layers.
     */
    wearDefaultClothes?: boolean;
    /** Equipped gear for Olympia DrawObject_OnMove_ForMenu (slot + item id). */
    equipped?: ReadonlyArray<MenuEquipPreview>;
    /**
     * When true, use WalkPeaceMode sheets (SELECTCHAR). When false, IdlePeaceMode (CREATECHAR).
     */
    walkMode?: boolean;
    /**
     * Uniform scale on the preview container (feet-anchored). Prefer {@link fitOvalHeight}.
     */
    displayScale?: number;
    /**
     * Auto-scale so the body frame fills this many vertical pixels (~ oval height * fill).
     * Overrides {@link displayScale} once a body texture is available.
     */
    fitOvalHeight?: number;
    /** Fraction of fitOvalHeight to fill (default 0.9). */
    fitFill?: number;
}

export interface MenuPreviewController {
    readonly layers: GameObjects.Image[];
    setPose(direction: Direction, frame: number): void;
    destroy(): void;
}

type LayerKind = 'human' | 'armour' | 'weapon' | 'shield' | 'accessory';

interface LayerSpec {
    kind: LayerKind;
    spriteName: string;
    /** Colour pack / armament start sheet (armour color*12, weapon/shield start). */
    sheetPack: number;
    tint?: number;
}

interface LiveLayer {
    spec: LayerSpec;
    img: GameObjects.Image | undefined;
}

/**
 * Classic Helbreath PutSpriteFast places bitmaps at (anchorX + pivotX, anchorY + pivotY)
 * with the feet/anchor at (anchorX, anchorY). Same formula as GameAsset.applyPivotOffset.
 *
 * When used as a **child of a feet-anchored container** at (0,0), pass anchor 0,0 and
 * scale the **container** instead of the image (scale stays stable across walk frames).
 *
 * When `scale !== 1` on the image itself, pivot offsets are multiplied so feet stay fixed.
 */
export function applyMenuSpritePivot(
    img: GameObjects.Image,
    anchorX: number,
    anchorY: number,
    pivot: PivotFrame | undefined,
    scale = 1,
): void {
    const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
    img.setScale(s);
    if (!pivot) {
        img.setPosition(anchorX, anchorY);
        return;
    }
    img.setPosition(anchorX + pivot.pivotX * s, anchorY + pivot.pivotY * s);
}

/**
 * Builds layered body + underwear + hair for ND_NEWCHAR (static idle) / one-shot previews.
 * Hair style index 2 = bald (no hair layer).
 */
export function buildMenuCharacterPreview(
    scene: Scene,
    parent: GameObjects.Container,
    anchorX: number,
    anchorY: number,
    look: MenuPreviewLook,
): GameObjects.Image[] {
    const controller = createMenuCharacterPreview(scene, parent, anchorX, anchorY, {
        ...look,
        walkMode: look.walkMode ?? false,
    });
    return controller.layers;
}

/**
 * SELECTCHAR walk/rotate controller (classic m_cMenuFrame / m_cMenuDir).
 * Layers follow WalkPeaceMode sheet formulas; gear from CharacterList equipped rows.
 */
/**
 * Layered menu preview drawn as scene images parented into `parent` (SelectCharDesk root).
 * Uses absolute feet anchors + per-image scale every pose — do NOT nest a second Container
 * (Phaser nested-container + walk recreate was blanking sprites in traveler).
 */
export function createMenuCharacterPreview(
    scene: Scene,
    parent: GameObjects.Container,
    anchorX: number,
    anchorY: number,
    look: MenuPreviewLook,
): MenuPreviewController {
    const live: LiveLayer[] = buildLayerSpecs(look).map((spec) => ({ spec, img: undefined }));
    let currentDir: Direction = Direction.South;
    let currentFrame = 0;
    let destroyed = false;
    const pendingLoads = new Set<string>();
    const useWalk = look.walkMode === true;

    // Resolve scale once: explicit displayScale, or fitOvalHeight / REF_BODY_ABOVE_FEET.
    // Classic body walk frames are ~48–56px from feet to head in pivot space.
    const REF_BODY_ABOVE_FEET = 52;
    let layerScale = 1;
    if (typeof look.displayScale === 'number' && look.displayScale > 0) {
        layerScale = look.displayScale;
    } else if (typeof look.fitOvalHeight === 'number' && look.fitOvalHeight > 0) {
        const fill =
            typeof look.fitFill === 'number' && look.fitFill > 0 && look.fitFill <= 1.2
                ? look.fitFill
                : 0.9;
        // Cap scale: beyond ~3.2× classic sprs look giant/pixelated on SELECTCHAR desks.
        layerScale = Math.min(3.2, Math.max(1.55, (look.fitOvalHeight * fill) / REF_BODY_ABOVE_FEET));
    }

    const useSmoothUpscale = layerScale > 1.75;
    const smoothKeys = new Set<string>();

    const clearImages = (): void => {
        for (const layer of live) {
            layer.img?.destroy();
            layer.img = undefined;
        }
    };

    const trackSmoothKey = (textureKey: string): void => {
        if (!useSmoothUpscale || smoothKeys.has(textureKey)) {
            return;
        }
        smoothKeys.add(textureKey);
        acquireLinearFilter(scene, textureKey);
    };

    const kickLazyLoads = (): void => {
        if (!LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND) {
            return;
        }
        for (const { spec } of live) {
            if (BODY_PACK_SPRITES.has(spec.spriteName)) {
                continue;
            }
            if (arePlayerItemAppearanceLoaded(scene, spec.spriteName)) {
                continue;
            }
            if (pendingLoads.has(spec.spriteName)) {
                continue;
            }
            pendingLoads.add(spec.spriteName);
            void loadPlayerItemAppearanceOnDemand(scene, spec.spriteName)
                .then(() => {
                    pendingLoads.delete(spec.spriteName);
                    if (!destroyed) {
                        applyPose(currentDir, currentFrame, true);
                    }
                })
                .catch(() => {
                    pendingLoads.delete(spec.spriteName);
                });
        }
    };

    const applyPose = (direction: Direction, frame: number, forceRecreate = false): void => {
        currentDir = direction;
        currentFrame = Math.max(0, Math.min(MENU_WALK_FRAMES - 1, frame));
        kickLazyLoads();

        for (const layer of live) {
            const resolved = resolveLayerTexture(layer.spec, direction, currentFrame, useWalk);
            if (!scene.textures.exists(resolved.textureKey)) {
                if (layer.img) {
                    layer.img.setVisible(false);
                }
                continue;
            }
            const texture = scene.textures.get(resolved.textureKey);
            const frameName = String(resolved.frameIndex);
            if (!texture.has(frameName) && !texture.getFrameNames().includes(frameName)) {
                if (layer.img) {
                    layer.img.setVisible(false);
                }
                continue;
            }

            trackSmoothKey(resolved.textureKey);

            if (!layer.img || forceRecreate) {
                layer.img?.destroy();
                layer.img = scene.add
                    .image(anchorX, anchorY, resolved.textureKey, frameName)
                    .setOrigin(0, 0);
                if (layer.spec.tint !== undefined) {
                    layer.img.setTint(layer.spec.tint);
                }
                // Parent into desk root so depth follows SelectCharDesk.
                parent.add(layer.img);
            } else {
                layer.img.setTexture(resolved.textureKey, frameName);
                layer.img.setVisible(true);
            }

            const pivot = getSpritePivotFrame(
                scene,
                resolved.spriteName,
                resolved.spriteSheetIndex,
                resolved.frameIndex,
            );
            // Scale every pose (walk ticks must not reset to 1). Pivot×scale keeps feet on anchor.
            applyMenuSpritePivot(layer.img, anchorX, anchorY, pivot, layerScale);
        }
    };

    applyPose(Direction.South, 0, true);

    return {
        get layers() {
            return live.map((l) => l.img).filter((img): img is GameObjects.Image => !!img);
        },
        setPose(direction: Direction, frame: number) {
            if (destroyed) {
                return;
            }
            applyPose(direction, frame, false);
        },
        destroy() {
            destroyed = true;
            clearImages();
            for (const key of smoothKeys) {
                releaseLinearFilter(scene, key);
            }
            smoothKeys.clear();
            pendingLoads.clear();
            live.length = 0;
        },
    };
}

function buildLayerSpecs(look: MenuPreviewLook): LayerSpec[] {
    const gender = look.gender;
    const human = PlayerAppearanceManager.getHumanSpriteName(gender, look.skinColor);
    const underwear = gender === Gender.MALE ? 'mpt' : 'wpt';
    const hair = gender === Gender.MALE ? 'mhr' : 'whr';
    const underPack = Math.max(0, Math.min(7, look.underwearColorIndex)) * 12;
    const hairPack =
        Math.max(0, Math.min(7, look.hairStyleIndex === 2 ? 0 : look.hairStyleIndex)) * 12;

    const equippedMap = toEquippedMap(look.equipped);
    const baseGear: GearConfig = {
        human,
        underwear,
        underwearColorIndex: look.underwearColorIndex,
        hairStyleIndex: look.hairStyleIndex,
    };
    const resolved = PlayerAppearanceManager.resolveGearFromEquippedItems(
        baseGear,
        equippedMap,
        gender,
    );

    const hasVisibleGear = VISIBLE_EQUIP_SLOTS.some((slot) => {
        const row = equippedMap[slot];
        return row !== undefined && row.itemId > 0;
    });

    const specs: LayerSpec[] = [];
    specs.push({ kind: 'human', spriteName: human, sheetPack: 0 });
    if (look.hairStyleIndex !== 2) {
        specs.push({
            kind: 'armour',
            spriteName: hair,
            sheetPack: hairPack,
            tint: DEFAULT_HAIR_TINT,
        });
    }
    specs.push({ kind: 'armour', spriteName: underwear, sheetPack: underPack });

    if (!hasVisibleGear && look.wearDefaultClothes) {
        const shirt = gender === Gender.MALE ? 'mshirt' : 'wshirt';
        const pants = gender === Gender.MALE ? 'mhtrouser' : 'whtrouser';
        specs.push({ kind: 'armour', spriteName: shirt, sheetPack: 0 });
        specs.push({ kind: 'armour', spriteName: pants, sheetPack: 0 });
    } else if (hasVisibleGear) {
        if (resolved.hauberk) {
            specs.push({ kind: 'armour', spriteName: resolved.hauberk, sheetPack: 0 });
        }
        if (resolved.leggings) {
            specs.push({ kind: 'armour', spriteName: resolved.leggings, sheetPack: 0 });
        }
        if (resolved.boots) {
            specs.push({ kind: 'armour', spriteName: resolved.boots, sheetPack: 0 });
        }
        if (resolved.helm) {
            specs.push({ kind: 'armour', spriteName: resolved.helm, sheetPack: 0 });
        }
        if (resolved.armor) {
            specs.push({ kind: 'armour', spriteName: resolved.armor, sheetPack: 0 });
        }
        if (resolved.shield) {
            specs.push({
                kind: 'shield',
                spriteName: resolved.shield,
                sheetPack: resolved.shieldStartSpriteSheetIndex ?? 0,
            });
        }
        if (resolved.cape) {
            specs.push({ kind: 'armour', spriteName: resolved.cape, sheetPack: 0 });
        }
        if (resolved.weapon) {
            specs.push({
                kind: 'weapon',
                spriteName: resolved.weapon,
                sheetPack: resolved.weaponStartSpriteSheetIndex ?? 0,
            });
        }
        if (resolved.accessory) {
            specs.push({ kind: 'accessory', spriteName: resolved.accessory, sheetPack: 0 });
        }
    }

    return specs;
}

function toEquippedMap(
    equipped: ReadonlyArray<MenuEquipPreview> | undefined,
): Partial<Record<ItemTypes, { itemId: number }>> {
    const map: Partial<Record<ItemTypes, { itemId: number }>> = {};
    if (!equipped) {
        return map;
    }
    for (const row of equipped) {
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

function resolveLayerTexture(
    spec: LayerSpec,
    direction: Direction,
    frame: number,
    useWalk: boolean,
): { textureKey: string; frameIndex: number; spriteName: string; spriteSheetIndex: number } {
    const dir = Math.max(0, Math.min(7, direction));
    const f = Math.max(0, Math.min(DIR_FRAMES - 1, frame));
    let spriteSheetIndex = 0;
    let frameIndex = 0;

    if (useWalk) {
        switch (spec.kind) {
            case 'human':
                spriteSheetIndex = WALK_HUMAN_BASE + dir;
                frameIndex = f;
                break;
            case 'armour':
                spriteSheetIndex = spec.sheetPack + WALK_ARMOUR_BASE;
                frameIndex = dir * DIR_FRAMES + f;
                break;
            case 'weapon':
                spriteSheetIndex = spec.sheetPack + WALK_ARMAMENT_STATE * 8 + dir;
                frameIndex = f;
                break;
            case 'shield':
                spriteSheetIndex = spec.sheetPack + WALK_ARMAMENT_STATE;
                frameIndex = dir * DIR_FRAMES + f;
                break;
            case 'accessory':
                spriteSheetIndex = WALK_ANGELIC_STATE * 8 + dir;
                frameIndex = f;
                break;
        }
    } else {
        switch (spec.kind) {
            case 'human':
                spriteSheetIndex = IDLE_HUMAN_BASE + dir;
                frameIndex = 0;
                break;
            case 'armour':
                spriteSheetIndex = spec.sheetPack + IDLE_ARMOUR_BASE;
                frameIndex = dir * DIR_FRAMES;
                break;
            case 'weapon':
                spriteSheetIndex = spec.sheetPack + dir;
                frameIndex = 0;
                break;
            case 'shield':
                spriteSheetIndex = spec.sheetPack;
                frameIndex = dir * DIR_FRAMES;
                break;
            case 'accessory':
                spriteSheetIndex = 5 * 8 + dir;
                frameIndex = 0;
                break;
        }
    }

    return {
        textureKey: `sprite-${spec.spriteName}-${spriteSheetIndex}`,
        frameIndex,
        spriteName: spec.spriteName,
        spriteSheetIndex,
    };
}

function getSpritePivotFrame(
    scene: Scene,
    spriteName: string,
    spriteSheetIndex: number,
    frameIndex: number,
): PivotFrame | undefined {
    const pivotData = getPivotData(scene, '', spriteName, false);
    const frame = pivotData?.spriteSheetPivots?.[spriteSheetIndex]?.[frameIndex];
    if (!frame || frame.width <= 0 || frame.height <= 0) {
        return undefined;
    }
    return frame;
}
