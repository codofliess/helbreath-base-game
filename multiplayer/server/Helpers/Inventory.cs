using Mmorpg.Network;
using Server.World;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Server-authoritative inventory request handling, self bag/equipment deltas, predictive equip rollback, and nearby visible-equipment broadcasts for one <see cref="GameWorld"/>.</summary>
public static class Inventory {
    /// <summary>Applies a server-authoritative create-item request and sends the resulting self inventory delta.</summary>
    public static void HandleCreateItemRequest(GameWorldRef wr, GameWorldPlayer player, CreateItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        // Free CreateItem is GM sandbox only (allowlisted wallet or open-dev sandbox).
        if (AdminSecurity.RejectIfNotGm(player, "CreateItem")) {
            return;
        }

        // Carry gate: spam-creating stones past max weight soft-locks bag UX (pickup / weight bar).
        if (!PlayerDerivedStats.CanCarryAdditional(player, request.ItemId, 1)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                $"Too heavy! Weight {PlayerDerivedStats.CurrentCarryWeightStones(player)}/{PlayerDerivedStats.MaxCarryWeightStones(player)} stone — cannot create more."));
            return;
        }

        if (!player.InventoryManager.TryCreateItem(request.ItemId, ToEffectOverrides(request.EffectOverrides), out var result)) {
            return;
        }

        // GM sandbox defaults for new CIC / siphon content (testing + seed gear).
        // Stamp live bag instances, then refresh AddedToBag clones for the client delta.
        foreach (var bag in player.InventoryManager.BagItems) {
            foreach (var added in result.AddedToBag) {
                if (bag.ItemUid != added.ItemUid) {
                    continue;
                }
                StampGmSpecialDefaults(wr, bag);
                added.SiphonLevel = bag.SiphonLevel;
                added.CicLevel = bag.CicLevel;
                added.CicStatKind = bag.CicStatKind;
                added.CicStatValue = bag.CicStatValue;
            }
        }

        ApplyInventoryMutation(wr, player, result);
    }

    /// <summary>
    /// GM CreateItem: siphon gems start at L1; cape/shield/body armor stamped CIC3 HP35
    /// so merge CIC3→4 can be tested without external loot tables.
    /// </summary>
    static void StampGmSpecialDefaults(GameWorldRef wr, InventoryItemState item) {
        if (SiphonGems.IsSiphonGem(item.ItemId) && item.SiphonLevel <= 0) {
            item.SiphonLevel = 1;
            return;
        }
        if (!wr.ItemsById.TryGetValue(item.ItemId, out var def)) {
            return;
        }
        if (!CicItemCraft.IsCicEligibleType(def.ItemType)) {
            return;
        }
        if (item.CicLevel > 0) {
            return;
        }
        item.CicLevel = CicItemCraft.MinCic;
        item.CicStatKind = CicItemCraft.StatHp;
        item.CicStatValue = 35;
    }

    /// <summary>
    /// Updates one bagged item's UI position and server-owned z-order.
    /// Sentinel <c>bag_x = -1000 &amp; bag_y = -1000</c> = Shift+click stack-all matching onto this item.
    /// </summary>
    public static void HandleMoveItemInBagRequest(GameWorldRef wr, GameWorldPlayer player, MoveItemInBagRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        // Shift+click stack all identical stackables onto this pile (Olympia bag merge).
        if (request.HasBagX && request.HasBagY && request.BagX == -1000 && request.BagY == -1000) {
            if (!player.InventoryManager.TryStackAllMatchingAt(request.ItemUid, out var stackResult)) {
                return;
            }
            ApplyInventoryMutation(wr, player, stackResult);
            return;
        }

        var bagX = request.HasBagX ? request.BagX : (int?)null;
        var bagY = request.HasBagY ? request.BagY : (int?)null;
        if (!player.InventoryManager.TryMoveItemInBag(request.ItemUid, bagX, bagY, out var result)) {
            return;
        }

        ApplyInventoryMutation(wr, player, result);
    }

    /// <summary>Equips one bag item, then sends self inventory deltas and nearby visible-slot appearance updates.</summary>
    public static void HandleEquipItemRequest(GameWorldRef wr, GameWorldPlayer player, EquipItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        // Stat / level / Str gates (before mutating inventory) — Olympia ItemEquipHandler parity.
        InventoryItemState? bagTarget = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemUid != request.ItemUid) {
                continue;
            }
            bagTarget = bag;
            break;
        }
        if (bagTarget is not null) {
            if (SiphonGems.IsSiphonGem(bagTarget.ItemId) && !SiphonGems.CanEquipGem(player, bagTarget.ItemId, out var gemErr)) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(gemErr));
                SendEquipRollbackIfNeeded(wr, player, request.ItemUid, request.HasTargetSlot ? request.TargetSlot : null);
                return;
            }
            if (!CanPlayerEquipItem(player, bagTarget, out var equipErr)) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(equipErr));
                SendEquipRollbackIfNeeded(wr, player, request.ItemUid, request.HasTargetSlot ? request.TargetSlot : null);
                return;
            }
        }

        var targetSlot = request.HasTargetSlot ? request.TargetSlot : null;
        if (!player.InventoryManager.TryEquipItem(request.ItemUid, targetSlot, player.GenderValue, out var result)) {
            SendEquipRollbackIfNeeded(wr, player, request.ItemUid, targetSlot);
            return;
        }

        ApplyInventoryMutation(wr, player, result);
        // Angel MAG / Mag gear can unlock full cast speed.
        PlayerDerivedStats.ApplyAuthoritativeCastSpeed(player);
    }

    /// <summary>
    /// Olympia equip gates: Str vs weight/100 (Light reduces), armor "Available for above …", level limit.
    /// </summary>
    public static bool CanPlayerEquipItem(GameWorldPlayer player, InventoryItemState item, out string error) {
        error = "";
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(item);

        // Exhausted gear cannot be equipped (Olympia).
        if (item.MaxLifeSpan > 1 && item.CurLifeSpan <= 0) {
            error = "The item is exhausted. Repair it to use it.";
            return false;
        }

        var levelLimit = ItemEquipCatalog.GetLevelLimit(item.ItemId);
        // Custom-crafted bit (attr & 1) bypasses level in Olympia — we honor that.
        if (levelLimit > 0 && (item.ItemAttribute & 0x1u) == 0 && player.Level < levelLimit) {
            error = $"You need level {levelLimit} to equip this (you are L{player.Level}).";
            return false;
        }

        var requiredStr = ItemEquipCatalog.GetRequiredStr(item.ItemId, item.ItemAttribute);
        var strEff = PlayerDerivedStats.EffectiveStr(player);
        if (requiredStr > 0 && strEff < requiredStr) {
            var missing = requiredStr - strEff;
            error = $"You need {missing} more Strength to equip this (required Str {requiredStr}, you have {strEff}).";
            return false;
        }

        var (statKind, minVal) = ItemEquipCatalog.GetSecondaryStatRequirement(item.ItemId);
        if (statKind > 0 && minVal > 0) {
            var (have, label) = statKind switch {
                11 => (PlayerDerivedStats.EffectiveDex(player), "Dexterity"),
                12 => (player.Vit, "Vitality"),
                13 => (PlayerDerivedStats.EffectiveInt(player), "Intelligence"),
                14 => (PlayerDerivedStats.EffectiveMag(player), "Magic"),
                15 => (player.Chr, "Charisma"),
                _ => (int.MaxValue, "stat"),
            };
            if (have < minVal) {
                error = $"You need {minVal - have} more {label} to equip this (required {minVal}, you have {have}).";
                return false;
            }
        }

        return true;
    }

    /// <summary>After the player’s gender changes, removes equipped items that are restricted to another gender; notifies the player and nearby observers for visible slots.</summary>
    public static void UnequipItemsInvalidForCurrentGender(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!player.InventoryManager.TryUnequipAllGenderMismatchedEquipment(player.GenderValue, out var result)) {
            return;
        }

        ApplyInventoryMutation(wr, player, result);
    }

    /// <summary>Removes equipped items whose catalog type does not match their slot (e.g. weapon in ring/accessory/necklace); notifies self and nearby observers for visible slots.</summary>
    public static void UnequipItemsInvalidForSlotType(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!player.InventoryManager.TryUnequipAllTypeMismatchedEquipment(out var result)) {
            return;
        }

        ApplyInventoryMutation(wr, player, result);
    }

    /// <summary>
    /// Strip gear the player no longer meets Str/level/stat for (e.g. Horned with Str 40).
    /// Call on join so already-worn illegal gear does not stick.
    /// </summary>
    public static void UnequipItemsInvalidForStats(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var toStrip = new List<(string Slot, long ItemUid)>();
        foreach (var (slot, eq) in player.InventoryManager.EquippedItems) {
            if (!CanPlayerEquipItem(player, eq, out _)) {
                toStrip.Add((slot, eq.ItemUid));
            }
        }
        if (toStrip.Count == 0) {
            return;
        }

        var any = false;
        InventoryMutationResult? combined = null;
        foreach (var (slot, uid) in toStrip) {
            if (!player.InventoryManager.TryUnequipItem(slot, uid, bagX: null, bagY: null, out var result)) {
                continue;
            }
            any = true;
            if (combined is null) {
                combined = result;
            } else {
                combined.Unequipped.AddRange(result.Unequipped);
                combined.AddedToBag.AddRange(result.AddedToBag);
                combined.MovedInBag.AddRange(result.MovedInBag);
                combined.RemovedFromBagItemUids.AddRange(result.RemovedFromBagItemUids);
                combined.Equipped.AddRange(result.Equipped);
            }
        }
        if (any && combined is not null) {
            ApplyInventoryMutation(wr, player, combined);
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "Some equipment was removed — not enough Strength/Level/stats to wear it."));
        }
    }

    /// <summary>Unequips one slot back into the bag, optionally honoring the bag coordinates provided by the client drop.</summary>
    public static void HandleUnequipItemRequest(GameWorldRef wr, GameWorldPlayer player, UnequipItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        var bagX = request.HasBagX ? request.BagX : (int?)null;
        var bagY = request.HasBagY ? request.BagY : (int?)null;
        if (!player.InventoryManager.TryUnequipItem(request.Slot, request.ItemUid, bagX, bagY, out var result)) {
            return;
        }

        ApplyInventoryMutation(wr, player, result);
    }

    /// <summary>Consumes one bagged consumable item and sends the resulting self inventory delta.</summary>
    public static void HandleConsumeItemRequest(GameWorldRef wr, GameWorldPlayer player, ConsumeItemRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        var invisPotion = false;
        var recallScroll = false;
        int? consumedItemId = null;
        foreach (var bagItem in player.InventoryManager.BagItems) {
            if (bagItem.ItemUid != request.ItemUid) {
                continue;
            }
            consumedItemId = bagItem.ItemId;
            // Integrity is only spent during stone upgrade (with client reconfirm) — never free-consume.
            if (bagItem.ItemId == TimedChallenge.StoneOfIntegrityItemId
                || bagItem.ItemId == ItemStoneUpgrade.StoneOfIntegrityId) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                    "Stone of Integrity is used when upgrading gear from +3 (holds +N: no burn, no drop). Right-click → Upgrade, then confirm."));
                return;
            }
            if (bagItem.ItemId == TimedChallenge.InvisibilityPotionItemId) {
                invisPotion = true;
            }
            if (bagItem.ItemId == Recall.RecallScrollItemId) {
                recallScroll = true;
            }
            break;
        }

        // Recall Scroll: only consume if the transfer/snap to a guarded TP pad succeeds.
        if (recallScroll) {
            if (!Recall.TryExecute(wr, player, out _)) {
                return;
            }
            if (!player.InventoryManager.TryConsumeItem(request.ItemUid, out var recallMut)) {
                return;
            }
            ApplyInventoryMutation(wr, player, recallMut);
            return;
        }

        if (!player.InventoryManager.TryConsumeItem(request.ItemUid, out var result)) {
            return;
        }

        ApplyInventoryMutation(wr, player, result);
        if (consumedItemId is int itemId) {
            // Cash-shop tablets / service tickets (production effects).
            if (CashShopBoosts.TryApplyConsumable(wr, player, itemId)) {
                // handled
            } else if (ConsumableUse.ApplyAfterConsume(player, itemId) == ConsumableUse.VitalPool.Sp) {
                // Olympia UseItemHandler: green pots clear poison.
                if (player.HasTemporaryEffect(TemporaryEffectType.Poison)) {
                    player.RemoveTemporaryEffect(wr, TemporaryEffectType.Poison, broadcastExpired: true);
                }
            }
        }
        if (invisPotion) {
            TimedChallenge.ApplyInvisibilityPotionEffect(wr, player);
        }
    }

    /// <summary>Removes one bag entry so the world can drop it onto the current cell as an authoritative ground-item stack entry.</summary>
    public static bool TryRemoveBagItemForGroundDrop(GameWorldRef wr, GameWorldPlayer player, long itemUid, out InventoryItemState? droppedItem) {
        ArgumentNullException.ThrowIfNull(player);
        droppedItem = null;
        if (!player.InventoryManager.TryRemoveItemFromBagForGroundDrop(itemUid, out droppedItem, out var result)) {
            return false;
        }

        ApplyInventoryMutation(wr, player, result);
        return true;
    }

    /// <summary>Adds one authoritative ground item into the player's bag, applying normal stack-merge rules and sending the resulting self delta.</summary>
    public static bool TryAddGroundItemToBag(GameWorldRef wr, GameWorldPlayer player, GroundItemState groundItem) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(groundItem);
        var qty = groundItem.Quantity > 0 ? groundItem.Quantity : 1;
        if (!PlayerDerivedStats.CanCarryAdditional(player, groundItem.ItemId, qty)) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                $"Too heavy! Weight {PlayerDerivedStats.CurrentCarryWeightStones(player)}/{PlayerDerivedStats.MaxCarryWeightStones(player)} stone (need Str/Level)."));
            return false;
        }
        if (!player.InventoryManager.TryAddGroundItemToBag(groundItem, out var result)) {
            return false;
        }

        ApplyInventoryMutation(wr, player, result);
        return true;
    }

    /// <summary>Sends the self inventory delta and any nearby-player visible-slot appearance updates produced by one inventory mutation.</summary>
    public static void ApplyInventoryMutation(GameWorldRef wr, GameWorldPlayer player, InventoryMutationResult result) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(result);

        foreach (var removedItemUid in result.RemovedFromBagItemUids) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateItemRemovedFromBag(removedItemUid));
        }
        foreach (var unequipped in result.Unequipped) {
            var selfUnequippedMessage = NetworkManager.CreateItemUnequipped(player.PlayerId, unequipped.Slot, unequipped.ItemUid);
            NetworkManager.SendToPlayer(player, selfUnequippedMessage);
            if (!InventoryManager.IsVisibleAppearanceSlot(unequipped.Slot)) {
                continue;
            }

            foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId, excludeDisconnected: true)) {
                NetworkManager.SendToPlayer(nearbyPlayer, selfUnequippedMessage);
            }
        }
        foreach (var addedItem in result.AddedToBag) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateItemAddedToBag(addedItem));
        }
        foreach (var movedItem in result.MovedInBag) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateItemMovedInBag(movedItem));
        }
        foreach (var equipped in result.Equipped) {
            var equippedMessage = NetworkManager.CreateItemEquipped(player.PlayerId, equipped.Slot, equipped.Item);
            NetworkManager.SendToPlayer(player, equippedMessage);
            if (!InventoryManager.IsVisibleAppearanceSlot(equipped.Slot)) {
                continue;
            }

            foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId, excludeDisconnected: true)) {
                NetworkManager.SendToPlayer(nearbyPlayer, equippedMessage);
            }
        }

        // Angelic pendant / weapon change: refresh HP/MP/SP caps and STR-based melee.
        if (result.Equipped.Count > 0 || result.Unequipped.Count > 0) {
            PlayerDerivedStats.Refresh(player, fillIncreasedPools: true);
            // Olympia full Hero set (war +100 HR/+5 AP, mage +4 dmg).
            HeroSetBonus.Recompute(player);
            Progression.SendProgressionUpdated(player, leveledUp: false);
            // Merien / Xelima / Ice Sword special ability set/release.
            SpecialAbility.RecomputeFromEquipment(wr, player, notify: true);
        }
    }

    /// <summary>When the client predicted an equip locally but the server rejected it, clear the slot and restore the still-bagged item.</summary>
    private static void SendEquipRollbackIfNeeded(GameWorldRef wr, GameWorldPlayer player, long itemUid, string? requestedTargetSlot) {
        ArgumentNullException.ThrowIfNull(player);

        InventoryItemState? item = null;
        foreach (var bagItem in player.InventoryManager.BagItems) {
            if (bagItem.ItemUid == itemUid) {
                item = bagItem;
                break;
            }
        }
        if (item is null) {
            return;
        }
        if (!wr.ItemsById.TryGetValue(item.ItemId, out var itemDef)) {
            return;
        }

        var predictedSlot = ResolvePredictedEquipSlot(player, itemDef.ItemType, requestedTargetSlot);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateItemUnequipped(player.PlayerId, predictedSlot, item.ItemUid));
        NetworkManager.SendToPlayer(player, NetworkManager.CreateItemAddedToBag(item.Clone()));
    }

    /// <summary>Matches the client-side ring-target resolution so rejected equip requests can roll back the same predicted slot.</summary>
    private static string ResolvePredictedEquipSlot(GameWorldPlayer player, string itemType, string? requestedTargetSlot) {
        ArgumentNullException.ThrowIfNull(player);

        if (!string.IsNullOrWhiteSpace(requestedTargetSlot) &&
            InventoryManager.IsItemTypeCompatibleWithSlot(itemType, requestedTargetSlot)) {
            return requestedTargetSlot;
        }
        if (!string.Equals(itemType, "ring", StringComparison.Ordinal)) {
            return itemType;
        }
        if (!player.InventoryManager.EquippedItems.ContainsKey("ring-left")) {
            return "ring-left";
        }
        if (!player.InventoryManager.EquippedItems.ContainsKey("ring-right")) {
            return "ring-right";
        }
        return "ring-left";
    }

    /// <summary>Copies protobuf effect override rows into the same record shape used by item config and persistence.</summary>
    private static ItemEffectConfig[]? ToEffectOverrides(IEnumerable<ItemEffectEntry> effectOverrides) {
        ArgumentNullException.ThrowIfNull(effectOverrides);

        var rows = new List<ItemEffectConfig>();
        foreach (var effectOverride in effectOverrides) {
            rows.Add(new ItemEffectConfig(
                effectOverride.Effect,
                effectOverride.HasEffectColor ? (int)effectOverride.EffectColor : null));
        }
        return rows.Count == 0 ? null : rows.ToArray();
    }
}
