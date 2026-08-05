using System.Collections.Generic;

using Mmorpg.Network;

using Server.Utils;

using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Shop Keeper / Tom blacksmith purchases, Tom gear repair, and Shop Keeper ring repair:
/// proximity-checked, spending bag gold (item id 90).
/// </summary>
public static class Shop {
    /// <summary>Olympia Shop Keeper catalog id (<c>NPCs.json</c> / <c>areshop</c> / <c>elvshop</c> placements).</summary>
    public const int ShopKeeperCatalogNpcId = 0;

    /// <summary>Olympia Tom (blacksmith) catalog id (<c>arebsmith</c> / <c>elvbsmith</c>).</summary>
    public const int BlacksmithCatalogNpcId = 3;

    /// <summary>Chebyshev distance (cells) allowed between player and shop NPC.</summary>
    public const int MaxInteractDistance = 2;

    /// <summary>
    /// Shop Keeper gold catalog — Olympia-like for-sale utilities (Item.cfg prices).
    /// Gear/weapons live on Tom; premium cash items on Cashier.
    /// </summary>
    public static readonly IReadOnlyDictionary<int, int> ConsumablePrices = new Dictionary<int, int> {
        // Potions (Item.cfg)
        [91] = 10,    // Red Potion
        [92] = 65,    // Big Red Potion
        [93] = 10,    // Blue Potion
        [94] = 65,    // Big Blue Potion
        [95] = 10,    // Green Potion
        [96] = 65,    // Big Green Potion
        [97] = 200,   // Dilution Potion
        // Food
        [98] = 5,     // Baguette
        [99] = 10,    // Meat
        [100] = 30,   // Fish
        // Combat utility
        [77] = 1,     // Arrow
        [78] = 5,     // Poison Arrow (cfg often free-ish; small gold fee)
        // Scrolls & tickets
        [114] = 120,  // Recall Scroll
        [115] = 560,  // Invisibility Scroll
        [116] = 330,  // Detect Invi Scroll
        [117] = 100,  // Bleeding Island Ticket
        [88] = 5,     // Guild Admission Ticket
        [89] = 5,     // Guild Secession Ticket
        [104] = 30,   // Map
        // Tools
        [105] = 100,  // Fishing Rod
        [231] = 500,  // Pick Axe
        [232] = 300,  // Hoe
        [236] = 1500, // Manufacturing Hammer
        [227] = 1000, // Alchemy Bowl
        // Skill manuals removed — all skills default to 20% (see Skills.ApplyStartingDefaults).
        // Dyes / vanity
        [360] = 100,  // Dye(Indigo)
        [364] = 100,  // Dye(Green)
        [365] = 100,  // Dye(Gray)
        [366] = 100,  // Dye(Aqua)
        [368] = 100,  // Dye(Violet)
        [369] = 100,  // Dye(Blue)
        [370] = 100,  // Dye(Tan)
        [371] = 100,  // Dye(Khaki)
        [372] = 100,  // Dye(Yellow)
        [373] = 100,  // Dye(Red)
        [375] = 100,  // Decoloration Potion
        // Light clothing / starter gear (classic shop sold these)
        [450] = 20,   // Shoes
        [451] = 100,  // Long Boots
        [402] = 1000, // Cape
        [453] = 20,   // Shirt(M)
        [471] = 20,   // Shirt(W)
        [459] = 80,   // Trousers(M)
        [480] = 80,   // Trousers(W)
        [460] = 20,   // Knee Trousers(M)
        [481] = 20,   // Knee Trousers(W)
        // City mine potions
        [658] = 10,   // Aresden Mine Potion
        [659] = 10,   // Elvine Mine Potion
        // Farm seeds (Olympia shop)
        [801] = 100,
        [802] = 100,
        [803] = 150,
        [804] = 150,
        [805] = 200,
        [806] = 200,
        [807] = 250,
        [808] = 250,
        [809] = 300,
        [810] = 300,
        [811] = 350,
        [812] = 350,
        [813] = 400,
        [814] = 450,
    };

