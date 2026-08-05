import { useCallback, useEffect, type MouseEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { inventoryDialogStore } from '../store/InventoryDialog.store';
import { appStore } from '../store/App.store';
import {
    getItemById,
    ItemTypes,
    EQUIPMENT_SLOT_TO_SLOT_ID,
    getItemInventorySpriteKeyWithOverrides,
    RING_SLOT_LEFT,
    RING_SLOT_RIGHT,
    type EquipmentSlot,
    type InventoryItem,
} from '../../constants/Items';
import { buildItemHoverInfo } from '../../constants/OlympiaItemName';
import { setInventoryItemHoverInfo } from '../store/InventoryItemHoverOverlay.store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_PAPERDOLL_CAPTURE, ITEM_MOVED_TO_BAG } from '../../constants/EventNames';
import { Gender, SkinColor } from '../../Types';
import { playerDialogStore } from '../store/PlayerDialog.store';
import {
    PAPERDOLL_BODY_KEY,
    PAPERDOLL_COMPOSITE_KEY,
    PAPERDOLL_HAIR_KEY,
    PAPERDOLL_UNDERWEAR_KEY,
} from '../../utils/paperDollCapture';

/**
 * Olympia F5: ONLY these 4 jewelry slots show inventory icons (round, left of figure).
 * Body gear is NEVER drawn as bag icons — only as layers on the real human composite.
 */
const ACCESSORY_SLOTS: EquipmentSlot[] = [
    ItemTypes.NECKLACE,
    RING_SLOT_LEFT,
    ItemTypes.ACCESSORY,
    ItemTypes.GEM,
];

function slotShortLabel(slot: EquipmentSlot): string {
    switch (slot) {
        case ItemTypes.ACCESSORY:
            return 'Ángel';
        case ItemTypes.GEM:
            return 'Gema';
        case ItemTypes.NECKLACE:
            return 'Cuello';
        case RING_SLOT_LEFT:
        case RING_SLOT_RIGHT:
            return 'Anillo';
        default:
            return EQUIPMENT_SLOT_TO_SLOT_ID[slot] ?? 'Slot';
    }
}

/**
 * F5 paper-doll — Olympia layout:
 * - Left: 4 round accessory slots (neck / ring / angel / gem) with bag icons
 * - Center: real idle-south composite (skin + gender + hair + underwear + worn gear)
 * - No body slot rectangles, no bag icons glued on chest/head/weapon
 */
export function CharacterPaperDoll() {
    const equippedItems = useStore(inventoryDialogStore, (s) => s.equippedItems);
    const playerGender = useStore(inventoryDialogStore, (s) => s.playerGender);
    const genderLook = useStore(playerDialogStore, (s) => s.gender);
    const skinColor = useStore(playerDialogStore, (s) => s.skinColor);
    const underwearColorIndex = useStore(playerDialogStore, (s) => s.underwearColorIndex);
    const hairStyleIndex = useStore(playerDialogStore, (s) => s.hairStyleIndex);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);

    // Re-capture avatar whenever looks/gear change (bursts while textures load).
    useEffect(() => {
        EventBus.emit(IN_UI_PAPERDOLL_CAPTURE);
        const bursts = [80, 250, 600, 1200, 2200, 4000].map((ms) =>
            window.setTimeout(() => EventBus.emit(IN_UI_PAPERDOLL_CAPTURE), ms),
        );
        return () => bursts.forEach((id) => window.clearTimeout(id));
    }, [genderLook, skinColor, underwearColorIndex, hairStyleIndex, equippedItems]);

    const resolveSlotItem = useCallback(
        (slot: EquipmentSlot): { slot: EquipmentSlot; equipped: InventoryItem | undefined } => {
            if (slot === RING_SLOT_LEFT) {
                const left = equippedItems[RING_SLOT_LEFT];
                if (left) {
                    return { slot: RING_SLOT_LEFT, equipped: left };
                }
                const right = equippedItems[RING_SLOT_RIGHT];
                if (right) {
                    return { slot: RING_SLOT_RIGHT, equipped: right };
                }
                return { slot: RING_SLOT_LEFT, equipped: undefined };
            }
            return { slot, equipped: equippedItems[slot] };
        },
        [equippedItems],
    );

    const getSlotVisual = useCallback(
        (slot: EquipmentSlot) => {
            const { slot: resolvedSlot, equipped } = resolveSlotItem(slot);
            const itemDef = equipped !== undefined ? getItemById(equipped.itemId) : undefined;
            const gender = playerGender ?? Gender.MALE;
            const spriteKey =
                itemDef !== undefined
                    ? getItemInventorySpriteKeyWithOverrides(
                        itemDef,
                        gender,
                        equipped?.effectOverrides,
                        equipped?.itemColor,
                    )
                    : undefined;
            const imageDataUrl = spriteKey !== undefined ? spriteFrameMap.get(spriteKey) : undefined;
            return { resolvedSlot, equipped, itemDef, imageDataUrl };
        },
        [playerGender, resolveSlotItem, spriteFrameMap],
    );

    const unequipSlot = useCallback(
        (slot: EquipmentSlot) => {
            const { resolvedSlot, equipped } = getSlotVisual(slot);
            if (!equipped) {
                return;
            }
            EventBus.emit(ITEM_MOVED_TO_BAG, {
                itemUid: equipped.itemUid,
                itemType: resolvedSlot,
                bagX: equipped.bagX,
                bagY: equipped.bagY,
            });
        },
        [getSlotVisual],
    );

    const bindHover = useCallback(
        (slot: EquipmentSlot) => {
            const { equipped, itemDef } = getSlotVisual(slot);
            if (!equipped || !itemDef) {
                return {
                    onMouseEnter: undefined as ((e: MouseEvent) => void) | undefined,
                    onMouseMove: undefined as ((e: MouseEvent) => void) | undefined,
                    onMouseLeave: () => setInventoryItemHoverInfo(undefined),
                };
            }
            const pushHover = (clientX: number, clientY: number) => {
                setInventoryItemHoverInfo(
                    buildItemHoverInfo(itemDef, {
                        itemId: equipped.itemId,
                        itemUid: equipped.itemUid,
                        itemAttribute: equipped.itemAttribute,
                        itemColor: equipped.itemColor,
                        effectOverrides: equipped.effectOverrides,
                        quantity: equipped.quantity,
                        source: 'equipped',
                        mouseX: clientX,
                        mouseY: clientY,
                    }),
                );
            };
            return {
                onMouseEnter: (e: MouseEvent) => pushHover(e.clientX, e.clientY),
                onMouseMove: (e: MouseEvent) => pushHover(e.clientX, e.clientY),
                onMouseLeave: () => setInventoryItemHoverInfo(undefined),
            };
        },
        [getSlotVisual],
    );

    const renderAccessory = (slot: EquipmentSlot) => {
        const { imageDataUrl, equipped } = getSlotVisual(slot);
        const label = slotShortLabel(slot);
        const hover = bindHover(slot);
        const filled = Boolean(equipped && imageDataUrl);

        return (
            <button
                key={slot}
                type="button"
                data-slot-type={slot}
                title={filled ? `${label} — doble clic para desequipar` : label}
                className={`character-paperdoll-acc character-paperdoll-acc-${EQUIPMENT_SLOT_TO_SLOT_ID[slot]}${filled ? ' is-filled' : ''}`}
                onDoubleClick={() => unequipSlot(slot)}
                onMouseEnter={hover.onMouseEnter}
                onMouseMove={hover.onMouseMove}
                onMouseLeave={hover.onMouseLeave}
            >
                {filled ? (
                    <img
                        src={imageDataUrl}
                        alt={label}
                        className="character-paperdoll-acc-img"
                        draggable={false}
                    />
                ) : (
                    <span className="character-paperdoll-acc-empty" aria-hidden />
                )}
            </button>
        );
    };

    const genderClass = genderLook === Gender.FEMALE ? 'is-female' : 'is-male';
    const skinClass =
        skinColor === SkinColor.Dark
            ? 'is-skin-dark'
            : skinColor === SkinColor.Tanned
              ? 'is-skin-tanned'
              : 'is-skin-light';

    const compositeUrl = spriteFrameMap.get(PAPERDOLL_COMPOSITE_KEY);
    const bodyUrl = spriteFrameMap.get(PAPERDOLL_BODY_KEY);
    const hairUrl = spriteFrameMap.get(PAPERDOLL_HAIR_KEY);
    const underwearUrl = spriteFrameMap.get(PAPERDOLL_UNDERWEAR_KEY);
    const hasComposite = Boolean(compositeUrl && compositeUrl.length > 32);
    const hasBody = Boolean(bodyUrl && bodyUrl.length > 32);
    const hasRealBody = hasComposite || hasBody;

    return (
        <div
            className={`character-paperdoll character-paperdoll--olympia ${genderClass} ${skinClass}${hasComposite ? ' character-paperdoll--composite' : ''}${!hasRealBody ? ' character-paperdoll--loading' : ''}`}
            title="Figura = mismo sprite que en el mapa (ropa real, no íconos de bolsa)"
        >
            {/* ONLY jewelry icons — never body gear boxes */}
            <div className="character-paperdoll-accessories" aria-label="Accesorios">
                {ACCESSORY_SLOTS.map((slot) => renderAccessory(slot))}
            </div>

            <div className="character-paperdoll-stage">
                <div className="character-paperdoll-avatar" aria-hidden>
                    {hasComposite ? (
                        <img
                            src={compositeUrl}
                            alt=""
                            className="character-paperdoll-layer-composite"
                            draggable={false}
                        />
                    ) : hasBody ? (
                        <div className="character-paperdoll-real-layers">
                            <img
                                src={bodyUrl}
                                alt=""
                                className="character-paperdoll-layer character-paperdoll-layer-body"
                                draggable={false}
                            />
                            {underwearUrl ? (
                                <img
                                    src={underwearUrl}
                                    alt=""
                                    className="character-paperdoll-layer character-paperdoll-layer-uw"
                                    draggable={false}
                                />
                            ) : null}
                            {hairUrl ? (
                                <img
                                    src={hairUrl}
                                    alt=""
                                    className="character-paperdoll-layer character-paperdoll-layer-hair"
                                    draggable={false}
                                />
                            ) : null}
                        </div>
                    ) : (
                        <div className="character-paperdoll-loading" role="status">
                            <span className="character-paperdoll-loading-dot" />
                            <span className="character-paperdoll-loading-label">Cargando figura…</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
