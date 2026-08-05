using Server.World;
using Server.World.Game;

namespace Server.Utils;

/// <summary>Mutable per-instance item state owned by one player's inventory.</summary>
public sealed class InventoryItemState {
    /// <summary>Stable catalog row id from <c>Items.json</c>.</summary>
    public int ItemId { get; private set; }

    /// <summary>Olympia DK form change (e.g. 703 → 709 on first majestic upgrade).</summary>
    public void TransformItemId(int newItemId) {
        if (newItemId > 0) {
            ItemId = newItemId;
        }
    }
    /// <summary>Authoritative runtime instance id generated server-side.</summary>
    public long ItemUid { get; private set; }
    /// <summary>Bag X position in the client inventory UI when the item is bagged; preserved while equipped for future unequip.</summary>
    public int? BagX { get; set; }
    /// <summary>Bag Y position in the client inventory UI when the item is bagged; preserved while equipped for future unequip.</summary>
    public int? BagY { get; set; }
    /// <summary>Authoritative quantity for stackable items; otherwise 1.</summary>
    public int Quantity { get; set; }
    /// <summary>Authoritative bag z-order index; bag rendering is sorted ascending by this value.</summary>
    public int BagZIndex { get; set; }
    /// <summary>Per-instance effect overrides requested by the client (for example custom tint/glow in the item dialog).</summary>
    public ItemEffectConfig[]? EffectOverrides { get; set; }
    /// <summary>Olympia <c>m_dwAttribute</c> bitfield (shards, fragments, rep suffix).</summary>
    public uint ItemAttribute { get; set; }
    /// <summary>Olympia item name color tier (1–8); 0 = default catalog name color.</summary>
    public int ItemColor { get; set; }
    /// <summary>Olympia <c>m_wCurLifeSpan</c>; 0 when the catalog item is not durable.</summary>
    public int CurLifeSpan { get; set; }
    /// <summary>Olympia <c>m_wMaxLifeSpan</c> for this instance; 0 when not durable.</summary>
    public int MaxLifeSpan { get; set; }
    /// <summary>0=unbound, 1=soulbound, 2=guildbound (<see cref="Helpers.ItemBind"/>).</summary>
    public int BindState { get; set; }
    /// <summary>Guild id when <see cref="BindState"/> is guildbound; empty otherwise.</summary>
    public string BoundGuildId { get; set; } = "";
    /// <summary>CIC craft tier 0=none, 3–7 for capes/shields/armor merge path.</summary>
    public int CicLevel { get; set; }
    /// <summary>0=none, 1=HP, 2=SP, 3=MP — donors must match to merge.</summary>
    public int CicStatKind { get; set; }
    /// <summary>e.g. 35 for HP35; merge keeps min of both donors.</summary>
    public int CicStatValue { get; set; }
    /// <summary>Mana/HP Siphoning gem power 0–15.</summary>
    public int SiphonLevel { get; set; }

    public InventoryItemState(
        int itemId,
        long itemUid,
        int? bagX,
        int? bagY,
        int quantity,
        int bagZIndex,
        ItemEffectConfig[]? effectOverrides,
        uint itemAttribute = 0,
        int itemColor = 0,
        int curLifeSpan = 0,
        int maxLifeSpan = 0,
        int bindState = 0,
        string boundGuildId = "",
        int cicLevel = 0,
        int cicStatKind = 0,
        int cicStatValue = 0,
        int siphonLevel = 0) {
        ItemId = itemId;
        ItemUid = itemUid;
        BagX = bagX;
        BagY = bagY;
        Quantity = quantity;
        BagZIndex = bagZIndex;
        EffectOverrides = CloneEffectOverrides(effectOverrides);
        ItemAttribute = itemAttribute;
        ItemColor = itemColor;
        CurLifeSpan = curLifeSpan;
        MaxLifeSpan = maxLifeSpan;
        BindState = bindState;
        BoundGuildId = boundGuildId ?? "";
        CicLevel = cicLevel;
        CicStatKind = cicStatKind;
        CicStatValue = cicStatValue;
        SiphonLevel = siphonLevel;
    }

    /// <summary>Creates a detached copy for outgoing messages and mutation results.</summary>
    public InventoryItemState Clone() {
        return new InventoryItemState(ItemId, ItemUid, BagX, BagY, Quantity, BagZIndex, EffectOverrides, ItemAttribute, ItemColor, CurLifeSpan, MaxLifeSpan, BindState, BoundGuildId, CicLevel, CicStatKind, CicStatValue, SiphonLevel);
    }

    /// <summary>Converts live state into the persistence record stored on disk and world transfers.</summary>
    public PersistedInventoryItem ToPersistedItem() {
        return new PersistedInventoryItem(ItemId, ItemUid, BagX, BagY, Quantity, BagZIndex, CloneEffectOverrides(EffectOverrides), ItemAttribute, ItemColor, CurLifeSpan, MaxLifeSpan, BindState, BoundGuildId, CicLevel, CicStatKind, CicStatValue, SiphonLevel);
    }

    /// <summary>Converts equipped live state into the slimmer persistence record that omits bag-only runtime fields.</summary>
    public PersistedEquippedItem ToPersistedEquippedItem() {
        return new PersistedEquippedItem(ItemId, ItemUid, BagX, BagY, CloneEffectOverrides(EffectOverrides), ItemAttribute, ItemColor, CurLifeSpan, MaxLifeSpan, BindState, BoundGuildId, CicLevel, CicStatKind, CicStatValue, SiphonLevel);
    }

    /// <summary>Rehydrates live inventory state from persisted storage.</summary>
    public static InventoryItemState FromPersistedItem(PersistedInventoryItem item) {
        ArgumentNullException.ThrowIfNull(item);
        return new InventoryItemState(item.ItemId, item.ItemUid, item.BagX, item.BagY, item.Quantity, item.BagZIndex, item.EffectOverrides, item.ItemAttribute, item.ItemColor, item.CurLifeSpan, item.MaxLifeSpan, item.BindState, item.BoundGuildId, item.CicLevel, item.CicStatKind, item.CicStatValue, item.SiphonLevel);
    }

    /// <summary>Rehydrates equipped live state from persisted storage, restoring only fields that matter while the item is equipped.</summary>
    public static InventoryItemState FromPersistedEquippedItem(PersistedEquippedItem item) {
        ArgumentNullException.ThrowIfNull(item);
        return new InventoryItemState(item.ItemId, item.ItemUid, item.BagX, item.BagY, quantity: 1, bagZIndex: 0, item.EffectOverrides, item.ItemAttribute, item.ItemColor, item.CurLifeSpan, item.MaxLifeSpan, item.BindState, item.BoundGuildId, item.CicLevel, item.CicStatKind, item.CicStatValue, item.SiphonLevel);
    }

