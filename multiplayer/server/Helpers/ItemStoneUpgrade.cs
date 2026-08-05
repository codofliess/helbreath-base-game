using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Chain Lords stone upgrades (Olympia Xelima/Merien + CL fail rules).
/// Weapons: Stone of Xelima (656). Armor/shields: Stone of Merien (657).
/// Cap +10 (Olympia: normal weapons +7 / custom +10 — we allow +10 for all upgradeable gear).
/// Fail without Integrity: &lt;+3 safe; ≥+3 can -1; ≥+7 can burn.
/// Stone of Integrity (1112): optional from +3 up — on fail, no burn and no retrocession (level stays).
/// </summary>
public static class ItemStoneUpgrade {
    public const int StoneOfXelimaId = 656;
    public const int StoneOfMerienId = 657;
    public const int StoneOfIntegrityId = 1112;

    public const int MaxUpgradeLevel = 10;
    /// <summary>Minimum +N where Integrity may be offered/used (no retrocession; also blocks burn at +7+).</summary>
    public const int IntegrityMinPlusLevel = 3;

    /// <summary>Hitting Probability primary — Olympia non-upgradeable on weapons.</summary>
    public const int PrimaryHittingProb = 9;
    /// <summary>Endurance primary — Olympia non-upgradeable on shields/armor with Merien.</summary>
    public const int PrimaryEndurance = 8;

