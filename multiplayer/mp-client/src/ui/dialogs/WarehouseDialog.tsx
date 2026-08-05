import { useStore } from '@tanstack/react-store';
import { useEffect, useState } from 'react';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import {
    DIALOG_BTN_OK,
    DIALOG_BTN_OK_HOVER,
    LEVELSET_DIALOG_BG,
} from '../../constants/SpriteKeys';
import { getItemById } from '../../constants/Items';
import { openAuctionBoard } from '../store/AuctionBoardDialog.store';
import {
    setWarehouseDialogOpen,
    setWarehouseStatusMessage,
    warehouseDialogStore,
} from '../store/WarehouseDialog.store';
import { getInventoryManager, getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import {
    SERVER_INVENTORY_SNAPSHOT_RECEIVED,
    SERVER_ITEM_ADDED_TO_BAG_RECEIVED,
    SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED,
} from '../../constants/EventNames';
import { EventBus } from '../../game/EventBus';

interface WarehouseDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

interface BagRow {
    itemUid: string;
    itemId: number;
    quantity: number;
    name: string;
}

/**
 * William warehouse UI: deposit bag stacks / withdraw stored stacks (server-authoritative).
 */
export function WarehouseDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: WarehouseDialogProps) {
    const isOpen = useStore(warehouseDialogStore, (s) => s.isOpen);
    const npcId = useStore(warehouseDialogStore, (s) => s.npcId);
    const npcName = useStore(warehouseDialogStore, (s) => s.npcName);
    const items = useStore(warehouseDialogStore, (s) => s.items);
    const maxSlots = useStore(warehouseDialogStore, (s) => s.maxSlots);
    const statusMessage = useStore(warehouseDialogStore, (s) => s.statusMessage);
    const [bagRows, setBagRows] = useState<BagRow[]>([]);

    const network = () => {
        const game = phaserRef.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    const refreshBag = () => {
        const game = phaserRef.current?.game;
        if (!game) {
            setBagRows([]);
            return;
        }
        const inv = getInventoryManager(game);
        setBagRows(
            inv.baggedItems.map((item) => ({
                itemUid: item.itemUid,
                itemId: item.itemId,
                quantity: item.quantity ?? 1,
                name: getItemById(item.itemId)?.name ?? `Item ${item.itemId}`,
            })),
        );
    };

    useEffect(() => {
        if (!isOpen || !npcId) {
            return;
        }
        refreshBag();
        network()?.sendOpenWarehouseRequest(npcId);
        const onBagChange = () => refreshBag();
        EventBus.on(SERVER_INVENTORY_SNAPSHOT_RECEIVED, onBagChange);
        EventBus.on(SERVER_ITEM_ADDED_TO_BAG_RECEIVED, onBagChange);
        EventBus.on(SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED, onBagChange);
        return () => {
            EventBus.off(SERVER_INVENTORY_SNAPSHOT_RECEIVED, onBagChange);
            EventBus.off(SERVER_ITEM_ADDED_TO_BAG_RECEIVED, onBagChange);
            EventBus.off(SERVER_ITEM_REMOVED_FROM_BAG_RECEIVED, onBagChange);
        };
    }, [isOpen, npcId, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const deposit = (itemUid: string) => {
        const nm = network();
        if (!nm || !npcId) {
            setWarehouseStatusMessage('Cannot reach the warehouse right now.');
            return;
        }
        setWarehouseStatusMessage('Depositing…');
        nm.sendWarehouseDepositRequest(npcId, itemUid);
    };

    const withdraw = (itemUid: string) => {
        const nm = network();
        if (!nm || !npcId) {
            setWarehouseStatusMessage('Cannot reach the warehouse right now.');
            return;
        }
        setWarehouseStatusMessage('Withdrawing…');
        nm.sendWarehouseWithdrawRequest(npcId, itemUid);
    };

    return (
        <OlympiaDialogShell
            id="warehouse-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setWarehouseDialogOpen(false);
            }}
            width={420}
            minHeight={320}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="warehouse-dialog-root"
        >
            <div className="olympia-dialog-title-bar">{npcName} — Warehouse</div>
            <div className="warehouse-dialog-content">
                <p className="shop-dialog-intro">
                    Storage {items.length}/{maxSlots}. Click Deposit / Withdraw (full stacks).
                </p>
                <div className="warehouse-dialog-columns">
                    <div className="warehouse-dialog-column">
                        <div className="rpg-section-title">Warehouse</div>
                        <div className="shop-dialog-list">
                            {items.length === 0 ? (
                                <div className="shop-dialog-status">Empty.</div>
                            ) : (
                                items.map((row) => (
                                    <div key={row.itemUid} className="shop-dialog-row">
                                        <span className="shop-dialog-item-name">
                                            {row.name}
                                            {row.quantity > 1 ? ` ×${row.quantity}` : ''}
                                        </span>
                                        <OlympiaSpriteButton
                                            normalKey={DIALOG_BTN_OK}
                                            hoverKey={DIALOG_BTN_OK_HOVER}
                                            title={`Withdraw ${row.name}`}
                                            fallbackLabel="Out"
                                            onClick={() => withdraw(row.itemUid)}
                                            className="shop-dialog-buy-btn"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="warehouse-dialog-column">
                        <div className="rpg-section-title">Bag</div>
                        <div className="shop-dialog-list">
                            {bagRows.length === 0 ? (
                                <div className="shop-dialog-status">Bag empty.</div>
                            ) : (
                                bagRows.map((row) => (
                                    <div key={row.itemUid} className="shop-dialog-row">
                                        <span className="shop-dialog-item-name">
                                            {row.name}
                                            {row.quantity > 1 ? ` ×${row.quantity}` : ''}
                                        </span>
                                        <OlympiaSpriteButton
                                            normalKey={DIALOG_BTN_OK}
                                            hoverKey={DIALOG_BTN_OK_HOVER}
                                            title={`Deposit ${row.name}`}
                                            fallbackLabel="In"
                                            onClick={() => deposit(row.itemUid)}
                                            className="shop-dialog-buy-btn"
                                        />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                {statusMessage ? <div className="shop-dialog-status">{statusMessage}</div> : null}
                <div className="warehouse-dialog-footer">
                    <button
                        type="button"
                        className="olympia-text-btn"
                        onClick={() => openAuctionBoard()}
                    >
                        Auction Board
                    </button>
                </div>
                <p className="shop-dialog-hint">Right-click dialog to close.</p>
            </div>
        </OlympiaDialogShell>
    );
}
