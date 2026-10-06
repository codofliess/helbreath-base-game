using System.Text.Json;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia mob specialty ladder (contents/specialties.json) + personal stake level offset.
/// Level from kills: max L with kills &gt;= base_kills * L^2.
/// Stake: +1 specialty level per 50_000 $HELL (5_000_000 → +100). Unstake / lower balance reverses.
/// Stake amount = max(character StakedHell, wallet mining PendingHell).
/// Every level raises every bonus a little; at <see cref="OlympiaParityLevel"/> the totals equal
/// what Olympia's step ladder gives at that level.
/// </summary>
public static class MobSpecialty {
    /// <summary>$HELL required per +1 effective specialty level (5M = +100).</summary>
    public const long StakePerTier = 50_000L;
    public const int LevelsPerStakeTier = 1;
    /// <summary>Level where our even curve lands exactly on Olympia's ladder totals (same dmg, hit, drop, reduction).</summary>
    public const int OlympiaParityLevel = 40;
    /// <summary>Fallback for unlisted species — mid-low farm band (common mobs need more kills).</summary>
    public const int DefaultBaseKills = 75;
    /// <summary>Olympia ladder continues well past L50 with stake; testing week allows high GM grants (L200).</summary>
    public const int MaxSpecialtyLevel = 200;

    static readonly object Gate = new();
    static Dictionary<int, SpecialtyDef> byMonsterId = new();
    static bool loaded;

    public sealed class SpecialtyDef {
        public int MonsterId { get; init; }
        public int BaseKills { get; init; } = DefaultBaseKills;
        public string Segment { get; init; } = "";
        public string Name { get; init; } = "";
        public string[] Bonuses { get; init; } = ["damage", "damage_reduction", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate"];
        internal LadderTotals? ParityTotals { get; set; }
    }

    /// <summary>Summed bonuses of Olympia's step ladder up to some level.</summary>
    public readonly record struct LadderTotals(
        double FlatDamage,
        double FlatReduction,
        double DamagePct,
        double ReductionPct,
        double DropPct,
        double HitPct);

    /// <summary>Kill-based specialty level of one monster group for the character cover.</summary>
    public readonly record struct CharacterGroupTier(string Segment, string Label, int Level, string LeadName);

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
                    var segment = el.TryGetProperty("segment", out var segEl) ? segEl.GetString() ?? "" : "";
                    var name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : "";
                    string[] bonuses = el.TryGetProperty("bonuses", out var bonEl) && bonEl.ValueKind == JsonValueKind.Array
                        ? [.. bonEl.EnumerateArray().Select(x => x.GetString() ?? "drop_rate")]
                        : ["damage", "damage_reduction", "drop_rate"];
                    byMonsterId[id] = new SpecialtyDef {
                        MonsterId = id,
                        BaseKills = Math.Max(1, baseKills),
                        Segment = segment.Trim(),
                        Name = name.Trim(),
                        Bonuses = bonuses.Length > 0 ? bonuses : ["damage", "damage_reduction", "drop_rate"],
                    };
                }
                loaded = true;
                Console.WriteLine($"[MobSpecialty] Loaded {byMonsterId.Count} species ladders from MobSpecialties.json.");
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

    public static int StakeBonusLevels(long stakedHell) {
        if (stakedHell <= 0) {
            return 0;
        }
        // floor(staked / 50_000) * LevelsPerStakeTier (currently 1 → 5M = +100).
        var tiers = stakedHell / StakePerTier;
        if (tiers > int.MaxValue / Math.Max(1, LevelsPerStakeTier)) {
            return int.MaxValue / Math.Max(1, LevelsPerStakeTier) * LevelsPerStakeTier;
        }
        return (int)tiers * LevelsPerStakeTier;
    }

    /// <summary>
    /// Tokens that count toward specialty stake: explicit char field, or wallet mining pending
    /// (daily credit-share lands in PendingHell — that balance drives +1 tier / 50k until a real stake UI).
    /// </summary>
    public static long ResolveStakeAmount(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        long pending = 0;
        if (!string.IsNullOrWhiteSpace(player.AccountWallet)) {
            var snap = HellMiningStore.GetSnapshot(
                player.AccountWallet,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            pending = Math.Max(0, snap.PendingHell);
        }
        return Math.Max(Math.Max(0, player.StakedHell), pending);
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
        player.MonsterKills.TryGetValue(catalogMonsterId, out var kills);
        var def = GetDef(catalogMonsterId);
        var specialty = SpecialtyLevelFromKills(kills, def.BaseKills);
        var stakeAmount = ResolveStakeAmount(player);
        var stakeBonus = StakeBonusLevels(stakeAmount);
        // Cap effective at 2× max real ladder so stake can still stack on high GM/test tiers without unbounded growth.
        var effective = Math.Min(MaxSpecialtyLevel * 2, specialty + stakeBonus);
        var next = NextKillsForSpecialty(kills, def.BaseKills);
        AggregateBonuses(def, effective, out var flatDmg, out var flatRed, out var dmgPct, out var redPct, out var drop, out var hit);
        var summary = BuildSummary(flatDmg, flatRed, dmgPct, redPct, drop, hit);
        return new SpecialtySnapshot(specialty, effective, stakeBonus, next, flatDmg, flatRed, dmgPct, redPct, drop, hit, summary);
    }

    /// <summary>
    /// Even curve: every level adds 1/<see cref="OlympiaParityLevel"/> of the species' Olympia ladder totals
    /// at that level to every bonus at once, so an L40 here has the same dmg / reduction / drop / hit as an
    /// Olympia L40, and higher levels keep rising at the same even pace. Flat stats floor to whole points.
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

        var parity = def.ParityTotals ??= OlympiaLadderTotals(def, OlympiaParityLevel);
        var scale = effectiveLevel / (double)OlympiaParityLevel;
        flatDamage = (int)Math.Floor(parity.FlatDamage * scale + 1e-9);
        flatReduction = (int)Math.Floor(parity.FlatReduction * scale + 1e-9);
        damagePct = Math.Round(parity.DamagePct * scale, 2);
        reductionPct = Math.Round(parity.ReductionPct * scale, 2);
        dropPct = Math.Round(parity.DropPct * scale, 2);
        hitPct = Math.Round(parity.HitPct * scale, 2);
    }

