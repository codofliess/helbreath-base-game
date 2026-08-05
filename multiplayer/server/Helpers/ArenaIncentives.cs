using System.Text.Json;
using System.Text.Json.Serialization;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Arena daily $HELL incentives (UTC day):
/// - AFK ≥2h on Bleeding Island → 5k pending $HELL once/day
/// - Completed duel (win or lose) → 10k, or 20k if Discord stream on landing ≥15m
/// - Max 5 duel claims/day; combined AFK+duels hard cap 100k $HELL/day
/// Anti-AFK never kicks players on <see cref="ArenaBleeding.WorldId"/>.
/// </summary>
public static class ArenaIncentives {
    public const long AfkDailyHell = 5_000L;
    public const int AfkMinutesRequired = 120;
    public const long DuelBaseHell = 10_000L;
    public const long DuelStreamedHell = 20_000L;
    public const int MaxDuelClaimsPerDay = 5;
    public const long DailyCapHell = 100_000L;
    public const int StreamMinutesRequired = 15;

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
            $"duel {DuelBaseHell}/{DuelStreamedHell} (stream {StreamMinutesRequired}m Discord) · " +
            $"max {MaxDuelClaimsPerDay} duels · day cap {DailyCapHell} $HELL.");
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
            NotifyGrant(player, result.Granted, result.Message);
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
    /// Called when a pact duel finishes after going live (win, lose, time, DC forfeit).
    /// Both fighters receive the participation reward (subject to caps).
    /// </summary>
    public static void OnDuelCompleted(
        IEnumerable<(string? Wallet, string? CharacterName, GameWorldPlayer? Player)> fighters,
        bool discordStreamQualified,
        string matchId) {
        ArgumentNullException.ThrowIfNull(fighters);
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var amountPer = discordStreamQualified ? DuelStreamedHell : DuelBaseHell;
        var label = discordStreamQualified
            ? $"streamed duel (+{DuelStreamedHell} $HELL)"
            : $"duel (+{DuelBaseHell} $HELL)";

        foreach (var f in fighters) {
            if (string.IsNullOrWhiteSpace(f.Wallet)) {
                continue;
            }
            var result = TryGrantDuel(f.Wallet, f.CharacterName, amountPer, discordStreamQualified, matchId, nowMs);
            if (result.Granted > 0 && f.Player is not null && !f.Player.Disconnected) {
                NotifyGrant(f.Player, result.Granted, result.Message);
            } else if (!string.IsNullOrWhiteSpace(result.Message) && f.Player is not null && !f.Player.Disconnected) {
                NetworkManager.SendToPlayer(
                    f.Player,
                    NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Arena] {result.Message}"));
            }
            Console.WriteLine(
                $"[ArenaIncentives] Duel match={matchId} wallet={Mask(f.Wallet)} granted={result.Granted} ({label}): {result.Message}");
        }
    }

    public static bool IsDiscordStreamPlatform(string? platform) =>
        string.Equals(platform?.Trim(), "discord", StringComparison.OrdinalIgnoreCase);

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

            var room = RemainingDailyCapLocked(row);
            if (room <= 0) {
                row.AfkRewardGranted = true; // don't re-check forever
                SchedulePersistLocked(nowMs);
                return ArenaIncentiveResult.Ignored(
                    $"Daily Arena incentive cap reached ({DailyCapHell} $HELL). Resets UTC midnight.");
            }

            var grant = Math.Min(AfkDailyHell, room);
            row.AfkRewardGranted = true;
            row.AfkHellGranted = grant;
            row.TotalHellGranted = SaturateAddLong(row.TotalHellGranted, grant);
            HellMiningStore.GrantPendingHell(wallet, grant);
            PersistLocked();
            lastPersistMs = nowMs;
            return new ArenaIncentiveResult(
                true,
                grant,
                row.AfkMinutes,
                $"AFK 2h on Bleeding Island: +{grant} pending $HELL (day total {row.TotalHellGranted}/{DailyCapHell}).");
        }
    }

    static ArenaIncentiveResult TryGrantDuel(
        string accountWallet,
        string? characterName,
        long requestedAmount,
        bool streamed,
        string matchId,
        long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return ArenaIncentiveResult.Ignored("No wallet.");
        }
        if (requestedAmount <= 0) {
            return ArenaIncentiveResult.Ignored("Bad amount.");
        }

        lock (Gate) {
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            var row = EnsureRowLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(characterName)) {
                row.CharacterName = characterName.Trim();
            }

            // Idempotent per match per wallet
            row.GrantedMatchIds ??= new List<string>();
            if (row.GrantedMatchIds.Any(id => string.Equals(id, matchId, StringComparison.OrdinalIgnoreCase))) {
                return ArenaIncentiveResult.Ignored("Duel already rewarded for this match.");
            }

            if (row.DuelClaims >= MaxDuelClaimsPerDay) {
                return ArenaIncentiveResult.Ignored(
                    $"Duel claim cap ({MaxDuelClaimsPerDay}/day) reached. Resets UTC midnight.");
            }

            var room = RemainingDailyCapLocked(row);
            if (room <= 0) {
                return ArenaIncentiveResult.Ignored(
                    $"Daily Arena incentive cap reached ({DailyCapHell} $HELL). Resets UTC midnight.");
            }

            var grant = Math.Min(requestedAmount, room);
            row.DuelClaims += 1;
            row.DuelHellGranted = SaturateAddLong(row.DuelHellGranted, grant);
            if (streamed) {
                row.StreamedDuelClaims += 1;
            }
            row.TotalHellGranted = SaturateAddLong(row.TotalHellGranted, grant);
            row.GrantedMatchIds.Add(matchId);
            if (row.GrantedMatchIds.Count > 40) {
                row.GrantedMatchIds.RemoveRange(0, row.GrantedMatchIds.Count - 40);
            }

            HellMiningStore.GrantPendingHell(wallet, grant);
            PersistLocked();
            lastPersistMs = nowMs;

            var streamNote = streamed ? " (Discord stream ≥15m on landing)" : "";
            return new ArenaIncentiveResult(
                true,
                grant,
                row.AfkMinutes,
                $"Duel complete{streamNote}: +{grant} pending $HELL " +
                $"(duels {row.DuelClaims}/{MaxDuelClaimsPerDay}, day total {row.TotalHellGranted}/{DailyCapHell}).");
        }
    }

    static long RemainingDailyCapLocked(ArenaIncentiveDayRow row) =>
        Math.Max(0, DailyCapHell - row.TotalHellGranted);

    static void NotifyGrant(GameWorldPlayer player, long amount, string message) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, $"[Arena] {message}"));
        try {
            HellMining.SendStatus(player, nowMs, message);
        } catch {
            // status packet optional
        }
        _ = amount;
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
    public int StreamedDuelClaims { get; set; }
    public long DuelHellGranted { get; set; }
    public long TotalHellGranted { get; set; }
    public List<string>? GrantedMatchIds { get; set; }
}

public readonly record struct ArenaIncentiveResult(bool Applied, long Granted, int? AfkMinutes, string Message) {
    public static ArenaIncentiveResult Ignored(string message) => new(false, 0, null, message);
}
