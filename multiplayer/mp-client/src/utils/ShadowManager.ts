import type { Scene, GameObjects } from 'phaser';
import type { PivotFrame } from '../Types';
import { worldCellCenterPixelX, worldCellCenterPixelY } from './CoordinateUtils';
import { rasterizeOlympiaBodyShadow } from './olympiaBodyShadow';
import { isWorldCanvasImageSource } from './pendingAppearanceTexture';
import { getPivotData } from './RegistryUtils';
import { isSafeDrawableTexture } from './worldCanvasTextureSafety';

const OLYMPIA_SHADOW_BLANK_KEY = 'olympia-body-shadow-blank';

type BakedOlympiaShadow = {
    originX: number;
    originY: number;
};

/** Shared across players. The texture itself lives on the scene that first baked it. */
const bakedOlympiaShadows = new Map<string, BakedOlympiaShadow>();

/**
 * Configuration for creating a shadow sprite.
 */
export type ShadowConfig = {
    /** The Phaser scene */
    scene: Scene;

    /** The sprite name to use for the shadow (e.g., 'wm' for wm.spr) */
    shadowSpriteName: string;

    /** The sprite sheet index to use for the shadow */
    shadowSpriteSheetIndex: number;

    /** Initial X position in world coordinates */
    worldX: number;

    /** Initial Y position in world coordinates */
    worldY: number;

    /** Optional pixel offset X */
    offsetX?: number;

    /** Optional pixel offset Y */
    offsetY?: number;

    /** Frame rate for shadow animation (default: 10) */
    frameRate?: number;

    /** Map decals: texture key is the basename `spriteName` (no `sprite-*` prefix). */
    mapObject?: boolean;

    /** Specific frame index to display for static shadows (for map objects) */
    frameIndex?: number;

    /**
     * Player body shadow. Uses Olympia `PutShadowSprite` (sheared ground darken of the
     * naked body) instead of a rotated black copy of that sprite.
     */
    olympiaBodyShadow?: boolean;
};

/**
 * Manages shadow sprite rendering for game objects.
 * Handles shadow creation, position updates, depth management, and animation.
 */
export class ShadowManager {
    /** The shadow sprite rendered beneath the object */
    private shadowSprite: GameObjects.Sprite | undefined = undefined;

    /** Pivot data for the shadow sprite */
    private shadowPivotData: PivotFrame[] | undefined;

    /** The Phaser scene */
    private scene: Scene;

    /** The shadow sprite name */
    private shadowSpriteName: string;

    /** Current shadow sprite sheet index */
    private shadowSpriteSheetIndex: number;

    /** Current world X position */
    private worldX: number;

    /** Current world Y position */
    private worldY: number;

    /** Current pixel offset X */
    private offsetX = 0;

    /** Current pixel offset Y */
    private offsetY = 0;

    /** Frame rate for shadow animation */
    private frameRate = 10;

    /** Whether this is a map object */
    private mapObject = false;

    /** Specific frame index for static shadows (map objects) */
    private frameIndex?: number;

    /**
     * When set, the visible shadow is a ground darken. `frameSprite` plays the body
     * animation off-screen so the pose stays on the same frame as the old shadow clock.
     */
    private olympiaBodyShadow = false;

    /** Hidden body-frame clock. Never shown — showing it is the bald-body ghost. */
    private frameSprite: GameObjects.Sprite | undefined = undefined;

    /** Anchor-space origin of the current Olympia shadow canvas. */
    private olympiaOriginX = 0;

    private olympiaOriginY = 0;

    /** Caller alpha (0 hides, 1 shows the baked 75% darken). */
    private requestedAlpha = 1;

    /** Last baked texture key, so a repeated frame tick does not re-read pixels. */
    private lastOlympiaKey = '';

