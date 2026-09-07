using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Guild level = activity (contribution, EKs, gold, majestics) + floor(member $HELBREATH / 1M).
/// Effective level unlocks Huntmaster, Raidmaster, extra captains, and guild teleports.
/// Stake does not replace activity — it sits on top, same shape as personal Olympia expertise.
/// </summary>
public static class GuildProgression {
    public const string StakeTokenTicker = "$HELBREATH";
    public const long DefaultStakePerLevel = 1_000_000L;
    public const int MaxGuildLevel = 40;

    static readonly object Gate = new();
    static ConfigFile config = ConfigFile.Defaults();
    static Dictionary<string, GuildActivity> ledger = new(StringComparer.OrdinalIgnoreCase);
    static string? persistDirectory;
    static bool loaded;
    static long lastPersistMs;

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public readonly record struct Snapshot(
        int ActivityLevel,
        int StakeBonusLevels,
        int EffectiveLevel,
        long ActivityPoints,
        long StakedHelbreath,
        int Huntmaster,
        int Raidmaster,
        int Captains,
        IReadOnlyList<string> Teleports);

    public static void Initialize(string configDirectory, string? charsDirectory = null) {
        ArgumentException.ThrowIfNullOrWhiteSpace(configDirectory);
        lock (Gate) {
            config = ConfigFile.Defaults();
            var path = Path.Combine(configDirectory, "GuildProgression.json");
            if (File.Exists(path)) {
                try {
                    var parsed = JsonSerializer.Deserialize<ConfigFile>(File.ReadAllText(path), JsonOptions);
                    if (parsed is not null) {
                        config = parsed.Normalized();
                    }
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[GuildProgression] Failed to load config: {ex.Message}");
                }
            }
            persistDirectory = string.IsNullOrWhiteSpace(charsDirectory) ? null : charsDirectory;
            if (persistDirectory is not null) {
                Directory.CreateDirectory(persistDirectory);
                TryLoadLedgerLocked();
            }
            loaded = true;
            Console.WriteLine(
                $"[GuildProgression] {StakeTokenTicker} {config.StakePerGuildLevel}/+1 guild lv; " +
                $"{config.Ranks.Count} rank rows; ledger={ledger.Count}.");
        }
    }

    public static void ResetForTests() {
        lock (Gate) {
            config = ConfigFile.Defaults();
            ledger = new Dictionary<string, GuildActivity>(StringComparer.OrdinalIgnoreCase);
            persistDirectory = null;
            loaded = true;
        }
    }

    public static long StakePerGuildLevel {
        get {
            lock (Gate) {
                EnsureLoaded();
                return Math.Max(1, config.StakePerGuildLevel);
            }
        }
    }

    public static int StakeBonusLevels(long stakedHelbreath) {
        if (stakedHelbreath <= 0) {
            return 0;
        }
        var step = StakePerGuildLevel;
        var levels = stakedHelbreath / step;
        return levels > MaxGuildLevel ? MaxGuildLevel : (int)levels;
    }

    public static long ActivityPoints(long contribution, long enemyKills, long gold, long majestics) {
        ConfigFile cfg;
        lock (Gate) {
            EnsureLoaded();
            cfg = config;
        }
        var goldPts = cfg.Activity.GoldPerPoint > 0 ? gold / cfg.Activity.GoldPerPoint : 0;
        var pts = contribution * cfg.Activity.ContributionWeight
            + enemyKills * cfg.Activity.EkWeight
            + goldPts
            + majestics * cfg.Activity.MajesticWeight;
        return pts < 0 ? 0 : pts;
    }

    public static int ActivityLevelFromPoints(long points) {
        if (points <= 0) {
            return 0;
        }
        int basePts;
        lock (Gate) {
            EnsureLoaded();
            basePts = Math.Max(1, config.Activity.PointsPerLevelBase);
        }
        var level = 0;
        for (var l = 1; l <= MaxGuildLevel; l++) {
            var need = (long)basePts * l * l;
            if (points < need) {
                break;
            }
            level = l;
        }
        return level;
    }

    public static int EffectiveLevel(int activityLevel, long stakedHelbreath) {
        var activity = Math.Max(0, activityLevel);
        var bonus = StakeBonusLevels(stakedHelbreath);
        var sum = activity > int.MaxValue - bonus ? int.MaxValue : activity + bonus;
        return Math.Min(MaxGuildLevel, sum);
    }

    public static Snapshot Compute(long contribution, long enemyKills, long gold, long majestics, long stakedHelbreath) {
        var points = ActivityPoints(contribution, enemyKills, gold, majestics);
        var activity = ActivityLevelFromPoints(points);
        var bonus = StakeBonusLevels(stakedHelbreath);
        var effective = EffectiveLevel(activity, stakedHelbreath);
        var unlocks = ResolveUnlocks(effective);
        return new Snapshot(
            activity,
            bonus,
            effective,
            points,
            Math.Max(0, stakedHelbreath),
            unlocks.Huntmaster,
            unlocks.Raidmaster,
            unlocks.Captains,
            unlocks.Teleports);
    }

