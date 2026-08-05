using Server.Utils;
using Server.World;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Rolls configured monster death loot and places accepted drops on the corpse cell (or nearby cells for multi-drop).
/// <para>
/// <b>Normal / elite single-drop (Hellclaw, Tigerworm, Demon, …)</b> — Olympia NpcDeadItemGenerator style:
/// at most <b>one primary</b> (gold / pot / stone / clothes / weapon) + optionally <b>one rare/legendary</b>
/// path item. Secondary/rare rolls are intentionally rare.
/// </para>
/// <para>
/// <b>Multi-drop bosses (Wyvern family, Abaddon, Middleland dragons)</b> — independent multi-item rolls
/// (Olympia <c>bGetMultipleItemNamesWhenDeleteNpc</c>), scattered on adjacent walkable cells.
/// </para>
/// </summary>
public static class MonsterLoot {
    /// <summary>Catalog ids with Olympia multi-item corpse spreads (NOT Hellclaw/Tigerworm).</summary>
    static readonly HashSet<int> MultiDropMonsterIds = [
        5, // Barlog "Dragon" (ML / farms)
        43, 44, 45, // Fire Wyvern, Wyvern (ice), Ugly Wyvern
        62, 64, // Abaddon catalog ids
        110, 111, 112, 113, 114, // Middleland color dragons
    ];

    /// <summary>
    /// Multi-drop bosses bake Olympia rating-0 chances (~sum 0.35 → ~70% empty corpses).
    /// Scale so boss corpses feel rich without re-authoring every loot row.
    /// </summary>
    const double MultiDropChanceScale = 5.0;
    const double MultiDropGoldMinChance = 0.98;

    /// <summary>
    /// Single-primary elites (Hellclaw / Tigerworm): primary drop chance floor so corpses are not barren,
    /// without multi-item spam.
    /// </summary>
    static readonly HashSet<int> SinglePrimaryEliteIds = [33, 55]; // Hellclaw, Tigerworm

    /// <summary>Primary path weight boost for single-primary elites (gold/pots/gear/stones).</summary>
    const double SinglePrimaryChanceScale = 2.2;

    /// <summary>Rare path scale for single-primary elites (kept low — secondary should be uncommon).</summary>
    const double SinglePrimaryRareChanceScale = 0.55;

    // Chebyshev ring for multi-drop scatter around the corpse.
    static readonly (int Dx, int Dy)[] ScatterOffsets = [
        (0, 0),
        (1, 0), (-1, 0), (0, 1), (0, -1),
        (1, 1), (1, -1), (-1, 1), (-1, -1),
        (2, 0), (-2, 0), (0, 2), (0, -2),
        (2, 1), (2, -1), (-2, 1), (-2, -1),
        (1, 2), (1, -2), (-1, 2), (-1, -2),
    ];

    /// <summary>
    /// Olympia secondary-drop gate uses character Helbreath reputation (<c>m_iRating</c>), not PvP Elo.
    /// No character-rating column exists yet — always returns false so baked rating-0 chances apply.
    /// </summary>
    public static bool TryGetKillerHelbreathRating(out int rating) {
        rating = 0;
        return false;
    }

    /// <summary>
    /// Olympia formula: <c>SecondaryDropRate - clamp(rating * RepDropModifier, ±1000)</c>.
    /// </summary>
    public static int ResolveSecondaryDropThreshold(int secondaryDropRate, int repDropModifier) {
        if (!TryGetKillerHelbreathRating(out var rating) || rating == 0 || repDropModifier == 0) {
            return secondaryDropRate;
        }

        var adjustment = rating * repDropModifier;
        if (adjustment > 1000) {
            adjustment = 1000;
        } else if (adjustment < -1000) {
            adjustment = -1000;
        }

        return secondaryDropRate - adjustment;
    }