    /**
     * Creates a new ShadowManager instance.
     * 
     * @param config - Configuration for shadow creation
     */
    constructor(config: ShadowConfig) {
        this.scene = config.scene;
        this.shadowSpriteName = config.shadowSpriteName;
        this.shadowSpriteSheetIndex = config.shadowSpriteSheetIndex;
        this.worldX = config.worldX;
        this.worldY = config.worldY;
        this.offsetX = config.offsetX ?? 0;
        this.offsetY = config.offsetY ?? 0;
        this.frameRate = config.frameRate ?? 10;
        this.mapObject = config.mapObject ?? false;
        this.frameIndex = config.frameIndex;
        this.olympiaBodyShadow = config.olympiaBodyShadow ?? false;

        this.createShadow();
    }

    /**
     * Creates the shadow sprite.
     * Shadow uses the specified sprite with appropriate transformations.
     */
    private createShadow(): void {
        // Build texture key based on whether this is a map object
        let shadowTextureKey: string;
        let shadowAnimationKey: string;

        if (this.mapObject) {
            // Map object textures use `spriteName` as the Phaser texture key.
            shadowTextureKey = this.shadowSpriteName;
            shadowAnimationKey = this.shadowSpriteName;
        } else {
            // Standard sprite-sheet based lookup
            shadowTextureKey = `sprite-${this.shadowSpriteName}-${this.shadowSpriteSheetIndex}`;
            shadowAnimationKey = shadowTextureKey;
        }

        if (!isSafeDrawableTexture(this.scene, shadowTextureKey)) {
            console.warn(`[ShadowManager] Missing or unsafe texture ${shadowTextureKey}; skipping shadow`);
            return;
        }

        // Get pivot data for shadow sprite
        const pivotData = getPivotData(this.scene, shadowTextureKey, this.shadowSpriteName, this.mapObject);
        const pivotIndex = this.mapObject ? 0 : this.shadowSpriteSheetIndex;
        if (pivotData && pivotData.spriteSheetPivots[pivotIndex]) {
            this.shadowPivotData = pivotData.spriteSheetPivots[pivotIndex];
        }

        if (this.olympiaBodyShadow && !this.mapObject) {
            // The body texture stays on a hidden clock. The visible sprite is only the
            // sheared darken, so the naked body cannot draw behind the equipment.
            this.frameSprite = this.scene.add.sprite(0, 0, shadowTextureKey);
            this.frameSprite.setVisible(false);
            this.frameSprite.setAlpha(0);
            this.frameSprite.setDepth(-100000);
            this.shadowSprite = this.scene.add.sprite(0, 0, ensureOlympiaShadowBlank(this.scene));
            this.shadowSprite.setOrigin(0, 0);
            this.shadowSprite.setRotation(0);
            this.shadowSprite.setScale(1, 1);
            this.shadowSprite.setDepth(0);
            this.shadowSprite.setVisible(false);
            if (this.scene.anims.exists(shadowAnimationKey)) {
                this.frameSprite.play({
                    key: shadowAnimationKey,
                    frameRate: this.frameRate,
                });
                this.bindShadowFrameListener(this.frameSprite, undefined, undefined, undefined);
            }
            this.refreshOlympiaFrame();
            return;
        }

        // Create shadow sprite at initial position
        // For map objects, use specified frameIndex or frame 0 (static); for regular sprites, use texture key
        if (this.mapObject) {
            // Map objects: create static sprite with specified frameIndex or frame 0 (no animation)
            const staticFrameIndex = this.frameIndex ?? 0;
            this.shadowSprite = this.scene.add.sprite(0, 0, shadowTextureKey, staticFrameIndex);
        } else {
            // Regular sprites: create sprite that can be animated
            this.shadowSprite = this.scene.add.sprite(0, 0, shadowTextureKey);
        }

        // Set shadow origin to bottom-center
        // In Phaser: originX = 0.5 (center), originY = 1.0 (bottom)
        this.shadowSprite.setOrigin(0.5, 1.0);

        // Monsters and map decals still use the flattened black sprite.
        // Players pass olympiaBodyShadow and never take this path.
        this.shadowSprite.setRotation(-Math.PI / 4);
        this.shadowSprite.setScale(1.0, 0.5);
        this.shadowSprite.setAlpha(0.5);
        this.shadowSprite.setTint(0x000000);

        // Set depth to render below object (will be updated in updateDepth)
        this.shadowSprite.setDepth(0);

        // Play shadow animation only for non-map objects
        if (!this.mapObject && this.scene.anims.exists(shadowAnimationKey)) {
            this.shadowSprite.play({
                key: shadowAnimationKey,
                frameRate: this.frameRate
            });
        }

        // Initial position update
        this.updatePosition();
    }

