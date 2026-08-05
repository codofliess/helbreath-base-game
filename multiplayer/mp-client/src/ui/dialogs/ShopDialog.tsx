import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import {
    DIALOG_BTN_OK,
    DIALOG_BTN_OK_HOVER,
    LEVELSET_DIALOG_BG,
} from '../../constants/SpriteKeys';
import {
    SHOP_MISC_CATALOG,
    SHOP_MAX_BUY_QUANTITY,
    SHOP_POTION_CATALOG,
} from '../../constants/ShopCatalog';
import { getItemById } from '../../constants/Items';
import {
    setShopDialogOpen,
    setShopStatusMessage,
    shopDialogStore,
} from '../store/ShopDialog.store';
import { getNetworkManager, getInventoryManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';

interface ShopDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

type ShopTab = 'potions' | 'misc' | 'rings';

function clampBuyQuantity(value: number): number {
    if (!Number.isFinite(value)) {
        return 1;
    }
    return Math.min(SHOP_MAX_BUY_QUANTITY, Math.max(1, Math.trunc(value)));
}

/**
 * Shop Keeper: Potions · Misc · Repair rings (Emmy / breakable rings).
 */
export function ShopDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: ShopDialogProps) {
    const isOpen = useStore(shopDialogStore, (s) => s.isOpen);
    const npcId = useStore(shopDialogStore, (s) => s.npcId);
    const npcName = useStore(shopDialogStore, (s) => s.npcName);
    const statusMessage = useStore(shopDialogStore, (s) => s.statusMessage);
    const [tab, setTab] = useState<ShopTab>('potions');
    const [selectedItemId, setSelectedItemId] = useState<number | undefined>(undefined);
    const [buyQuantity, setBuyQuantity] = useState(1);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const selectedItemIdRef = useRef(selectedItemId);

    selectedItemIdRef.current = selectedItemId;

    const catalog = tab === 'potions' ? SHOP_POTION_CATALOG : SHOP_MISC_CATALOG;

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        setTab('potions');
        setSelectedItemId(SHOP_POTION_CATALOG[0]?.itemId);
        setBuyQuantity(1);
        setShopStatusMessage('');
    }, [isOpen, npcId]);

    useEffect(() => {
        if (tab === 'rings') {
            return;
        }
        const first = catalog[0]?.itemId;
        setSelectedItemId(first);
        setBuyQuantity(1);
    }, [tab, catalog]);

    useEffect(() => {
        if (!isOpen || tab === 'rings') {
            return;
        }
        const el = contentRef.current;
        if (!el) {
            return;
        }
        const onWheel = (ev: WheelEvent) => {
            if (selectedItemIdRef.current === undefined) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            const steps = Math.max(1, Math.min(10, Math.round(Math.abs(ev.deltaY) / 100)));
            const delta = ev.deltaY < 0 ? steps : -steps;
            setBuyQuantity((prev) => clampBuyQuantity(prev + delta));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
        };
    }, [isOpen, tab]);

    const ringCandidates = useMemo(() => {
        const game = phaserRef.current?.game;
        const inventoryManager = game ? getInventoryManager(game) : undefined;
        const list: { itemUid: string; name: string; cur: number; max: number }[] = [];
        if (!inventoryManager) {
            return list;
        }
        const seen = new Set<string>();
        const consider = (item: {
            itemId: number;
            itemUid: string;
            curLifeSpan?: number;
            maxLifeSpan?: number;
        }) => {
            if (seen.has(item.itemUid)) {
                return;
            }
            const def = getItemById(item.itemId);
            if (!def || def.itemType !== 'ring') {
                return;
            }
            const max = item.maxLifeSpan ?? 0;
            const cur = item.curLifeSpan ?? max;
            if (max <= 1 || cur >= max) {
                return;
            }
            seen.add(item.itemUid);
            list.push({ itemUid: item.itemUid, name: def.name, cur, max });
        };
        for (const item of inventoryManager.baggedItems) {
            consider(item);
        }
        for (const item of Object.values(inventoryManager.equippedItems)) {
            if (item) {
                consider(item);
            }
        }
        return list;
    }, [isOpen, statusMessage, tab, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const selected =
        selectedItemId === undefined
            ? undefined
            : catalog.find((row) => row.itemId === selectedItemId);
    const totalCost = selected ? selected.price * buyQuantity : 0;

    const buy = () => {
        const game = phaserRef.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager || !npcId || !selected) {
            setShopStatusMessage('Cannot reach the shop right now.');
            return;
        }
        const quantity = clampBuyQuantity(buyQuantity);
        setShopStatusMessage(`Buying ${quantity}× ${selected.name}…`);
        networkManager.sendBuyShopItemRequest(npcId, selected.itemId, quantity);
    };

    const repair = (itemUid: string) => {
        const game = phaserRef.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager || !npcId) {
            setShopStatusMessage('Cannot reach the shop right now.');
            return;
        }
        setShopStatusMessage('Repairing ring…');
        networkManager.sendRepairItemRequest(npcId, itemUid);
    };

    const repairAllRings = () => {
        const game = phaserRef.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager || !npcId) {
            setShopStatusMessage('Cannot reach the shop right now.');
            return;
        }
        if (ringCandidates.length === 0) {
            setShopStatusMessage('No damaged rings.');
            return;
        }
        setShopStatusMessage(`Repairing ${ringCandidates.length} ring(s)…`);
        for (const row of ringCandidates) {
            networkManager.sendRepairItemRequest(npcId, row.itemUid);
        }
    };

    return (
        <OlympiaDialogShell
            id="shop-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setShopDialogOpen(false);
            }}
            width={380}
            minHeight={440}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="shop-dialog-root"
        >
            <div className="olympia-dialog-title-bar">{npcName}</div>
            <div className="shop-dialog-content" ref={contentRef}>
                <div className="npc-shop-tabs" role="tablist" aria-label="Shop sections">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'potions'}
                        className={`npc-shop-tab${tab === 'potions' ? ' is-active' : ''}`}
                        onClick={() => setTab('potions')}
                    >
                        Potions
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'misc'}
                        className={`npc-shop-tab${tab === 'misc' ? ' is-active' : ''}`}
                        onClick={() => setTab('misc')}
                    >
                        Misc
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'rings'}
                        className={`npc-shop-tab${tab === 'rings' ? ' is-active' : ''}`}
                        onClick={() => setTab('rings')}
                    >
                        Repair rings
                    </button>
                </div>

                {tab !== 'rings' && (
                    <>
                        <p className="shop-dialog-intro">
                            {tab === 'potions'
                                ? 'Select a potion, set quantity, then Buy.'
                                : 'Food, tools, manuals, dyes, clothes, seeds…'}
                        </p>
                        <div className="shop-dialog-list" role="listbox" aria-label="Shop catalog">
                            {catalog.map((row) => {
                                const isSelected = row.itemId === selectedItemId;
                                return (
                                    <button
                                        key={row.itemId}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={
                                            isSelected
                                                ? 'shop-dialog-row shop-dialog-row--selected'
                                                : 'shop-dialog-row'
                                        }
                                        onClick={() => {
                                            setSelectedItemId(row.itemId);
                                            setBuyQuantity(1);
                                            setShopStatusMessage('');
                                        }}
                                    >
                                        <span className="shop-dialog-item-name">{row.name}</span>
                                        <span className="shop-dialog-item-price">{row.price}g</span>
                                    </button>
                                );
                            })}
                        </div>
                        {selected && (
                            <div className="shop-dialog-qty-row">
                                <button type="button" className="shop-dialog-qty-btn" onClick={() => setBuyQuantity((q) => clampBuyQuantity(q - 1))}>
                                    −
                                </button>
                                <span className="shop-dialog-qty-val">{buyQuantity}</span>
                                <button type="button" className="shop-dialog-qty-btn" onClick={() => setBuyQuantity((q) => clampBuyQuantity(q + 1))}>
                                    +
                                </button>
                                <span className="shop-dialog-item-price">Total {totalCost}g</span>
                                <OlympiaSpriteButton
                                    normalKey={DIALOG_BTN_OK}
                                    hoverKey={DIALOG_BTN_OK_HOVER}
                                    title={`Buy ${selected.name}`}
                                    fallbackLabel="Buy"
                                    onClick={buy}
                                    className="shop-dialog-buy-btn"
                                />
                            </div>
                        )}
                    </>
                )}

                {tab === 'rings' && (
                    <>
                        <div className="npc-shop-toolbar">
                            <button
                                type="button"
                                className="npc-shop-primary-btn"
                                onClick={repairAllRings}
                                disabled={ringCandidates.length === 0}
                                title="Repair Emerald / Sapphire / Ruby and other breakable rings"
                            >
                                Repair all rings ({ringCandidates.length})
                            </button>
                        </div>
                        <p className="shop-dialog-intro">
                            Emmy Ring and other rings with durability (not weapons — Tom does those):
                        </p>
                        <div className="shop-dialog-list">
                            {ringCandidates.length === 0 ? (
                                <p className="shop-dialog-hint">No damaged rings in bag or equipped.</p>
                            ) : (
                                ringCandidates.map((row) => (
                                    <div key={row.itemUid} className="shop-dialog-row">
                                        <span className="shop-dialog-item-name">
                                            {row.name} ({row.cur}/{row.max})
                                        </span>
                                        <OlympiaSpriteButton
                                            normalKey={DIALOG_BTN_OK}
                                            hoverKey={DIALOG_BTN_OK_HOVER}
                                            title={`Repair ${row.name}`}
                                            fallbackLabel="Repair"
                                            onClick={() => repair(row.itemUid)}
                                            className="shop-dialog-buy-btn"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {statusMessage ? <p className="shop-dialog-status">{statusMessage}</p> : null}
                <p className="shop-dialog-hint">Right-click dialog to close. Wheel = quantity.</p>
            </div>
        </OlympiaDialogShell>
    );
}
