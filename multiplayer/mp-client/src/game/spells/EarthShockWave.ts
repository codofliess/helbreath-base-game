import type { Scene } from 'phaser';
import { EarthShockWaveTorrent } from './EarthShockWaveTorrent';
import type { EarthShockWaveTorrentConfig } from './EarthShockWaveTorrent';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import type { CameraManager } from '../../utils/CameraManager';

export type EarthShockWaveConfig = {
    /** Milliseconds for how long the projectile stays at destination emitting before destroying */
    duration: number;
    /** Projectile speed in pixels per second */
    projectileSpeed: number;
    /** Interval in milliseconds between torrent emissions while moving */
    emissionInterval: number;
    /** Interval in milliseconds between torrent emissions when projectile has reached target */
    immobileEmissionInterval: number;
    /** Camera manager for shake effect when projectile reaches destination */
    cameraManager?: CameraManager;
};

/**
 * Earth Shock Wave: ground torrent wave from the caster's **feet** toward the target
 * (same origin family as BloodyShockWave — not chest offset). Emits torrents along
 * the path; at destination stays immobile and keeps emitting for `duration`.
 */
export class EarthShockWave {
    private scene: Scene;
    private config: EarthShockWaveConfig;
    private torrentConfig: EarthShockWaveTorrentConfig;
    private originPixelX: number;
    private originPixelY: number;
    private destPixelX: number;
    private destPixelY: number;

    private startTime: number = 0;
    private emissionTimer: Phaser.Time.TimerEvent | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private travelTimeMs: number = 0;
    private hasTriggeredCameraShake = false;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        cursorPixelX: number,
        cursorPixelY: number,
        projectileConfig: EarthShockWaveConfig,
        torrentConfig: EarthShockWaveTorrentConfig
    ) {
        this.scene = scene;
        this.config = projectileConfig;
        this.torrentConfig = torrentConfig;

        const destCellX = convertPixelPosToWorldPos(cursorPixelX);
        const destCellY = convertPixelPosToWorldPos(cursorPixelY);
        this.destPixelX = convertWorldPosToPixelPos(destCellX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(destCellY) + TILE_SIZE / 2;

        // Ground wave from feet (cell center from CastManager). Nudge toward target so the
        // first torrent sits in front of the caster (same fix family as BloodyShockWave).
        const dx = this.destPixelX - originPixelX;
        const dy = this.destPixelY - originPixelY;
        const len = Math.hypot(dx, dy) || 1;
        const FOOT_FORWARD_PX = 14;
        this.originPixelX = originPixelX + (dx / len) * FOOT_FORWARD_PX;
        this.originPixelY = originPixelY + (dy / len) * FOOT_FORWARD_PX;

        const distancePx = Phaser.Math.Distance.Between(
            originPixelX,
            originPixelY,
            this.destPixelX,
            this.destPixelY
        );
        this.travelTimeMs = distancePx > 0 ? (distancePx / projectileConfig.projectileSpeed) * 1000 : 0;

        this.startTime = this.scene.time.now;

        this.emitTorrent();
        this.scheduleNextEmission();

        const totalLifetimeMs = this.travelTimeMs + projectileConfig.duration;
        this.destroyTimer = this.scene.time.delayedCall(totalLifetimeMs, () => {
            this.destroy();
        });
    }

    private emitTorrent(): void {
        const elapsed = this.scene.time.now - this.startTime;
        let pixelX: number;
        let pixelY: number;

        if (elapsed >= this.travelTimeMs) {
            pixelX = this.destPixelX;
            pixelY = this.destPixelY;
            if (!this.hasTriggeredCameraShake) {
                this.hasTriggeredCameraShake = true;
                this.config.cameraManager?.setCameraShake(pixelX, pixelY);
            }
        } else {
            const t = this.travelTimeMs > 0 ? elapsed / this.travelTimeMs : 1;
            pixelX = this.originPixelX + (this.destPixelX - this.originPixelX) * t;
            pixelY = this.originPixelY + (this.destPixelY - this.originPixelY) * t;
        }

        new EarthShockWaveTorrent(this.scene, pixelX, pixelY, this.torrentConfig);
    }

    private scheduleNextEmission(): void {
        const elapsed = this.scene.time.now - this.startTime;
        const atDestination = elapsed >= this.travelTimeMs;
        const interval = atDestination ? this.config.immobileEmissionInterval : this.config.emissionInterval;

        this.emissionTimer = this.scene.time.delayedCall(interval, () => {
            this.emitTorrent();
            this.scheduleNextEmission();
        });
    }

    public destroy(): void {
        this.emissionTimer?.destroy();
        this.emissionTimer = undefined;
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
    }
}