    /// <summary>
    /// Fills missing durability from <paramref name="config"/> and/or Olympia Item.cfg
    /// (full lifespan for new drops / legacy rows with Cur=0).
    /// Durable items are those with maxLifeSpan &gt; 1.
    /// </summary>
    public void EnsureCatalogDurability(ItemConfig? config) {
        var catalogMax = 0;
        if (config?.MaxLifeSpan is int jsonMax && jsonMax > 1) {
            catalogMax = jsonMax;
        }
        if (catalogMax <= 1) {
            // Most Items.json rows omit maxLifeSpan — fall back to Item.cfg token 11.
            var cfgLife = ItemCfgStatsCatalog.GetMaxLifeSpan(ItemId);
            if (cfgLife > 1) {
                catalogMax = cfgLife;
            }
        }

        if (catalogMax <= 1) {
            return;
        }

        if (MaxLifeSpan <= 0) {
            MaxLifeSpan = catalogMax;
        }

        // New drops / floor pickups often have CurLifeSpan left at 0 — treat as full, not broken.
        if (CurLifeSpan <= 0) {
            CurLifeSpan = MaxLifeSpan;
        } else if (CurLifeSpan > MaxLifeSpan) {
            CurLifeSpan = MaxLifeSpan;
        }
    }

    private static ItemEffectConfig[]? CloneEffectOverrides(ItemEffectConfig[]? effectOverrides) {
        if (effectOverrides is null || effectOverrides.Length == 0) {
            return null;
        }

        var copy = new ItemEffectConfig[effectOverrides.Length];
        Array.Copy(effectOverrides, copy, effectOverrides.Length);
        return copy;
    }
}

/// <summary>One equip mutation emitted by <see cref="InventoryManager"/> after an accepted equip request.</summary>
public sealed record InventoryEquippedItemChange(string Slot, InventoryItemState Item);

/// <summary>One slot cleared by <see cref="InventoryManager"/> after an accepted unequip or blocker removal.</summary>
public sealed record InventoryUnequippedItemChange(string Slot, long ItemUid);

/// <summary>Batch of authoritative item mutations produced by one inventory request.</summary>
public sealed class InventoryMutationResult {
    public List<InventoryItemState> AddedToBag { get; } = new();
    public List<long> RemovedFromBagItemUids { get; } = new();
    public List<InventoryItemState> MovedInBag { get; } = new();
    public List<InventoryEquippedItemChange> Equipped { get; } = new();
    public List<InventoryUnequippedItemChange> Unequipped { get; } = new();
}

/// <summary>Server-authoritative bag/equipment state plus equip/unequip/move rules for one <see cref="GameWorldPlayer"/>.</summary>
public sealed class InventoryManager {
    private static readonly int[] InitialEquippedItemIds = { 1, 8, 10, 13, 15, 23 };

    private const string WeaponSlot = "weapon";
    private const string ShieldSlot = "shield";
    private const string ArmorSlot = "armor";
    private const string HauberkSlot = "hauberk";
    private const string LeggingsSlot = "leggings";
    private const string BootsSlot = "boots";
    private const string HelmetSlot = "helmet";
    private const string CapeSlot = "cape";
    private const string AccessorySlot = "accessory";
    private const string NecklaceSlot = "necklace";
    private const string GemSlot = "gem";
    private const string RingItemType = "ring";
    private const string MiscItemType = "misc";
    private const string GemItemType = "gem";
    private const string RingLeftSlot = "ring-left";
    private const string RingRightSlot = "ring-right";

    private static readonly HashSet<string> VisibleAppearanceSlots = new(StringComparer.Ordinal) {
        WeaponSlot,
        ShieldSlot,
        ArmorSlot,
        HauberkSlot,
        LeggingsSlot,
        BootsSlot,
        HelmetSlot,
        CapeSlot,
        AccessorySlot,
        // Gem is jewelry-only (no paper-doll layer).
    };

    private static readonly HashSet<string> ValidEquipmentSlots = new(StringComparer.Ordinal) {
        WeaponSlot,
        ShieldSlot,
        ArmorSlot,
        HauberkSlot,
        LeggingsSlot,
        BootsSlot,
        HelmetSlot,
        CapeSlot,
        AccessorySlot,
        NecklaceSlot,
        GemSlot,
        RingLeftSlot,
        RingRightSlot,
    };

    /// <summary>Adds two stack quantities without silent int wrap; result saturates at <see cref="int.MaxValue"/>.</summary>
    private static int AddStackQuantitiesSaturating(int current, int delta) {
        var sum = (long)current + delta;
        if (sum >= int.MaxValue) {
            return int.MaxValue;
        }
        if (sum <= int.MinValue) {
            return int.MinValue;
        }
        return (int)sum;
    }

    private readonly IReadOnlyDictionary<int, ItemConfig> itemsById;
    private readonly Dictionary<string, InventoryItemState> equippedItems = new(StringComparer.Ordinal);
    private readonly List<InventoryItemState> bagItems = new();

    public IReadOnlyDictionary<string, InventoryItemState> EquippedItems => equippedItems;
    public IReadOnlyList<InventoryItemState> BagItems => bagItems;

    public InventoryManager(IReadOnlyDictionary<int, ItemConfig> itemsById) {
        ArgumentNullException.ThrowIfNull(itemsById);
        this.itemsById = itemsById;
        SeedInitialLoadout();
    }

    /// <summary>Resolve catalog row for an equipped/bag item id.</summary>
    public bool TryGetItemConfig(int itemId, out ItemConfig def) =>
        itemsById.TryGetValue(itemId, out def!);

    /// <summary>True when the slot should be sent to nearby players for visible appearance sync.</summary>
    public static bool IsVisibleAppearanceSlot(string slot) {
        ArgumentException.ThrowIfNullOrWhiteSpace(slot);
        return VisibleAppearanceSlots.Contains(slot);
    }

