import { Store } from '@tanstack/react-store';
import {
    CASH_CURRENCY_STABLE,
    CASH_SHOP_REMOTE_NPC_ID,
    GENUINE_STABLECOIN_MINTS,
    type CashShopCategory,
} from '../../constants/CashShopCatalog';

export type CashMarketTab = 'stablecoin' | 'hell';

interface CashShopState {
    isOpen: boolean;
    npcId: string | null;
    npcName: string;
    market: CashMarketTab;
    category: CashShopCategory;
    /** Allowlisted mint currently selected for Stablecoin Market. */
    stablecoinMint: string;
    statusMessage: string;
}

const initialState: CashShopState = {
    isOpen: false,
    npcId: null,
    npcName: 'Cash Shop',
    market: 'stablecoin',
    category: 'gear',
    stablecoinMint: GENUINE_STABLECOIN_MINTS.mainnet.USDT,
    statusMessage: '',
};

export const cashShopDialogStore = new Store<CashShopState>(initialState);

export function openCashShopDialog(npcId: string, npcName: string): void {
    cashShopDialogStore.setState((s) => ({
        ...s,
        isOpen: true,
        npcId,
        npcName: npcName || 'Cash Shop',
        statusMessage: 'Prices in USDT. $HELL market when listed.',
        market: 'stablecoin',
        category: 'gear',
    }));
}

/** F12 green Cash button — no NPC required (server allowRemoteOpen). */
export function openCashShopRemote(): void {
    openCashShopDialog(CASH_SHOP_REMOTE_NPC_ID, 'Cash Shop');
}

export function setCashShopOpen(open: boolean): void {
    cashShopDialogStore.setState((s) => ({
        ...s,
        isOpen: open,
        ...(open ? {} : { npcId: null, statusMessage: '' }),
    }));
}

export function setCashShopMarket(market: CashMarketTab): void {
    cashShopDialogStore.setState((s) => ({ ...s, market }));
}

export function setCashShopCategory(category: CashShopCategory): void {
    cashShopDialogStore.setState((s) => ({ ...s, category }));
}

export function setCashShopStablecoinMint(mint: string): void {
    cashShopDialogStore.setState((s) => ({ ...s, stablecoinMint: mint.trim() }));
}

export function setCashShopStatusMessage(message: string): void {
    cashShopDialogStore.setState((s) => ({ ...s, statusMessage: message }));
}

export function cashCurrencyFromMarket(market: CashMarketTab): number {
    return market === 'hell' ? 2 : CASH_CURRENCY_STABLE;
}
