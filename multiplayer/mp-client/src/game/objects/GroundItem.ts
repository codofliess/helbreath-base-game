import type { Scene } from 'phaser';
import { GameAsset } from './GameAsset';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { getItemById, getItemSheetIndex, getDroppedItemSpriteIndex, getTintInventoryEffectColorWithOverrides, type Effect } from '../../constants/Items';
import { buildItemHoverInfo } from '../../constants/OlympiaItemName';
import { GROUND_ITEM_DISPLAY_CONFIG } from '../../constants/GroundItemDisplay';
import { Gender } from '../../Types';
import type { InventoryItemHoverInfo } from '../../ui/store/InventoryItemHoverOverlay.store';
import { TILE_SIZE } from '../assets/HBMap';
import { EventBus } from '../EventBus';
import { IN_UI_CHANGE_GENDER, IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED } from '../../constants/EventNames';
import { getGroundItemDisplaySize } from '../../utils/RegistryUtils';

/**
 * Represents an item dropped on the ground.
 * Extends GameAsset and uses item-ground.spr sprites with the same indexing as bag items.
 * Renders based on player gender unless the item has a fixed gender.
 */
export class GroundItem extends GameAsset {
    public readonly worldX: number;
    public readonly worldY: number;
    public readonly itemUid: string;
    public readonly itemId: number;
    public readonly quantity: number;
    private readonly effectOverrides?: Effect[];
    private readonly itemAttribute?: number;
    private readonly itemColor?: number;

    constructor(
        scene: Scene,
        worldX: number,
        worldY: number,
        itemId: number,
        itemUid: string,
        quantity: number,
        playerGender: Gender,
        tint?: number,
        effectOverrides?: Effect[],
        itemAttribute?: number,
        itemColor?: number,
    ) {
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            throw new Error(`GroundItem: unknown item id ${itemId}`);
        }

        const effectiveGender = itemDef.gender ?? playerGender;
        const sheetIndex = getItemSheetIndex(itemDef, effectiveGender);
        const spriteIndex = getDroppedItemSpriteIndex(itemDef, effectiveGender);
        const resolvedTint = tint ?? getTintInventoryEffectColorWithOverrides(itemDef, effectOverrides);

        if (sheetIndex === undefined || spriteIndex === undefined) {
            throw new Error(`GroundItem: no ground sprite for item ${itemId}`);
        }

        const pixelX = convertWorldPosToPixelPos(worldX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(worldY) + TILE_SIZE / 2;

        const displayConfig = GROUND_ITEM_DISPLAY_CONFIG[getGroundItemDisplaySize(scene)];
        super(scene, {
            x: pixelX,
            y: pixelY,
            spriteName: displayConfig.spritePrefix,
            spriteSheetIndex: sheetIndex,
            frameIndex: spriteIndex,
            ...(resolvedTint !== undefined && { tint: resolvedTint }),
        });

        this.worldX = worldX;
        this.worldY = worldY;
        this.itemUid = itemUid;
        this.itemId = itemId;
        this.quantity = quantity;
        this.currentGender = effectiveGender;
        this.tintColor = resolvedTint;
        this.effectOverrides = effectOverrides;
        this.itemAttribute = itemAttribute;
        this.itemColor = itemColor;

        this.applyDisplayScale(displayConfig.displayScale);

        // Apply tint after super() - GameAsset.applyItemEffects clears tint when effects is empty
        if (resolvedTint !== undefined) {
            this.sprite.setTint(resolvedTint);
        }

        this.genderChangeHandler = (newGender: Gender) => this.updateAppearanceForGender(newGender);
        this.displaySizeChangeHandler = () => this.updateTexture();
        EventBus.on(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
        EventBus.on(IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED, this.displaySizeChangeHandler);
    }

    private currentGender: Gender;
    private tintColor?: number;
    private genderChangeHandler?: (gender: Gender) => void;
    private displaySizeChangeHandler?: () => void;

    private applyDisplayScale(scale: number): void {
        this.sprite.setScale(scale);
    }

    private updateTexture(): void {
        const itemDef = getItemById(this.itemId);
        if (!itemDef) {
            return;
        }

        const effectiveGender = itemDef.gender ?? this.currentGender;
        const sheetIndex = getItemSheetIndex(itemDef, effectiveGender);
        const spriteIndex = getDroppedItemSpriteIndex(itemDef, effectiveGender);
        if (sheetIndex === undefined || spriteIndex === undefined) {
            return;
        }

        const displayConfig = GROUND_ITEM_DISPLAY_CONFIG[getGroundItemDisplaySize(this.scene)];
        const textureKey = `sprite-${displayConfig.spritePrefix}-${sheetIndex}`;
        if (this.scene.textures.exists(textureKey)) {
            this.sprite.setTexture(textureKey, spriteIndex);
        }
        this.applyDisplayScale(displayConfig.displayScale);
        if (this.tintColor !== undefined) {
            this.sprite.setTint(this.tintColor);
        }
    }

    private updateAppearanceForGender(newGender: Gender): void {
        const itemDef = getItemById(this.itemId);
        if (!itemDef || itemDef.gender !== undefined) {
            return;
        }

        this.currentGender = newGender;
        this.updateTexture();
    }

    /** Returns hover overlay info for this ground item at the given screen coordinates. */
    public getHoverInfo(mouseX: number, mouseY: number): InventoryItemHoverInfo {
        const itemDef = getItemById(this.itemId)!;
        return buildItemHoverInfo(itemDef, {
            itemId: this.itemId,
            itemUid: this.itemUid,
            itemAttribute: this.itemAttribute,
            itemColor: this.itemColor,
            effectOverrides: this.effectOverrides,
            quantity: this.quantity,
            source: 'ground',
            mouseX,
            mouseY,
        });
    }

    public override destroy(): void {
        if (this.genderChangeHandler) {
            EventBus.off(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
            this.genderChangeHandler = undefined;
        }
        if (this.displaySizeChangeHandler) {
            EventBus.off(IN_UI_GROUND_ITEM_DISPLAY_SIZE_CHANGED, this.displaySizeChangeHandler);
            this.displaySizeChangeHandler = undefined;
        }
        super.destroy();
    }
}