import type { Scene } from 'phaser';

import { LOAD_ITEM_ICON_ASSETS_ON_DEMAND } from '../Config';
import { AssetType, type AssetData } from '../constants/Assets';
import { GROUND_ITEM_DISPLAY_CONFIG, type GroundItemDisplaySize } from '../constants/GroundItemDisplay';
import {
    getDroppedItemSpriteIndex,
    getItemById,
    getItemSheetIndex,
    type InventoryItem,
} from '../constants/Items';
import { SpriteType } from '../game/assets/HBSprite';
import { Gender } from '../Types';
import { collectItemIconSheetIndices } from './itemIconSheets';
import { areSpriteSheetsPresent, loadSpriteSheetsOnDemand } from './SpriteHttpLoader';

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

export interface ItemIconSheetRequest {
    /** item-pack.spr local sheets (bag / jewelry / medium-large ground). */
    packSheets?: readonly number[];
    /** item-ground.spr local sheets (small ground piles only). */
    groundSheets?: readonly number[];
}

/** True when bag/ground item sheets wait until bag open or a pile is in view. */
export function shouldLoadItemIconAssetsOnDemand(): boolean {
    return LOAD_ITEM_ICON_ASSETS_ON_DEMAND;
}

export function collectItemPackSheetsForItems(
    items: ReadonlyArray<{ itemId: number } | InventoryItem | null | undefined>,
    gender: Gender,
): number[] {
    return collectItemIconSheetIndices(
        items.map((item) => {
            if (!item) {
                return undefined;
            }
            const def = getItemById(item.itemId);
            if (!def) {
                return undefined;
            }
            return { sheetIndex: getItemSheetIndex(def, gender) };
        }),
    );
}

export function groundItemIconSheets(
    itemId: number,
    gender: Gender,
    displaySize: GroundItemDisplaySize,
): ItemIconSheetRequest {
    const def = getItemById(itemId);
    if (!def) {
        return {};
    }
    const sheetIndex = getItemSheetIndex(def, gender);
    const spriteIndex = getDroppedItemSpriteIndex(def, gender);
    if (sheetIndex === undefined || spriteIndex === undefined) {
        return {};
    }
    const prefix = GROUND_ITEM_DISPLAY_CONFIG[displaySize].spritePrefix;
    if (prefix === 'item-ground') {
        return { groundSheets: [sheetIndex] };
    }
    return { packSheets: [sheetIndex] };
}

export function areItemIconSheetsReady(scene: Scene, request: ItemIconSheetRequest): boolean {
    const pack = request.packSheets ?? [];
    const ground = request.groundSheets ?? [];
    return (
        (pack.length === 0 || areSpriteSheetsPresent(scene, ITEM_PACK.key, pack)) &&
        (ground.length === 0 || areSpriteSheetsPresent(scene, ITEM_GROUND.key, ground))
    );
}

/**
 * @deprecated Presence of *every* pack+ground sheet. F5/F6 must use {@link areItemIconSheetsReady}.
 */
export function areItemIconAssetsLoaded(scene: Scene): boolean {
    return areSpriteSheetsPresent(scene, ITEM_PACK.key, [0]) && areSpriteSheetsPresent(scene, ITEM_GROUND.key, [0]);
}

/**
 * Registers only the requested item-pack / item-ground sheets. Empty request is a no-op
 * (F5 Char must never decode the full bag). Never dumps frames as data URLs.
 */
export function loadItemIconAssetsOnDemand(scene: Scene, request: ItemIconSheetRequest = {}): Promise<void> {
    if (!LOAD_ITEM_ICON_ASSETS_ON_DEMAND) {
        return Promise.resolve();
    }
    const packSheets = collectItemIconSheetIndices((request.packSheets ?? []).map((sheetIndex) => ({ sheetIndex })));
    const groundSheets = collectItemIconSheetIndices(
        (request.groundSheets ?? []).map((sheetIndex) => ({ sheetIndex })),
    );
    if (packSheets.length === 0 && groundSheets.length === 0) {
        return Promise.resolve();
    }
    if (areItemIconSheetsReady(scene, { packSheets, groundSheets })) {
        return Promise.resolve();
    }

    return (async () => {
        if (packSheets.length > 0) {
            await loadSpriteSheetsOnDemand(scene, ITEM_PACK, packSheets);
        }
        if (groundSheets.length > 0) {
            await loadSpriteSheetsOnDemand(scene, ITEM_GROUND, groundSheets);
        }
    })();
}