    /// <summary>Loads persisted bag/equipment state, replacing the current contents entirely.</summary>
    public void LoadFromPersistence(
        PersistedInventoryItem[]? persistedBagItems,
        PersistedEquippedInventoryItem[]? persistedEquippedItems) {
        equippedItems.Clear();
        bagItems.Clear();

        if (persistedEquippedItems is not null) {
            foreach (var persisted in persistedEquippedItems) {
                if (string.IsNullOrWhiteSpace(persisted.Slot)) {
                    continue;
                }
                if (!itemsById.ContainsKey(persisted.Item.ItemId)) {
                    continue;
                }

                equippedItems[persisted.Slot] = InventoryItemState.FromPersistedEquippedItem(persisted.Item);
                if (itemsById.TryGetValue(persisted.Item.ItemId, out var eqDef)) {
                    equippedItems[persisted.Slot].EnsureCatalogDurability(eqDef);
                }
            }
        }

        if (persistedBagItems is not null) {
            foreach (var persisted in persistedBagItems) {
                if (!itemsById.ContainsKey(persisted.ItemId)) {
                    continue;
                }

                bagItems.Add(InventoryItemState.FromPersistedItem(persisted));
                if (itemsById.TryGetValue(persisted.ItemId, out var bagDef)) {
                    bagItems[^1].EnsureCatalogDurability(bagDef);
                }
            }
        }

        bagItems.Sort((a, b) => a.BagZIndex.CompareTo(b.BagZIndex));
        ConsolidateStackableBagItems();
        // Re-stamp cash shoes/cape affixes (Exp% + regen; clear old flat CIC HP/MP mistakes).
        foreach (var bag in bagItems) {
            if (Server.Helpers.CashShopBoosts.IsCashGear(bag.ItemId)) {
                Server.Helpers.CashShopBoosts.ApplyGearAffixes(bag);
            }
        }
        foreach (var kv in equippedItems) {
            if (Server.Helpers.CashShopBoosts.IsCashGear(kv.Value.ItemId)) {
                Server.Helpers.CashShopBoosts.ApplyGearAffixes(kv.Value);
            }
        }
        NormalizeBagZIndices();
    }

    /// <summary>
    /// Merges duplicate stackable bag rows into a single stack per item id.
    /// <b>Gold (id 90) is never auto-merged</b> — it stays where the player left each pile until
    /// they Shift+click stack or move it. Other stackables still consolidate.
    /// </summary>
    public void ConsolidateStackableBagItems() {
        if (bagItems.Count < 2) {
            return;
        }

        const int goldItemId = 90;
        var ids = new HashSet<int>();
        foreach (var item in bagItems) {
            if (item.ItemId == goldItemId) {
                continue; // never auto-rearrange gold piles
            }
            if (itemsById.TryGetValue(item.ItemId, out var def) && def.Stackable == true) {
                ids.Add(item.ItemId);
            }
        }

        foreach (var itemId in ids) {
            var keepIndex = FindPreferredStackableBagIndex(itemId);
            if (keepIndex < 0) {
                continue;
            }

            var keep = bagItems[keepIndex];
            for (var j = bagItems.Count - 1; j >= 0; j--) {
                if (j == keepIndex) {
                    continue;
                }
                var other = bagItems[j];
                if (other.ItemId != itemId) {
                    continue;
                }

                keep.Quantity = AddStackQuantitiesSaturating(keep.Quantity, other.Quantity);
                bagItems.RemoveAt(j);
                if (j < keepIndex) {
                    keepIndex--;
                }
            }
        }

        NormalizeBagZIndices();
    }

    /// <summary>
    /// Olympia-style Shift+click: merge every bag row with the same item id onto
    /// <paramref name="targetItemUid"/>, keeping that row's bagX/bagY.
    /// Works for gold and all stackables.
    /// </summary>
    public bool TryStackAllMatchingAt(long targetItemUid, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var keepIndex = GetBagIndex(targetItemUid);
        if (keepIndex < 0) {
            return false;
        }

        var keep = bagItems[keepIndex];
        if (!itemsById.TryGetValue(keep.ItemId, out var def) || def.Stackable != true) {
            return false;
        }

        var itemId = keep.ItemId;
        var merged = false;
        for (var j = bagItems.Count - 1; j >= 0; j--) {
            if (j == keepIndex) {
                continue;
            }
            var other = bagItems[j];
            if (other.ItemId != itemId) {
                continue;
            }

            keep.Quantity = AddStackQuantitiesSaturating(keep.Quantity, other.Quantity);
            result.RemovedFromBagItemUids.Add(other.ItemUid);
            bagItems.RemoveAt(j);
            if (j < keepIndex) {
                keepIndex--;
            }
            merged = true;
        }

        if (!merged) {
            return false;
        }

        // Bring keep stack to front z-order without changing bagX/bagY.
        bagItems.RemoveAt(keepIndex);
        bagItems.Add(keep);
        NormalizeBagZIndices();
        result.AddedToBag.Add(keep.Clone());
        result.MovedInBag.Add(keep.Clone());
        return true;
    }

    /// <summary>
    /// Prefer the stack the player last dragged (highest bag z-index). Falls back to first match.
    /// </summary>
    int FindPreferredStackableBagIndex(int itemId) {
        var best = -1;
        var bestZ = int.MinValue;
        for (var i = 0; i < bagItems.Count; i++) {
            var item = bagItems[i];
            if (item.ItemId != itemId) {
                continue;
            }
            if (best < 0 || item.BagZIndex >= bestZ) {
                best = i;
                bestZ = item.BagZIndex;
            }
        }
        return best;
    }

    /// <summary>Total bag gold (item id 90), after optional consolidate.</summary>
    public int CountGold() {
        const int goldItemId = 90;
        var total = 0;
        foreach (var item in bagItems) {
            if (item.ItemId == goldItemId) {
                total = AddStackQuantitiesSaturating(total, Math.Max(0, item.Quantity));
            }
        }
        return total;
    }

    /// <summary>Serializes the current bag state for persistence.</summary>
    public PersistedInventoryItem[] CreatePersistedBagItems() {
        var rows = new PersistedInventoryItem[bagItems.Count];
        for (var i = 0; i < bagItems.Count; i++) {
            rows[i] = bagItems[i].ToPersistedItem();
        }
        return rows;
    }

    /// <summary>Serializes the current equipped state for persistence.</summary>
    public PersistedEquippedInventoryItem[] CreatePersistedEquippedItems() {
        var rows = new PersistedEquippedInventoryItem[equippedItems.Count];
        var index = 0;
        foreach (var entry in equippedItems) {
            rows[index++] = new PersistedEquippedInventoryItem(entry.Key, entry.Value.ToPersistedEquippedItem());
        }
        return rows;
    }

    /// <summary>Creates one item instance or increases an existing stack, mirroring the current client-side create behavior.</summary>
    public bool TryCreateItem(int itemId, ItemEffectConfig[]? effectOverrides, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        if (!itemsById.TryGetValue(itemId, out var itemDef)) {
            return false;
        }

        if (itemDef.Stackable == true) {
            var pref = FindPreferredStackableBagIndex(itemId);
            if (pref >= 0) {
                var existing = bagItems[pref];
                if (existing.Quantity < int.MaxValue) {
                    existing.Quantity += 1;
                    result.AddedToBag.Add(existing.Clone());
                    return true;
                }
            }
        }

        var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
        var newItem = new InventoryItemState(
            itemId,
            CreateItemUid(),
            bagX,
            bagY,
            quantity: 1,
            bagZIndex: bagItems.Count,
            effectOverrides: effectOverrides);
        newItem.EnsureCatalogDurability(itemDef);
        bagItems.Add(newItem);
        NormalizeBagZIndices();
        result.AddedToBag.Add(newItem.Clone());
        return true;
    }