    /** Sprite that advances the body (or monster) frames. Hidden when the Olympia darken is showing. */
    private animatedSprite(): GameObjects.Sprite | undefined {
        return this.frameSprite ?? this.shadowSprite;
    }

    /**
     * Updates the shadow to use a different sprite (e.g. when player gender changes).
     * Sets the sprite name and updates the animation to the given sheet index.
     */
    public updateShadowSprite(spriteName: string, shadowSpriteSheetIndex: number): void {
        this.shadowSpriteName = spriteName;
        this.updateAnimation(shadowSpriteSheetIndex);
    }

    /**
     * Updates the shadow sprite animation based on new sprite sheet index.
     * 
     * @param shadowSpriteSheetIndex - New sprite sheet index
     * @param frameRate - Optional frame rate (defaults to current frame rate)
     * @param repeat - Optional repeat count (0 = play once, undefined = loop)
     * @param startFrame - Optional starting frame index (animation range)
     * @param endFrame - Optional ending frame index (animation range)
     * @param playFromFrame - Optional frame to start playing from (keeps shadow in sync with object when switching animations)
     */
    public updateAnimation(shadowSpriteSheetIndex: number, frameRate?: number, repeat?: number, startFrame?: number, endFrame?: number, playFromFrame?: number): void {
        if (!this.shadowSprite) {
            return;
        }

        let shadowAnimationKey = '';
        let shadowTextureKey = '';
        try {
            this.shadowSpriteSheetIndex = shadowSpriteSheetIndex;
            if (frameRate !== undefined) {
                this.frameRate = frameRate;
            }

            // Build animation key and texture key based on whether this is a map object
            if (this.mapObject) {
                shadowTextureKey = this.shadowSpriteName;
                shadowAnimationKey = this.shadowSpriteName;
            } else {
                shadowTextureKey = `sprite-${this.shadowSpriteName}-${shadowSpriteSheetIndex}`;
                shadowAnimationKey = shadowTextureKey;
            }
            if (!this.mapObject && !isSafeDrawableTexture(this.scene, shadowTextureKey)) {
                return;
            }
            // Update pivot data for new spritesheet
            const pivotData = getPivotData(this.scene, shadowTextureKey, this.shadowSpriteName, this.mapObject);
            const pivotIndex = this.mapObject ? 0 : shadowSpriteSheetIndex;
            if (pivotData && pivotData.spriteSheetPivots[pivotIndex]) {
                this.shadowPivotData = pivotData.spriteSheetPivots[pivotIndex];
            }

            // Update shadow animation and frame rate
            if (this.scene.anims.exists(shadowAnimationKey)) {
                const anim = this.scene.anims.get(shadowAnimationKey);
                const frameCount = anim?.frames?.length ?? 0;
                if (frameCount < 1) {
                    return;
                }

                const playConfig: Phaser.Types.Animations.PlayAnimationConfig = {
                    key: shadowAnimationKey,
                    frameRate: this.frameRate
                };

                // Set start frame: playFromFrame keeps shadow in sync with object when switching animations,
                // otherwise use animation range startFrame if provided
                const requestedStartFrame = playFromFrame ?? startFrame ?? 0;
                const effectiveStartFrame = Math.max(0, Math.min(frameCount - 1, requestedStartFrame));
                if (playFromFrame !== undefined || startFrame !== undefined) {
                    playConfig.startFrame = effectiveStartFrame;
                }

                const animated = this.animatedSprite();
                if (!animated) {
                    return;
                }

                // Reset to frame 0 when starting from non-zero to avoid carryover from previous animation
                if (effectiveStartFrame > 0) {
                    const firstFrame = anim?.frames?.[0];
                    if (firstFrame?.frame) {
                        animated.anims.setCurrentFrame(firstFrame);
                    }
                }

                // Only set repeat if explicitly provided
                if (repeat !== undefined) {
                    playConfig.repeat = repeat;
                }

                this.stopShadowAnimationForSwitch(shadowAnimationKey);
                try {
                    animated.play(playConfig);
                } catch (error) {
                    this.resetShadowAnimationState(shadowAnimationKey);
                    this.setStaticFrameFromAnimation(shadowAnimationKey, effectiveStartFrame);
                    throw error;
                }

                this.bindShadowFrameListener(animated, repeat, startFrame, endFrame);
            }
            if (this.olympiaBodyShadow) {
                this.refreshOlympiaFrame();
            }
        } catch (error) {
            console.warn(
                '[ShadowManager] updateAnimation failed (possible race: animation/texture not ready):',
                {
                    error,
                    shadowSpriteName: this.shadowSpriteName,
                    shadowSpriteSheetIndex,
                    shadowAnimationKey,
                    shadowTextureKey,
                    frameRate: this.frameRate,
                    playFromFrame,
                    startFrame,
                    endFrame,
                    repeat,
                    animExists: this.scene.anims.exists(shadowAnimationKey),
                    mapObject: this.mapObject,
                }
            );
        }
    }

