import type { Scene } from 'phaser';
import { EventBus } from '../game/EventBus';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../constants/EventNames';
import { parseSpriteFrameKey } from './spriteFrameKey';

/**
 * One Phaser texture frame → PNG data URL. Does not walk the rest of the sheet.
 */
export function extractSpriteFrameDataUrl(
    scene: Scene,
    mapKey: string,
    emit = true,
): string | undefined {
    const parsed = parseSpriteFrameKey(mapKey);
    if (!parsed) {
        return undefined;
    }
    if (!scene.textures?.exists(parsed.textureKey)) {
        return undefined;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const texture = scene.textures.get(parsed.textureKey) as any;
        let fr = texture.get?.(parsed.frameIndex);
        if (!fr || fr.cutWidth <= 0) {
            fr = texture.get?.(0);
        }
        if (!fr || fr.cutWidth <= 0) {
            return undefined;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, fr.cutWidth);
        canvas.height = Math.max(1, fr.cutHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return undefined;
        }
        ctx.imageSmoothingEnabled = false;
        const source = texture.getSourceImage?.() as CanvasImageSource | undefined;
        if (!source) {
            return undefined;
        }
        ctx.drawImage(source, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
        if (parsed.tintHex) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.fillStyle = `#${parsed.tintHex}`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.drawImage(source, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
            ctx.globalCompositeOperation = 'source-over';
        }
        const dataUrl = canvas.toDataURL('image/png');
        if (emit) {
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, mapKey, dataUrl);
        }
        return dataUrl;
    } catch {
        return undefined;
    }
}