    /// <summary>Moves a bag item to new UI coordinates when provided and always brings it to the front of the bag z-order.</summary>
    public bool TryMoveItemInBag(long itemUid, int? bagX, int? bagY, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var index = GetBagIndex(itemUid);
        if (index < 0) {
            return false;
        }

        var item = bagItems[index];
        if (bagX.HasValue) {
            item.BagX = bagX.Value;
        }
        if (bagY.HasValue) {
            item.BagY = bagY.Value;
        }
        bagItems.RemoveAt(index);
        bagItems.Add(item);
        NormalizeBagZIndices();
        result.MovedInBag.Add(item.Clone());
        return true;
    }

    /// <summary>Equips a bag item into its target slot, unequipping blockers and slot conflicts back into the bag.</summary>
    /// <param name="playerGenderValue">0 = male, 1 = female; catalog rows with a gender restriction must match.</param>
    public bool TryEquipItem(long itemUid, string? requestedTargetSlot, int playerGenderValue, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex < 0) {
            return false;
        }

        var newItem = bagItems[bagIndex];
        if (!itemsById.TryGetValue(newItem.ItemId, out var itemDef)) {
            return false;
        }
        if (itemDef.Gender.HasValue && itemDef.Gender.Value != playerGenderValue) {
            return false;
        }
        if (string.Equals(itemDef.ItemType, MiscItemType, StringComparison.Ordinal)) {
            return false;
        }

        var itemType = itemDef.ItemType;
        // Reject weapon→ring/accessory/necklace (and any other type↔slot mismatch) before mutating state.
        if (!string.IsNullOrWhiteSpace(requestedTargetSlot) &&
            !IsItemTypeCompatibleWithSlot(itemType, requestedTargetSlot)) {
            return false;
        }

        var targetSlot = ResolveTargetSlot(itemType, requestedTargetSlot);
        if (!IsItemTypeCompatibleWithSlot(itemType, targetSlot)) {
            return false;
        }

        var blockedSlots = itemDef.BlockedItemSlots ?? Array.Empty<string>();

        var equippedSlotKeys = new List<string>(equippedItems.Keys);
        for (var i = 0; i < equippedSlotKeys.Count; i++) {
            var slot = equippedSlotKeys[i];
            var equipped = equippedItems[slot];
            if (!itemsById.TryGetValue(equipped.ItemId, out var equippedDef)) {
                continue;
            }
            if (!ContainsString(equippedDef.BlockedItemSlots, itemType)) {
                continue;
            }

            UnequipToBag(slot, result, emitUnequipped: true);
        }

        for (var i = 0; i < blockedSlots.Length; i++) {
            UnequipToBag(blockedSlots[i], result, emitUnequipped: true);
        }

        bagItems.RemoveAt(bagIndex);
        result.RemovedFromBagItemUids.Add(newItem.ItemUid);

        if (equippedItems.TryGetValue(targetSlot, out var previouslyEquipped)) {
            equippedItems.Remove(targetSlot);
            if (!previouslyEquipped.BagX.HasValue || !previouslyEquipped.BagY.HasValue) {
                var (px, py) = AllocateBagSlot(bagItems.Count);
                previouslyEquipped.BagX = px;
                previouslyEquipped.BagY = py;
            }
            bagItems.Add(previouslyEquipped);
            result.AddedToBag.Add(previouslyEquipped.Clone());
        }

