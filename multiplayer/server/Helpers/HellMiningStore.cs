using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Server.Helpers;

/// <summary>
/// Durable play-mine ledger for $HELL (C1). JSON under Chars/ so traveler mode works without Postgres.
/// Tracks daily credits, direct token awards, pending balances, and the remaining 400M mining pool.
/// </summary>
public static class HellMiningStore {
    public const long TotalMiningPool = 400_000_000L;
    public const long DailyTokenCap = 500_000L;

    // ── Testing-week credit rules (see landing #news + Discord) ─────────────
    /// <summary>+1 credit on first presence of the UTC day (login / join).</summary>
    public const int LoginParticipationCredits = 1;
    /// <summary>+1 credit per full hour online (AFK or active — any connected minute counts).</summary>
    public const int OnlineHourMinutes = 60;
    public const int OnlineHourCredits = 1;
    /// <summary>Max online-hour credits per UTC day.</summary>
    public const int OnlineHoursMaxPerDay = 24;
    /// <summary>Only the first N kills of each monster species count toward farm credits.</summary>
    public const int FarmSpeciesKillCap = 100;
    /// <summary>HP anchor: 1 Ettin-sized kill ≈ 1 farm credit (before species cap).</summary>
    public const int FarmReferenceHpEttin = 1376;
    /// <summary>HP anchor: slime (~7 HP). 100 capped slimes ≈ 10 farm credits.</summary>
    public const int FarmReferenceHpSlime = 7;
    /// <summary>Credits per slime kill under the power-law curve (100 × 0.1 = 10 at cap).</summary>
    public const double FarmSlimeCreditsPerKill = 0.1;
    /// <summary>≥ this many distinct monster catalog ids → double all credits that day.</summary>
    public const int TestingUniqueMonsterClassesForDouble = 10;
    /// <summary>+10 credits per eligible EK during testing week only (does not count toward post-TGE EK ladder).</summary>
    public const int TestingEkCreditsPerKill = 10;
    /// <summary>Max EKs that award testing credits per UTC day.</summary>
    public const int TestingEkCreditCap = 10;

    // ── Post-testing / production paths (kept for after HELL_TESTING_WEEK) ──
    public static int MonsterKillThreshold => IsTestingWeekActive() ? FarmSpeciesKillCap : 500;
    public const int MonsterKillCredits = 10;

    // Legacy constants (old 4h AFK / flat 100-kill blocks) — kept so old reports still deserialize meaning.
    public const int AfkBlockMinutes = OnlineHourMinutes;
    public const int AfkBlockCredits = OnlineHourCredits;
    public const int AfkBlocksMaxPerDay = OnlineHoursMaxPerDay;
    public const int TestingMonsterKillsPerCreditBlock = FarmSpeciesKillCap;
    public const int TestingMonsterCreditsPerBlock = 10;
    public const int TestingMonsterCreditsCap = 10_000;
    public const int LegendaryEkCredits = 5;
    public const long LegendaryEkTokens = 1_000L;
    public const long LegendaryEkTokenCapPerDay = 5_000L;
    public const int Top100EkCredits = 3;
    public const long Top100EkTokens = 300L;
    public const int EventCredits = 5;
    public const long EventTokens = 100L;
    /// <summary>When true, daily token budget is fully shared among wallets that showed any activity that day.</summary>
    public static bool FullDailyPoolToActivePlayers => true;

    static readonly object Gate = new();
    static HellMiningFile file = new();
    static string? persistDirectory;
    static long lastPersistMs;
    static long lastTickMs;

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>Loads JSON state from the server Chars directory (or creates empty with full 400M pool).</summary>
    public static void Initialize(string charsDirectory) {
        ArgumentException.ThrowIfNullOrWhiteSpace(charsDirectory);
        Directory.CreateDirectory(charsDirectory);
        persistDirectory = charsDirectory;
        lock (Gate) {
            file = new HellMiningFile();
            TryLoadLocked();
            if (file.RemainingPool <= 0 && file.Wallets.Count == 0 && file.Days.Count == 0) {
                file.RemainingPool = TotalMiningPool;
            }
            PersistLocked();
        }
        Console.WriteLine(
            $"[HellMining] Initialized (pool remaining {file.RemainingPool:N0}, {file.Wallets.Count} wallet row(s)). Play-mine only — stake does not mint (C1).");
    }

    /// <summary>Periodic UTC-day settle + flush. Safe to call from any world tick.</summary>
    public static void Tick(long nowMs) {
        lock (Gate) {
            if (nowMs - lastTickMs < 5_000) {
                return;
            }
            lastTickMs = nowMs;
            SettlePastDaysLocked(nowMs);
            if (nowMs - lastPersistMs >= 15_000) {
                PersistLocked();
                lastPersistMs = nowMs;
            }
        }
    }

    public static string UtcDayKey(long nowMs) {
        return DateTimeOffset.FromUnixTimeMilliseconds(nowMs).UtcDateTime.ToString("yyyy-MM-dd");
    }

    public static HellMiningWalletSnapshot GetSnapshot(string? accountWallet, long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            EnsureDayLocked(dayKey);
            file.Days.TryGetValue(dayKey, out var day);
            HellMiningDayWallet? dayRow = null;
            if (day is not null && !string.IsNullOrEmpty(wallet)) {
                day.Wallets.TryGetValue(wallet, out dayRow);
            }
            long pending = 0;
            long claimed = 0;
            if (!string.IsNullOrEmpty(wallet) && file.Wallets.TryGetValue(wallet, out var row)) {
                pending = row.PendingHell;
                claimed = row.ClaimedHell;
            }
            return new HellMiningWalletSnapshot(
                PendingHell: pending,
                ClaimedHell: claimed,
                RemainingPool: file.RemainingPool,
                UtcDay: dayKey,
                TodayCredits: dayRow?.Credits ?? 0,
                TodayMonsterKills: dayRow?.MonsterKills ?? 0,
                TodayMonsterCreditGranted: dayRow?.MonsterCreditGranted ?? false,
                TodayEkDirectTokens: dayRow?.EkDirectTokens ?? 0,
                TodayEventDirectTokens: dayRow?.EventDirectTokens ?? 0,
                TodayDirectTokens: dayRow?.DirectTokens ?? 0,
                TodaySettled: day?.Settled ?? false,
                ClaimAvailable: !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HELL_MINT")));
        }
    }

