using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Cathedral PvP Academy: Learning + Challenge desks, per-tier leaderboards, EK handicap rewards.
/// See docs/PVP-ACADEMY.md.
/// </summary>
public static class PvpAcademy {
    public const int LearningCatalogNpcId = 15;
    public const int ChallengeCatalogNpcId = 16;

    /// <summary>Below this lifetime EK: all challenge tiers can earn rewards.</summary>
    public const int EkAdvancedThreshold = 50;

    /// <summary>At/above this EK: only Hard (12) and Elite (13) rewards.</summary>
    public const int EkUltraThreshold = 200;

    public const int LeaderboardTopN = 15;
    public const int GoldRewardEasy = 200;
    public const int GoldRewardIntermediate = 500;
    public const int GoldRewardHard = 1200;
    public const int GoldRewardElite = 2500;

    /// <summary>Hard challenge clear → up to this many Academy EKs per UTC day (counts toward lifetime EK / handicap).</summary>
    public const int MaxAcademyEkHardPerDay = 1;

    /// <summary>Elite challenge clear → up to this many Academy EKs per UTC day (elite player-like opponents).</summary>
    public const int MaxAcademyEkElitePerDay = 3;

    static readonly object Gate = new();
    static AcademyLedgerFile ledger = new();

    public static void Initialize() {
        lock (Gate) {
            ledger = LoadUnlocked();
        }
        Console.WriteLine(
            $"[PvpAcademy] Ledger: {ledger.Wallets.Count} wallet(s), boards={ledger.Boards.Count}.");
    }

    public static bool IsAcademyCatalog(int catalogNpcId) =>
        catalogNpcId is LearningCatalogNpcId or ChallengeCatalogNpcId;

    public static string RoleForCatalog(int catalogNpcId) => catalogNpcId switch {
        LearningCatalogNpcId => "academy-learning",
        ChallengeCatalogNpcId => "academy-challenge",
        _ => string.Empty,
    };

    public static void RecordEnemyKill(GameWorldPlayer killer) {
        if (killer is null) {
            return;
        }
        var wallet = NormalizeWallet(killer.AccountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return;
        }
        lock (Gate) {
            var row = GetOrCreateWalletUnlocked(wallet, killer.CharacterName);
            row.EkCount++;
            row.DisplayName = killer.CharacterName ?? row.DisplayName;
            SaveUnlocked();
        }
    }

    public static int GetEkCount(GameWorldPlayer player) {
        var wallet = NormalizeWallet(player.AccountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return 0;
        }
        lock (Gate) {
            return ledger.Wallets.TryGetValue(wallet, out var row) ? row.EkCount : 0;
        }
    }

    /// <summary>Handicap band for reward eligibility.</summary>
    public static string HandicapBand(int ekCount) {
        if (ekCount >= EkUltraThreshold) {
            return "ultra";
        }
        if (ekCount >= EkAdvancedThreshold) {
            return "advanced";
        }
        return "standard";
    }

    public static bool IsRewardEligible(int challengeMode, int ekCount) {
        var band = HandicapBand(ekCount);
        return band switch {
            "ultra" => challengeMode is TimedChallenge.ModeChallengeHard or TimedChallenge.ModeChallengeElite,
            "advanced" => challengeMode is TimedChallenge.ModeChallengeIntermediate
                or TimedChallenge.ModeChallengeHard
                or TimedChallenge.ModeChallengeElite,
            _ => challengeMode is TimedChallenge.ModeChallengeEasy
                or TimedChallenge.ModeChallengeIntermediate
                or TimedChallenge.ModeChallengeHard
                or TimedChallenge.ModeChallengeElite,
        };
    }

    public static string FormatHandicapExplain(int ekCount) {
        var band = HandicapBand(ekCount);
        return band switch {
            "ultra" =>
                $"Your EK record ({ekCount}) is Ultra — rewards only on Hard & Elite performance (no low-tier farming).",
            "advanced" =>
                $"Your EK record ({ekCount}) is Advanced — no Easy rewards; Intermediate+ only.",
            _ =>
                $"Your EK record ({ekCount}) is Standard — all challenge tiers can grant rewards.",
        };
    }