    /// <summary>
    /// Olympia's step ladder summed up to <paramref name="level"/> (UI #315 + specialties.json):
    /// each level grants one bonus from <see cref="SpecialtyDef.Bonuses"/>, then drop_rate forever.
    /// damage / damage_reduction = flat 1 per step; drop_rate ≈ 2% diminishing; hit_ratio +2;
    /// damage_pct / damage_reduction_pct / hit_ratio_pct ≈ 2% each step.
    /// </summary>
    public static LadderTotals OlympiaLadderTotals(SpecialtyDef def, int level) {
        ArgumentNullException.ThrowIfNull(def);
        double flatDamage = 0, flatReduction = 0, damagePct = 0, reductionPct = 0, dropPct = 0, hitPct = 0;
        var dropSteps = 0;
        for (var step = 1; step <= level; step++) {
            string bonus;
            if (step - 1 < def.Bonuses.Length) {
                bonus = def.Bonuses[step - 1];
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
        return new LadderTotals(flatDamage, flatReduction, damagePct, reductionPct, dropPct, hitPct);
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

    /// <summary>
    /// Cover rows for every catalog monster group. Level is the highest kill-based specialty
    /// in that segment. Stake bonus uses only the character's persisted StakedHell.
    /// </summary>
    public static (int StakeBonusLevels, IReadOnlyList<CharacterGroupTier> Groups) BuildCharacterGroupCover(
        IEnumerable<PersistedMonsterKill>? kills,
        long stakedHell) {
        var killById = new Dictionary<int, long>();
        if (kills is not null) {
            foreach (var row in kills) {
                if (row is null || row.MonsterId < 0 || row.Kills <= 0) {
                    continue;
                }
                killById[row.MonsterId] = row.Kills;
            }
        }

        var grouped = new Dictionary<string, List<(string Name, int Level, long Kills)>>(StringComparer.Ordinal);
        lock (Gate) {
            foreach (var def in byMonsterId.Values) {
                var segment = string.IsNullOrWhiteSpace(def.Segment) ? "other" : def.Segment;
                killById.TryGetValue(def.MonsterId, out var speciesKills);
                var level = SpecialtyLevelFromKills(speciesKills, def.BaseKills);
                var name = string.IsNullOrWhiteSpace(def.Name) ? $"Monster {def.MonsterId}" : def.Name;
                if (!grouped.TryGetValue(segment, out var list)) {
                    list = new List<(string Name, int Level, long Kills)>();
                    grouped[segment] = list;
                }
                list.Add((name, level, speciesKills));
            }
        }

        var rows = new List<CharacterGroupTier>(GroupOrder.Length);
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (segment, label) in GroupOrder) {
            seen.Add(segment);
            rows.Add(PickGroupTier(segment, label, grouped));
        }
        foreach (var segment in grouped.Keys.OrderBy(s => s, StringComparer.Ordinal)) {
            if (seen.Contains(segment)) {
                continue;
            }
            rows.Add(PickGroupTier(segment, segment, grouped));
        }

        return (StakeBonusLevels(stakedHell), rows);
    }

    static readonly (string Segment, string Label)[] GroupOrder = [
        ("early", "Early"),
        ("low", "Low"),
        ("mid_ww", "Mid — Werewolf"),
        ("mid_frost", "Mid — Frost"),
        ("high_demon", "High"),
        ("apex_hc", "Apex — Hellclaw"),
        ("apex_tw", "Apex — Tigerworm"),
    ];

    static CharacterGroupTier PickGroupTier(
        string segment,
        string label,
        Dictionary<string, List<(string Name, int Level, long Kills)>> grouped) {
        if (!grouped.TryGetValue(segment, out var list) || list.Count == 0) {
            return new CharacterGroupTier(segment, label, 0, "");
        }

        var bestLevel = 0;
        var bestKills = 0L;
        var bestName = "";
        foreach (var (name, level, speciesKills) in list) {
            if (level > bestLevel || (level == bestLevel && level > 0 && speciesKills > bestKills)) {
                bestLevel = level;
                bestKills = speciesKills;
                bestName = name;
            }
        }

        return new CharacterGroupTier(segment, label, bestLevel, bestLevel > 0 ? bestName : "");
    }

    /// <summary>Hit chance points from specialty hit_ratio / hit_ratio_pct steps.</summary>
    public static int HitChanceBonusPoints(GameWorldPlayer attacker, int catalogMonsterId) {
        var snap = Compute(attacker, catalogMonsterId);
        // HitRatioPct is stored as percentage points (e.g. 2, 4, 6).
        return (int)Math.Round(snap.HitRatioPct);
    }
}
