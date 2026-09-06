import { CANVAS, type Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { PivotFrame, PivotData } from '../../Types';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../../constants/EventNames';
import { getBinaryBuffer, setPivotDataByTextureKey, setPivotDataBySpriteName } from '../../utils/RegistryUtils';
import { sliceSprSheets } from '../../utils/sprSheetSlice';
import { ITEMS, getItemSheetIndex, getItemSpriteIndex, getTintInventoryEffectColor } from '../../constants/Items';
import { Gender } from '../../Types';

/** Sprite category for loading/rendering (human, tiles, monster, item packs, etc.). */
export enum SpriteType {
    Human = 'Human',
    Tiles = 'Tiles',
    Monster = 'Monster',
    EquipmentPack = 'EquipmentPack',
    HairAndUndies = 'HairAndUndies',
    Bows = 'Bows',
    Weapons = 'Weapons',
    Shields = 'Shields',
    Effect = 'Effect',
    Interface = 'Interface',
    ItemPack = 'ItemPack',
    ItemGround = 'ItemGround',
}

interface DecodedSpriteImage {
    source: CanvasImageSource;
    width: number;
    height: number;
    close(): void;
}

/**
 * Represents a single frame within a sprite sheet.
 * Contains position, dimensions, pivot point, and texture information.
 */
export class HBSpriteFrame {
    /** The x coordinate of the frame within the sprite sheet */
    public readonly x: number;
    
    /** The y coordinate of the frame within the sprite sheet */
    public readonly y: number;
    
    /** The width of the frame in pixels */
    public readonly width: number;
    
    /** The height of the frame in pixels */
    public readonly height: number;
    
    /** The x coordinate of the pivot point relative to the frame's top-left corner */
    public readonly pivotX: number;
    
    /** The y coordinate of the pivot point relative to the frame's top-left corner */
    public readonly pivotY: number;
    
    /** The texture key used to identify the sprite sheet texture in Phaser */
    public readonly textureKey: string;
    
    /** The index of this frame within the sprite sheet */
    public readonly frameIndex: number;

    /**
     * Creates a new HBSpriteFrame instance.
     * 
     * @param x - The x coordinate of the frame within the sprite sheet
     * @param y - The y coordinate of the frame within the sprite sheet
     * @param width - The width of the frame in pixels
     * @param height - The height of the frame in pixels
     * @param pivotX - The x coordinate of the pivot point relative to the frame's top-left corner
     * @param pivotY - The y coordinate of the pivot point relative to the frame's top-left corner
     * @param textureKey - The texture key used to identify the sprite sheet texture in Phaser
     * @param frameIndex - The index of this frame within the sprite sheet
     */
    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        pivotX: number,
        pivotY: number,
        textureKey: string,
        frameIndex: number
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.pivotX = pivotX;
        this.pivotY = pivotY;
        this.textureKey = textureKey;
        this.frameIndex = frameIndex;
    }
}

/**
 * Represents a sprite sheet containing multiple frames.
 * Handles texture creation, frame slicing, and optional frame extraction as data URLs.
 */
export class HBSpriteSheet {
    /** Array of frames contained in this sprite sheet */
    public readonly frames: HBSpriteFrame[];
    
    /** The texture key used to identify this sprite sheet in Phaser */
    public readonly textureKey: string;
    
    /** The name of the sprite (without index) */
    private readonly spriteName: string;
    
    /** The index of this sprite sheet within the sprite file */
    private readonly spriteSheetIndex: number;
    
    /** The canvas element used to create the texture (undefined after texture creation) */
    private canvas: HTMLCanvasElement | undefined = undefined;

    /**
     * Creates a new HBSpriteSheet instance.
     * Creates a Phaser texture from the sprite sheet image and slices it into frames.
     * 
     * @param scene - The Phaser scene to register the texture with
     * @param spriteName - The name of the sprite (without index)
     * @param spriteSheetIndex - The index of this sprite sheet within the sprite file
     * @param frames - Array of frame definitions for this sprite sheet
     * @param spriteSheetImage - The ImageBitmap containing the sprite sheet image
     * @param exportFramesAsDataUrls - Whether to extract all frames as data URLs (default: false)
     * @param customTextureKey - Optional custom texture key to use instead of default naming (default: undefined)
     */
    constructor(
        scene: Scene,
        spriteName: string,
        spriteSheetIndex: number,
        frames: HBSpriteFrame[],
        spriteSheetImage: DecodedSpriteImage,
        exportFramesAsDataUrls = false,
        useCanvasTexture = false,
        customTextureKey?: string
    ) {
        this.frames = frames;
        this.spriteName = spriteName;
        this.spriteSheetIndex = spriteSheetIndex;
        
        // Build texture key: use custom key if provided, otherwise use {spriteName}-{spriteSheetIndex}
        this.textureKey = customTextureKey ?? `${spriteName}-${spriteSheetIndex}`;

        this.createTexture(
            scene,
            spriteSheetImage,
            frames,
            exportFramesAsDataUrls,
            useCanvasTexture || scene.game.renderer.type === CANVAS,
        );

        if (exportFramesAsDataUrls) {
            this.extractAllFramesAsDataUrls();
        }
    }

