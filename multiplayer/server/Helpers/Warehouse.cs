using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// William warehouse (classic bank): proximity-checked open / deposit / withdraw with persisted stacks.
/// </summary>
public static class Warehouse {
    /// <summary>Olympia William catalog id (<c>NPCs.json</c> / <c>arewrus</c> / <c>elvwrus</c>).</summary>
    public const int WilliamCatalogNpcId = 4;

    /// <summary>Chebyshev distance (cells) allowed between player and William.</summary>
    public const int MaxInteractDistance = 2;

    /// <summary>Classic bank capacity (~120 item stacks).</summary>
    public const int MaxSlots = 120;

    /// <summary>Sends the current warehouse snapshot when the player is near William.</summary>
    public static void HandleOpenWarehouseRequest(GameWorldRef wr, GameWorldPlayer player, OpenWarehouseRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!TryValidateWilliam(wr, player, request.NpcId, out var error)) {
            SendMutationResult(player, ok: false, error);
            return;
        }

        SendState(player, "Warehouse open.");
    }

    /// <summary>Moves one full bag stack into warehouse storage.</summary>
    public static void HandleWarehouseDepositRequest(GameWorldRef wr, GameWorldPlayer player, WarehouseDepositRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!TryValidateWilliam(wr, player, request.NpcId, out var error)) {
            SendMutationResult(player, ok: false, error);
            return;
        }

        if (player.WarehouseItems.Count >= MaxSlots) {
            SendMutationResult(player, ok: false, "Warehouse is full.");
            return;
        }

        if (!player.InventoryManager.TryExtractBagItemForWarehouse(request.ItemUid, out var extracted, out var bagResult) ||
            extracted is null) {
            SendMutationResult(player, ok: false, "That item is not in your bag.");
            return;
        }

        if (!player.TryDepositToWarehouse(extracted, MaxSlots)) {
            // Rollback bag extract if deposit somehow failed after capacity check.
            if (player.InventoryManager.TryInsertWarehouseItemIntoBag(extracted, out var rollback)) {
                Inventory.ApplyInventoryMutation(wr, player, rollback);
            }
            SendMutationResult(player, ok: false, "Warehouse is full.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, bagResult);
        var itemName = wr.ItemsById.TryGetValue(extracted.ItemId, out var def) ? def.Name : $"item {extracted.ItemId}";
        SendState(player, $"Stored {extracted.Quantity}× {itemName}.");
    }

    /// <summary>Moves one warehouse stack back into the bag.</summary>
    public static void HandleWarehouseWithdrawRequest(GameWorldRef wr, GameWorldPlayer player, WarehouseWithdrawRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            return;
        }

        if (!TryValidateWilliam(wr, player, request.NpcId, out var error)) {
            SendMutationResult(player, ok: false, error);
            return;
        }

        if (!player.TryWithdrawFromWarehouse(request.ItemUid, out var item) || item is null) {
            SendMutationResult(player, ok: false, "That item is not in the warehouse.");
            return;
        }

        if (!player.InventoryManager.TryInsertWarehouseItemIntoBag(item, out var bagResult)) {
            player.TryDepositToWarehouse(item, MaxSlots);
            SendMutationResult(player, ok: false, "Your bag cannot hold that item.");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, bagResult);
        var itemName = wr.ItemsById.TryGetValue(item.ItemId, out var def) ? def.Name : $"item {item.ItemId}";
        SendState(player, $"Withdrew {item.Quantity}× {itemName}.");
    }

    static bool TryValidateWilliam(GameWorldRef wr, GameWorldPlayer player, long npcId, out string error) {
        error = string.Empty;
        if (!wr.NpcsByNpcId.TryGetValue(npcId, out var npc) || npc.CatalogNpcId != WilliamCatalogNpcId) {
            error = "You must talk to William.";
            return false;
        }

        var dist = Math.Max(Math.Abs(player.PosX - npc.PosX), Math.Abs(player.PosY - npc.PosY));
        if (dist > MaxInteractDistance) {
            error = "Move closer to William.";
            return false;
        }

        return true;
    }

    static bool IsRequestForCurrentWorld(GameWorldRef wr, string requestWorldId) {
        return string.Equals(requestWorldId, wr.WorldId, StringComparison.Ordinal);
    }

    static void SendState(GameWorldPlayer player, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateWarehouseState(player, MaxSlots, message));
    }

    static void SendMutationResult(GameWorldPlayer player, bool ok, string message) {
        NetworkManager.SendToPlayer(player, NetworkManager.CreateWarehouseMutationResult(ok, message));
    }
}
