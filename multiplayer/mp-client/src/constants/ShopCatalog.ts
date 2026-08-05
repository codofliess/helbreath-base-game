/**
 * General shop (Shop Keeper) + Tom blacksmith catalogs — prices match server Helpers/Shop.cs
 * (Olympia Item.cfg for-sale list).
 *
 * NPC interaction coverage (traveler / mp-client):
 * - Shop Keeper (catalog 0): talk → ShopDialog → BuyShopItemRequest ✅
 * - Gandalf / Magic Tower (catalog 1): talk → MagicShopDialog (client learn) ✅
 * - Howard (2): Guild Hall → register interest (persisted) + beginner path credit ✅
 * - Cashier (14): Guild Hall / City Hall → CashShopDialog (stable all; $HELL combos+stones+utility) ✅
 * - Tom (3): BlacksmithDialog → BuyShopItemRequest (weapons/shields/armor) + RepairItemRequest ✅
 * - William (4): WarehouseDialog → deposit/withdraw ✅
 * - Kennedy (5): City Hall → citizenship brief / services summary ✅
 * - Gail (6): Cathedral → heal / bless (PFM) / donate ✅
 * - Perry (8): Command Hall → crusade brief stub ✅
 * - Guard (10): catalog retained for summons; outdoor city guards are Friendly dwell monsters near TP plaza (no click-talk)
 * - Beginner path / farm: Enzu (11), Drillmaster (12), Merc Captain (13) — Quest / Training tips ✅
 * - McGaffin (7) / Devlin (9): not placed in GameWorlds.json (no click path)
 *
 * Still limited: full guild create/join (Fase H), classic city rename/contribution, live crusade schedule.
 */

/** Max units per BuyShopItemRequest — matches server `Shop.HandleBuyShopItemRequest` clamp. */
export const SHOP_MAX_BUY_QUANTITY = 50;

export type ShopCatalogRow = { itemId: number; name: string; price: number };

/**
 * Shop Keeper — potions, food, arrows, scrolls, manuals, dyes, light clothes, tools, seeds.
 * Prices = Item.cfg (Olympia for-sale).
 */
