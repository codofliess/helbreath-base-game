/**
 * Cash Shop catalog — mirrors server Config/CashShop.json.
 * Prices in USDT (priceStableUsdCents). $HELL when priceHell > 0 (usd × 1200).
 */

export const CASHIER_CATALOG_NPC_ID = 14;

/** Remote open (F12 Cash) — no NPC distance check when server allowRemoteOpen. */
export const CASH_SHOP_REMOTE_NPC_ID = '0';

export const CASH_CURRENCY_STABLE = 1;
export const CASH_CURRENCY_HELL = 2;

export const GENUINE_STABLECOIN_MINTS = {
    mainnet: {
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
    devnet: {
        USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        USDT: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFIXaNtrY6tt4k1m7s',
    },
} as const;

export type CashShopCategory = 'gear' | 'services' | 'seals' | 'tablets' | 'gold' | 'utility' | 'stones';

export const CASH_SHOP_CATEGORIES: readonly { id: CashShopCategory; label: string }[] = [
    { id: 'gear', label: 'Gear' },
    { id: 'services', label: 'Services' },
    { id: 'seals', label: 'Bind / NFT' },
    { id: 'tablets', label: 'Tablets' },
    { id: 'gold', label: 'Gold' },
    { id: 'utility', label: 'Pots & more' },
    { id: 'stones', label: 'Stones' },
];

export interface CashShopSku {
    skuId: string;
    itemId: number;
    bonusItemId?: number;
    name: string;
    category: CashShopCategory;
    quantity: number;
    /** USD cents (USDT list price). */
    priceStableUsdCents: number;
    /** Pending $HELL; 0 = stablecoin only. */
    priceHell: number;
    note?: string;
}

export function skuAcceptsHell(sku: Pick<CashShopSku, 'priceHell'>): boolean {
    return sku.priceHell > 0;
}

/** Catalog — keep in sync with server Config/CashShop.json. */
export const CASH_SHOP_SKUS: readonly CashShopSku[] = [
    // Gear (bound)
    { skuId: 'shoes-exp-mp-drop', itemId: 950, name: 'Shoes Exp+30% + MP Recovery+40% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 4900, priceHell: 0 },
    { skuId: 'shoes-exp-hp-drop', itemId: 951, name: 'Shoes Exp+30% + HP Recovery+40% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 4900, priceHell: 0 },
    { skuId: 'boots-exp-mp-drop', itemId: 952, name: 'Boots Exp+30% + MP Recovery+40% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 4900, priceHell: 0 },
    { skuId: 'boots-exp-hp-drop', itemId: 953, name: 'Boots Exp+30% + HP Recovery+40% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 4900, priceHell: 0 },
    { skuId: 'cape-exp-mp-drop', itemId: 954, name: 'Cape Exp+40% + MP Recovery+50% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 1900, priceHell: 0 },
    { skuId: 'cape-exp-hp-drop', itemId: 955, name: 'Cape Exp+40% + HP Recovery+50% (bound)', category: 'gear', quantity: 1, priceStableUsdCents: 1900, priceHell: 0 },

    // Services / tickets
    { skuId: 'ticket-unlearn-talent', itemId: 1304, name: 'Unlearn Talent Ticket', category: 'services', quantity: 1, priceStableUsdCents: 1000, priceHell: 12000 },
    { skuId: 'ticket-stat-change', itemId: 1305, name: 'Stat Change Ticket', category: 'services', quantity: 1, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'ticket-name-change', itemId: 1306, name: 'Name Change Ticket', category: 'services', quantity: 1, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'ticket-town-change', itemId: 1307, name: 'Change City Ticket', category: 'services', quantity: 1, priceStableUsdCents: 1900, priceHell: 22800 },
    {
        skuId: 'ticket-guild-name-change',
        itemId: 1308,
        name: 'Guild Name Change Ticket',
        category: 'services',
        quantity: 1,
        priceStableUsdCents: 1900,
        priceHell: 22800,
        note: 'Free with 1M collective guild stake (TBD)',
    },
    { skuId: 'ticket-reputation-100', itemId: 1314, name: '100 Reputation Ticket', category: 'services', quantity: 1, priceStableUsdCents: 1000, priceHell: 12000 },

    // Seals / bind / NFT
    { skuId: 'ticket-item-nft', itemId: 1309, name: 'Item into NFT Ticket', category: 'seals', quantity: 1, priceStableUsdCents: 500, priceHell: 6000 },
    {
        skuId: 'ticket-guild-bind',
        itemId: 1301,
        name: 'Bound Item to Guild Ticket',
        category: 'seals',
        quantity: 1,
        priceStableUsdCents: 500,
        priceHell: 6000,
        note: 'Guild members only; GM controlled',
    },
    { skuId: 'ticket-unbind', itemId: 1302, name: 'Unbound Ticket', category: 'seals', quantity: 1, priceStableUsdCents: 300, priceHell: 3600 },
    { skuId: 'ticket-bind', itemId: 1300, name: 'Binding Ticket (Soulbound)', category: 'seals', quantity: 1, priceStableUsdCents: 300, priceHell: 3600 },

    // Ancient tablets
    { skuId: 'tablet-exp-x5', itemId: 1310, name: '5× Exp Tablet (+200% EXP 30m)', category: 'tablets', quantity: 5, priceStableUsdCents: 1000, priceHell: 12000 },
    { skuId: 'tablet-hp-x5', itemId: 1311, name: '5× HP Tablet (2× HP + regen 15m)', category: 'tablets', quantity: 5, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'tablet-mp-x5', itemId: 1312, name: '5× MP Tablet (unlimited mana 30m)', category: 'tablets', quantity: 5, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'tablet-berserk-x5', itemId: 1313, name: '5× Berserk Tablet', category: 'tablets', quantity: 5, priceStableUsdCents: 100, priceHell: 1200 },

    // Gold
    { skuId: 'gold-500k', itemId: 90, name: '500,000 Gold', category: 'gold', quantity: 500000, priceStableUsdCents: 100, priceHell: 1200 },
    { skuId: 'gold-3m', itemId: 90, name: '3,000,000 Gold', category: 'gold', quantity: 3000000, priceStableUsdCents: 500, priceHell: 6000 },

    // Utility pots
    { skuId: 'pots-invi-x50', itemId: 273, name: '50× Invisibility Potion', category: 'utility', quantity: 50, priceStableUsdCents: 100, priceHell: 1200 },
    { skuId: 'pot-sex-change', itemId: 274, name: 'Sex Change Potion', category: 'utility', quantity: 1, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'pot-armor-sex-change', itemId: 1315, name: 'Armor Sex Change Potion', category: 'utility', quantity: 1, priceStableUsdCents: 900, priceHell: 10800 },
    { skuId: 'dyes-x5', itemId: 360, name: '5× Dye (any colour pack)', category: 'utility', quantity: 5, priceStableUsdCents: 300, priceHell: 3600 },
    { skuId: 'gold-carp-x5', itemId: 572, name: '5× Golden Carp', category: 'utility', quantity: 5, priceStableUsdCents: 700, priceHell: 8400 },

    // Stones
    { skuId: 'stone-merien-x5', itemId: 657, name: '5× Stone of Merien', category: 'stones', quantity: 5, priceStableUsdCents: 500, priceHell: 6000 },
    { skuId: 'stone-xelima-x5', itemId: 656, name: '5× Stone of Xelima', category: 'stones', quantity: 5, priceStableUsdCents: 900, priceHell: 10800 },
    {
        skuId: 'stone-integrity-x1',
        itemId: 1112,
        name: '1× Stone of Integrity (+3 hold)',
        category: 'stones',
        quantity: 1,
        priceStableUsdCents: 3900,
        priceHell: 46800,
        note: 'From +3: fail keeps +N — no burn, no drop',
    },
    {
        skuId: 'stone-integrity-x3',
        itemId: 1112,
        name: '3× Stone of Integrity (+3 hold)',
        category: 'stones',
        quantity: 3,
        priceStableUsdCents: 9900,
        priceHell: 118800,
        note: 'From +3: fail keeps +N — no burn, no drop',
    },
];

export function formatStablePrice(cents: number): string {
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)} USDT`;
}

export function isGenuineStablecoinMint(mint: string): boolean {
    const m = mint.trim();
    for (const cluster of Object.values(GENUINE_STABLECOIN_MINTS)) {
        for (const addr of Object.values(cluster)) {
            if (addr === m) {
                return true;
            }
        }
    }
    return false;
}
