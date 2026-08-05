import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { LEVELSET_DIALOG_BG } from '../../constants/SpriteKeys';
import { getItemById } from '../../constants/Items';
import { AuctionListingMode } from '../../proto/generated/network';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getInventoryManager, getNetworkManager } from '../../utils/RegistryUtils';
import {
    auctionBoardDialogStore,
    patchAuctionBoardCreateDraft,
    setAuctionBoardDialogOpen,
    setAuctionBoardTab,
} from '../store/AuctionBoardDialog.store';

interface AuctionBoardDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

interface BagRow {
    itemUid: string;
    itemId: number;
    quantity: number;
    name: string;
}

function splitCsv(text: string): string[] {
    return text
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function formatDue(ms: number): string {
    if (!ms) {
        return '—';
    }
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return String(ms);
    }
}

/**
 * Trade / auction board: browse listings, create timed/limit sells with access rules, bid/buy, settle fee debt.
 * Desk chrome matches Olympia/Nemesis shop-style panels (dark glass, Cinzel title, gray action buttons).
 */
export function AuctionBoardDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: AuctionBoardDialogProps) {
    const isOpen = useStore(auctionBoardDialogStore, (s) => s.isOpen);
    const tab = useStore(auctionBoardDialogStore, (s) => s.tab);
    const listings = useStore(auctionBoardDialogStore, (s) => s.listings);
    const statusMessage = useStore(auctionBoardDialogStore, (s) => s.statusMessage);
    const settlementNote = useStore(auctionBoardDialogStore, (s) => s.settlementNote);
    const myDebtGold = useStore(auctionBoardDialogStore, (s) => s.myDebtGold);
    const myDebtDueMs = useStore(auctionBoardDialogStore, (s) => s.myDebtDueMs);
    const myTradeBlocked = useStore(auctionBoardDialogStore, (s) => s.myTradeBlocked);
    const draft = useStore(auctionBoardDialogStore, (s) => s.createDraft);
    const [bagRows, setBagRows] = useState<BagRow[]>([]);
    const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});

    const network = () => {
        const game = phaserRef?.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    const refreshBag = () => {
        const game = phaserRef?.current?.game;
        if (!game) {
            setBagRows([]);
            return;
        }
        const inv = getInventoryManager(game);
        setBagRows(
            inv.baggedItems
                .filter((item) => item.itemId !== 90)
                .map((item) => ({
                    itemUid: item.itemUid,
                    itemId: item.itemId,
                    quantity: item.quantity ?? 1,
                    name: getItemById(item.itemId)?.name ?? `Item ${item.itemId}`,
                })),
        );
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        refreshBag();
        network()?.sendAuctionBoardBrowseRequest();
    }, [isOpen, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const createListing = () => {
        const nm = network();
        if (!nm || !draft.itemUid) {
            return;
        }
        nm.sendAuctionBoardCreateRequest({
            itemUid: draft.itemUid,
            mode: draft.mode === 'time' ? AuctionListingMode.AUCTION_LISTING_MODE_TIME : AuctionListingMode.AUCTION_LISTING_MODE_LIMIT,
            listPriceGold: draft.listPriceGold,
            minBidGold: draft.minBidGold,
            durationHours: draft.durationHours,
            access: {
                onlyOwnCity: draft.onlyOwnCity,
                onlyOwnGuild: draft.onlyOwnGuild,
                requireFullLevelAndRep100: draft.requireFullLevelAndRep100,
                blockedGuildIds: splitCsv(draft.blockedGuildIdsText),
                blockedPlayerNames: splitCsv(draft.blockedPlayerNamesText),
            },
        });
    };

    return (
        <OlympiaDialogShell
            id="auction-board-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setAuctionBoardDialogOpen(false);
            }}
            onPositionChange={onPositionChange}
            width={340}
            minHeight={380}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="auction-board-dialog-root"
        >
            <div className="olympia-dialog-title-bar hb-nemesis-dialog-title">Auction Board</div>
            <div className="auction-board-tabs">
                {(['browse', 'create', 'debt'] as const).map((t) => (
                    <button
                        key={t}
                        type="button"
                        className={`auction-board-tab${tab === t ? ' auction-board-tab--active' : ''}`}
                        onClick={() => setAuctionBoardTab(t)}
                    >
                        {t === 'browse' ? 'Browse' : t === 'create' ? 'Create' : 'Debt'}
                    </button>
                ))}
            </div>
            <div className="shop-dialog-content auction-board-body">
                <div className="auction-board-toolbar">
                    <button
                        type="button"
                        className="olympia-text-btn"
                        onClick={() => network()?.sendAuctionBoardBrowseRequest()}
                    >
                        Refresh
                    </button>
                </div>

                {statusMessage ? <p className="shop-dialog-status">{statusMessage}</p> : null}
                {myTradeBlocked ? (
                    <p className="shop-dialog-status">Trade blocked — settle fee debt first.</p>
                ) : null}
                {settlementNote ? <p className="auction-board-note">{settlementNote}</p> : null}

                {tab === 'browse' ? (
                    <div className="auction-board-list">
                        {listings.length === 0 ? (
                            <p className="shop-dialog-status">No active listings.</p>
                        ) : (
                            listings.map((listing) => {
                                const isLimit = listing.mode === AuctionListingMode.AUCTION_LISTING_MODE_LIMIT;
                                const bidValue =
                                    bidAmounts[listing.listingId] ??
                                    Math.max(listing.currentBidGold + 1, listing.minBidGold || 1);
                                return (
                                    <div key={listing.listingId} className="shop-dialog-row auction-board-row">
                                        <div className="auction-board-row-main">
                                            <div className="shop-dialog-item-name">
                                                {listing.quantity}× {listing.itemName || `Item ${listing.itemId}`}
                                            </div>
                                            <div className="auction-board-meta">
                                                {isLimit ? 'Limit' : 'Timed'} · {listing.sellerName} ·{' '}
                                                {listing.sellerCity || '?'}
                                                {listing.sellerGuildId ? ` · guild ${listing.sellerGuildId}` : ''}
                                            </div>
                                            <div className="auction-board-meta">
                                                {isLimit
                                                    ? `Price ${listing.listPriceGold}g`
                                                    : `Bid ${listing.currentBidGold || 0}g (min ${listing.minBidGold}g)`}
                                                {listing.currentBidderName
                                                    ? ` · ${listing.currentBidderName}`
                                                    : ''}
                                            </div>
                                        </div>
                                        <div className="auction-board-actions">
                                            {isLimit ? (
                                                <button
                                                    type="button"
                                                    className="olympia-text-btn"
                                                    onClick={() =>
                                                        network()?.sendAuctionBoardBuyRequest(listing.listingId)
                                                    }
                                                >
                                                    Buy
                                                </button>
                                            ) : (
                                                <>
                                                    <input
                                                        type="number"
                                                        className="olympia-input auction-board-bid-input"
                                                        min={1}
                                                        value={bidValue}
                                                        onChange={(ev) =>
                                                            setBidAmounts((prev) => ({
                                                                ...prev,
                                                                [listing.listingId]: Number(ev.target.value) || 0,
                                                            }))
                                                        }
                                                    />
                                                    <button
                                                        type="button"
                                                        className="olympia-text-btn"
                                                        onClick={() =>
                                                            network()?.sendAuctionBoardBidRequest(
                                                                listing.listingId,
                                                                bidValue,
                                                            )
                                                        }
                                                    >
                                                        Bid
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                type="button"
                                                className="olympia-text-btn"
                                                onClick={() =>
                                                    network()?.sendAuctionBoardCancelRequest(listing.listingId)
                                                }
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : null}

                {tab === 'create' ? (
                    <div className="auction-board-create">
                        <label className="auction-board-label">
                            Mode
                            <select
                                className="olympia-input"
                                value={draft.mode}
                                onChange={(ev) =>
                                    patchAuctionBoardCreateDraft({
                                        mode: ev.target.value === 'time' ? 'time' : 'limit',
                                    })
                                }
                            >
                                <option value="limit">Limit sell</option>
                                <option value="time">Timed auction</option>
                            </select>
                        </label>
                        <label className="auction-board-label">
                            Bag item
                            <select
                                className="olympia-input"
                                value={draft.itemUid}
                                onChange={(ev) => patchAuctionBoardCreateDraft({ itemUid: ev.target.value })}
                                onFocus={refreshBag}
                            >
                                <option value="">Select item…</option>
                                {bagRows.map((row) => (
                                    <option key={row.itemUid} value={row.itemUid}>
                                        {row.quantity}× {row.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="auction-board-label">
                            List / buy price (gold)
                            <input
                                type="number"
                                className="olympia-input"
                                min={1}
                                value={draft.listPriceGold}
                                onChange={(ev) =>
                                    patchAuctionBoardCreateDraft({
                                        listPriceGold: Number(ev.target.value) || 0,
                                    })
                                }
                            />
                        </label>
                        {draft.mode === 'time' ? (
                            <>
                                <label className="auction-board-label">
                                    Min bid (gold)
                                    <input
                                        type="number"
                                        className="olympia-input"
                                        min={1}
                                        value={draft.minBidGold}
                                        onChange={(ev) =>
                                            patchAuctionBoardCreateDraft({
                                                minBidGold: Number(ev.target.value) || 0,
                                            })
                                        }
                                    />
                                </label>
                                <label className="auction-board-label">
                                    Duration (hours)
                                    <input
                                        type="number"
                                        className="olympia-input"
                                        min={1}
                                        max={168}
                                        value={draft.durationHours}
                                        onChange={(ev) =>
                                            patchAuctionBoardCreateDraft({
                                                durationHours: Number(ev.target.value) || 24,
                                            })
                                        }
                                    />
                                </label>
                            </>
                        ) : null}

                        <div className="auction-board-checks">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={draft.onlyOwnCity}
                                    onChange={(ev) =>
                                        patchAuctionBoardCreateDraft({ onlyOwnCity: ev.target.checked })
                                    }
                                />{' '}
                                Only own city
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={draft.onlyOwnGuild}
                                    onChange={(ev) =>
                                        patchAuctionBoardCreateDraft({ onlyOwnGuild: ev.target.checked })
                                    }
                                />{' '}
                                Only own guild (Fase H stub)
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={draft.requireFullLevelAndRep100}
                                    onChange={(ev) =>
                                        patchAuctionBoardCreateDraft({
                                            requireFullLevelAndRep100: ev.target.checked,
                                        })
                                    }
                                />{' '}
                                Full level + rep ≥ 100
                            </label>
                        </div>
                        <label className="auction-board-label">
                            Don&apos;t sell to guilds (csv)
                            <input
                                type="text"
                                className="olympia-input"
                                value={draft.blockedGuildIdsText}
                                onChange={(ev) =>
                                    patchAuctionBoardCreateDraft({ blockedGuildIdsText: ev.target.value })
                                }
                                placeholder="guildA, guildB"
                            />
                        </label>
                        <label className="auction-board-label">
                            Don&apos;t sell to players (csv)
                            <input
                                type="text"
                                className="olympia-input"
                                value={draft.blockedPlayerNamesText}
                                onChange={(ev) =>
                                    patchAuctionBoardCreateDraft({ blockedPlayerNamesText: ev.target.value })
                                }
                                placeholder="Name1, Name2"
                            />
                        </label>
                        <button type="button" className="olympia-text-btn" onClick={createListing}>
                            List item
                        </button>
                    </div>
                ) : null}

                {tab === 'debt' ? (
                    <div className="auction-board-debt">
                        <p>
                            Fee debt: <strong>{myDebtGold}</strong> gold
                        </p>
                        <p>Due: {formatDue(myDebtDueMs)}</p>
                        <p className="auction-board-note">
                            Commission is 5% of sale price, deducted from seller wallet gold. If short, debt
                            must be settled within &lt; 3 days or char/IP trade is blocked.
                        </p>
                        <button
                            type="button"
                            className="olympia-text-btn"
                            onClick={() => network()?.sendAuctionBoardSettleDebtRequest()}
                        >
                            Settle debt
                        </button>
                    </div>
                ) : null}

                <p className="shop-dialog-hint">Right-click dialog to close.</p>
            </div>
        </OlympiaDialogShell>
    );
}
