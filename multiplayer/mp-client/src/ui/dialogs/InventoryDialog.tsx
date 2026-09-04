import { useStore } from '@tanstack/react-store';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { OlympiaDialogShell, stopOlympiaPointer } from '../components/OlympiaDialogShell';
import { ArenaBagMiniLoadout } from '../components/ArenaBagMiniLoadout';
import { inventoryDialogStore, setBagDialogTab } from '../store/InventoryDialog.store';
import { openAuctionBoard } from '../store/AuctionBoardDialog.store';
import { itemDropsStore, clearItemDropsLog, selectItemDropEntry, removeItemDropEntry } from '../store/ItemDrops.store';
import { nftClaimsStore, refreshNftClaims } from '../store/NftClaims.store';
import { appStore } from '../store/App.store';
import { characterDialogStore } from '../store/CharacterDialog.store';
import { chatTranslationStore } from '../store/ChatTranslation.store';
import { getChatLanguageById } from '../../constants/ChatLanguages';
import { BAG_CONFIG_ICON, BAG_DIALOG_BG, ITEM_DROPS_DIALOG_BG } from '../../constants/SpriteKeys';
import { mapDialogStore } from '../store/MapDialog.store';
import {
    BAG_DIM_LEVELS,
    BAG_SCALE_LEVELS,
    BAG_SECTOR_LABELS,
    BAG_SECTORS,
    bagSettingsStore,
    decreaseBagScale,
    increaseBagScale,
    markBagBeginnerTipSeen,
    setBagConfigMenuOpen,
    setBagHeightIndex,
    setBagWidthIndex,
    setGeneralDropSector,
    setPotionAutoArrange,
    setPotionSector,
    toggleBagConfigMenu,
    toggleBagTransparent,
    type BagSector,
} from '../store/BagSettings.store';
import {
    BAG_GOLD_ITEM_ID,
    BAG_ITEM_DISPLAY_MAX_PX,
    BAG_ITEM_DISPLAY_SIZE_PX,
} from '../../constants/GroundItemDisplay';
import { OLYMPIA_DIALOG_SIZE, OLYMPIA_UI_SCALE } from '../../constants/OlympiaUiScale';
import {
    ITEMS,
    getItemById,
    ItemTypes,
    getBagItemSpriteKeyWithOverrides,
    RING_SLOT_LEFT,
    isEquipmentSlot,
    isItemTypeCompatibleWithSlot,
    isBagConsumableItem,
    STONE_OF_INTEGRITY_ITEM_ID,
    type Effect,
    type EquipmentSlot,
    type InventoryItem,
} from '../../constants/Items';
import {
    evaluateOlympiaDropRarity,
    type OlympiaDropRarity,
} from '../../utils/olympiaDropRules';
import { EventBus } from '../../game/EventBus';
import {
    ITEM_MOVED_TO_BAG,
    ITEM_EQUIP_REQUESTED,
    ITEM_BAG_ITEM_BRING_TO_FRONT_REQUESTED,
    ITEM_CONSUMED_REQUESTED,
    ITEM_DROP_TO_GROUND_REQUESTED,
    IN_UI_MAJESTIC_UPGRADE,
    IN_UI_STONE_ITEM_UPGRADE,
    IN_UI_ITEM_DISENCHANT,
    IN_UI_ITEM_ENCHANT,
    IN_UI_CIC_ITEM_MERGE,
    IN_UI_SIPHON_GEM_UPGRADE,
    SELL_BAG_ITEM_RESULT,
    TOAST_REQUESTED,
    OUT_SPRITE_FRAME_EXTRACTED,
    type SellBagItemResultEvent,
} from '../../constants/EventNames';
import { setInventoryItemHoverInfo, setInventoryItemHoverOverlaySuppressed, pinInventoryItemHoverInfo, clearInventoryItemHoverInfo } from '../store/InventoryItemHoverOverlay.store';
import { buildInventoryItemHoverInfo, getOlympiaItemDisplay } from '../../constants/OlympiaItemName';
import { setRecentShortCut } from '../store/ShortCut.store';
import { getStoredWalletPubkey } from '../../utils/walletAuth';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { estimateOlympiaItemRecycle } from '../../utils/olympiaItemRecycle';
import { quoteOlympiaSellGold } from '../../utils/olympiaSellPrice';
import { formatOlympiaCompactAmount } from '../../utils/olympiaFormat';
import { getOlympiaItemPriceCatalog } from '../../utils/olympiaItemPriceCatalog';
import { isPostTestNftMintEligible } from '../../utils/olympiaDropRules';
import type { IRefPhaserGame } from '../../PhaserGame';
import { loadItemIconAssetsOnDemand } from '../../utils/ItemIconAssets';
import { Gender } from '../../Types';
import type { ItemDropLogEntry } from '../store/ItemDrops.store';

interface InventoryDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
    /** Native title-bar drag — App writes inventoryDialogPosition. */
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: RefObject<IRefPhaserGame | null>;
    /**
     * Arena slim: bag pocket only — no Item Drops / Auction tabs (equip sets mid-duel).
     */
    simpleBagOnly?: boolean;
}

function stopDialogPointer(e: PointerEvent) {
    stopOlympiaPointer(e);
}

const DRAG_GHOST_SIZE = 48;
const BAG_PADDING = 8;
/** Minimum pixel movement to treat as a drag; below this, release cancels drag (allows double-click to equip). */
const DRAG_THRESHOLD_PX = 8;
/** Max ms between two clicks to treat as double-click (fallback when browser dblclick doesn't fire). */
const DOUBLE_CLICK_WINDOW_MS = 400;
/** Delay before clearing hover overlay on mouseLeave - reduces flicker when moving between overlapping items. */
const HOVER_LEAVE_DELAY_MS = 50;
/**
 * Olympia-style pile radius (px at bag scale 1× UI scale 1).
 * Items within this distance of the clicked item count as one "pilon" for Ctrl+equip-all.
 */
const BAG_PILE_RADIUS_PX = 16;
/** Equip order for Ctrl+pile (body before hands; rings last so both slots fill). */
const PILE_EQUIP_ORDER: ItemTypes[] = [
    ItemTypes.HELMET,
    ItemTypes.ARMOR,
    ItemTypes.HAUBERK,
    ItemTypes.LEGGINGS,
    ItemTypes.BOOTS,
    ItemTypes.CAPE,
    ItemTypes.ACCESSORY,
    ItemTypes.NECKLACE,
    ItemTypes.GEM,
    ItemTypes.SHIELD,
    ItemTypes.WEAPON,
    ItemTypes.RING,
];

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

/** Spread unpositioned bag items across the pocket instead of stacking at 50%/50%. */
function defaultBagSlotPosition(
    index: number,
    bagWidth: number,
    bagHeight: number,
    itemSize: number,
): { bagX: number; bagY: number } {
    const cell = Math.max(itemSize + 4, 28);
    const cols = Math.max(1, Math.floor((bagWidth - BAG_PADDING * 2) / cell));
    const col = index % cols;
    const row = Math.floor(index / cols);
    const bagX = BAG_PADDING + itemSize / 2 + col * cell;
    const bagY = BAG_PADDING + itemSize / 2 + row * cell;
    return {
        bagX: Math.round(Math.min(bagX, bagWidth - BAG_PADDING - itemSize / 2)),
        bagY: Math.round(Math.min(bagY, bagHeight - BAG_PADDING - itemSize / 2)),
    };
}

type DragSource = EquipmentSlot | 'bag';

/** Bag footer labels follow the user's preferred UI/chat language (SysMenu). */
function bagFooterLabels(languageId: string | undefined): {
    weight: string;
    items: string;
    gold: string;
} {
    const mt = getChatLanguageById(languageId)?.mtCode ?? 'en';
    if (mt === 'es') {
        return { weight: 'peso', items: 'items', gold: 'oro' };
    }
    if (mt === 'pt') {
        return { weight: 'peso', items: 'itens', gold: 'ouro' };
    }
    return { weight: 'weight', items: 'items', gold: 'gold' };
}

const BAG_MAX_ITEM_SLOTS = 50;

interface DraggedItem {
    item: {
        itemId: number;
        itemUid: string;
        effectOverrides?: Effect[];
        itemColor?: number;
        quantity?: number;
    };
    source: DragSource;
    itemType: ItemTypes;
}

