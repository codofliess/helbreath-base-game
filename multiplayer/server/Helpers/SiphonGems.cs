using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Special jewelry gems for the 4th accessory slot (<c>gem</c>):
/// Mana Vamping (INT ≥ 113) and HP Vamping (STR ≥ 130).
/// Upgraded by disenchanting vamping residues into vamping shards, then spending them on the gem.
/// Not related to vortex / MP gems / 21-gem path / Mana Converting armor affix.
/// </summary>
public static class SiphonGems {
    public const int ManaSiphonGemItemId = 1200;
    public const int HpSiphonGemItemId = 1201;
    /// <summary>Breakable residue items that yield siphon shards on disenchant.</summary>
    public const int ManaSiphonResidueItemId = 1202;
    public const int HpSiphonResidueItemId = 1203;

    public const int SiphonShardTypeMana = 20;
    public const int SiphonShardTypeHp = 21;

    public const int MinIntForManaGem = 113; // user: + de 112
    public const int MinStrForHpGem = 130;
    public const int MaxSiphonLevel = 15;

    public static bool IsSiphonGem(int itemId) =>
        itemId is ManaSiphonGemItemId or HpSiphonGemItemId;

    public static bool IsSiphonResidue(int itemId) =>
        itemId is ManaSiphonResidueItemId or HpSiphonResidueItemId;

    public static bool TryGetSiphonShardType(int itemId, out int shardType) {
        if (itemId is ManaSiphonGemItemId or ManaSiphonResidueItemId) {
            shardType = SiphonShardTypeMana;
            return true;
        }
        if (itemId is HpSiphonGemItemId or HpSiphonResidueItemId) {
            shardType = SiphonShardTypeHp;
            return true;
        }
        shardType = 0;
        return false;
    }

    /// <summary>Equip gate: gem slot + stat requirements.</summary>
    public static bool CanEquipGem(GameWorldPlayer player, int itemId, out string error) {
        error = "";
        if (itemId == ManaSiphonGemItemId) {
            if (player.Int < MinIntForManaGem) {
                error = $"Mana Vamping requires INT {MinIntForManaGem}+ (have {player.Int}).";
                return false;
            }
            return true;
        }
        if (itemId == HpSiphonGemItemId) {
            if (player.Str < MinStrForHpGem) {
                error = $"HP Vamping requires STR {MinStrForHpGem}+ (have {player.Str}).";
                return false;
            }
            return true;
        }
        error = "Not a vamping gem.";
        return false;
    }

    public static void HandleGemUpgrade(GameWorldPlayer player, long itemUid) {
        ArgumentNullException.ThrowIfNull(player);

        InventoryItemState? gem = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == itemUid) {
                gem = bag;
                break;
            }
        }
        if (gem is null) {
            foreach (var eq in player.InventoryManager.EquippedItems.Values) {
                if (eq.ItemUid == itemUid) {
                    gem = eq;
                    break;
                }
            }
        }
        if (gem is null || !IsSiphonGem(gem.ItemId)) {
            SendUpgrade(player, false, "Equip or bag a Mana/HP Vamping gem.", 0, 0, 0);
            return;
        }

        if (gem.SiphonLevel >= MaxSiphonLevel) {
            SendUpgrade(player, false, "Gem already at max vamping level.", gem.ItemUid, gem.ItemId, gem.SiphonLevel);
            return;
        }

        if (!TryGetSiphonShardType(gem.ItemId, out var shardType)) {
            SendUpgrade(player, false, "Unknown vamping gem.", gem.ItemUid, gem.ItemId, gem.SiphonLevel);
            return;
        }

        // Need 1 shard of current level (same as enchant +1 on specs).
        var needLevel = Math.Max(1, gem.SiphonLevel);
        if (gem.SiphonLevel == 0) {
            needLevel = 1; // first upgrade costs Lv1 shard
        }
        if (!player.TrySpendEnchantMaterial(isShard: true, shardType, needLevel, 1)) {
            var name = shardType == SiphonShardTypeMana ? "Mana Vamping" : "HP Vamping";
            SendUpgrade(player, false, $"Need 1× {name} shard Lv.{needLevel} (disenchant vamping residues).", gem.ItemUid, gem.ItemId, gem.SiphonLevel);
            return;
        }

        gem.SiphonLevel = Math.Min(MaxSiphonLevel, gem.SiphonLevel + 1);
        Enchanting.SendMaterialsState(player);
        // Resync bag or equipped gem so client shows new vamping level.
        var inBag = false;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == gem.ItemUid) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateItemAddedToBag(bag.Clone()));
                inBag = true;
                break;
            }
        }
        if (!inBag && player.InventoryManager.EquippedItems.TryGetValue("gem", out var eqGem) &&
            eqGem is not null && eqGem.ItemUid == gem.ItemUid) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateItemEquipped(player.PlayerId, "gem", eqGem));
        }
        SendUpgrade(player, true, $"Vamping level → {gem.SiphonLevel}.", gem.ItemUid, gem.ItemId, gem.SiphonLevel);
        Console.WriteLine($"[Vamping] {player.CharacterName} gem {gem.ItemId} → L{gem.SiphonLevel}.");
    }

    /// <summary>
    /// On successful melee hit: heal / restore mana from equipped vamping gem.
    /// </summary>
    public static void ApplyOnHit(GameWorldPlayer attacker, int damageDealt) {
        if (damageDealt <= 0 || attacker.IsDead) {
            return;
        }
        if (!attacker.InventoryManager.EquippedItems.TryGetValue("gem", out var gem) || gem is null) {
            return;
        }
        if (gem.SiphonLevel <= 0 && gem.ItemId is ManaSiphonGemItemId or HpSiphonGemItemId) {
            // Level 0 still gives tiny siphon (1%)
        }
        var level = Math.Max(1, gem.SiphonLevel);
        // ~2% of damage per level, min 1.
        var siphon = Math.Max(1, damageDealt * level / 50);

        if (gem.ItemId == ManaSiphonGemItemId && attacker.Int >= MinIntForManaGem) {
            attacker.ApplyMpRestore(siphon);
        } else if (gem.ItemId == HpSiphonGemItemId && attacker.Str >= MinStrForHpGem) {
            attacker.ApplyHeal(siphon);
        }
    }

    static void SendUpgrade(GameWorldPlayer player, bool ok, string msg, long uid, int itemId, int level) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            SiphonGemUpgradeResult = new SiphonGemUpgradeResult {
                Success = ok,
                Message = msg ?? "",
                ItemUid = uid,
                ItemId = itemId,
                SiphonLevel = level,
            },
        });
    }
}
