using System.Text.Json;
using System.Text.Json.Serialization;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Arena daily $HELL incentives (UTC day), paid out of the shared mining day budget
/// (<see cref="HellMiningStore.DailyTokenCap"/>) and capped per wallet by <see cref="HellMiningStore.WalletDailyCap"/>:
/// - AFK ≥2h on Bleeding Island → 5k once/day
/// - Completed duel → 7k winner / 3k loser (3k each when time runs out with no winner)
/// - One paid duel per rival pair per day, max 5 paid duels per wallet per day
/// Anti-AFK never kicks players on <see cref="ArenaBleeding.WorldId"/>.
/// </summary>
public static class ArenaIncentives {
    public const long AfkDailyHell = 5_000L;
    public const int AfkMinutesRequired = 120;
    public const long DuelWinnerHell = 7_000L;
    public const long DuelLoserHell = 3_000L;
    public const long DuelDrawHell = 3_000L;
    public const int MaxDuelClaimsPerDay = 5;

    static readonly object Gate = new();
    static ArenaIncentivesFile file = new();
    static string? persistDirectory;
    static long lastPersistMs;

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static void Initialize(string charsDirectory) {
        ArgumentException.ThrowIfNullOrWhiteSpace(charsDirectory);
        Directory.CreateDirectory(charsDirectory);
        persistDirectory = charsDirectory;
        lock (Gate) {
            file = new ArenaIncentivesFile();
            TryLoadLocked();
            PersistLocked();
        }
        Console.WriteLine(
            $"[ArenaIncentives] AFK {AfkDailyHell} @ {AfkMinutesRequired}m BI · " +
            $"duel {DuelWinnerHell} win / {DuelLoserHell} loss / {DuelDrawHell} draw · " +
            $"1 paid duel per rival pair · max {MaxDuelClaimsPerDay} duels · inside mining day budget " +
            $"(wallet cap {HellMiningStore.WalletDailyCap}).");
    }

    public static bool IsAntiAfkExemptWorld(string? worldId) =>
        ArenaBleeding.IsArenaBleedingWorld(worldId);

    /// <summary>1-minute heartbeat while connected on Bleeding Island lobby map.</summary>
    public static void OnSessionMinute(string worldId, GameWorldPlayer player) {
        if (player is null || player.Disconnected) {
            return;
        }
        if (!ArenaBleeding.IsArenaBleedingWorld(worldId)) {
            return;
        }
        if (string.IsNullOrWhiteSpace(player.AccountWallet)) {
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = RecordAfkMinute(player.AccountWallet, player.CharacterName, nowMs);
        if (result.Granted > 0) {
            NotifyGrant(player, result.Message);
        } else if (result.Applied &&
                   result.AfkMinutes is int m &&
                   m > 0 &&
                   m % 30 == 0 &&
                   !string.IsNullOrWhiteSpace(result.Message) &&
                   result.Message.Contains("AFK progress", StringComparison.OrdinalIgnoreCase)) {
            // Quiet progress every 30 minutes only.
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Arena] {result.Message}"));
        }
    }

    /// <summary>
    /// Called when a pact duel finishes after going live (sign loss, DC forfeit, or time).
    /// <paramref name="winnerTeam"/> is null when time ran out with no winner.
    /// </summary>
    public static void OnDuelCompleted(
        IReadOnlyList<ArenaDuelFighter> fighters,
        int? winnerTeam,
        string matchId) {
        ArgumentNullException.ThrowIfNull(fighters);
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        foreach (var f in fighters) {
            if (string.IsNullOrWhiteSpace(f.Wallet)) {
                continue;
            }
            var opponents = fighters.Where(o => o.Team != f.Team).ToList();
            var (amount, outcome) = winnerTeam is null
                ? (DuelDrawHell, "ended on time")
                : f.Team == winnerTeam ? (DuelWinnerHell, "won") : (DuelLoserHell, "lost");
            var result = TryGrantDuel(f, opponents, amount, outcome, matchId, nowMs);
            if (f.Player is not null && !f.Player.Disconnected && !string.IsNullOrWhiteSpace(result.Message)) {
                if (result.Granted > 0) {
                    NotifyGrant(f.Player, result.Message);
                } else {
                    NetworkManager.SendToPlayer(
                        f.Player,
                        NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Arena] {result.Message}"));
                }
            }
            Console.WriteLine(
                $"[ArenaIncentives] Duel match={matchId} wallet={Mask(f.Wallet)} team={f.Team} winner={winnerTeam?.ToString() ?? "none"} granted={result.Granted}: {result.Message}");
        }
    }

    static ArenaIncentiveResult RecordAfkMinute(string accountWallet, string? characterName, long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return ArenaIncentiveResult.Ignored("No wallet.");
        }
        lock (Gate) {
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            var row = EnsureRowLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(characterName)) {
                row.CharacterName = characterName.Trim();
            }
            row.AfkMinutes = SaturateAddInt(row.AfkMinutes, 1);