export const SHOP_CONSUMABLE_CATALOG: readonly ShopCatalogRow[] = [
    // Potions
    { itemId: 91, name: 'Red Potion', price: 10 },
    { itemId: 92, name: 'Big Red Potion', price: 65 },
    { itemId: 93, name: 'Blue Potion', price: 10 },
    { itemId: 94, name: 'Big Blue Potion', price: 65 },
    { itemId: 95, name: 'Green Potion', price: 10 },
    { itemId: 96, name: 'Big Green Potion', price: 65 },
    { itemId: 97, name: 'Dilution Potion', price: 200 },
    // Food
    { itemId: 98, name: 'Baguette', price: 5 },
    { itemId: 99, name: 'Meat', price: 10 },
    { itemId: 100, name: 'Fish', price: 30 },
    // Ammo
    { itemId: 77, name: 'Arrow', price: 1 },
    { itemId: 78, name: 'Poison Arrow', price: 5 },
    // Scrolls & tickets
    { itemId: 114, name: 'Recall Scroll', price: 120 },
    { itemId: 115, name: 'Invisibility Scroll', price: 560 },
    { itemId: 116, name: 'Detect Invi Scroll', price: 330 },
    { itemId: 117, name: 'Bleeding Island Ticket', price: 100 },
    { itemId: 88, name: 'Guild Admission Ticket', price: 5 },
    { itemId: 89, name: 'Guild Secession Ticket', price: 5 },
    { itemId: 104, name: 'Map', price: 30 },
    // Tools
    { itemId: 105, name: 'Fishing Rod', price: 100 },
    { itemId: 231, name: 'Pick Axe', price: 500 },
    { itemId: 232, name: 'Hoe', price: 300 },
    { itemId: 236, name: 'Manufacturing Hammer', price: 1500 },
    { itemId: 227, name: 'Alchemy Bowl', price: 1000 },
    // Skill manuals removed — server grants 20% on all skills by default.
    // Dyes
    { itemId: 360, name: 'Dye (Indigo)', price: 100 },
    { itemId: 364, name: 'Dye (Green)', price: 100 },
    { itemId: 365, name: 'Dye (Gray)', price: 100 },
    { itemId: 366, name: 'Dye (Aqua)', price: 100 },
    { itemId: 368, name: 'Dye (Violet)', price: 100 },
    { itemId: 369, name: 'Dye (Blue)', price: 100 },
    { itemId: 370, name: 'Dye (Tan)', price: 100 },
    { itemId: 371, name: 'Dye (Khaki)', price: 100 },
    { itemId: 372, name: 'Dye (Yellow)', price: 100 },
    { itemId: 373, name: 'Dye (Red)', price: 100 },
    { itemId: 375, name: 'Decoloration Potion', price: 100 },
    // Light clothes
    { itemId: 450, name: 'Shoes', price: 20 },
    { itemId: 451, name: 'Long Boots', price: 100 },
    { itemId: 402, name: 'Cape', price: 1000 },
    { itemId: 453, name: 'Shirt (M)', price: 20 },
    { itemId: 471, name: 'Shirt (W)', price: 20 },
    { itemId: 459, name: 'Trousers (M)', price: 80 },
    { itemId: 480, name: 'Trousers (W)', price: 80 },
    { itemId: 460, name: 'Knee Trousers (M)', price: 20 },
    { itemId: 481, name: 'Knee Trousers (W)', price: 20 },
    // Mine pots
    { itemId: 658, name: 'Aresden Mine Potion', price: 10 },
    { itemId: 659, name: 'Elvine Mine Potion', price: 10 },
    // Seeds
    { itemId: 801, name: 'Seed (Water Melon)', price: 100 },
    { itemId: 802, name: 'Seed (Pumpkin)', price: 100 },
    { itemId: 803, name: 'Seed (Garlic)', price: 150 },
    { itemId: 804, name: 'Seed (Barley)', price: 150 },
    { itemId: 805, name: 'Seed (Carrot)', price: 200 },
    { itemId: 806, name: 'Seed (Radish)', price: 200 },
    { itemId: 807, name: 'Seed (Corn)', price: 250 },
    { itemId: 808, name: 'Seed (CBellflower)', price: 250 },
    { itemId: 809, name: 'Seed (Melone)', price: 300 },
    { itemId: 810, name: 'Seed (Tommato)', price: 300 },
    { itemId: 811, name: 'Seed (Grapes)', price: 350 },
    { itemId: 812, name: 'Seed (Blue Grapes)', price: 350 },
    { itemId: 813, name: 'Seed (Mushroom)', price: 400 },
    { itemId: 814, name: 'Seed (Ginseng)', price: 450 },
];

