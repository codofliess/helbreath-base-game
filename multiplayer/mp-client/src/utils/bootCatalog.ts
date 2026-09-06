import type { Scene } from 'phaser';

import { MONSTER_PLACEHOLDER_SPRITE } from '../Config';
import { ASSETS, AssetType, type AssetData } from '../constants/Assets';
import { SpriteType } from '../game/assets/HBSprite';
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

/**
 * HUD/dialog interface packs + monster placeholder. Call after map viewport stream so
 * enter-world does not race tile-sheet decode.
 */
export function loadWorldDeferredSprites(scene: Scene): Promise<void> {
    return loadSpriteList(
        scene,
        [...getWorldInterfaceAssets(), getMonsterPlaceholderAsset()],
        'world',
    );
}