    public static Snapshot ComputeGuild(string? guildId) {
        var id = NormalizeGuild(guildId);
        if (string.IsNullOrEmpty(id)) {
            return Compute(0, 0, 0, 0, 0);
        }
        lock (Gate) {
            EnsureLoaded();
            if (!ledger.TryGetValue(id, out var row)) {
                return Compute(0, 0, 0, 0, 0);
            }
            return Compute(row.Contribution, row.EnemyKills, row.Gold, row.Majestics, SumStakes(row));
        }
    }

    public static bool CanGuildTeleport(string? guildId, string? worldId) {
        var world = (worldId ?? string.Empty).Trim();
        if (world.Length == 0) {
            return false;
        }
        var snap = ComputeGuild(guildId);
        return snap.Teleports.Any(t => string.Equals(t, world, StringComparison.OrdinalIgnoreCase));
    }

    public static void RememberMemberStake(string? guildId, string? wallet, long stakedHelbreath) {
        var id = NormalizeGuild(guildId);
        var w = NormalizeWallet(wallet);
        if (string.IsNullOrEmpty(w)) {
            return;
        }
        lock (Gate) {
            EnsureLoaded();
            // One wallet pledges to one guild. Leaving / switching drops it from the old pot.
            foreach (var row in ledger.Values) {
                row.MemberStakes.Remove(w);
            }
            if (string.IsNullOrEmpty(id) || stakedHelbreath <= 0) {
                return;
            }
            GetOrCreateLocked(id).MemberStakes[w] = stakedHelbreath;
        }
    }

    public static void ClearMemberStake(string? wallet) => RememberMemberStake(null, wallet, 0);

    /// <summary>$HELBREATH pledged by members of this guild only (other guilds do not stack in).</summary>
    public static long SumMemberStakes(string? guildId) {
        var id = NormalizeGuild(guildId);
        if (string.IsNullOrEmpty(id)) {
            return 0;
        }
        lock (Gate) {
            EnsureLoaded();
            return ledger.TryGetValue(id, out var row) ? SumStakes(row) : 0;
        }
    }

    public static void AddActivity(
        string? guildId,
        long contribution = 0,
        long enemyKills = 0,
        long gold = 0,
        long majestics = 0) {
        var id = NormalizeGuild(guildId);
        if (string.IsNullOrEmpty(id)) {
            return;
        }
        if (contribution == 0 && enemyKills == 0 && gold == 0 && majestics == 0) {
            return;
        }
        lock (Gate) {
            EnsureLoaded();
            var row = GetOrCreateLocked(id);
            row.Contribution = SaturateAdd(row.Contribution, contribution);
            row.EnemyKills = SaturateAdd(row.EnemyKills, enemyKills);
            row.Gold = SaturateAdd(row.Gold, gold);
            row.Majestics = SaturateAdd(row.Majestics, majestics);
        }
    }

