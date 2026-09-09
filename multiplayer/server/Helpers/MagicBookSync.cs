using System.Collections.Generic;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// F7 Circle / Magic Tower book sync. The live traveler HUD reads Olympia Magic.cfg ids
/// (<c>learnedSpellIds</c>), not persist <c>SkillLevels[4]</c> and not a Gold scalar.
/// Formats the <c>gold=;learned=</c> summary the client already parses on
/// <c>CityNpcServiceResult</c> role <c>magic-shop</c>.
/// </summary>
public static class MagicBookSync {
    public const int GoldItemId = 90;
    public const int MagicSkillIndex = 4;

    /// <summary>Circle One shop ids: Magic Missile, Heal, Create Food.</summary>
    public static readonly int[] CircleOneOlympiaIds = [0, 1, 2];

    /// <summary>Client Magic Tower ACK payload: bag gold + Olympia ids (not Spells.json ids).</summary>
    public static string FormatCityServicesSummary(int goldBalance, IReadOnlyCollection<int> learnedOlympiaIds) {
        var gold = Math.Max(0, goldBalance);
        var learnedCsv = FormatLearnedCsv(learnedOlympiaIds);
        return $"gold={gold};learned={learnedCsv}";
    }

    /// <summary>Stable CSV of non-negative Olympia Magic.cfg ids.</summary>
    public static string FormatLearnedCsv(IReadOnlyCollection<int>? learnedOlympiaIds) {
        if (learnedOlympiaIds is null || learnedOlympiaIds.Count == 0) {
            return "";
        }

        var set = new SortedSet<int>();
        foreach (var id in learnedOlympiaIds) {
            if (id >= 0) {
                set.Add(id);
            }
        }

        return set.Count == 0 ? "" : string.Join(',', set);
    }

    /// <summary>Sum of bag stacks with catalog id 90. Ignores a persist <c>Gold</c> scalar.</summary>
    public static int CountBagGold(IEnumerable<PersistedInventoryItem>? bagItems) {
        if (bagItems is null) {
            return 0;
        }

        var total = 0;
        foreach (var item in bagItems) {
            if (item.ItemId == GoldItemId) {
                total = AddSaturating(total, Math.Max(0, item.Quantity));
            }
        }

        return total;
    }

    /// <summary>
    /// Union Magic Tower ids and keep bag gold / Magic skill when PreferFresher picks the
    /// other dual-write store (ops grants on JSON while Postgres has higher XP, or vice versa).
    /// </summary>
    public static PlayerPersistenceState MergeGrantFields(
        PlayerPersistenceState preferred,
        PlayerPersistenceState other) {
        ArgumentNullException.ThrowIfNull(preferred);
        ArgumentNullException.ThrowIfNull(other);

        var learned = new SortedSet<int>();
        AddLearned(learned, preferred.LearnedOlympiaSpellIds);
        AddLearned(learned, other.LearnedOlympiaSpellIds);
        var nextLearned = learned.Count == 0 ? null : learned.ToArray();

        var goldScalar = Math.Max(Math.Max(0, preferred.Gold), Math.Max(0, other.Gold));
        var bag = preferred.BagItems;
        if (CountBagGold(preferred.BagItems) == 0 && CountBagGold(other.BagItems) > 0) {
            bag = ConcatGoldStacks(preferred.BagItems, other.BagItems);
        }

        var skills = MergeSkillMax(preferred.SkillLevels, other.SkillLevels);

        return preferred with {
            LearnedOlympiaSpellIds = nextLearned,
            Gold = goldScalar,
            BagItems = bag,
            SkillLevels = skills,
        };
    }

    static void AddLearned(SortedSet<int> dest, int[]? ids) {
        if (ids is null) {
            return;
        }

        foreach (var id in ids) {
            if (id >= 0) {
                dest.Add(id);
            }
        }
    }

    static PersistedInventoryItem[] ConcatGoldStacks(
        PersistedInventoryItem[]? preferred,
        PersistedInventoryItem[]? other) {
        var list = new List<PersistedInventoryItem>();
        if (preferred is not null) {
            list.AddRange(preferred);
        }

        if (other is not null) {
            foreach (var row in other) {
                if (row.ItemId == GoldItemId && row.Quantity > 0) {
                    list.Add(row);
                }
            }
        }

        return list.ToArray();
    }

    static int[]? MergeSkillMax(int[]? a, int[]? b) {
        if (a is null && b is null) {
            return null;
        }

        var len = Math.Max(a?.Length ?? 0, b?.Length ?? 0);
        if (len == 0) {
            return null;
        }

        var next = new int[len];
        for (var i = 0; i < len; i++) {
            var av = a is not null && i < a.Length ? a[i] : 0;
            var bv = b is not null && i < b.Length ? b[i] : 0;
            next[i] = Math.Max(av, bv);
        }

        return next;
    }

    static int AddSaturating(int a, int b) {
        var sum = (long)a + b;
        return sum > int.MaxValue ? int.MaxValue : (int)sum;
    }
}
