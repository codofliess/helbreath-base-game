using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// CIC merge: 2 same-tier, same-stat-kind armor pieces → next CIC.
/// Capes/armor: same stat kind (HP/SP/MP) required; result HP/SP/MP = min of donors.
/// Shields: also require identical base item id (e.g. 2× Tower Shield).
/// CIC3→4→5→6→7 only. No vortex/gem purity path.
/// </summary>
public static class CicItemCraft {
    public const int MinCic = 3;
    public const int MaxCic = 7;

    public const int StatNone = 0;
    public const int StatHp = 1;
    public const int StatSp = 2;
    public const int StatMp = 3;

    public static void HandleMerge(GameWorldRef wr, GameWorldPlayer player, CicItemMergeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(wr);

        if (request.ItemUidA == 0 || request.ItemUidB == 0 || request.ItemUidA == request.ItemUidB) {
            Send(player, false, "Select two different bag items.", 0, 0, 0, 0, 0);
            return;
        }

        if (!TryFindBag(player, request.ItemUidA, out var a) || a is null ||
            !TryFindBag(player, request.ItemUidB, out var b) || b is null) {
            Send(player, false, "Both items must be in the bag.", 0, 0, 0, 0, 0);
            return;
        }

        if (!wr.ItemsById.TryGetValue(a.ItemId, out var defA) ||
            !wr.ItemsById.TryGetValue(b.ItemId, out var defB)) {
            Send(player, false, "Unknown item.", 0, 0, 0, 0, 0);
            return;
        }

        if (!IsCicEligibleType(defA.ItemType) || !IsCicEligibleType(defB.ItemType)) {
            Send(player, false, "Only capes, shields, and body armor can use CIC merge.", 0, 0, 0, 0, 0);
            return;
        }

        if (!string.Equals(defA.ItemType, defB.ItemType, StringComparison.OrdinalIgnoreCase)) {
            Send(player, false, "Both items must be the same gear type (cape/shield/armor…).", 0, 0, 0, 0, 0);
            return;
        }

        // Shields: same catalog id (Tower + Tower, not Tower + Iron).
        if (string.Equals(defA.ItemType, "shield", StringComparison.OrdinalIgnoreCase) &&
            a.ItemId != b.ItemId) {
            Send(player, false, "Shields must be the same model (e.g. two Tower Shields).", 0, 0, 0, 0, 0);
            return;
        }

        var cicA = a.CicLevel;
        var cicB = b.CicLevel;
        if (cicA < MinCic || cicA > MaxCic - 1 || cicB < MinCic || cicB > MaxCic - 1) {
            Send(player, false, $"CIC merge needs two pieces CIC{MinCic}–CIC{MaxCic - 1} (not yet CIC{MaxCic}).", 0, 0, 0, 0, 0);
            return;
        }
        if (cicA != cicB) {
            Send(player, false, $"Both pieces must be the same CIC (got CIC{cicA} and CIC{cicB}).", 0, 0, 0, 0, 0);
            return;
        }

        if (a.CicStatKind <= 0 || a.CicStatKind != b.CicStatKind) {
            Send(player, false, "Both pieces must share the same CIC stat kind (both HP, or both SP, or both MP).", 0, 0, 0, 0, 0);
            return;
        }

        if (a.CicStatValue <= 0 || b.CicStatValue <= 0) {
            Send(player, false, "Both pieces need a CIC stat value (e.g. HP35).", 0, 0, 0, 0, 0);
            return;
        }

        var resultValue = Math.Min(a.CicStatValue, b.CicStatValue);
        var nextCic = cicA + 1;
        var keepUid = a.ItemUid; // keep first, destroy second; rewrite stats on keep
        var dropUid = b.ItemUid;

        // Destroy donor B.
        if (!player.InventoryManager.TryRemoveItemFromBagForGroundDrop(dropUid, out _, out var removeB)) {
            Send(player, false, "Could not consume second item.", 0, 0, 0, 0, 0);
            return;
        }
        Inventory.ApplyInventoryMutation(wr, player, removeB);

        // Upgrade donor A in place (keep uid; rewrite CIC fields).
        a.CicLevel = nextCic;
        a.CicStatValue = resultValue;
        // Kind unchanged.
        // Push bag resync so client sees new CIC tier / min stat value.
        NetworkManager.SendToPlayer(player, NetworkManager.CreateItemAddedToBag(a.Clone()));
        PlayerDerivedStats.Refresh(player, fillIncreasedPools: false);
        Progression.SendProgressionUpdated(player, leveledUp: false);

        Send(player, true,
            $"CIC{cicA} → CIC{nextCic} {StatName(a.CicStatKind)}{resultValue}.",
            a.ItemUid, a.ItemId, a.CicLevel, a.CicStatKind, a.CicStatValue);
        Console.WriteLine(
            $"[CIC] {player.CharacterName} merged {defA.Name} CIC{cicA}→{nextCic} {StatName(a.CicStatKind)}{resultValue}.");
    }

    public static bool IsCicEligibleType(string itemType) =>
        itemType is "cape" or "shield" or "armor" or "hauberk" or "leggings" or "boots" or "helmet";

    public static string StatName(int kind) => kind switch {
        StatHp => "HP",
        StatSp => "SP",
        StatMp => "MP",
        _ => "?",
    };

    static bool TryFindBag(GameWorldPlayer player, long uid, out InventoryItemState? item) {
        item = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid == uid) {
                item = bag;
                return true;
            }
        }
        return false;
    }

    static void Send(
        GameWorldPlayer player,
        bool success,
        string message,
        long itemUid,
        int itemId,
        int cicLevel,
        int cicStatKind,
        int cicStatValue) {
        NetworkManager.SendToPlayer(player, new ServerMessage {
            CicItemMergeResult = new CicItemMergeResult {
                Success = success,
                Message = message ?? "",
                ItemUid = itemUid,
                ItemId = itemId,
                CicLevel = cicLevel,
                CicStatKind = cicStatKind,
                CicStatValue = cicStatValue,
            },
        });
    }
}