    /// <summary>
    /// Called when Challenge mode 10–13 finishes successfully.
    /// Hard/Elite (elite-player-like tiers) can grant Academy EKs with daily caps (1 Hard / 3 Elite).
    /// </summary>
    public static void OnChallengeCleared(GameWorldRef wr, GameWorldPlayer player, int mode, int elapsedMs) {
        if (player is null || mode is < TimedChallenge.ModeChallengeEasy or > TimedChallenge.ModeChallengeElite) {
            return;
        }

        var wallet = NormalizeWallet(player.AccountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            wallet = $"char:{player.CharacterName}";
        }

        var tierKey = ModeToTierKey(mode);
        var gold = ModeToGold(mode);
        var rewarded = false;
        var ekGranted = 0;
        var ekCap = AcademyEkDailyCap(mode);
        var ekRemainingAfter = 0;
        var ek = 0;

        lock (Gate) {
            var row = GetOrCreateWalletUnlocked(wallet, player.CharacterName);
            row.DisplayName = player.CharacterName ?? row.DisplayName;
            RollAcademyEkDayUnlocked(row);
            ek = row.EkCount;

            // Leaderboard: best time per tier
            if (!ledger.Boards.TryGetValue(tierKey, out var board)) {
                board = new List<BoardEntry>();
                ledger.Boards[tierKey] = board;
            }
            var existing = board.Find(e =>
                string.Equals(NormalizeWallet(e.Wallet), wallet, StringComparison.OrdinalIgnoreCase));
            if (existing is null) {
                board.Add(new BoardEntry {
                    Wallet = wallet,
                    CharacterName = player.CharacterName ?? "",
                    ElapsedMs = elapsedMs,
                    EkAtTime = ek,
                });
            } else if (elapsedMs < existing.ElapsedMs) {
                existing.ElapsedMs = elapsedMs;
                existing.CharacterName = player.CharacterName ?? existing.CharacterName;
                existing.EkAtTime = ek;
            }
            board.Sort((a, b) => a.ElapsedMs.CompareTo(b.ElapsedMs));
            while (board.Count > LeaderboardTopN * 3) {
                board.RemoveAt(board.Count - 1);
            }

            var day = UtcDayKey();
            var eligible = IsRewardEligible(mode, row.EkCount);
            // One gold reward per wallet per tier per UTC day (if eligible)
            if (eligible) {
                var claimKey = $"{tierKey}:{day}";
                if (!row.RewardClaimsUtc.Contains(claimKey)) {
                    row.RewardClaimsUtc.Add(claimKey);
                    rewarded = true;
                }
            }

            // Academy EK: Hard ≤1/day, Elite ≤3/day (when opponents are elite-player-like).
            if (ekCap > 0) {
                var used = mode == TimedChallenge.ModeChallengeElite
                    ? row.AcademyEkEliteToday
                    : row.AcademyEkHardToday;
                if (used < ekCap) {
                    if (mode == TimedChallenge.ModeChallengeElite) {
                        row.AcademyEkEliteToday++;
                    } else {
                        row.AcademyEkHardToday++;
                    }
                    row.EkCount++;
                    ekGranted = 1;
                    ek = row.EkCount;
                }
                ekRemainingAfter = mode == TimedChallenge.ModeChallengeElite
                    ? Math.Max(0, MaxAcademyEkElitePerDay - row.AcademyEkEliteToday)
                    : Math.Max(0, MaxAcademyEkHardPerDay - row.AcademyEkHardToday);
            }

            SaveUnlocked();
        }

        if (rewarded && gold > 0) {
            if (player.InventoryManager.TryCreateItemStack(GroundItemPickup.GoldItemId, gold, out var mut)) {
                Inventory.ApplyInventoryMutation(wr, player, mut);
            } else {
                rewarded = false;
            }
        }

        var msg = $"Challenge {tierKey} cleared in {FormatMs(elapsedMs)}.";
        msg += " " + FormatHandicapExplain(ek);
        if (ekGranted > 0) {
            msg += $" Academy EK +{ekGranted} (lifetime {ek}).";
            if (ekCap > 0) {
                msg += $" Remaining today: {ekRemainingAfter}/{ekCap} for this tier.";
            }
        } else if (ekCap > 0) {
            msg += $" No Academy EK — daily cap reached ({ekCap}/day for {tierKey}).";
        }
        if (rewarded) {
            msg += $" Gold: {gold}g (once/day/tier).";
        } else if (!IsRewardEligible(mode, ek)) {
            msg += " No gold — handicap blocks low-tier farming for your EK band.";
        } else if (gold > 0) {
            msg += " Gold already claimed today for this tier (or bag full).";
        }

        NetworkManager.SendToPlayer(player, NetworkManager.CreateCityNpcServiceResult(
            ok: true,
            message: msg,
            role: "academy-challenge",
            npcName: "Arena Master",
            guildInterestRegistered: player.GuildInterestRegistered,
            cityServicesSummary: FormatLeaderboard(tierKey),
            citizenshipSide: CityNpcServices.ResolveCitizenshipSidePublic(wr.WorldId),
            hp: player.Hp,
            maxHp: player.MaxHp,
            goldSpent: rewarded ? -gold : 0,
            crusadeStatus: "",
            blessed: false));

        if (ekGranted > 0) {
            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateChatMessageReceived(
                    "System",
                    nowMs,
                    $"[Academy] EK +{ekGranted} from {tierKey} challenge (daily caps: Hard {MaxAcademyEkHardPerDay}, Elite {MaxAcademyEkElitePerDay})."));
        }
    }

    /// <summary>0 = no academy EK on this mode; else daily max grants.</summary>
    public static int AcademyEkDailyCap(int mode) => mode switch {
        TimedChallenge.ModeChallengeHard => MaxAcademyEkHardPerDay,
        TimedChallenge.ModeChallengeElite => MaxAcademyEkElitePerDay,
        _ => 0,
    };

    static void RollAcademyEkDayUnlocked(WalletRow row) {
        var day = UtcDayKey();
        if (string.Equals(row.AcademyEkUtcDay, day, StringComparison.Ordinal)) {
            return;
        }
        row.AcademyEkUtcDay = day;
        row.AcademyEkHardToday = 0;
        row.AcademyEkEliteToday = 0;
    }

    public static bool TryHandleService(
        GameWorldRef wr,
        GameWorldPlayer player,
        CityNpcServiceRequest request,
        int catalogNpcId) {
        var role = RoleForCatalog(catalogNpcId);
        if (string.IsNullOrEmpty(role)) {
            return false;
        }

        var action = (request.Action ?? "open").Trim().ToLowerInvariant();
        var npcName = catalogNpcId == LearningCatalogNpcId ? "Drill Instructor" : "Arena Master";
        var side = CityNpcServices.ResolveCitizenshipSidePublic(wr.WorldId);
        var ek = GetEkCount(player);

        switch (action) {
            case "" or "open":
                if (role == "academy-learning") {
                    Send(
                        player,
                        true,
                        "PvP Learning desk. Choose a drill: Guards waves, Dark Elves (invi+PFA), or Skills CC. Tips teach common sequences. No Elo.",
                        role,
                        npcName,
                        side,
                        "Guards=spacing/CC · Dark Elves=invi+PFA setup · Skills=Chill→Para→DS");
                } else {
                    Send(
                        player,
                        true,
                        "Challenge desk (GM). Pick Easy→Elite. Hero-set duelists TBD — Guards scaffold for now. " +
                        FormatHandicapExplain(ek) +
                        $" Academy EK: Hard ≤{MaxAcademyEkHardPerDay}/day, Elite ≤{MaxAcademyEkElitePerDay}/day (count toward lifetime EK).",
                        role,
                        npcName,
                        side,
                        FormatAllLeaderboards());
                }
                return true;

            case "learn_guards":
                TimedChallenge.HandleStartRequest(wr, player, new StartTimedChallengeRequest {
                    Mode = TimedChallenge.ModePvpGuards,
                    GameWorldId = wr.WorldId,
                });
                Send(player, true, "Learning · Guards waves started (or see challenge panel).", role, npcName, side, "");
                return true;

            case "learn_darkelves":
                TimedChallenge.HandleStartRequest(wr, player, new StartTimedChallengeRequest {
                    Mode = TimedChallenge.ModePvpDarkElves,
                    GameWorldId = wr.WorldId,
                });
                Send(player, true, "Learning · Dark Elves setup started.", role, npcName, side, "");
                return true;

            case "learn_skills":
                TimedChallenge.HandleStartRequest(wr, player, new StartTimedChallengeRequest {
                    Mode = TimedChallenge.ModeSkills,
                    GameWorldId = wr.WorldId,
                });
                Send(player, true, "Learning · Skills CC challenge started.", role, npcName, side, "");
                return true;

            case "challenge_easy":
                return StartChallenge(wr, player, TimedChallenge.ModeChallengeEasy, role, npcName, side);
            case "challenge_intermediate":
                return StartChallenge(wr, player, TimedChallenge.ModeChallengeIntermediate, role, npcName, side);
            case "challenge_hard":
                return StartChallenge(wr, player, TimedChallenge.ModeChallengeHard, role, npcName, side);
            case "challenge_elite":
                return StartChallenge(wr, player, TimedChallenge.ModeChallengeElite, role, npcName, side);

            case "board_easy":
                Send(player, true, "Leaderboard · Easy", role, npcName, side, FormatLeaderboard("easy"));
                return true;
            case "board_intermediate":
                Send(player, true, "Leaderboard · Intermediate", role, npcName, side, FormatLeaderboard("intermediate"));
                return true;
            case "board_hard":
                Send(player, true, "Leaderboard · Hard", role, npcName, side, FormatLeaderboard("hard"));
                return true;
            case "board_elite":
                Send(player, true, "Leaderboard · Elite", role, npcName, side, FormatLeaderboard("elite"));
                return true;

            case "handicap":
                Send(player, true, FormatHandicapExplain(ek), role, npcName, side, FormatAllLeaderboards());
                return true;

            default:
                Send(player, false, "Unknown academy action.", role, npcName, side, "");
                return true;
        }
    }

    static bool StartChallenge(
        GameWorldRef wr,
        GameWorldPlayer player,
        int mode,
        string role,
        string npcName,
        string side) {
        TimedChallenge.HandleStartRequest(wr, player, new StartTimedChallengeRequest {
            Mode = mode,
            GameWorldId = wr.WorldId,
        });
        var ek = GetEkCount(player);
        Send(
            player,
            true,
            $"Challenge mode {mode} requested. {FormatHandicapExplain(ek)}",
            role,
            npcName,
            side,
            FormatLeaderboard(ModeToTierKey(mode)));
        return true;
    }

    static void Send(
        GameWorldPlayer player,
        bool ok,
        string message,
        string role,
        string npcName,
        string side,
        string boardSummary) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateCityNpcServiceResult(
                ok,
                message,
                role,
                npcName,
                player.GuildInterestRegistered,
                boardSummary ?? "",
                side,
                player.Hp,
                player.MaxHp,
                goldSpent: 0,
                crusadeStatus: "",
                blessed: false));
    }

    public static string FormatLeaderboard(string tierKey) {
        lock (Gate) {
            if (!ledger.Boards.TryGetValue(tierKey, out var board) || board.Count == 0) {
                return $"Board [{tierKey}]: empty — be the first clear.";
            }
            var sb = new StringBuilder();
            sb.AppendLine($"Board [{tierKey}] top {LeaderboardTopN}:");
            var i = 0;
            foreach (var e in board.Take(LeaderboardTopN)) {
                i++;
                sb.AppendLine($"#{i} {e.CharacterName} …{WalletSuffix(e.Wallet)} — {FormatMs(e.ElapsedMs)} (EK~{e.EkAtTime})");
            }
            return sb.ToString().TrimEnd();
        }
    }

    static string FormatAllLeaderboards() {
        var parts = new[] { "easy", "intermediate", "hard", "elite" }.Select(FormatLeaderboard);
        return string.Join("\n---\n", parts);
    }

    static string ModeToTierKey(int mode) => mode switch {
        TimedChallenge.ModeChallengeEasy => "easy",
        TimedChallenge.ModeChallengeIntermediate => "intermediate",
        TimedChallenge.ModeChallengeHard => "hard",
        TimedChallenge.ModeChallengeElite => "elite",
        _ => "unknown",
    };

    static int ModeToGold(int mode) => mode switch {
        TimedChallenge.ModeChallengeEasy => GoldRewardEasy,
        TimedChallenge.ModeChallengeIntermediate => GoldRewardIntermediate,
        TimedChallenge.ModeChallengeHard => GoldRewardHard,
        TimedChallenge.ModeChallengeElite => GoldRewardElite,
        _ => 0,
    };

    static string UtcDayKey() => DateTime.UtcNow.ToString("yyyy-MM-dd");

    static string NormalizeWallet(string? wallet) =>
        string.IsNullOrWhiteSpace(wallet) ? "" : wallet.Trim();

    static string WalletSuffix(string? wallet) {
        var w = NormalizeWallet(wallet);
        return w.Length <= 4 ? w : w[^4..];
    }

    static string FormatMs(int ms) {
        var totalSec = Math.Max(0, ms) / 1000;
        return $"{totalSec / 60}:{totalSec % 60:D2}";
    }

    static WalletRow GetOrCreateWalletUnlocked(string wallet, string? name) {
        if (!ledger.Wallets.TryGetValue(wallet, out var row)) {
            row = new WalletRow { Wallet = wallet, DisplayName = name ?? "" };
            ledger.Wallets[wallet] = row;
        }
        return row;
    }

    static string LedgerPath() =>
        Path.Combine(Directory.GetCurrentDirectory(), "Config", "PvpAcademyLedger.json");

    static JsonSerializerOptions JsonOpts() => new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    static AcademyLedgerFile LoadUnlocked() {
        try {
            var path = LedgerPath();
            if (!File.Exists(path)) {
                return new AcademyLedgerFile();
            }
            return JsonSerializer.Deserialize<AcademyLedgerFile>(File.ReadAllText(path), JsonOpts())
                   ?? new AcademyLedgerFile();
        } catch (Exception ex) {
            Console.WriteLine($"[PvpAcademy] load failed: {ex.Message}");
            return new AcademyLedgerFile();
        }
    }

    static void SaveUnlocked() {
        try {
            var path = LedgerPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllText(path, JsonSerializer.Serialize(ledger, JsonOpts()));
        } catch (Exception ex) {
            Console.WriteLine($"[PvpAcademy] save failed: {ex.Message}");
        }
    }

    sealed class AcademyLedgerFile {
        public Dictionary<string, WalletRow> Wallets { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, List<BoardEntry>> Boards { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    }

    sealed class WalletRow {
        public string Wallet { get; set; } = "";
        public string DisplayName { get; set; } = "";
        /// <summary>Lifetime EKs (open-world + Academy Hard/Elite grants).</summary>
        public int EkCount { get; set; }
        public List<string> RewardClaimsUtc { get; set; } = new();
        /// <summary>UTC day key for Academy EK daily counters.</summary>
        public string? AcademyEkUtcDay { get; set; }
        public int AcademyEkHardToday { get; set; }
        public int AcademyEkEliteToday { get; set; }
    }

    sealed class BoardEntry {
        public string Wallet { get; set; } = "";
        public string CharacterName { get; set; } = "";
        public int ElapsedMs { get; set; }
        public int EkAtTime { get; set; }
    }
}
