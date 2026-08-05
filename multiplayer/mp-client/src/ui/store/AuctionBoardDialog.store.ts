import { Store } from '@tanstack/react-store';
import type { AuctionListing } from '../../proto/generated/network';

export type AuctionBoardTab = 'browse' | 'create' | 'debt';

export interface AuctionBoardCreateDraft {
    mode: 'time' | 'limit';
    itemUid: string;
    listPriceGold: number;
    minBidGold: number;
    durationHours: number;
    onlyOwnCity: boolean;
    onlyOwnGuild: boolean;
    requireFullLevelAndRep100: boolean;
    blockedGuildIdsText: string;
    blockedPlayerNamesText: string;
}

interface AuctionBoardDialogState {
    isOpen: boolean;
    tab: AuctionBoardTab;
    listings: AuctionListing[];
    statusMessage: string;
    settlementNote: string;
    myDebtGold: number;
    myDebtDueMs: number;
    myTradeBlocked: boolean;
    createDraft: AuctionBoardCreateDraft;
}

const defaultCreateDraft = (): AuctionBoardCreateDraft => ({
    mode: 'limit',
    itemUid: '',
    listPriceGold: 100,
    minBidGold: 50,
    durationHours: 24,
    onlyOwnCity: false,
    onlyOwnGuild: false,
    requireFullLevelAndRep100: false,
    blockedGuildIdsText: '',
    blockedPlayerNamesText: '',
});

export const auctionBoardDialogStore = new Store<AuctionBoardDialogState>({
    isOpen: false,
    tab: 'browse',
    listings: [],
    statusMessage: '',
    settlementNote: '',
    myDebtGold: 0,
    myDebtDueMs: 0,
    myTradeBlocked: false,
    createDraft: defaultCreateDraft(),
});

export function setAuctionBoardDialogOpen(value: boolean): void {
    auctionBoardDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

/** Shared entry point for Bag / SysMenu / Warehouse / Guild Warehouse access. */
export function openAuctionBoard(): void {
    setAuctionBoardDialogOpen(true);
}

export function setAuctionBoardTab(tab: AuctionBoardTab): void {
    auctionBoardDialogStore.setState((s) => ({ ...s, tab }));
}

export function applyAuctionBoardSnapshot(payload: {
    listings: AuctionListing[];
    message?: string;
    myDebtGold?: number;
    myDebtDueMs?: number;
    myTradeBlocked?: boolean;
    settlementNote?: string;
}): void {
    auctionBoardDialogStore.setState((s) => ({
        ...s,
        listings: payload.listings ?? [],
        statusMessage: payload.message || s.statusMessage,
        myDebtGold: payload.myDebtGold ?? 0,
        myDebtDueMs: payload.myDebtDueMs ?? 0,
        myTradeBlocked: payload.myTradeBlocked ?? false,
        settlementNote: payload.settlementNote || s.settlementNote,
    }));
}

export function applyAuctionBoardActionResult(payload: {
    ok: boolean;
    message?: string;
    listing?: AuctionListing;
    myDebtGold?: number;
    myDebtDueMs?: number;
    myTradeBlocked?: boolean;
}): void {
    auctionBoardDialogStore.setState((s) => {
        let listings = s.listings;
        if (payload.listing?.listingId) {
            const idx = listings.findIndex((l) => l.listingId === payload.listing!.listingId);
            if (idx >= 0) {
                listings = [...listings];
                listings[idx] = payload.listing;
            } else if (payload.ok) {
                listings = [payload.listing, ...listings];
            }
        }
        return {
            ...s,
            listings,
            statusMessage: payload.message || (payload.ok ? 'OK' : 'Failed'),
            myDebtGold: payload.myDebtGold ?? s.myDebtGold,
            myDebtDueMs: payload.myDebtDueMs ?? s.myDebtDueMs,
            myTradeBlocked: payload.myTradeBlocked ?? s.myTradeBlocked,
        };
    });
}

export function patchAuctionBoardCreateDraft(patch: Partial<AuctionBoardCreateDraft>): void {
    auctionBoardDialogStore.setState((s) => ({
        ...s,
        createDraft: { ...s.createDraft, ...patch },
    }));
}

export function resetAuctionBoardCreateDraft(): void {
    auctionBoardDialogStore.setState((s) => ({
        ...s,
        createDraft: defaultCreateDraft(),
    }));
}