    public static void HandleRequest(GameWorldRef wr, GameWorldPlayer player, StoneItemUpgradeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(wr);

        if (request.ItemUid == 0) {
            SendResult(player, false, "Invalid item.", 0, 0, 0, burned: false, downgraded: false);
            return;
        }

        if (!TryFindBagOrEquipped(player, request.ItemUid, out var item) || item is null) {
            SendResult(player, false, "Item not in bag or equipment.", request.ItemUid, 0, 0, false, false);
            return;
        }

        if (!wr.ItemsById.TryGetValue(item.ItemId, out var def)) {
            SendResult(player, false, "Unknown item.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }

        var isWeapon = string.Equals(def.ItemType, "weapon", StringComparison.OrdinalIgnoreCase);
        var isShield = string.Equals(def.ItemType, "shield", StringComparison.OrdinalIgnoreCase);
        var isArmor = IsBodyArmorType(def.ItemType);

        if (!isWeapon && !isShield && !isArmor) {
            SendResult(player, false, "Only weapons, shields, and armor can be stone-upgraded.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }

        // MS22 charge wands (CurLifeSpan = spell charges) — Xelima would burn/destroy them.
        if (isWeapon && ChargeWand.SpellIdForItem(item.ItemId) is not null) {
            SendResult(
                player,
                false,
                "MS22 charge wands cannot be stone-upgraded (charges are not durability).",
                item.ItemUid,
                item.ItemId,
                item.ItemAttribute,
                false,
                false);
            return;
        }

        var primary = GetPrimaryMagicType(item.ItemAttribute);
        if (isWeapon && primary == PrimaryHittingProb) {
            SendResult(player, false, "Hitting Probability weapons cannot be upgraded.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }
        if ((isShield || isArmor) && primary == PrimaryEndurance) {
            SendResult(player, false, "Endurance gear cannot be Merien-upgraded.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }

        // Weapons → Xelima; armor/shield → Merien.
        var stoneId = isWeapon ? StoneOfXelimaId : StoneOfMerienId;
        var stoneName = isWeapon ? "Stone of Xelima" : "Stone of Merien";
        if (!TryFindBagItemByCatalogId(player, stoneId, out var stone) || stone is null) {
            SendResult(player, false, $"Need a {stoneName} in your bag.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }

        var current = MajesticUpgrade.GetUpgradeLevel(item.ItemAttribute);
        // Olympia only blocks Hitting Prob (weapons) / Endurance (armor) — NOT Ancient primary.
        // A hard Ancient +3 cap was incorrectly blocking wands/weapons with Ancient magic from +4+.
        var max = MaxUpgradeLevel;

        if (current >= max) {
            SendResult(
                player,
                false,
                $"Already at maximum upgrade (+{max}).",
                item.ItemUid,
                item.ItemId,
                item.ItemAttribute,
                false,
                false);
            return;
        }

        var useIntegrity = request.UseIntegrityStone;
        InventoryItemState? integrity = null;
        if (useIntegrity) {
            if (current < IntegrityMinPlusLevel) {
                SendResult(
                    player,
                    false,
                    $"Stone of Integrity is for +{IntegrityMinPlusLevel} and above.",
                    item.ItemUid,
                    item.ItemId,
                    item.ItemAttribute,
                    false,
                    false);
                return;
            }
            if (!TryFindBagItemByCatalogId(player, StoneOfIntegrityId, out integrity) || integrity is null) {
                SendResult(player, false, "No Stone of Integrity in bag.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
                return;
            }
        }

        // Consume the upgrade stone first (always spent).
        // Stones are misc but not catalog-consumable potions — use RemoveOne, not TryConsumeItem.
        if (!player.InventoryManager.TryRemoveOneBagItem(stone.ItemUid, out var stoneMutation)) {
            SendResult(player, false, $"Could not consume {stoneName}.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, stoneMutation);

        var success = RollUpgradeSuccess(current, merienBonus: !isWeapon);
        if (success) {
            var next = current + 1;
            item.ItemAttribute = MajesticUpgrade.SetUpgradeLevel(item.ItemAttribute, next);
            if (!isWeapon) {
                ApplyMerienEnduranceBoost(item, def);
            }
            PlayerDerivedStats.Refresh(player, fillIncreasedPools: false);
            SendResult(player, true, $"+{next} success.", item.ItemUid, item.ItemId, item.ItemAttribute, false, false);
            Console.WriteLine($"[StoneUpgrade] {player.CharacterName} {def.Name} → +{next} ({stoneName}).");
            return;
        }

        // —— Fail path ——
        // Integrity (from +5): spend stone, keep +N exactly — no burn, no retrocession.
        if (useIntegrity && integrity is not null && current >= IntegrityMinPlusLevel) {
            if (player.InventoryManager.TryRemoveOneBagItem(integrity.ItemUid, out var intMut)) {
                Inventory.ApplyInventoryMutation(wr, player, intMut);
            }
            SendResult(
                player,
                false,
                $"Upgrade failed. Integrity kept the item at +{current} (no burn, no drop).",
                item.ItemUid,
                item.ItemId,
                item.ItemAttribute,
                false,
                false);
            Console.WriteLine($"[StoneUpgrade] {player.CharacterName} FAIL Integrity-hold {def.Name} +{current}.");
            return;
        }

        // Burn zone (+7 attempting higher) without Integrity.
        if (current >= 7) {
            var burned = TryDestroyItem(wr, player, item);
            SendResult(
                player,
                false,
                burned
                    ? "Upgrade failed. The item was destroyed (use Stone of Integrity from +5 to protect)."
                    : "Upgrade failed (could not destroy item).",
                item.ItemUid,
                item.ItemId,
                item.ItemAttribute,
                burned,
                false);
            Console.WriteLine($"[StoneUpgrade] {player.CharacterName} BURN {def.Name} at +{current}.");
            return;
        }

        // Fail below burn zone: retrocession at +3+.
        if (current >= 3 && current > 0) {
            item.ItemAttribute = MajesticUpgrade.SetUpgradeLevel(item.ItemAttribute, current - 1);
            SendResult(
                player,
                false,
                $"Upgrade failed. Item dropped to +{current - 1}.",
                item.ItemUid,
                item.ItemId,
                item.ItemAttribute,
                false,
                true);
            Console.WriteLine($"[StoneUpgrade] {player.CharacterName} FAIL downgrade {def.Name} +{current}→+{current - 1}.");
            return;
        }

        // current 0..2: stone lost, item unchanged.
        SendResult(
            player,
            false,
            "Upgrade failed. Item safe (no downgrade below +3).",
            item.ItemUid,
            item.ItemId,
            item.ItemAttribute,
            false,
            false);
        Console.WriteLine($"[StoneUpgrade] {player.CharacterName} FAIL safe {def.Name} +{current}.");
    }

    /// <summary>
    /// Success chance for upgrading FROM <paramref name="currentUpgradeLevel"/> (to level+1).
    /// Olympia base: 30/25/20/15/10/10/8/8/5/3 (Xelima), Merien ×2, then ×100 vs 1..10000.
    /// Chain Lords intermediate: same ratios, scaled so +0→+1 starts at 50% (not 30% / not candy).
    /// Factor 50/30; Merien still doubles (Olympia).
    /// </summary>
    public static bool RollUpgradeSuccess(int currentUpgradeLevel, bool merienBonus) {
        // Olympia × (50/30), rounded: 50, 42, 33, 25, 17, 17, 13, 13, 8, 5
        var iProb = currentUpgradeLevel switch {
            0 => 50, // Olympia 30
            1 => 42, // Olympia 25
            2 => 33, // Olympia 20
            3 => 25, // Olympia 15
            4 => 17, // Olympia 10
            5 => 17, // Olympia 10
            6 => 13, // Olympia 8
            7 => 13, // Olympia 8
            8 => 8,  // Olympia 5
            9 => 5,  // Olympia 3
            _ => 2,
        };
        if (merienBonus) {
            iProb *= 2;
        }
        if (iProb > 100) {
            iProb = 100;
        }
        iProb *= 100; // scale to 1..10000 (Olympia)
        var roll = Random.Shared.Next(1, 10001);
        return iProb >= roll;
    }

    static void ApplyMerienEnduranceBoost(InventoryItemState item, ItemConfig def) {
        // Olympia: +15% max life on success (custom +20% — we use +15% for all).
        item.EnsureCatalogDurability(def);
        if (item.MaxLifeSpan <= 1) {
            return;
        }
        var boosted = (int)Math.Round(item.MaxLifeSpan * 1.15);
        if (boosted < item.MaxLifeSpan) {
            boosted = item.MaxLifeSpan;
        }
        item.MaxLifeSpan = boosted;
        if (item.CurLifeSpan > item.MaxLifeSpan) {
            item.CurLifeSpan = item.MaxLifeSpan;
        }
    }

    static bool TryDestroyItem(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item) {
        // Bag first.
        if (player.InventoryManager.TryRemoveItemFromBagForGroundDrop(item.ItemUid, out _, out var removeResult)) {
            Inventory.ApplyInventoryMutation(wr, player, removeResult);
            return true;
        }
        // Equipped: unequip to bag then remove.
        string? equipSlot = null;
        foreach (var (slot, eq) in player.InventoryManager.EquippedItems) {
            if (eq.ItemUid == item.ItemUid) {
                equipSlot = slot;
                break;
            }
        }
        if (equipSlot is null) {
            return false;
        }
        if (!player.InventoryManager.TryUnequipItem(equipSlot, item.ItemUid, bagX: null, bagY: null, out var unequipResult)) {
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, unequipResult);
        if (!player.InventoryManager.TryRemoveItemFromBagForGroundDrop(item.ItemUid, out _, out var dropResult)) {
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, dropResult);
        return true;
    }

    static bool IsBodyArmorType(string itemType) =>
        itemType is "armor" or "hauberk" or "leggings" or "boots" or "helmet" or "cape";

    static int GetPrimaryMagicType(uint attr) => (int)((attr & 0x00F00000u) >> 20);

    static bool TryFindBagOrEquipped(GameWorldPlayer player, long itemUid, out InventoryItemState? item) {
        item = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == itemUid) {
                item = bag;
                return true;
            }
        }
        foreach (var eq in player.InventoryManager.EquippedItems.Values) {
            if (eq.ItemUid == itemUid) {
                item = eq;
                return true;
            }
        }
        return false;
    }

    static bool TryFindBagItemByCatalogId(GameWorldPlayer player, int catalogId, out InventoryItemState? item) {
        item = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemId == catalogId) {
                item = bag;
                return true;
            }
        }
        return false;
    }

    static void SendResult(
            GameWorldPlayer player,
            bool success,
            string message,
            long itemUid,
            int itemId,
            uint itemAttribute,
            bool burned,
            bool downgraded) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            StoneItemUpgradeResult = new StoneItemUpgradeResult {
                Success = success,
                Message = message ?? string.Empty,
                ItemUid = itemUid,
                ItemId = itemId,
                ItemAttribute = itemAttribute,
                Burned = burned,
                Downgraded = downgraded,
            },
        });
    }
}
