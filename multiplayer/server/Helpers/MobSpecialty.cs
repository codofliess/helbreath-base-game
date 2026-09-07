using System.Text.Json;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia mob specialty: kill progress is per <c>segment</c> group (not one exclusive ladder per
/// monster). Stake $HELBREATH (<see cref="GameWorldPlayer.StakedHell"/>) adds
/// <c>floor(staked / 20_000)</c> to <b>every</b> group. Additive:
/// <c>effective = groupKillLevel + stakeBonus</c>. Pending $HELL cash-shop credits do not count.
/// </summary>
public static class MobSpecialty {
    public const string StakeTokenTicker = "$HELBREATH";
    /// <summary>$HELBREATH per +1 effective level on every monster group (200k → +10; 240k → +12).</summary>
    public const long StakePerLevel = 20_000L;
    /// <summary>Legacy name for <see cref="StakePerLevel"/>.</summary>
    public const long StakePerTier = StakePerLevel;
    public const int LevelsPerStakeTier = 1;
    /// <summary>Fallback for unlisted species — mid-low farm band (common mobs need more kills).</summary>
    public const int DefaultBaseKills = 75;
    /// <summary>Olympia ladder continues well past L50 with stake; testing week allows high GM grants (L200).</summary>
    public const int MaxSpecialtyLevel = 200;

    static readonly object Gate = new();
    static Dictionary<int, SpecialtyDef> byMonsterId = new();
    static Dictionary<string, List<int>> monsterIdsBySegment = new(StringComparer.Ordinal);
    static bool loaded;

    public sealed class SpecialtyDef {
        public int MonsterId { get; init; }
        public int BaseKills { get; init; } = DefaultBaseKills;
        public string Segment { get; init; } = "";
        public string[] Bonuses { get; init; } = ["damage", "damage_reduction", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate"];
    }

    public readonly record struct SpecialtySnapshot(
        int SpecialtyLevel,
        int EffectiveLevel,
        int StakeBonusLevels,
        long NextKills,
        int FlatDamageBonus,
        int FlatDamageReduction,
        double DamagePctBonus,
        double DamageReductionPct,
        double DropRatePct,
        double HitRatioPct,
        string BonusSummary);

    public static void Initialize(string configDirectory) {
        lock (Gate) {
            byMonsterId = new Dictionary<int, SpecialtyDef>();
            monsterIdsBySegment = new Dictionary<string, List<int>>(StringComparer.Ordinal);
            var path = Path.Combine(configDirectory, "MobSpecialties.json");
            if (!File.Exists(path)) {
                Console.WriteLine("[MobSpecialty] MobSpecialties.json missing — using defaults (base 150).");
                loaded = true;
                return;
            }
            try {
                using var doc = JsonDocument.Parse(File.ReadAllText(path));
                foreach (var el in doc.RootElement.EnumerateArray()) {
                    // Skip doc / comment rows without a monster id.
                    if (!el.TryGetProperty("id", out var idEl) || idEl.ValueKind != JsonValueKind.Number) {
                        continue;
                    }
                    var id = idEl.GetInt32();
                    var baseKills = el.TryGetProperty("base_kills", out var bk) ? bk.GetInt32() : DefaultBaseKills;
                    var segment = el.TryGetProperty("segment", out var segEl) && segEl.ValueKind == JsonValueKind.String
                        ? (segEl.GetString() ?? "").Trim()
                        : "";
                    string[] bonuses = el.TryGetProperty("bonuses", out var bonEl) && bonEl.ValueKind == JsonValueKind.Array
                        ? [.. bonEl.EnumerateArray().Select(x => x.GetString() ?? "drop_rate")]
                        : ["damage", "damage_reduction", "drop_rate"];
                    byMonsterId[id] = new SpecialtyDef {
                        MonsterId = id,
                        BaseKills = Math.Max(1, baseKills),
                        Segment = segment,
                        Bonuses = bonuses.Length > 0 ? bonuses : ["damage", "damage_reduction", "drop_rate"],
                    };
                    if (segment.Length > 0) {
                        if (!monsterIdsBySegment.TryGetValue(segment, out var ids)) {
                            ids = [];
                            monsterIdsBySegment[segment] = ids;
                        }
                        ids.Add(id);
                    }
                }
                loaded = true;
                Console.WriteLine(
                    $"[MobSpecialty] Loaded {byMonsterId.Count} species / {monsterIdsBySegment.Count} groups; " +
                    $"stake {StakeTokenTicker} {StakePerLevel}/+1 all groups.");
            } catch (Exception ex) {
                Console.Error.WriteLine($"[MobSpecialty] Failed to load: {ex.Message}");
                loaded = true;
            }
        }
    }

    public static SpecialtyDef GetDef(int catalogMonsterId) {
        lock (Gate) {
            if (byMonsterId.TryGetValue(catalogMonsterId, out var def)) {
                return def;
            }
        }
        return new SpecialtyDef { MonsterId = catalogMonsterId, BaseKills = DefaultBaseKills };
    }

    public static int StakeBonusLevels(long stakedHelbreath) {
        if (stakedHelbreath <= 0) {
            return 0;
        }
        var levels = stakedHelbreath / StakePerLevel;
        if (levels > int.MaxValue) {
            return int.MaxValue;
        }
        return (int)levels;
    }

    /// <summary>effectiveLevel = killLevel + floor(stakedHelbreath / 20_000), capped at 2× max ladder.</summary>
    public static int EffectiveLevel(int killLevel, long stakedHelbreath) {
        var kill = Math.Max(0, killLevel);
        var bonus = StakeBonusLevels(stakedHelbreath);
        var sum = kill > int.MaxValue - bonus ? int.MaxValue : kill + bonus;
        return Math.Min(MaxSpecialtyLevel * 2, sum);
    }

    /// <summary>Segment group key (e.g. early). Unlisted catalog ids stay solo so they do not invent a pool.</summary>
    public static string GroupKeyFor(int catalogMonsterId) {
        var def = GetDef(catalogMonsterId);
        return string.IsNullOrEmpty(def.Segment) ? $"solo:{catalogMonsterId}" : def.Segment;
    }

    /// <summary>Sum of kills for every catalog id in the same Olympia segment group.</summary>
    public static long GroupKills(IReadOnlyDictionary<int, long>? kills, int catalogMonsterId) {
        if (kills is null || kills.Count == 0) {
            return 0;
        }
        var key = GroupKeyFor(catalogMonsterId);
        if (key.StartsWith("solo:", StringComparison.Ordinal)) {
            return kills.TryGetValue(catalogMonsterId, out var solo) ? solo : 0;
        }
        long sum = 0;
        lock (Gate) {
            if (!monsterIdsBySegment.TryGetValue(key, out var ids)) {
                return kills.TryGetValue(catalogMonsterId, out var fallback) ? fallback : 0;
            }
            foreach (var id in ids) {
                if (kills.TryGetValue(id, out var n) && n > 0) {
                    sum = SaturateAdd(sum, n);
                }
            }
        }
        return sum;
    }

    /// <summary>
    /// $HELBREATH staked on the character ledger (<see cref="GameWorldPlayer.StakedHell"/>).
    /// Pending $HELL mining credits are cash-shop currency and do not raise expertise.
    /// </summary>
    public static long ResolveStakeAmount(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return Math.Max(0, player.StakedHell);
    }

    /// <summary>Kills required to reach specialty level L (L&gt;=1). Uses base * L^2 (Olympia UI #315).</summary>
    public static long ThresholdForLevel(int baseKills, int level) {
        if (level <= 0) {
            return 0;
        }
        return (long)baseKills * level * level;
    }

    public static int SpecialtyLevelFromKills(long kills, int baseKills) {
        if (kills <= 0 || baseKills <= 0) {
            return 0;
        }
        var level = 0;
        for (var l = 1; l <= MaxSpecialtyLevel; l++) {
            if (kills >= ThresholdForLevel(baseKills, l)) {
                level = l;
            } else {
                break;
            }
        }
        return level;
    }

    public static long NextKillsForSpecialty(long kills, int baseKills) {
        var level = SpecialtyLevelFromKills(kills, baseKills);
        return ThresholdForLevel(baseKills, level + 1);
    }

    public static SpecialtySnapshot Compute(GameWorldPlayer player, int catalogMonsterId) {
        ArgumentNullException.ThrowIfNull(player);
        return ComputeFromKills(player.MonsterKills, catalogMonsterId, ResolveStakeAmount(player));
    }

    /// <summary>Test/UI helper: group kill level + $HELBREATH stake, same bonuses as live combat.</summary>
    public static SpecialtySnapshot ComputeFromKills(
        IReadOnlyDictionary<int, long>? kills,
        int catalogMonsterId,
        long stakedHelbreath) {
        var def = GetDef(catalogMonsterId);
        var groupKills = GroupKills(kills, catalogMonsterId);
        var specialty = SpecialtyLevelFromKills(groupKills, def.BaseKills);
        var stakeBonus = StakeBonusLevels(stakedHelbreath);
        var effective = EffectiveLevel(specialty, stakedHelbreath);
        var next = NextKillsForSpecialty(groupKills, def.BaseKills);
        AggregateBonuses(def, effective, out var flatDmg, out var flatRed, out var dmgPct, out var redPct, out var drop, out var hit);
        var summary = BuildSummary(flatDmg, flatRed, dmgPct, redPct, drop, hit);
        return new SpecialtySnapshot(specialty, effective, stakeBonus, next, flatDmg, flatRed, dmgPct, redPct, drop, hit, summary);
    }

    static long SaturateAdd(long a, long b) {
        if (b <= 0) {
            return a;
        }
        return a > long.MaxValue - b ? long.MaxValue : a + b;
    }

    /// <summary>
    /// Olympia bonus magnitudes (from UI #315 + types in specialties.json).
    /// damage / damage_reduction = flat 1 per step; drop_rate ≈ 2% diminishing; hit_ratio flat +2;
    /// damage_pct / damage_reduction_pct / hit_ratio_pct ≈ 2% each step.
    /// </summary>
    public static void AggregateBonuses(
        SpecialtyDef def,
        int effectiveLevel,
        out int flatDamage,
        out int flatReduction,
        out double damagePct,
        out double reductionPct,
        out double dropPct,
        out double hitPct) {
        flatDamage = 0;
        flatReduction = 0;
        damagePct = 0;
        reductionPct = 0;
        dropPct = 0;
        hitPct = 0;
        if (effectiveLevel <= 0 || def.Bonuses.Length == 0) {
            return;
        }

        var dropSteps = 0;
        for (var level = 1; level <= effectiveLevel; level++) {
            // bonuses[i] is the reward granted when reaching specialty level (i+1).
            // When effective > array length, keep cycling last half as drop_rate (Olympia continues drop).
            string bonus;
            if (level - 1 < def.Bonuses.Length) {
                bonus = def.Bonuses[level - 1];
            } else {
                bonus = "drop_rate";
            }

            switch (bonus) {
                case "damage":
                    flatDamage += 1;
                    break;
                case "damage_reduction":
                    flatReduction += 1;
                    break;
                case "damage_pct":
                    damagePct += 2.0;
                    break;
                case "damage_reduction_pct":
                    reductionPct += 2.0;
                    break;
                case "hit_ratio":
                    hitPct += 2.0;
                    break;
                case "hit_ratio_pct":
                    hitPct += 2.0;
                    break;
                case "drop_rate":
                default:
                    // First drop_rate step ~2.00%, then -0.04 each subsequent drop step (UI #315).
                    dropPct += Math.Max(0.5, 2.0 - 0.04 * dropSteps);
                    dropSteps++;
                    break;
            }
        }
    }

    static string BuildSummary(int flatDmg, int flatRed, double dmgPct, double redPct, double drop, double hit) {
        var parts = new List<string>();
        if (flatDmg > 0) {
            parts.Add($"+{flatDmg} dmg");
        }
        if (flatRed > 0) {
            parts.Add($"-{flatRed} taken");
        }
        if (dmgPct > 0) {
            parts.Add($"+{dmgPct:0.##}% dmg");
        }
        if (redPct > 0) {
            parts.Add($"-{redPct:0.##}% taken");
        }
        if (drop > 0) {
            parts.Add($"+{drop:0.##}% drop");
        }
        if (hit > 0) {
            parts.Add($"+{hit:0.##}% hit");
        }
        return parts.Count == 0 ? "—" : string.Join(", ", parts);
    }

    /// <summary>Outgoing damage vs a catalog species: flat +% then floor; min 1 if base was &gt;0.</summary>
    public static int ApplyOutgoingDamageBonus(GameWorldPlayer attacker, int catalogMonsterId, int baseDamage) {
        if (baseDamage <= 0) {
            return baseDamage;
        }
        var snap = Compute(attacker, catalogMonsterId);
        var dmg = baseDamage + snap.FlatDamageBonus;
        if (snap.DamagePctBonus > 0) {
            dmg = (int)Math.Round(dmg * (1.0 + snap.DamagePctBonus / 100.0));
        }
        return Math.Max(1, dmg);
    }

    /// <summary>Incoming monster damage reduction from specialty (flat then %).</summary>
    public static int ApplyIncomingDamageReduction(GameWorldPlayer defender, int catalogMonsterId, int baseDamage) {
        if (baseDamage <= 0) {
            return baseDamage;
        }
        var snap = Compute(defender, catalogMonsterId);
        var dmg = Math.Max(0, baseDamage - snap.FlatDamageReduction);
        if (snap.DamageReductionPct > 0 && dmg > 0) {
            dmg = (int)Math.Round(dmg * (1.0 - Math.Min(90.0, snap.DamageReductionPct) / 100.0));
        }
        return Math.Max(0, dmg);
    }

    /// <summary>Hit chance points from specialty hit_ratio / hit_ratio_pct steps.</summary>
    public static int HitChanceBonusPoints(GameWorldPlayer attacker, int catalogMonsterId) {
        var snap = Compute(attacker, catalogMonsterId);
        // HitRatioPct is stored as percentage points (e.g. 2, 4, 6).
        return (int)Math.Round(snap.HitRatioPct);
    }
}
