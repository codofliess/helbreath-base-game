import { useStore } from '@tanstack/react-store';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { inventoryDialogStore, setBagDialogTab } from '../store/InventoryDialog.store';
import { itemDropsStore, clearItemDropsLog } from '../store/ItemDrops.store';
import { appStore } from '../store/App.store';
import { BAG_CONFIG_ICON, BAG_DIALOG_BG, BAG_TAB_LEFT, BAG_TAB_RIGHT } from '../../constants/SpriteKeys';
import { mapDialogStore, setGroundItemDisplaySize } from '../store/MapDialog.store';
import {
    bagSettingsStore,
    BAG_SCALE_LEVELS,
    decreaseBagScale,
    increaseBagScale,
    persistBagGroundItemDisplaySize,
    setBagConfigMenuOpen,
    setBagTransparent,
    toggleBagConfigMenu,
} from '../store/BagSettings.store';
import {
    BAG_ITEM_DISPLAY_SIZE_PX,
    GROUND_ITEM_DISPLAY_LABELS,
    GROUND_ITEM_DISPLAY_SIZES,
} from '../../constants/GroundItemDisplay';
import { ITEMS, ItemTypes, getBagItemSpriteKeyWithOverrides, RING_SLOT_LEFT, type Effect, type EquipmentSlot } from '../../constants/Items';
import { EventBus } from '../../game/EventBus';
import {
    ITEM_MOVED_TO_BAG,
    ITEM_EQUIP_REQUESTED,
    ITEM_BAG_ITEM_BRING_TO_FRONT_REQUESTED,
    ITEM_CONSUMED_REQUESTED,
    ITEM_DROP_TO_GROUND_REQUESTED,
} from '../../constants/EventNames';
import { setInventoryItemHoverInfo, setInventoryItemHoverOverlaySuppressed } from '../store/InventoryItemHoverOverlay.store';
import { buildInventoryItemHoverInfo } from '../../constants/OlympiaItemName';
import { Gender } from '../../Types';

interface InventoryDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

function stopDialogPointer(e: PointerEvent) {
    e.stopPropagation();
}

const DRAG_GHOST_SIZE = 48;
const BAG_PADDING = 8;
/** Minimum pixel movement to treat as a drag; below this, release cancels drag (allows double-click to equip). */
const DRAG_THRESHOLD_PX = 8;
/** Max ms between two clicks to treat as double-click (fallback when browser dblclick doesn't fire). */
const DOUBLE_CLICK_WINDOW_MS = 400;
/** Delay before clearing hover overlay on mouseLeave - reduces flicker when moving between overlapping items. */
const HOVER_LEAVE_DELAY_MS = 50;

function clampBagPosition(
    bagX: number,
    bagY: number,
    bagRect: DOMRect,
    itemDisplayWidth: number,
    itemDisplayHeight: number,
): { bagX: number; bagY: number } {
    const itemHalfWidth = itemDisplayWidth / 2;
    const itemHalfHeight = itemDisplayHeight / 2;
    const minX = BAG_PADDING + itemHalfWidth;
    const maxX = Math.max(minX, bagRect.width - BAG_PADDING - itemHalfWidth);
    const minY = BAG_PADDING + itemHalfHeight;
    const maxY = Math.max(minY, bagRect.height - BAG_PADDING - itemHalfHeight);
    return {
        bagX: Math.round(Math.max(minX, Math.min(maxX, bagX))),
        bagY: Math.round(Math.max(minY, Math.min(maxY, bagY))),
    };
}

type DragSource = EquipmentSlot | 'bag';

interface DraggedItem {
    item: { itemId: number; itemUid: string; effectOverrides?: Effect[] };
    source: DragSource;
    itemType: ItemTypes;
}

