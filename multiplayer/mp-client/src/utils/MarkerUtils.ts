import type { Scene } from 'phaser';
import { FloatingText, formatOlympiaDamageChain } from '../game/effects/FloatingText';
import { OLYMPIA_FLOATING_TEXT_COLORS } from '../constants/OlympiaTypography';

/**
 * Pixel anchor for floating physical damage numbers (e.g. server monster hits).
 */
export type PhysicalDamageMarkerPosition = {
    x: number;
    y: number;
};

/**
 * Spawns an Olympia-style floating damage number (`-45` / `-45!`) at the given screen position.
 */
export function createPhysicalDamageMarker(
    scene: Scene,
    position: PhysicalDamageMarkerPosition,
    damageDealt: number,
    critical = false,
): void {
    const amount = Math.abs(Math.round(damageDealt));
    if (amount <= 0) {
        return;
    }
    new FloatingText(scene, {
        text: formatOlympiaDamageChain([amount], 'dealt', critical),
        x: position.x,
        y: position.y,
        fontSize: 16,
        color: OLYMPIA_FLOATING_TEXT_COLORS.damageDealt,
        bold: true,
        horizontalOffset: -2,
        upwardTravelPxPerSec: 28,
        totalDurationMs: 2200,
        fadeDurationMs: 1100,
    });
}