/** Tom — weapons, bows, wands, shields (buy tab). */
export const BLACKSMITH_WEAPON_CATALOG: readonly ShopCatalogRow[] = [
    { itemId: 1, name: 'Dagger', price: 25 },
    { itemId: 4, name: 'Dagger+1', price: 100 },
    { itemId: 8, name: 'Short Sword', price: 50 },
    { itemId: 9, name: 'Short Sword+1', price: 200 },
    { itemId: 12, name: 'Main Gauche', price: 50 },
    { itemId: 13, name: 'Main Gauche+1', price: 200 },
    { itemId: 15, name: 'Gradius', price: 90 },
    { itemId: 16, name: 'Gradius+1', price: 350 },
    { itemId: 17, name: 'Long Sword', price: 180 },
    { itemId: 18, name: 'Long Sword+1', price: 650 },
    { itemId: 23, name: 'Sabre', price: 150 },
    { itemId: 24, name: 'Sabre+1', price: 600 },
    { itemId: 25, name: 'Scimitar', price: 200 },
    { itemId: 26, name: 'Scimitar+1', price: 800 },
    { itemId: 28, name: 'Falchion', price: 250 },
    { itemId: 29, name: 'Falchion+1', price: 1000 },
    { itemId: 31, name: 'Esterk', price: 400 },
    { itemId: 32, name: 'Esterk+1', price: 800 },
    { itemId: 34, name: 'Rapier', price: 300 },
    { itemId: 35, name: 'Rapier+1', price: 1300 },
    { itemId: 38, name: 'Broad Sword', price: 250 },
    { itemId: 39, name: 'Broad Sword+1', price: 1100 },
    { itemId: 42, name: 'Bastad Sword', price: 300 },
    { itemId: 43, name: 'Bastad Sword+1', price: 1200 },
    { itemId: 46, name: 'Claymore', price: 400 },
    { itemId: 47, name: 'Claymore+1', price: 1800 },
    { itemId: 50, name: 'Great Sword', price: 500 },
    { itemId: 51, name: 'Great Sword+1', price: 2300 },
    { itemId: 54, name: 'Flameberge', price: 700 },
    { itemId: 55, name: 'Flameberge+1', price: 3300 },
    { itemId: 59, name: 'Light Axe', price: 100 },
    { itemId: 60, name: 'Light Axe+1', price: 350 },
    { itemId: 62, name: 'Tomahoc', price: 180 },
    { itemId: 63, name: 'Tomahoc+1', price: 700 },
    { itemId: 65, name: 'Sexon Axe', price: 200 },
    { itemId: 66, name: 'Sexon Axe+1', price: 800 },
    { itemId: 68, name: 'Double Axe', price: 560 },
    { itemId: 69, name: 'Double Axe+1', price: 1200 },
    { itemId: 71, name: 'War Axe', price: 700 },
    { itemId: 72, name: 'War Axe+1', price: 2000 },
    { itemId: 75, name: 'Short Bow', price: 100 },
    { itemId: 76, name: 'Long Bow', price: 200 },
    { itemId: 617, name: 'Composite Bow', price: 3000 },
    { itemId: 258, name: 'Magic Wand (MS0)', price: 1000 },
    { itemId: 257, name: 'Magic Wand (MS10)', price: 2500 },
    { itemId: 256, name: 'Magic Wand (MS20)', price: 5000 },
    { itemId: 79, name: 'Wood Shield', price: 100 },
    { itemId: 80, name: 'Leather Shield', price: 150 },
    { itemId: 81, name: 'Targe Shield', price: 250 },
    { itemId: 82, name: 'Scooterm Shield', price: 300 },
    { itemId: 83, name: 'Blonde Shield', price: 450 },
    { itemId: 84, name: 'Iron Shield', price: 700 },
    { itemId: 85, name: 'Lagi Shield', price: 1300 },
    { itemId: 86, name: 'Knight Shield', price: 1500 },
    { itemId: 87, name: 'Tower Shield', price: 1800 },
];

/** Tom — body armor / helms / robes / hose. */
export const BLACKSMITH_ARMOR_CATALOG: readonly ShopCatalogRow[] = [
    { itemId: 454, name: 'Hauberk (M)', price: 400 },
    { itemId: 472, name: 'Hauberk (W)', price: 400 },
    { itemId: 455, name: 'Leather Armor (M)', price: 500 },
    { itemId: 475, name: 'Leather Armor (W)', price: 500 },
    { itemId: 457, name: 'Scale Mail (M)', price: 900 },
    { itemId: 477, name: 'Scale Mail (W)', price: 900 },
    { itemId: 456, name: 'Chain Mail (M)', price: 1200 },
    { itemId: 476, name: 'Chain Mail (W)', price: 1200 },
    { itemId: 461, name: 'Chain Hose (M)', price: 400 },
    { itemId: 482, name: 'Chain Hose (W)', price: 400 },
    { itemId: 462, name: 'Plate Leggings (M)', price: 1000 },
    { itemId: 483, name: 'Plate Leggings (W)', price: 1000 },
    { itemId: 458, name: 'Plate Mail (M)', price: 4500 },
    { itemId: 478, name: 'Plate Mail (W)', price: 4500 },
    { itemId: 600, name: 'Helm (M)', price: 800 },
    { itemId: 602, name: 'Helm (W)', price: 800 },
    { itemId: 601, name: 'Full Helm (M)', price: 1500 },
    { itemId: 603, name: 'Full Helm (W)', price: 1500 },
    { itemId: 590, name: 'Robe (M)', price: 2000 },
    { itemId: 591, name: 'Robe (W)', price: 2000 },
];