    public static void TryDropLootOnDeath(GameWorldRef wr, GameWorldMonster monster, GameWorldPlayer? killer = null) {
        ArgumentNullException.ThrowIfNull(monster);

        if (!wr.MonstersById.TryGetValue(monster.CatalogMonsterId, out var catalogEntry) ||
            catalogEntry.Loot is not { Length: > 0 } lootTable) {
            return;
        }

        var genLevel = catalogEntry.GenLevel ?? 5;
        var allowMultiDrop = AllowsMultiItemDrop(catalogEntry);
        var singlePrimaryElite = IsSinglePrimaryElite(catalogEntry);

        var dropMult = 1.0;
        if (killer is not null && !killer.Disconnected) {
            var snap = MobSpecialty.Compute(killer, monster.CatalogMonsterId);
            if (snap.DropRatePct > 0) {
                dropMult = 1.0 + Math.Min(200.0, snap.DropRatePct) / 100.0;
            }
        }

        if (allowMultiDrop) {
            DropMultiItemLoot(wr, monster, catalogEntry, lootTable, genLevel, dropMult, killer);
            TryDropSiphonLoot(wr, monster, catalogEntry, genLevel, dropMult, killer, multiBoss: true);
            return;
        }

        DropSinglePrimaryLoot(wr, monster, lootTable, genLevel, dropMult, singlePrimaryElite, killer);
        TryDropSiphonLoot(wr, monster, catalogEntry, genLevel, dropMult, killer, multiBoss: false);
    }

    /// <summary>
    /// Chain Lords HP/MP Vamping (gems 1200/1201 + residues 1202/1203) — not in classic Olympia loot tables.
    /// Inject on mid/high gen mobs and elites so residues/gems actually appear in the world.
    /// </summary>
    static void TryDropSiphonLoot(
            GameWorldRef wr,
            GameWorldMonster monster,
            MonsterConfig catalogEntry,
            int genLevel,
            double dropMult,
            GameWorldPlayer? killer,
            bool multiBoss) {
        // Low-level trash: no siphon drops.
        if (genLevel < 5 && !multiBoss && !IsSinglePrimaryElite(catalogEntry)) {
            return;
        }

        var elite = multiBoss || IsSinglePrimaryElite(catalogEntry) || genLevel >= 8;
        // Residues: common upgrade material for siphon gems.
        var residueChance = elite ? 0.12 : (genLevel >= 6 ? 0.06 : 0.03);
        // Full gems: rare — mostly bosses / Hellclaw / TW / high gen.
        var gemChance = multiBoss ? 0.04 : (IsSinglePrimaryElite(catalogEntry) ? 0.025 : (genLevel >= 8 ? 0.01 : 0.0));

        residueChance = Math.Min(0.35, residueChance * dropMult);
        gemChance = Math.Min(0.12, gemChance * dropMult);

        // 50/50 HP vs Mana for each independent roll.
        if (residueChance > 0 && Random.Shared.NextDouble() < residueChance) {
            var residueId = Random.Shared.Next(2) == 0
                ? SiphonGems.HpSiphonResidueItemId
                : SiphonGems.ManaSiphonResidueItemId;
            SpawnSiphonItem(wr, monster, residueId, killer, scatterIndex: 2);
        }

        if (gemChance > 0 && Random.Shared.NextDouble() < gemChance) {
            var gemId = Random.Shared.Next(2) == 0
                ? SiphonGems.HpSiphonGemItemId
                : SiphonGems.ManaSiphonGemItemId;
            SpawnSiphonItem(wr, monster, gemId, killer, scatterIndex: 3);
        }
    }

    static void SpawnSiphonItem(
            GameWorldRef wr,
            GameWorldMonster monster,
            int itemId,
            GameWorldPlayer? killer,
            int scatterIndex) {
        if (!wr.ItemsById.TryGetValue(itemId, out var itemConfig)) {
            return;
        }
        var synthetic = new MonsterLootEntry(itemId, Chance: 1.0, MinQuantity: 1, MaxQuantity: 1);
        SpawnLootEntry(wr, monster, itemConfig, synthetic, genLevel: 5, killer, scatterIndex);
    }

