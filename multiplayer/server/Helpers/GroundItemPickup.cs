using Server.Utils;
using Server.World;
using Server.World.Game;
// NetworkManager for pickup failure toasts

namespace Server.Helpers;

/// <summary>Ground item pickup helpers — gold auto-collects on step (Olympia-style).</summary>
public static class GroundItemPickup {
    /// <summary>Olympia catalog id for stackable gold piles on the ground (<c>Item.cfg</c> id 90).</summary>
    public const int GoldItemId = 90;

    /// <summary>Max items a single manual pickup request may take from a cell stack (Ctrl+pickup).</summary>
    public const int MaxManualPickupItems = 9;

    /// <summary>
    /// Rebuilds an <see cref="InventoryItemState"/> from a ground entry for bag add / re-drop.
    /// Quantity is clamped to ≥1 so GroundItemState never throws and gear never evaporates.
    /// </summary>
    public static InventoryItemState ToInventoryItem(GroundItemState groundItem) {
        ArgumentNullException.ThrowIfNull(groundItem);
        var qty = groundItem.Quantity > 0 ? groundItem.Quantity : 1;
        return new InventoryItemState(
            groundItem.ItemId,
            groundItem.ItemUid,
            bagX: null,
            bagY: null,
            quantity: qty,
            bagZIndex: 0,
            effectOverrides: groundItem.EffectOverrides,
            groundItem.ItemAttribute,
            groundItem.ItemColor,
            groundItem.CurLifeSpan,
            groundItem.MaxLifeSpan,
            groundItem.BindState,
            groundItem.BoundGuildId);
    }

