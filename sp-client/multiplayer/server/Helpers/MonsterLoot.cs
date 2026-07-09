using Server.Utils;
using Server.World;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Rolls configured monster death loot and places accepted drops on the corpse cell.</summary>
public static class MonsterLoot {
    public static void TryDropLootOnDeath(GameWorldRef wr, GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);

        if (!wr.MonstersById.TryGetValue(monster.CatalogMonsterId, out var catalogEntry) ||
            catalogEntry.Loot is not { Length: > 0 } lootTable) {
            return;
        }

        var genLevel = catalogEntry.GenLevel ?? 5;

        foreach (var lootEntry in lootTable) {
            if (lootEntry.Chance <= 0 || Random.Shared.NextDouble() > lootEntry.Chance) {
                continue;
            }
            if (!wr.ItemsById.TryGetValue(lootEntry.ItemId, out var itemConfig)) {
                Console.WriteLine(
                    $"[GameWorld:{wr.WorldId}] Monster loot references unknown item id {lootEntry.ItemId} for catalog monster {monster.CatalogMonsterId}.");
                continue;
            }

            var minQty = Math.Max(1, lootEntry.MinQuantity);
            var maxQty = Math.Max(minQty, lootEntry.MaxQuantity);
            var quantity = maxQty == minQty ? minQty : Random.Shared.Next(minQty, maxQty + 1);

            uint itemAttribute = 0;
            var itemColor = 0;
            if (OlympiaMagicRoll.ShouldRollMagic(itemConfig)) {
                var magic = OlympiaMagicRoll.Roll(itemConfig, genLevel);
                itemAttribute = magic.Attribute;
                itemColor = magic.Color;
            }

            var droppedItem = new InventoryItemState(
                lootEntry.ItemId,
                ItemUidGenerator.Allocate(),
                bagX: null,
                bagY: null,
                quantity,
                bagZIndex: 0,
                effectOverrides: null,
                itemAttribute,
                itemColor);

            if (!wr.GroundStateTracker.TryAddDroppedItem(
                    droppedItem,
                    monster.PosX,
                    monster.PosY,
                    out var previousTopItem,
                    out var addedItem) ||
                addedItem is null) {
                continue;
            }

            GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, previousTopItem, addedItem);
        }
    }
}