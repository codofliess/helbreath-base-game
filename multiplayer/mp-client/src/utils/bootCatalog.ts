import type { Scene } from 'phaser';

import { MONSTER_PLACEHOLDER_SPRITE } from '../Config';
import { ASSETS, AssetType, type AssetData } from '../constants/Assets';
import {
    CURSOR_ATTACK,
    CURSOR_CAST_READY,
    CURSOR_CASTING,
    CURSOR_GRAB_1,
    CURSOR_GRAB_2,
    CURSOR_POINTER,
    HUD_GAUGE_EXP,
    HUD_GAUGE_HP_MP,
    HUD_GAUGE_SP,
    HUD_ICON_CHARACTER,
    HUD_ICON_CHAT,
    HUD_ICON_COMBAT_MODE,
    HUD_ICON_CRUSADE,
    HUD_ICON_INVENTORY,
    HUD_ICON_MAGIC,
    HUD_ICON_PANEL_BG,
    HUD_ICON_SAFE_ATTACK,
    HUD_ICON_SKILLS,
    HUD_ICON_SYSTEM,
} from '../constants/SpriteKeys';
import { SpriteType } from '../game/assets/HBSprite';
import { EventBus } from '../game/EventBus';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../constants/EventNames';
import { loadSpriteAssetOnDemand } from './SpriteHttpLoader';

/**
 * Body / underwear / hair packs for SELECTCHAR and Create Character paper-dolls.
 * Extra gear `.spr` stays on the appearance on-demand path.
 */
export const SELECT_APPEARANCE_SPRITE_NAMES = [
    'wm',
    'ym',
    'bm',
    'ww',
    'yw',
    'bw',
    'mpt',
    'wpt',
    'mhr',
    'whr',
] as const;

/** In-world HUD: cursor sheet + icon panel only. Dialogs wait for F-keys. */
export const WORLD_ENTER_HUD_ASSETS: Array<{ key: string; fileName: string; sheets: number[] }> = [
    { key: 'sprite-interface', fileName: 'interface.spr', sheets: [0] },
    { key: 'sprite-gamedialog2', fileName: 'gamedialog2.spr', sheets: [6] },
];

/** React HUD keys extracted after sheet decode (never dump every frame as a data URL). */
export const WORLD_ENTER_HUD_FRAME_KEYS = [
    CURSOR_POINTER,
    CURSOR_GRAB_1,
    CURSOR_GRAB_2,
    CURSOR_ATTACK,
    CURSOR_CASTING,
    CURSOR_CAST_READY,
    HUD_ICON_PANEL_BG,
    HUD_ICON_CHARACTER,
    HUD_ICON_INVENTORY,
    HUD_ICON_MAGIC,
    HUD_ICON_SKILLS,
    HUD_ICON_CHAT,
    HUD_ICON_SYSTEM,
    HUD_ICON_CRUSADE,
    HUD_ICON_SAFE_ATTACK,
    HUD_ICON_COMBAT_MODE,
    HUD_GAUGE_HP_MP,
    HUD_GAUGE_SP,
    HUD_GAUGE_EXP,
] as const;

function assetForSpriteName(spriteName: string, spriteType: SpriteType): AssetData {
    const key = `sprite-${spriteName}`;
    const row = ASSETS.find((a) => a.key === key && a.assetType === AssetType.SPRITE);
    if (row) {
        return row;
    }
    return {
        key,
        fileName: `${spriteName}.spr`,
        assetType: AssetType.SPRITE,
        spriteType,
    };
}

export function getSelectAppearanceAssets(): AssetData[] {
    return SELECT_APPEARANCE_SPRITE_NAMES.map((name) => assetForSpriteName(name, SpriteType.Human));
}

export function getWorldInterfaceAssets(): AssetData[] {
    return ASSETS.filter(
        (a) => a.assetType === AssetType.SPRITE && a.spriteType === SpriteType.Interface,
    );
}

export function getMonsterPlaceholderAsset(): AssetData {
    return assetForSpriteName(MONSTER_PLACEHOLDER_SPRITE, SpriteType.Monster);
}

async function loadSpriteList(scene: Scene, assets: AssetData[], label: string): Promise<void> {
    for (const asset of assets) {
        try {
            await loadSpriteAssetOnDemand(scene, asset);
        } catch (error) {
            console.warn(`[bootCatalog] ${label} skipped ${asset.fileName}`, error);
        }
    }
}

/** Sequential decode of SELECTCHAR paper-doll packs (after React hub / when leaving hub). */
export function loadSelectAppearanceSprites(scene: Scene): Promise<void> {
    return loadSpriteList(scene, getSelectAppearanceAssets(), 'select');
}

function parseSpriteFrameKey(key: string): { textureKey: string; frame: number } | undefined {
    const match = key.match(/^(sprite-[a-z0-9]+)-(\d+)-(\d+)$/i);
    if (!match) {
        return undefined;
    }
    return { textureKey: `${match[1]}-${match[2]}`, frame: Number(match[3]) };
}

function emitTextureFrameDataUrl(scene: Scene, frameKey: string): void {
    const parsed = parseSpriteFrameKey(frameKey);
    if (!parsed || !scene.textures.exists(parsed.textureKey)) {
        return;
    }
    try {
        const texture = scene.textures.get(parsed.textureKey);
        const fr = texture.get(String(parsed.frame));
        if (!fr || fr.cutWidth <= 0) {
            return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, fr.cutWidth);
        canvas.height = Math.max(1, fr.cutHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }
        ctx.imageSmoothingEnabled = false;
        const source = texture.getSourceImage() as CanvasImageSource;
        ctx.drawImage(source, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, frameKey, canvas.toDataURL('image/png'));
    } catch (error) {
        console.warn(`[bootCatalog] HUD frame extract failed for ${frameKey}`, error);
    }
}

/**
 * Cursor + bottom HUD icon panel only. Does not decode gamedialog2 dialog sheets,
 * dialogtext, interface2, or the purple monster placeholder — those OOMed pad enter.
 */
export async function loadWorldDeferredSprites(scene: Scene): Promise<void> {
    for (const row of WORLD_ENTER_HUD_ASSETS) {
        try {
            await loadSpriteAssetOnDemand(
                scene,
                {
                    key: row.key,
                    fileName: row.fileName,
                    assetType: AssetType.SPRITE,
                    spriteType: SpriteType.Interface,
                },
                { sheetIndices: new Set(row.sheets) },
            );
        } catch (error) {
            console.warn(`[bootCatalog] world skipped ${row.fileName}`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    for (const frameKey of WORLD_ENTER_HUD_FRAME_KEYS) {
        emitTextureFrameDataUrl(scene, frameKey);
    }
}
