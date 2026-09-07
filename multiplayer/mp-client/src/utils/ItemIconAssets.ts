import type { PhaserSceneLike } from '../game/phaserHubTypes';

import { LOAD_ITEM_ICON_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import { HBSpriteFile, SpriteType } from '../game/assets/HBSprite';
import { setItemPackEmittedTintKeys, setItemPackSpriteSheets } from './RegistryUtils';
import { enqueueSpriteDecode, fetchGameAssetArrayBuffer } from './SpriteHttpLoader';

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

const itemIconLoadPromises = new Map<string, Promise<void>>();

/** True when bag/ground item sheets wait until bag open or a pile is in view. */
export function shouldLoadItemIconAssetsOnDemand(): boolean {
    return LOAD_ITEM_ICON_ASSETS_ON_DEMAND;
}

export function areItemIconSheetsLoaded(
    scene: PhaserSceneLike,
    packSheets?: ReadonlySet<number>,
    groundSheets?: ReadonlySet<number>,
): boolean {
    if (packSheets) {
        for (const sheet of packSheets) {
            if (!scene.textures.exists(`${ITEM_PACK.key}-${sheet}`)) {
                return false;
            }
        }
    }
    if (groundSheets) {
        for (const sheet of groundSheets) {
            if (!scene.textures.exists(`${ITEM_GROUND.key}-${sheet}`)) {
                return false;
            }
        }
    }
    return true;
}

/** Legacy: both packs have sheet 0. Prefer {@link areItemIconSheetsLoaded} for pad/bag filters. */
export function areItemIconAssetsLoaded(scene: PhaserSceneLike): boolean {
    return scene.textures.exists(`${ITEM_PACK.key}-0`) && scene.textures.exists(`${ITEM_GROUND.key}-0`);
}

export interface LoadItemIconOptions {
    packSheets?: ReadonlySet<number>;
    groundSheets?: ReadonlySet<number>;
}

/**
 * Registers only the item-pack / item-ground sheets needed for visible piles or bag items.
 * Does not dump every frame as a PNG data URL.
 */
export function loadItemIconAssetsOnDemand(scene: PhaserSceneLike, options?: LoadItemIconOptions): Promise<void> {
    if (!LOAD_ITEM_ICON_ASSETS_ON_DEMAND) {
        return Promise.resolve();
    }
    const packSheets = options?.packSheets;
    const groundSheets = options?.groundSheets;
    if (areItemIconSheetsLoaded(scene, packSheets, groundSheets)) {
        return Promise.resolve();
    }
    const promiseKey = `p:${packSheets ? [...packSheets].sort((a, b) => a - b).join(',') : 'none'}|g:${groundSheets ? [...groundSheets].sort((a, b) => a - b).join(',') : 'none'}`;
    const existing = itemIconLoadPromises.get(promiseKey);
    if (existing) {
        return existing;
    }

    const promise = (async () => {
        if (packSheets && packSheets.size > 0) {
            await loadItemIconSprite(scene, ITEM_PACK, true, packSheets);
        }
        if (groundSheets && groundSheets.size > 0) {
            await loadItemIconSprite(scene, ITEM_GROUND, false, groundSheets);
        }
        console.log('[ItemIconLoader] item-pack/item-ground sheets registered (filtered, no data-URL dump)');
    })().catch((error) => {
        itemIconLoadPromises.delete(promiseKey);
        throw error;
    });

    itemIconLoadPromises.set(promiseKey, promise);
    return promise;
}

async function loadItemIconSprite(
    scene: PhaserSceneLike,
    asset: AssetData,
    capturePackSheets: boolean,
    sheetIndices: ReadonlySet<number>,
): Promise<void> {
    if (!asset.spriteType) {
        throw new Error(`Item icon asset ${asset.key} is missing spriteType`);
    }
    const spriteType = asset.spriteType;

    await enqueueSpriteDecode(async () => {
        const missing: number[] = [];
        for (const sheet of sheetIndices) {
            if (!scene.textures.exists(`${asset.key}-${sheet}`)) {
                missing.push(sheet);
            }
        }
        if (missing.length === 0) {
            return;
        }
        if (!scene.cache.binary.exists(asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }
        const hbFile = new HBSpriteFile(asset.key, spriteType, false, asset.tileStartIndex);
        await hbFile.load(scene, { sheetIndices: new Set(missing) });
        if (capturePackSheets) {
            setItemPackSpriteSheets(scene.game, hbFile.spriteSheets);
            setItemPackEmittedTintKeys(scene.game, new Set<string>());
        }
    });
}
