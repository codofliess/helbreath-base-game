import type { Scene } from 'phaser';

import { MONSTER_PLACEHOLDER_SPRITE } from '../Config';
import { ASSETS, AssetType, type AssetData } from '../constants/Assets';
import { SpriteType } from '../game/assets/HBSprite';
import { WORLD_HUD_FRAME_KEYS } from './uiDialogFrames';
import { ensureNamedSpriteFrames } from './uiSpriteFrames';
import { loadSpriteAssetOnDemand, loadSpriteSheetsOnDemand } from './SpriteHttpLoader';

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

function assetForSpriteName(spriteName: string, spriteType: SpriteType): AssetData {
    const key = `sprite-${spriteName}`;
    const row = ASSETS.find((a) => a.key === key && a.assetType === AssetType.SPRITE);
    if (row) {
        return { ...row, exportFramesAsDataUrls: false };
    }
    return {
        key,
        fileName: `${spriteName}.spr`,
        assetType: AssetType.SPRITE,
        spriteType,
        exportFramesAsDataUrls: false,
    };
}

export function getSelectAppearanceAssets(): AssetData[] {
    return SELECT_APPEARANCE_SPRITE_NAMES.map((name) => assetForSpriteName(name, SpriteType.Human));
}

/** HUD only: interface cursors (sheet 0) + gamedialog2 dock (sheet 6). Never dialogtext / full bag. */
export const WORLD_HUD_SPRITE_SHEETS: ReadonlyArray<{ asset: AssetData; sheets: readonly number[] }> = [
    {
        asset: {
            key: 'sprite-interface',
            fileName: 'interface.spr',
            assetType: AssetType.SPRITE,
            spriteType: SpriteType.Interface,
            exportFramesAsDataUrls: false,
        },
        sheets: [0],
    },
    {
        asset: {
            key: 'sprite-gamedialog2',
            fileName: 'gamedialog2.spr',
            assetType: AssetType.SPRITE,
            spriteType: SpriteType.Interface,
            exportFramesAsDataUrls: false,
        },
        sheets: [6],
    },
];

export function getWorldInterfaceAssets(): AssetData[] {
    return WORLD_HUD_SPRITE_SHEETS.map((row) => row.asset);
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

/**
 * HUD sheets + monster placeholder. Does not decode dialogtext or item-pack.
 * Call after map viewport stream so enter-world does not race tile-sheet decode.
 */
export async function loadWorldDeferredSprites(scene: Scene): Promise<void> {
    for (const row of WORLD_HUD_SPRITE_SHEETS) {
        try {
            await loadSpriteSheetsOnDemand(scene, row.asset, row.sheets);
        } catch (error) {
            console.warn(`[bootCatalog] world skipped ${row.asset.fileName}`, error);
        }
    }
    try {
        await loadSpriteAssetOnDemand(scene, getMonsterPlaceholderAsset());
    } catch (error) {
        console.warn('[bootCatalog] world skipped monster placeholder', error);
    }
    await ensureNamedSpriteFrames(scene, WORLD_HUD_FRAME_KEYS);
}
