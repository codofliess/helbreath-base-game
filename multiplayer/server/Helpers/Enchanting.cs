using System.Collections.Generic;
using System.Linq;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia shards / fragments enchanting (Server.cpp RequestItemDisenchant / Enchant / EnchantUpgrade).
/// No vortex / MP gems / 21-gem path — core magic only, secondary DR/MR/HP-regen capped at 91% (value 13 × 7).
/// </summary>
public static class Enchanting {
    // Primary (shards) — same ids as ItemMagicAttribute primary
    public const int ShardCritical = 1;
    public const int ShardPoisoning = 2;
    public const int ShardRighteous = 3;
    public const int ShardAgile = 5;
    public const int ShardLight = 6;
    public const int ShardAncient = 7;
    public const int ShardSharpEndurance = 8;
    public const int ShardCastProb = 9;
    public const int ShardManaConv = 10;

    // Secondary (fragments)
    public const int FragPoisonRes = 1;
    public const int FragHitProb = 2;
    public const int FragDefense = 3;
    public const int FragHpRegen = 4;
    public const int FragSpRegen = 5;
    public const int FragMpRegen = 6;
    public const int FragMagicRes = 7;
    public const int FragPhysAbs = 8;
    public const int FragMagicAbs = 9;
    public const int FragCad = 10;
    public const int FragExp = 11;
    public const int FragGold = 12;

    /// <summary>Max secondary nibble for DR / MR / HP regen so display stays at 91 (value×7).</summary>
    public const int CoreSecondaryMaxValue = 13; // 13 * 7 = 91

    /// <summary>General max for other magic nibbles (4-bit field).</summary>
    public const int MaxMagicValue = 15;

    public const int KindShard = 0;
    public const int KindFragment = 1;

    public const int UpgradeOneShard = 0;
    public const int UpgradeOneFragment = 1;
    public const int UpgradeAllShard = 2;
    public const int UpgradeAllFragment = 3;

    /// <summary>Disenchant bag/equipped magic item → shards + fragments; item destroyed.</summary>
    public static void HandleDisenchant(GameWorldRef wr, GameWorldPlayer player, long itemUid) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(wr);

        if (!TryFindBagOrEquipped(player, itemUid, out var item) || item is null) {
            SendEnchantResult(player, false, "Item not in bag or equipment.", 0, 0, 0, 0, 0);
            return;
        }

