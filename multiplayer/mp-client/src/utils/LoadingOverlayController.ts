import type { Scene } from 'phaser';
import { FRAMES_UNTIL_OVERLAY_REMOVAL, LOADING_OVERLAY_DEPTH, LOADING_TEXT_DEPTH } from '../Config';

/**
 * Owns the full-screen loading overlay and "Loading map..." text used during initial map load.
 * GameWorld drives frame countdown via {@link tickRemovalCountdown}.
 */
export class LoadingOverlayController {
    private loadingOverlay: Phaser.GameObjects.Rectangle | undefined = undefined;
    private loadingText: Phaser.GameObjects.Text | undefined = undefined;
    private framesUntilOverlayRemoval = 0;
    /** Opaque cover while a same-map respawn/teleport rebuilds the streamed view. */
    private jumpCover: Phaser.GameObjects.Rectangle | undefined = undefined;
    private jumpText: Phaser.GameObjects.Text | undefined = undefined;
    private jumpCoverFading = false;

    public constructor(private readonly scene: Scene) {}

    public getOverlay(): Phaser.GameObjects.Rectangle | undefined {
        return this.loadingOverlay;
    }

    public getText(): Phaser.GameObjects.Text | undefined {
        return this.loadingText;
    }

    /** Initial map load or a respawn/teleport cover is on screen (including its fade). */
    public isBlockingPointer(): boolean {
        return this.loadingOverlay !== undefined || this.jumpCover !== undefined;
    }

    /**
     * Brings overlay and label to top of the scene display list (call each frame while visible).
     */
    public bringToTop(): void {
        if (this.loadingOverlay && this.loadingText) {
            this.scene.children.bringToTop(this.loadingOverlay);
            this.scene.children.bringToTop(this.loadingText);
        }
        if (this.jumpCover) {
            this.scene.children.bringToTop(this.jumpCover);
        }
        if (this.jumpText) {
            this.scene.children.bringToTop(this.jumpText);
        }
    }

    /**
     * Decrements removal countdown; destroys overlay when it reaches zero.
     */
    public tickRemovalCountdown(): void {
        if (this.framesUntilOverlayRemoval > 0) {
            this.framesUntilOverlayRemoval--;
            if (this.framesUntilOverlayRemoval === 0) {
                if (this.loadingOverlay) {
                    this.loadingOverlay.destroy();
                    this.loadingOverlay = undefined;
                }
                if (this.loadingText) {
                    this.loadingText.destroy();
                    this.loadingText = undefined;
                }
            }
        }
    }

    /**
     * After minimap snapshot and camera zoom, defer overlay removal by {@link FRAMES_UNTIL_OVERLAY_REMOVAL}.
     */
    public scheduleRemovalAfterMapReady(): void {
        this.framesUntilOverlayRemoval = FRAMES_UNTIL_OVERLAY_REMOVAL;
    }

    /**
     * Creates black overlay + text, then runs `callback` on the next frame so the first paint shows loading.
     */
    public drawAndDeferLoad(callback: () => void): void {
        this.loadingOverlay = this.scene.add.rectangle(
            this.scene.scale.width / 2,
            this.scene.scale.height / 2,
            this.scene.scale.width,
            this.scene.scale.height,
            0x000000,
            1.0
        );
        this.loadingOverlay.setScrollFactor(0, 0);
        this.loadingOverlay.setDepth(LOADING_OVERLAY_DEPTH);

        this.loadingText = this.scene.add.text(
            this.scene.scale.width / 2,
            this.scene.scale.height / 2,
            'Loading map...',
            {
                fontFamily: 'Tahoma, MS Sans Serif, Segoe UI, sans-serif',
                fontSize: '20px',
                color: '#f4e4c1',
                fontStyle: 'bold',
            }
        );
        this.loadingText.setOrigin(0.5, 0.5);
        this.loadingText.setShadow(1, 1, '#1a0f0a', 2, true);
        this.loadingText.setScrollFactor(0, 0);
        this.loadingText.setDepth(LOADING_TEXT_DEPTH);

        this.scene.time.delayedCall(0, callback);
    }

    /**
     * Full-screen cover shown before the camera jumps to a respawn or teleport.
     * Opaque immediately so the empty plaza and its sprites never paint. The
     * initial "Loading map..." overlay already covers the screen, so this no-ops then.
     */
    public showJumpCover(): void {
        if (this.loadingOverlay) {
            return;
        }
        this.destroyJumpCover();
        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        this.jumpCover = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1);
        this.jumpCover.setScrollFactor(0, 0);
        this.jumpCover.setDepth(LOADING_OVERLAY_DEPTH);
        this.jumpText = this.scene.add.text(width / 2, height / 2, 'Loading map...', {
            fontFamily: 'Tahoma, MS Sans Serif, Segoe UI, sans-serif',
            fontSize: '20px',
            color: '#f4e4c1',
            fontStyle: 'bold',
        });
        this.jumpText.setOrigin(0.5, 0.5);
        this.jumpText.setShadow(1, 1, '#1a0f0a', 2, true);
        this.jumpText.setScrollFactor(0, 0);
        this.jumpText.setDepth(LOADING_TEXT_DEPTH);
        this.jumpCoverFading = false;
    }

    /**
     * Fades the jump cover out once the tiles around the player are painted.
     * A second call while the fade is running does nothing.
     */
    public fadeJumpCover(durationMs = 220): void {
        const cover = this.jumpCover;
        if (!cover || this.jumpCoverFading) {
            return;
        }
        this.jumpCoverFading = true;
        const text = this.jumpText;
        this.scene.tweens.add({
            targets: text ? [cover, text] : cover,
            alpha: 0,
            duration: Math.max(0, durationMs),
            onComplete: () => {
                this.destroyJumpCover();
            },
        });
    }

    public destroyImmediate(): void {
        if (this.loadingOverlay) {
            this.loadingOverlay.destroy();
            this.loadingOverlay = undefined;
        }
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = undefined;
        }
        this.framesUntilOverlayRemoval = 0;
        this.destroyJumpCover();
    }

    private destroyJumpCover(): void {
        if (this.jumpCover) {
            this.scene.tweens.killTweensOf(this.jumpCover);
            this.jumpCover.destroy();
            this.jumpCover = undefined;
        }
        if (this.jumpText) {
            this.scene.tweens.killTweensOf(this.jumpText);
            this.jumpText.destroy();
            this.jumpText = undefined;
        }
        this.jumpCoverFading = false;
    }
}
