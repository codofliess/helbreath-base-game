import { useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import {
    DIALOG_BTN_OK,
    DIALOG_BTN_OK_HOVER,
    LEVELSET_DIALOG_BG,
} from '../../constants/SpriteKeys';
import {
    BLACKSMITH_ARMOR_CATALOG,
    BLACKSMITH_WEAPON_CATALOG,
} from '../../constants/ShopCatalog';
import { getItemById } from '../../constants/Items';
import {
    setBlacksmithDialogOpen,
    setBlacksmithStatusMessage,
    blacksmithDialogStore,
} from '../store/BlacksmithDialog.store';
import { getNetworkManager, getInventoryManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';

interface BlacksmithDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

type BlacksmithTab = 'repair' | 'weapons' | 'armor';

/** Tom repairs durable combat gear (not rings — those go to Shop Keeper). */
function isTomRepairableType(itemType: string | undefined): boolean {
    return (
        itemType === 'weapon' ||
        itemType === 'shield' ||
        itemType === 'armor' ||
        itemType === 'hauberk' ||
        itemType === 'leggings' ||
        itemType === 'helmet' ||
        itemType === 'cape' ||
        itemType === 'boots'
    );
}

/**
 * Tom blacksmith: Repair All · Buy weapons · Buy armor.
 */
export function BlacksmithDialog({
    position,
    zIndex,
    onBringToFront,
    phaserRef,
}: BlacksmithDialogProps) {
    const isOpen = useStore(blacksmithDialogStore, (s) => s.isOpen);
    const npcId = useStore(blacksmithDialogStore, (s) => s.npcId);
    const npcName = useStore(blacksmithDialogStore, (s) => s.npcName);
    const statusMessage = useStore(blacksmithDialogStore, (s) => s.statusMessage);
    const [tab, setTab] = useState<BlacksmithTab>('repair');

    const repairCandidates = useMemo(() => {
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
            const max = item.maxLifeSpan ?? 0;
            const cur = item.curLifeSpan ?? max;
            if (max <= 1 || cur >= max) {
                return;
            }
            const def = getItemById(item.itemId);
            // Tom: weapons, shields, armor, helms (server cat 1–10). Rings → Shop Keeper.
            if (!def || !isTomRepairableType(def.itemType)) {
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
    }, [isOpen, statusMessage, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const game = phaserRef.current?.game;
    const networkManager = game ? getNetworkManager(game) : undefined;

    const buy = (itemId: number) => {
        if (!networkManager || !npcId) {
            setBlacksmithStatusMessage('Cannot reach the blacksmith right now.');
            return;
        }
        setBlacksmithStatusMessage('Buying…');
        networkManager.sendBuyShopItemRequest(npcId, itemId, 1);
    };

    const repair = (itemUid: string) => {
        if (!networkManager || !npcId) {
            setBlacksmithStatusMessage('Cannot reach the blacksmith right now.');
            return;
        }
        setBlacksmithStatusMessage('Repairing…');
        networkManager.sendRepairItemRequest(npcId, itemUid);
    };

    const repairAll = () => {
        if (!networkManager || !npcId) {
            setBlacksmithStatusMessage('Cannot reach the blacksmith right now.');
            return;
        }
        if (repairCandidates.length === 0) {
            setBlacksmithStatusMessage('Nothing to repair.');
            return;
        }
        setBlacksmithStatusMessage(`Repairing ${repairCandidates.length} item(s)…`);
        for (const row of repairCandidates) {
            networkManager.sendRepairItemRequest(npcId, row.itemUid);
        }
    };

    const catalog = tab === 'weapons' ? BLACKSMITH_WEAPON_CATALOG : BLACKSMITH_ARMOR_CATALOG;

    return (
        <OlympiaDialogShell
            id="blacksmith-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setBlacksmithDialogOpen(false);
            }}
            width={400}
            minHeight={440}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="shop-dialog-root"
        >
            <div className="olympia-dialog-title-bar">{npcName} — Blacksmith</div>
            <div className="shop-dialog-content">
                <div className="npc-shop-tabs" role="tablist" aria-label="Blacksmith sections">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'repair'}
                        className={`npc-shop-tab${tab === 'repair' ? ' is-active' : ''}`}
                        onClick={() => setTab('repair')}
                    >
                        Repair all
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'weapons'}
                        className={`npc-shop-tab${tab === 'weapons' ? ' is-active' : ''}`}
                        onClick={() => setTab('weapons')}
                    >
                        Weapons
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'armor'}
                        className={`npc-shop-tab${tab === 'armor' ? ' is-active' : ''}`}
                        onClick={() => setTab('armor')}
                    >
                        Armor
                    </button>
                </div>

                {tab === 'repair' && (
                    <>
                        <div className="npc-shop-toolbar">
                            <button
                                type="button"
                                className="npc-shop-primary-btn"
                                onClick={repairAll}
                                disabled={repairCandidates.length === 0}
                                title="Repair every damaged weapon, shield, or armor in bag or equipped"
                            >
                                Repair all ({repairCandidates.length})
                            </button>
                        </div>
                        <p className="shop-dialog-intro">Damaged weapons, shields &amp; armor:</p>
                        <div className="shop-dialog-list">
                            {repairCandidates.length === 0 ? (
                                <p className="shop-dialog-hint">Nothing needs repair.</p>
                            ) : (
                                repairCandidates.map((row) => (
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

                {(tab === 'weapons' || tab === 'armor') && (
                    <>
                        <p className="shop-dialog-intro">
                            {tab === 'weapons' ? 'Buy weapons & shields:' : 'Buy armor:'}
                        </p>
                        <div className="shop-dialog-list">
                            {catalog.map((row) => (
                                <div key={row.itemId} className="shop-dialog-row">
                                    <span className="shop-dialog-item-name">{row.name}</span>
                                    <span className="shop-dialog-item-price">{row.price}g</span>
                                    <OlympiaSpriteButton
                                        normalKey={DIALOG_BTN_OK}
                                        hoverKey={DIALOG_BTN_OK_HOVER}
                                        title={`Buy ${row.name}`}
                                        fallbackLabel="Buy"
                                        onClick={() => buy(row.itemId)}
                                        className="shop-dialog-buy-btn"
                                    />
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {statusMessage ? <p className="shop-dialog-status">{statusMessage}</p> : null}
                <p className="shop-dialog-hint">Right-click dialog to close.</p>
            </div>
        </OlympiaDialogShell>
    );
}