    /// <summary>True during public testing week (env <c>HELL_TESTING_WEEK=1</c> or until <c>HELL_TESTING_WEEK_UNTIL</c> UTC date).</summary>
    public static bool IsTestingWeekActive(long? nowMs = null) {
        if (PlaytestMode.IsEnabled) {
            return false;
        }
        var flag = Environment.GetEnvironmentVariable("HELL_TESTING_WEEK");
        if (string.Equals(flag, "1", StringComparison.Ordinal) ||
            string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase)) {
            return true;
        }
        var until = Environment.GetEnvironmentVariable("HELL_TESTING_WEEK_UNTIL");
        if (!string.IsNullOrWhiteSpace(until) &&
            DateTime.TryParse(until.Trim(), out var untilDate)) {
            var now = nowMs.HasValue
                ? DateTimeOffset.FromUnixTimeMilliseconds(nowMs.Value).UtcDateTime.Date
                : DateTime.UtcNow.Date;
            return now <= untilDate.ToUniversalTime().Date;
        }
        // Default: treat as testing week through 2026-07-31 UTC if no env set (ops can override).
        var defaultUntil = new DateTime(2026, 7, 31, 0, 0, 0, DateTimeKind.Utc);
        var today = nowMs.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(nowMs.Value).UtcDateTime.Date
            : DateTime.UtcNow.Date;
        return today <= defaultUntil;
    }

    /// <summary>
    /// First presence of the UTC day: +1 participation credit + mark character name.
    /// Ensures players who only log in still enter the daily credit-share pool.
    /// </summary>
    public static HellMiningCreditResult RecordDailyPresence(
        string? accountWallet,
        string? characterName,
        long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(characterName)) {
                row.CharacterName = characterName.Trim();
            }
            if (row.LoginCreditGranted) {
                SchedulePersistLocked(nowMs);
                return HellMiningCreditResult.Ignored(null);
            }
            row.LoginCreditGranted = true;
            AddCreditsLocked(day, row, LoginParticipationCredits);
            AppendPresenceLogLocked(dayKey, wallet, characterName, "login", row.ConnectedMinutes, row.MonsterKills, row.EkCount, row.Credits);
            // Always flush login — never lose first-of-day presence on crash/redeploy.
            PersistLocked();
            lastPersistMs = nowMs;
            return new HellMiningCreditResult(
                true,
                LoginParticipationCredits,
                0,
                $"Daily login +{LoginParticipationCredits} mining credit.");
        }
    }

    /// <summary>
    /// Adds connected minutes; awards +1 credit per full hour online (AFK or active), max 24/day.
    /// Also ensures login credit if missing.
    /// </summary>
    public static HellMiningCreditResult RecordConnectedMinutes(
        string? accountWallet,
        string? characterName,
        int minutes,
        long nowMs) {
        if (minutes <= 0) {
            return HellMiningCreditResult.Ignored(null);
        }
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(characterName)) {
                row.CharacterName = characterName.Trim();
            }
            row.ConnectedMinutes = SaturateAddInt(row.ConnectedMinutes, minutes);

            // Login credit if first presence came only via heartbeat.
            var loginGrantedNow = 0;
            if (!row.LoginCreditGranted) {
                row.LoginCreditGranted = true;
                AddCreditsLocked(day, row, LoginParticipationCredits);
                loginGrantedNow = LoginParticipationCredits;
            }

            // Presence sidecar every minute so reports can reconstruct who was online even if ledger is wiped.
            if (row.ConnectedMinutes % 5 == 0 || loginGrantedNow > 0) {
                AppendPresenceLogLocked(dayKey, wallet, characterName, "minute", row.ConnectedMinutes, row.MonsterKills, row.EkCount, row.Credits);
            }

            if (!IsTestingWeekActive(nowMs)) {
                // Still count minutes + login outside testing week; flush often so day rows exist.
                if (loginGrantedNow > 0 || row.ConnectedMinutes % 5 == 0) {
                    PersistLocked();
                    lastPersistMs = nowMs;
                } else {
                    SchedulePersistLocked(nowMs);
                }
                if (loginGrantedNow > 0) {
                    return new HellMiningCreditResult(
                        true,
                        loginGrantedNow,
                        0,
                        $"Daily login +{loginGrantedNow} mining credit.");
                }
                return HellMiningCreditResult.Ignored(null);
            }

            // Online presence: +1 per full hour connected (AFK counts), max 24/day.
            // Prefer OnlineHoursGranted when set; else legacy AfkBlocksGranted (old 4h field, pre-migration).
            var hoursAlready = row.OnlineHoursGranted > 0
                ? row.OnlineHoursGranted
                : row.AfkBlocksGranted;
            var hoursEarned = Math.Min(OnlineHoursMaxPerDay, row.ConnectedMinutes / OnlineHourMinutes);
            var newHours = hoursEarned - hoursAlready;
            if (newHours <= 0) {
                // Persist every 5 connected minutes so redeploys cannot erase a whole farm day.
                if (loginGrantedNow > 0 || row.ConnectedMinutes % 5 == 0) {
                    PersistLocked();
                    lastPersistMs = nowMs;
                } else {
                    SchedulePersistLocked(nowMs);
                }
                if (loginGrantedNow > 0) {
                    return new HellMiningCreditResult(
                        true,
                        loginGrantedNow,
                        0,
                        $"Daily login +{loginGrantedNow} mining credit.");
                }
                return HellMiningCreditResult.Ignored(null);
            }
            row.OnlineHoursGranted = hoursEarned;
            row.AfkBlocksGranted = hoursEarned; // keep legacy field in sync for reports
            var grant = newHours * OnlineHourCredits;
            AddCreditsLocked(day, row, grant);
            var totalApplied = grant + loginGrantedNow;
            AppendPresenceLogLocked(dayKey, wallet, characterName, "hour", row.ConnectedMinutes, row.MonsterKills, row.EkCount, row.Credits);
            PersistLocked();
            lastPersistMs = nowMs;
            return new HellMiningCreditResult(
                true,
                totalApplied,
                0,
                $"+{grant} mining credit(s) ({newHours}h online — AFK counts). Total hours today: {hoursEarned}/{OnlineHoursMaxPerDay}.");
        }
    }

    /// <summary>
    /// Eligible open-world EK during testing week: +10 credits each, max 10/day.
    /// Does <b>not</b> award direct tokens and does not feed post-TGE EK ladders.
    /// Outside testing week: count only (legacy legendary/top100 paths handle awards).
    /// </summary>
    public static HellMiningCreditResult RecordEkCount(string? accountWallet, string? characterName, long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            if (!string.IsNullOrWhiteSpace(characterName)) {
                row.CharacterName = characterName.Trim();
            }
            if (row.EkCount < int.MaxValue) {
                row.EkCount++;
            }

            if (!IsTestingWeekActive(nowMs)) {
                SchedulePersistLocked(nowMs);
                return HellMiningCreditResult.Ignored(null);
            }

            // Testing week: credits only, capped; never direct tokens / ladder legacy awards.
            if (row.EkCreditsGranted >= TestingEkCreditCap) {
                SchedulePersistLocked(nowMs);
                return HellMiningCreditResult.Ignored($"EK credit cap ({TestingEkCreditCap}/day) reached.");
            }
            row.EkCreditsGranted++;
            AddCreditsLocked(day, row, TestingEkCreditsPerKill);
            AppendPresenceLogLocked(dayKey, wallet, characterName, "ek", row.ConnectedMinutes, row.MonsterKills, row.EkCount, row.Credits);
            PersistLocked();
            lastPersistMs = nowMs;
            return new HellMiningCreditResult(
                true,
                TestingEkCreditsPerKill,
                0,
                $"+{TestingEkCreditsPerKill} mining credits (EK {row.EkCreditsGranted}/{TestingEkCreditCap} today — testing only, not post-TGE ladder).");
        }
    }

    /// <summary>
    /// Monster kill. Testing week: HP-weighted farm credits, max <see cref="FarmSpeciesKillCap"/> kills
    /// per catalog species; ≥10 unique classes doubles credits. Soft farm (slime) ≈ 10 cr at cap;
    /// 1 Ettin-tier kill ≈ 1 credit.
    /// </summary>
    public static HellMiningCreditResult RecordMonsterKill(
        string? accountWallet,
        long nowMs,
        int catalogMonsterId = 0,
        int monsterMaxHp = 0) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            if (row.MonsterKills < int.MaxValue) {
                row.MonsterKills++;
            }

            if (catalogMonsterId > 0) {
                row.UniqueMonsterIds ??= new List<int>();
                if (!row.UniqueMonsterIds.Contains(catalogMonsterId)) {
                    row.UniqueMonsterIds.Add(catalogMonsterId);
                }
            }

            string? diversityNote = null;
            int totalGranted = 0;

            if (IsTestingWeekActive(nowMs)) {
                // Cap 100 kills per species that contribute millicredits; weight by monster HP.
                var speciesKey = catalogMonsterId > 0 ? catalogMonsterId : 0;
                row.MonsterKillsById ??= new Dictionary<int, int>();
                row.MonsterKillsById.TryGetValue(speciesKey, out var speciesKillsBefore);
                var speciesKillsAfter = speciesKillsBefore < int.MaxValue ? speciesKillsBefore + 1 : int.MaxValue;
                row.MonsterKillsById[speciesKey] = speciesKillsAfter;

                if (speciesKillsBefore < FarmSpeciesKillCap) {
                    var hp = monsterMaxHp > 0 ? monsterMaxHp : FarmReferenceHpSlime;
                    var milli = FarmMillicreditsPerKill(hp);
                    row.FarmMillicredits = SaturateAddLong(row.FarmMillicredits, milli);
                }

                // Target farm credits from millicredits; never claw back pre-rule-change earnings.
                var targetFromHp = (int)Math.Min(int.MaxValue, row.FarmMillicredits / 1000L);
                var targetMonsterCredits = Math.Max(row.MonsterCreditsEarned, targetFromHp);
                var delta = targetMonsterCredits - row.MonsterCreditsEarned;
                if (delta > 0) {
                    row.MonsterCreditsEarned = targetMonsterCredits;
                    row.MonsterCreditGranted = true;
                    AddCreditsLocked(day, row, delta);
                    totalGranted += row.DiversityDoubled ? delta * 2 : delta;
                }

                // After awards: ≥10 distinct classes → double all credits for the rest of the day.
                if (!row.DiversityDoubled &&
                    row.UniqueMonsterIds is { Count: >= TestingUniqueMonsterClassesForDouble }) {
                    row.DiversityDoubled = true;
                    var extra = row.Credits; // base total still pre-double
                    if (extra > 0) {
                        row.Credits = SaturateAddInt(row.Credits, extra);
                        day.TotalCredits = SaturateAddInt(day.TotalCredits, extra);
                        totalGranted += extra;
                    }
                    diversityNote =
                        $"Diversity bonus: {TestingUniqueMonsterClassesForDouble}+ monster classes — credits doubled for the day!";
                }

                // Flush every 10 kills or on credit grant so farm days cannot vanish on redeploy.
                if (totalGranted > 0 || row.MonsterKills % 10 == 0) {
                    if (row.MonsterKills % 10 == 0) {
                        AppendPresenceLogLocked(dayKey, wallet, row.CharacterName, "farm", row.ConnectedMinutes, row.MonsterKills, row.EkCount, row.Credits);
                    }
                    PersistLocked();
                    lastPersistMs = nowMs;
                } else {
                    SchedulePersistLocked(nowMs);
                }
                if (totalGranted > 0 || diversityNote is not null) {
                    var cappedNote = speciesKillsAfter > FarmSpeciesKillCap
                        ? $" (species cap {FarmSpeciesKillCap})"
                        : "";
                    var msg = totalGranted > 0
                        ? $"+{totalGranted} mining credits (farm HP-weighted{cappedNote}; farm {row.MonsterCreditsEarned} cr, kills {row.MonsterKills}, classes {row.UniqueMonsterIds?.Count ?? 0})"
                        : "";
                    if (diversityNote is not null) {
                        msg = string.IsNullOrEmpty(msg) ? diversityNote : msg + " · " + diversityNote;
                    }
                    return new HellMiningCreditResult(true, totalGranted, 0, msg);
                }
                return HellMiningCreditResult.Ignored(null);
            }

            // Production path: single threshold award.
            var threshold = MonsterKillThreshold;
            if (!row.MonsterCreditGranted && row.MonsterKills >= threshold) {
                row.MonsterCreditGranted = true;
                AddCreditsLocked(day, row, MonsterKillCredits);
                SchedulePersistLocked(nowMs);
                return new HellMiningCreditResult(
                    true,
                    MonsterKillCredits,
                    0,
                    $"Monster threshold ({threshold}) +{MonsterKillCredits} mining credits.");
            }
            SchedulePersistLocked(nowMs);
            return HellMiningCreditResult.Ignored(null);
        }
    }

    /// <summary>
    /// Millicredits (1/1000 credit) awarded for one kill of a monster with the given max HP.
    /// Power-law between slime (0.1 cr/kill) and ettin (1.0 cr/kill).
    /// </summary>
    public static int FarmMillicreditsPerKill(int monsterMaxHp) {
        var hp = Math.Max(1, monsterMaxHp);
        // a = ln(0.1) / ln(7/1376) so slime→0.1 and ettin→1.0 exactly.
        var a = Math.Log(FarmSlimeCreditsPerKill) /
                Math.Log((double)FarmReferenceHpSlime / FarmReferenceHpEttin);
        var weight = Math.Pow(hp / (double)FarmReferenceHpEttin, a);
        var milli = (int)Math.Round(weight * 1000.0);
        return Math.Clamp(milli, 1, 50_000);
    }

    /// <summary>
    /// Legendary EK direct-token path — <b>disabled during testing week</b>
    /// (testing EKs only give credits via <see cref="RecordEkCount"/>).
    /// </summary>
    public static HellMiningCreditResult RecordLegendaryEk(string? accountWallet, long nowMs) {
        if (IsTestingWeekActive(nowMs)) {
            return HellMiningCreditResult.Ignored("Testing week: EK ladder tokens disabled (credits via EK cap only).");
        }
        return RecordEkAward(
            accountWallet,
            nowMs,
            LegendaryEkCredits,
            LegendaryEkTokens,
            ekTokenCap: LegendaryEkTokenCapPerDay,
            label: "Legendary EK");
    }

    /// <summary>EK top-100 path — disabled during testing week.</summary>
    public static HellMiningCreditResult RecordTop100Ek(string? accountWallet, long nowMs) {
        if (IsTestingWeekActive(nowMs)) {
            return HellMiningCreditResult.Ignored("Testing week: EK ladder tokens disabled (credits via EK cap only).");
        }
        return RecordEkAward(
            accountWallet,
            nowMs,
            Top100EkCredits,
            Top100EkTokens,
            ekTokenCap: null,
            label: "EK top 100");
    }

    /// <summary>Adds credits respecting the diversity double (if already active, grant is 2×).</summary>
    static void AddCreditsLocked(HellMiningDay day, HellMiningDayWallet row, int baseAmount) {
        if (baseAmount <= 0) {
            return;
        }
        var grant = row.DiversityDoubled ? baseAmount * 2 : baseAmount;
        row.Credits = SaturateAddInt(row.Credits, grant);
        day.TotalCredits = SaturateAddInt(day.TotalCredits, grant);
    }

    /// <summary>Game event participation (e.g. Timed Challenge clear): +5 credits and +100 pending tokens once per wallet per UTC day.</summary>
    public static HellMiningCreditResult RecordEventParticipation(string? accountWallet, long nowMs) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            if (row.EventParticipated) {
                return HellMiningCreditResult.Ignored("Event credit already granted today.");
            }
            // Testing week: event = credits only (no direct tokens); post-testing keeps direct awards.
            long direct = 0;
            if (!IsTestingWeekActive(nowMs)) {
                direct = TryAwardDirectLocked(day, row, EventTokens);
                row.EventDirectTokens = SaturateAddLong(row.EventDirectTokens, direct);
            }
            row.EventParticipated = true;
            AddCreditsLocked(day, row, EventCredits);
            SchedulePersistLocked(nowMs);
            return new HellMiningCreditResult(
                true,
                EventCredits,
                direct,
                $"Event +{EventCredits} credits" + (direct > 0 ? $" +{direct} $HELL pending." : "."));
        }
    }

    /// <summary>
    /// Settles credit-share for any UTC day before today. Direct tokens were already moved to pending.
    /// Credit pool = min(DailyTokenCap − dayDirectSpent, remaining pool), split by credits.
    /// </summary>
    public static void SettlePastDays(long nowMs) {
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
        }
    }

    /// <summary>Force-settle a specific day (ops / tests). No-op if already settled or day is today and forceToday is false.</summary>
    public static bool ForceSettleDay(string dayKey, long nowMs, bool allowToday = false) {
        lock (Gate) {
            var today = UtcDayKey(nowMs);
            if (!allowToday && string.Equals(dayKey, today, StringComparison.Ordinal)) {
                return false;
            }
            if (!file.Days.TryGetValue(dayKey, out var day) || day.Settled) {
                return false;
            }
            SettleDayLocked(dayKey, day);
            PersistLocked();
            return true;
        }
    }

    /// <summary>
    /// Spends pending $HELL credits for cash-shop / utility purchases (not claim-to-mint).
    /// Does not require HELL_MINT env — balance is server-side pending only.
    /// </summary>
    public static bool TrySpendPending(string? accountWallet, long amount, out string message) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            message = "No wallet.";
            return false;
        }
        if (amount <= 0) {
            message = "Amount must be positive.";
            return false;
        }
        lock (Gate) {
            if (!file.Wallets.TryGetValue(wallet, out var row) || row.PendingHell < amount) {
                var have = file.Wallets.TryGetValue(wallet, out var existing) ? existing.PendingHell : 0;
                message = $"Need {amount} pending $HELL (you have {have}).";
                return false;
            }
            row.PendingHell -= amount;
            PersistLocked();
            message = $"Spent {amount} pending $HELL.";
            return true;
        }
    }

    /// <summary>Grant pending $HELL (Garden quests, events). Does not touch daily credit pool.</summary>
    public static void GrantPendingHell(string? accountWallet, long amount) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet) || amount <= 0) {
            return;
        }
        lock (Gate) {
            var row = EnsureWalletLocked(wallet);
            row.PendingHell = SaturateAddLong(row.PendingHell, amount);
            PersistLocked();
        }
        Console.WriteLine($"[HellMining] Granted {amount} pending $HELL to {wallet[..Math.Min(8, wallet.Length)]}…");
    }

    /// <summary>Refund a failed cash-shop grant after <see cref="TrySpendPending"/>.</summary>
    public static void RefundPendingSpend(string? accountWallet, long amount) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet) || amount <= 0) {
            return;
        }
        lock (Gate) {
            var row = EnsureWalletLocked(wallet);
            row.PendingHell = SaturateAddLong(row.PendingHell, amount);
            PersistLocked();
        }
    }

    /// <summary>
    /// Reserves <paramref name="amount"/> from pending for an on-chain claim.
    /// Returns false if insufficient pending or mint claim is not configured.
    /// </summary>
    public static bool TryBeginClaim(string? accountWallet, long amount, out long reserved, out string message) {
        reserved = 0;
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            message = "No wallet.";
            return false;
        }
        if (amount <= 0) {
            message = "Claim amount must be positive.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("HELL_MINT"))) {
            message = "Claim opens when the $HELL mint is live. Your pending mining balance stays on the server until then.";
            return false;
        }
        lock (Gate) {
            if (!file.Wallets.TryGetValue(wallet, out var row) || row.PendingHell < amount) {
                message = "Insufficient pending $HELL.";
                return false;
            }
            row.PendingHell -= amount;
            row.ClaimedHell = SaturateAddLong(row.ClaimedHell, amount);
            reserved = amount;
            PersistLocked();
            message = $"Reserved {amount} $HELL for claim. Complete payout via middleware.";
            return true;
        }
    }

    /// <summary>Returns pending to the wallet if middleware payout failed after TryBeginClaim.</summary>
    public static void RefundClaim(string? accountWallet, long amount) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet) || amount <= 0) {
            return;
        }
        lock (Gate) {
            var row = EnsureWalletLocked(wallet);
            row.PendingHell = SaturateAddLong(row.PendingHell, amount);
            row.ClaimedHell = Math.Max(0, row.ClaimedHell - amount);
            PersistLocked();
        }
    }

    /// <summary>Absolute path to the ledger JSON (middleware claim can share this file on the same host).</summary>
    public static string? LedgerPath =>
        persistDirectory is null ? null : Path.Combine(persistDirectory, "hell-mining.json");

    static HellMiningCreditResult RecordEkAward(
        string? accountWallet,
        long nowMs,
        int credits,
        long tokenAmount,
        long? ekTokenCap,
        string label) {
        var wallet = NormalizeWallet(accountWallet);
        if (string.IsNullOrEmpty(wallet)) {
            return HellMiningCreditResult.Ignored("No wallet.");
        }
        lock (Gate) {
            SettlePastDaysLocked(nowMs);
            var dayKey = UtcDayKey(nowMs);
            var day = EnsureDayLocked(dayKey);
            if (day.Settled) {
                return HellMiningCreditResult.Ignored("Day already settled.");
            }
            var row = EnsureDayWalletLocked(day, wallet);
            long awardTokens = tokenAmount;
            if (ekTokenCap.HasValue) {
                var room = ekTokenCap.Value - row.EkDirectTokens;
                if (room <= 0) {
                    awardTokens = 0;
                } else if (awardTokens > room) {
                    awardTokens = room;
                }
            }
            var direct = TryAwardDirectLocked(day, row, awardTokens);
            row.EkDirectTokens = SaturateAddLong(row.EkDirectTokens, direct);
            row.Credits = SaturateAddInt(row.Credits, credits);
            day.TotalCredits = SaturateAddInt(day.TotalCredits, credits);
            SchedulePersistLocked(nowMs);
            return new HellMiningCreditResult(
                true,
                credits,
                direct,
                $"{label} +{credits} credits" + (direct > 0 ? $" +{direct} $HELL pending." : "."));
        }
    }

    static long TryAwardDirectLocked(HellMiningDay day, HellMiningDayWallet dayRow, long requested) {
        if (requested <= 0) {
            return 0;
        }
        var dayRoom = DailyTokenCap - day.DirectSpent;
        if (dayRoom <= 0 || file.RemainingPool <= 0) {
            return 0;
        }
        var grant = requested;
        if (grant > dayRoom) {
            grant = dayRoom;
        }
        if (grant > file.RemainingPool) {
            grant = file.RemainingPool;
        }
        if (grant <= 0) {
            return 0;
        }
        day.DirectSpent += grant;
        file.RemainingPool -= grant;
        dayRow.DirectTokens = SaturateAddLong(dayRow.DirectTokens, grant);
        var walletRow = EnsureWalletLocked(dayRow.Wallet);
        walletRow.PendingHell = SaturateAddLong(walletRow.PendingHell, grant);
        return grant;
    }

    static void SettlePastDaysLocked(long nowMs) {
        var today = UtcDayKey(nowMs);
        foreach (var (dayKey, day) in file.Days.ToList()) {
            if (day.Settled) {
                continue;
            }
            if (string.CompareOrdinal(dayKey, today) >= 0) {
                continue;
            }
            SettleDayLocked(dayKey, day);
        }
    }

    static void SettleDayLocked(string dayKey, HellMiningDay day) {
        if (day.Settled) {
            return;
        }
        long creditPool = DailyTokenCap - day.DirectSpent;
        if (creditPool < 0) {
            creditPool = 0;
        }
        if (creditPool > file.RemainingPool) {
            creditPool = file.RemainingPool;
        }

        // Active = any play signal that day (credits, minutes, kills, EKs).
        // If only a few chars show up, they still share the full remaining daily budget.
        var active = day.Wallets.Values
            .Where(IsActiveDayWallet)
            .ToList();

        long distributed = 0;
        if (creditPool > 0 && active.Count > 0) {
            // Prefer credit-weighted split when anyone earned credits; else activity-weighted
            // (minutes + kills + EKs) so "acciones mínimas" still divide the day pool.
            var useCredits = day.TotalCredits > 0 && active.Any(r => r.Credits > 0);
            long weightSum = 0;
            foreach (var row in active) {
                weightSum += useCredits ? Math.Max(0, row.Credits) : ActivityWeight(row);
            }
            if (weightSum <= 0) {
                weightSum = active.Count;
                useCredits = false;
            }

            // Integer shares + remainder to highest weight so the full daily budget is spent.
            var ordered = active
                .OrderByDescending(r => useCredits ? r.Credits : ActivityWeight(r))
                .ThenBy(r => r.Wallet, StringComparer.OrdinalIgnoreCase)
                .ToList();
            long assigned = 0;
            for (var i = 0; i < ordered.Count; i++) {
                var row = ordered[i];
                long w = useCredits ? Math.Max(0, row.Credits) : ActivityWeight(row);
                if (w <= 0) {
                    w = 1;
                }
                long share;
                if (i == ordered.Count - 1) {
                    share = creditPool - assigned;
                } else {
                    share = creditPool * w / weightSum;
                    assigned += share;
                }
                if (share <= 0) {
                    continue;
                }
                var walletRow = EnsureWalletLocked(row.Wallet);
                walletRow.PendingHell = SaturateAddLong(walletRow.PendingHell, share);
                row.SettledShare = SaturateAddLong(row.SettledShare, share);
                distributed += share;
            }
            file.RemainingPool -= distributed;
            day.CreditPoolDistributed = distributed;
        }

        day.Settled = true;
        day.SettledAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        Console.WriteLine(
            $"[HellMining] Settled {dayKey}: active={active.Count}, credits={day.TotalCredits}, direct={day.DirectSpent}, creditShare={day.CreditPoolDistributed}, poolLeft={file.RemainingPool}.");
    }

    static bool IsActiveDayWallet(HellMiningDayWallet row) =>
        row.Credits > 0 ||
        row.ConnectedMinutes > 0 ||
        row.MonsterKills > 0 ||
        row.EkCount > 0 ||
        row.LoginCreditGranted ||
        row.DirectTokens > 0;

    /// <summary>Activity weight when credits are all zero: minutes + kills + 5×EKs (min 1).</summary>
    static long ActivityWeight(HellMiningDayWallet row) {
        long w = Math.Max(0, row.ConnectedMinutes)
            + Math.Max(0, row.MonsterKills)
            + Math.Max(0, row.EkCount) * 5L;
        return w <= 0 ? 1 : w;
    }

    /// <summary>Builds a plain report for a settled or live UTC day (ops / Sheets / email).</summary>
    public static HellMiningDayReport BuildDayReport(string dayKey) {
        lock (Gate) {
            file.Days.TryGetValue(dayKey, out var day);
            day ??= new HellMiningDay { UtcDay = dayKey };
            var wallets = day.Wallets.Values
                .OrderByDescending(w => w.SettledShare)
                .ThenByDescending(w => w.Credits)
                .ThenByDescending(w => w.ConnectedMinutes)
                .Select(w => {
                    file.Wallets.TryGetValue(w.Wallet, out var bal);
                    return new HellMiningDayWalletReport(
                        w.Wallet,
                        w.CharacterName ?? "",
                        w.ConnectedMinutes,
                        w.MonsterKills,
                        w.EkCount,
                        w.Credits,
                        w.DirectTokens,
                        w.SettledShare,
                        bal?.PendingHell ?? 0,
                        bal?.ClaimedHell ?? 0,
                        w.LoginCreditGranted,
                        w.MonsterCreditGranted,
                        w.EventParticipated,
                        w.UniqueMonsterIds?.Count ?? 0,
                        w.DiversityDoubled,
                        w.OnlineHoursGranted > 0 ? w.OnlineHoursGranted : w.AfkBlocksGranted,
                        w.EkCreditsGranted,
                        w.MonsterCreditsEarned);
                })
                .ToList();
            return new HellMiningDayReport(
                dayKey,
                day.Settled,
                day.SettledAtMs,
                day.TotalCredits,
                day.DirectSpent,
                day.CreditPoolDistributed,
                file.RemainingPool,
                DailyTokenCap,
                wallets);
        }
    }

    /// <summary>Writes <c>Chars/reports/mining-YYYY-MM-DD.json</c> (+ .csv) for ops automation.</summary>
    public static string? WriteDayReportFiles(string dayKey) {
        if (persistDirectory is null) {
            return null;
        }
        var report = BuildDayReport(dayKey);
        var dir = Path.Combine(persistDirectory, "reports");
        Directory.CreateDirectory(dir);
        var jsonPath = Path.Combine(dir, $"mining-{dayKey}.json");
        var csvPath = Path.Combine(dir, $"mining-{dayKey}.csv");
        try {
            var json = JsonSerializer.Serialize(report, JsonOptions);
            File.WriteAllText(jsonPath, json);
            var csv = new System.Text.StringBuilder();
            csv.AppendLine(
                "utcDay,wallet,characterName,connectedMinutes,monsterKills,ekCount,credits,directTokens,settledShare,pendingHell,claimedHell,loginCredit,monsterCredit,eventParticipated,daySettled,dayDirectSpent,dayCreditPool,remainingPool");
            foreach (var w in report.Wallets) {
                csv.Append(dayKey).Append(',')
                    .Append(Csv(w.Wallet)).Append(',')
                    .Append(Csv(w.CharacterName)).Append(',')
                    .Append(w.ConnectedMinutes).Append(',')
                    .Append(w.MonsterKills).Append(',')
                    .Append(w.EkCount).Append(',')
                    .Append(w.Credits).Append(',')
                    .Append(w.DirectTokens).Append(',')
                    .Append(w.SettledShare).Append(',')
                    .Append(w.PendingHell).Append(',')
                    .Append(w.ClaimedHell).Append(',')
                    .Append(w.LoginCreditGranted).Append(',')
                    .Append(w.MonsterCreditGranted).Append(',')
                    .Append(w.EventParticipated).Append(',')
                    .Append(report.Settled).Append(',')
                    .Append(report.DirectSpent).Append(',')
                    .Append(report.CreditPoolDistributed).Append(',')
                    .Append(report.RemainingPool)
                    .AppendLine();
            }
            File.WriteAllText(csvPath, csv.ToString());
            return jsonPath;
        } catch (Exception ex) {
            Console.Error.WriteLine($"[HellMining] Report write failed: {ex.Message}");
            return null;
        }
    }

    static string Csv(string? value) {
        var v = value ?? "";
        if (v.Contains('"') || v.Contains(',') || v.Contains('\n')) {
            return "\"" + v.Replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    static HellMiningDay EnsureDayLocked(string dayKey) {
        if (!file.Days.TryGetValue(dayKey, out var day)) {
            day = new HellMiningDay { UtcDay = dayKey };
            file.Days[dayKey] = day;
        }
        return day;
    }

    static HellMiningDayWallet EnsureDayWalletLocked(HellMiningDay day, string wallet) {
        if (!day.Wallets.TryGetValue(wallet, out var row)) {
            row = new HellMiningDayWallet { Wallet = wallet };
            day.Wallets[wallet] = row;
        }
        return row;
    }

    static HellMiningWallet EnsureWalletLocked(string wallet) {
        if (!file.Wallets.TryGetValue(wallet, out var row)) {
            row = new HellMiningWallet { Wallet = wallet };
            file.Wallets[wallet] = row;
        }
        return row;
    }

    static void SchedulePersistLocked(long nowMs) {
        if (nowMs - lastPersistMs >= 2_000) {
            PersistLocked();
            lastPersistMs = nowMs;
        }
    }

    /// <summary>
    /// Append-only presence line (survives ledger wipes/redeploys). Used so daily reports can never
    /// claim "0 activity" when travelers were online. One line per credit-bearing event or ≥1 min tick.
    /// </summary>
    static void AppendPresenceLogLocked(
        string dayKey,
        string wallet,
        string? characterName,
        string kind,
        int connectedMinutes,
        int monsterKills,
        int ekCount,
        int credits) {
        if (persistDirectory is null) {
            return;
        }
        try {
            var dir = Path.Combine(persistDirectory, "presence-log");
            Directory.CreateDirectory(dir);
            var path = Path.Combine(dir, $"presence-{dayKey}.jsonl");
            var name = (characterName ?? "").Replace('\n', ' ').Replace('\r', ' ');
            var line =
                $"{{\"ts\":\"{DateTime.UtcNow:O}\",\"day\":\"{dayKey}\",\"wallet\":\"{wallet}\",\"name\":\"{name}\",\"kind\":\"{kind}\",\"mins\":{connectedMinutes},\"kills\":{monsterKills},\"ek\":{ekCount},\"credits\":{credits}}}\n";
            File.AppendAllText(path, line);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[HellMining] Presence log append failed: {ex.Message}");
        }
    }

    static void TryLoadLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "hell-mining.json");
        if (!File.Exists(path)) {
            return;
        }
        try {
            var json = File.ReadAllText(path);
            var loaded = JsonSerializer.Deserialize<HellMiningFile>(json, JsonOptions);
            if (loaded is not null) {
                file = loaded;
                file.Days ??= new Dictionary<string, HellMiningDay>(StringComparer.Ordinal);
                file.Wallets ??= new Dictionary<string, HellMiningWallet>(StringComparer.OrdinalIgnoreCase);
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[HellMining] Failed to load ledger: {ex.Message}");
        }
    }

    static void PersistLocked() {
        if (persistDirectory is null) {
            return;
        }
        var path = Path.Combine(persistDirectory, "hell-mining.json");
        var tmp = path + ".tmp";
        try {
            var json = JsonSerializer.Serialize(file, JsonOptions);
            File.WriteAllText(tmp, json);
            File.Copy(tmp, path, overwrite: true);
            File.Delete(tmp);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[HellMining] Failed to persist ledger: {ex.Message}");
        }
    }

    static string NormalizeWallet(string? wallet) {
        return (wallet ?? string.Empty).Trim();
    }

    static int SaturateAddInt(int a, int b) {
        var sum = (long)a + b;
        if (sum > int.MaxValue) {
            return int.MaxValue;
        }
        if (sum < int.MinValue) {
            return int.MinValue;
        }
        return (int)sum;
    }

    static long SaturateAddLong(long a, long b) {
        if (b > 0 && a > long.MaxValue - b) {
            return long.MaxValue;
        }
        if (b < 0 && a < long.MinValue - b) {
            return long.MinValue;
        }
        return a + b;
    }
}

