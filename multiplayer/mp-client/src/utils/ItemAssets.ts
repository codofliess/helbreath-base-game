import type { PhaserSceneLike } from '../game/phaserHubTypes';

import { LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, getItemEquippedAppearanceSpriteNames, getPlayerItemAppearanceAssetData, type AssetData } from '../constants/Assets';
import { ItemTypes, getItemById, type EquipmentSlot, type InventoryItem } from '../constants/Items';
import { Gender } from '../Types';
import { HBSpriteFile } from '../game/assets/HBSprite';
import { enqueueSpriteDecode, fetchGameAssetArrayBuffer } from './SpriteHttpLoader';
import { settleAppearanceSheetIndices } from './itemAppearanceSheets';

const PREFETCH_EQUIPMENT_SLOTS: EquipmentSlot[] = [
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

const playerItemAppearanceLoadPromises = new Map<string, Promise<void>>();
const playerItemAssetLoadPromises = new Map<string, Promise<void>>();

/** Docs/assert alias. Clothes 0–3; weapons idle peace+combat 0–15 via {@link settleAppearanceSheetIndices}. */
export const SETTLE_APPEARANCE_SHEETS = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

/** False during map first-paint / brief stand so 9 equipped packs cannot join tile GC. */
let playerItemAppearanceDecodeAllowed = false;

export function setPlayerItemAppearanceDecodeAllowed(allowed: boolean): void {
    playerItemAppearanceDecodeAllowed = allowed;
}

export function isPlayerItemAppearanceDecodeAllowed(): boolean {
    return playerItemAppearanceDecodeAllowed;
}

/** True when equipped item appearance sprites should be fetched lazily. */
export function shouldLoadPlayerItemAppearanceOnDemand(): boolean {
    return LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND;
}

/**
 * Gender-resolved equipped appearance basenames for standard gear slots (matches
 * `PlayerAppearanceManager.resolveGearFromEquippedItems`).
 */
export function collectEquippedItemAppearanceSpriteBasenamesForPrefetch(
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
    gender: Gender,
): string[] {
    const out: string[] = [];
    for (const slot of PREFETCH_EQUIPMENT_SLOTS) {
        const inv = equippedItems[slot];
        if (!inv) {
            continue;
        }
        const def = getItemById(inv.itemId);
        if (!def) {
            continue;
        }
        const basename = gender === Gender.MALE ? def.equippedSpriteMale : def.equippedSpriteFemale;
        if (basename) {
            out.push(basename);
        }
    }
    return [...new Set(out)];
}

/** True while any settle/idle appearance decode for this basename is queued. */
export function isPlayerItemAppearanceLoadInFlight(spriteName: string): boolean {
    for (const key of playerItemAppearanceLoadPromises.keys()) {
        if (key === spriteName || key.startsWith(`${spriteName}:`)) {
            return true;
        }
    }
    return false;
}

/**
 * True when every settle sheet for this basename is registered (not merely sheet 0).
 * Paper-doll may decode only idle-south (0); world stand defaults to combat idle (1).
 */
export function arePlayerItemAppearanceLoaded(
    scene: PhaserSceneLike,
    spriteName: string,
    options?: { packBase?: number },
): boolean {
    const sheets = settleAppearanceSheetIndices(spriteName, options);
    if (!arePlayerItemAppearanceSheetsLoaded(scene, spriteName, sheets)) {
        return false;
    }
    return !isPlayerItemAppearanceLoadInFlight(spriteName);
}

/**
 * True when {@link GameAsset} should use the pending placeholder at construction instead of a concrete sheet texture.
 */
export function isPlayerItemAppearanceLazyEligible(scene: PhaserSceneLike, spriteName: string): boolean {
    return (
        LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND &&
        getItemEquippedAppearanceSpriteNames().has(spriteName) &&
        !arePlayerItemAppearanceLoaded(scene, spriteName)
    );
}

export interface LoadPlayerItemAppearanceOptions {
    /** Local sheet indexes to decode. Defaults to {@link settleAppearanceSheetIndices}. */
    sheetIndices?: ReadonlySet<number>;
    /** Weapon/shield `startSpriteSheetIndex`. Clothes omit (0). */
    packBase?: number;
}

/** Fetches and registers equipped item appearance sheets (idle by default). */
export function loadPlayerItemAppearanceOnDemand(
    scene: PhaserSceneLike,
    spriteName: string,
    options?: LoadPlayerItemAppearanceOptions,
): Promise<void> {
    if (!LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND || !playerItemAppearanceDecodeAllowed) {
        return Promise.resolve();
    }
    const sheetIndices =
        options?.sheetIndices ?? settleAppearanceSheetIndices(spriteName, { packBase: options?.packBase });
    if (arePlayerItemAppearanceSheetsLoaded(scene, spriteName, sheetIndices)) {
        return Promise.resolve();
    }

    const promiseKey = `${spriteName}:${[...sheetIndices].sort((a, b) => a - b).join(',')}`;
    const existing = playerItemAppearanceLoadPromises.get(promiseKey);
    if (existing) {
        return existing;
    }

    console.log(`[PlayerItemAppearanceLoader] Starting fetch for '${spriteName}' sheets ${promiseKey}`);

    const promise = loadPlayerItemAppearanceAssets(scene, spriteName, sheetIndices)
        .then(() => {
            console.log(`[PlayerItemAppearanceLoader] Loaded item appearance ${spriteName}`);
        })
        .catch((error) => {
            throw error;
        })
        .finally(() => {
            playerItemAppearanceLoadPromises.delete(promiseKey);
        });

    playerItemAppearanceLoadPromises.set(promiseKey, promise);
    return promise;
}

/** True when every requested local sheet exists as `sprite-{name}-{n}`. */
export function arePlayerItemAppearanceSheetsLoaded(
    scene: PhaserSceneLike,
    spriteName: string,
    sheetIndices: ReadonlySet<number>,
): boolean {
    const asset = getPlayerItemAppearanceAssetData(spriteName);
    if (asset.assetType !== AssetType.SPRITE) {
        return false;
    }
    for (const sheet of sheetIndices) {
        if (!scene.textures.exists(`${asset.key}-${sheet}`)) {
            return false;
        }
    }
    return true;
}

async function loadPlayerItemAppearanceAssets(
    scene: PhaserSceneLike,
    spriteName: string,
    sheetIndices: ReadonlySet<number>,
): Promise<void> {
    const asset = getPlayerItemAppearanceAssetData(spriteName);
    if (asset.assetType !== AssetType.SPRITE) {
        return;
    }
    if (arePlayerItemAppearanceSheetsLoaded(scene, spriteName, sheetIndices)) {
        return;
    }

    const startedAt = performance.now();
    await loadAssetOnce(scene, asset, sheetIndices);
    console.log(
        `[PlayerItemAppearanceLoader] Registered ${asset.fileName} in ${(performance.now() - startedAt).toFixed(2)}ms`,
    );
}

function loadAssetOnce(scene: PhaserSceneLike, asset: AssetData, sheetIndices: ReadonlySet<number>): Promise<void> {
    const loadKey = `${asset.assetType}:${asset.key}:${[...sheetIndices].sort((a, b) => a - b).join(',')}`;
    const existing = playerItemAssetLoadPromises.get(loadKey);
    if (existing) {
        return existing;
    }

    const promise = fetchAndRegisterPlayerItemSprite(scene, asset, sheetIndices);
    playerItemAssetLoadPromises.set(loadKey, promise);
    return promise.catch((error) => {
        playerItemAssetLoadPromises.delete(loadKey);
        throw error;
    });
}

async function fetchAndRegisterPlayerItemSprite(
    scene: PhaserSceneLike,
    asset: AssetData,
    sheetIndices: ReadonlySet<number>,
): Promise<void> {
    if (!asset.spriteType) {
        throw new Error(`Player item appearance asset ${asset.key} is missing spriteType`);
    }
    const spriteType = asset.spriteType;
    const missing = [...sheetIndices].filter((index) => !scene.textures.exists(`${asset.key}-${index}`));
    if (missing.length === 0) {
        return;
    }

    await enqueueSpriteDecode(async () => {
        const stillMissing = missing.filter((index) => !scene.textures.exists(`${asset.key}-${index}`));
        if (stillMissing.length === 0) {
            return;
        }
        if (!scene.cache.binary.exists(asset.key)) {
            const arrayBuffer = await fetchGameAssetArrayBuffer('sprites', asset.fileName);
            scene.cache.binary.add(asset.key, arrayBuffer);
        }

        const hbFile = new HBSpriteFile(asset.key, spriteType, false, asset.tileStartIndex);
        await hbFile.load(scene, { sheetIndices: new Set(stillMissing) });
    });
}