            if (row.AfkRewardGranted) {
                SchedulePersistLocked(nowMs);
                return new ArenaIncentiveResult(true, 0, row.AfkMinutes,
                    $"BI AFK progress {row.AfkMinutes}/{AfkMinutesRequired}m (reward already claimed today).");
            }

            if (row.AfkMinutes < AfkMinutesRequired) {
                SchedulePersistLocked(nowMs);
                return new ArenaIncentiveResult(true, 0, row.AfkMinutes,
                    $"BI AFK progress {row.AfkMinutes}/{AfkMinutesRequired}m → {AfkDailyHell} $HELL.");
            }

            row.AfkRewardGranted = true;
            var grant = HellMiningStore.AwardDailyDirect(wallet, characterName, AfkDailyHell, nowMs);
            row.AfkHellGranted = grant;
            row.TotalHellGranted = SaturateAddLong(row.TotalHellGranted, grant);
            PersistLocked();
            lastPersistMs = nowMs;
            if (grant <= 0) {
                return ArenaIncentiveResult.Ignored(
                    "Daily mining cap reached (wallet or server day budget). Resets UTC midnight.");
            }
            return new ArenaIncentiveResult(
                true,
                grant,
                row.AfkMinutes,
                $"AFK 2h on Bleeding Island: +{grant} pending $HELL.");
        }
    }

    static ArenaIncentiveResult TryGrantDuel(
        ArenaDuelFighter fighter,
        IReadOnlyList<ArenaDuelFighter> opponents,
        long amount,
        string outcome,
        string matchId,
        long nowMs) {
        var wallet = NormalizeWallet(fighter.Wallet);
        if (string.IsNullOrEmpty(wallet)) {
            return ArenaIncentiveResult.Ignored("No wallet.");
        }
        var opponentWallets = opponents.Select(o => NormalizeWallet(o.Wallet)).ToList();
        if (opponentWallets.Count == 0 ||
            opponentWallets.Any(w => w.Length == 0 || string.Equals(w, wallet, StringComparison.OrdinalIgnoreCase))) {
            return ArenaIncentiveResult.Ignored("Duel reward needs an opponent with their own linked wallet.");
        }

        lock (Gate) {
            var day = EnsureDayLocked(UtcDayKey(nowMs));
            var row = EnsureRowLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(fighter.CharacterName)) {
                row.CharacterName = fighter.CharacterName.Trim();
            }

            row.GrantedMatchIds ??= new List<string>();
            if (row.GrantedMatchIds.Any(id => string.Equals(id, matchId, StringComparison.OrdinalIgnoreCase))) {
                return ArenaIncentiveResult.Ignored("Duel already rewarded for this match.");
            }

            row.PaidOpponentWallets ??= new List<string>();
            var repeat = opponentWallets.FirstOrDefault(w =>
                row.PaidOpponentWallets.Contains(w, StringComparer.OrdinalIgnoreCase));
            if (repeat is not null) {
                var name = opponents.FirstOrDefault(o =>
                    string.Equals(NormalizeWallet(o.Wallet), repeat, StringComparison.OrdinalIgnoreCase)).CharacterName;
                return ArenaIncentiveResult.Ignored(
                    $"Already had a paid duel vs {name ?? "this opponent"} today — one per rival per day.");
            }

            if (row.DuelClaims >= MaxDuelClaimsPerDay) {
                return ArenaIncentiveResult.Ignored(
                    $"Duel claim cap ({MaxDuelClaimsPerDay}/day) reached. Resets UTC midnight.");
            }

            row.DuelClaims += 1;
            row.PaidOpponentWallets.AddRange(opponentWallets);
            row.GrantedMatchIds.Add(matchId);
            if (row.GrantedMatchIds.Count > 40) {
                row.GrantedMatchIds.RemoveRange(0, row.GrantedMatchIds.Count - 40);
            }

            var grant = HellMiningStore.AwardDailyDirect(wallet, fighter.CharacterName, amount, nowMs);
            row.DuelHellGranted = SaturateAddLong(row.DuelHellGranted, grant);
            row.TotalHellGranted = SaturateAddLong(row.TotalHellGranted, grant);
            PersistLocked();
            lastPersistMs = nowMs;

            if (grant <= 0) {
                return ArenaIncentiveResult.Ignored(
                    "Duel counted, but today's mining cap is reached (wallet or server day budget).");
            }
            return new ArenaIncentiveResult(
                true,
                grant,
                row.AfkMinutes,
                $"Duel {outcome}: +{grant} pending $HELL (paid duels {row.DuelClaims}/{MaxDuelClaimsPerDay} today).");
        }
    }

    static void NotifyGrant(GameWorldPlayer player, string message) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Arena] {message}"));
        try {
            HellMining.SendStatus(player, nowMs, message);
        } catch {
            // status packet optional
        }
    }

    static string UtcDayKey(long nowMs) =>
        DateTimeOffset.FromUnixTimeMilliseconds(nowMs).UtcDateTime.ToString("yyyy-MM-dd");

    static string NormalizeWallet(string? wallet) =>
        string.IsNullOrWhiteSpace(wallet) ? "" : wallet.Trim();

    static string Mask(string? wallet) {
        if (string.IsNullOrEmpty(wallet)) {
            return "?";
        }
        return wallet.Length <= 8 ? wallet : $"{wallet[..4]}…{wallet[^4..]}";
    }

    static ArenaIncentiveDay EnsureDayLocked(string dayKey) {
        if (!file.Days.TryGetValue(dayKey, out var day)) {
            day = new ArenaIncentiveDay { UtcDay = dayKey };
            file.Days[dayKey] = day;
        }
        // Prune old days (keep ~14)
        if (file.Days.Count > 20) {
            foreach (var old in file.Days.Keys.OrderBy(k => k).Take(file.Days.Count - 14).ToList()) {
                file.Days.Remove(old);
            }
        }
        return day;
    }

    static ArenaIncentiveDayRow EnsureRowLocked(ArenaIncentiveDay day, string wallet) {
        if (!day.Wallets.TryGetValue(wallet, out var row)) {
            row = new ArenaIncentiveDayRow { Wallet = wallet };
            day.Wallets[wallet] = row;
        }
        return row;
    }

    static int SaturateAddInt(int a, int b) {
        var s = (long)a + b;
        if (s > int.MaxValue) {
            return int.MaxValue;
        }
        if (s < 0) {
            return 0;
        }
        return (int)s;
    }

    static long SaturateAddLong(long a, long b) {
        try {
            return checked(a + b);
        } catch (OverflowException) {
            return b >= 0 ? long.MaxValue : long.MinValue;
        }
    }

    static void SchedulePersistLocked(long nowMs) {
        if (nowMs - lastPersistMs >= 15_000) {
            PersistLocked();
            lastPersistMs = nowMs;
        }
    }

    static void TryLoadLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "arena-incentives.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var json = File.ReadAllText(path);
            var loaded = JsonSerializer.Deserialize<ArenaIncentivesFile>(json, JsonOptions);
            if (loaded is not null) {
                file = loaded;
                file.Days ??= new Dictionary<string, ArenaIncentiveDay>(StringComparer.Ordinal);
            }
        } catch (Exception ex) {
            Console.WriteLine($"[ArenaIncentives] Load failed: {ex.Message}");
        }
    }

    static void PersistLocked() {
        if (persistDirectory is null) {
            return;
        }
        try {
            var path = Path.Combine(persistDirectory, "arena-incentives.json");
            var tmp = path + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(file, JsonOptions));
            File.Copy(tmp, path, overwrite: true);
            try {
                File.Delete(tmp);
            } catch {
                // ignore
            }
        } catch (Exception ex) {
            Console.WriteLine($"[ArenaIncentives] Persist failed: {ex.Message}");
        }
    }
}

