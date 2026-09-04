import type { Scene } from 'phaser';

import { LOAD_NPC_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import { SpriteType } from '../game/assets/HBSprite';
import { areSpriteSheetLoaded, loadSpriteAssetOnDemand } from './SpriteHttpLoader';

/** True when NPC `.spr` files are fetched when an NPC enters view. */
export function shouldLoadNpcAssetsOnDemand(): boolean {
    return LOAD_NPC_ASSETS_ON_DEMAND;
}

function getNpcSpriteAsset(spriteName: string): AssetData {
    return {
        key: `sprite-${spriteName}`,
        fileName: `${spriteName}.spr`,
        assetType: AssetType.SPRITE,
        spriteType: SpriteType.Monster,
    };
}

export function areNpcSpriteLoaded(scene: Scene, spriteName: string): boolean {
    return areSpriteSheetLoaded(scene, `sprite-${spriteName}`);
}

/** Fetches one NPC sprite pack (same Helbreath monster sheet layout). */
export function loadNpcSpriteOnDemand(scene: Scene, spriteName: string): Promise<void> {
    if (!LOAD_NPC_ASSETS_ON_DEMAND || areNpcSpriteLoaded(scene, spriteName)) {
        return Promise.resolve();
    }
    return loadSpriteAssetOnDemand(scene, getNpcSpriteAsset(spriteName));
}