export function InventoryDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: InventoryDialogProps) {
    const activeTab = useStore(inventoryDialogStore, (state) => state.activeTab);
    const baggedItems = useStore(inventoryDialogStore, (state) => state.baggedItems);
    const itemDropEntries = useStore(itemDropsStore, (state) => state.entries);
    const playerGender = useStore(inventoryDialogStore, (state) => state.playerGender);
    const spriteFrameMap = useStore(appStore, (state) => state.spriteFrameMap);
    const displaySpritesInfo = useStore(mapDialogStore, (state) => state.debugMode);
    const groundItemDisplaySize = useStore(mapDialogStore, (state) => state.groundItemDisplaySize);
    const bagTransparent = useStore(bagSettingsStore, (state) => state.transparent);
    const bagScaleIndex = useStore(bagSettingsStore, (state) => state.scaleIndex);
    const bagConfigMenuOpen = useStore(bagSettingsStore, (state) => state.configMenuOpen);
    const bagScale = BAG_SCALE_LEVELS[bagScaleIndex];

    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [isBagDropTarget, setIsBagDropTarget] = useState(false);
    const [isDropToGroundIntent, setIsDropToGroundIntent] = useState(false);
    const [activeSlotDropTarget, setActiveSlotDropTarget] = useState<EquipmentSlot | null>(null);
    const [dragGhostPortalTarget, setDragGhostPortalTarget] = useState<HTMLElement>(document.body);
    const bagAreaRef = useRef<HTMLDivElement>(null);
    const isBagDropTargetRef = useRef(false);
    const activeSlotDropTargetRef = useRef<EquipmentSlot | null>(null);
    const dragStartPositionRef = useRef({ x: 0, y: 0 });
    const bagItemImageSizeCacheRef = useRef(new Map<string, { width: number; height: number }>());
    const [, setBagItemImageSizesVersion] = useState(0);
    /** When we cancel a drag (no movement), store item+time so second click can trigger equip if dblclick doesn't fire. */
    const lastCancelledBagDragRef = useRef<{ itemUid: string; item: { itemId: number; itemUid: string }; itemType: ItemTypes; timestamp: number } | null>(null);
    const isSecondClickOfDoubleClickRef = useRef(false);
    /** When synthetic double-click handled consume/equip in mouseup, skip the native dblclick to avoid double-firing. */
    const skipNextDblclickRef = useRef(false);
    /** Debounce mouseLeave to avoid flicker when moving between overlapping items. */
    const hoverLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Right-click context menu for bag items. */
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: { itemId: number; itemUid: string };
    } | null>(null);
    const bagConfigMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            setDragGhostPortalTarget(
                fullscreenElement instanceof HTMLElement ? fullscreenElement : document.body,
            );
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    const clearHoverDebounced = useCallback(() => {
        if (hoverLeaveTimeoutRef.current) {
            clearTimeout(hoverLeaveTimeoutRef.current);
            hoverLeaveTimeoutRef.current = null;
        }
        hoverLeaveTimeoutRef.current = setTimeout(() => {
            hoverLeaveTimeoutRef.current = null;
            setInventoryItemHoverInfo(undefined);
        }, HOVER_LEAVE_DELAY_MS);
    }, []);

    const cancelHoverClear = useCallback(() => {
        if (hoverLeaveTimeoutRef.current) {
            clearTimeout(hoverLeaveTimeoutRef.current);
            hoverLeaveTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (hoverLeaveTimeoutRef.current) clearTimeout(hoverLeaveTimeoutRef.current);
            setInventoryItemHoverInfo(undefined);
        };
    }, []);

    useEffect(() => {
        if (!bagConfigMenuOpen) return;
        const closeMenu = (e: MouseEvent) => {
            if (bagConfigMenuRef.current?.contains(e.target as Node)) {
                return;
            }
            setBagConfigMenuOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setBagConfigMenuOpen(false);
        };
        window.addEventListener('mousedown', closeMenu);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousedown', closeMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [bagConfigMenuOpen]);

    useEffect(() => {
        if (!contextMenu) return;
        const closeMenu = () => {
            setContextMenu(null);
            setInventoryItemHoverOverlaySuppressed(false);
        };
        const handleClick = () => closeMenu();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

    useEffect(() => {
        let isDisposed = false;
        const loadedKeys = new Set<string>();

        for (const item of baggedItems) {
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) {
                continue;
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getBagItemSpriteKeyWithOverrides(itemDef, gender, item.effectOverrides, groundItemDisplaySize);
            if (!spriteKey) {
                continue;
            }
            if (loadedKeys.has(spriteKey) || bagItemImageSizeCacheRef.current.has(spriteKey)) {
                continue;
            }
            const imageDataUrl = spriteFrameMap.get(spriteKey);
            if (imageDataUrl === undefined) {
                continue;
            }

            loadedKeys.add(spriteKey);
            const image = new Image();
            image.onload = () => {
                if (isDisposed) {
                    return;
                }
                bagItemImageSizeCacheRef.current.set(spriteKey, {
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                });
                setBagItemImageSizesVersion((version) => version + 1);
            };
            image.src = imageDataUrl;
        }

        return () => {
            isDisposed = true;
        };
    }, [baggedItems, playerGender, spriteFrameMap, groundItemDisplaySize]);

    const getBagItemDisplaySize = useCallback(
        (itemId: number, effectOverrides?: Effect[]) => {
            const baseItemSize = BAG_ITEM_DISPLAY_SIZE_PX[groundItemDisplaySize];
            const bagItem = ITEMS.find((i) => i.id === itemId);
            if (!bagItem) {
                return { width: baseItemSize, height: baseItemSize };
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getBagItemSpriteKeyWithOverrides(bagItem, gender, effectOverrides, groundItemDisplaySize);
            const naturalSize =
                spriteKey !== undefined
                    ? bagItemImageSizeCacheRef.current.get(spriteKey)
                    : undefined;
            const scale = bagItem.scale !== undefined ? bagItem.scale : 1;
            if (naturalSize === undefined) {
                return {
                    width: Math.max(1, Math.round(baseItemSize * scale)),
                    height: Math.max(1, Math.round(baseItemSize * scale)),
                };
            }
            const naturalMax = Math.max(naturalSize.width, naturalSize.height, 1);
            const fitScale = baseItemSize / naturalMax;
            return {
                width: Math.max(1, Math.round(naturalSize.width * fitScale * scale)),
                height: Math.max(1, Math.round(naturalSize.height * fitScale * scale)),
            };
        },
        [playerGender, groundItemDisplaySize],
    );

    const isItemEquippable = useCallback(
        (itemDef: { itemType: ItemTypes; gender?: Gender }) => {
            if (itemDef.itemType === ItemTypes.MISC) return false;
            const pg = playerGender ?? Gender.MALE;
            if (itemDef.gender !== undefined && itemDef.gender !== pg) return false;
            return true;
        },
        [playerGender],
    );

    const getItemImageUrl = useCallback(
        (itemId: number, effectOverrides?: Effect[]) => {
            const item = ITEMS.find((i) => i.id === itemId);
            if (!item) return undefined;
            const gender = playerGender ?? Gender.MALE;
            const key = getBagItemSpriteKeyWithOverrides(item, gender, effectOverrides, groundItemDisplaySize);
            if (!key) return undefined;
            return spriteFrameMap.get(key);
        },
        [playerGender, spriteFrameMap, groundItemDisplaySize],
    );

    const handleBagItemDoubleClick = useCallback(
        (item: { itemId: number; itemUid: string; quantity?: number }) => {
            if (skipNextDblclickRef.current) {
                skipNextDblclickRef.current = false;
                return;
            }
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) return;
            if (itemDef.itemType === ItemTypes.MISC && itemDef.consumable) {
                EventBus.emit(ITEM_CONSUMED_REQUESTED, { item });
                return;
            }
            if (itemDef.itemType === ItemTypes.MISC) return;
            const payload = itemDef.itemType === ItemTypes.RING
                ? { item, itemType: itemDef.itemType }
                : { item, itemType: itemDef.itemType };
            EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
        },
        [],
    );

    const handleBagItemMouseDown = useCallback(
        (e: React.MouseEvent, item: { itemId: number; itemUid: string; effectOverrides?: Effect[] }) => {
            if (e.button !== 0) return;
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) return;
            e.preventDefault();
            cancelHoverClear();
            setInventoryItemHoverInfo(undefined);
            EventBus.emit(ITEM_BAG_ITEM_BRING_TO_FRONT_REQUESTED, { itemUid: item.itemUid });
            isBagDropTargetRef.current = true;
            activeSlotDropTargetRef.current = null;
            setIsBagDropTarget(true);
            setActiveSlotDropTarget(null);
            dragStartPositionRef.current = { x: e.clientX, y: e.clientY };

            // Fallback: if previous click was cancelled (no movement) on same item within double-click window, treat as second click
            const now = Date.now();
            const last = lastCancelledBagDragRef.current;
            const isSecondClick =
                last !== null &&
                last.itemUid === item.itemUid &&
                now - last.timestamp <= DOUBLE_CLICK_WINDOW_MS;
            isSecondClickOfDoubleClickRef.current = isSecondClick;
            if (isSecondClick) {
                lastCancelledBagDragRef.current = null;
            }

            setDraggedItem({
                item,
                source: 'bag',
                itemType: itemDef.itemType,
            });
            setDragPosition({ x: e.clientX, y: e.clientY });
        },
        [cancelHoverClear],
    );

    useEffect(() => {
        if (!draggedItem) return;

        const handleMouseMove = (e: MouseEvent) => {
            setDragPosition({ x: e.clientX, y: e.clientY });
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const bagEl = bagAreaRef.current;
            const overBag = !!(bagEl && (el === bagEl || bagEl.contains(el)));
            const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
            const dialogRect = dialogEl?.getBoundingClientRect();
            const outsideDialog = dialogRect
                ? e.clientX < dialogRect.left ||
                  e.clientX > dialogRect.right ||
                  e.clientY < dialogRect.top ||
                  e.clientY > dialogRect.bottom
                : true;
            const dropToGround = draggedItem.source === 'bag' && outsideDialog;
            setIsDropToGroundIntent(dropToGround);
            isBagDropTargetRef.current = overBag && !dropToGround;
            setIsBagDropTarget(overBag && !dropToGround);

            let slotTarget: EquipmentSlot | null = null;
            if (!overBag && !dropToGround) {
                if (draggedItem.source === 'bag' && draggedItem.itemType === ItemTypes.RING) {
                    slotTarget = RING_SLOT_LEFT;
                } else if (draggedItem.source === 'bag' && draggedItem.itemType === ItemTypes.MISC) {
                    slotTarget = null; // MISC is not equippable
                } else if (draggedItem.source !== 'bag') {
                    slotTarget = draggedItem.source;
                } else {
                    slotTarget = draggedItem.itemType as EquipmentSlot;
                }
            }
            activeSlotDropTargetRef.current = slotTarget;
            setActiveSlotDropTarget(slotTarget);
        };

        const handleMouseUp = (e: MouseEvent) => {
            const dx = e.clientX - dragStartPositionRef.current.x;
            const dy = e.clientY - dragStartPositionRef.current.y;
            const hasMoved = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

            if (!hasMoved) {
                // No movement: cancel drag so double-click can equip or consume
                if (isSecondClickOfDoubleClickRef.current && draggedItem.source === 'bag') {
                    const itemDef = ITEMS.find((i) => i.id === draggedItem.item.itemId);
                    if (itemDef?.consumable && itemDef.itemType === ItemTypes.MISC) {
                        EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: draggedItem.item });
                        skipNextDblclickRef.current = true;
                    } else if (draggedItem.itemType !== ItemTypes.MISC) {
                        const payload = draggedItem.itemType === ItemTypes.RING
                            ? { item: draggedItem.item, itemType: draggedItem.itemType }
                            : { item: draggedItem.item, itemType: draggedItem.itemType };
                        EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
                        skipNextDblclickRef.current = true;
                    }
                } else if (draggedItem.source === 'bag') {
                    // First click cancelled - store for potential synthetic double-click
                    lastCancelledBagDragRef.current = {
                        itemUid: draggedItem.item.itemUid,
                        item: draggedItem.item,
                        itemType: draggedItem.itemType,
                        timestamp: Date.now(),
                    };
                }
                isSecondClickOfDoubleClickRef.current = false;
                setDraggedItem(null);
                setIsBagDropTarget(false);
                setIsDropToGroundIntent(false);
                setActiveSlotDropTarget(null);
                return;
            }

            lastCancelledBagDragRef.current = null;

            if (isBagDropTargetRef.current) {
                const bagEl = bagAreaRef.current;
                const rect = bagEl?.getBoundingClientRect();
                let bagX = rect ? e.clientX - rect.left : 0;
                let bagY = rect ? e.clientY - rect.top : 0;
                if (rect) {
                    const draggedItemDisplaySize = getBagItemDisplaySize(draggedItem.item.itemId, draggedItem.item.effectOverrides);
                    const clamped = clampBagPosition(
                        bagX,
                        bagY,
                        rect,
                        draggedItemDisplaySize.width,
                        draggedItemDisplaySize.height,
                    );
                    bagX = clamped.bagX;
                    bagY = clamped.bagY;
                }
                const slotForMove: EquipmentSlot = draggedItem.source === 'bag' ? (draggedItem.itemType as EquipmentSlot) : draggedItem.source;
                EventBus.emit(ITEM_MOVED_TO_BAG, {
                    itemUid: draggedItem.item.itemUid,
                    itemType: slotForMove,
                    bagX,
                    bagY,
                });
            } else if (draggedItem.source === 'bag') {
                const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
                const dialogRect = dialogEl?.getBoundingClientRect();
                const isOutsideDialog = dialogRect
                    ? e.clientX < dialogRect.left ||
                      e.clientX > dialogRect.right ||
                      e.clientY < dialogRect.top ||
                      e.clientY > dialogRect.bottom
                    : true;

                if (isOutsideDialog) {
                    EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, { itemUid: draggedItem.item.itemUid });
                } else if (draggedItem.itemType !== ItemTypes.MISC) {
                    // Dropped inside dialog but outside bag → equip to slot (MISC is not equippable)
                    const payload = draggedItem.itemType === ItemTypes.RING && activeSlotDropTargetRef.current
                        ? { item: draggedItem.item, itemType: draggedItem.itemType, targetSlot: activeSlotDropTargetRef.current }
                        : { item: draggedItem.item, itemType: draggedItem.itemType };
                    EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
                }
            }
            // Ring from slot dropped outside bag: snap back (do nothing, item stays in slot)
            setDraggedItem(null);
            setIsBagDropTarget(false);
            setIsDropToGroundIntent(false);
            setActiveSlotDropTarget(null);
        };

        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggedItem, getBagItemDisplaySize]);

    const bagBg = spriteFrameMap.get(BAG_DIALOG_BG);
    const tabLeftSprite = spriteFrameMap.get(BAG_TAB_LEFT);
    const tabRightSprite = spriteFrameMap.get(BAG_TAB_RIGHT);
    const configIconSprite = spriteFrameMap.get(BAG_CONFIG_ICON);
    const canDecreaseBagScale = bagScaleIndex > 0;
    const canIncreaseBagScale = bagScaleIndex < BAG_SCALE_LEVELS.length - 1;

    return (
        <HeadlessDraggableDialog
            position={position}
            id="inventory-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
            renderHeader={(listeners, attributes, isDragging) => (
                <div
                    className="bag-dialog-drag-handle"
                    title="Arrastrar ventana"
                    {...listeners}
                    {...attributes}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                />
            )}
        >
            <div
                className={`olympia-dialog-root bag-dialog-root${bagTransparent ? ' bag-dialog-transparent' : ''}`}
                style={{ ['--bag-scale' as string]: String(bagScale) }}
            >
                {bagBg && (
                    <div
                        className="bag-dialog-bg-layer"
                        style={{
                            backgroundImage: `url(${bagBg})`,
                            opacity: bagTransparent ? 0.45 : 1,
                        }}
                        aria-hidden
                    />
                )}
                <div className="bag-config-anchor" ref={bagConfigMenuRef}>
                    <button
                        type="button"
                        className="bag-config-btn"
                        title="Configuración de la bag"
                        onPointerDown={stopDialogPointer}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleBagConfigMenu();
                        }}
                    >
                        {configIconSprite ? (
                            <img src={configIconSprite} alt="" draggable={false} />
                        ) : (
                            <span className="bag-config-btn-fallback" aria-hidden>⚙</span>
                        )}
                    </button>
                    {bagConfigMenuOpen && (
                        <div className="bag-config-menu" onClick={(e) => e.stopPropagation()}>
                            <label className="bag-config-row">
                                <input
                                    type="checkbox"
                                    checked={bagTransparent}
                                    onChange={(e) => setBagTransparent(e.target.checked)}
                                />
                                <span>Bag traslúcida</span>
                            </label>
                            <div className="bag-config-row bag-config-scale-row">
                                <span>Tamaño bag</span>
                                <div className="bag-config-scale-controls">
                                    <button
                                        type="button"
                                        className="bag-config-scale-btn"
                                        disabled={!canDecreaseBagScale}
                                        onClick={decreaseBagScale}
                                        title="Achicar bag"
                                    >
                                        −
                                    </button>
                                    <span className="bag-config-scale-label">{Math.round(bagScale * 100)}%</span>
                                    <button
                                        type="button"
                                        className="bag-config-scale-btn"
                                        disabled={!canIncreaseBagScale}
                                        onClick={increaseBagScale}
                                        title="Agrandar bag"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="bag-config-row bag-config-size-row">
                                <span>Ítems en el suelo</span>
                                <div className="bag-config-size-options">
                                    {GROUND_ITEM_DISPLAY_SIZES.map((size) => (
                                        <button
                                            key={size}
                                            type="button"
                                            className={`bag-config-size-option${groundItemDisplaySize === size ? ' bag-config-size-option-active' : ''}`}
                                            onClick={() => {
                                                setGroundItemDisplaySize(size);
                                                persistBagGroundItemDisplaySize(size);
                                            }}
                                            title={GROUND_ITEM_DISPLAY_LABELS[size]}
                                        >
                                            {GROUND_ITEM_DISPLAY_LABELS[size]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {activeTab === 'bag' && (
                    <div className="bag-dialog-content" data-drop-to-ground={isDropToGroundIntent ? 'true' : undefined}>
                        <div
                            ref={bagAreaRef}
                            className={`inventory-bag-area bag-only-area${isBagDropTarget ? ' inventory-bag-area-drop-target' : ''}`}
                        >
                    {baggedItems.map((item) => {
                        const bagItem = ITEMS.find((i) => i.id === item.itemId);
                        const gender = playerGender ?? Gender.MALE;
                        const spriteKey = bagItem !== undefined
                            ? getBagItemSpriteKeyWithOverrides(bagItem, gender, item.effectOverrides, groundItemDisplaySize)
                            : undefined;
                        const imageDataUrl = spriteKey !== undefined ? spriteFrameMap.get(spriteKey) : undefined;
                        const isThisItemDragged =
                            draggedItem?.source === 'bag' &&
                            draggedItem.item.itemUid === item.itemUid;
                        const hasPosition = item.bagX !== undefined && item.bagY !== undefined;
                        const bagItemDisplaySize = getBagItemDisplaySize(item.itemId, item.effectOverrides);
                        return (
                            <div
                                key={item.itemUid}
                                className={`inventory-bag-item${displaySpritesInfo ? ' inventory-bag-item-debug' : ''}`}
                                onMouseDown={(e) => handleBagItemMouseDown(e, item)}
                                onDoubleClick={() => handleBagItemDoubleClick(item)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInventoryItemHoverInfo(undefined);
                                    setInventoryItemHoverOverlaySuppressed(true);
                                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                                }}
                                onMouseEnter={
                                    bagItem && !draggedItem && !contextMenu
                                        ? (e) => {
                                              cancelHoverClear();
                                              setInventoryItemHoverInfo(
                                                  buildInventoryItemHoverInfo(bagItem, item, e.clientX, e.clientY),
                                              );
                                          }
                                        : undefined
                                }
                                onMouseMove={
                                    bagItem && !draggedItem && !contextMenu
                                        ? (e) =>
                                              setInventoryItemHoverInfo(
                                                  buildInventoryItemHoverInfo(bagItem, item, e.clientX, e.clientY),
                                              )
                                        : undefined
                                }
                                onMouseLeave={() => clearHoverDebounced()}
                                style={{
                                    cursor: 'grab',
                                    left: hasPosition ? item.bagX : '50%',
                                    top: hasPosition ? item.bagY : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: bagItemDisplaySize.width,
                                    height: bagItemDisplaySize.height,
                                }}
                            >
                                {imageDataUrl ? (
                                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img
                                            src={imageDataUrl}
                                            alt={bagItem?.name ?? 'Item'}
                                            className="inventory-slot-item-image"
                                            draggable={false}
                                            style={{
                                                imageRendering: 'pixelated',
                                                visibility: isThisItemDragged ? 'hidden' : 'visible',
                                                width: '100%',
                                                height: '100%',
                                                maxWidth: 'none',
                                                maxHeight: 'none',
                                                objectFit: 'fill',
                                            }}
                                        />
                                        {bagItem?.stackable && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    bottom: -10,
                                                    right: -10,
                                                    fontSize: '16px',
                                                    fontWeight: 'bold',
                                                    color: 'var(--rpg-parchment)',
                                                    textShadow: '1px 1px 1px rgba(0,0,0,0.9)',
                                                    padding: '0 2px',
                                                    minWidth: '12px',
                                                    textAlign: 'right',
                                                    visibility: isThisItemDragged ? 'hidden' : 'visible',
                                                }}
                                            >
                                                {item.quantity ?? 1}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="inventory-slot-label" title={bagItem?.name}>
                                        ?
                                    </span>
                                )}
                            </div>
                        );
                    })}
                        </div>
                        <p className="bag-dialog-hint">Doble clic para equipar · Arrastrá fuera para tirar al suelo</p>
                    </div>
                )}

                {activeTab === 'itemDrops' && (
                    <div className="item-drops-panel">
                        <div className="item-drops-list">
                            {itemDropEntries.length === 0 ? (
                                <p className="item-drops-empty">Aún no hay drops importantes registrados.</p>
                            ) : (
                                itemDropEntries.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        className={`item-drops-row${entry.isRare ? ' item-drops-rare' : ''}`}
                                    >
                                        <span className="item-drops-name">{entry.itemName}</span>
                                        <span className="item-drops-meta">
                                            {entry.source === 'drop' ? 'Drop' : 'Pickup'} · {new Date(entry.timestamp).toLocaleTimeString()}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                        {itemDropEntries.length > 0 && (
                            <button type="button" className="bag-tab-text-btn" onClick={clearItemDropsLog}>
                                Limpiar
                            </button>
                        )}
                    </div>
                )}

                <div className="bag-dialog-tabs">
                    <button
                        type="button"
                        className={`bag-tab-btn${activeTab === 'bag' ? ' bag-tab-active' : ''}`}
                        onClick={() => setBagDialogTab('bag')}
                        onPointerDown={stopDialogPointer}
                        title="Bag"
                    >
                        {tabLeftSprite && activeTab === 'bag' ? (
                            <img src={tabLeftSprite} alt="Bag" draggable={false} />
                        ) : (
                            <span>Bag</span>
                        )}
                    </button>
                    <button
                        type="button"
                        className={`bag-tab-btn${activeTab === 'itemDrops' ? ' bag-tab-active' : ''}`}
                        onClick={() => setBagDialogTab('itemDrops')}
                        onPointerDown={stopDialogPointer}
                        title="Item Drops"
                    >
                        {tabRightSprite && activeTab === 'itemDrops' ? (
                            <img src={tabRightSprite} alt="Item Drops" draggable={false} />
                        ) : (
                            <span>Item Drops</span>
                        )}
                    </button>
                </div>
            </div>
            {draggedItem &&
                getItemImageUrl(draggedItem.item.itemId, draggedItem.item.effectOverrides) &&
                (() => {
                    const draggedItemDef = ITEMS.find((i) => i.id === draggedItem.item.itemId);
                    const itemScale = draggedItemDef?.scale ?? 1;
                    // For consistency: smaller items stay small, larger items scale down to fit
                    const ghostSize = itemScale < 1 ? DRAG_GHOST_SIZE * itemScale : DRAG_GHOST_SIZE;
                    const imageScale = itemScale > 1 ? 1 / itemScale : 1;
                    const draggedBagItem = draggedItem.source === 'bag'
                        ? baggedItems.find((b) => b.itemUid === draggedItem.item.itemUid)
                        : undefined;
                    const showQuantityOnGhost = draggedItemDef?.stackable && draggedBagItem;
                    const ghostQuantity = draggedBagItem?.quantity ?? 1;
                    return createPortal(
                        <div
                            className="inventory-drag-ghost"
                            style={{
                                left: dragPosition.x,
                                top: dragPosition.y,
                                width: ghostSize,
                                height: ghostSize,
                                zIndex: (zIndex ?? 10000) + 1000,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            <img
                                src={getItemImageUrl(draggedItem.item.itemId, draggedItem.item.effectOverrides)!}
                                alt=""
                                draggable={false}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated',
                                    pointerEvents: 'none',
                                    ...(imageScale !== 1 && { transform: `scale(${imageScale})` }),
                                }}
                            />
                            {showQuantityOnGhost && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        color: 'var(--rpg-parchment)',
                                        textShadow: '1px 1px 1px rgba(0,0,0,0.9)',
                                        padding: '0 2px',
                                        minWidth: '12px',
                                        textAlign: 'right',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {ghostQuantity}
                                </span>
                            )}
                        </div>,
                        dragGhostPortalTarget,
                    );
                })()}
            {contextMenu &&
                (() => {
                    const bagItemDef = ITEMS.find((i) => i.id === contextMenu.item.itemId);
                    const showEquip = bagItemDef ? isItemEquippable(bagItemDef) : false;
                    const showConsume = !!(bagItemDef?.itemType === ItemTypes.MISC && bagItemDef?.consumable);
                    const options: { label: string; onClick: () => void }[] = [];
                    if (showEquip) {
                        options.push({
                            label: 'Equip',
                            onClick: () => {
                                EventBus.emit(ITEM_EQUIP_REQUESTED, {
                                    item: contextMenu.item,
                                    itemType: bagItemDef!.itemType,
                                });
                            },
                        });
                    }
                    if (showConsume) {
                        options.push({
                            label: 'Consume',
                            onClick: () => EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: contextMenu.item }),
                        });
                    }
                    options.push({
                        label: 'Drop',
                        onClick: () => EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, { itemUid: contextMenu.item.itemUid }),
                    });
                    return createPortal(
                        <div
                            className="rpg-context-menu"
                            style={{
                                left: contextMenu.x,
                                top: contextMenu.y,
                                zIndex: (zIndex ?? 10000) + 2000,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {options.map((opt) => (
                                <div
                                    key={opt.label}
                                    className="rpg-context-menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        opt.onClick();
                                        setContextMenu(null);
                                        setInventoryItemHoverOverlaySuppressed(false);
                                    }}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>,
                        dragGhostPortalTarget,
                    );
                })()}
        </HeadlessDraggableDialog>
    );
}
