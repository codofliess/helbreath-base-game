/**
 * Compact bag + F5 mix for arena slim: tiny avatar + essential equip icons.
 * Collapsible via lateral “oreja” (ear tab) so the pocket keeps max space mid-duel.
 * Full paperdoll / jewelry grid intentionally omitted (CPU + space).
 */
import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useStore } from '@tanstack/react-store';
import { inventoryDialogStore } from '../store/InventoryDialog.store';
import { appStore } from '../store/App.store';
import { playerDialogStore } from '../store/PlayerDialog.store';
import {
    getItemById,
    getItemInventorySpriteKeyWithOverrides,
    ItemTypes,
    type EquipmentSlot,
    type InventoryItem,
} from '../../constants/Items';
import { buildItemHoverInfo } from '../../constants/OlympiaItemName';
import { setInventoryItemHoverInfo } from '../store/InventoryItemHoverOverlay.store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_PAPERDOLL_CAPTURE, ITEM_MOVED_TO_BAG } from '../../constants/EventNames';
import { Gender } from '../../Types';
import {
    PAPERDOLL_BODY_KEY,
    PAPERDOLL_COMPOSITE_KEY,
} from '../../utils/paperDollCapture';

const STORAGE_KEY = 'cl-arena-bag-mini-loadout-open';

/** Combat-critical slots only — small row next to the mini avatar. */
const COMBAT_SLOTS: EquipmentSlot[] = [
    ItemTypes.WEAPON,
    ItemTypes.SHIELD,
    ItemTypes.ARMOR,
    ItemTypes.HELMET,
    ItemTypes.HAUBERK,
    ItemTypes.LEGGINGS,
    ItemTypes.BOOTS,
    ItemTypes.CAPE,
];

function readStoredOpen(): boolean {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === '0' || raw === 'false') return false;
        if (raw === '1' || raw === 'true') return true;
    } catch {
        /* ignore */
    }
    // First visit: open so the player sees the strip once; they can collapse.
    return true;
}

function slotTinyLabel(slot: EquipmentSlot): string {
    switch (slot) {
        case ItemTypes.WEAPON:
            return 'W';
        case ItemTypes.SHIELD:
            return 'S';
        case ItemTypes.ARMOR:
            return 'A';
        case ItemTypes.HELMET:
            return 'H';
        case ItemTypes.HAUBERK:
            return 'Hb';
        case ItemTypes.LEGGINGS:
            return 'L';
        case ItemTypes.BOOTS:
            return 'B';
        case ItemTypes.CAPE:
            return 'C';
        default:
            return '?';
    }
}