    public static (int Huntmaster, int Raidmaster, int Captains, IReadOnlyList<string> Teleports) ResolveUnlocks(int effectiveLevel) {
        List<RankRow> ranks;
        lock (Gate) {
            EnsureLoaded();
            ranks = config.Ranks;
        }
        var hunt = 0;
        var raid = 0;
        var caps = 0;
        var maps = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var rank in ranks.OrderBy(r => r.MinLevel)) {
            if (effectiveLevel < rank.MinLevel) {
                continue;
            }
            hunt = Math.Max(hunt, rank.Huntmaster);
            raid = Math.Max(raid, rank.Raidmaster);
            caps = Math.Max(caps, rank.Captains);
            foreach (var map in rank.Teleports) {
                if (!string.IsNullOrWhiteSpace(map)) {
                    maps.Add(map.Trim());
                }
            }
        }
        return (hunt, raid, caps, maps.OrderBy(m => m, StringComparer.OrdinalIgnoreCase).ToArray());
    }

    static GuildActivity GetOrCreateLocked(string guildId) {
        if (!ledger.TryGetValue(guildId, out var row)) {
            row = new GuildActivity();
            ledger[guildId] = row;
        }
        return row;
    }

    static long SumStakes(GuildActivity row) {
        long sum = 0;
        foreach (var amount in row.MemberStakes.Values) {
            if (amount > 0) {
                sum = SaturateAdd(sum, amount);
            }
        }
        return sum;
    }

    static long SaturateAdd(long a, long b) {
        if (b <= 0) {
            return a < 0 ? 0 : a;
        }
        if (a > long.MaxValue - b) {
            return long.MaxValue;
        }
        return a + b;
    }

    static string NormalizeGuild(string? guildId) => (guildId ?? string.Empty).Trim();

    static string NormalizeWallet(string? wallet) => (wallet ?? string.Empty).Trim();

    static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        config = ConfigFile.Defaults();
        loaded = true;
    }

    static void TryLoadLedgerLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "guild-progression.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var parsed = JsonSerializer.Deserialize<LedgerFile>(File.ReadAllText(path), JsonOptions);
            if (parsed?.Guilds is null) {
                return;
            }
            ledger = new Dictionary<string, GuildActivity>(parsed.Guilds, StringComparer.OrdinalIgnoreCase);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[GuildProgression] Ledger load failed: {ex.Message}");
        }
    }

    public static void Tick(long nowMs) {
        if (nowMs - lastPersistMs < 20_000) {
            return;
        }
        lastPersistMs = nowMs;
        Persist();
    }

    public static void Persist() {
        lock (Gate) {
            if (persistDirectory is null) {
                return;
            }
            try {
                var path = Path.Combine(persistDirectory, "guild-progression.json");
                var tmp = path + ".tmp";
                File.WriteAllText(tmp, JsonSerializer.Serialize(new LedgerFile { Guilds = ledger }, JsonOptions));
                File.Move(tmp, path, overwrite: true);
            } catch (Exception ex) {
                Console.Error.WriteLine($"[GuildProgression] Persist failed: {ex.Message}");
            }
        }
    }

    public sealed class GuildActivity {
        public long Contribution { get; set; }
        public long EnemyKills { get; set; }
        public long Gold { get; set; }
        public long Majestics { get; set; }
        public Dictionary<string, long> MemberStakes { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    sealed class LedgerFile {
        public Dictionary<string, GuildActivity> Guilds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    sealed class ConfigFile {
        public string Token { get; set; } = StakeTokenTicker;
        public long StakePerGuildLevel { get; set; } = DefaultStakePerLevel;
        public ActivityWeights Activity { get; set; } = new();
        public List<RankRow> Ranks { get; set; } = [];

        public ConfigFile Normalized() {
            StakePerGuildLevel = StakePerGuildLevel > 0 ? StakePerGuildLevel : DefaultStakePerLevel;
            Activity ??= new ActivityWeights();
            Activity.PointsPerLevelBase = Activity.PointsPerLevelBase > 0 ? Activity.PointsPerLevelBase : 100;
            Activity.GoldPerPoint = Activity.GoldPerPoint > 0 ? Activity.GoldPerPoint : 10_000;
            Ranks ??= [];
            if (Ranks.Count == 0) {
                Ranks = Defaults().Ranks;
            }
            return this;
        }

        public static ConfigFile Defaults() => new() {
            Token = StakeTokenTicker,
            StakePerGuildLevel = DefaultStakePerLevel,
            Activity = new ActivityWeights(),
            Ranks = [
                new RankRow { MinLevel = 0, Huntmaster = 0, Raidmaster = 0, Captains = 0, Teleports = ["aregldhall", "elvgldhall"] },
                new RankRow { MinLevel = 1, Huntmaster = 1, Raidmaster = 0, Captains = 1, Teleports = ["middleland"] },
                new RankRow { MinLevel = 3, Huntmaster = 2, Raidmaster = 1, Captains = 2, Teleports = ["huntzone1", "huntzone2"] },
                new RankRow { MinLevel = 5, Huntmaster = 3, Raidmaster = 2, Captains = 3, Teleports = ["icebound", "huntzone3"] },
                new RankRow { MinLevel = 8, Huntmaster = 4, Raidmaster = 3, Captains = 4, Teleports = ["procella", "toh1"] },
                new RankRow { MinLevel = 10, Huntmaster = 5, Raidmaster = 4, Captains = 5, Teleports = ["promiseland", "abaddon"] },
                new RankRow { MinLevel = 15, Huntmaster = 6, Raidmaster = 5, Captains = 6, Teleports = ["toh2", "infernia-a"] },
                new RankRow { MinLevel = 20, Huntmaster = 8, Raidmaster = 6, Captains = 8, Teleports = ["toh3", "dglv2"] },
            ],
        };
    }

    sealed class ActivityWeights {
        public int PointsPerLevelBase { get; set; } = 100;
        public int ContributionWeight { get; set; } = 1;
        public int EkWeight { get; set; } = 80;
        public long GoldPerPoint { get; set; } = 10_000;
        public int MajesticWeight { get; set; } = 25;
    }

    sealed class RankRow {
        public int MinLevel { get; set; }
        public int Huntmaster { get; set; }
        public int Raidmaster { get; set; }
        public int Captains { get; set; }
        public List<string> Teleports { get; set; } = [];
    }
}