export function InventoryDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
    simpleBagOnly = false,
}: InventoryDialogProps) {
    const activeTab = useStore(inventoryDialogStore, (state) => state.activeTab);
    const baggedItems = useStore(inventoryDialogStore, (state) => state.baggedItems);
    const equippedItems = useStore(inventoryDialogStore, (state) => state.equippedItems);
    const charStats = useStore(characterDialogStore, (state) => state.stats);
    const preferredLanguageId = useStore(chatTranslationStore, (s) => s.preferredLanguageId);
    const bagLabels = bagFooterLabels(preferredLanguageId);
    const itemDropEntries = useStore(itemDropsStore, (state) => state.entries);
    const selectedDropEntryId = useStore(itemDropsStore, (state) => state.selectedEntryId);
    const nftClaims = useStore(nftClaimsStore, (state) => state);
    const walletPubkey = getStoredWalletPubkey();
    const playerGender = useStore(inventoryDialogStore, (state) => state.playerGender);
    const spriteFrameMap = useStore(appStore, (state) => state.spriteFrameMap);
    const displaySpritesInfo = useStore(mapDialogStore, (state) => state.debugMode);
    const groundItemDisplaySize = useStore(mapDialogStore, (state) => state.groundItemDisplaySize);
    const bagScaleIndex = useStore(bagSettingsStore, (state) => state.scaleIndex);
    const bagWidthIndex = useStore(bagSettingsStore, (state) => state.widthIndex);
    const bagHeightIndex = useStore(bagSettingsStore, (state) => state.heightIndex);
    const bagTransparent = useStore(bagSettingsStore, (state) => state.transparent);
    const bagConfigMenuOpen = useStore(bagSettingsStore, (state) => state.configMenuOpen);
    const generalDropSector = useStore(bagSettingsStore, (state) => state.generalDropSector);
    const potionSector = useStore(bagSettingsStore, (state) => state.potionSector);
    const potionAutoArrange = useStore(bagSettingsStore, (state) => state.potionAutoArrange);
    const bagScale = BAG_SCALE_LEVELS[bagScaleIndex];
    const bagWidthMult = BAG_DIM_LEVELS[bagWidthIndex];
    const bagHeightMult = BAG_DIM_LEVELS[bagHeightIndex];
    /** Capture once per dialog open so the tip stays visible for this open after we persist "seen". */
    const [showInlineBagTip] = useState(() => !bagSettingsStore.state.beginnerTipSeen);

    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [isBagDropTarget, setIsBagDropTarget] = useState(false);
    const [isDropToGroundIntent, setIsDropToGroundIntent] = useState(false);
    const [activeSlotDropTarget, setActiveSlotDropTarget] = useState<EquipmentSlot | null>(null);
    const [dragGhostPortalTarget, setDragGhostPortalTarget] = useState<HTMLElement>(document.body);
    const bagAreaRef = useRef<HTMLDivElement>(null);
    const isBagDropTargetRef = useRef(false);
    const activeSlotDropTargetRef = useRef<EquipmentSlot | null>(null);
    /** True when the pointer is over an equipment slot that rejects the dragged item type (e.g. weapon→ring). */
    const incompatibleSlotHoverRef = useRef(false);
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
    /** Removes bag-item document mouse listeners attached synchronously on mousedown. */
    const bagItemDragCleanupRef = useRef<(() => void) | null>(null);
    const baggedItemsRef = useRef(baggedItems);
    baggedItemsRef.current = baggedItems;
    /**
     * Olympia-style selected item: click (no drag) pins PutString-style detail until
     * another item is selected, context menu opens, or Escape / click-away.
     */
    const [selectedItemUid, setSelectedItemUid] = useState<string | null>(null);
    /** Right-click context menu for bag items. */
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: InventoryItem;
    } | null>(null);
    /** First bag item selected for CIC merge (second right-click completes). */
    const [cicMergePendingUid, setCicMergePendingUid] = useState<string | null>(null);
    /** Right-click context menu for Item Drops list / detail. */
    const [dropContextMenu, setDropContextMenu] = useState<{
        x: number;
        y: number;
        entryId: string;
    } | null>(null);
    /** Drop-log row to clear only after server confirms sell. */
    const pendingSellDropLogIdRef = useRef<{ dropLogId: string; itemUid: string } | null>(null);
    /**
     * Integrity reconfirm: stone in bag at upgrade time from +3 up.
     * Protects against retrocession (−1) and burn (+7+). Confirm before attempt.
     */
    const [integrityConfirm, setIntegrityConfirm] = useState<{
        itemUid: string;
        itemName: string;
        plusLevel: number;
    } | null>(null);
    /** Min +N where Integrity may be used (matches server IntegrityMinPlusLevel). */
    const INTEGRITY_MIN_PLUS = 3;
    /**
     * Explicit reconfirm for destructive bag actions on rare/legendary items
     * (disenchant destroys the item — never one-click).
     */
    const [dangerConfirm, setDangerConfirm] = useState<{
        title: string;
        body: string;
        confirmLabel: string;
        onConfirm: () => void;
    } | null>(null);

    const itemRarity = useCallback((item: InventoryItem): OlympiaDropRarity => {
        return evaluateOlympiaDropRarity(item.itemId, item.itemAttribute ?? 0, item.cicLevel ?? 0);
    }, []);

    /** Rare/legendary (or +3 upgraded gear) require an extra click-through. */
    const needsDangerConfirm = useCallback(
        (item: InventoryItem): boolean => {
            const r = itemRarity(item);
            if (r === 'rare' || r === 'legendary') {
                return true;
            }
            const plus = ((item.itemAttribute ?? 0) >>> 28) & 0xf;
            return plus >= 3;
        },
        [itemRarity],
    );

    const requestDangerousAction = useCallback(
        (item: InventoryItem, actionLabel: string, onConfirm: () => void) => {
            if (!needsDangerConfirm(item)) {
                onConfirm();
                return;
            }
            const def = getItemById(item.itemId);
            const plus = ((item.itemAttribute ?? 0) >>> 28) & 0xf;
            const rarity = itemRarity(item);
            const rarityLabel =
                rarity === 'legendary' ? 'LEGENDARY' : rarity === 'rare' ? 'RARE' : `+${plus}`;
            setDangerConfirm({
                title: `Confirm ${actionLabel}`,
                body:
                    `This will DESTROY or permanently change "${def?.name ?? 'item'}"` +
                    (plus > 0 ? ` (+${plus})` : '') +
                    ` [${rarityLabel}]. This cannot be undone. Are you sure?`,
                confirmLabel: `Yes — ${actionLabel}`,
                onConfirm: () => {
                    setDangerConfirm(null);
                    onConfirm();
                },
            });
        },
        [needsDangerConfirm, itemRarity],
    );

    useEffect(() => {
        if (activeTab !== 'itemDrops') {
            return;
        }
        void refreshNftClaims(walletPubkey);
    }, [activeTab, walletPubkey]);

    useEffect(() => {
        const game = phaserRef?.current?.game;
        const scene = game?.scene?.getScene('GameWorld');
        if (!scene) {
            return;
        }
        void loadItemIconAssetsOnDemand(scene).catch((error) => {
            console.warn('[InventoryDialog] Failed to lazy-load item icon packs', error);
        });
    }, [phaserRef]);

    useEffect(() => {
        const onSellResult = (ev: SellBagItemResultEvent) => {
            const pending = pendingSellDropLogIdRef.current;
            if (!pending) {
                return;
            }
            if (ev.ok && (!ev.itemUid || ev.itemUid === pending.itemUid)) {
                removeItemDropEntry(pending.dropLogId);
            }
            pendingSellDropLogIdRef.current = null;
        };
        EventBus.on(SELL_BAG_ITEM_RESULT, onSellResult);
        return () => {
            EventBus.off(SELL_BAG_ITEM_RESULT, onSellResult);
        };
    }, []);

    useEffect(() => {
        if (activeTab !== 'itemDrops' || itemDropEntries.length === 0) {
            return;
        }
        if (selectedDropEntryId === undefined) {
            selectItemDropEntry(itemDropEntries[0]?.id);
            return;
        }
        const stillSelected = itemDropEntries.some((e) => e.id === selectedDropEntryId);
        if (!stillSelected) {
            selectItemDropEntry(itemDropEntries[0]?.id);
        }
    }, [activeTab, itemDropEntries, selectedDropEntryId]);

    // Persist "tip seen" on first display so later F6 opens only show help in the gear menu.
    useEffect(() => {
        if (showInlineBagTip) {
            markBagBeginnerTipSeen();
        }
    }, [showInlineBagTip]);

    const handleClose = useCallback(() => {
        setBagConfigMenuOpen(false);
        onClose();
    }, [onClose]);

    // Close gear popover on outside click / Escape.
    useEffect(() => {
        if (!bagConfigMenuOpen) {
            return;
        }
        const closeMenu = (e: Event) => {
            const t = e.target;
            if (t instanceof Element && t.closest('.bag-corner-controls')) {
                return;
            }
            setBagConfigMenuOpen(false);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setBagConfigMenuOpen(false);
            }
        };
        const timer = window.setTimeout(() => {
            window.addEventListener('pointerdown', closeMenu, true);
        }, 0);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('pointerdown', closeMenu, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [bagConfigMenuOpen]);

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
            // Never wipe a click-pinned GetItemName overlay on mouseLeave.
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
            clearInventoryItemHoverInfo();
            bagItemDragCleanupRef.current?.();
            bagItemDragCleanupRef.current = null;
        };
    }, []);

    // Click-away / Escape clears pinned detail + context menus.
    useEffect(() => {
        if (!contextMenu && !selectedItemUid && !dropContextMenu) return;
        const closeMenu = () => {
            setContextMenu(null);
            setDropContextMenu(null);
            setSelectedItemUid(null);
            clearInventoryItemHoverInfo();
        };
        const handlePointerDown = (e: PointerEvent) => {
            const t = e.target;
            if (t instanceof Element && t.closest('.inventory-bag-item')) return;
            if (t instanceof Element && t.closest('.rpg-context-menu')) return;
            if (t instanceof Element && t.closest('.item-drops-row')) return;
            if (t instanceof Element && t.closest('.item-drops-section-detail')) return;
            closeMenu();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        const timer = window.setTimeout(() => {
            window.addEventListener('pointerdown', handlePointerDown, true);
        }, 0);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu, selectedItemUid, dropContextMenu]);

    useEffect(() => {
        let isDisposed = false;
        const loadedKeys = new Set<string>();

        for (const item of baggedItems) {
            const itemDef = getItemById(item.itemId);
            if (!itemDef) {
                continue;
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getBagItemSpriteKeyWithOverrides(
                itemDef,
                gender,
                item.effectOverrides,
                groundItemDisplaySize,
                item.itemColor,
            );
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
        (itemId: number, effectOverrides?: Effect[], itemColor?: number) => {
            /**
             * Gold (item 90) = size reference (natural, only down-clamped to tier cap).
             * Weapons/wands/armor/etc. upscale so their long edge matches that gold edge.
             * Do NOT inflate gold further.
             */
            const pocketScale = bagScale * OLYMPIA_UI_SCALE;
            const tierCap = BAG_ITEM_DISPLAY_SIZE_PX[groundItemDisplaySize] ?? BAG_ITEM_DISPLAY_MAX_PX;
            const maxEdge = Math.round(Math.min(tierCap, BAG_ITEM_DISPLAY_MAX_PX) * pocketScale);
            const bagItem = getItemById(itemId);
            if (!bagItem) {
                return { width: maxEdge, height: maxEdge };
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getBagItemSpriteKeyWithOverrides(
                bagItem,
                gender,
                effectOverrides,
                groundItemDisplaySize,
                itemColor,
            );
            const naturalSize =
                spriteKey !== undefined
                    ? bagItemImageSizeCacheRef.current.get(spriteKey)
                    : undefined;
            if (naturalSize === undefined) {
                return { width: maxEdge, height: maxEdge };
            }
            const catalogScale = bagItem.scale && bagItem.scale > 0 ? bagItem.scale : 1;
            // Aesthetic bias: potions read huge in raw frames; capes/wands read tiny.
            // Keep gold as reference; nudge other types toward Olympia bag feel.
            let typeBias = 1;
            const name = (bagItem.name || '').toLowerCase();
            const t = bagItem.itemType;
            if (
                bagItem.consumable ||
                name.includes('potion') ||
                name.includes('elixir') ||
                name.includes('pill')
            ) {
                typeBias = 0.58;
            } else if (t === ItemTypes.CAPE) {
                typeBias = 1.28;
            } else if (t === ItemTypes.WEAPON && (name.includes('wand') || name.includes('staff') || name.includes('ms'))) {
                typeBias = 1.35;
            } else if (t === ItemTypes.WEAPON) {
                typeBias = 1.12;
            } else if (t === ItemTypes.RING || t === ItemTypes.NECKLACE || t === ItemTypes.GEM) {
                typeBias = 0.78;
            } else if (t === ItemTypes.SHIELD) {
                typeBias = 1.08;
            } else if (t === ItemTypes.MISC) {
                typeBias = 0.85;
            }

            const visual = catalogScale * typeBias;
            const scaledW = naturalSize.width * pocketScale * visual;
            const scaledH = naturalSize.height * pocketScale * visual;
            const naturalMax = Math.max(scaledW, scaledH, 1);
            const isGold = itemId === BAG_GOLD_ITEM_ID;

            // Gold: natural size, only shrink if huge (no type bias).
            if (isGold) {
                const gw = naturalSize.width * pocketScale;
                const gh = naturalSize.height * pocketScale;
                const gmax = Math.max(gw, gh, 1);
                if (gmax <= maxEdge) {
                    return {
                        width: Math.max(1, Math.round(gw)),
                        height: Math.max(1, Math.round(gh)),
                    };
                }
                const gdown = maxEdge / gmax;
                return {
                    width: Math.max(1, Math.round(gw * gdown)),
                    height: Math.max(1, Math.round(gh * gdown)),
                };
            }

            // Fit long edge into tier cap after aesthetic bias.
            if (naturalMax <= maxEdge) {
                return {
                    width: Math.max(1, Math.round(scaledW)),
                    height: Math.max(1, Math.round(scaledH)),
                };
            }
            const fitScale = maxEdge / naturalMax;
            return {
                width: Math.max(1, Math.round(scaledW * fitScale)),
                height: Math.max(1, Math.round(scaledH * fitScale)),
            };
        },
        [playerGender, groundItemDisplaySize, bagScale],
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
        (itemId: number, effectOverrides?: Effect[], itemColor?: number) => {
            const item = getItemById(itemId);
            if (!item) return undefined;
            const gender = playerGender ?? Gender.MALE;
            const key = getBagItemSpriteKeyWithOverrides(
                item,
                gender,
                effectOverrides,
                groundItemDisplaySize,
                itemColor,
            );
            if (!key) return undefined;
            // Prefer pre-exported data URL; if missing, extract on demand from Phaser item-pack textures.
            const cached = spriteFrameMap.get(key);
            if (cached) return cached;
            const game = phaserRef?.current?.game;
            const scene = game?.scene?.getScenes?.(true)?.[0] as
                | { textures?: { exists: (k: string) => boolean; get: (k: string) => unknown } }
                | undefined;
            if (!scene?.textures) return undefined;
            const parts = key.split('-');
            // sprite-item-pack-{sheet}-{frame}[-{hexTint}]
            if (parts.length < 5 || parts[0] !== 'sprite' || parts[1] !== 'item' || parts[2] !== 'pack') {
                return undefined;
            }
            const sheet = Number(parts[3]);
            const frame = Number(parts[4]);
            const tintHex = parts.length >= 6 ? parts[5] : undefined;
            if (!Number.isFinite(sheet) || !Number.isFinite(frame)) return undefined;
            const texKey = `sprite-item-pack-${sheet}`;
            if (!scene.textures.exists(texKey)) return undefined;
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const texture = scene.textures.get(texKey) as any;
                let fr = texture.get?.(frame);
                if (!fr || fr.cutWidth <= 0) fr = texture.get?.(0);
                if (!fr || fr.cutWidth <= 0) return undefined;
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, fr.cutWidth);
                canvas.height = Math.max(1, fr.cutHeight);
                const ctx = canvas.getContext('2d');
                if (!ctx) return undefined;
                ctx.imageSmoothingEnabled = false;
                const source = texture.getSourceImage?.() as CanvasImageSource;
                if (!source) return undefined;
                ctx.drawImage(source, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
                // Olympia poison/color tiers + TINT_INVENTORY: multiply tint on demand.
                if (tintHex && /^[0-9a-fA-F]{6}$/.test(tintHex)) {
                    ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = `#${tintHex}`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.globalCompositeOperation = 'destination-in';
                    ctx.drawImage(source, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
                    ctx.globalCompositeOperation = 'source-over';
                }
                const dataUrl = canvas.toDataURL('image/png');
                EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, key, dataUrl);
                return dataUrl;
            } catch {
                return undefined;
            }
        },
        [playerGender, spriteFrameMap, groundItemDisplaySize, phaserRef],
    );

    const handleBagItemDoubleClick = useCallback(
        (item: { itemId: number; itemUid: string; quantity?: number }) => {
            if (skipNextDblclickRef.current) {
                skipNextDblclickRef.current = false;
                return;
            }
            const itemDef = getItemById(item.itemId);
            if (!itemDef) return;
            if (isBagConsumableItem(itemDef, item.itemId)) {
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
        (e: ReactMouseEvent, item: {
            itemId: number;
            itemUid: string;
            effectOverrides?: Effect[];
            itemColor?: number;
            quantity?: number;
        }) => {
            if (e.button !== 0) return;
            const itemDef = getItemById(item.itemId);
            if (!itemDef) return;
            e.preventDefault();
            cancelHoverClear();
            bagItemDragCleanupRef.current?.();

            // Shift+click: stack all identical items onto this pile (Olympia bag merge).
            if (e.shiftKey && itemDef.stackable) {
                const game = phaserRef?.current?.game;
                const nm = game ? getNetworkManager(game) : undefined;
                // Sentinel bag coords −1000/−1000 = server TryStackAllMatchingAt
                nm?.sendMoveItemInBagRequest?.(item.itemUid, -1000, -1000);
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Stacked all ${itemDef.name}`,
                    severity: 'info',
                });
                return;
            }

            // Ctrl+click: equip entire pile at this bag location (Olympia loadout piles).
            // Group gear by function (e.g. HP regen set stacked together), then one Ctrl+click equips all.
            if (e.ctrlKey || e.metaKey) {
                const bagEl = bagAreaRef.current;
                const bagW = bagEl?.clientWidth ?? Math.round(148 * bagScale * OLYMPIA_UI_SCALE);
                const bagH = bagEl?.clientHeight ?? Math.round(120 * bagScale * OLYMPIA_UI_SCALE);
                const pocketScale = bagScale * OLYMPIA_UI_SCALE;
                const pileRadius = BAG_PILE_RADIUS_PX * pocketScale;

                const resolvePos = (it: InventoryItem, index: number) => {
                    const size = getBagItemDisplaySize(it.itemId, it.effectOverrides, it.itemColor);
                    const fallback = defaultBagSlotPosition(
                        index,
                        bagW,
                        bagH,
                        Math.max(size.width, size.height),
                    );
                    return {
                        x: it.bagX !== undefined ? it.bagX : fallback.bagX,
                        y: it.bagY !== undefined ? it.bagY : fallback.bagY,
                    };
                };

                const bag = baggedItemsRef.current;
                const clickIndex = bag.findIndex((b) => b.itemUid === item.itemUid);
                const origin = resolvePos(item as InventoryItem, clickIndex >= 0 ? clickIndex : 0);
                const pile = bag.filter((other, idx) => {
                    const p = resolvePos(other, idx);
                    return Math.hypot(p.x - origin.x, p.y - origin.y) <= pileRadius;
                });

                const equippable = pile
                    .map((it) => {
                        const def = getItemById(it.itemId);
                        if (!def || def.itemType === ItemTypes.MISC) return null;
                        if (isBagConsumableItem(def, it.itemId)) return null;
                        if (!isItemEquippable(def)) return null;
                        return { item: it, def };
                    })
                    .filter((x): x is { item: InventoryItem; def: NonNullable<ReturnType<typeof getItemById>> } => x !== null)
                    .sort((a, b) => {
                        const ia = PILE_EQUIP_ORDER.indexOf(a.def.itemType);
                        const ib = PILE_EQUIP_ORDER.indexOf(b.def.itemType);
                        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
                    });

                if (equippable.length === 0) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'No equippable gear in this pile',
                        severity: 'info',
                    });
                    return;
                }

                let equippedCount = 0;
                for (const row of equippable) {
                    EventBus.emit(ITEM_EQUIP_REQUESTED, {
                        item: row.item,
                        itemType: row.def.itemType,
                    });
                    equippedCount += 1;
                }
                EventBus.emit(TOAST_REQUESTED, {
                    message:
                        equippedCount === 1
                            ? `Equipped ${equippable[0].def.name}`
                            : `Equipped pile · ${equippedCount} items`,
                    severity: 'info',
                });
                return;
            }

            // Olympia: selecting an item shows GetItemName at cursor; pin on click-without-drag in mouseup.
            const pressInfo = buildInventoryItemHoverInfo(itemDef, item, e.clientX, e.clientY);
            pinInventoryItemHoverInfo(pressInfo);
            setSelectedItemUid(item.itemUid);
            setRecentShortCut({ kind: 'item', itemId: item.itemId });
            EventBus.emit(ITEM_BAG_ITEM_BRING_TO_FRONT_REQUESTED, { itemUid: item.itemUid });
            isBagDropTargetRef.current = true;
            activeSlotDropTargetRef.current = null;
            incompatibleSlotHoverRef.current = false;
            setIsBagDropTarget(true);
            setActiveSlotDropTarget(null);
            dragStartPositionRef.current = { x: e.clientX, y: e.clientY };

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

            const dragState: DraggedItem = {
                item,
                source: 'bag',
                itemType: itemDef.itemType,
            };
            setDraggedItem(dragState);
            setDragPosition({ x: e.clientX, y: e.clientY });

            // Attach move/up NOW (not in useEffect) — otherwise mouseup of this click is missed
            // and the item stays in "dragging" / detail never pins.
            const handleMouseMove = (ev: MouseEvent) => {
                setDragPosition({ x: ev.clientX, y: ev.clientY });
                const el = document.elementFromPoint(ev.clientX, ev.clientY);
                const bagEl = bagAreaRef.current;
                // Bag floor uses pointer-events:none so empty space can drag the window;
                // hit-test by geometry so drop-to-bag still works while moving items.
                const bagRect = bagEl?.getBoundingClientRect();
                const overBagByRect = !!(
                    bagRect &&
                    ev.clientX >= bagRect.left &&
                    ev.clientX <= bagRect.right &&
                    ev.clientY >= bagRect.top &&
                    ev.clientY <= bagRect.bottom
                );
                const overBag =
                    overBagByRect ||
                    !!(bagEl && el && (el === bagEl || bagEl.contains(el)));
                const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
                const dialogRect = dialogEl?.getBoundingClientRect();
                const outsideDialog = dialogRect
                    ? ev.clientX < dialogRect.left ||
                      ev.clientX > dialogRect.right ||
                      ev.clientY < dialogRect.top ||
                      ev.clientY > dialogRect.bottom
                    : true;
                const dropToGround = outsideDialog;
                setIsDropToGroundIntent(dropToGround);
                isBagDropTargetRef.current = overBag && !dropToGround;
                setIsBagDropTarget(overBag && !dropToGround);

                let slotTarget: EquipmentSlot | null = null;
                let incompatibleSlotHover = false;
                if (!overBag && !dropToGround) {
                    const slotEl = (el as Element | null)?.closest?.('[data-slot-type]') as HTMLElement | null;
                    const hoveredSlotValue = slotEl?.dataset.slotType;
                    if (hoveredSlotValue && isEquipmentSlot(hoveredSlotValue)) {
                        if (isItemTypeCompatibleWithSlot(dragState.itemType, hoveredSlotValue)) {
                            slotTarget = hoveredSlotValue;
                        } else {
                            incompatibleSlotHover = true;
                            slotTarget = null;
                        }
                    } else if (dragState.itemType === ItemTypes.RING) {
                        slotTarget = RING_SLOT_LEFT;
                    } else if (dragState.itemType === ItemTypes.MISC) {
                        slotTarget = null;
                    } else {
                        slotTarget = dragState.itemType as EquipmentSlot;
                    }
                }
                incompatibleSlotHoverRef.current = incompatibleSlotHover;
                activeSlotDropTargetRef.current = slotTarget;
                setActiveSlotDropTarget(slotTarget);
            };

            const cleanup = () => {
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                bagItemDragCleanupRef.current = null;
            };

            const handleMouseUp = (ev: MouseEvent) => {
                cleanup();
                const dx = ev.clientX - dragStartPositionRef.current.x;
                const dy = ev.clientY - dragStartPositionRef.current.y;
                const hasMoved = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

                if (!hasMoved) {
                    if (isSecondClickOfDoubleClickRef.current) {
                        if (isBagConsumableItem(itemDef, dragState.item.itemId)) {
                            EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: dragState.item });
                            skipNextDblclickRef.current = true;
                        } else if (dragState.itemType !== ItemTypes.MISC) {
                            EventBus.emit(ITEM_EQUIP_REQUESTED, {
                                item: dragState.item,
                                itemType: dragState.itemType,
                            });
                            skipNextDblclickRef.current = true;
                        }
                    } else {
                        lastCancelledBagDragRef.current = {
                            itemUid: dragState.item.itemUid,
                            item: dragState.item,
                            itemType: dragState.itemType,
                            timestamp: Date.now(),
                        };
                        const bagItem = baggedItemsRef.current.find((b) => b.itemUid === dragState.item.itemUid);
                        if (bagItem) {
                            setSelectedItemUid(dragState.item.itemUid);
                            pinInventoryItemHoverInfo(
                                buildInventoryItemHoverInfo(itemDef, bagItem, ev.clientX, ev.clientY),
                            );
                        }
                    }
                    isSecondClickOfDoubleClickRef.current = false;
                    setDraggedItem(null);
                    setIsBagDropTarget(false);
                    setIsDropToGroundIntent(false);
                    setActiveSlotDropTarget(null);
                    incompatibleSlotHoverRef.current = false;
                    return;
                }

                lastCancelledBagDragRef.current = null;
                setSelectedItemUid(null);
                clearInventoryItemHoverInfo();

                if (isBagDropTargetRef.current) {
                    const bagEl = bagAreaRef.current;
                    const rect = bagEl?.getBoundingClientRect();
                    let bagX = rect ? ev.clientX - rect.left : 0;
                    let bagY = rect ? ev.clientY - rect.top : 0;
                    if (rect) {
                        const draggedItemDisplaySize = getBagItemDisplaySize(
                            dragState.item.itemId,
                            dragState.item.effectOverrides,
                            dragState.item.itemColor,
                        );
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
                    EventBus.emit(ITEM_MOVED_TO_BAG, {
                        itemUid: dragState.item.itemUid,
                        itemType: dragState.itemType as EquipmentSlot,
                        bagX,
                        bagY,
                    });
                } else {
                    const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
                    const dialogRect = dialogEl?.getBoundingClientRect();
                    const isOutsideDialog = dialogRect
                        ? ev.clientX < dialogRect.left ||
                          ev.clientX > dialogRect.right ||
                          ev.clientY < dialogRect.top ||
                          ev.clientY > dialogRect.bottom
                        : true;

                    if (isOutsideDialog) {
                        EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, { itemUid: dragState.item.itemUid });
                    } else if (incompatibleSlotHoverRef.current) {
                        // Rejected slot — no-op.
                    } else if (dragState.itemType !== ItemTypes.MISC) {
                        const payload =
                            dragState.itemType === ItemTypes.RING && activeSlotDropTargetRef.current
                                ? {
                                      item: dragState.item,
                                      itemType: dragState.itemType,
                                      targetSlot: activeSlotDropTargetRef.current,
                                  }
                                : { item: dragState.item, itemType: dragState.itemType };
                        EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
                    }
                }
                setDraggedItem(null);
                setIsBagDropTarget(false);
                setIsDropToGroundIntent(false);
                setActiveSlotDropTarget(null);
                incompatibleSlotHoverRef.current = false;
            };

            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            bagItemDragCleanupRef.current = cleanup;
        },
        [cancelHoverClear, getBagItemDisplaySize, isItemEquippable, bagScale, phaserRef],
    );

    const bagBg = spriteFrameMap.get(BAG_DIALOG_BG);
    const dropsBg = spriteFrameMap.get(ITEM_DROPS_DIALOG_BG);
    const configIconSprite = spriteFrameMap.get(BAG_CONFIG_ICON);
    const pocketScale = bagScale * OLYMPIA_UI_SCALE;
    const isDropsTab = !simpleBagOnly && activeTab === 'itemDrops';
    const panelBg = isDropsTab ? dropsBg : bagBg;
    const canDecreaseBagScale = bagScaleIndex > 0;
    const canIncreaseBagScale = bagScaleIndex < BAG_SCALE_LEVELS.length - 1;
    const bagHelpText =
        'Ctrl+clic = equipar pilon · Doble clic = 1 item · Shift+clic = apilar · Arrastrá fuera = tirar';

    const selectedDropEntry =
        selectedDropEntryId !== undefined
            ? itemDropEntries.find((e) => e.id === selectedDropEntryId)
            : undefined;
    const matchingBagItem = selectedDropEntry
        ? findMatchingBagItem(selectedDropEntry, baggedItems)
        : undefined;
    const selectedDropDisplay = selectedDropEntry
        ? buildSelectedDropDisplay(selectedDropEntry)
        : undefined;
    const recycleEstimate = selectedDropEntry
        ? estimateOlympiaItemRecycle({
            itemId: selectedDropEntry.itemId,
            itemAttribute: selectedDropEntry.itemAttribute,
            nftTier: selectedDropEntry.nftTier,
        })
        : undefined;
    const sellQuote = matchingBagItem
        ? quoteSellForBagItem(matchingBagItem)
        : selectedDropEntry
            ? quoteSellForDropEntry(selectedDropEntry)
            : undefined;
    const canSellForGold = Boolean(matchingBagItem && sellQuote?.ok && (sellQuote.gold ?? 0) > 0);
    const selectedDropImageUrl = selectedDropEntry
        ? getItemImageUrl(
            selectedDropEntry.itemId,
            matchingBagItem?.effectOverrides,
            matchingBagItem?.itemColor ?? selectedDropEntry.itemColor,
        )
        : undefined;

    const requestSellBagItem = useCallback(
        (item: InventoryItem, dropLogId?: string) => {
            const quote = quoteSellForBagItem(item);
            if (!quote.ok || (quote.gold ?? 0) <= 0) {
                EventBus.emit(TOAST_REQUESTED, {
                    message: quote.error ?? 'That item has no sell value.',
                    severity: 'error',
                });
                return;
            }
            const game = phaserRef?.current?.game;
            const networkManager = game ? getNetworkManager(game) : undefined;
            if (!networkManager) {
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'Sin conexión al servidor para vender.',
                    severity: 'error',
                });
                return;
            }
            // Only remove drop-log row after server OK (SELL_BAG_ITEM_RESULT listener).
            if (dropLogId) {
                pendingSellDropLogIdRef.current = {
                    dropLogId,
                    itemUid: item.itemUid,
                };
            }
            const sent = networkManager.sendSellBagItemRequest(item.itemUid);
            if (!sent) {
                pendingSellDropLogIdRef.current = null;
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'No se pudo enviar la venta (¿estás en el mundo?).',
                    severity: 'error',
                });
            }
        },
        [phaserRef],
    );

    const handleVenderPorGold = useCallback(() => {
        if (!selectedDropEntry) {
            return;
        }
        if (!matchingBagItem || !canSellForGold) {
            EventBus.emit(TOAST_REQUESTED, {
                message: sellQuote?.error
                    ?? (matchingBagItem
                        ? 'Ese ítem no tiene valor de venta.'
                        : 'No está en la bolsa (¿ya lo tiraste?). Usá “A bag (usable)” para sacar el log.'),
                severity: 'error',
            });
            return;
        }
        requestSellBagItem(matchingBagItem, selectedDropEntry.id);
        setDropContextMenu(null);
    }, [selectedDropEntry, matchingBagItem, canSellForGold, sellQuote, requestSellBagItem]);

    /**
     * Item Drops log is a journal, not a second inventory.
     * "A bag" only dismisses the log row when the instance still exists (bag or equipped).
     * Never wipe the log entry if the item is missing — that looked like "it disappeared".
     */
    const handleGuardarEnBag = useCallback(() => {
        if (!selectedDropEntry) {
            return;
        }
        const equippedHit = Object.values(equippedItems).find(
            (eq) =>
                eq &&
                (selectedDropEntry.itemUid
                    ? eq.itemUid === selectedDropEntry.itemUid
                    : eq.itemId === selectedDropEntry.itemId),
        );
        if (matchingBagItem) {
            removeItemDropEntry(selectedDropEntry.id);
            EventBus.emit(TOAST_REQUESTED, {
                message: `${selectedDropEntry.itemName} ya está en la bolsa (sacado del log Item Drops). Cambiá a la pestaña Bag.`,
                severity: 'info',
            });
            setDropContextMenu(null);
            setBagDialogTab('bag');
            return;
        }
        if (equippedHit) {
            removeItemDropEntry(selectedDropEntry.id);
            EventBus.emit(TOAST_REQUESTED, {
                message: `${selectedDropEntry.itemName} está equipado (no en la bolsa). Sacado del log Item Drops.`,
                severity: 'info',
            });
            setDropContextMenu(null);
            return;
        }
        EventBus.emit(TOAST_REQUESTED, {
            message:
                `${selectedDropEntry.itemName} no está en la bolsa ni equipado. ` +
                `El log no mueve ítems del suelo — levantalo con click en el tile. No borramos el log.`,
            severity: 'error',
        });
        setDropContextMenu(null);
    }, [selectedDropEntry, matchingBagItem, equippedItems]);

    const handleReciclar = () => {
        if (!selectedDropEntry || !recycleEstimate) {
            return;
        }
        EventBus.emit(TOAST_REQUESTED, {
            message: `Reciclar (stub): ${recycleEstimate.summary}. Server recycle TBD.`,
            severity: 'info',
        });
        removeItemDropEntry(selectedDropEntry.id);
        setDropContextMenu(null);
    };

    const openDropContextMenu = useCallback((e: ReactMouseEvent, entryId: string) => {
        e.preventDefault();
        e.stopPropagation();
        // Prevent the dialog shell RMB-close handler (capture/bubble from drag chrome).
        e.nativeEvent.stopImmediatePropagation?.();
        selectItemDropEntry(entryId);
        setContextMenu(null);
        setDropContextMenu({ x: e.clientX, y: e.clientY, entryId });
    }, []);

    /**
     * RMB on empty F6 chrome / drag floor closes the window.
     * RMB on a drop row or bag item must not close — those open their own menus
     * (and stopPropagation). Detail with a selection also stops before this runs.
     */
    const handleDialogContextMenu = useCallback((e: ReactMouseEvent) => {
        e.preventDefault();
        const t = e.target;
        if (t instanceof Element) {
            if (
                t.closest('.item-drops-row')
                || t.closest('.inventory-bag-item')
                || t.closest('.rpg-context-menu')
                || t.closest('.bag-tab-btn')
                || t.closest('.bag-corner-controls')
                || t.closest('.item-drops-clear-btn')
            ) {
                return;
            }
        }
        setDropContextMenu(null);
        setContextMenu(null);
        handleClose();
    }, [handleClose]);

    const mintEligible =
        selectedDropEntry !== undefined
        && isPostTestNftMintEligible(selectedDropEntry.itemAttribute ?? 0);

    const bagGoldAmount = baggedItems.reduce(
        (sum, item) => (item.itemId === 90 ? sum + (item.quantity ?? 1) : sum),
        0,
    );

    return (
        <OlympiaDialogShell
            id="inventory-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={handleDialogContextMenu}
            dragHandleClassName="bag-dialog-drag-handle"
            rootClassName={`${isDropsTab ? 'item-drops-dialog-root' : 'bag-dialog-root'}${bagTransparent ? ' bag-dialog-root--glass' : ''}`}
            rootStyle={{
                ['--bag-scale' as string]: String(bagScale),
                ['--bag-w-mult' as string]: String(bagWidthMult),
                ['--bag-h-mult' as string]: String(bagHeightMult),
            }}
            width={isDropsTab ? OLYMPIA_DIALOG_SIZE.itemDrops.w : undefined}
            minHeight={isDropsTab ? OLYMPIA_DIALOG_SIZE.itemDrops.h : undefined}
        >
                {panelBg && (
                    <div
                        className="bag-dialog-bg-layer"
                        style={{
                            backgroundImage: `url(${panelBg})`,
                        }}
                        aria-hidden
                    />
                )}
                {!isDropsTab && (
                    <div className="bag-corner-controls">
                        <button
                            type="button"
                            className={`bag-glass-toggle-btn${bagTransparent ? ' bag-glass-toggle-btn--on' : ''}`}
                            title={
                                bagTransparent
                                    ? 'Bag sólida 100% (click)'
                                    : 'Bag semi-transparente (click)'
                            }
                            aria-label={bagTransparent ? 'Volver bag sólida' : 'Bag translúcida'}
                            aria-pressed={bagTransparent}
                            onPointerDown={stopDialogPointer}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleBagTransparent();
                            }}
                        >
                            {bagTransparent ? '◇' : '◆'}
                        </button>
                        <div className="bag-config-anchor">
                            <button
                                type="button"
                                className="bag-config-btn"
                                title="Ajustes de la bolsa"
                                aria-expanded={bagConfigMenuOpen}
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
                                <div
                                    className="bag-config-menu"
                                    role="menu"
                                    onPointerDown={stopDialogPointer}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="bag-config-help">{bagHelpText}</p>

                                    <label className="bag-config-row bag-config-select-row">
                                        <span>Drops generales</span>
                                        <select
                                            value={generalDropSector}
                                            onChange={(e) => setGeneralDropSector(e.target.value as BagSector)}
                                        >
                                            {BAG_SECTORS.map((sector) => (
                                                <option key={sector} value={sector}>
                                                    {BAG_SECTOR_LABELS[sector]}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="bag-config-row">
                                        <input
                                            type="checkbox"
                                            checked={potionAutoArrange}
                                            onChange={(e) => setPotionAutoArrange(e.target.checked)}
                                        />
                                        <span>Pociones: auto-apilar donde ya están</span>
                                    </label>

                                    <label className="bag-config-row bag-config-select-row">
                                        <span>Sector pociones</span>
                                        <select
                                            value={potionSector}
                                            onChange={(e) => setPotionSector(e.target.value as BagSector)}
                                            title={
                                                potionAutoArrange
                                                    ? 'Fallback si aún no hay pociones en la bolsa'
                                                    : 'Dónde caen las pociones al recogerlas'
                                            }
                                        >
                                            {BAG_SECTORS.map((sector) => (
                                                <option key={sector} value={sector}>
                                                    {BAG_SECTOR_LABELS[sector]}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="bag-config-row bag-config-scale-row">
                                        <span>Escala</span>
                                        <div className="bag-config-scale-controls">
                                            <button
                                                type="button"
                                                className="bag-config-scale-btn"
                                                disabled={!canDecreaseBagScale}
                                                onClick={() => decreaseBagScale()}
                                                title="Más chica"
                                            >
                                                −
                                            </button>
                                            <span className="bag-config-scale-label">{Math.round(bagScale * 100)}%</span>
                                            <button
                                                type="button"
                                                className="bag-config-scale-btn"
                                                disabled={!canIncreaseBagScale}
                                                onClick={() => increaseBagScale()}
                                                title="Más grande"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bag-config-row bag-config-size-row">
                                        <span>Ancho</span>
                                        <div className="bag-config-size-options">
                                            {BAG_DIM_LEVELS.map((mult, index) => (
                                                <button
                                                    key={`w-${mult}`}
                                                    type="button"
                                                    className={`bag-config-size-option${bagWidthIndex === index ? ' bag-config-size-option-active' : ''}`}
                                                    onClick={() => setBagWidthIndex(index)}
                                                >
                                                    {Math.round(mult * 100)}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bag-config-row bag-config-size-row">
                                        <span>Alto</span>
                                        <div className="bag-config-size-options">
                                            {BAG_DIM_LEVELS.map((mult, index) => (
                                                <button
                                                    key={`h-${mult}`}
                                                    type="button"
                                                    className={`bag-config-size-option${bagHeightIndex === index ? ' bag-config-size-option-active' : ''}`}
                                                    onClick={() => setBagHeightIndex(index)}
                                                >
                                                    {Math.round(mult * 100)}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!simpleBagOnly && (
                <div className="bag-dialog-tabs" role="tablist" aria-label="Bag panels">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'bag'}
                        className={`bag-tab-btn${activeTab === 'bag' ? ' bag-tab-active' : ''}`}
                        onClick={() => setBagDialogTab('bag')}
                        onPointerDown={stopDialogPointer}
                        title="Bag"
                    >
                        Bag
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'itemDrops'}
                        className={`bag-tab-btn${activeTab === 'itemDrops' ? ' bag-tab-active' : ''}`}
                        onClick={() => setBagDialogTab('itemDrops')}
                        onPointerDown={stopDialogPointer}
                        title="Item Drops"
                    >
                        Item Drops
                    </button>
                    <button
                        type="button"
                        className="bag-tab-btn bag-tab-btn--auction"
                        onClick={() => openAuctionBoard()}
                        onPointerDown={stopDialogPointer}
                        title="Auction Board"
                    >
                        Auction
                    </button>
                </div>
                )}

                {(simpleBagOnly || activeTab === 'bag') && (
                    <div
                        className={`bag-dialog-content${simpleBagOnly ? ' bag-dialog-content--arena-slim' : ''}`}
                        data-drop-to-ground={isDropToGroundIntent ? 'true' : undefined}
                    >
                        {simpleBagOnly && <ArenaBagMiniLoadout />}
                        <div
                            ref={bagAreaRef}
                            className={`inventory-bag-area bag-only-area${isBagDropTarget ? ' inventory-bag-area-drop-target' : ''}`}
                        >
                    {baggedItems.map((item, itemIndex) => {
                        const bagItem = getItemById(item.itemId);
                        const gender = playerGender ?? Gender.MALE;
                        const spriteKey = bagItem !== undefined
                            ? getBagItemSpriteKeyWithOverrides(
                                bagItem,
                                gender,
                                item.effectOverrides,
                                groundItemDisplaySize,
                                item.itemColor,
                            )
                            : undefined;
                        const imageDataUrl =
                            spriteKey !== undefined
                                ? (spriteFrameMap.get(spriteKey)
                                    ?? getItemImageUrl(item.itemId, item.effectOverrides, item.itemColor))
                                : undefined;
                        const isThisItemDragged =
                            draggedItem?.source === 'bag' &&
                            draggedItem.item.itemUid === item.itemUid;
                        const bagItemDisplaySize = getBagItemDisplaySize(
                            item.itemId,
                            item.effectOverrides,
                            item.itemColor,
                        );
                        const bagAreaWidth = bagAreaRef.current?.clientWidth ?? Math.round(148 * pocketScale);
                        const bagAreaHeight = bagAreaRef.current?.clientHeight ?? Math.round(120 * pocketScale);
                        const fallbackPos = defaultBagSlotPosition(
                            itemIndex,
                            bagAreaWidth,
                            bagAreaHeight,
                            Math.max(bagItemDisplaySize.width, bagItemDisplaySize.height),
                        );
                        const posX = item.bagX !== undefined ? item.bagX : fallbackPos.bagX;
                        const posY = item.bagY !== undefined ? item.bagY : fallbackPos.bagY;
                        return (
                            <div
                                key={item.itemUid}
                                className={`inventory-bag-item${displaySpritesInfo ? ' inventory-bag-item-debug' : ''}`}
                                onPointerDown={stopDialogPointer}
                                onMouseDown={(e) => handleBagItemMouseDown(e, item)}
                                onDoubleClick={() => handleBagItemDoubleClick(item)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    clearInventoryItemHoverInfo();
                                    setInventoryItemHoverOverlaySuppressed(true);
                                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                                }}
                                onMouseEnter={
                                    bagItem && !draggedItem && !contextMenu
                                        ? (e) => {
                                              cancelHoverClear();
                                              if (selectedItemUid === item.itemUid) return;
                                              setInventoryItemHoverInfo(
                                                  buildInventoryItemHoverInfo(bagItem, item, e.clientX, e.clientY),
                                              );
                                          }
                                        : undefined
                                }
                                onMouseMove={
                                    bagItem && !draggedItem && !contextMenu && selectedItemUid !== item.itemUid
                                        ? (e) =>
                                              setInventoryItemHoverInfo(
                                                  buildInventoryItemHoverInfo(bagItem, item, e.clientX, e.clientY),
                                              )
                                        : undefined
                                }
                                onMouseLeave={() => {
                                    if (selectedItemUid === item.itemUid) return;
                                    clearHoverDebounced();
                                }}
                                style={{
                                    cursor: 'grab',
                                    left: posX,
                                    top: posY,
                                    transform: 'translate(-50%, -50%)',
                                    width: bagItemDisplaySize.width,
                                    height: bagItemDisplaySize.height,
                                    overflow: 'hidden',
                                }}
                            >
                                {imageDataUrl ? (
                                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                            }}
                                        />
                                        {bagItem?.stackable && (
                                            <span
                                                className="inventory-bag-item-qty"
                                                style={{
                                                    visibility: isThisItemDragged ? 'hidden' : 'visible',
                                                }}
                                                title={String(item.quantity ?? 1)}
                                            >
                                                {item.itemId === 90
                                                    ? formatOlympiaCompactAmount(item.quantity ?? 1)
                                                    : (item.quantity ?? 1)}
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
                        {showInlineBagTip && (
                            <p className="bag-dialog-hint" role="status">
                                {bagHelpText}
                            </p>
                        )}
                        <div className="bag-dialog-footer" aria-label="Bag capacity">
                            <span
                                className="bag-footer-weight"
                                title={`${bagLabels.weight} ${charStats.weight}/${charStats.maxWeight}`}
                            >
                                {`${bagLabels.weight} ${charStats.weight}/${charStats.maxWeight}`}
                            </span>
                            <span
                                className="bag-footer-slots"
                                title={`${bagLabels.items} ${baggedItems.length}/${BAG_MAX_ITEM_SLOTS}`}
                            >
                                {`${bagLabels.items} ${baggedItems.length}/${BAG_MAX_ITEM_SLOTS}`}
                            </span>
                            <span
                                className="bag-footer-gold"
                                title={`${bagLabels.gold} ${bagGoldAmount.toLocaleString('en-US')}`}
                            >
                                {`${bagLabels.gold} ${formatOlympiaCompactAmount(bagGoldAmount)}`}
                            </span>
                        </div>
                    </div>
                )}

                {!simpleBagOnly && activeTab === 'itemDrops' && (
                    <div
                        className="item-drops-panel"
                        onPointerDown={stopDialogPointer}
                        onWheel={(e) => {
                            // Keep wheel scrolling inside the list only; do not drag the dialog.
                            e.stopPropagation();
                        }}
                    >
                        <div className="item-drops-section item-drops-section-list">
                            <div className="item-drops-section-title">Recent drops</div>
                            <div
                                className="item-drops-list"
                                role="listbox"
                                aria-label="Recent drops"
                                onPointerDown={stopDialogPointer}
                            >
                                {itemDropEntries.length === 0 ? (
                                    <p className="item-drops-empty">Aún no hay drops importantes registrados.</p>
                                ) : (
                                    itemDropEntries.map((entry) => {
                                        const isSelected = entry.id === selectedDropEntryId;
                                        const isLegendary =
                                            entry.dropCategory === 'legendary' ||
                                            entry.nftTier === 'super_rare';
                                        const dropVisual = getDropListVisual(entry);
                                        const badge =
                                            entry.dropCategoryLabel ??
                                            (entry.nftTier === 'super_rare'
                                                ? 'Legendary'
                                                : entry.nftTier === 'rare'
                                                  ? 'Rare'
                                                  : undefined);
                                        return (
                                            <button
                                                key={entry.id}
                                                type="button"
                                                role="option"
                                                aria-selected={isSelected}
                                                className={`item-drops-row${entry.isRare ? ' item-drops-rare' : ''}${isLegendary ? ' item-drops-legendary' : ''}${entry.dropCategory === 'stated_armor' || entry.dropCategory === 'stated_weapon' ? ' item-drops-stated' : ''}${entry.dropCategory === 'stone' ? ' item-drops-stone' : ''}${isSelected ? ' item-drops-row--selected' : ''}`}
                                                onClick={() => {
                                                    selectItemDropEntry(entry.id);
                                                    setDropContextMenu(null);
                                                }}
                                                onContextMenu={(e) => openDropContextMenu(e, entry.id)}
                                                onPointerDown={(e) => {
                                                    stopDialogPointer(e);
                                                    // Ensure RMB path is not stolen by dialog drag chrome.
                                                    e.stopPropagation();
                                                }}
                                            >
                                                <span
                                                    className="item-drops-name"
                                                    style={dropVisual.nameColor ? { color: dropVisual.nameColor } : undefined}
                                                >
                                                    {entry.itemName}
                                                    {badge && (
                                                        <span className={`item-drops-tier-badge${isLegendary ? ' item-drops-tier-legendary' : ''}${entry.dropCategory === 'stone' ? ' item-drops-tier-stone' : ''}${entry.dropCategory === 'stated_armor' || entry.dropCategory === 'stated_weapon' ? ' item-drops-tier-stated' : ''}`}>
                                                            {badge}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="item-drops-meta">
                                                    {entry.source === 'drop' ? 'Drop' : 'Pickup'} · {new Date(entry.timestamp).toLocaleTimeString()}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            {itemDropEntries.length > 0 && (
                                <button
                                    type="button"
                                    className="bag-tab-text-btn item-drops-clear-btn"
                                    onClick={clearItemDropsLog}
                                    onPointerDown={stopDialogPointer}
                                >
                                    Limpiar
                                </button>
                            )}
                        </div>

                        <div
                            className="item-drops-section item-drops-section-detail"
                            onPointerDown={(e) => {
                                stopDialogPointer(e);
                                e.stopPropagation();
                            }}
                            onContextMenu={(e) => {
                                if (selectedDropEntry) {
                                    // Selected item detail = treat as “on item” → menu, keep F6 open.
                                    openDropContextMenu(e, selectedDropEntry.id);
                                }
                                // No selection: do not stopPropagation → shell closes F6.
                            }}
                        >
                            {!selectedDropEntry || !selectedDropDisplay ? (
                                <p className="item-drops-empty">Click izq: detalle · Click der: vender / a bag</p>
                            ) : (
                                <>
                                    <div
                                        className="item-drops-detail-name"
                                        style={selectedDropDisplay.nameColor ? { color: selectedDropDisplay.nameColor } : undefined}
                                    >
                                        {selectedDropDisplay.name}
                                    </div>
                                    {selectedDropDisplay.tierLabel && (
                                        <span className={`item-drops-tier-badge${selectedDropDisplay.isLegendary ? ' item-drops-tier-legendary' : ''}`}>
                                            {selectedDropDisplay.tierLabel}
                                        </span>
                                    )}
                                    <div className="item-drops-detail-body">
                                        <div className="item-drops-detail-lines">
                                            {selectedDropDisplay.detailLines.length === 0 ? (
                                                <p className="item-drops-meta">Sin stats mágicas adicionales.</p>
                                            ) : (
                                                selectedDropDisplay.detailLines.map((line) => (
                                                    <p key={line} className="item-drops-detail-line">{line}</p>
                                                ))
                                            )}
                                            <p className="item-drops-meta">
                                                {selectedDropEntry.source === 'drop' ? 'Drop' : 'Pickup'} · {new Date(selectedDropEntry.timestamp).toLocaleString()}
                                            </p>
                                            {recycleEstimate && (
                                                <p className="item-drops-meta item-drops-recycle-hint">
                                                    Recycle est.: {recycleEstimate.summary}
                                                </p>
                                            )}
                                            {sellQuote?.ok && (
                                                <p className="item-drops-meta">
                                                    Sell est.: {sellQuote.gold}g
                                                    {!matchingBagItem ? ' (need item in bag)' : ''}
                                                </p>
                                            )}
                                            {matchingBagItem && sellQuote && !sellQuote.ok && (
                                                <p className="item-drops-meta">{sellQuote.error}</p>
                                            )}
                                            {nftClaims.lastClaimedMint && (
                                                <p className="item-drops-last-mint">
                                                    Last mint: {nftClaims.lastClaimedMint.slice(0, 12)}…
                                                    {nftClaims.lastExplorerUrl && (
                                                        <>
                                                            {' '}
                                                            <a
                                                                href={nftClaims.lastExplorerUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="item-drops-explorer-link"
                                                            >
                                                                View on Solana FM
                                                            </a>
                                                        </>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        {selectedDropImageUrl && (
                                            <div className="item-drops-detail-image-wrap" aria-hidden>
                                                <img
                                                    className="item-drops-detail-image"
                                                    src={selectedDropImageUrl}
                                                    alt=""
                                                    draggable={false}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="item-drops-detail-hint">
                                        Click der: vender por gold · pasar a bag usable
                                        {mintEligible ? ' · mint (post-test)' : ''}
                                    </p>
                                    {nftClaims.error && (
                                        <p className="item-drops-meta">{nftClaims.error}</p>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

            {draggedItem &&
                getItemImageUrl(
                    draggedItem.item.itemId,
                    draggedItem.item.effectOverrides,
                    draggedItem.item.itemColor,
                ) &&
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
                                src={getItemImageUrl(
                                    draggedItem.item.itemId,
                                    draggedItem.item.effectOverrides,
                                    draggedItem.item.itemColor,
                                )!}
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
                    const bagItemDef = getItemById(contextMenu.item.itemId);
                    const showEquip = bagItemDef ? isItemEquippable(bagItemDef) : false;
                    const showConsume = isBagConsumableItem(bagItemDef, contextMenu.item.itemId);
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
                    // Soul / Guild / Unbind seals (consumes seal 960/961/962 from bag).
                    const bindSt = contextMenu.item.bindState ?? 0;
                    const isSeal =
                        contextMenu.item.itemId === 960 ||
                        contextMenu.item.itemId === 961 ||
                        contextMenu.item.itemId === 962;
                    // Olympia majestic: Angelic pendants (1108–1111) + Dark Knight weapons.
                    const mid = contextMenu.item.itemId;
                    const isMajesticTarget =
                        mid === 1108 ||
                        mid === 1109 ||
                        mid === 1110 ||
                        mid === 1111 ||
                        mid === 703 ||
                        mid === 709 ||
                        mid === 717 ||
                        mid === 718 ||
                        mid === 727 ||
                        mid === 736 ||
                        mid === 737 ||
                        mid === 745;
                    if (isMajesticTarget) {
                        options.push({
                            label: 'Majestic Upgrade',
                            onClick: () =>
                                EventBus.emit(IN_UI_MAJESTIC_UPGRADE, {
                                    itemUid: contextMenu.item.itemUid,
                                }),
                        });
                    }
                    // Xelima (weapons) / Merien (armor/shield) stone upgrade.
                    const stoneType = bagItemDef?.itemType;
                    const isStoneUpgradeTarget =
                        stoneType === ItemTypes.WEAPON ||
                        stoneType === ItemTypes.SHIELD ||
                        stoneType === ItemTypes.ARMOR ||
                        stoneType === ItemTypes.HAUBERK ||
                        stoneType === ItemTypes.LEGGINGS ||
                        stoneType === ItemTypes.BOOTS ||
                        stoneType === ItemTypes.HELMET ||
                        stoneType === ItemTypes.CAPE;
                    if (isStoneUpgradeTarget && !isSeal) {
                        const stoneLabel =
                            stoneType === ItemTypes.WEAPON
                                ? 'Upgrade (Xelima)'
                                : 'Upgrade (Merien)';
                        options.push({
                            label: stoneLabel,
                            onClick: () => {
                                const plusLevel = ((contextMenu.item.itemAttribute ?? 0) >>> 28) & 0xf;
                                const hasIntegrity = baggedItemsRef.current.some(
                                    (b) => b.itemId === STONE_OF_INTEGRITY_ITEM_ID,
                                );
                                // Integrity reconfirm when present in bag and item is +3+ (no drop / no burn).
                                if (hasIntegrity && plusLevel >= INTEGRITY_MIN_PLUS) {
                                    setIntegrityConfirm({
                                        itemUid: contextMenu.item.itemUid,
                                        itemName: bagItemDef?.name ?? 'item',
                                        plusLevel,
                                    });
                                    return;
                                }
                                EventBus.emit(IN_UI_STONE_ITEM_UPGRADE, {
                                    itemUid: contextMenu.item.itemUid,
                                    useIntegrityStone: false,
                                });
                            },
                        });
                        // Enchant (safe) near upgrade; disenchant/sell stay at the BOTTOM after Drop — less misclick.
                        const attr = contextMenu.item.itemAttribute ?? 0;
                        if (attr !== 0) {
                            options.push({
                                label: 'Enchant +1 gema de arma',
                                onClick: () =>
                                    EventBus.emit(IN_UI_ITEM_ENCHANT, {
                                        itemUid: contextMenu.item.itemUid,
                                        kind: 0,
                                    }),
                            });
                            options.push({
                                label: 'Enchant +1 gema de ropa',
                                onClick: () =>
                                    EventBus.emit(IN_UI_ITEM_ENCHANT, {
                                        itemUid: contextMenu.item.itemUid,
                                        kind: 1,
                                    }),
                            });
                        }
                        // CIC3–6 merge: 2 same CIC + same stat kind (HP/SP/MP); shields same model.
                        const cicLvl = contextMenu.item.cicLevel ?? 0;
                        const cicEligible =
                            stoneType === ItemTypes.CAPE ||
                            stoneType === ItemTypes.SHIELD ||
                            stoneType === ItemTypes.ARMOR ||
                            stoneType === ItemTypes.HAUBERK ||
                            stoneType === ItemTypes.LEGGINGS ||
                            stoneType === ItemTypes.BOOTS ||
                            stoneType === ItemTypes.HELMET;
                        if (cicEligible && cicLvl >= 3 && cicLvl <= 6) {
                            const cicStat =
                                contextMenu.item.cicStatKind === 1
                                    ? 'HP'
                                    : contextMenu.item.cicStatKind === 2
                                      ? 'SP'
                                      : contextMenu.item.cicStatKind === 3
                                        ? 'MP'
                                        : '?';
                            const cicVal = contextMenu.item.cicStatValue ?? 0;
                            if (cicMergePendingUid && cicMergePendingUid !== contextMenu.item.itemUid) {
                                options.push({
                                    label: `CIC merge with selected → CIC${cicLvl + 1}`,
                                    onClick: () => {
                                        EventBus.emit(IN_UI_CIC_ITEM_MERGE, {
                                            itemUidA: cicMergePendingUid,
                                            itemUidB: contextMenu.item.itemUid,
                                        });
                                        setCicMergePendingUid(null);
                                    },
                                });
                                options.push({
                                    label: 'Cancel CIC merge selection',
                                    onClick: () => setCicMergePendingUid(null),
                                });
                            } else {
                                options.push({
                                    label: `CIC merge (pick 2nd CIC${cicLvl} ${cicStat}${cicVal})`,
                                    onClick: () => {
                                        setCicMergePendingUid(contextMenu.item.itemUid);
                                        EventBus.emit(TOAST_REQUESTED, {
                                            message: `CIC: right-click a matching CIC${cicLvl} ${cicStat} piece to merge.`,
                                            severity: 'info',
                                            autoClose: 3500,
                                        });
                                    },
                                });
                            }
                        }
                    }
                    // Mana/HP Vamping gems + residues (break → vamping shards).
                    const siphonGemIds = new Set([1200, 1201]);
                    const siphonResidueIds = new Set([1202, 1203]);
                    if (siphonGemIds.has(contextMenu.item.itemId)) {
                        const sl = contextMenu.item.siphonLevel ?? 0;
                        options.push({
                            label: `Upgrade Vamping gem (Lv.${sl} → ${Math.min(15, sl + 1)})`,
                            onClick: () =>
                                EventBus.emit(IN_UI_SIPHON_GEM_UPGRADE, {
                                    itemUid: contextMenu.item.itemUid,
                                }),
                        });
                        options.push({
                            label: 'Disenchant → Mana/HP Vamping shard',
                            onClick: () =>
                                requestDangerousAction(
                                    contextMenu.item,
                                    'Disenchant vamping gem',
                                    () =>
                                        EventBus.emit(IN_UI_ITEM_DISENCHANT, {
                                            itemUid: contextMenu.item.itemUid,
                                        }),
                                ),
                        });
                    }
                    if (siphonResidueIds.has(contextMenu.item.itemId)) {
                        options.push({
                            label: 'Break → Vamping shard',
                            onClick: () =>
                                requestDangerousAction(contextMenu.item, 'Break residue', () =>
                                    EventBus.emit(IN_UI_ITEM_DISENCHANT, {
                                        itemUid: contextMenu.item.itemUid,
                                    }),
                                ),
                        });
                    }
                    if (!isSeal && contextMenu.item.itemId !== 90) {
                        const game = phaserRef?.current?.game;
                        const nm = game ? getNetworkManager(game) : undefined;
                        if (bindSt === 0) {
                            options.push({
                                label: 'Soul Bind (needs seal)',
                                onClick: () => nm?.requestItemBind(contextMenu.item.itemUid, 1),
                            });
                            options.push({
                                label: 'Guild Bind (needs seal)',
                                onClick: () => nm?.requestItemBind(contextMenu.item.itemUid, 2),
                            });
                        } else {
                            options.push({
                                label:
                                    bindSt === 2
                                        ? 'Unbind guild (GM/captain + seal)'
                                        : 'Unbind (needs Unbind Seal)',
                                onClick: () => nm?.requestItemBind(contextMenu.item.itemUid, 3),
                            });
                        }
                    }
                    const bagSellItem = baggedItems.find((b) => b.itemUid === contextMenu.item.itemUid);
                    const bagSellQuote = bagSellItem ? quoteSellForBagItem(bagSellItem) : undefined;
                    options.push({
                        label: 'Drop',
                        onClick: () =>
                            requestDangerousAction(contextMenu.item, 'Drop to ground', () =>
                                EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, {
                                    itemUid: contextMenu.item.itemUid,
                                }),
                            ),
                    });
                    // Destructive / sale — far from Upgrade to reduce misclicks on rares.
                    const itemAttrForDisenchant = contextMenu.item.itemAttribute ?? 0;
                    if (itemAttrForDisenchant !== 0) {
                        options.push({
                            label: 'Disenchant → gemas (DESTROY item)',
                            onClick: () =>
                                requestDangerousAction(contextMenu.item, 'Disenchant (DESTROY item)', () =>
                                    EventBus.emit(IN_UI_ITEM_DISENCHANT, {
                                        itemUid: contextMenu.item.itemUid,
                                    }),
                                ),
                        });
                    }
                    if (bagSellItem && bagSellQuote?.ok && (bagSellQuote.gold ?? 0) > 0) {
                        options.push({
                            label: `Sell for gold (${bagSellQuote.gold}g)`,
                            onClick: () =>
                                requestDangerousAction(
                                    bagSellItem,
                                    `Sell for ${bagSellQuote.gold}g`,
                                    () => requestSellBagItem(bagSellItem),
                                ),
                        });
                    }
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
            {dangerConfirm &&
                createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: (zIndex ?? 10000) + 3100,
                            background: 'rgba(0,0,0,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        onClick={() => setDangerConfirm(null)}
                    >
                        <div
                            className="rpg-context-menu"
                            style={{
                                position: 'relative',
                                left: 'auto',
                                top: 'auto',
                                maxWidth: 380,
                                padding: '14px 16px',
                                pointerEvents: 'auto',
                                border: '1px solid #c44',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div
                                style={{
                                    marginBottom: 10,
                                    lineHeight: 1.35,
                                    fontWeight: 700,
                                    color: '#ff6b6b',
                                }}
                            >
                                {dangerConfirm.title}
                            </div>
                            <div style={{ marginBottom: 12, lineHeight: 1.4 }}>{dangerConfirm.body}</div>
                            <div className="rpg-context-menu-item" onClick={dangerConfirm.onConfirm}>
                                {dangerConfirm.confirmLabel}
                            </div>
                            <div className="rpg-context-menu-item" onClick={() => setDangerConfirm(null)}>
                                Cancel — keep item
                            </div>
                        </div>
                    </div>,
                    dragGhostPortalTarget,
                )}
            {integrityConfirm &&
                createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: (zIndex ?? 10000) + 3000,
                            background: 'rgba(0,0,0,0.55)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        onClick={() => setIntegrityConfirm(null)}
                    >
                        <div
                            className="rpg-context-menu"
                            style={{
                                position: 'relative',
                                left: 'auto',
                                top: 'auto',
                                maxWidth: 360,
                                padding: '14px 16px',
                                pointerEvents: 'auto',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ marginBottom: 10, lineHeight: 1.35, fontWeight: 600 }}>
                                Stone of Integrity in bag
                            </div>
                            <div style={{ marginBottom: 12, lineHeight: 1.4, opacity: 0.95 }}>
                                Upgrade <strong>{integrityConfirm.itemName}</strong> (+
                                {integrityConfirm.plusLevel}) can fail with{' '}
                                {integrityConfirm.plusLevel >= 7
                                    ? 'burn or −1 drop'
                                    : '−1 drop'}
                                . Use Stone of Integrity to keep +{integrityConfirm.plusLevel} (no burn, no
                                retrocession)?
                            </div>
                            <div
                                className="rpg-context-menu-item"
                                onClick={() => {
                                    // Still present at confirm time?
                                    const stillHas = baggedItemsRef.current.some(
                                        (b) => b.itemId === STONE_OF_INTEGRITY_ITEM_ID,
                                    );
                                    EventBus.emit(IN_UI_STONE_ITEM_UPGRADE, {
                                        itemUid: integrityConfirm.itemUid,
                                        useIntegrityStone: stillHas,
                                    });
                                    setIntegrityConfirm(null);
                                }}
                            >
                                Yes — use Integrity (hold +{integrityConfirm.plusLevel})
                            </div>
                            <div
                                className="rpg-context-menu-item"
                                onClick={() => {
                                    EventBus.emit(IN_UI_STONE_ITEM_UPGRADE, {
                                        itemUid: integrityConfirm.itemUid,
                                        useIntegrityStone: false,
                                    });
                                    setIntegrityConfirm(null);
                                }}
                            >
                                No — upgrade without Integrity
                            </div>
                            <div
                                className="rpg-context-menu-item"
                                onClick={() => setIntegrityConfirm(null)}
                            >
                                Cancel
                            </div>
                        </div>
                    </div>,
                    dragGhostPortalTarget,
                )}
            {dropContextMenu && selectedDropEntry && dropContextMenu.entryId === selectedDropEntry.id &&
                (() => {
                    const options: {
                        label: string;
                        onClick: () => void;
                        disabled?: boolean;
                        title?: string;
                    }[] = [];
                    options.push({
                        label: canSellForGold
                            ? `Vender por gold (~${sellQuote?.gold ?? 0}g)`
                            : 'Vender por gold',
                        disabled: !canSellForGold,
                        title: canSellForGold
                            ? `Vender y borrar de la bolsa (~${sellQuote?.gold ?? 0}g)`
                            : matchingBagItem
                                ? (sellQuote?.error ?? 'Sin valor de venta')
                                : 'Necesitás el ítem en la bolsa',
                        onClick: handleVenderPorGold,
                    });
                    options.push({
                        label: matchingBagItem
                            ? 'OK en bag (quitar del log)'
                            : 'Quitar del log (no mueve loot)',
                        title: matchingBagItem
                            ? 'El ítem ya está en la bolsa — solo cierra esta fila del log'
                            : 'Item Drops es un historial. Para levantar del suelo: click en el tile. No borra el log si el ítem no está en bag/equip.',
                        onClick: handleGuardarEnBag,
                    });
                    if (mintEligible) {
                        options.push({
                            label: 'Mint cNFT / NFT (post-test)',
                            disabled: true,
                            title:
                                'Solo ítems con HP/HR/MP/MR/DR ≥40%, rep6/7, PA20+ o MA20+. '
                                + 'Mint desactivado hasta cerrar el diseño de NFTs.',
                            onClick: () => {
                                EventBus.emit(TOAST_REQUESTED, {
                                    message: 'Mint post-test: aún no activo (diseño NFT pendiente).',
                                    severity: 'info',
                                });
                                setDropContextMenu(null);
                            },
                        });
                    } else {
                        options.push({
                            label: 'Mint (no califica)',
                            disabled: true,
                            title: 'Mint solo con stats altas: +40% HP/HR/MP/MR/DR, rep6+, PA20+ o MA20+.',
                            onClick: () => undefined,
                        });
                    }
                    if (recycleEstimate) {
                        options.push({
                            label: 'Reciclar (stub)',
                            title: recycleEstimate.summary,
                            onClick: handleReciclar,
                        });
                    }
                    return createPortal(
                        <div
                            className="rpg-context-menu"
                            style={{
                                left: dropContextMenu.x,
                                top: dropContextMenu.y,
                                zIndex: (zIndex ?? 10000) + 2000,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            {options.map((opt) => (
                                <div
                                    key={opt.label}
                                    className={`rpg-context-menu-item${opt.disabled ? ' rpg-context-menu-item--disabled' : ''}`}
                                    title={opt.title}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (opt.disabled) {
                                            return;
                                        }
                                        opt.onClick();
                                        setDropContextMenu(null);
                                    }}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>,
                        dragGhostPortalTarget,
                    );
                })()}
        </OlympiaDialogShell>
    );
}

function findMatchingBagItem(entry: ItemDropLogEntry, bagged: InventoryItem[]): InventoryItem | undefined {
    if (entry.itemUid) {
        const byUid = bagged.find((b) => b.itemUid === entry.itemUid);
        if (byUid) {
            return byUid;
        }
    }
    const candidates = bagged.filter((b) => b.itemId === entry.itemId);
    if (candidates.length === 0) {
        return undefined;
    }
    if (entry.itemAttribute !== undefined) {
        const attrMatch = candidates.filter((b) => (b.itemAttribute ?? 0) === entry.itemAttribute);
        if (attrMatch.length === 1) {
            return attrMatch[0];
        }
        if (attrMatch.length > 1) {
            // Prefer color match when several magic rolls share the same attr nibble set.
            if (entry.itemColor !== undefined) {
                const colorHit = attrMatch.find((b) => (b.itemColor ?? 0) === entry.itemColor);
                if (colorHit) {
                    return colorHit;
                }
            }
            return attrMatch[0];
        }
        return undefined;
    }
    if (candidates.length === 1) {
        return candidates[0];
    }
    // Ambiguous same-base items without attribute — prefer a non-magic stack; else newest (last).
    const plain = candidates.filter((b) => (b.itemAttribute ?? 0) === 0);
    if (plain.length === 1) {
        return plain[0];
    }
    if (plain.length > 1) {
        return plain[plain.length - 1];
    }
    return candidates[candidates.length - 1];
}

function quoteSellForBagItem(item: InventoryItem) {
    const catalog = getOlympiaItemPriceCatalog(item.itemId);
    let category = catalog.category;
    if (category <= 0) {
        category = (item.maxLifeSpan ?? 0) > 1 ? 1 : 11;
    }
    let listPrice = catalog.price;
    if (listPrice <= 0) {
        listPrice = item.itemId >= 600 ? 500 : item.itemId >= 200 ? 100 : 20;
    }
    return quoteOlympiaSellGold({
        listPrice,
        category,
        itemAttribute: item.itemAttribute,
        curLifeSpan: item.curLifeSpan,
        maxLifeSpan: item.maxLifeSpan,
        quantity: item.quantity,
    });
}

function quoteSellForDropEntry(entry: ItemDropLogEntry) {
    const catalog = getOlympiaItemPriceCatalog(entry.itemId);
    let category = catalog.category;
    // Same heuristic as server Shop.HandleSellBagItemRequest when category missing.
    if (category <= 0) {
        category = 11;
    }
    let listPrice = catalog.price;
    // Server: EstimateFallbackSellGold * 2 as synthetic list price.
    if (listPrice <= 0) {
        listPrice = entry.itemId >= 600 ? 500 : entry.itemId >= 200 ? 100 : 20;
    }
    return quoteOlympiaSellGold({
        listPrice,
        category,
        itemAttribute: entry.itemAttribute,
        // Unknown durability on log-only rows — assume full for preview.
        curLifeSpan: 1,
        maxLifeSpan: 1,
        quantity: 1,
    });
}

function buildSelectedDropDisplay(entry: ItemDropLogEntry): {
    name: string;
    detailLines: string[];
    tierLabel: string | undefined;
    isLegendary: boolean;
    nameColor: string | undefined;
} {
    const item = ITEMS.find((i) => i.id === entry.itemId);
    const attr = entry.itemAttribute ?? 0;
    const color = entry.itemColor ?? 0;
    // Prefer the logged display name so the detail header always matches the selected row.
    const display = item
        ? getOlympiaItemDisplay(item.name, attr, color, item.itemType, entry.itemId)
        : { name: entry.itemName, detailLines: [] as string[], nameColor: undefined, isMagic: false };
    const isLegendary =
        entry.dropCategory === 'legendary' || entry.nftTier === 'super_rare';
    const tierLabel =
        entry.dropCategoryLabel ??
        (entry.nftTier === 'super_rare' ? 'Legendary' : entry.nftTier === 'rare' ? 'Rare' : undefined);
    return {
        name: entry.itemName || display.name,
        detailLines: display.detailLines,
        tierLabel,
        isLegendary,
        nameColor: display.nameColor,
    };
}

/** Rarity tint for Item Drops list by product category. */
function getDropListVisual(entry: ItemDropLogEntry): { nameColor: string | undefined; isEpic: boolean } {
    const item = ITEMS.find((i) => i.id === entry.itemId);
    const attr = entry.itemAttribute ?? 0;
    const color = entry.itemColor ?? 0;
    if (!item) {
        return { nameColor: undefined, isEpic: false };
    }
    const display = getOlympiaItemDisplay(item.name, attr, color, item.itemType, entry.itemId);
    let nameColor = display.nameColor;
    const cat = entry.dropCategory;
    if (cat === 'legendary' || entry.nftTier === 'super_rare') {
        nameColor = '#c060ff';
    } else if (cat === 'stone') {
        nameColor = '#7ec8ff';
    } else if (cat === 'stated_armor' || cat === 'stated_weapon') {
        nameColor = nameColor ?? '#5ad4a0';
    } else if (cat === 'rare' || entry.nftTier === 'rare') {
        nameColor = nameColor ?? '#d4af37';
    }
    return { nameColor, isEpic: false };
}