    /**
     * Creates a Phaser texture from the sprite sheet ImageBitmap and slices it into individual frames.
     * Uses NEAREST filtering for pixel-perfect rendering.
     * 
     * @param scene - The Phaser scene to register the texture with
     * @param spriteSheetImage - The ImageBitmap containing the sprite sheet image
     * @param frames - Array of frame definitions to slice from the texture
     */
    private createTexture(
        scene: Scene,
        spriteSheetImage: DecodedSpriteImage,
        frames: HBSpriteFrame[],
        exportFramesAsDataUrls: boolean,
        useCanvasTexture: boolean
    ): void {
        // Check if texture already exists
        if (scene.textures.exists(this.textureKey)) {
            return;
        }

        let texture: Phaser.Textures.Texture;

        if (useCanvasTexture) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = spriteSheetImage.width;
            this.canvas.height = spriteSheetImage.height;
            const ctx = this.canvas.getContext('2d', { alpha: true });

            if (!ctx) {
                throw new Error('Failed to get canvas context for texture creation');
            }

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spriteSheetImage.source, 0, 0);
            scene.textures.addCanvas(this.textureKey, this.canvas);
            texture = scene.textures.get(this.textureKey);
        } else {
            const textureManager = scene.textures as Phaser.Textures.TextureManager & {
                create: (key: string, source: ImageBitmap, width?: number, height?: number) => Phaser.Textures.Texture | null;
            };
            const createdTexture = textureManager.create(
                this.textureKey,
                spriteSheetImage.source as ImageBitmap,
                spriteSheetImage.width,
                spriteSheetImage.height
            );
            texture = createdTexture ?? scene.textures.get(this.textureKey);
        }

        // Set texture filter to NEAREST for pixel-perfect rendering
        if (texture.source && texture.source[0]) {
            const source = texture.source[0];
            source.scaleMode = 0; // Phaser.ScaleModes.NEAREST
        }

        // Add frames to the texture by slicing the sprite sheet
        frames.forEach((sprite, frameIndex) => {
            texture.add(String(frameIndex), 0, sprite.x, sprite.y, sprite.width, sprite.height);
        });

        if (exportFramesAsDataUrls && !this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = spriteSheetImage.width;
            this.canvas.height = spriteSheetImage.height;
            const ctx = this.canvas.getContext('2d', { alpha: true });

            if (!ctx) {
                throw new Error('Failed to get canvas context for frame extraction');
            }

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(spriteSheetImage.source, 0, 0);
        }
    }

    /**
     * Extracts all frames from the sprite sheet as data URLs and stores them in the registry.
     * Used to provide frame data to the React layer for UI purposes.
     * Triggers changedata-{key} events when registry is updated.
     */
    private extractAllFramesAsDataUrls(): void {
        if (!this.canvas) {
            throw Error('[SpriteSheet] Cannot extract frames: canvas not available');
            return;
        }

        const ctx = this.canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            throw Error('[SpriteSheet] Cannot extract frames: canvas context not available');
        }

        // Extract each frame
        this.frames.forEach((frame) => {
            // Create a temporary canvas for this frame
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = frame.width;
            frameCanvas.height = frame.height;
            const frameCtx = frameCanvas.getContext('2d', { alpha: true });

            if (!frameCtx) {
                throw Error(`[SpriteSheet] Failed to get context for frame ${frame.frameIndex}`);
            }

            frameCtx.imageSmoothingEnabled = false;

            // Draw the frame from the sprite sheet canvas
            frameCtx.drawImage(
                this.canvas!,
                frame.x,
                frame.y,
                frame.width,
                frame.height,
                0,
                0,
                frame.width,
                frame.height
            );

            // Convert to data URL
            const dataUrl = frameCanvas.toDataURL('image/png');

            // Signal React layer via EventBus
            const key = `${this.spriteName}-${this.spriteSheetIndex}-${frame.frameIndex}`;
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, key, dataUrl);

            // For item-pack: generate tinted sprites for items with TINT_INVENTORY effect
            if (this.spriteName === 'sprite-item-pack') {
                this.emitTintedFramesForItemPack(frame, frameCanvas);
            }
        });
    }

    /**
     * Emits tinted data URLs for item-pack frames used by items with TINT_INVENTORY effect.
     * Key format: sprite-item-pack-{sheetIndex}-{spriteIndex}-{effectColorHex}
     */
    private emitTintedFramesForItemPack(frame: HBSpriteFrame, frameCanvas: HTMLCanvasElement): void {
        const sheetIndex = this.spriteSheetIndex;
        const spriteIndex = frame.frameIndex;
        const emittedColors = new Set<number>();

        for (const item of ITEMS) {
            const effectColor = getTintInventoryEffectColor(item);
            if (effectColor === undefined || emittedColors.has(effectColor)) continue;

            const maleSheet = getItemSheetIndex(item, Gender.MALE);
            const maleSprite = getItemSpriteIndex(item, Gender.MALE);
            const femaleSheet = getItemSheetIndex(item, Gender.FEMALE);
            const femaleSprite = getItemSpriteIndex(item, Gender.FEMALE);
            const usesThisFrame =
                (maleSheet === sheetIndex && maleSprite === spriteIndex) ||
                (femaleSheet === sheetIndex && femaleSprite === spriteIndex);
            if (!usesThisFrame) continue;

            emittedColors.add(effectColor);
            this.emitTintedFrameForSprite(spriteIndex, effectColor, frameCanvas);
        }
    }

    /**
     * Emits a tinted frame for the given sprite index and effect color.
     * Used during load (via emitTintedFramesForItemPack) and on demand when items with
     * TINT_INVENTORY are created via ItemDialog with custom colors.
     * Key format: sprite-item-pack-{sheetIndex}-{spriteIndex}-{effectColorHex}
     * @param frameCanvas - Optional; when provided, uses it instead of extracting from canvas (avoids re-extraction during load)
     * @returns true if emitted, false if frame not found or canvas unavailable
     */
    public emitTintedFrameForSprite(spriteIndex: number, effectColor: number, frameCanvas?: HTMLCanvasElement): boolean {
        const frame = this.frames.find((f) => f.frameIndex === spriteIndex);
        if (!frame) return false;

        let sourceCanvas: HTMLCanvasElement;
        if (frameCanvas) {
            sourceCanvas = frameCanvas;
        } else {
            if (!this.canvas) return false;
            const extracted = document.createElement('canvas');
            extracted.width = frame.width;
            extracted.height = frame.height;
            const ctx = extracted.getContext('2d', { alpha: true });
            if (!ctx) return false;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.canvas, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
            sourceCanvas = extracted;
        }

        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = frame.width;
        tintCanvas.height = frame.height;
        const tintCtx = tintCanvas.getContext('2d', { alpha: true });
        if (!tintCtx) return false;

        tintCtx.imageSmoothingEnabled = false;
        tintCtx.drawImage(sourceCanvas, 0, 0);

        const tr = ((effectColor >> 16) & 0xff) / 255;
        const tg = ((effectColor >> 8) & 0xff) / 255;
        const tb = (effectColor & 0xff) / 255;
        const imageData = tintCtx.getImageData(0, 0, frame.width, frame.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.floor(data[i] * tr);
            data[i + 1] = Math.floor(data[i + 1] * tg);
            data[i + 2] = Math.floor(data[i + 2] * tb);
        }
        tintCtx.putImageData(imageData, 0, 0);

        const tintDataUrl = tintCanvas.toDataURL('image/png');
        const effectColorHex = effectColor.toString(16).padStart(6, '0');
        const tintKey = `${this.spriteName}-${this.spriteSheetIndex}-${spriteIndex}-${effectColorHex}`;
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, tintKey, tintDataUrl);
        return true;
    }
}

