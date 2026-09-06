import type { Scene } from 'phaser';

import { LOAD_NPC_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import { SpriteType } from '../game/assets/HBSprite';
import { idleEntitySheetIndices } from './entitySheetFilter';
import { areSpriteSheetsLoaded, evictSpriteSheetTextures, loadSpriteAssetOnDemand } from './SpriteHttpLoader';

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
    return areSpriteSheetsLoaded(scene, `sprite-${spriteName}`, idleEntitySheetIndices());
}

/** Fetches idle sheets only (plaza NPCs must not unpack 40 combat/death atlases on pad enter). */
export function loadNpcSpriteOnDemand(scene: Scene, spriteName: string): Promise<void> {
    if (!LOAD_NPC_ASSETS_ON_DEMAND || areNpcSpriteLoaded(scene, spriteName)) {
        return Promise.resolve();
    }
    return loadSpriteAssetOnDemand(scene, getNpcSpriteAsset(spriteName), {
        sheetIndices: idleEntitySheetIndices(),
    });
}

export function evictNpcSpriteSheets(scene: Scene, spriteName: string): number {
    return evictSpriteSheetTextures(scene, `sprite-${spriteName}`, new Set());
}
