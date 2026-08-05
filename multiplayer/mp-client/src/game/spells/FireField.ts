import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { FireInstance } from './FireInstance';
import type { Effect } from '../effects/Effect';

export type FireFieldConfig = {
    /**
     * Radius in cells from center (Olympia Magic.cfg m_sValue12 for field-type).
     * Fire Field value12=1 → 3×3 (radius 1). Server Spells.json aoeRadius must match.
     */
    radius?: number;
    onEffectCreated?: (effect: Effect) => () => void;
};

/**
 * Fire Field: square ground fire (Olympia DYNAMIC field type), not a wall line.
 */
export class FireField {
    private instances: FireInstance[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: FireFieldConfig = {},
    ) {
        const targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        const fieldRadius = Math.max(0, config.radius ?? 1);

        for (let dy = -fieldRadius; dy <= fieldRadius; dy++) {
            for (let dx = -fieldRadius; dx <= fieldRadius; dx++) {
                const wx = targetWorldX + dx;
                const wy = targetWorldY + dy;
                const pixelX = convertWorldPosToPixelPos(wx) + TILE_SIZE / 2;
                const pixelY = convertWorldPosToPixelPos(wy) + TILE_SIZE / 2;
                this.instances.push(
                    new FireInstance(scene, pixelX, pixelY, {
                        onEffectCreated: config.onEffectCreated,
                    }),
                );
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