/**
 * Animation class that creates and registers Phaser animations from Sprite instances.
 * This implementation is for working with Helbreath's sprite format.
 */
export class HBAnimation {
    /** The unique key used to identify this animation in Phaser's AnimationManager */
    public readonly animationKey: string;
    
    /** The cache key of the sprite file this animation belongs to */
    public readonly spriteCacheKey: string;
    
    /** The index of the sprite sheet within the sprite file */
    public readonly spriteSheetIndex: number;

    /**
     * Creates a new HBAnimation instance and registers it with Phaser's AnimationManager.
     * 
     * @param scene - The Phaser scene that contains the AnimationManager
     * @param spriteCacheKey - The cache key of the sprite file
     * @param spriteSheetIndex - The index of the sprite sheet within the sprite file
     * @param sprites - Array of sprite frames to use for the animation
     * @param frameRate - The frame rate for the animation (default: 10)
     * @param repeat - Number of times to repeat the animation (-1 for infinite, default: -1)
     */
    constructor(
        scene: Scene,
        spriteCacheKey: string,
        spriteSheetIndex: number,
        sprites: HBSpriteFrame[],
        frameRate = 10,
        repeat = -1,
    ) {
        this.spriteCacheKey = spriteCacheKey;
        this.spriteSheetIndex = spriteSheetIndex;

        const spriteName = spriteCacheKey.toLowerCase();

        this.animationKey = `${spriteName}-${spriteSheetIndex}`;

        // Register animation if it doesn't exist
        if (!scene.anims.exists(this.animationKey)) {
            this.registerAnimation(scene, sprites, frameRate, repeat);
        }
    }

