import type { Scene } from 'phaser';

import { LOAD_EFFECT_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import type { EffectConfig } from '../constants/Effects';
import { SpriteType } from '../game/assets/HBSprite';
import { areSpriteSheetsLoaded, loadSoundAssetOnDemand, loadSpriteAssetOnDemand } from './SpriteHttpLoader';

/** True when effect `.spr` / SFX are fetched on first use instead of LoadingScreen. */
export function shouldLoadEffectAssetsOnDemand(): boolean {
    return LOAD_EFFECT_ASSETS_ON_DEMAND;
}

function getEffectSpriteAsset(spriteName: string): AssetData {
    return {
        key: `sprite-${spriteName}`,
        fileName: `${spriteName}.spr`,
        assetType: AssetType.SPRITE,
        spriteType: SpriteType.Effect,
    };
}

function effectSoundFileName(sound: string): { key: string; fileName: string } {
    const fileName = sound.endsWith('.mp3') ? sound : `${sound}.mp3`;
    return { key: fileName.replace('.mp3', ''), fileName };
}

export function areEffectSpriteLoaded(scene: Scene, spriteName: string, sheetIndex = 0): boolean {
    return areSpriteSheetsLoaded(scene, `sprite-${spriteName}`, new Set([sheetIndex]));
}

/** Registers only the VFX sheet used by this config (not the whole effect pack). */
export async function loadEffectAssetsOnDemand(scene: Scene, config: EffectConfig): Promise<void> {
    if (!LOAD_EFFECT_ASSETS_ON_DEMAND) {
        return;
    }
    await loadSpriteAssetOnDemand(scene, getEffectSpriteAsset(config.sprite), {
        sheetIndices: new Set([config.spriteSheetIndex]),
    });
    if (!config.sound) {
        return;
    }
    const { key, fileName } = effectSoundFileName(config.sound);
    await loadSoundAssetOnDemand(scene, key, fileName);
}
