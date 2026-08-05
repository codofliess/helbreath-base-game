import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { PoisonCloudInstance } from './PoisonCloudInstance';
import type { Effect } from '../effects/Effect';

export type PoisonCloudConfig = {
    /** Duration in milliseconds each poison cloud instance lasts (default: 30000) */
    duration?: number;
    /**
     * Radius in cells from center (Olympia Magic.cfg m_sValue12).
     * Poison Cloud = 1 (3×3), Cloud Kill = 2 (5×5).
     */
    radius?: number;
    /** Called when each effect is created. Returns onDestroy to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

/**
 * Poison Cloud / Cloud Kill ground field. One large cloud VFX per cell (Olympia PCLOUD).
 */
export class PoisonCloud {
    private instances: PoisonCloudInstance[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: PoisonCloudConfig,
    ) {
        const targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        const duration = config.duration ?? 30000;
        const fieldRadius = Math.max(0, config.radius ?? 1);

        for (let dy = -fieldRadius; dy <= fieldRadius; dy++) {
            for (let dx = -fieldRadius; dx <= fieldRadius; dx++) {
                const wx = targetWorldX + dx;
                const wy = targetWorldY + dy;
                const pixelX = convertWorldPosToPixelPos(wx) + TILE_SIZE / 2;
                const pixelY = convertWorldPosToPixelPos(wy) + TILE_SIZE / 2;

                const instance = new PoisonCloudInstance(scene, pixelX, pixelY, {
                    duration,
                    onEffectCreated: config.onEffectCreated,
                });
                this.instances.push(instance);
            }
        }
    }

    public destroy(): void {
        for (const instance of this.instances) {
            instance.destroy();
        }
        this.instances = [];
    }
}