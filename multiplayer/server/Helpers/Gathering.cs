using System.Collections.Generic;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Fishing + Mining gather rolls. Rare loot (stones / zems / mid rings / MS shield / Flam+3)
/// requires skill mastery 100% and is intentionally rare.
/// </summary>
public static class Gathering {
    public const int FishingRodItemId = 105;
    public const int StoneOfXelimaId = 656;
    public const int StoneOfMerienId = 657;
    public const int ZemstoneId = 650;
    public const int EmeraldRingId = 335;
    public const int RubyRingId = 337;
    public const int MerienShieldId = 620;
    public const int FlamebergePlus3Id = 290;

    // PA secondary type 8, value 3 → display ~9% (Olympia ×3); CL cap ~10% PA rings.
    public static readonly uint PaRingAttr5 = EncodeSecondaryPa(2);  // ~6% display as “PA5-ish mid”
    public static readonly uint PaRingAttr10 = EncodeSecondaryPa(3); // ~9% ≈ top mid PA ring

    static readonly TimeSpan GatherCooldown = TimeSpan.FromSeconds(2.5);

    /// <summary>Fish difficulty / weight table (higher weight = more common).</summary>
    static readonly (int ItemId, int Weight, int MinSkill)[] FishTable = [
        (100, 40, 0),   // Fish
        (103, 22, 5),   // Yellow Fish
        (102, 14, 15),  // Green Fish
        (101, 10, 25),  // Red Fish
        (575, 6, 35),   // Salmon
        (573, 8, 20),   // Crucian Carp
        (570, 5, 40),   // Red Carp
        (571, 3, 55),   // Green Carp (2nd hardest)
        (572, 1, 70),   // Gold Carp (hardest)
    ];

    static readonly (int ItemId, int Weight)[] CommonOreTable = [
        (354, 50), // Gold Nugget if present — fallback coal-ish
        (90, 30),  // Gold (small)
        (100, 0),  // placeholder replaced below
    ];

    // Prefer real ore ids if present; coal crystal are map flavor.
    const int CoalItemId = 354; // Gold Nugget as common “ore” stand-in when no coal id
    const int CrystalItemId = 705; // SangAhJewel as crystal-ish if present — check below

    public static void TryFish(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);

        if (!HasItemInBagOrEquipped(player, FishingRodItemId)) {
            Skills.SendGatherResult(player, false, "Need a Fishing Rod equipped or in bag.", Skills.Fishing, player.GetSkillLevel(Skills.Fishing), 0, "", false);
            return;
        }
        if (!IsNearWater(wr, player)) {
            Skills.SendGatherResult(player, false, "Stand next to water to fish.", Skills.Fishing, player.GetSkillLevel(Skills.Fishing), 0, "", false);
            return;
        }
        if (!player.TryBeginGather(GatherCooldown)) {
            Skills.SendGatherResult(player, false, "Still casting…", Skills.Fishing, player.GetSkillLevel(Skills.Fishing), 0, "", false);
            return;
        }

        var skill = player.GetSkillLevel(Skills.Fishing);
        // Success chance: 35% + skill*0.55 (cap ~90%)
        var successChance = Math.Min(90, 35 + (int)(skill * 0.55));
        if (Random.Shared.Next(1, 101) > successChance) {
            var lvl = Skills.GrantSkillXp(player, Skills.Fishing, 1);
            Skills.SendGatherResult(player, false, "The fish got away.", Skills.Fishing, lvl, 0, "", false);
            return;
        }

        // Rare loot only at 100% fishing.
        if (skill >= Skills.MaxLevel && Random.Shared.Next(1, 1001) <= 8) {
            var rare = RollFishingRareLoot();
            if (TryGrantItem(wr, player, rare.ItemId, rare.Attr, out var rareName)) {
                var lvl = Skills.GrantSkillXp(player, Skills.Fishing, 1);
                Skills.SendGatherResult(player, true, $"Rare catch! {rareName}", Skills.Fishing, lvl, rare.ItemId, rareName, true);
                Console.WriteLine($"[Gathering] {player.CharacterName} FISH RARE {rareName} (skill {lvl}).");
                return;
            }
        }