    /**
     * Clamps looping sub-ranges, and for player shadows rebakes the ground darken
     * on the frame Olympia would pass to `PutShadowSprite`.
     */
    private bindShadowFrameListener(
        animated: GameObjects.Sprite,
        repeat: number | undefined,
        startFrame: number | undefined,
        endFrame: number | undefined,
    ): void {
        animated.off(Phaser.Animations.Events.ANIMATION_UPDATE);
        const clamp = startFrame !== undefined && endFrame !== undefined && repeat !== 0;
        if (!clamp && !this.olympiaBodyShadow) {
            return;
        }
        animated.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
            if (clamp && startFrame !== undefined && endFrame !== undefined) {
                const frameIndex = typeof frame.index === 'number'
                    ? frame.index
                    : parseInt(String(frame.textureFrame ?? frame.frame?.name ?? frame.index), 10);
                if (frameIndex > endFrame || frameIndex < startFrame) {
                    const currentAnim = animated.anims?.currentAnim;
                    const targetFrame = currentAnim?.frames?.find((f: Phaser.Animations.AnimationFrame) => f.index === startFrame)
                        ?? currentAnim?.frames?.[startFrame];
                    if (targetFrame) {
                        animated.anims.setCurrentFrame(targetFrame);
                    }
                }
            }
            if (this.olympiaBodyShadow) {
                this.refreshOlympiaFrame();
            }
        });
    }

    private stopShadowAnimationForSwitch(nextAnimationKey: string): void {
        const animated = this.animatedSprite();
        if (!animated?.anims.isPlaying) {
            return;
        }

        if (!animated.anims.currentAnim || !animated.anims.currentFrame) {
            this.resetShadowAnimationState(nextAnimationKey);
            return;
        }

        try {
            animated.anims.stop();
        } catch (error) {
            console.warn(
                `[ShadowManager] Resetting stale animation state before playing "${nextAnimationKey}"`,
                error,
            );
            this.resetShadowAnimationState(nextAnimationKey);
        }
    }

    private resetShadowAnimationState(nextAnimationKey: string): void {
        const animated = this.animatedSprite();
        if (!animated) {
            return;
        }

        type MutableAnimationState = {
            currentAnim?: Phaser.Animations.Animation | null;
            currentFrame?: Phaser.Animations.AnimationFrame | null;
            hasStarted?: boolean;
            isPlaying?: boolean;
            nextAnim?: Phaser.Animations.Animation | string | null;
            stopAfterDelay?: number;
            stopAfterRepeat?: number;
            stopOnFrame?: Phaser.Animations.AnimationFrame | null;
        };

        const animationState = animated.anims as unknown as MutableAnimationState;
        animationState.currentAnim = null;
        animationState.currentFrame = null;
        animationState.nextAnim = null;
        animationState.stopOnFrame = null;
        animationState.stopAfterDelay = 0;
        animationState.stopAfterRepeat = 0;
        animationState.hasStarted = false;
        animationState.isPlaying = false;

        console.warn(`[ShadowManager] Recovered stale animation state before playing "${nextAnimationKey}"`);
    }

    private setStaticFrameFromAnimation(animationKey: string, frameIndex: number): void {
        const animated = this.animatedSprite();
        if (!animated) {
            return;
        }

        const anim = this.scene.anims.get(animationKey);
        const frame = anim?.frames?.[frameIndex] ?? anim?.frames?.[0];
        if (!frame?.frame) {
            return;
        }

        animated.setTexture(frame.frame.texture.key, frame.frame.name);
        if (this.olympiaBodyShadow) {
            this.refreshOlympiaFrame();
            return;
        }
        this.updatePosition();
    }

    /**
     * Updates the shadow sprite position to match the object's current position.
     * Calculates position using pivot offsets and frame dimensions.
     */
    private updatePosition(): void {
        if (!this.shadowSprite) {
            return;
        }

        if (this.olympiaBodyShadow) {
            // Canvas origin is the min sheared pixel, already in anchor space (sX, sY) + pivot.
            const anchorX = worldCellCenterPixelX(this.worldX) + this.offsetX;
            const anchorY = worldCellCenterPixelY(this.worldY) + this.offsetY;
            this.shadowSprite.setPosition(anchorX + this.olympiaOriginX, anchorY + this.olympiaOriginY);
            return;
        }

        // Get current shadow frame index
        // For map objects (static), use specified frameIndex or frame 0; for animated sprites, get from animation
        let frameIndex: number;
        if (this.mapObject) {
            // Map objects are static, use specified frameIndex or frame 0
            frameIndex = this.frameIndex ?? 0;
        } else {
            const currentFrame = this.shadowSprite.anims.currentFrame;
            if (!currentFrame) {
                // Fallback to frame 0 during animation transitions - prevents shadow from
                // disappearing or jumping when animation briefly has no current frame
                frameIndex = 0;
            } else {
                const frameName = currentFrame.textureFrame ?? currentFrame.frame?.name ?? currentFrame.index;
                frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);
            }
        }

        // Get shadow frame dimensions and pivot
        const shadowFrame = this.shadowSprite.frame;
        const shadowFrameWidth = shadowFrame?.width ?? this.shadowSprite.displayWidth;
        const shadowFrameHeight = shadowFrame?.height ?? this.shadowSprite.displayHeight;

        // Get shadow pivot data for current frame
        let shadowPivotX = 0;
        let shadowPivotY = 0;
        if (this.shadowPivotData && this.shadowPivotData[frameIndex]) {
            const pivotFrame = this.shadowPivotData[frameIndex];
            if (pivotFrame.width !== 0 && pivotFrame.height !== 0) {
                shadowPivotX = pivotFrame.pivotX;
                shadowPivotY = pivotFrame.pivotY;
            }
        }

        // Calculate shadow position
        // Base position (object's current position without pivot - using base world coordinates)
        const basePixelX = worldCellCenterPixelX(this.worldX) + this.offsetX;
        const basePixelY = worldCellCenterPixelY(this.worldY) + this.offsetY;

        // Add shadow pivot offset
        const posX = basePixelX + shadowPivotX;
        const posY = basePixelY + shadowPivotY;

        // Add frame-based offset
        // Since shadow origin is at bottom-center (0.5, 1.0), this positions the origin point correctly
        const shadowX = posX + (shadowFrameWidth * 0.5);
        const shadowY = posY + shadowFrameHeight;

        this.shadowSprite.setPosition(shadowX, shadowY);
    }

    /**
     * Updates the shadow sprite position based on the object's sprite position and pivot data.
     * This method should be used when the object's sprite position already includes pivot offsets.
     * 
     * @param objectSpriteX - The object's sprite X position (including pivot offset)
     * @param objectSpriteY - The object's sprite Y position (including pivot offset)
     * @param objectPivotX - The object's pivot X offset (from pivot data)
     * @param objectPivotY - The object's pivot Y offset (from pivot data)
     * @param objectFrameWidth - The object's frame width
     * @param objectFrameHeight - The object's frame height
     */
    public updatePositionFromSprite(
        objectSpriteX: number,
        objectSpriteY: number,
        objectPivotX: number,
        objectPivotY: number,
        objectFrameWidth: number,
        objectFrameHeight: number
    ): void {
        // Note: objectPivotX and objectPivotY are kept for potential future use
        // but are not currently needed since sprite position is already top-left
        void objectPivotX;
        void objectPivotY;
        if (!this.shadowSprite) {
            return;
        }

        // Calculate shadow position relative to object's sprite position
        // Object sprite has origin at (0, 0) - top-left
        // Object sprite position (sprite.x, sprite.y) represents the top-left corner
        // Shadow has origin at (0.5, 1.0) - bottom-center

        // Calculate object's bottom-center position (anchor point for shadow casting)
        // Since sprite origin is (0, 0), sprite position IS the top-left corner
        const objectBottomCenterX = objectSpriteX + (objectFrameWidth * 0.5);
        const objectBottomCenterY = objectSpriteY + objectFrameHeight;

        // Position shadow's bottom-center at object's bottom-center
        // Shadow origin is at (0.5, 1.0) - bottom-center
        // When we call setPosition(x, y), that (x, y) represents the bottom-center point
        this.shadowSprite.setPosition(objectBottomCenterX, objectBottomCenterY);
    }

    /**
     * Updates the shadow depth to render just below the object.
     * 
     * @param objectDepth - The depth of the object to render below
     */
    public updateDepth(objectDepth: number): void {
        if (!this.shadowSprite) {
            return;
        }

        // Shadow should render just below the object
        // Stay slightly below the parent sprite in depth units (ordering gap is 5, not 0.5).
        this.shadowSprite.setDepth(objectDepth - 5);
    }

    /**
     * Sets the world position of the shadow.
     * 
     * @param worldX - X coordinate in world grid
     * @param worldY - Y coordinate in world grid
     */
    public setWorldPosition(worldX: number, worldY: number): void {
        this.worldX = worldX;
        this.worldY = worldY;
        this.updatePosition();
    }

    /**
     * Sets the pixel offset for the shadow.
     * 
     * @param offsetX - X offset in pixels
     * @param offsetY - Y offset in pixels
     */
    public setOffset(offsetX: number, offsetY: number): void {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.updatePosition();
    }

    /**
     * Sets the alpha (opacity) of the shadow sprite.
     * 
     * @param alpha - Alpha value (0-1)
     */
    public setAlpha(alpha: number): void {
        this.requestedAlpha = alpha;
        if (!this.shadowSprite) {
            return;
        }
        if (this.olympiaBodyShadow) {
            // 75% darken is already in the stamp. Extra 0.5 would lighten it past Olympia.
            this.shadowSprite.setAlpha(alpha);
            this.shadowSprite.setVisible(alpha > 0 && this.shadowSprite.texture.key !== OLYMPIA_SHADOW_BLANK_KEY);
            return;
        }
        this.shadowSprite.setAlpha(alpha * 0.5);
    }

    /**
     * Destroys the shadow sprite and cleans up resources.
     */
    public destroy(): void {
        const animated = this.animatedSprite();
        animated?.off(Phaser.Animations.Events.ANIMATION_UPDATE);
        if (this.frameSprite) {
            this.frameSprite.destroy();
            this.frameSprite = undefined;
        }
        if (this.shadowSprite) {
            this.shadowSprite.destroy();
            this.shadowSprite = undefined;
        }
    }

    /**
     * Rebuilds the visible ground darken from the hidden body's current frame.
     * Olympia draws this before equipment, using that same body frame index.
     */
    private refreshOlympiaFrame(): void {
        if (!this.olympiaBodyShadow || !this.shadowSprite || !this.frameSprite) {
            return;
        }
        const sample = this.readBodyFrame();
        if (!sample) {
            this.shadowSprite.setVisible(false);
            return;
        }

        let pivotX = 0;
        let pivotY = 0;
        const pivotFrame = this.shadowPivotData?.[sample.frameIndex];
        if (pivotFrame && pivotFrame.width !== 0 && pivotFrame.height !== 0) {
            pivotX = pivotFrame.pivotX;
            pivotY = pivotFrame.pivotY;
        }

        const cacheKey = `olympia-body-shadow:${sample.textureKey}:${sample.frameName}:${pivotX}:${pivotY}`;
        if (cacheKey === this.lastOlympiaKey && this.shadowSprite.texture.key === cacheKey) {
            return;
        }
        let baked = bakedOlympiaShadows.get(cacheKey);
        if (!baked || !this.scene.textures.exists(cacheKey)) {
            const stamp = rasterizeOlympiaBodyShadow(
                sample.width,
                sample.height,
                pivotX,
                pivotY,
                sample.rgba,
            );
            if (!stamp) {
                this.shadowSprite.setVisible(false);
                return;
            }
            const canvas = document.createElement('canvas');
            canvas.width = stamp.width;
            canvas.height = stamp.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                this.shadowSprite.setVisible(false);
                return;
            }
            ctx.putImageData(new ImageData(stamp.rgba, stamp.width, stamp.height), 0, 0);
            this.scene.textures.addCanvas(cacheKey, canvas);
            const texture = this.scene.textures.get(cacheKey) as { source?: Array<{ scaleMode?: number }> };
            if (texture.source && texture.source[0]) {
                texture.source[0].scaleMode = 0;
            }
            baked = { originX: stamp.originX, originY: stamp.originY };
            bakedOlympiaShadows.set(cacheKey, baked);
        }

        this.olympiaOriginX = baked.originX;
        this.olympiaOriginY = baked.originY;
        if (this.shadowSprite.texture.key !== cacheKey) {
            this.shadowSprite.setTexture(cacheKey);
        }
        this.shadowSprite.setOrigin(0, 0);
        this.shadowSprite.setRotation(0);
        this.shadowSprite.setScale(1, 1);
        this.shadowSprite.setTint(0xffffff);
        this.shadowSprite.setAlpha(this.requestedAlpha);
        this.shadowSprite.setVisible(this.requestedAlpha > 0);
        this.lastOlympiaKey = cacheKey;
        this.updatePosition();
    }

    /** Pixels of the hidden body frame. Refuses the live world canvas. */
    private readBodyFrame(): {
        textureKey: string;
        frameName: string;
        frameIndex: number;
        width: number;
        height: number;
        rgba: Uint8ClampedArray;
    } | undefined {
        const sourceSprite = this.frameSprite;
        if (!sourceSprite) {
            return undefined;
        }
        const textureKey = sourceSprite.texture?.key;
        const frame = sourceSprite.frame;
        if (!textureKey || !frame) {
            return undefined;
        }
        const source = sourceSprite.texture.getSourceImage?.() as CanvasImageSource | undefined;
        if (!source || isWorldCanvasImageSource(source, this.scene.game?.canvas)) {
            return undefined;
        }
        const width = frame.cutWidth || frame.width;
        const height = frame.cutHeight || frame.height;
        if (width <= 0 || height <= 0) {
            return undefined;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return undefined;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(source, frame.cutX, frame.cutY, width, height, 0, 0, width, height);
        const frameName = String(frame.name);
        // `__BASE` is the whole sheet. Stamping that is a pile of bodies, not one frame.
        if (frameName === '__BASE' || frameName === '__MISSING' || frameName === '__DEFAULT') {
            return undefined;
        }
        const parsed = parseInt(frameName, 10);
        const frameIndex = Number.isNaN(parsed) ? 0 : parsed;
        return {
            textureKey,
            frameName,
            frameIndex,
            width,
            height,
            rgba: ctx.getImageData(0, 0, width, height).data,
        };
    }
}

function ensureOlympiaShadowBlank(scene: Scene): string {
    if (!scene.textures.exists(OLYMPIA_SHADOW_BLANK_KEY)) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        scene.textures.addCanvas(OLYMPIA_SHADOW_BLANK_KEY, canvas);
    }
    return OLYMPIA_SHADOW_BLANK_KEY;
}