    /// <summary>Tom blacksmith: weapons, bows, shields, basic armor — Item.cfg gold prices.</summary>
    public static readonly IReadOnlyDictionary<int, int> BlacksmithWeaponPrices = new Dictionary<int, int> {
        // Daggers / short blades
        [1] = 25,     // Dagger
        [4] = 100,    // Dagger+1
        [8] = 50,     // Short Sword
        [9] = 200,    // Short Sword+1
        [12] = 50,    // Main Gauche
        [13] = 200,   // Main Gauche+1
        [15] = 90,    // Gradius
        [16] = 350,   // Gradius+1
        // Swords
        [17] = 180,   // Long Sword
        [18] = 650,   // Long Sword+1
        [23] = 150,   // Sabre
        [24] = 600,   // Sabre+1
        [25] = 200,   // Scimitar
        [26] = 800,   // Scimitar+1
        [28] = 250,   // Falchion
        [29] = 1000,  // Falchion+1
        [31] = 400,   // Esterk
        [32] = 800,   // Esterk+1
        [34] = 300,   // Rapier
        [35] = 1300,  // Rapier+1
        [38] = 250,   // Broad Sword
        [39] = 1100,  // Broad Sword+1
        [42] = 300,   // Bastad Sword
        [43] = 1200,  // Bastad Sword+1
        [46] = 400,   // Claymore
        [47] = 1800,  // Claymore+1
        [50] = 500,   // Great Sword
        [51] = 2300,  // Great Sword+1
        [54] = 700,   // Flameberge
        [55] = 3300,  // Flameberge+1
        // Axes
        [59] = 100,   // Light Axe
        [60] = 350,   // Light Axe+1
        [62] = 180,   // Tomahoc
        [63] = 700,   // Tomahoc+1
        [65] = 200,   // Sexon Axe
        [66] = 800,   // Sexon Axe+1
        [68] = 560,   // Double Axe
        [69] = 1200,  // Double Axe+1
        [71] = 700,   // War Axe
        [72] = 2000,  // War Axe+1
        // Bows + wands
        [75] = 100,   // Short Bow
        [76] = 200,   // Long Bow
        [617] = 3000, // Composite Bow
        [256] = 5000, // Magic Wand(MS20)
        [257] = 2500, // Magic Wand(MS10)
        [258] = 1000, // Magic Wand(MS0)
        // Shields
        [79] = 100,   // Wood Shield
        [80] = 150,   // Leather Shield
        [81] = 250,   // Targe Shield
        [82] = 300,   // Scooterm Shield
        [83] = 450,   // Blonde Shield
        [84] = 700,   // Iron Shield
        [85] = 1300,  // Lagi Shield
        [86] = 1500,  // Knight Shield
        [87] = 1800,  // Tower Shield
        // Armor (starter → mid, classic shop-sold)
        [454] = 400,  // Hauberk(M)
        [472] = 400,  // Hauberk(W)
        [455] = 500,  // Leather Armor(M)
        [475] = 500,  // Leather Armor(W)
        [457] = 900,  // Scale Mail(M)
        [477] = 900,  // Scale Mail(W)
        [456] = 1200, // Chain Mail(M)
        [476] = 1200, // Chain Mail(W)
        [461] = 400,  // Chain Hose(M)
        [482] = 400,  // Chain Hose(W)
        [462] = 1000, // Plate Leggings(M)
        [483] = 1000, // Plate Leggings(W)
        [458] = 4500, // Plate Mail(M)
        [478] = 4500, // Plate Mail(W)
        [600] = 800,  // Helm(M)
        [602] = 800,  // Helm(W)
        [601] = 1500, // Full Helm(M)
        [603] = 1500, // Full Helm(W)
        [590] = 2000, // Robe(M)
        [591] = 2000, // Robe(W)
    };