    /**
     * Registers the animation with Phaser's AnimationManager.
     * Converts sprite frames into Phaser animation frames with custom pivot data.
     * 
     * @param scene - The Phaser scene containing the AnimationManager
     * @param sprites - Array of sprite frames to convert to animation frames
     * @param frameRate - The frame rate for the animation
     * @param repeat - Number of times to repeat the animation (-1 for infinite)
     */
    private registerAnimation(
        scene: Scene,
        sprites: HBSpriteFrame[],
        frameRate: number,
        repeat: number
    ): void {
        const frames = sprites.map((sprite) => ({
            key: sprite.textureKey,
            frame: String(sprite.frameIndex), // Use frame index from sprite sheet
            customData: {
                pivotX: sprite.pivotX,
                pivotY: sprite.pivotY,
                width: sprite.width,
                height: sprite.height
            }
        }));

        scene.anims.create({
            key: this.animationKey,
            frames: frames,
            frameRate: frameRate,
            repeat: repeat
        });
    }
}

/**
 * Represents a Helbreath sprite file containing one or more sprite sheets.
 * Handles loading, parsing, and registering sprite sheets and animations with Phaser.
 */
export class HBSpriteFile {
    /** The name of the sprite file */
    public readonly fileName: string;
    
    /** The type of sprite (determines if animations should be created) */
    public readonly spriteType: SpriteType;
    
    /** Whether to export individual frames as data URLs for React layer */
    public readonly exportFramesAsDataUrls: boolean;
    
    /** Starting index for tile sprites (used for map tile texture naming) */
    public readonly tileStartIndex?: number;
    
    /** Array of sprite sheets loaded from this file */
    public spriteSheets: HBSpriteSheet[];
    
    /** Array of animations created from the sprite sheets (empty for Tiles and Interface types) */
    public animations: HBAnimation[];

    /**
     * Creates a new HBSpriteFile instance.
     * 
     * @param fileName - The name of the sprite file (must exist in Phaser's binary cache)
     * @param spriteType - The type of sprite (affects whether animations are created)
     * @param exportFramesAsDataUrls - Whether to export individual frames as data URLs (default: false)
     * @param tileStartIndex - Starting index for tile sprites (for map tile texture naming, default: undefined)
     */
    constructor(fileName: string, spriteType: SpriteType, exportFramesAsDataUrls = false, tileStartIndex?: number) {
        this.fileName = fileName;
        this.spriteType = spriteType;
        this.exportFramesAsDataUrls = exportFramesAsDataUrls;
        this.tileStartIndex = tileStartIndex;
    }

