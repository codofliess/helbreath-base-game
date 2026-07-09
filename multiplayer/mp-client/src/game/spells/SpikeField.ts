import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { SpikeFieldInstance } from './SpikeFieldInstance';
import type { Effect } from '../effects/Effect';

/** Radius in cells from center (2 = 5x5 area) */
const FIELD_RADIUS = 2;

export type SpikeFieldServerConfig = {
    /** Called when each effect is created. Returns onDestroy to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

export type SpikeFieldConfig = SpikeFieldServerConfig & {
    /** Duration in milliseconds each spike field instance lasts (default: 30000) */
    duration?: number;
};

/**
 * Creates one server-authoritative Spike Field ground-effect instance.
 */
export function createSpikeField(
    scene: Scene,
    pixelX: number,
    pixelY: number,
    config: SpikeFieldServerConfig = {},
): SpikeFieldInstance {
    return new SpikeFieldInstance(scene, pixelX, pixelY, {
        onEffectCreated: config.onEffectCreated,
    });
}

/**
 * Spike Field spell (client-side Olympia cast). Creates a 5x5 field centered on the target.
 */
export class SpikeField {
    private instances: SpikeFieldInstance[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: SpikeFieldConfig,
    ) {
        const targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        const duration = config.duration ?? 30000;

        for (let dy = -FIELD_RADIUS; dy <= FIELD_RADIUS; dy++) {
            for (let dx = -FIELD_RADIUS; dx <= FIELD_RADIUS; dx++) {
                const wx = targetWorldX + dx;
                const wy = targetWorldY + dy;
                const pixelX = convertWorldPosToPixelPos(wx) + TILE_SIZE / 2;
                const pixelY = convertWorldPosToPixelPos(wy) + TILE_SIZE / 2;

                const instance = new SpikeFieldInstance(scene, pixelX, pixelY, {
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