    /// <summary>
    /// Puts a removed ground item back on the cell (or the player's cell as fallback).
    /// Returns true when the item is visible on the ground again.
    /// </summary>
    public static bool TryRestoreGroundItem(
        GameWorldRef wr,
        GroundItemState removedItem,
        int preferredX,
        int preferredY,
        int fallbackX,
        int fallbackY) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(removedItem);
        var inv = ToInventoryItem(removedItem);
        if (wr.GroundStateTracker.TryAddDroppedItem(inv, preferredX, preferredY, out _, out var readded) &&
            readded is not null) {
            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, null, readded);
            return true;
        }
        if ((preferredX != fallbackX || preferredY != fallbackY) &&
            wr.GroundStateTracker.TryAddDroppedItem(inv, fallbackX, fallbackY, out _, out readded) &&
            readded is not null) {
            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, null, readded);
            return true;
        }
        Console.Error.WriteLine(
            $"[GroundItemPickup] FAILED to restore itemId={removedItem.ItemId} uid={removedItem.ItemUid} " +
            $"at ({preferredX},{preferredY}) / fallback ({fallbackX},{fallbackY}).");
        return false;
    }

    /// <summary>
    /// Picks up every consecutive gold stack on the player's cell without a pickup animation.
    /// Non-gold items remain for manual pickup.
    /// </summary>
    public static void TryAutoPickupGoldOnCell(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        if (player.IsDead) {
            return;
        }

        TryAutoPickupGoldAtCell(wr, player, player.PosX, player.PosY);
    }

    /// <summary>
    /// Goblin summon: pick gold at the summon's cell into the owner's bag.
    /// </summary>
    public static void TryAutoPickupGoldOnCellForOwner(
        GameWorldRef wr,
        GameWorldMonster summon,
        long ownerPlayerId) {
        TryAutoPickupAllOnCellForOwner(wr, summon, ownerPlayerId, goldOnly: true);
    }

    /// <summary>
    /// Gold goblin: pick gold + ground items at the summon's cell into the owner's bag.
    /// Skips occupancy checks (the goblin itself stands on the loot cell).
    /// </summary>
    public static void TryAutoPickupAllOnCellForOwner(
        GameWorldRef wr,
        GameWorldMonster summon,
        long ownerPlayerId,
        bool goldOnly = false) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(summon);
        if (!wr.World.TryGetConnectedPlayerById(ownerPlayerId, out var owner) || owner is null || owner.IsDead) {
            return;
        }

        var cellX = summon.PosX;
        var cellY = summon.PosY;
        var picked = 0;
        const int maxPerStep = 9;
        while (picked < maxPerStep &&
               wr.GroundStateTracker.TryPeekTopDroppedItem(cellX, cellY, out var topItem) &&
               topItem is not null) {
            if (goldOnly && topItem.ItemId != GoldItemId) {
                break;
            }

            // Same guildbound rule as manual pickup.
            if (topItem.BindState == ItemBind.BindStateGuildbound) {
                if (string.IsNullOrWhiteSpace(owner.GuildId) ||
                    !string.Equals(topItem.BoundGuildId, owner.GuildId, StringComparison.OrdinalIgnoreCase)) {
                    break;
                }
            }

            if (!wr.GroundStateTracker.TryRemoveTopDroppedItem(
                    cellX,
                    cellY,
                    out var removedItem,
                    out var revealedTopItem) ||
                removedItem is null) {
                break;
            }

            if (!Inventory.TryAddGroundItemToBag(wr, owner, removedItem)) {
                // Bag rejected (unknown catalog id, etc.) — never evaporate the loot.
                TryRestoreGroundItem(wr, removedItem, cellX, cellY, owner.PosX, owner.PosY);
                break;
            }

            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, removedItem, revealedTopItem);
            picked++;
        }
    }

    private static void TryAutoPickupGoldAtCell(GameWorldRef wr, GameWorldPlayer player, int cellX, int cellY) {
        while (wr.GroundStateTracker.TryPeekTopDroppedItem(cellX, cellY, out var topItem) &&
               topItem is not null &&
               topItem.ItemId == GoldItemId) {
            if (!wr.GroundStateTracker.TryRemoveTopDroppedItem(
                    cellX,
                    cellY,
                    out var removedItem,
                    out var revealedTopItem) ||
                removedItem is null) {
                break;
            }

            if (!Inventory.TryAddGroundItemToBag(wr, player, removedItem)) {
                TryRestoreGroundItem(wr, removedItem, cellX, cellY, player.PosX, player.PosY);
                break;
            }

            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, removedItem, revealedTopItem);
        }
    }

    /// <summary>
    /// Picks up the top-most ground item on <paramref name="posX"/>/<paramref name="posY"/> into the player's bag.
    /// Used by Possession and manual pickup; returns false when the cell is blocked or empty.
    /// The picking player does not block their own cell (manual pickup stands on the stack).
    /// </summary>
    public static bool TryPickupTopItemAtCell(GameWorldRef wr, GameWorldPlayer player, int posX, int posY) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        if (player.IsDead) {
            return false;
        }

        if (IsCellOccupiedByLivingEntity(wr, posX, posY, excludePlayer: player)) {
            return false;
        }

        if (!wr.GroundStateTracker.TryPeekTopDroppedItem(posX, posY, out var peekItem) || peekItem is null) {
            return false;
        }

        // Guildbound floor items stay inside the guild: only same guild_id may pick up.
        if (peekItem.BindState == ItemBind.BindStateGuildbound) {
            if (string.IsNullOrWhiteSpace(player.GuildId) ||
                !string.Equals(peekItem.BoundGuildId, player.GuildId, StringComparison.OrdinalIgnoreCase)) {
                return false;
            }
        }

        if (!wr.GroundStateTracker.TryRemoveTopDroppedItem(posX, posY, out var removedItem, out var revealedTopItem) || removedItem is null) {
            return false;
        }

        if (!Inventory.TryAddGroundItemToBag(wr, player, removedItem)) {
            // Critical: bag failed after ground remove — restore or the item is gone forever.
            TryRestoreGroundItem(wr, removedItem, posX, posY, player.PosX, player.PosY);
            // Weight failures already toast; other failures (unknown id) need a message.
            if (PlayerDerivedStats.CanCarryAdditional(player, removedItem.ItemId, Math.Max(1, removedItem.Quantity))) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Could not pick up that item (not in catalog or bag rejected it)."));
            }
            return false;
        }

        NftDropLedger.TryRecordPickup(wr, player, ToInventoryItem(removedItem));

        GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, removedItem, revealedTopItem);
        return true;
    }

    /// <summary>
    /// Picks up up to <paramref name="maxItems"/> top stack entries on the player's cell (clamped to <see cref="MaxManualPickupItems"/>).
    /// Stops on the first failure (empty, blocked by another entity, or bag full).
    /// </summary>
    public static int TryPickupItemsAtPlayerCell(GameWorldRef wr, GameWorldPlayer player, int maxItems) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);
        if (player.IsDead) {
            return 0;
        }

        var limit = Math.Clamp(maxItems, 1, MaxManualPickupItems);
        var picked = 0;
        for (var i = 0; i < limit; i++) {
            if (!TryPickupTopItemAtCell(wr, player, player.PosX, player.PosY)) {
                break;
            }
            picked++;
        }
        return picked;
    }

    /// <summary>
    /// True when another living player (not <paramref name="excludePlayer"/>) or living monster occupies the cell.
    /// </summary>
    private static bool IsCellOccupiedByLivingEntity(GameWorldRef wr, int posX, int posY, GameWorldPlayer excludePlayer) {
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(posX, posY, excludeDisconnected: false)) {
            if (nearbyPlayer.PlayerId == excludePlayer.PlayerId) {
                continue;
            }
            if (nearbyPlayer.PosX == posX && nearbyPlayer.PosY == posY && !nearbyPlayer.IsDead) {
                return true;
            }
        }

        foreach (var nearbyMonster in wr.MonsterSpatialGrid.GetNearbyMonsters(posX, posY)) {
            if (nearbyMonster.PosX == posX && nearbyMonster.PosY == posY && !nearbyMonster.Dead) {
                return true;
            }
        }

        return false;
    }
}
