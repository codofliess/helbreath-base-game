using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia <c>RequestItemUpgradeHandler</c> for majestic (gizon) upgrades:
/// Angelic pendants (category 46) and Dark Knight weapons, up to +15.
/// DK form transform: Sang Ah Flameberge (703) → Dark Knight Flameberge (709) on first upgrade.
/// </summary>
public static class MajesticUpgrade {
    /// <summary>Upgrade nibble lives in the high 4 bits of Olympia <c>m_dwAttribute</c>.</summary>
    public const int MaxUpgradeLevel = 15;

    private static readonly int[] AngelItemIds = [1108, 1109, 1110, 1111];

    /// <summary>DK weapons eligible for gizon upgrades (Olympia case 1 / 703 family).</summary>
    private static readonly HashSet<int> DkWeaponIds = new() {
        703, // Sang Ah Flameberge (base form)
        709, // Dark Knight Flameberge
        717, // Dark Knight Rapier
        718, // Dark Knight Great Sword
        727, // Dark Knight Flameberg W
        736, // DK variants if present
        737,
        745,
    };

    /// <summary>Olympia angel upgrade cost table (majestic points) for +0→+1 … +9→+10; extended to +15.</summary>
    private static readonly int[] AngelCosts = [
        10, 11, 13, 16, 20, 25, 31, 38, 46, 55, // 0..9
        65, 76, 88, 101, 115, // 10..14 → +15
    ];

    public static void HandleMajesticUpgradeRequest(GameWorldRef wr, GameWorldPlayer player, MajesticUpgradeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        _ = wr;

        if (request.ItemUid == 0) {
            SendResult(player, false, "Invalid item.", player.MajesticPoints, 0, 0, 0, false);
            return;
        }

        InventoryItemState? item = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == request.ItemUid) {
                item = bag;
                break;
            }
        }
        if (item is null) {
            foreach (var eq in player.InventoryManager.EquippedItems.Values) {
                if (eq.ItemUid == request.ItemUid) {
                    item = eq;
                    break;
                }
            }
        }
        if (item is null) {
            SendResult(player, false, "Item not in bag or equipment.", player.MajesticPoints, request.ItemUid, 0, 0, false);
            return;
        }

        var upgradeLevel = GetUpgradeLevel(item.ItemAttribute);
        if (upgradeLevel >= MaxUpgradeLevel) {
            SendResult(player, false, "Already at maximum upgrade (+15).", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        var isAngel = AngelItemIds.Contains(item.ItemId);
        var isDk = DkWeaponIds.Contains(item.ItemId);
        if (!isAngel && !isDk) {
            SendResult(player, false, "Only Angelic pendants and Dark Knight weapons can use majestics.", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        if (isAngel) {
            TryUpgradeAngel(player, item, upgradeLevel);
            return;
        }

        TryUpgradeDkWeapon(player, item, upgradeLevel);
    }

    private static void TryUpgradeAngel(GameWorldPlayer player, InventoryItemState item, int upgradeLevel) {
        // User requested +15 for angels (Olympia capped at +10).
        if (upgradeLevel >= MaxUpgradeLevel) {
            SendResult(player, false, "Angel already at +15.", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        var cost = AngelCosts[Math.Min(upgradeLevel, AngelCosts.Length - 1)];
        if (player.MajesticPoints < cost) {
            SendResult(player, false, $"Need {cost} majestic points (have {player.MajesticPoints}).", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        // Olympia: 70% success; fail burns 1 majestic.
        var roll = Random.Shared.Next(1, 101);
        if (roll > 70) {
            player.TrySpendMajesticPoints(1);
            Progression.SendProgressionUpdated(player, leveledUp: false);
            SendResult(player, false, "Upgrade failed (70% chance). Lost 1 majestic.", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        if (!player.TrySpendMajesticPoints(cost)) {
            SendResult(player, false, "Not enough majestic points.", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        var next = upgradeLevel + 1;
        if (next > MaxUpgradeLevel) {
            next = MaxUpgradeLevel;
        }
        item.ItemAttribute = SetUpgradeLevel(item.ItemAttribute, next);
        // Equipped angel may raise STR/DEX/INT/MAG → vitals + damage.
        PlayerDerivedStats.Refresh(player, fillIncreasedPools: true);
        Progression.SendProgressionUpdated(player, leveledUp: false);
        SendResult(player, true, null, player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
        // Confirm effective angel bonus (F5 now shows base+angel; cast uses EffectiveInt).
        PlayerDerivedStats.GetAngelicBonuses(player, out var aStr, out var aDex, out var aInt, out var aMag);
        if (aStr + aDex + aInt + aMag > 0) {
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateSendMessage(
                    $"Angel active: STR+{aStr} DEX+{aDex} INT+{aInt} MAG+{aMag} " +
                    $"(eff Int {PlayerDerivedStats.EffectiveInt(player)}, Mag {PlayerDerivedStats.EffectiveMag(player)})."));
        }
        Console.WriteLine($"[Majestic] {player.CharacterName} angel {item.ItemId} → +{next} (cost {cost}).");
    }

    private static void TryUpgradeDkWeapon(GameWorldPlayer player, InventoryItemState item, int upgradeLevel) {
        // Olympia: sItemUpgrade = iValue*(iValue+6)/8 + 2
        var cost = upgradeLevel * (upgradeLevel + 6) / 8 + 2;
        if (player.MajesticPoints < cost) {
            SendResult(player, false, $"Need {cost} majestic points (have {player.MajesticPoints}).", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }
        if (!player.TrySpendMajesticPoints(cost)) {
            SendResult(player, false, "Not enough majestic points.", player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, false);
            return;
        }

        var transformed = false;
        // Olympia: first upgrade on id 703 replaces with 709 (Dark Knight Flameberge) and binds owner.
        if (upgradeLevel == 0 && item.ItemId == 703) {
            item.TransformItemId(709);
            transformed = true;
        }

        var next = upgradeLevel + 1;
        if (next > MaxUpgradeLevel) {
            next = MaxUpgradeLevel;
        }
        item.ItemAttribute = SetUpgradeLevel(item.ItemAttribute, next);
        PlayerDerivedStats.Refresh(player, fillIncreasedPools: false);
        Progression.SendProgressionUpdated(player, leveledUp: false);
        SendResult(player, true, null, player.MajesticPoints, item.ItemUid, item.ItemId, item.ItemAttribute, transformed);
        Console.WriteLine(
            $"[Majestic] {player.CharacterName} DK {item.ItemId} → +{next} (cost {cost}){(transformed ? " [form→709]" : "")}.");
    }

    public static int GetUpgradeLevel(uint itemAttribute) =>
        (int)((itemAttribute & 0xF0000000u) >> 28);

    public static uint SetUpgradeLevel(uint itemAttribute, int level) {
        var clamped = Math.Clamp(level, 0, MaxUpgradeLevel);
        return (itemAttribute & 0x0FFFFFFFu) | ((uint)clamped << 28);
    }

    private static void SendResult(
        GameWorldPlayer player,
        bool success,
        string? error,
        int majesticPoints,
        long itemUid,
        int itemId,
        uint itemAttribute,
        bool itemTransformed) {
        var msg = new ServerMessage {
            MajesticUpgradeResult = new MajesticUpgradeResult {
                Success = success,
                MajesticPoints = majesticPoints,
                ItemUid = itemUid,
                ItemId = itemId,
                ItemAttribute = itemAttribute,
                ItemTransformed = itemTransformed,
            },
        };
        if (error is not null) {
            msg.MajesticUpgradeResult.Error = error;
        }
        NetworkManager.SendToPlayer(player, msg);
    }
}