        var fishId = RollFish(skill);
        if (!TryGrantItem(wr, player, fishId, attr: 0, out var fishName)) {
            Skills.SendGatherResult(player, false, "Bag full — could not take the catch.", Skills.Fishing, skill, 0, "", false);
            return;
        }
        var newLvl = Skills.GrantSkillXp(player, Skills.Fishing, Random.Shared.Next(1, 3));
        Skills.SendGatherResult(player, true, $"Caught {fishName}.", Skills.Fishing, newLvl, fishId, fishName, false);
    }

    public static void TryMine(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(player);

        if (!FindNearestMiningNode(wr, player, out var nodeKind, out var dist) || dist > 2) {
            Skills.SendGatherResult(player, false, "Stand next to a mining node (coal/crystal).", Skills.Mining, player.GetSkillLevel(Skills.Mining), 0, "", false);
            return;
        }
        if (!player.TryBeginGather(GatherCooldown)) {
            Skills.SendGatherResult(player, false, "Still mining…", Skills.Mining, player.GetSkillLevel(Skills.Mining), 0, "", false);
            return;
        }

        var skill = player.GetSkillLevel(Skills.Mining);
        var successChance = Math.Min(92, 40 + (int)(skill * 0.5));
        if (Random.Shared.Next(1, 101) > successChance) {
            var lvl = Skills.GrantSkillXp(player, Skills.Mining, 1);
            Skills.SendGatherResult(player, false, "The vein yields nothing.", Skills.Mining, lvl, 0, "", false);
            return;
        }

        // 100% mining: rare stones / zems (low rate).
        if (skill >= Skills.MaxLevel && Random.Shared.Next(1, 1001) <= 12) {
            var rareId = RollMiningRareLoot();
            if (TryGrantItem(wr, player, rareId, 0, out var rareName)) {
                var lvl = Skills.GrantSkillXp(player, Skills.Mining, 1);
                Skills.SendGatherResult(player, true, $"Rare ore! {rareName}", Skills.Mining, lvl, rareId, rareName, true);
                Console.WriteLine($"[Gathering] {player.CharacterName} MINE RARE {rareName} (skill {lvl}).");
                return;
            }
        }

        // Common: gold nugget / gold; crystal nodes slightly better gold chance.
        var commonId = nodeKind == 1 && Random.Shared.Next(1, 101) <= 35
            ? 90 // gold
            : (wr.ItemsById.ContainsKey(CoalItemId) ? CoalItemId : 90);
        if (!TryGrantItem(wr, player, commonId, 0, out var commonName)) {
            Skills.SendGatherResult(player, false, "Bag full — could not take the ore.", Skills.Mining, skill, 0, "", false);
            return;
        }
        var newLvl = Skills.GrantSkillXp(player, Skills.Mining, Random.Shared.Next(1, 3));
        Skills.SendGatherResult(player, true, $"Mined {commonName}.", Skills.Mining, newLvl, commonId, commonName, false);
    }

    static int RollFish(int skill) {
        var pool = new List<(int Id, int W)>();
        foreach (var (id, w, min) in FishTable) {
            if (skill >= min) {
                pool.Add((id, w));
            }
        }
        if (pool.Count == 0) {
            return 100;
        }
        var total = 0;
        foreach (var p in pool) {
            total += p.W;
        }
        var roll = Random.Shared.Next(0, total);
        foreach (var p in pool) {
            roll -= p.W;
            if (roll < 0) {
                return p.Id;
            }
        }
        return pool[^1].Id;
    }

    static (int ItemId, uint Attr) RollFishingRareLoot() {
        // Weights among rare tier only (already gated by 100% + 0.8%).
        var roll = Random.Shared.Next(1, 101);
        if (roll <= 22) {
            return (StoneOfXelimaId, 0);
        }
        if (roll <= 44) {
            return (StoneOfMerienId, 0);
        }
        if (roll <= 62) {
            return (ZemstoneId, 0);
        }
        if (roll <= 74) {
            return (RubyRingId, PaRingAttr5);
        }
        if (roll <= 84) {
            return (EmeraldRingId, PaRingAttr10);
        }
        if (roll <= 92) {
            return (RubyRingId, 0); // plain mid ring
        }
        if (roll <= 97) {
            return (MerienShieldId, 0);
        }
        return (FlamebergePlus3Id, 0);
    }

    static int RollMiningRareLoot() {
        var roll = Random.Shared.Next(1, 101);
        if (roll <= 38) {
            return StoneOfXelimaId;
        }
        if (roll <= 76) {
            return StoneOfMerienId;
        }
        return ZemstoneId;
    }

    static uint EncodeSecondaryPa(uint value) {
        // secondary type 8 (PA) in bits 12–15, value in bits 8–11.
        return (8u << 12) | ((value & 0xFu) << 8);
    }

    static bool TryGrantItem(GameWorldRef wr, GameWorldPlayer player, int itemId, uint attr, out string name) {
        name = wr.ItemsById.TryGetValue(itemId, out var def) ? def.Name : $"Item#{itemId}";
        if (!wr.ItemsById.ContainsKey(itemId)) {
            return false;
        }
        // Create then stamp attribute if needed.
        if (!player.InventoryManager.TryCreateItem(itemId, effectOverrides: null, out var mut)) {
            return false;
        }
        Inventory.ApplyInventoryMutation(wr, player, mut);
        if (attr != 0) {
            // Find newest matching bag item and set attribute.
            InventoryItemState? target = null;
            foreach (var bag in player.InventoryManager.BagItems) {
                if (bag.ItemId == itemId) {
                    target = bag;
                }
            }
            if (target is not null) {
                target.ItemAttribute = attr;
            }
        }
        return true;
    }

    static bool HasItemInBagOrEquipped(GameWorldPlayer player, int itemId) {
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemId == itemId) {
                return true;
            }
        }
        foreach (var eq in player.InventoryManager.EquippedItems.Values) {
            if (eq.ItemId == itemId) {
                return true;
            }
        }
        return false;
    }

    static bool IsNearWater(GameWorldRef wr, GameWorldPlayer player) {
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                if (wr.OccupancyTracker.IsWetCell(player.PosX + dx, player.PosY + dy)) {
                    return true;
                }
            }
        }
        return false;
    }

    static bool FindNearestMiningNode(GameWorldRef wr, GameWorldPlayer player, out int kind, out int dist) {
        kind = 0;
        dist = int.MaxValue;
        var nodes = wr.World.MiningNodes;
        if (nodes.Count == 0) {
            return false;
        }
        var best = int.MaxValue;
        var bestKind = 0;
        foreach (var n in nodes) {
            var d = Math.Max(Math.Abs(player.PosX - n.X), Math.Abs(player.PosY - n.Y));
            if (d < best) {
                best = d;
                bestKind = n.Kind;
            }
        }
        if (best == int.MaxValue) {
            return false;
        }
        kind = bestKind;
        dist = best;
        return true;
    }
}