    /// <summary>
    /// Non-multi loot:
    /// <list type="bullet">
    /// <item>Hellclaw / Tigerworm — at most one primary (gold|pot|stone|gear) + optional rare/legendary.</item>
    /// <item>Normal mobs — gold independent + at most one pot + one gear + one rare (Olympia caps).</item>
    /// </list>
    /// </summary>
    static void DropSinglePrimaryLoot(
            GameWorldRef wr,
            GameWorldMonster monster,
            MonsterLootEntry[] lootTable,
            int genLevel,
            double dropMult,
            bool singlePrimaryElite,
            GameWorldPlayer? killer) {
        if (singlePrimaryElite) {
            DropHellclawTigerwormLoot(wr, monster, lootTable, genLevel, dropMult, killer);
            return;
        }

        // Normal mobs: gold independent; pot / gear / rare each at most one (reservoir sampling).
        MonsterLootEntry? consumablePick = null;
        MonsterLootEntry? gearPick = null;
        MonsterLootEntry? rarePick = null;
        var consumableSuccessCount = 0;
        var gearSuccessCount = 0;
        var rareSuccessCount = 0;

        foreach (var lootEntry in lootTable) {
            var chance = Math.Min(1.0, lootEntry.Chance * dropMult);
            if (lootEntry.Chance <= 0 || Random.Shared.NextDouble() > chance) {
                continue;
            }
            if (!wr.ItemsById.TryGetValue(lootEntry.ItemId, out var itemConfig)) {
                Console.WriteLine(
                    $"[GameWorld:{wr.WorldId}] Monster loot references unknown item id {lootEntry.ItemId} for catalog monster {monster.CatalogMonsterId}.");
                continue;
            }

            // Gold always independent for normal trash mobs.
            if (lootEntry.ItemId == GroundItemPickup.GoldItemId) {
                SpawnLootEntry(wr, monster, itemConfig, lootEntry, genLevel, killer, scatterIndex: 0);
                continue;
            }

            if (IsRareOrLegendaryLootItem(itemConfig)) {
                rareSuccessCount++;
                if (Random.Shared.Next(rareSuccessCount) == 0) {
                    rarePick = lootEntry;
                }
            } else if (IsConsumableLootItem(itemConfig) || IsCraftingStone(lootEntry.ItemId)) {
                consumableSuccessCount++;
                if (Random.Shared.Next(consumableSuccessCount) == 0) {
                    consumablePick = lootEntry;
                }
            } else if (IsGearLootItem(itemConfig)) {
                gearSuccessCount++;
                if (Random.Shared.Next(gearSuccessCount) == 0) {
                    gearPick = lootEntry;
                }
            } else {
                // Misc materials that are not jewelry/rares → treat as consumable-bucket primary.
                consumableSuccessCount++;
                if (Random.Shared.Next(consumableSuccessCount) == 0) {
                    consumablePick = lootEntry;
                }
            }
        }

        if (consumablePick is { } potEntry &&
            wr.ItemsById.TryGetValue(potEntry.ItemId, out var potConfig)) {
            SpawnLootEntry(wr, monster, potConfig, potEntry, genLevel, killer, scatterIndex: 0);
        }
        if (gearPick is { } gearEntry &&
            wr.ItemsById.TryGetValue(gearEntry.ItemId, out var gearConfig)) {
            SpawnLootEntry(wr, monster, gearConfig, gearEntry, genLevel, killer, scatterIndex: 0);
        }
        if (rarePick is { } rareEntry &&
            wr.ItemsById.TryGetValue(rareEntry.ItemId, out var rareConfig)) {
            SpawnLootEntry(wr, monster, rareConfig, rareEntry, genLevel, killer, scatterIndex: 1);
        }
    }

    /// <summary>
    /// Hellclaw / Tigerworm: ONE primary among gold/pot/stone/clothes/weapon + rare path uncommon.
    /// </summary>
    static void DropHellclawTigerwormLoot(
            GameWorldRef wr,
            GameWorldMonster monster,
            MonsterLootEntry[] lootTable,
            int genLevel,
            double dropMult,
            GameWorldPlayer? killer) {
        MonsterLootEntry? primaryPick = null;
        MonsterLootEntry? rarePick = null;
        var primarySuccessCount = 0;
        var rareSuccessCount = 0;

        foreach (var lootEntry in lootTable) {
            if (lootEntry.Chance <= 0) {
                continue;
            }
            if (!wr.ItemsById.TryGetValue(lootEntry.ItemId, out var itemConfig)) {
                Console.WriteLine(
                    $"[GameWorld:{wr.WorldId}] Monster loot references unknown item id {lootEntry.ItemId} for catalog monster {monster.CatalogMonsterId}.");
                continue;
            }

            var isRare = IsRareOrLegendaryLootItem(itemConfig);
            var scale = isRare ? SinglePrimaryRareChanceScale : SinglePrimaryChanceScale;
            var chance = Math.Min(1.0, lootEntry.Chance * dropMult * scale);
            if (Random.Shared.NextDouble() > chance) {
                continue;
            }

            if (isRare) {
                rareSuccessCount++;
                if (Random.Shared.Next(rareSuccessCount) == 0) {
                    rarePick = lootEntry;
                }
            } else {
                primarySuccessCount++;
                if (Random.Shared.Next(primarySuccessCount) == 0) {
                    primaryPick = lootEntry;
                }
            }
        }

        if (primaryPick is { } pEntry &&
            wr.ItemsById.TryGetValue(pEntry.ItemId, out var pConfig)) {
            SpawnLootEntry(wr, monster, pConfig, pEntry, genLevel, killer, scatterIndex: 0);
        }

        if (rarePick is { } rEntry &&
            wr.ItemsById.TryGetValue(rEntry.ItemId, out var rConfig)) {
            SpawnLootEntry(wr, monster, rConfig, rEntry, genLevel, killer, scatterIndex: 1);
        }
    }