/// <summary>Per-wallet cumulative pending / claimed $HELL (whole tokens).</summary>
public sealed class HellMiningWallet {
    public string Wallet { get; set; } = "";
    public long PendingHell { get; set; }
    public long ClaimedHell { get; set; }
}

/// <summary>One wallet's counters inside a UTC mining day.</summary>
public sealed class HellMiningDayWallet {
    public string Wallet { get; set; } = "";
    public string? CharacterName { get; set; }
    /// <summary>Total mining credits for the day (includes diversity double when active).</summary>
    public int Credits { get; set; }
    public int MonsterKills { get; set; }
    public bool MonsterCreditGranted { get; set; }
    /// <summary>Credits earned from HP-weighted farm (pre-diversity-double).</summary>
    public int MonsterCreditsEarned { get; set; }
    /// <summary>Accumulated farm millicredits (1000 = 1 credit) from capped per-species kills.</summary>
    public long FarmMillicredits { get; set; }
    /// <summary>Kills per monster catalog id today (only first <see cref="HellMiningStore.FarmSpeciesKillCap"/> contribute millicredits).</summary>
    public Dictionary<int, int>? MonsterKillsById { get; set; }
    /// <summary>Distinct monster catalog ids killed today (diversity double at 10+).</summary>
    public List<int>? UniqueMonsterIds { get; set; }
    /// <summary>True after ≥10 unique monster classes — all further awards are 2× and past total was doubled once.</summary>
    public bool DiversityDoubled { get; set; }
    /// <summary>Eligible open-world Enemy Kills this UTC day (all rarities).</summary>
    public int EkCount { get; set; }
    /// <summary>How many EKs already paid the +10 testing credit (cap 10).</summary>
    public int EkCreditsGranted { get; set; }
    /// <summary>Approximate connected minutes this UTC day (1-minute heartbeats).</summary>
    public int ConnectedMinutes { get; set; }
    /// <summary>How many full online hours already paid (+1 each, max 24). Preferred over <see cref="AfkBlocksGranted"/>.</summary>
    public int OnlineHoursGranted { get; set; }
    /// <summary>Legacy field (old 4h blocks). Kept in sync with <see cref="OnlineHoursGranted"/> for reports.</summary>
    public int AfkBlocksGranted { get; set; }
    /// <summary>True after first presence credit of the day.</summary>
    public bool LoginCreditGranted { get; set; }
    public long EkDirectTokens { get; set; }
    public long EventDirectTokens { get; set; }
    public long DirectTokens { get; set; }
    public bool EventParticipated { get; set; }
    public long SettledShare { get; set; }
}