/// <summary>One side of a finished pact duel, as seen by <see cref="ArenaIncentives.OnDuelCompleted"/>.</summary>
public readonly record struct ArenaDuelFighter(string? Wallet, string? CharacterName, int Team, GameWorldPlayer? Player);

public sealed class ArenaIncentivesFile {
    public Dictionary<string, ArenaIncentiveDay> Days { get; set; } = new(StringComparer.Ordinal);
}

public sealed class ArenaIncentiveDay {
    public string UtcDay { get; set; } = "";
    public Dictionary<string, ArenaIncentiveDayRow> Wallets { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class ArenaIncentiveDayRow {
    public string Wallet { get; set; } = "";
    public string? CharacterName { get; set; }
    public int AfkMinutes { get; set; }
    public bool AfkRewardGranted { get; set; }
    public long AfkHellGranted { get; set; }
    public int DuelClaims { get; set; }
    /// <summary>Legacy: Discord-streamed duels under the old 20k rule. No longer incremented.</summary>
    public int StreamedDuelClaims { get; set; }
    public long DuelHellGranted { get; set; }
    public long TotalHellGranted { get; set; }
    public List<string>? GrantedMatchIds { get; set; }
    /// <summary>Opponent wallets already faced in a paid duel today (one paid duel per rival pair).</summary>
    public List<string>? PaidOpponentWallets { get; set; }
}

public readonly record struct ArenaIncentiveResult(bool Applied, long Granted, int? AfkMinutes, string Message) {
    public static ArenaIncentiveResult Ignored(string message) => new(false, 0, null, message);
}
