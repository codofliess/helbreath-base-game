import { useCallback } from 'react';
import { useStore } from '@tanstack/react-store';
import { inventoryDialogStore } from '../store/InventoryDialog.store';
import { appStore } from '../store/App.store';
import {
    ITEMS,
    ItemTypes,
    EQUIPMENT_SLOT_TO_SLOT_ID,
    getItemInventorySpriteKeyWithOverrides,
    RING_SLOT_LEFT,
    RING_SLOT_RIGHT,
    type EquipmentSlot,
} from '../../constants/Items';
import { buildItemHoverInfo } from '../../constants/OlympiaItemName';
import { setInventoryItemHoverInfo } from '../store/InventoryItemHoverOverlay.store';
import { EventBus } from '../../game/EventBus';
import { ITEM_MOVED_TO_BAG } from '../../constants/EventNames';
import { Gender } from '../../Types';

interface EquippedSlotsGridProps {
    onSlotMouseDown?: (e: React.MouseEvent, slot: EquipmentSlot) => void;
    draggedSource?: EquipmentSlot | null;
    activeSlotDropTarget?: EquipmentSlot | null;
    className?: string;
}

export function EquippedSlotsGrid({
    onSlotMouseDown,
    draggedSource = null,
    activeSlotDropTarget = null,
    className = 'inventory-equipped-area',
}: EquippedSlotsGridProps) {
    const equippedItems = useStore(inventoryDialogStore, (s) => s.equippedItems);
    const playerGender = useStore(inventoryDialogStore, (s) => s.playerGender);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);

    const getSlotData = useCallback(
        (slot: EquipmentSlot) => {
            const equipped = equippedItems[slot];
            const itemDef = equipped !== undefined ? ITEMS.find((i) => i.id === equipped.itemId) : undefined;
            const gender = playerGender ?? Gender.MALE;
            const spriteKey = itemDef !== undefined
                ? getItemInventorySpriteKeyWithOverrides(
                    itemDef,
                    gender,
                    equipped?.effectOverrides,
                    equipped?.itemColor,
                )
                : undefined;
            const imageDataUrl = spriteKey !== undefined ? spriteFrameMap.get(spriteKey) : undefined;
            return { equipped, itemDef, imageDataUrl };
        },
        [equippedItems, playerGender, spriteFrameMap],
    );

    const handleSlotDoubleClick = useCallback(
        (slot: EquipmentSlot) => {
            const { equipped, imageDataUrl } = getSlotData(slot);
            if (!equipped || !imageDataUrl) return;
            EventBus.emit(ITEM_MOVED_TO_BAG, {
                itemUid: equipped.itemUid,
                itemType: slot,
                bagX: equipped.bagX,
                bagY: equipped.bagY,
            });
        },
        [getSlotData],
    );

    const getSlotLabel = (slot: EquipmentSlot) => {
        if (slot === ItemTypes.ACCESSORY) return 'ACC';
        if (slot === ItemTypes.NECKLACE) return 'NECK';
        if (slot === RING_SLOT_LEFT || slot === RING_SLOT_RIGHT) return 'Ring';
        const slotId = EQUIPMENT_SLOT_TO_SLOT_ID[slot];
        return slotId.charAt(0).toUpperCase() + slotId.slice(1);
    };

    const renderSlot = (slot: EquipmentSlot) => {
        const slotId = EQUIPMENT_SLOT_TO_SLOT_ID[slot];
        const { equipped, itemDef, imageDataUrl } = getSlotData(slot);
        const isDropTarget = activeSlotDropTarget === slot;
        const slotLabel = getSlotLabel(slot);

        return (
            <div
                key={slot}
                data-slot-type={slot}
                className={`inventory-slot inventory-slot-${slotId}${imageDataUrl ? ' inventory-slot-has-item' : ''}${isDropTarget ? ' inventory-slot-drop-target' : ''}`}
                onMouseDown={onSlotMouseDown ? (e) => onSlotMouseDown(e, slot) : undefined}
                onDoubleClick={imageDataUrl ? () => handleSlotDoubleClick(slot) : undefined}
                onMouseEnter={
                    equipped && itemDef
                        ? (e) => {
                              setInventoryItemHoverInfo(
                                  buildItemHoverInfo(itemDef, {
                                      itemId: equipped.itemId,
                                      itemUid: equipped.itemUid,
                                      itemAttribute: equipped.itemAttribute,
                                      itemColor: equipped.itemColor,
                                      effectOverrides: equipped.effectOverrides,
                                      quantity: equipped.quantity,
                                      source: 'equipped',
                                      mouseX: e.clientX,
                                      mouseY: e.clientY,
                                  }),
                              );
                          }
                        : undefined
                }
                onMouseMove={
                    equipped && itemDef
                        ? (e) => {
                              setInventoryItemHoverInfo(
                                  buildItemHoverInfo(itemDef, {
                                      itemId: equipped.itemId,
                                      itemUid: equipped.itemUid,
                                      itemAttribute: equipped.itemAttribute,
                                      itemColor: equipped.itemColor,
                                      effectOverrides: equipped.effectOverrides,
                                      quantity: equipped.quantity,
                                      source: 'equipped',
                                      mouseX: e.clientX,
                                      mouseY: e.clientY,
                                  }),
                              );
                          }
                        : undefined
                }
                onMouseLeave={() => {
                    setInventoryItemHoverInfo(undefined);
                }}
                style={{ cursor: imageDataUrl ? 'grab' : undefined }}
            >
                {imageDataUrl ? (
                    <img
                        src={imageDataUrl}
                        alt={`Equipped ${slotLabel}`}
                        className="inventory-slot-item-image"
                        draggable={false}
                        style={{
                            imageRendering: 'pixelated',
                            visibility: draggedSource === slot ? 'hidden' : 'visible',
                            ...(itemDef?.scale != null && { transform: `scale(${itemDef.scale})` }),
                        }}
                    />
                ) : (
                    <span className="inventory-slot-label">{slotLabel}</span>
                )}
            </div>
        );
    };

    return (
        <div className={className}>
            {renderSlot(ItemTypes.HELMET)}
            {renderSlot(ItemTypes.WEAPON)}
            {renderSlot(ItemTypes.ARMOR)}
            {renderSlot(ItemTypes.HAUBERK)}
            {renderSlot(ItemTypes.SHIELD)}
            {renderSlot(ItemTypes.LEGGINGS)}
            {renderSlot(ItemTypes.CAPE)}
            {renderSlot(ItemTypes.BOOTS)}
            {renderSlot(ItemTypes.ACCESSORY)}
            {renderSlot(ItemTypes.NECKLACE)}
            {renderSlot(RING_SLOT_LEFT)}
            {renderSlot(RING_SLOT_RIGHT)}
        </div>
    );
}