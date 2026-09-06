import type { Scene } from 'phaser';

import { ASSETS, AssetType, type AssetData } from '../constants/Assets';
import { SpriteType } from '../game/assets/HBSprite';
import { extractSpriteFrameDataUrl } from './extractSpriteFrame';
import { loadItemIconAssetsOnDemand } from './ItemIconAssets';
import { uniqueSheetIndicesForAsset } from './spriteFrameKey';
import { loadSpriteSheetsOnDemand } from './SpriteHttpLoader';

function interfaceAsset(key: string, fileName: string): AssetData {
    const row = ASSETS.find((a) => a.key === key && a.assetType === AssetType.SPRITE);
    if (row) {
        return { ...row, exportFramesAsDataUrls: false };
    }
    return {
        key,
        fileName,
        assetType: AssetType.SPRITE,
        spriteType: SpriteType.Interface,
        exportFramesAsDataUrls: false,
    };
}

const INTERFACE_FILES: Record<string, string> = {
    'sprite-interface': 'interface.spr',
    'sprite-interface2': 'interface2.spr',
    'sprite-gamedialog2': 'gamedialog2.spr',
    'sprite-dialogtext': 'dialogtext.spr',
};

/**
 * Load only the sheets named by `keys`, then extract those frames (not the rest of the pack).
 */
export async function ensureNamedSpriteFrames(scene: Scene, keys: readonly string[]): Promise<void> {
    const unique = [...new Set(keys.filter((key) => typeof key === 'string' && key.length > 0))];
    if (unique.length === 0) {
        return;
    }

    const packSheets = uniqueSheetIndicesForAsset(unique, 'sprite-item-pack');
    const groundSheets = uniqueSheetIndicesForAsset(unique, 'sprite-item-ground');
    if (packSheets.length > 0 || groundSheets.length > 0) {
        await loadItemIconAssetsOnDemand(scene, { packSheets, groundSheets });
    }

    for (const [assetKey, fileName] of Object.entries(INTERFACE_FILES)) {
        const sheets = uniqueSheetIndicesForAsset(unique, assetKey);
        if (sheets.length === 0) {
            continue;
        }
        try {
            await loadSpriteSheetsOnDemand(scene, interfaceAsset(assetKey, fileName), sheets);
        } catch (error) {
            console.warn(`[uiSpriteFrames] skipped ${fileName} sheets ${sheets.join(',')}`, error);
        }
    }

    for (const key of unique) {
        extractSpriteFrameDataUrl(scene, key, true);
    }
}