    /// <summary>
    /// Wyvern / Abaddon / color dragons: independent multi-item rolls, multi-cell scatter.
    /// </summary>
    static void DropMultiItemLoot(
            GameWorldRef wr,
            GameWorldMonster monster,
            MonsterConfig catalogEntry,
            MonsterLootEntry[] lootTable,
            int genLevel,
            double dropMult,
            GameWorldPlayer? killer) {
        var multiSpawned = 0;
        var scatterCursor = 0;

        foreach (var lootEntry in lootTable) {
            var chance = Math.Min(1.0, lootEntry.Chance * dropMult * MultiDropChanceScale);
            if (lootEntry.ItemId == GroundItemPickup.GoldItemId) {
                chance = Math.Max(chance, MultiDropGoldMinChance);
            }
            if (lootEntry.Chance <= 0 || Random.Shared.NextDouble() > chance) {
                continue;
            }
            if (!wr.ItemsById.TryGetValue(lootEntry.ItemId, out var itemConfig)) {
                Console.WriteLine(
                    $"[GameWorld:{wr.WorldId}] Monster loot references unknown item id {lootEntry.ItemId} for catalog monster {monster.CatalogMonsterId}.");
                continue;
            }

            SpawnLootEntry(wr, monster, itemConfig, lootEntry, genLevel, killer, scatterIndex: scatterCursor++);
            multiSpawned++;
        }

        if (multiSpawned == 0) {
            // Safety: multi-drop boss corpse never empty — force gold pile on corpse cell.
            if (wr.ItemsById.TryGetValue(GroundItemPickup.GoldItemId, out var goldCfg)) {
                var goldEntry = lootTable.FirstOrDefault(e => e.ItemId == GroundItemPickup.GoldItemId)
                    ?? new MonsterLootEntry(GroundItemPickup.GoldItemId, Chance: 1, MinQuantity: 500, MaxQuantity: 2500);
                ForceSpawnLootOnCorpse(wr, monster, goldCfg, goldEntry, genLevel, killer);
                multiSpawned = 1;
            }
        }

        // Always guarantee at least one visible drop for dragons/wyverns (players reported empty corpses).
        if (multiSpawned < 1) {
            Console.WriteLine(
                $"[MonsterLoot] Multi-drop boss {catalogEntry.Name} (id={catalogEntry.Id}) spawned 0 items at ({monster.PosX},{monster.PosY}) — ground tracker may be rejecting drops.");
        }
    }

    /// <summary>Spawn loot on the exact corpse cell (skip scatter dry-cell filters).</summary>
    static void ForceSpawnLootOnCorpse(
            GameWorldRef wr,
            GameWorldMonster monster,
            ItemConfig itemConfig,
            MonsterLootEntry lootEntry,
            int genLevel,
            GameWorldPlayer? killer) {
        var minQty = Math.Max(1, lootEntry.MinQuantity);
        var maxQty = Math.Max(minQty, lootEntry.MaxQuantity);
        var quantity = maxQty == minQty ? minQty : Random.Shared.Next(minQty, maxQty + 1);
        uint itemAttribute = 0;
        var itemColor = 0;
        if (OlympiaMagicRoll.ShouldRollMagic(itemConfig) && !IsPureRareDrop(itemConfig)) {
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
        droppedItem.EnsureCatalogDurability(itemConfig);
        ItemMagicAttribute.ApplyDropTimeEffects(droppedItem, itemConfig);
        ChargeWand.EnsureFullCharges(droppedItem, itemConfig);

        if (!wr.GroundStateTracker.TryAddDroppedItem(
                droppedItem,
                monster.PosX,
                monster.PosY,
                out var previousTopItem,
                out var addedItem) ||
            addedItem is null) {
            Console.WriteLine(
                $"[MonsterLoot] ForceSpawnLootOnCorpse failed for item {lootEntry.ItemId} at ({monster.PosX},{monster.PosY}) world={wr.WorldId}.");
            return;
        }

        GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, previousTopItem, addedItem);
    }

