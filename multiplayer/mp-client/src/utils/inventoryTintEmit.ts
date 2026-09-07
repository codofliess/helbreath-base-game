import type { PhaserGameLike } from '../game/phaserHubTypes';
import { getItemPackEmittedTintKeys, getItemPackSpriteSheets } from './RegistryUtils';

/** Tint item-pack frames for bag icons without importing Phaser SpriteUtils/WebGL. */
export function emitTintedInventorySpriteIfNeeded(
    game: PhaserGameLike,
    sheetIndex: number,
    spriteIndex: number,
    effectColor: number,
): void {
    const spriteSheets = getItemPackSpriteSheets(game);
    if (!spriteSheets?.length) {
        return;
    }

    const effectColorHex = effectColor.toString(16).padStart(6, '0');
    const tintKey = `sprite-item-pack-${sheetIndex}-${spriteIndex}-${effectColorHex}`;

    const emitted = getItemPackEmittedTintKeys(game);
    if (emitted?.has(tintKey)) {
        return;
    }

    const sheet = spriteSheets[sheetIndex];
    if (!sheet) {
        return;
    }

    if (sheet.emitTintedFrameForSprite(spriteIndex, effectColor)) {
        emitted?.add(tintKey);
    }
}