    /// <summary>Validates NPC proximity and catalog, spends gold, grants items, replies with <see cref="BuyShopItemResult"/>.</summary>
    public static void HandleBuyShopItemRequest(GameWorldRef wr, GameWorldPlayer player, BuyShopItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        var quantity = request.Quantity <= 0 ? 1 : Math.Min(request.Quantity, 50);
        if (!wr.NpcsByNpcId.TryGetValue(request.NpcId, out var npc)) {
            SendBuyResult(player, ok: false, "That shopkeeper is not here.");
            return;
        }

        IReadOnlyDictionary<int, int> priceTable;
        string vendorLabel;
        if (npc.CatalogNpcId == ShopKeeperCatalogNpcId) {
            priceTable = ConsumablePrices;
            vendorLabel = "Shop Keeper";
        } else if (npc.CatalogNpcId == BlacksmithCatalogNpcId) {
            priceTable = BlacksmithWeaponPrices;
            vendorLabel = "Tom";
        } else {
            SendBuyResult(player, ok: false, "You must talk to a shopkeeper or blacksmith.");
            return;
        }

        if (!priceTable.TryGetValue(request.ItemId, out var unitPrice)) {
            SendBuyResult(player, ok: false, "That item is not sold here.");
            return;
        }

        var dist = Math.Max(Math.Abs(player.PosX - npc.PosX), Math.Abs(player.PosY - npc.PosY));
        if (dist > MaxInteractDistance) {
            SendBuyResult(player, ok: false, $"Move closer to {vendorLabel}.");
            return;
        }

        var totalCost = unitPrice * quantity;
        if (!player.InventoryManager.TrySpendGold(totalCost, out var spendResult)) {
            SendBuyResult(player, ok: false, $"Need {totalCost} gold.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, spendResult);

        if (!player.InventoryManager.TryCreateItemStack(request.ItemId, quantity, out var grantResult)) {
            // Refund gold if the bag could not accept the purchase.
            if (player.InventoryManager.TryCreateItemStack(90, totalCost, out var refund)) {
                Inventory.ApplyInventoryMutation(wr, player, refund);
            }
            SendBuyResult(player, ok: false, "Your bag is full.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, grantResult);
        var itemName = wr.ItemsById.TryGetValue(request.ItemId, out var def) ? def.Name : $"item {request.ItemId}";
        SendBuyResult(player, ok: true, $"Bought {quantity}× {itemName} for {totalCost} gold.");
    }

    /// <summary>
    /// Quick-sell one bag item for gold (Item Drops tab). Olympia NPC buy-back formula; no NPC proximity required.
    /// </summary>
    /// <remarks>
    /// Anti-arbitrage: items sold by Shop Keeper / Tom use the shelf gold price as list price and never
    /// pay back more than half that shelf total. Without this, missing Items.json prices fell through to
    /// <see cref="EstimateFallbackSellGold"/> × 2 (e.g. Poison Arrow buy 5 → sell 10 → infinite gold).
    /// </remarks>
    public static void HandleSellBagItemRequest(GameWorldRef wr, GameWorldPlayer player, SellBagItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!player.InventoryManager.TryGetItemByUid(request.ItemUid, out var pending, out var equippedSlot)
            || pending is null
            || !string.IsNullOrEmpty(equippedSlot)) {
            SendSellResult(player, ok: false, "That item is not in your bag.");
            return;
        }

        if (ItemBind.IsTransferBlocked(pending)) {
            SendSellResult(player, ok: false, "Soulbound / guild-bound items cannot be sold. Use an Unbind Seal first.");
            return;
        }

        var listPrice = 0;
        var category = 0;
        var itemName = $"item {pending.ItemId}";
        ItemConfig? def = null;
        if (wr.ItemsById.TryGetValue(pending.ItemId, out def)) {
            listPrice = def.Price ?? 0;
            category = def.Category ?? 0;
            itemName = def.Name;
            // Fill Cur/Max from Items.json or Item.cfg so drops are not "broken" (Cur=0).
            pending.EnsureCatalogDurability(def);
        } else {
            pending.EnsureCatalogDurability(null);
        }

        // Item.cfg list price when Items.json omits price.
        // Negative cfg prices (Olympia specials / endgame) mean "no shop list" — use fallback floor.
        if (listPrice <= 0) {
            var cfgPrice = Server.Utils.ItemCfgStatsCatalog.GetListPrice(pending.ItemId);
            if (cfgPrice > 0) {
                listPrice = cfgPrice;
            } else if (cfgPrice < 0) {
                // e.g. Dark Knight / Xelima rows with -2400 price: still sellable via floor.
                listPrice = EstimateFallbackSellGold(pending.ItemId) * 4;
            }
        }

        // NPC shelf price wins over missing/wrong Items.json so buy→sell cannot mint gold.
        int? shopShelfUnit = null;
        if (TryGetNpcShelfPrice(pending.ItemId, out var shelfUnit, out var shelfIsConsumable)) {
            shopShelfUnit = shelfUnit;
            listPrice = shelfUnit;
            if (category <= 0) {
                category = shelfIsConsumable ? 11 : 1;
            }
        }

        // When Item.cfg price is missing and item is not on a gold shelf, synthesize from fallback × 2.
        if (listPrice <= 0) {
            listPrice = EstimateFallbackSellGold(pending.ItemId) * 2;
        }

        // Categories omitted from Items.json:
        // gear itemTypes / durable maxLife → 1–10 (durability sell); pots/misc → 11–50.
        if (category <= 0) {
            category = InferSellCategory(def, pending);
        }

        if (!OlympiaSellPrice.TryQuote(
                listPrice,
                category,
                pending.ItemAttribute,
                pending.CurLifeSpan,
                pending.MaxLifeSpan,
                pending.Quantity,
                out var goldGained,
                out var quoteError)) {
            SendSellResult(player, ok: false, quoteError);
            return;
        }

        // Hard cap: never pay more than half the shop shelf total for shop-sold stacks.
        if (shopShelfUnit is int buyUnit && buyUnit > 0) {
            var maxBuyBack = (int)Math.Min(int.MaxValue, (long)buyUnit * Math.Max(1, pending.Quantity) / 2);
            if (goldGained > maxBuyBack) {
                goldGained = maxBuyBack;
            }

            if (goldGained <= 0) {
                SendSellResult(player, ok: false, "That item has no sell value.");
                return;
            }
        }

        if (!player.InventoryManager.TryRemoveItemFromBagForGroundDrop(request.ItemUid, out var soldItem, out var removeResult)
            || soldItem is null) {
            SendSellResult(player, ok: false, "That item is not in your bag.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, removeResult);

        if (!player.InventoryManager.TryCreateItemStack(90, goldGained, out var goldResult)) {
            // Restore the sold item intact if gold could not be stacked.
            if (player.InventoryManager.TryInsertWarehouseItemIntoBag(soldItem, out var restore)) {
                Inventory.ApplyInventoryMutation(wr, player, restore);
            }
            SendSellResult(player, ok: false, "Could not add gold — bag may be full.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, goldResult);
        SendSellResult(
            player,
            ok: true,
            $"Sold {itemName} for {goldGained} gold.",
            goldGained,
            soldItem.ItemUid);
    }

    /// <summary>
    /// Repair durability at Tom (weapons/shields/armor cat 1–10) or Shop Keeper (rings / Emmy).
    /// Olympia half-list-price formula; proximity-checked.
    /// </summary>
    public static void HandleRepairItemRequest(GameWorldRef wr, GameWorldPlayer player, RepairItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!wr.NpcsByNpcId.TryGetValue(request.NpcId, out var npc)) {
            SendRepairResult(player, ok: false, "That merchant is not here.");
            return;
        }

        var isBlacksmith = npc.CatalogNpcId == BlacksmithCatalogNpcId;
        var isShopKeeper = npc.CatalogNpcId == ShopKeeperCatalogNpcId;
        if (!isBlacksmith && !isShopKeeper) {
            SendRepairResult(player, ok: false, "Talk to Tom (weapons/armor) or the Shop Keeper (rings).");
            return;
        }

        var vendorLabel = isBlacksmith ? "Tom" : "the shop";
        var dist = Math.Max(Math.Abs(player.PosX - npc.PosX), Math.Abs(player.PosY - npc.PosY));
        if (dist > MaxInteractDistance) {
            SendRepairResult(player, ok: false, $"Move closer to {vendorLabel}.");
            return;
        }

        bool quotedOk;
        int price;
        InventoryItemState? quoted;
        string error;
        if (isBlacksmith) {
            quotedOk = player.InventoryManager.TryQuoteBlacksmithRepair(
                request.ItemUid, out price, out quoted, out error);
        } else {
            quotedOk = player.InventoryManager.TryQuoteShopRingRepair(
                request.ItemUid, out price, out quoted, out error);
        }

        if (!quotedOk || quoted is null) {
            SendRepairResult(player, ok: false, error);
            return;
        }

        if (price > 0) {
            if (!player.InventoryManager.TrySpendGold(price, out var spendResult)) {
                SendRepairResult(player, ok: false, $"Need {price} gold.");
                return;
            }

            Inventory.ApplyInventoryMutation(wr, player, spendResult);
        }

        if (!player.InventoryManager.ApplyRepairToFull(request.ItemUid, out var repaired) || repaired is null) {
            // Refund if lifespan could not be restored after payment.
            if (price > 0 && player.InventoryManager.TryCreateItemStack(90, price, out var refund)) {
                Inventory.ApplyInventoryMutation(wr, player, refund);
            }
            SendRepairResult(player, ok: false, "Could not repair that item.");
            return;
        }

        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateItemLifeSpanUpdated(repaired.ItemUid, repaired.CurLifeSpan, repaired.MaxLifeSpan));
        var name = wr.ItemsById.TryGetValue(repaired.ItemId, out var itemDef) ? itemDef.Name : "item";
        SendRepairResult(
            player,
            ok: true,
            price > 0 ? $"Repaired {name} for {price} gold." : $"Repaired {name}.",
            repaired.ItemUid,
            repaired.CurLifeSpan,
            repaired.MaxLifeSpan,
            price);
    }

    static bool IsRequestForCurrentWorld(GameWorldRef wr, string requestWorldId) {
        return string.Equals(requestWorldId, wr.WorldId, StringComparison.Ordinal);
    }

    /// <summary>
    /// Gold shelf price if the item is sold by Shop Keeper or Tom (buy price per unit).
    /// </summary>
    public static bool TryGetNpcShelfPrice(int itemId, out int unitPrice, out bool isConsumableShelf) {
        if (ConsumablePrices.TryGetValue(itemId, out unitPrice)) {
            isConsumableShelf = true;
            return true;
        }

        if (BlacksmithWeaponPrices.TryGetValue(itemId, out unitPrice)) {
            isConsumableShelf = false;
            return true;
        }

        unitPrice = 0;
        isConsumableShelf = false;
        return false;
    }

    /// <summary>When Item.cfg price is missing, pay a small floor so high-id gear still sells.</summary>
    static int EstimateFallbackSellGold(int itemId) {
        if (itemId >= 600) {
            return 250;
        }
        if (itemId >= 200) {
            return 50;
        }
        return 10;
    }

    /// <summary>
    /// Olympia sell categories: 1–10 gear (durability-scaled), 11–50 consumables/misc (half list).
    /// </summary>
    static int InferSellCategory(ItemConfig? def, InventoryItemState item) {
        if (item.MaxLifeSpan > 1) {
            return 1;
        }
        if (def is null) {
            return 11;
        }
        if (def.Consumable == true || def.Stackable == true) {
            return 11;
        }
        return def.ItemType switch {
            "weapon" or "shield" or "armor" or "hauberk" or "leggings"
                or "boots" or "helmet" or "cape" or "necklace" or "ring" or "accessory"
                => 1,
            _ => 11,
        };
    }

    static void SendBuyResult(GameWorldPlayer player, bool ok, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateBuyShopItemResult(ok, message));
    }

    static void SendSellResult(
            GameWorldPlayer player,
            bool ok,
            string message,
            int? goldGained = null,
            long? itemUid = null) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSellBagItemResult(ok, message, goldGained, itemUid));
    }

    static void SendRepairResult(
            GameWorldPlayer player,
            bool ok,
            string message,
            long? itemUid = null,
            int? curLifeSpan = null,
            int? maxLifeSpan = null,
            int? pricePaid = null) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateRepairItemResult(ok, message, itemUid, curLifeSpan, maxLifeSpan, pricePaid));
    }
}