/** Shop Keeper — potions only. */
export const SHOP_POTION_CATALOG: readonly ShopCatalogRow[] = SHOP_CONSUMABLE_CATALOG.filter((r) =>
    [91, 92, 93, 94, 95, 96, 97, 658, 659].includes(r.itemId),
);

/** Shop Keeper — misc (food, tools, manuals, dyes, clothes, seeds…). */
export const SHOP_MISC_CATALOG: readonly ShopCatalogRow[] = SHOP_CONSUMABLE_CATALOG.filter(
    (r) => ![91, 92, 93, 94, 95, 96, 97, 658, 659].includes(r.itemId),
);

/** NPC catalog id for Shop Keeper (`NPCs.json` / server Shop.ShopKeeperCatalogNpcId). */
export const SHOP_KEEPER_CATALOG_NPC_ID = 0;

/** NPC catalog id for Gandalf / Magic Tower. */
export const MAGIC_SHOP_CATALOG_NPC_ID = 1;

/** NPC catalog id for Howard (guild hall). */
export const GUILD_HALL_CATALOG_NPC_ID = 2;

/** NPC catalog id for Cashier (cash shop dual market). */
export const CASHIER_CATALOG_NPC_ID = 14;

/** NPC catalog id for Tom (blacksmith). */
export const BLACKSMITH_CATALOG_NPC_ID = 3;

/** NPC catalog id for William (warehouse). */
export const WAREHOUSE_CATALOG_NPC_ID = 4;

/** NPC catalog id for Kennedy (city hall). */
export const CITY_HALL_CATALOG_NPC_ID = 5;

/** NPC catalog id for Gail (cathedral). */
export const CATHEDRAL_CATALOG_NPC_ID = 6;

/** NPC catalog id for Perry (command hall). */
export const COMMAND_HALL_CATALOG_NPC_ID = 8;

/** NPC catalog id for city Guard. */
export const GUARD_CATALOG_NPC_ID = 10;

/** Cathedral PvP Academy — Learning desk. */
export const ACADEMY_LEARNING_CATALOG_NPC_ID = 15;

/** Cathedral PvP Academy — Challenge desk (GM look). */
export const ACADEMY_CHALLENGE_CATALOG_NPC_ID = 16;

export type NpcInteractionRole =
    | 'shop'
    | 'magic-shop'
    | 'blacksmith'
    | 'warehouse'
    | 'guild-hall'
    | 'cash-shop'
    | 'city-hall'
    | 'cathedral'
    | 'command-hall'
    | 'guard'
    | 'quest-giver'
    | 'training-dummy'
    | 'training-merc'
    | 'academy-learning'
    | 'academy-challenge'
    | 'garden-warden'
    | 'generic';

/** Maps server NPC catalog id → interaction role for click-to-talk. */
export function getNpcInteractionRole(catalogNpcId: number): NpcInteractionRole {
    switch (catalogNpcId) {
        case SHOP_KEEPER_CATALOG_NPC_ID:
            return 'shop';
        case MAGIC_SHOP_CATALOG_NPC_ID:
            return 'magic-shop';
        case GUILD_HALL_CATALOG_NPC_ID:
            return 'guild-hall';
        case CASHIER_CATALOG_NPC_ID:
            return 'cash-shop';
        case BLACKSMITH_CATALOG_NPC_ID:
            return 'blacksmith';
        case WAREHOUSE_CATALOG_NPC_ID:
            return 'warehouse';
        case CITY_HALL_CATALOG_NPC_ID:
            return 'city-hall';
        case CATHEDRAL_CATALOG_NPC_ID:
            return 'cathedral';
        case COMMAND_HALL_CATALOG_NPC_ID:
            return 'command-hall';
        case GUARD_CATALOG_NPC_ID:
            return 'guard';
        case 11:
            return 'quest-giver';
        case 12:
            return 'training-dummy';
        case 13:
            return 'training-merc';
        case ACADEMY_LEARNING_CATALOG_NPC_ID:
            return 'academy-learning';
        case ACADEMY_CHALLENGE_CATALOG_NPC_ID:
            return 'academy-challenge';
        case 17:
            return 'garden-warden';
        default:
            return 'generic';
    }
}
