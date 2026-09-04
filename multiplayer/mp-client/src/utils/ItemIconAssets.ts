import type { Scene } from 'phaser';

import { LOAD_ITEM_ICON_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import { HBSpriteFile, SpriteType } from '../game/assets/HBSprite';
import { setItemPackEmittedTintKeys, setItemPackSpriteSheets } from './RegistryUtils';
import { areSpriteSheetLoaded, enqueueSpriteDecode, fetchGameAssetArrayBuffer } from './SpriteHttpLoader';

const ITEM_PACK: AssetData = {
    key: 'sprite-item-pack',
    fileName: 'item-pack.spr',
    assetType: AssetType.SPRITE,
    spriteType: SpriteType.ItemPack,
    exportFramesAsDataUrls: false,
};

const ITEM_GROUND: AssetData = {
    key: 'sprite-item-ground',
    fileName: 'item-ground.spr',
    assetType: AssetType.SPRITE,
    spriteType: SpriteType.ItemGround,
    exportFramesAsDataUrls: false,
};

let itemIconLoadPromise: Promise<void> | undefined;

/** True when bag/ground item sheets wait until bag open or a pile is in view. */
export function shouldLoadItemIconAssetsOnDemand(): boolean {
    return LOAD_ITEM_ICON_ASSETS_ON_DEMAND;
}

export function areItemIconAssetsLoaded(scene: Scene): boolean {
    return areSpriteSheetLoaded(scene, ITEM_PACK.key) && areSpriteSheetLoaded(scene, ITEM_GROUND.key);
}

/**
 * Registers item-pack + item-ground without dumping every frame as a PNG data URL.
 * React bag icons extract frames on demand from Phaser textures.
 */
export function loadItemIconAssetsOnDemand(scene: Scene): Promise<void> {
    if (!LOAD_ITEM_ICON_ASSETS_ON_DEMAND || areItemIconAssetsLoaded(scene)) {
        return Promise.resolve();
    }
    if (itemIconLoadPromise) {
        return itemIconLoadPromise;
    }

    itemIconLoadPromise = (async () => {
        await loadItemIconSprite(scene, ITEM_PACK, true);
        await loadItemIconSprite(scene, ITEM_GROUND, false);
        console.log('[ItemIconLoader] item-pack and item-ground registered (no full data-URL dump)');
    })().catch((error) => {
        itemIconLoadPromise = undefined;
        throw error;
    });

    return itemIconLoadPromise;
}

async function loadItemIconSprite(scene: Scene, asset: AssetData, capturePackSheets: boolean): Promise<void> {
    if (areSpriteSheetLoaded(scene, asset.key)) {
        return;
    }
    if (!asset.spriteType) {
        throw new Error(`Item icon asset ${asset.key} is missing spriteType`);
    }
    const spriteType = asset.spriteType;

    await enqueueSpriteDecode(async () => {
        if (areSpriteSheetLoaded(scene, asset.key)) {
            return;
        }
        const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
        scene.cache.binary.add(asset.key, arrayBuffer);
        const hbFile = new HBSpriteFile(asset.key, spriteType, false, asset.tileStartIndex);
        await hbFile.load(scene);
        if (capturePackSheets) {
            setItemPackSpriteSheets(scene.game, hbFile.spriteSheets);
            setItemPackEmittedTintKeys(scene.game, new Set<string>());
        }
    });
}