        equippedItems[targetSlot] = newItem;
        NormalizeBagZIndices();
        result.Equipped.Add(new InventoryEquippedItemChange(targetSlot, newItem.Clone()));
        return true;
    }

    /// <summary>Moves one equipped item back into the bag, optionally overriding its remembered bag position.</summary>
    public bool TryUnequipItem(string slot, long itemUid, int? bagX, int? bagY, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        if (!equippedItems.TryGetValue(slot, out var equipped) || equipped.ItemUid != itemUid) {
            return false;
        }

        equippedItems.Remove(slot);
        if (bagX.HasValue) {
            equipped.BagX = bagX.Value;
        }
        if (bagY.HasValue) {
            equipped.BagY = bagY.Value;
        }
        if (!equipped.BagX.HasValue || !equipped.BagY.HasValue) {
            var (allocatedX, allocatedY) = AllocateBagSlot(bagItems.Count);
            equipped.BagX = allocatedX;
            equipped.BagY = allocatedY;
        }

        bagItems.Add(equipped);
        NormalizeBagZIndices();
        result.Unequipped.Add(new InventoryUnequippedItemChange(slot, equipped.ItemUid));
        result.AddedToBag.Add(equipped.Clone());
        return true;
    }

    /// <summary>Moves every equipped item whose catalog row is gender-locked and does not match <paramref name="playerGenderValue"/> back into the bag.</summary>
    /// <returns><see langword="true"/> when at least one slot was cleared.</returns>
    public bool TryUnequipAllGenderMismatchedEquipment(int playerGenderValue, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var slots = new List<string>();
        foreach (var entry in equippedItems) {
            if (!itemsById.TryGetValue(entry.Value.ItemId, out var def)) {
                continue;
            }
            if (!def.Gender.HasValue || def.Gender.Value == playerGenderValue) {
                continue;
            }
            slots.Add(entry.Key);
        }
        if (slots.Count == 0) {
            return false;
        }
        for (var i = 0; i < slots.Count; i++) {
            UnequipToBag(slots[i], result, emitUnequipped: true);
        }
        NormalizeBagZIndices();
        return true;
    }

    /// <summary>
    /// Moves every equipped item whose catalog <c>itemType</c> does not belong in its current slot back into the bag
    /// (for example a weapon persisted under <c>ring-left</c> / <c>accessory</c> / <c>necklace</c>).
    /// </summary>
    /// <returns><see langword="true"/> when at least one slot was cleared.</returns>
    public bool TryUnequipAllTypeMismatchedEquipment(out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var slots = new List<string>();
        foreach (var entry in equippedItems) {
            if (!itemsById.TryGetValue(entry.Value.ItemId, out var def)) {
                slots.Add(entry.Key);
                continue;
            }
            if (IsItemTypeCompatibleWithSlot(def.ItemType, entry.Key)) {
                continue;
            }
            slots.Add(entry.Key);
        }
        if (slots.Count == 0) {
            return false;
        }
        for (var i = 0; i < slots.Count; i++) {
            UnequipToBag(slots[i], result, emitUnequipped: true);
        }
        NormalizeBagZIndices();
        return true;
    }

    /// <summary>
    /// True when <paramref name="itemType"/> may occupy <paramref name="slot"/>:
    /// rings only in <c>ring-left</c>/<c>ring-right</c>; every other equippable type only in the slot named like the type.
    /// </summary>
    public static bool IsItemTypeCompatibleWithSlot(string itemType, string slot) {
        ArgumentException.ThrowIfNullOrWhiteSpace(itemType);
        ArgumentException.ThrowIfNullOrWhiteSpace(slot);
        if (string.Equals(itemType, MiscItemType, StringComparison.Ordinal)) {
            return false;
        }
        if (!ValidEquipmentSlots.Contains(slot)) {
            return false;
        }
        if (string.Equals(itemType, RingItemType, StringComparison.Ordinal)) {
            return string.Equals(slot, RingLeftSlot, StringComparison.Ordinal) ||
                   string.Equals(slot, RingRightSlot, StringComparison.Ordinal);
        }
        if (string.Equals(itemType, GemItemType, StringComparison.Ordinal)) {
            return string.Equals(slot, GemSlot, StringComparison.Ordinal);
        }
        return string.Equals(itemType, slot, StringComparison.Ordinal);
    }

    /// <summary>Consumes one bagged consumable item, decrementing a stack in place or removing the item entirely when it is exhausted.</summary>
    public bool TryConsumeItem(long itemUid, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex < 0) {
            return false;
        }

        var item = bagItems[bagIndex];
        if (!itemsById.TryGetValue(item.ItemId, out var itemDef)) {
            return false;
        }
        if (!string.Equals(itemDef.ItemType, MiscItemType, StringComparison.Ordinal) || itemDef.Consumable != true) {
            return false;
        }

        return TryRemoveOneFromBagAt(bagIndex, item, itemDef, out result);
    }

    /// <summary>
    /// Removes one unit of a bag item by uid regardless of <c>consumable</c> flag.
    /// Used for upgrade stones (Xelima/Merien/Integrity) which are misc but not potions.
    /// </summary>
    public bool TryRemoveOneBagItem(long itemUid, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex < 0) {
            return false;
        }

        var item = bagItems[bagIndex];
        if (!itemsById.TryGetValue(item.ItemId, out var itemDef)) {
            return false;
        }

        return TryRemoveOneFromBagAt(bagIndex, item, itemDef, out result);
    }

    bool TryRemoveOneFromBagAt(
            int bagIndex,
            InventoryItemState item,
            ItemConfig itemDef,
            out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        if (itemDef.Stackable == true && item.Quantity > 1) {
            item.Quantity -= 1;
            result.AddedToBag.Add(item.Clone());
            return true;
        }

        bagItems.RemoveAt(bagIndex);
        NormalizeBagZIndices();
        result.RemovedFromBagItemUids.Add(item.ItemUid);
        return true;
    }

    /// <summary>Removes one bag entry intact so it can be dropped to the ground as a single authoritative stack entry.</summary>
    public bool TryRemoveItemFromBagForGroundDrop(long itemUid, out InventoryItemState? droppedItem, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        droppedItem = null;
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex < 0) {
            return false;
        }

        var item = bagItems[bagIndex];
        // Soulbound never leaves the character bag (including floor).
        // Guildbound may be dropped for same-guild pickup (see GroundItemPickup).
        if (item.BindState == Helpers.ItemBind.BindStateSoulbound) {
            return false;
        }

        bagItems.RemoveAt(bagIndex);
        NormalizeBagZIndices();
        result.RemovedFromBagItemUids.Add(item.ItemUid);
        droppedItem = new InventoryItemState(
            item.ItemId,
            item.ItemUid,
            bagX: null,
            bagY: null,
            quantity: item.Quantity,
            bagZIndex: 0,
            effectOverrides: item.EffectOverrides,
            item.ItemAttribute,
            item.ItemColor,
            item.CurLifeSpan,
            item.MaxLifeSpan,
            item.BindState,
            item.BoundGuildId);
        return true;
    }

    /// <summary>Removes one full bag stack for William warehouse deposit (preserves uid, quantity, attributes).</summary>
    public bool TryExtractBagItemForWarehouse(long itemUid, out InventoryItemState? extracted, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        extracted = null;
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex < 0) {
            return false;
        }

        var item = bagItems[bagIndex];
        bagItems.RemoveAt(bagIndex);
        NormalizeBagZIndices();
        result.RemovedFromBagItemUids.Add(item.ItemUid);
        extracted = new InventoryItemState(
            item.ItemId,
            item.ItemUid,
            bagX: null,
            bagY: null,
            quantity: item.Quantity,
            bagZIndex: 0,
            effectOverrides: item.EffectOverrides,
            item.ItemAttribute,
            item.ItemColor,
            item.CurLifeSpan,
            item.MaxLifeSpan,
            item.BindState,
            item.BoundGuildId);
        return true;
    }

    /// <summary>Inserts a warehouse (or similar) stack back into the bag, merging stackables by catalog id when possible.</summary>
    public bool TryInsertWarehouseItemIntoBag(InventoryItemState warehouseItem, out InventoryMutationResult result) {
        ArgumentNullException.ThrowIfNull(warehouseItem);
        result = new InventoryMutationResult();
        if (!itemsById.TryGetValue(warehouseItem.ItemId, out var itemDef)) {
            return false;
        }

        if (itemDef.Stackable == true) {
            for (var i = 0; i < bagItems.Count; i++) {
                var existing = bagItems[i];
                if (existing.ItemId != warehouseItem.ItemId) {
                    continue;
                }

                if (existing.Quantity >= int.MaxValue) {
                    continue;
                }

                existing.Quantity = AddStackQuantitiesSaturating(existing.Quantity, warehouseItem.Quantity);
                result.AddedToBag.Add(existing.Clone());
                return true;
            }
        }

        var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
        var newItem = new InventoryItemState(
            warehouseItem.ItemId,
            warehouseItem.ItemUid,
            bagX,
            bagY,
            quantity: warehouseItem.Quantity,
            bagZIndex: bagItems.Count,
            effectOverrides: warehouseItem.EffectOverrides,
            warehouseItem.ItemAttribute,
            warehouseItem.ItemColor,
            warehouseItem.CurLifeSpan,
            warehouseItem.MaxLifeSpan);
        newItem.EnsureCatalogDurability(itemDef);
        bagItems.Add(newItem);
        NormalizeBagZIndices();
        result.AddedToBag.Add(newItem.Clone());
        return true;
    }

    /// <summary>Adds a ground item back into the bag, preserving quantity/effects and merging with existing stackable rows by item id.</summary>
    public bool TryAddGroundItemToBag(GroundItemState groundItem, out InventoryMutationResult result) {
        ArgumentNullException.ThrowIfNull(groundItem);
        result = new InventoryMutationResult();
        if (!itemsById.TryGetValue(groundItem.ItemId, out var itemDef)) {
            return false;
        }

        // Guard against corrupt ground rows (Quantity ≤ 0 would break bag/ground re-add).
        var quantity = groundItem.Quantity > 0 ? groundItem.Quantity : 1;

        if (itemDef.Stackable == true) {
            var pref = FindPreferredStackableBagIndex(groundItem.ItemId);
            if (pref >= 0) {
                var existing = bagItems[pref];
                if (existing.Quantity < int.MaxValue) {
                    existing.Quantity = AddStackQuantitiesSaturating(existing.Quantity, quantity);
                    // Keep existing bag cell (player may have moved gold).
                    result.AddedToBag.Add(existing.Clone());
                    return true;
                }
            }
        }

        // Never create a second bag row for the same instance uid (re-drop restore / desync).
        for (var i = 0; i < bagItems.Count; i++) {
            if (bagItems[i].ItemUid == groundItem.ItemUid) {
                result.AddedToBag.Add(bagItems[i].Clone());
                return true;
            }
        }

        var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
        var newItem = new InventoryItemState(
            groundItem.ItemId,
            groundItem.ItemUid,
            bagX,
            bagY,
            quantity: quantity,
            bagZIndex: bagItems.Count,
            effectOverrides: groundItem.EffectOverrides,
            groundItem.ItemAttribute,
            groundItem.ItemColor,
            groundItem.CurLifeSpan,
            groundItem.MaxLifeSpan,
            groundItem.BindState,
            groundItem.BoundGuildId);
        newItem.EnsureCatalogDurability(itemDef);
        bagItems.Add(newItem);
        NormalizeBagZIndices();
        result.AddedToBag.Add(newItem.Clone());
        return true;
    }

    /// <summary>Public item UID generator for arena loadout construction.</summary>
    public long CreateItemUidPublic() => CreateItemUid();

    /// <summary>Public bag slot allocator for arena loadout construction.</summary>
    public (int BagX, int BagY) AllocateBagSlotPublic(int index) => AllocateBagSlot(index);

    /// <summary>Replaces equipped + bag wholesale (Arena kit loadout).</summary>
    public void ReplaceEquippedAndBag(
        IReadOnlyDictionary<string, InventoryItemState> equipped,
        IReadOnlyList<InventoryItemState> bag) {
        ArgumentNullException.ThrowIfNull(equipped);
        ArgumentNullException.ThrowIfNull(bag);
        equippedItems.Clear();
        bagItems.Clear();
        foreach (var (slot, item) in equipped) {
            if (item is null || string.IsNullOrWhiteSpace(slot)) {
                continue;
            }
            equippedItems[slot] = item;
        }
        foreach (var item in bag) {
            if (item is null) {
                continue;
            }
            bagItems.Add(item);
        }
        NormalizeBagZIndices();
    }

    /// <summary>Replaces bag and equipment entirely with the standardized tournament arena loadout (equal footing for all entrants).</summary>
    public void ApplyTournamentLoadout(IReadOnlyList<int> equippedItemIds, IReadOnlyList<TournamentLoadoutBagEntry>? bagEntries) {
        ArgumentNullException.ThrowIfNull(equippedItemIds);
        equippedItems.Clear();
        bagItems.Clear();

        foreach (var itemId in equippedItemIds) {
            if (!itemsById.TryGetValue(itemId, out var itemDef)) {
                continue;
            }

            equippedItems[itemDef.ItemType] = new InventoryItemState(
                itemId,
                CreateItemUid(),
                bagX: null,
                bagY: null,
                quantity: 1,
                bagZIndex: 0,
                effectOverrides: null);
            equippedItems[itemDef.ItemType].EnsureCatalogDurability(itemDef);
        }

        if (bagEntries is not null) {
            foreach (var entry in bagEntries) {
                if (entry.Quantity < 1 || !itemsById.TryGetValue(entry.ItemId, out var bagDef)) {
                    continue;
                }

                var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
                var bagItem = new InventoryItemState(
                    entry.ItemId,
                    CreateItemUid(),
                    bagX,
                    bagY,
                    quantity: entry.Quantity,
                    bagZIndex: bagItems.Count,
                    effectOverrides: null);
                bagItem.EnsureCatalogDurability(bagDef);
                bagItems.Add(bagItem);
            }
        }

        NormalizeBagZIndices();
    }

    /// <summary>
    /// Replaces bag/equipment with a starter dagger (equipped) and seed gold for new traveler characters.
    /// Bare-hand Olympia damage is near-useless at low STR; equip dagger so first hits use Item.cfg dice.
    /// </summary>
    public void ApplyTravelerStarterLoadout() {
        equippedItems.Clear();
        bagItems.Clear();
        const int daggerItemId = 1;
        const int goldItemId = 90;
        const int starterGold = 5000;
        if (itemsById.TryGetValue(daggerItemId, out var daggerDef)) {
            var dagger = new InventoryItemState(
                daggerItemId,
                CreateItemUid(),
                bagX: null,
                bagY: null,
                quantity: 1,
                bagZIndex: 0,
                effectOverrides: null);
            dagger.EnsureCatalogDurability(daggerDef);
            equippedItems["weapon"] = dagger;
        }

        if (itemsById.TryGetValue(goldItemId, out _)) {
            var (goldX, goldY) = AllocateBagSlot(0);
            bagItems.Add(new InventoryItemState(
                goldItemId,
                CreateItemUid(),
                goldX,
                goldY,
                quantity: starterGold,
                bagZIndex: 0,
                effectOverrides: null));
        }
        NormalizeBagZIndices();
    }

    /// <summary>Removes <paramref name="amount"/> gold from bag stacks (item id 90). Fails without mutating when the player cannot afford it.</summary>
    public bool TrySpendGold(int amount, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        if (amount <= 0) {
            return true;
        }

        // Do NOT consolidate gold first — leave each pile in its bag cell; just spend from piles.
        const int goldItemId = 90;
        var goldTotal = CountGold();
        if (goldTotal < amount) {
            return false;
        }

        var remaining = amount;
        for (var i = bagItems.Count - 1; i >= 0 && remaining > 0; i--) {
            var item = bagItems[i];
            if (item.ItemId != goldItemId) {
                continue;
            }

            if (item.Quantity > remaining) {
                item.Quantity -= remaining;
                remaining = 0;
                result.AddedToBag.Add(item.Clone());
            } else {
                remaining -= item.Quantity;
                result.RemovedFromBagItemUids.Add(item.ItemUid);
                bagItems.RemoveAt(i);
            }
        }

        NormalizeBagZIndices();
        return remaining == 0;
    }

    /// <summary>Creates or stacks <paramref name="quantity"/> of a catalog item into the bag (shop buys / gold grants).</summary>
    public bool TryCreateItemStack(int itemId, int quantity, out InventoryMutationResult result) {
        result = new InventoryMutationResult();
        if (quantity <= 0 || !itemsById.TryGetValue(itemId, out var itemDef)) {
            return false;
        }

        if (itemDef.Stackable == true) {
            // Prefer last-moved stack (gold keeps the cell the player chose).
            var pref = FindPreferredStackableBagIndex(itemId);
            if (pref >= 0) {
                var existing = bagItems[pref];
                if (existing.Quantity > int.MaxValue - quantity) {
                    return false;
                }

                existing.Quantity += quantity;
                // Do not reassign BagX/BagY — respect player's placement.
                result.AddedToBag.Add(existing.Clone());
                return true;
            }

            var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
            var stacked = new InventoryItemState(
                itemId,
                CreateItemUid(),
                bagX,
                bagY,
                quantity,
                bagZIndex: bagItems.Count,
                effectOverrides: null);
            bagItems.Add(stacked);
            NormalizeBagZIndices();
            result.AddedToBag.Add(stacked.Clone());
            return true;
        }

        for (var n = 0; n < quantity; n++) {
            if (!TryCreateItem(itemId, effectOverrides: null, out var one)) {
                return result.AddedToBag.Count > 0;
            }

            result.AddedToBag.AddRange(one.AddedToBag);
            result.RemovedFromBagItemUids.AddRange(one.RemovedFromBagItemUids);
        }

        return true;
    }

    /// <summary>
    /// Classic Olympia bag pocket is ~148×120px; place unpositioned items on a simple grid so they do not stack at the center.
    /// </summary>
    private static (int bagX, int bagY) AllocateBagSlot(int index) {
        const int bagWidth = 148;
        const int bagHeight = 120;
        const int cell = 36;
        const int pad = 8;
        var cols = Math.Max(1, (bagWidth - pad * 2) / cell);
        var col = index % cols;
        var row = index / cols;
        var bagX = pad + cell / 2 + col * cell;
        var bagY = pad + cell / 2 + row * cell;
        if (bagY > bagHeight - pad) {
            bagY = bagHeight / 2;
            bagX = bagWidth / 2;
        }
        return (bagX, bagY);
    }

    private void SeedInitialLoadout() {
        for (var i = 0; i < InitialEquippedItemIds.Length; i++) {
            var itemId = InitialEquippedItemIds[i];
            if (!itemsById.TryGetValue(itemId, out var itemDef)) {
                continue;
            }

            var slot = itemDef.ItemType;
            var seeded = new InventoryItemState(
                itemId,
                CreateItemUid(),
                bagX: null,
                bagY: null,
                quantity: 1,
                bagZIndex: 0,
                effectOverrides: null);
            seeded.EnsureCatalogDurability(itemDef);
            equippedItems[slot] = seeded;
        }
    }

    /// <summary>Looks up a bag or equipped item by uid.</summary>
    public bool TryGetItemByUid(long itemUid, out InventoryItemState? item, out string? equippedSlot) {
        item = null;
        equippedSlot = null;
        var bagIndex = GetBagIndex(itemUid);
        if (bagIndex >= 0) {
            item = bagItems[bagIndex];
            return true;
        }

        foreach (var entry in equippedItems) {
            if (entry.Value.ItemUid != itemUid) {
                continue;
            }

            item = entry.Value;
            equippedSlot = entry.Key;
            return true;
        }

        return false;
    }

    /// <summary>
    /// Olympia <c>ArmorLifeDecrement</c>: subtracts <paramref name="amount"/> from durable body armor pieces
    /// (armor / hauberk / leggings / helmet). Unequips a piece when cur reaches 0.
    /// </summary>
    public bool TryApplyArmorLifeDecrement(int amount, out InventoryMutationResult result, out List<InventoryItemState> wornItems) {
        result = new InventoryMutationResult();
        wornItems = new List<InventoryItemState>(4);
        if (amount <= 0) {
            return false;
        }

        ReadOnlySpan<string> armorSlots = [ArmorSlot, HauberkSlot, LeggingsSlot, HelmetSlot];
        var changed = false;
        foreach (var slot in armorSlots) {
            if (!equippedItems.TryGetValue(slot, out var piece) || piece.MaxLifeSpan <= 1 || piece.CurLifeSpan <= 0) {
                continue;
            }

            piece.CurLifeSpan = Math.Max(0, piece.CurLifeSpan - amount);
            wornItems.Add(piece.Clone());
            changed = true;
            if (piece.CurLifeSpan == 0) {
                UnequipToBag(slot, result, emitUnequipped: true);
            }
        }

        return changed;
    }

    /// <summary>
    /// Decrements equipped weapon durability by 1 (Olympia fair-weather baseline). Returns true when lifespan changed.
    /// When cur reaches 0, unequips the weapon like Olympia <c>ITEMLIFESPANEND</c>.
    /// </summary>
    public bool TryApplyEquippedWeaponWear(out InventoryMutationResult result, out InventoryItemState? wornItem) {
        result = new InventoryMutationResult();
        wornItem = null;
        if (!equippedItems.TryGetValue("weapon", out var weapon) || weapon.MaxLifeSpan <= 1) {
            return false;
        }

        if (weapon.CurLifeSpan <= 0) {
            return false;
        }

        weapon.CurLifeSpan = Math.Max(0, weapon.CurLifeSpan - 1);
        wornItem = weapon.Clone();
        if (weapon.CurLifeSpan == 0) {
            UnequipToBag("weapon", result, emitUnequipped: true);
        }

        return true;
    }

    /// <summary>
    /// Merien Plate SA: set equipped weapon durability to 0 and unequip (Olympia destroy weapon on hit).
    /// </summary>
    public bool TryBreakEquippedWeaponDurability(out InventoryMutationResult result, out InventoryItemState? brokenItem) {
        result = new InventoryMutationResult();
        brokenItem = null;
        if (!equippedItems.TryGetValue("weapon", out var weapon) || weapon.MaxLifeSpan <= 0) {
            return false;
        }
        if (weapon.CurLifeSpan <= 0) {
            return false;
        }
        weapon.CurLifeSpan = 0;
        brokenItem = weapon.Clone();
        UnequipToBag("weapon", result, emitUnequipped: true);
        return true;
    }

    /// <summary>
    /// Olympia Tom repair quote: gear categories 1–10 (weapons, shields, armor, helms).
    /// Cost = half list price scaled by missing durability.
    /// Does not mutate gold or lifespan — caller spends gold then calls <see cref="ApplyRepairToFull"/>.
    /// </summary>
    public bool TryQuoteBlacksmithRepair(long itemUid, out int price, out InventoryItemState? item, out string error) {
        return TryQuoteRepairByCategory(
            itemUid,
            minCategory: 1,
            maxCategory: 10,
            vendorLabel: "Tom",
            requireListPrice: true,
            out price,
            out item,
            out error);
    }

    /// <summary>
    /// Shop Keeper ring repair (Emmy / Sapphire / Ruby and other cat-46 rings with durability).
    /// Same Olympia half-price formula; missing list price uses a durability-based floor.
    /// </summary>
    public bool TryQuoteShopRingRepair(long itemUid, out int price, out InventoryItemState? item, out string error) {
        price = 0;
        item = null;
        error = string.Empty;
        if (!TryGetItemByUid(itemUid, out item, out _) || item is null) {
            error = "Item not found.";
            return false;
        }

        if (!itemsById.TryGetValue(item.ItemId, out var def)) {
            error = "Unknown item.";
            return false;
        }

        var category = def.Category ?? 0;
        var isRing = string.Equals(def.ItemType, "ring", StringComparison.OrdinalIgnoreCase) || category == 46;
        if (!isRing) {
            error = "The shop only repairs rings. Talk to Tom for weapons and armor.";
            return false;
        }

        item.EnsureCatalogDurability(def);
        if (item.MaxLifeSpan <= 1) {
            error = "That ring cannot be repaired.";
            return false;
        }

        if (item.CurLifeSpan >= item.MaxLifeSpan) {
            error = "Already at full durability.";
            return false;
        }

        var listPrice = def.Price ?? 0;
        if (listPrice <= 0) {
            // Emmy / gem rings often have no shop list price — floor from max durability.
            listPrice = Math.Clamp(item.MaxLifeSpan / 5, 100, 2500);
        }

        price = ComputeOlympiaRepairPrice(listPrice, item.CurLifeSpan, item.MaxLifeSpan);
        return true;
    }

    bool TryQuoteRepairByCategory(
            long itemUid,
            int minCategory,
            int maxCategory,
            string vendorLabel,
            bool requireListPrice,
            out int price,
            out InventoryItemState? item,
            out string error) {
        price = 0;
        item = null;
        error = string.Empty;
        if (!TryGetItemByUid(itemUid, out item, out _) || item is null) {
            error = "Item not found.";
            return false;
        }

        if (!itemsById.TryGetValue(item.ItemId, out var def)) {
            error = "Unknown item.";
            return false;
        }

        var category = def.Category ?? 0;
        if (category < minCategory || category > maxCategory) {
            error = $"{vendorLabel} only repairs weapons, shields, and armor.";
            return false;
        }

        item.EnsureCatalogDurability(def);
        if (item.MaxLifeSpan <= 1) {
            error = "That item cannot be repaired.";
            return false;
        }

        if (item.CurLifeSpan >= item.MaxLifeSpan) {
            error = "Already at full durability.";
            return false;
        }

        var listPrice = def.Price ?? 0;
        if (listPrice <= 0) {
            if (requireListPrice) {
                error = "No repair price for that item.";
                return false;
            }
            listPrice = Math.Clamp(item.MaxLifeSpan / 5, 50, 2000);
        }

        price = ComputeOlympiaRepairPrice(listPrice, item.CurLifeSpan, item.MaxLifeSpan);
        return true;
    }

    /// <summary>Olympia: sPrice = (price/2) * (max-cur)/max when cur &gt; 0; half list when broken.</summary>
    static int ComputeOlympiaRepairPrice(int listPrice, int curLifeSpan, int maxLifeSpan) {
        double remain = curLifeSpan;
        double max = maxLifeSpan > 0 ? maxLifeSpan : 1.0;
        var price = curLifeSpan == 0
            ? listPrice / 2
            : (listPrice / 2) - (int)((remain / max) * 0.5 * listPrice);
        return price < 0 ? 0 : price;
    }

    /// <summary>Restores an item instance to full catalog durability after a successful Tom repair payment.</summary>
    public bool ApplyRepairToFull(long itemUid, out InventoryItemState? repaired) {
        repaired = null;
        if (!TryGetItemByUid(itemUid, out var item, out _) || item is null) {
            return false;
        }

        if (itemsById.TryGetValue(item.ItemId, out var def)) {
            item.EnsureCatalogDurability(def);
        }

        if (item.MaxLifeSpan <= 1) {
            return false;
        }

        item.CurLifeSpan = item.MaxLifeSpan;
        repaired = item.Clone();
        return true;
    }

    private void UnequipToBag(string slot, InventoryMutationResult result, bool emitUnequipped) {
        if (!equippedItems.TryGetValue(slot, out var equipped)) {
            return;
        }

        equippedItems.Remove(slot);
        if (!equipped.BagX.HasValue || !equipped.BagY.HasValue) {
            var (bagX, bagY) = AllocateBagSlot(bagItems.Count);
            equipped.BagX = bagX;
            equipped.BagY = bagY;
        }
        bagItems.Add(equipped);
        if (emitUnequipped) {
            result.Unequipped.Add(new InventoryUnequippedItemChange(slot, equipped.ItemUid));
        }
        result.AddedToBag.Add(equipped.Clone());
    }

    private static long CreateItemUid() {
        return BitConverter.ToInt64(Guid.NewGuid().ToByteArray(), 0);
    }

    private int GetBagIndex(long itemUid) {
        for (var i = 0; i < bagItems.Count; i++) {
            if (bagItems[i].ItemUid == itemUid) {
                return i;
            }
        }
        return -1;
    }

    /// <summary>
    /// Maps catalog item type to the equipment slot key. Non-rings always use the type name as the slot;
    /// rings resolve to an explicit left/right request or the first free ring slot.
    /// </summary>
    private string ResolveTargetSlot(string itemType, string? requestedTargetSlot) {
        if (!string.Equals(itemType, RingItemType, StringComparison.Ordinal)) {
            return itemType;
        }

        if (string.Equals(requestedTargetSlot, RingLeftSlot, StringComparison.Ordinal) ||
            string.Equals(requestedTargetSlot, RingRightSlot, StringComparison.Ordinal)) {
            return requestedTargetSlot!;
        }

        if (!equippedItems.ContainsKey(RingLeftSlot)) {
            return RingLeftSlot;
        }
        if (!equippedItems.ContainsKey(RingRightSlot)) {
            return RingRightSlot;
        }
        return RingLeftSlot;
    }

    private static bool ContainsString(string[]? values, string value) {
        if (values is null || values.Length == 0) {
            return false;
        }

        for (var i = 0; i < values.Length; i++) {
            if (string.Equals(values[i], value, StringComparison.Ordinal)) {
                return true;
            }
        }
        return false;
    }

    private void NormalizeBagZIndices() {
        for (var i = 0; i < bagItems.Count; i++) {
            bagItems[i].BagZIndex = i;
        }
    }
}