export function ArenaBagMiniLoadout() {
    const [open, setOpen] = useState(readStoredOpen);

    const equippedItems = useStore(inventoryDialogStore, (s) => s.equippedItems);
    const playerGender = useStore(inventoryDialogStore, (s) => s.playerGender);
    const genderLook = useStore(playerDialogStore, (s) => s.gender);
    const skinColor = useStore(playerDialogStore, (s) => s.skinColor);
    const underwearColorIndex = useStore(playerDialogStore, (s) => s.underwearColorIndex);
    const hairStyleIndex = useStore(playerDialogStore, (s) => s.hairStyleIndex);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);

    const toggleOpen = useCallback(() => {
        setOpen((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    // Light capture only when strip is open (arena CPU budget).
    useEffect(() => {
        if (!open) return;
        EventBus.emit(IN_UI_PAPERDOLL_CAPTURE);
        const t1 = window.setTimeout(() => EventBus.emit(IN_UI_PAPERDOLL_CAPTURE), 200);
        const t2 = window.setTimeout(() => EventBus.emit(IN_UI_PAPERDOLL_CAPTURE), 900);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
        };
    }, [open, genderLook, skinColor, underwearColorIndex, hairStyleIndex, equippedItems]);

    const gender = playerGender ?? Gender.MALE;

    const slotVisual = useCallback(
        (slot: EquipmentSlot) => {
            const equipped = equippedItems[slot] as InventoryItem | undefined;
            const itemDef = equipped ? getItemById(equipped.itemId) : undefined;
            const spriteKey =
                itemDef && equipped
                    ? getItemInventorySpriteKeyWithOverrides(
                        itemDef,
                        gender,
                        equipped.effectOverrides,
                        equipped.itemColor,
                    )
                    : undefined;
            const imageDataUrl = spriteKey ? spriteFrameMap.get(spriteKey) : undefined;
            return { equipped, itemDef, imageDataUrl };
        },
        [equippedItems, gender, spriteFrameMap],
    );

    const unequip = useCallback((slot: EquipmentSlot, equipped: InventoryItem) => {
        EventBus.emit(ITEM_MOVED_TO_BAG, {
            itemUid: equipped.itemUid,
            itemType: slot,
            bagX: equipped.bagX,
            bagY: equipped.bagY,
        });
    }, []);

    const hover = useCallback(
        (slot: EquipmentSlot) => {
            const { equipped, itemDef } = slotVisual(slot);
            if (!equipped || !itemDef) {
                return {
                    onMouseEnter: undefined as ((e: MouseEvent) => void) | undefined,
                    onMouseMove: undefined as ((e: MouseEvent) => void) | undefined,
                    onMouseLeave: () => setInventoryItemHoverInfo(undefined),
                };
            }
            const push = (clientX: number, clientY: number) => {
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
                onMouseEnter: (e: MouseEvent) => push(e.clientX, e.clientY),
                onMouseMove: (e: MouseEvent) => push(e.clientX, e.clientY),
                onMouseLeave: () => setInventoryItemHoverInfo(undefined),
            };
        },
        [slotVisual],
    );

    const compositeUrl = spriteFrameMap.get(PAPERDOLL_COMPOSITE_KEY);
    const bodyUrl = spriteFrameMap.get(PAPERDOLL_BODY_KEY);
    const avatarUrl =
        compositeUrl && compositeUrl.length > 32
            ? compositeUrl
            : bodyUrl && bodyUrl.length > 32
              ? bodyUrl
              : undefined;

    return (
        <div
            className={`arena-bag-mini-loadout${open ? ' is-open' : ' is-collapsed'}`}
            aria-label="Loadout rápido (duelo)"
        >
            {/* Lateral “oreja”: always visible; click expands / collapses the F5 strip */}
            <button
                type="button"
                className="arena-bag-mini-ear"
                onClick={toggleOpen}
                aria-expanded={open}
                aria-controls="arena-bag-mini-panel"
                title={open ? 'Contraer equipo (F5 mini)' : 'Expandir equipo (F5 mini)'}
            >
                <span className="arena-bag-mini-ear-arrow" aria-hidden>
                    {open ? '◂' : '▸'}
                </span>
                <span className="arena-bag-mini-ear-label" aria-hidden>
                    EQ
                </span>
            </button>

            <div
                id="arena-bag-mini-panel"
                className="arena-bag-mini-panel"
                hidden={!open}
                aria-hidden={!open}
            >
                <div className="arena-bag-mini-avatar" title="Tu figura (equipo real)">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="" draggable={false} className="arena-bag-mini-avatar-img" />
                    ) : (
                        <span className="arena-bag-mini-avatar-placeholder" aria-hidden>
                            …
                        </span>
                    )}
                </div>
                <div className="arena-bag-mini-slots" role="list">
                    {COMBAT_SLOTS.map((slot) => {
                        const { equipped, imageDataUrl } = slotVisual(slot);
                        const h = hover(slot);
                        const label = slotTinyLabel(slot);
                        const filled = Boolean(equipped && imageDataUrl);
                        return (
                            <button
                                key={slot}
                                type="button"
                                role="listitem"
                                className={`arena-bag-mini-slot${filled ? ' is-filled' : ''}`}
                                title={
                                    filled
                                        ? `${label} — doble clic desequipar`
                                        : `${label} vacío`
                                }
                                onDoubleClick={() => {
                                    if (equipped) {
                                        unequip(slot, equipped);
                                    }
                                }}
                                onMouseEnter={h.onMouseEnter}
                                onMouseMove={h.onMouseMove}
                                onMouseLeave={h.onMouseLeave}
                            >
                                {filled ? (
                                    <img src={imageDataUrl} alt={label} draggable={false} />
                                ) : (
                                    <span className="arena-bag-mini-slot-empty">{label}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