/// <summary>Ops / Sheets day report root.</summary>
public sealed record HellMiningDayReport(
    string UtcDay,
    bool Settled,
    long SettledAtMs,
    int TotalCredits,
    long DirectSpent,
    long CreditPoolDistributed,
    long RemainingPool,
    long DailyTokenCap,
    IReadOnlyList<HellMiningDayWalletReport> Wallets);

public sealed record HellMiningDayWalletReport(
    string Wallet,
    string CharacterName,
    int ConnectedMinutes,
    int MonsterKills,
    int EkCount,
    int Credits,
    long DirectTokens,
    long SettledShare,
    long PendingHell,
    long ClaimedHell,
    bool LoginCreditGranted,
    bool MonsterCreditGranted,
    bool EventParticipated,
    int UniqueMonsterClasses = 0,
    bool DiversityDoubled = false,
    int AfkBlocksGranted = 0,
    int EkCreditsGranted = 0,
    int MonsterCreditsEarned = 0);

/// <summary>UTC-day aggregate for credit settlement.</summary>
public sealed class HellMiningDay {
    public string UtcDay { get; set; } = "";
    public int TotalCredits { get; set; }
    public long DirectSpent { get; set; }
    public long CreditPoolDistributed { get; set; }
    public bool Settled { get; set; }
    public long SettledAtMs { get; set; }
    public Dictionary<string, HellMiningDayWallet> Wallets { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

/// <summary>Root ledger file shape.</summary>
public sealed class HellMiningFile {
    public long RemainingPool { get; set; } = HellMiningStore.TotalMiningPool;
    public Dictionary<string, HellMiningWallet> Wallets { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, HellMiningDay> Days { get; set; } = new(StringComparer.Ordinal);
}

/// <summary>Read model for UI / proto status.</summary>
public readonly record struct HellMiningWalletSnapshot(
    long PendingHell,
    long ClaimedHell,
    long RemainingPool,
    string UtcDay,
    int TodayCredits,
    int TodayMonsterKills,
    bool TodayMonsterCreditGranted,
    long TodayEkDirectTokens,
    long TodayEventDirectTokens,
    long TodayDirectTokens,
    bool TodaySettled,
    bool ClaimAvailable);

/// <summary>Result of a credit hook attempt.</summary>
public readonly record struct HellMiningCreditResult(bool Applied, int CreditsAdded, long TokensAdded, string? Message) {
    public static HellMiningCreditResult Ignored(string? message) => new(false, 0, 0, message);
}
