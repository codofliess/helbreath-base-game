/**
 * List price + category for Olympia sell quotes (mirrors server Items.json).
 */
import { OLYMPIA_ITEM_PRICES } from '../constants/OlympiaItemPrices.generated';

const byId = new Map<number, { price: number; category: number }>();
for (const row of OLYMPIA_ITEM_PRICES) {
    byId.set(row.id, { price: row.price, category: row.category });
}

/** Returns Items.json list price and category; missing fields are 0. */
export function getOlympiaItemPriceCatalog(itemId: number): { price: number; category: number } {
    return byId.get(itemId) ?? { price: 0, category: 0 };
}