    /**
     * Loads the sprite file from Phaser's binary cache, parses it, and creates sprite sheets and animations.
     * This method:
     * 1. Loads the binary data from cache
     * 2. Parses the Helbreath sprite format
     * 3. Creates sprite sheets with textures
     * 4. Registers pivot data in Phaser's registry
     * 5. Creates animations (if sprite type supports them)
     * 
     * @param scene - The Phaser scene with access to the binary cache
     * @throws Error if the sprite buffer is not found in cache
     * @param options.sheetIndices Local sheet indexes to decode (tile packs). Omit to decode every sheet.
     */
    public async load(scene: Scene, options?: { sheetIndices?: ReadonlySet<number> }): Promise<void> {
        // Load binary from cache using fileName
        const buffer = getBinaryBuffer(scene, this.fileName);
        
        if (!buffer) {
            throw new Error(`Missing sprite buffer in cache for ${this.fileName}`);
        }
        
        // Extract sprite name from file name
        const spriteName = this.fileName.toLowerCase();
        const sheetFilter = options?.sheetIndices;
        const slices = sliceSprSheets(buffer, sheetFilter);

        const spriteSheets: HBSpriteSheet[] = [];

        for (const slice of slices) {
            const spriteSheetIndex = slice.sheetIndex;
            const useCustomNaming = this.spriteType === SpriteType.Tiles && this.tileStartIndex !== undefined;
            const customTextureKey = useCustomNaming ? `map-tile-${this.tileStartIndex + spriteSheetIndex}` : undefined;
            const textureKey = customTextureKey ?? `${spriteName}-${spriteSheetIndex}`;
            if (scene.textures.exists(textureKey)) {
                continue;
            }

            const frames = slice.frames.map(
                (frame, f) =>
                    new HBSpriteFrame(
                        frame.x,
                        frame.y,
                        frame.width,
                        frame.height,
                        frame.pivotX,
                        frame.pivotY,
                        textureKey,
                        f,
                    ),
            );

            const spriteSheetImage = await this.createImageFromPng(slice.png);

            try {
                const spriteSheet = new HBSpriteSheet(
                    scene,
                    spriteName,
                    spriteSheetIndex,
                    frames,
                    spriteSheetImage,
                    this.exportFramesAsDataUrls,
                    this.spriteType === SpriteType.Tiles,
                    customTextureKey,
                );
                spriteSheets.push(spriteSheet);
            } finally {
                spriteSheetImage.close();
            }
            // Yield so Canvas-first Chrome can GC ImageBitmaps between tile sheets (enter OOM).
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        
        // Populate spriteSheets
        this.spriteSheets = spriteSheets;

        // Build pivot data structure and register it globally
        const spriteSheetPivots: PivotFrame[][] = [];
        for (let spriteSheetIndex = 0; spriteSheetIndex < spriteSheets.length; spriteSheetIndex++) {
            const spriteSheet = spriteSheets[spriteSheetIndex];
            const framePivots = spriteSheet.frames.map((frame) => ({
                pivotX: frame.pivotX,
                pivotY: frame.pivotY,
                width: frame.width,
                height: frame.height
            }));
            spriteSheetPivots.push(framePivots);
            
            // For tiles, also register pivots using the textureKey for tile-based lookup
            // This allows GameAsset to look up pivots using the textureKey (e.g., map-tile-123)
            if (this.spriteType === SpriteType.Tiles) {
                const textureKey = spriteSheet.textureKey;
                const texturePivotData: PivotData = { 
                    spriteSheetPivots: [framePivots] // Single sprite sheet for this texture
                };
                setPivotDataByTextureKey(scene, textureKey, texturePivotData);
            }
        }
        
        // Register pivot data in Phaser registry (for backward compatibility)
        if (!sheetFilter) {
            const pivotData: PivotData = { spriteSheetPivots };
            setPivotDataBySpriteName(scene, spriteName, pivotData);
        }

        // Create Animation instances if sprite type is not Tiles or Interface
        if (this.spriteType !== SpriteType.Tiles && this.spriteType !== SpriteType.Interface) {
            const animations: HBAnimation[] = [];
            
            for (let spriteSheetIndex = 0; spriteSheetIndex < spriteSheets.length; spriteSheetIndex++) {
                const spriteSheet = spriteSheets[spriteSheetIndex];
                
                // Create Animation instance for this sprite sheet using HBAnimation class
                // This will register the animation with Phaser's AnimationManager
                const animation = new HBAnimation(
                    scene,
                    this.fileName,
                    spriteSheetIndex,
                    spriteSheet.frames,
                    10, // frameRate
                    -1  // repeat
                );
                
                animations.push(animation);
            }
            
            // Populate animations
            this.animations = animations;
        } else {
            this.animations = [];
        }

        // Full loads can drop the .spr buffer. Partial tile-sheet loads keep it so walking
        // can decode the next local sheets without fetching the pack again.
        if (!sheetFilter) {
            scene.cache.binary.remove(this.fileName);
        }

        console.log(`Sprite loaded: ${this.fileName}`, this);
    }

    /**
     * Creates an ImageBitmap from PNG image data.
     * ImageDecoder/VideoFrame is not used: Canvas-first Phaser closes the VideoFrame after
     * texture create (`VideoFrame is closed`) and can OOM on enter.
     */
    private async createImageFromPng(data: Uint8Array): Promise<DecodedSpriteImage> {
        try {
            const blob = new Blob([data], { type: 'image/png' });
            const imageBitmap = await createImageBitmap(blob);
            return {
                source: imageBitmap,
                width: imageBitmap.width,
                height: imageBitmap.height,
                close: () => imageBitmap.close(),
            };
        } catch (error) {
            throw new Error(`Failed to decode sprite PNG: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}