        var isSiphonItem = SiphonGems.TryGetSiphonShardType(item.ItemId, out var siphonType);
        if (item.ItemAttribute == 0 && !isSiphonItem) {
            SendEnchantResult(player, false, "Item has no magic attributes to disenchant.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
            return;
        }

        // Unique-bound items cannot be broken (Olympia TouchEffect owner check).
        if (item.BindState is 1 or 2) {
            SendEnchantResult(player, false, "Bound items cannot be disenchanted.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
            return;
        }

        ItemMagicAttribute.Decode(item.ItemAttribute, out var pType, out var pValue, out var sType, out var sValue, out _);

        if (pType > 0 && pValue > 0) {
            player.AddEnchantMaterial(isShard: true, pType, pValue, 1);
        }
        if (sType > 0 && sValue > 0) {
            player.AddEnchantMaterial(isShard: false, sType, sValue, 1);
        }

        // Mana/HP Siphon residue or gems → siphon shards (gem upgrade path).
        // Residues have no magic attr; still yield a Lv1+ siphon shard when broken.
        if (isSiphonItem) {
            var siphonLvl = item.SiphonLevel > 0
                ? item.SiphonLevel
                : Math.Max(1, pValue > 0 ? pValue : 1);
            player.AddEnchantMaterial(isShard: true, siphonType, siphonLvl, 1);
        }

        if (!TryDestroyItem(wr, player, item)) {
            SendEnchantResult(player, false, "Could not destroy item.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
            return;
        }

        Skills.GrantSkillXp(player, Skills.Alchemy, 1);
        SendMaterialsState(player);
        SendEnchantResult(player, true, "Disenchanted.", itemUid, 0, 0, 0, 0);
        Console.WriteLine($"[Enchanting] {player.CharacterName} disenchanted uid={itemUid} p={pType}/{pValue} s={sType}/{sValue}.");
    }

    /// <summary>
    /// Apply one matching shard (kind=0) or fragment (kind=1) to raise that stat by +1 on the item.
    /// </summary>
    public static void HandleEnchantItem(GameWorldRef wr, GameWorldPlayer player, long itemUid, int kind) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(wr);

        if (!TryFindBagOrEquipped(player, itemUid, out var item) || item is null) {
            SendEnchantResult(player, false, "Item not in bag or equipment.", 0, 0, 0, 0, 0);
            return;
        }

        ItemMagicAttribute.Decode(item.ItemAttribute, out var pType, out var pValue, out var sType, out var sValue, out var up);

        if (kind == KindShard) {
            if (pType <= 0 || pValue <= 0) {
                SendEnchantResult(player, false, "Item has no primary magic (shard) to raise.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            var max = MaxValueForPrimary(pType);
            if (pValue >= max) {
                SendEnchantResult(player, false, $"Primary already at cap ({max}).", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            if (!player.TrySpendEnchantMaterial(isShard: true, pType, pValue, 1)) {
                SendEnchantResult(player, false, $"Need 1× {ShardName(pType)} Lv.{pValue} shard.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            var next = pValue + 1;
            item.ItemAttribute = Encode(pType, next, sType, sValue, up);
        } else {
            if (sType <= 0 || sValue <= 0) {
                SendEnchantResult(player, false, "Item has no secondary magic (fragment) to raise.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            var max = MaxValueForSecondary(sType);
            if (sValue >= max) {
                SendEnchantResult(player, false, $"Secondary already at cap ({DisplayPercent(sType, max)}).", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            if (!player.TrySpendEnchantMaterial(isShard: false, sType, sValue, 1)) {
                SendEnchantResult(player, false, $"Need 1× {FragmentName(sType)} Lv.{sValue} fragment.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
                return;
            }
            var next = sValue + 1;
            item.ItemAttribute = Encode(pType, pValue, sType, next, up);
        }

        PlayerDerivedStats.Refresh(player, fillIncreasedPools: false);
        Skills.GrantSkillXp(player, Skills.Alchemy, 1);
        SendMaterialsState(player);
        SendEnchantResult(player, true, "Enchant success.", item.ItemUid, item.ItemId, item.ItemAttribute, 0, 0);
        Console.WriteLine($"[Enchanting] {player.CharacterName} enchant uid={item.ItemUid} kind={kind} attr=0x{item.ItemAttribute:X8}.");
    }

    /// <summary>Combine N materials of level L into 1 of L+1 (Olympia GetRequiredLevelForUpgrade).</summary>
    public static void HandleUpgradeMaterial(GameWorldPlayer player, int kind, int type, int level, int mode) {
        ArgumentNullException.ThrowIfNull(player);

        // Client sends display level (1-based). Materials stored by that value.
        if (type <= 0 || level < 1 || level >= MaxMagicValue) {
            SendEnchantResult(player, false, "Invalid material level.", 0, 0, 0, 0, 0);
            return;
        }

        var req = GetRequiredCountForUpgrade(level);
        var isShard = kind == KindShard || mode is UpgradeOneShard or UpgradeAllShard;
        if (mode is UpgradeOneFragment or UpgradeAllFragment) {
            isShard = false;
        }
        if (mode is UpgradeOneShard or UpgradeAllShard) {
            isShard = true;
        }

        var upgradeAll = mode is UpgradeAllShard or UpgradeAllFragment;
        var made = 0;
        while (true) {
            if (!player.TrySpendEnchantMaterial(isShard, type, level, req)) {
                break;
            }
            player.AddEnchantMaterial(isShard, type, level + 1, 1);
            made++;
            if (!upgradeAll) {
                break;
            }
        }

        if (made <= 0) {
            SendEnchantResult(player, false, $"Need {req}× Lv.{level} to craft Lv.{level + 1}.", 0, 0, 0, type, level);
            return;
        }

        SendMaterialsState(player);
        var label = isShard ? ShardName(type) : FragmentName(type);
        SendEnchantResult(player, true, $"Crafted {made}× {label} Lv.{level + 1}.", 0, 0, 0, type, level + 1);
    }

    public static void SendMaterialsState(GameWorldPlayer player) {
        var msg = new ServerMessage {
            EnchantMaterialsState = new EnchantMaterialsState(),
        };
        foreach (var row in player.SnapshotEnchantMaterials()) {
            msg.EnchantMaterialsState.Materials.Add(new EnchantMaterialEntry {
                IsShard = row.IsShard,
                Type = row.Type,
                Level = row.Level,
                Count = row.Count,
                Name = row.IsShard ? ShardName(row.Type) : FragmentName(row.Type),
            });
        }
        NetworkManager.SendToPlayer(player, msg);
    }

    public static int GetRequiredCountForUpgrade(int level) {
        // Olympia GetRequiredLevelForUpgrade(value): uses lvl index; we use display level 1..15
        if (level >= 1 && level <= 5) {
            return 4;
        }
        if (level > 5 && level <= 10) {
            return 3;
        }
        return 2;
    }

    public static int MaxValueForSecondary(int sType) =>
        sType is FragDefense or FragMagicRes or FragHpRegen
            ? CoreSecondaryMaxValue
            : MaxMagicValue;

    public static int MaxValueForPrimary(int pType) => MaxMagicValue;

    public static string DisplayPercent(int sType, int value) {
        // DR / MR / HP regen use value * 7 in ItemMagicAttribute
        if (sType is FragDefense or FragMagicRes or FragHpRegen or FragSpRegen or FragMpRegen or FragPoisonRes or FragHitProb) {
            return $"{value * 7}";
        }
        if (sType is FragPhysAbs or FragMagicAbs) {
            return $"{value * 3}";
        }
        return value.ToString();
    }

    public static uint Encode(int pType, int pValue, int sType, int sValue, int upgrade) {
        pType = Math.Clamp(pType, 0, 15);
        pValue = Math.Clamp(pValue, 0, 15);
        sType = Math.Clamp(sType, 0, 15);
        sValue = Math.Clamp(sValue, 0, 15);
        upgrade = Math.Clamp(upgrade, 0, 15);
        return ((uint)upgrade << 28)
            | ((uint)pType << 20)
            | ((uint)pValue << 16)
            | ((uint)sType << 12)
            | ((uint)sValue << 8);
    }

    public static string ShardName(int type) => type switch {
        ShardCritical => "Critical Hit Damage",
        4 => "Crit. Increase Chance",
        ShardPoisoning => "Poisoning",
        ShardRighteous => "Righteous",
        ShardAgile => "Agile",
        ShardLight => "Light",
        ShardAncient => "Ancient",
        ShardSharpEndurance => "Endurance / Sharp",
        ShardCastProb => "Magic Casting Probability",
        ShardManaConv => "Mana Converting", // armor/shield TransMana path only — not weapon gem bag
        SiphonGems.SiphonShardTypeMana => "Mana Vamping",
        SiphonGems.SiphonShardTypeHp => "HP Vamping",
        _ => $"Shard#{type}",
    };

    public static string FragmentName(int type) => type switch {
        FragPoisonRes => "Poison Resistance",
        FragHitProb => "Hitting Probability",
        FragDefense => "Defense Ratio",
        FragHpRegen => "HP Recovery",
        FragSpRegen => "SP Recovery",
        FragMpRegen => "MP Recovery",
        FragMagicRes => "Magic Resistance",
        FragPhysAbs => "Physical Absorption",
        FragMagicAbs => "Magic Absorption",
        FragCad => "Consecutive Attack Damage",
        FragExp => "Experience",
        FragGold => "Gold",
        _ => $"Fragment#{type}",
    };

    static void SendEnchantResult(
        GameWorldPlayer player,
        bool success,
        string message,
        long itemUid,
        int itemId,
        uint itemAttribute,
        int materialType,
        int materialLevel) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            EnchantResult = new EnchantResult {
                Success = success,
                Message = message ?? "",
                ItemUid = itemUid,
                ItemId = itemId,
                ItemAttribute = itemAttribute,
                MaterialType = materialType,
                MaterialLevel = materialLevel,
            },
        });
    }

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

    static bool TryDestroyItem(GameWorldRef wr, GameWorldPlayer player, InventoryItemState item) {
        if (player.InventoryManager.TryRemoveItemFromBagForGroundDrop(item.ItemUid, out _, out var removeResult)) {
            Inventory.ApplyInventoryMutation(wr, player, removeResult);
            return true;
        }
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
}
