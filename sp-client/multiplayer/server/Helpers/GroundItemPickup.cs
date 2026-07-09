using Server.Utils;
using Server.World;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Ground item pickup helpers — gold auto-collects on step (Olympia-style).</summary>
public static class GroundItemPickup {
    /// <summary>MP catalog id for stackable gold piles on the ground.</summary>
    public const int GoldItemId = 35;

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

        while (wr.GroundStateTracker.TryPeekTopDroppedItem(player.PosX, player.PosY, out var topItem) &&
               topItem is not null &&
               topItem.ItemId == GoldItemId) {
            if (!wr.GroundStateTracker.TryRemoveTopDroppedItem(
                    player.PosX,
                    player.PosY,
                    out var removedItem,
                    out var revealedTopItem) ||
                removedItem is null) {
                break;
            }

            if (!Inventory.TryAddGroundItemToBag(wr, player, removedItem)) {
                // Bag full — put gold back on top and stop.
                wr.GroundStateTracker.TryAddDroppedItem(
                    new InventoryItemState(
                        removedItem.ItemId,
                        removedItem.ItemUid,
                        bagX: null,
                        bagY: null,
                        removedItem.Quantity,
                        bagZIndex: 0,
                        effectOverrides: removedItem.EffectOverrides,
                        removedItem.ItemAttribute,
                        removedItem.ItemColor),
                    player.PosX,
                    player.PosY,
                    out _,
                    out var readded);
                if (readded is not null) {
                    GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, null, readded);
                }
                break;
            }

            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, removedItem, revealedTopItem);
        }
    }
}