    /// <summary>
    /// True for Olympia multi-drop bosses (Wyvern family / Abaddon / color dragons).
    /// Hellclaw and Tigerworm are intentionally excluded (single primary + rare).
    /// </summary>
    public static bool AllowsMultiItemDrop(MonsterConfig catalogEntry) {
        ArgumentNullException.ThrowIfNull(catalogEntry);
        if (MultiDropMonsterIds.Contains(catalogEntry.Id)) {
            return true;
        }

        var name = catalogEntry.Name;
        if (name.Contains("Tigerworm", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Hellclaw", StringComparison.OrdinalIgnoreCase)) {
            return false;
        }

        // All dragons (incl. plain Barlog "Dragon") + wyvern / Abaddon multi-drop corpses.
        return name.Contains("Wyvern", StringComparison.OrdinalIgnoreCase) ||
               name.Contains("Abaddon", StringComparison.OrdinalIgnoreCase) ||
               name.Contains("Dragon", StringComparison.OrdinalIgnoreCase);
    }

    public static bool IsSinglePrimaryElite(MonsterConfig catalogEntry) {
        ArgumentNullException.ThrowIfNull(catalogEntry);
        if (SinglePrimaryEliteIds.Contains(catalogEntry.Id)) {
            return true;
        }

        var name = catalogEntry.Name;
        return name.Contains("Tigerworm", StringComparison.OrdinalIgnoreCase) ||
               name.Contains("Hellclaw", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Rare / secondary path: super-rares (legendaries), named rares (Giant BH, Blood, manuals…),
    /// necklaces/rings. Gold, pots, crafting stones, normal gear stay primary.
    /// </summary>
    static bool IsRareOrLegendaryLootItem(ItemConfig item) {
        if (NftDropEvaluator.IsSuperRareItemId(item.Id)) {
            return true;
        }

        // Named rare bases (Giant Battle Hammer, Medusa / Ice Elemental swords, manuals, …)
        if (NftDropEvaluator.EvaluateNftTier(item.Id, itemAttribute: 0, cicLevel: 0) == NftDropEvaluator.TierRare &&
            !IsCraftingStone(item.Id) &&
            item.Consumable != true) {
            // Stones are primary (user: gold/pot/stones/clothes/weapons = primary)
            // TierRare for stones returns rare in NFT log — override stones to primary.
            return true;
        }

        // Explicit rare weapons / manuals / MS22 charge wands / Berserk wands.
        if (item.Id is 762 or 843 or 853 or 857 or 382 or 861 or 862 or 1314 or 1315 or 1316) {
            return true;
        }

        // Jewelry (neck/ring) that is not a basic accessory — secondary path.
        var t = (item.ItemType ?? "").Trim().ToLowerInvariant();
        if (t is "necklace" or "ring") {
            return true;
        }

        return false;
    }

    static bool IsCraftingStone(int itemId) =>
        itemId is 650 or 656 or 657 or 507 or 1112;

    /// <summary>
    /// Named rare/legendary bases never receive Sharp/Ancient/HR/Exp magic rolls —
    /// they drop as pure catalog items (Olympia + product rule).
    /// </summary>
    static bool IsPureRareDrop(ItemConfig item) {
        if (NftDropEvaluator.IsSuperRareItemId(item.Id)) {
            return true;
        }
        // Named rares + charge wands + manuals + Giant BH / Barbarian
        if (item.Id is 762 or 843 or 853 or 857 or 382 or 861 or 862
            or 490 or 491 or 492 or 613 or 614 or 633 or 735 or 847
            or 1314 or 1315 or 1316
            or 1320 or 1321 or 1322) {
            return true;
        }
        if (NftDropEvaluator.EvaluateNftTier(item.Id, itemAttribute: 0, cicLevel: 0)
            is NftDropEvaluator.TierRare or NftDropEvaluator.TierSuperRare
            && !IsCraftingStone(item.Id)
            && item.Consumable != true) {
            return true;
        }
        return false;
    }

    /// <summary>
    /// Potions / food — used only for diagnostics; primary path is the non-rare bucket.
    /// </summary>
    static bool IsConsumableLootItem(ItemConfig item) {
        if (NftDropEvaluator.IsSuperRareItemId(item.Id)) {
            return false;
        }
        return item.Consumable == true;
    }

    /// <summary>
    /// Magic-rollable weapons/armor (Olympia primary gear path). Super-rares stay on rare path.
    /// </summary>
    static bool IsGearLootItem(ItemConfig item) {
        if (NftDropEvaluator.IsSuperRareItemId(item.Id)) {
            return false;
        }
        if (item.Consumable == true) {
            return false;
        }
        return OlympiaMagicRoll.ShouldRollMagic(item);
    }

    static void SpawnLootEntry(
            GameWorldRef wr,
            GameWorldMonster monster,
            ItemConfig itemConfig,
            MonsterLootEntry lootEntry,
            int genLevel,
            GameWorldPlayer? killer,
            int scatterIndex) {
        var minQty = Math.Max(1, lootEntry.MinQuantity);
        var maxQty = Math.Max(minQty, lootEntry.MaxQuantity);
        var quantity = maxQty == minQty ? minQty : Random.Shared.Next(minQty, maxQty + 1);

        // Olympia m_iAddGold: gold drop amount += amount * gearGold% / 100.
        if (lootEntry.ItemId == GroundItemPickup.GoldItemId && killer is not null && !killer.Disconnected) {
            var goldPct = PlayerDerivedStats.GetGearGoldBonusPercent(killer);
            if (goldPct > 0) {
                quantity += (int)(quantity * (goldPct / 100.0));
                if (quantity < 1) {
                    quantity = 1;
                }
            }
        }

        uint itemAttribute = 0;
        var itemColor = 0;
        // Olympia rares / legendaries drop PURE (no Sharp/HR/Exp dual magic). Only normal gear rolls SWE.
        if (OlympiaMagicRoll.ShouldRollMagic(itemConfig) && !IsPureRareDrop(itemConfig)) {
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
        droppedItem.EnsureCatalogDurability(itemConfig);
        // Endurance primary on armor/shield → real MaxLifeSpan boost (not "Damage+").
        ItemMagicAttribute.ApplyDropTimeEffects(droppedItem, itemConfig);
        // MS22 charge wands always drop full 200/200 charges.
        ChargeWand.EnsureFullCharges(droppedItem, itemConfig);

        PickScatterCell(wr, monster.PosX, monster.PosY, scatterIndex, out var dropX, out var dropY);

        if (!wr.GroundStateTracker.TryAddDroppedItem(
                droppedItem,
                dropX,
                dropY,
                out var previousTopItem,
                out var addedItem) ||
            addedItem is null) {
            // Fallback: corpse cell if scatter failed.
            if (dropX != monster.PosX || dropY != monster.PosY) {
                if (!wr.GroundStateTracker.TryAddDroppedItem(
                        droppedItem,
                        monster.PosX,
                        monster.PosY,
                        out previousTopItem,
                        out addedItem) ||
                    addedItem is null) {
                    return;
                }
            } else {
                return;
            }
        }

        GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, previousTopItem, addedItem);

        // Party ping for gear (not gold / pots / materials spam).
        if (killer is not null &&
            !killer.Disconnected &&
            IsGearLootItem(itemConfig)) {
            var label = string.IsNullOrWhiteSpace(itemConfig.Name) ? $"item #{lootEntry.ItemId}" : itemConfig.Name;
            Party.NotifyLootDrop(killer, label, quantity);
        }
    }

    /// <summary>
    /// Places multi-drop loot on corpse + ring of free cells so items are not all stacked.
    /// </summary>
    static void PickScatterCell(
            GameWorldRef wr,
            int originX,
            int originY,
            int scatterIndex,
            out int dropX,
            out int dropY) {
        dropX = originX;
        dropY = originY;
        if (scatterIndex <= 0 || ScatterOffsets.Length == 0) {
            return;
        }

        // Rotate through offsets so successive drops land on different free cells.
        var start = scatterIndex % ScatterOffsets.Length;
        for (var i = 0; i < ScatterOffsets.Length; i++) {
            var (dx, dy) = ScatterOffsets[(start + i) % ScatterOffsets.Length];
            if (dx == 0 && dy == 0) {
                continue; // corpse cell already default; try neighbors first for multi-drop scatter
            }
            var x = originX + dx;
            var y = originY + dy;
            if (wr.OccupancyTracker.IsFreeDryCell(x, y)) {
                dropX = x;
                dropY = y;
                return;
            }
        }
        // All neighbors busy/blocked → stack on corpse.
    }
}
