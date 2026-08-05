using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Timed Challenges: Mode 1 Skills CC; Modes 2–3 PVP waves; Mode 4 Survival Waves (Last Stand–style).
/// Daily leaderboard + rewards apply to Mode 1. See <c>docs/TIMED-CHALLENGES.md</c>.
/// </summary>
public static class TimedChallenge {
    public const int ModeSkills = 1;
    /// <summary>PVP Skills challenge 1 — 10 city Guards in sequential waves.</summary>
    public const int ModePvpGuards = 2;
    /// <summary>PVP Skills challenge 2 — 10 Dark Elves after invis pot + Protection From Arrow.</summary>
    public const int ModePvpDarkElves = 3;
    /// <summary>Optional Ettin-only endurance (pressure pack). Not the multi-mob bestiary ladder.</summary>
    public const int ModeSurvival = 4;
    /// <summary>PvP Academy Challenge Easy (scaffold: Guard waves + tier label; hero NPC AI TBD).</summary>
    public const int ModeChallengeEasy = 10;
    /// <summary>PvP Academy Challenge Intermediate.</summary>
    public const int ModeChallengeIntermediate = 11;
    /// <summary>PvP Academy Challenge Hard.</summary>
    public const int ModeChallengeHard = 12;
    /// <summary>PvP Academy Challenge Elite.</summary>
    public const int ModeChallengeElite = 13;

    /// <summary>Catalog id for chase runners (Mercenary Warrior — farm barracks chase feel).</summary>
    public const int RunnerCatalogId = 62;

    /// <summary>Olympia city Guard catalog id (Monsters.json hp 1926).</summary>
    public const int GuardCatalogId = 31;

    /// <summary>Dark Elf catalog id (Monsters.json hp 771).</summary>
    public const int DarkElfCatalogId = 15;

    /// <summary>Invisibility Potion item id — granted for Mode 3 setup.</summary>
    public const int InvisibilityPotionItemId = 273;

    /// <summary>Server Spells.json id for Protection From Arrow.</summary>
    public const int ProtectionFromArrowSpellId = 34;

    /// <summary>Invisibility potion duration (matches Spells.json Invisibility).</summary>
    public const int InvisibilityPotionDurationMs = 40_000;

    /// <summary>Stone of Integrity (violet zem) — safe upgrade consumable stub.</summary>
    public const int StoneOfIntegrityItemId = 1112;

    /// <summary>Hard time threshold for +50% EXP / 2h (ms). Balance knob for Mode 1 MVP.</summary>
    public const int HardThresholdMs = 120_000;

    public const int ExpBoostDurationMs = 2 * 60 * 60 * 1000;
    public const double ExpBoostMultiplier = 1.5;

    private const int TargetCount = 10;
    private const int SpawnSearchRadius = 14;
    private const int PvpSpawnMinDistance = 5;
    private const int PvpSpawnPreferredDistance = 7;
    private const int RunnerMaxHp = 999_999;
    private const int LeaderboardTopN = 20;
    private const int PhaseCombat = 0;
    private const int PhaseSetup = 1;

    /// <summary>Wave sizes for PVP Skills (1+2+2+2+3 = 10). Next wave after clear.</summary>
    private static readonly int[] PvpWaveSizes = [1, 2, 2, 2, 3];

    private static readonly object LedgerLock = new();
    private static TimedChallengeLedgerFile ledger = new();
    private static SurvivalWavesConfig survivalConfig = SurvivalWavesConfig.CreateDefault();

    /// <summary>Per-target protocol flags for one active Mode 1 runner.</summary>
    public sealed class TargetProgress {
        public long MonsterId { get; init; }
        public bool ChillApplied { get; set; }
        public bool ParalyzeApplied { get; set; }
        public bool DefenseShieldApplied { get; set; }
        public bool PoisonApplied { get; set; }
        public bool Completed { get; set; }

        /// <summary>Chill (sticky) + Paralyze + Defense Shield — Route A, or Route B with optional poison.</summary>
        public bool IsProtocolComplete =>
            ChillApplied && ParalyzeApplied && DefenseShieldApplied;
    }

    /// <summary>Session-local active run for one player.</summary>
    public sealed class ActiveRun {
        public int Mode { get; init; }
        public long StartedAtMs { get; init; }
        public Dictionary<long, TargetProgress> Targets { get; } = new();

        /// <summary>Live wave monster ids for kill-based PVP modes (2/3).</summary>
        public HashSet<long> AliveWaveMonsterIds { get; } = new();

        /// <summary>0-based index into <see cref="PvpWaveSizes"/>; -1 before first wave (Mode 3 setup).</summary>
        public int WaveIndex { get; set; } = -1;

        public int KillsCompleted { get; set; }

        /// <summary>Mode 3: waiting for invisibility + Protect From Arrow before spawning wave 1.</summary>
        public bool AwaitingSetup { get; set; }

        // --- Mode 4 Survival ---
        /// <summary>1-based survival wave number.</summary>
        public int SurvivalWave { get; set; }
        public int SurvivalWaveSpawned { get; set; }
        public int SurvivalWaveQuota { get; set; }
        public long SurvivalWaveEndsAtMs { get; set; }
        public long SurvivalNextSpawnAtMs { get; set; }
        public string SurvivalWaveName { get; set; } = "";
        public long SurvivalLastHudMs { get; set; }

        public int CompletedCount {
            get {
                if (Mode == ModeSkills) {
                    var n = 0;
                    foreach (var t in Targets.Values) {
                        if (t.Completed) {
                            n++;
                        }
                    }
                    return n;
                }

                return KillsCompleted;
            }
        }
    }

    /// <summary>Loads daily ledger + survival wave table from disk at process start.</summary>
    public static void Initialize() {
        lock (LedgerLock) {
            ledger = LoadLedgerUnlocked();
        }
        survivalConfig = SurvivalWavesConfig.LoadFromDisk();
        Console.WriteLine(
            $"[TimedChallenge] Ledger loaded: {ledger.DailyBest.Count} day(s), {ledger.WalletRewards.Count} wallet reward row(s); survival waves={survivalConfig.Waves.Count} final={survivalConfig.FinalWave}.");
    }

    /// <summary>1s tick: Mode 4 drip spawn + wave timer advance.</summary>
    public static void TickWorld(GameWorldRef wr) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var player in wr.World.EnumerateConnectedPlayers()) {
            var run = player.TimedChallengeRun;
            if (run is null || run.Mode != ModeSurvival) {
                continue;
            }
            TickSurvival(wr, player, run, nowMs);
        }
    }

    /// <summary>True when <paramref name="monsterId"/> is a live Mode 1 runner for any player in this world.</summary>
    public static bool IsChallengeMonster(GameWorldPlayer player, long monsterId) {
        ArgumentNullException.ThrowIfNull(player);
        var run = player.TimedChallengeRun;
        return run is not null && run.Targets.ContainsKey(monsterId);
    }

    /// <summary>True when poison temporary effects may apply to this monster (challenge runners only).</summary>
    public static bool AllowsPoisonOnMonster(GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);
        // Any active run that owns this monster id (checked via owner player list would be heavier;
        // poison-on-monster is only useful during challenges, so gate on monster being owned by any challenge).
        return monster.MaxHp >= RunnerMaxHp && monster.CatalogMonsterId == RunnerCatalogId;
    }

    /// <summary>Applies wallet EXP boost multiplier when a timed-challenge buff is still active.</summary>
    public static double GetExpMultiplier(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (player.TimedChallengeExpBoostExpiresAtMs > now) {
            return ExpBoostMultiplier;
        }

        lock (LedgerLock) {
            EnsureTodayUnlocked();
            if (ledger.WalletRewards.TryGetValue(NormalizeWallet(player.AccountWallet), out var row) &&
                row.ExpBoostExpiresAtMs > now) {
                player.TimedChallengeExpBoostExpiresAtMs = row.ExpBoostExpiresAtMs;
                return ExpBoostMultiplier;
            }
        }

        return 1.0;
    }

    /// <summary>Start a timed challenge run (Mode 1 CC protocol, Mode 2 Guards waves, Mode 3 Dark Elves).</summary>
    public static void HandleStartRequest(GameWorldRef wr, GameWorldPlayer player, StartTimedChallengeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead) {
            ReplyState(player, active: false, ModeSkills, 0, 0, 0, "Cannot start while dead.", freeMana: false);
            return;
        }

        var mode = request.Mode == 0 ? ModeSkills : request.Mode;
        if (mode is not (ModeSkills or ModePvpGuards or ModePvpDarkElves or ModeSurvival
            or ModeChallengeEasy or ModeChallengeIntermediate or ModeChallengeHard or ModeChallengeElite)) {
            ReplyState(player, active: false, mode, 0, 0, 0, "Unknown challenge mode.", freeMana: false);
            return;
        }

        if (!string.IsNullOrWhiteSpace(request.GameWorldId) &&
            !string.Equals(request.GameWorldId, wr.WorldId, StringComparison.Ordinal)) {
            ReplyState(player, active: false, mode, 0, 0, 0, "Stale world — rejoin and try again.", freeMana: false);
            return;
        }

        // Allow training + open-world traveler/farm maps; block tournament arenas.
        if (wr.World.IsTournamentArena) {
            ReplyState(player, active: false, mode, 0, 0, 0, "Timed challenges are not available in tournament arenas.", freeMana: false);
            return;
        }

        DespawnPlayerRunners(wr, player);
        TrainingArena.DespawnPlayerTrainingDummies(wr, player);

        if (player.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, player);
        }

        switch (mode) {
            case ModePvpGuards:
                StartPvpWaveChallenge(wr, player, ModePvpGuards, GuardCatalogId, awaitingSetup: false,
                    intro: "Learning · Guards in waves (1→2→2→2→3). Practice PvP sequences — no Elo.");
                return;
            case ModePvpDarkElves:
                StartPvpWaveChallenge(wr, player, ModePvpDarkElves, DarkElfCatalogId, awaitingSetup: true,
                    intro: null);
                return;
            case ModeSurvival:
                StartSurvivalChallenge(wr, player);
                return;
            case ModeChallengeEasy:
                StartPvpWaveChallenge(wr, player, ModeChallengeEasy, AcademyCombatAi.CatalogEasy, awaitingSetup: false,
                    intro: "Challenge Easy · Academy Recruits (light pressure).");
                return;
            case ModeChallengeIntermediate:
                StartPvpWaveChallenge(wr, player, ModeChallengeIntermediate, AcademyCombatAi.CatalogIntermediate, awaitingSetup: false,
                    intro: "Challenge Intermediate · Adepts (ES + Chill).");
                return;
            case ModeChallengeHard:
                StartPvpWaveChallenge(wr, player, ModeChallengeHard, AcademyCombatAi.CatalogHard, awaitingSetup: false,
                    intro: "Challenge Hard · Veterans (ES + Chill + Para priority AI).");
                return;
            case ModeChallengeElite:
                StartPvpWaveChallenge(wr, player, ModeChallengeElite, AcademyCombatAi.CatalogElite, awaitingSetup: false,
                    intro: "Challenge Elite · Contenders (priority AI ≫ Unicorn). EK up to 3/day.");
                return;
            default:
                StartSkillsChallenge(wr, player);
                return;
        }
    }

    /// <summary>Mode 1 Skills: despawn prior runners, spawn 10 chase NPCs at player run speed.</summary>
    private static void StartSkillsChallenge(GameWorldRef wr, GameWorldPlayer player) {
        var runSpeedMs = player.BaseMovementSpeedMs;
        var run = new ActiveRun {
            Mode = ModeSkills,
            StartedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };

        var spawned = 0;
        for (var i = 0; i < TargetCount; i++) {
            if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                    player,
                    RunnerCatalogId,
                    SpawnSearchRadius,
                    out var monsterId,
                    allegianceOverride: MonsterAllegiance.Hostile,
                    movementSpeedMsOverride: runSpeedMs,
                    maxHpOverride: RunnerMaxHp,
                    attackDamageOverride: 0,
                    chaseMaxDistanceCellsOverride: 40,
                    minDistanceFromPlayer: 3)) {
                Console.WriteLine(
                    $"[TimedChallenge] Spawn failed for player '{player.PlayerId}' after {spawned} runners.");
                break;
            }

            run.Targets[monsterId] = new TargetProgress { MonsterId = monsterId };
            player.AddTimedChallengeMonsterId(monsterId);
            spawned++;
        }

        if (spawned < TargetCount) {
            DespawnPlayerRunners(wr, player);
            player.ClearTimedChallengeRun();
            ReplyState(
                player,
                active: false,
                ModeSkills,
                TargetCount,
                0,
                0,
                $"Need {TargetCount} free cells nearby (spawned {spawned}). Move and retry.",
                freeMana: false);
            return;
        }

        player.SetTimedChallengeRun(run);
        MonsterChase.EvaluateChaseForPlayer(wr, player);

        Console.WriteLine(
            $"[TimedChallenge] Mode 1 started for '{player.CharacterName}' ({player.AccountWallet}): {spawned} runners @ {runSpeedMs}ms/tile.");
        ReplyState(
            player,
            active: true,
            ModeSkills,
            TargetCount,
            0,
            run.StartedAtMs,
            "Skills challenge started — Chill Wind first, then Paralyze + Defense Shield (or Poison + Para + DS).",
            freeMana: true);
    }

    /// <summary>
    /// PVP Skills Mode 2/3: wave kills (1→2→2→2→3). Mode 3 starts in setup (invis pot + PFA) before wave 1.
    /// Uses catalog Guard/Dark Elf HP (no inflated override).
    /// </summary>
    private static void StartPvpWaveChallenge(
        GameWorldRef wr,
        GameWorldPlayer player,
        int mode,
        int catalogId,
        bool awaitingSetup,
        string? intro = null) {
        var run = new ActiveRun {
            Mode = mode,
            StartedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            AwaitingSetup = awaitingSetup,
            WaveIndex = -1,
        };
        player.SetTimedChallengeRun(run);

        if (awaitingSetup) {
            TryGrantInvisibilityPotion(wr, player);
            ReplyState(
                player,
                active: true,
                mode,
                TargetCount,
                0,
                run.StartedAtMs,
                "Learning · Setup: drink Invisibility Potion, step aside, cast Protection From Arrow (PFA). Wave 1 when both are up.",
                freeMana: true,
                waveIndex: 0,
                waveCount: PvpWaveSizes.Length,
                phase: PhaseSetup);
            Console.WriteLine(
                $"[TimedChallenge] Mode {mode} setup started for '{player.CharacterName}' (catalog {catalogId}).");
            return;
        }

        if (!TrySpawnPvpWave(wr, player, run, catalogId, waveIndex: 0)) {
            DespawnPlayerRunners(wr, player);
            player.ClearTimedChallengeRun();
            ReplyState(
                player,
                active: false,
                mode,
                TargetCount,
                0,
                0,
                "No free cells for wave 1 — move to open ground and retry.",
                freeMana: false);
            return;
        }

        MonsterChase.EvaluateChaseForPlayer(wr, player);
        var wave1Msg = intro ??
            $"Guards wave 1/{PvpWaveSizes.Length}: clear {PvpWaveSizes[0]} — next wave after clear.";
        if (intro is not null) {
            wave1Msg = $"{intro} · Wave 1/{PvpWaveSizes.Length}: clear {PvpWaveSizes[0]}.";
        }
        ReplyState(
            player,
            active: true,
            mode,
            TargetCount,
            0,
            run.StartedAtMs,
            wave1Msg,
            freeMana: false,
            waveIndex: 1,
            waveCount: PvpWaveSizes.Length,
            phase: PhaseCombat);
        Console.WriteLine(
            $"[TimedChallenge] Mode {mode} started for '{player.CharacterName}': wave 1 ({PvpWaveSizes[0]}× catalog {catalogId}).");
    }

    /// <summary>Applies Invisibility from potion consume (same duration as the Invisibility spell).</summary>
    public static void ApplyInvisibilityPotionEffect(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        player.ApplyTemporaryEffect(
            wr,
            TemporaryEffectType.Invisibility,
            group: 0,
            InvisibilityPotionDurationMs,
            movementSpeedModifier: 0,
            attackSpeedModifier: 0,
            castSpeedModifier: 0);
    }

    /// <summary>Mode 3 setup: when invis + PFA are both up, spawn wave 1.</summary>
    public static void OnPlayerBuffApplied(GameWorldRef wr, GameWorldPlayer player, TemporaryEffectType effectType) {
        ArgumentNullException.ThrowIfNull(player);
        if (effectType is not (TemporaryEffectType.Invisibility or TemporaryEffectType.ProtectFromArrow)) {
            return;
        }

        var run = player.TimedChallengeRun;
        if (run is null || run.Mode != ModePvpDarkElves || !run.AwaitingSetup) {
            return;
        }

        if (!player.HasTemporaryEffect(TemporaryEffectType.Invisibility) ||
            !player.HasTemporaryEffect(TemporaryEffectType.ProtectFromArrow)) {
            var missing = !player.HasTemporaryEffect(TemporaryEffectType.Invisibility)
                ? "Drink Invisibility Potion, then cast PFA."
                : "Cast Protection From Arrow (PFA), then fight.";
            ReplyState(
                player,
                active: true,
                run.Mode,
                TargetCount,
                0,
                run.StartedAtMs,
                missing,
                freeMana: true,
                waveIndex: 0,
                waveCount: PvpWaveSizes.Length,
                phase: PhaseSetup);
            return;
        }

        run.AwaitingSetup = false;
        if (!TrySpawnPvpWave(wr, player, run, DarkElfCatalogId, waveIndex: 0)) {
            DespawnPlayerRunners(wr, player);
            player.ClearTimedChallengeRun();
            ReplyState(
                player,
                active: false,
                ModePvpDarkElves,
                TargetCount,
                0,
                0,
                "Setup ok but no free cells for wave 1 — move and restart.",
                freeMana: false);
            return;
        }

        MonsterChase.EvaluateChaseForPlayer(wr, player);
        ReplyState(
            player,
            active: true,
            ModePvpDarkElves,
            TargetCount,
            0,
            run.StartedAtMs,
            $"Setup complete — Dark Elf wave 1/{PvpWaveSizes.Length}. Stay invisible / PFA up and clear them.",
            freeMana: true,
            waveIndex: 1,
            waveCount: PvpWaveSizes.Length,
            phase: PhaseCombat);
    }

    /// <summary>Aborts the active run without rewards.</summary>
    public static void HandleAbortRequest(GameWorldRef wr, GameWorldPlayer player, AbortTimedChallengeRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!string.IsNullOrWhiteSpace(request.GameWorldId) &&
            !string.Equals(request.GameWorldId, wr.WorldId, StringComparison.Ordinal)) {
            return;
        }

        if (player.TimedChallengeRun is null) {
            ReplyState(player, active: false, ModeSkills, 0, 0, 0, "No active challenge.", freeMana: false);
            return;
        }

        var mode = player.TimedChallengeRun.Mode;
        DespawnPlayerRunners(wr, player);
        player.ClearTimedChallengeRun();
        ReplyState(player, active: false, mode, 0, 0, 0, "Challenge aborted.", freeMana: false);
    }

    /// <summary>Returns today's Mode leaderboard (best times, ascending).</summary>
    public static void HandleLeaderboardRequest(GameWorldPlayer player, GetTimedChallengeLeaderboardRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        var mode = request.Mode == 0 ? ModeSkills : request.Mode;
        if (mode != ModeSkills) {
            NetworkManager.SendToPlayer(player, new ServerMessage {
                TimedChallengeLeaderboard = new TimedChallengeLeaderboard {
                    Mode = mode,
                    UtcDay = UtcDayKey(),
                },
            });
            return;
        }

        lock (LedgerLock) {
            EnsureTodayUnlocked();
            var day = UtcDayKey();
            var board = new TimedChallengeLeaderboard {
                Mode = ModeSkills,
                UtcDay = day,
            };

            if (ledger.DailyBest.TryGetValue(day, out var dayRows)) {
                foreach (var row in dayRows
                             .OrderBy(r => r.ElapsedMs)
                             .ThenBy(r => r.CharacterName, StringComparer.Ordinal)
                             .Take(LeaderboardTopN)) {
                    board.Entries.Add(new TimedChallengeLeaderboardEntry {
                        CharacterName = row.CharacterName ?? "",
                        WalletSuffix = WalletSuffix(row.Wallet),
                        ElapsedMs = row.ElapsedMs,
                    });
                }

                var wallet = NormalizeWallet(player.AccountWallet);
                var yours = dayRows.FirstOrDefault(r =>
                    string.Equals(NormalizeWallet(r.Wallet), wallet, StringComparison.OrdinalIgnoreCase));
                if (yours is not null) {
                    board.YourBestMs = yours.ElapsedMs;
                }
            }

            NetworkManager.SendToPlayer(player, new ServerMessage { TimedChallengeLeaderboard = board });
        }
    }

    /// <summary>
    /// Defense Shield is self-cast in Olympia; during Mode 1, credit nearby incomplete runners
    /// (tip-sheet protocol: Chill → Paralyze → DS while locking targets).
    /// </summary>
    public static void OnPlayerDefenseShieldApplied(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var run = player.TimedChallengeRun;
        if (run is null) {
            return;
        }

        const int creditRadius = 4;
        foreach (var progress in run.Targets.Values) {
            if (progress.Completed || progress.DefenseShieldApplied) {
                continue;
            }
            if (!wr.MonstersByMonsterId.TryGetValue(progress.MonsterId, out var monster) || monster.Dead) {
                continue;
            }
            if (Location.GetDistance(player.PosX, player.PosY, monster.PosX, monster.PosY) > creditRadius) {
                continue;
            }

            progress.DefenseShieldApplied = true;
            TryCompleteTarget(wr, player, progress);
        }
    }

    /// <summary>Tracks Chill / Paralyze / Defense Shield / Poison on challenge runners.</summary>
    public static void OnMonsterEffectApplied(GameWorldRef wr, GameWorldMonster monster, TemporaryEffectType effectType) {
        ArgumentNullException.ThrowIfNull(monster);
        if (!TryFindOwnerRun(wr, monster.MonsterId, out var owner, out var progress) || progress.Completed) {
            return;
        }

        switch (effectType) {
            case TemporaryEffectType.Chill:
                progress.ChillApplied = true;
                break;
            case TemporaryEffectType.Paralyze:
                progress.ParalyzeApplied = true;
                break;
            case TemporaryEffectType.DefenseShield:
            case TemporaryEffectType.GreatDefenseShield:
                progress.DefenseShieldApplied = true;
                break;
            case TemporaryEffectType.Poison:
                progress.PoisonApplied = true;
                break;
            default:
                return;
        }

        TryCompleteTarget(wr, owner, progress);
    }

    /// <summary>Route B MVP: any successful melee weapon hit marks poison protocol progress.</summary>
    public static void OnWeaponHit(GameWorldRef wr, GameWorldPlayer attacker, GameWorldMonster target) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(target);

        var run = attacker.TimedChallengeRun;
        if (run is null || !run.Targets.TryGetValue(target.MonsterId, out var progress) || progress.Completed) {
            return;
        }

        progress.PoisonApplied = true;
        TryCompleteTarget(wr, attacker, progress);
    }

    /// <summary>Clears runners when the player leaves the world or disconnects.</summary>
    public static void OnPlayerLeaveWorld(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (player.TimedChallengeRun is null && player.TimedChallengeMonsterIds.Count == 0) {
            return;
        }

        DespawnPlayerRunners(wr, player);
        player.ClearTimedChallengeRun();
    }

    /// <summary>When a challenge runner dies before protocol complete, it does not count (no auto-respawn MVP).</summary>
    public static void OnMonsterRemoved(GameWorldRef wr, GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);
        if (!TryFindOwnerRun(wr, monster.MonsterId, out var owner, out var progress)) {
            return;
        }

        if (progress.Completed) {
            return;
        }

        owner.TimedChallengeRun?.Targets.Remove(monster.MonsterId);
        owner.RemoveTimedChallengeMonsterId(monster.MonsterId);
        var run = owner.TimedChallengeRun;
        if (run is null) {
            return;
        }

        ReplyState(
            owner,
            active: true,
            run.Mode,
            TargetCount,
            run.CompletedCount,
            run.StartedAtMs,
            "A runner died before protocol — it does not count. Finish the remaining targets.",
            freeMana: true);
    }

    /// <summary>PVP Skills Modes 2/3 + Survival Mode 4: count a kill on death (not corpse decay).</summary>
    public static void OnMonsterDied(GameWorldRef wr, GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);

        GameWorldPlayer? owner = null;
        foreach (var p in wr.World.EnumerateConnectedPlayers()) {
            var active = p.TimedChallengeRun;
            if (active is null ||
                active.Mode is not (ModePvpGuards or ModePvpDarkElves or ModeSurvival
                    or ModeChallengeEasy or ModeChallengeIntermediate or ModeChallengeHard or ModeChallengeElite)) {
                continue;
            }
            if (!active.AliveWaveMonsterIds.Contains(monster.MonsterId)) {
                continue;
            }
            owner = p;
            break;
        }

        if (owner is null) {
            return;
        }

        var run = owner.TimedChallengeRun!;
        if (!run.AliveWaveMonsterIds.Remove(monster.MonsterId)) {
            return;
        }

        owner.RemoveTimedChallengeMonsterId(monster.MonsterId);
        run.KillsCompleted++;

        if (run.Mode == ModeSurvival) {
            OnSurvivalKill(wr, owner, run);
            return;
        }

        run.KillsCompleted = Math.Min(TargetCount, run.KillsCompleted);
        var waveLabel = run.WaveIndex + 1;
        var freeMana = run.Mode == ModePvpDarkElves;
        ReplyState(
            owner,
            active: true,
            run.Mode,
            TargetCount,
            run.KillsCompleted,
            run.StartedAtMs,
            $"Kill {run.KillsCompleted}/{TargetCount} · wave {waveLabel}/{PvpWaveSizes.Length} ({run.AliveWaveMonsterIds.Count} left).",
            freeMana,
            waveIndex: waveLabel,
            waveCount: PvpWaveSizes.Length,
            phase: PhaseCombat);

        if (run.AliveWaveMonsterIds.Count > 0) {
            return;
        }

        var nextWave = run.WaveIndex + 1;
        if (nextWave >= PvpWaveSizes.Length || run.KillsCompleted >= TargetCount) {
            FinishPvpRun(wr, owner, run);
            return;
        }

        var catalogId = run.Mode switch {
            ModePvpDarkElves => DarkElfCatalogId,
            ModeChallengeEasy => AcademyCombatAi.CatalogEasy,
            ModeChallengeIntermediate => AcademyCombatAi.CatalogIntermediate,
            ModeChallengeHard => AcademyCombatAi.CatalogHard,
            ModeChallengeElite => AcademyCombatAi.CatalogElite,
            _ => GuardCatalogId,
        };
        if (!TrySpawnPvpWave(wr, owner, run, catalogId, nextWave)) {
            DespawnPlayerRunners(wr, owner);
            ClearRunWithSpawnFail(owner, run);
            return;
        }

        MonsterChase.EvaluateChaseForPlayer(wr, owner);
        var name = run.Mode == ModePvpDarkElves ? "Dark Elves" : "Guards";
        var tip = LearningWaveTip(nextWave + 1);
        ReplyState(
            owner,
            active: true,
            run.Mode,
            TargetCount,
            run.KillsCompleted,
            run.StartedAtMs,
            $"{name} wave {nextWave + 1}/{PvpWaveSizes.Length}: clear {PvpWaveSizes[nextWave]}. {tip}",
            freeMana,
            waveIndex: nextWave + 1,
            waveCount: PvpWaveSizes.Length,
            phase: PhaseCombat);
    }

    private static string LearningWaveTip(int waveOneBased) => waveOneBased switch {
        1 => "Tip: position · one target.",
        2 => "Tip: Chill → Para · keep DS.",
        3 => "Tip: reset if low · pot · re-engage.",
        4 => "Tip: priority low HP · multi-aggro.",
        5 => "Tip: clean spacing · finish order.",
        _ => "",
    };

    private static void ClearRunWithSpawnFail(GameWorldPlayer owner, ActiveRun run) {
        owner.ClearTimedChallengeRun();
        ReplyState(
            owner,
            active: false,
            run.Mode,
            TargetCount,
            run.KillsCompleted,
            0,
            "Wave spawn failed — move to open ground and restart the challenge.",
            freeMana: false);
    }

    /// <summary>
    /// Legacy free-consume stub for Stone of Integrity — disabled.
    /// Integrity is only spent via ItemStoneUpgrade when the client reconfirms use from +3.
    /// </summary>
    public static bool TryHandleStoneConsume(GameWorldRef wr, GameWorldPlayer player, int itemId) {
        ArgumentNullException.ThrowIfNull(player);
        if (itemId != StoneOfIntegrityItemId) {
            return false;
        }
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
            "Stone of Integrity is used when upgrading gear from +3 (holds +N: no burn, no drop). Right-click → Upgrade, then confirm."));
        return true;
    }

    private static void TryCompleteTarget(GameWorldRef wr, GameWorldPlayer owner, TargetProgress progress) {
        if (progress.Completed || !progress.IsProtocolComplete) {
            return;
        }

        // Route A: Chill + Para + DS (PoisonApplied may be false).
        // Route B: Chill + Poison + Para + DS.
        // IsProtocolComplete already requires Chill + Para + DS; Poison is optional for Route A.
        progress.Completed = true;

        if (wr.MonstersByMonsterId.TryGetValue(progress.MonsterId, out var monster)) {
            wr.World.DespawnMonsterImmediate(monster);
        }
        owner.RemoveTimedChallengeMonsterId(progress.MonsterId);

        var run = owner.TimedChallengeRun;
        if (run is null) {
            return;
        }

        var completed = run.CompletedCount;
        ReplyState(
            owner,
            active: true,
            run.Mode,
            TargetCount,
            completed,
            run.StartedAtMs,
            $"Protocol {completed}/{TargetCount}.",
            freeMana: true);

        if (completed >= TargetCount) {
            FinishRun(wr, owner, run);
        }
    }

    private static void FinishRun(GameWorldRef wr, GameWorldPlayer player, ActiveRun run) {
        var elapsedMs = (int)Math.Clamp(
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - run.StartedAtMs,
            0,
            int.MaxValue);

        DespawnPlayerRunners(wr, player);
        player.ClearTimedChallengeRun();

        var hardMet = elapsedMs > 0 && elapsedMs <= HardThresholdMs;
        var expGranted = false;
        var stoneGranted = false;
        var isDailyBest = false;
        var dailyRank = 0;

        lock (LedgerLock) {
            EnsureTodayUnlocked();
            var day = UtcDayKey();
            var wallet = NormalizeWallet(player.AccountWallet);
            if (string.IsNullOrEmpty(wallet)) {
                wallet = $"char:{player.CharacterName}";
            }

            if (!ledger.DailyBest.TryGetValue(day, out var dayRows)) {
                dayRows = new List<TimedChallengeDailyRow>();
                ledger.DailyBest[day] = dayRows;
            }

            var existing = dayRows.Find(r =>
                string.Equals(NormalizeWallet(r.Wallet), wallet, StringComparison.OrdinalIgnoreCase));
            if (existing is null) {
                dayRows.Add(new TimedChallengeDailyRow {
                    Wallet = wallet,
                    CharacterName = player.CharacterName ?? "",
                    ElapsedMs = elapsedMs,
                    Mode = ModeSkills,
                });
                isDailyBest = true;
            } else if (elapsedMs < existing.ElapsedMs) {
                existing.ElapsedMs = elapsedMs;
                existing.CharacterName = player.CharacterName ?? existing.CharacterName;
                isDailyBest = true;
            }

            dayRows.Sort((a, b) => a.ElapsedMs.CompareTo(b.ElapsedMs));
            dailyRank = dayRows.FindIndex(r =>
                string.Equals(NormalizeWallet(r.Wallet), wallet, StringComparison.OrdinalIgnoreCase)) + 1;

            if (!ledger.WalletRewards.TryGetValue(wallet, out var rewards)) {
                rewards = new TimedChallengeWalletReward();
                ledger.WalletRewards[wallet] = rewards;
            }

            if (hardMet) {
                var expires = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + ExpBoostDurationMs;
                if (expires > rewards.ExpBoostExpiresAtMs) {
                    rewards.ExpBoostExpiresAtMs = expires;
                }
                player.TimedChallengeExpBoostExpiresAtMs = rewards.ExpBoostExpiresAtMs;
                expGranted = true;
            }

            // One Stone of Integrity per wallet per UTC day, and only for #1 that day.
            if (dailyRank == 1 &&
                !string.Equals(rewards.StoneGrantedUtcDay, day, StringComparison.Ordinal)) {
                if (TryGrantStone(wr, player)) {
                    rewards.StoneGrantedUtcDay = day;
                    stoneGranted = true;
                }
            }

            SaveLedgerUnlocked();
        }

        var msg = $"Cleared in {FormatMs(elapsedMs)}.";
        if (expGranted) {
            msg += " +50% EXP for 2 hours!";
        }
        if (stoneGranted) {
            msg += " Best of day — Stone of Integrity granted.";
        } else if (dailyRank == 1 && !stoneGranted) {
            msg += " Best of day (stone already claimed today).";
        } else if (dailyRank > 0) {
            msg += $" Daily rank #{dailyRank}.";
        }

        NetworkManager.SendToPlayer(player, new ServerMessage {
            TimedChallengeFinished = new TimedChallengeFinished {
                Ok = true,
                Message = msg,
                Mode = ModeSkills,
                ElapsedMs = elapsedMs,
                HardThresholdMet = hardMet,
                ExpBoostGranted = expGranted,
                StoneGranted = stoneGranted,
                IsDailyBest = isDailyBest,
                DailyRank = dailyRank,
            },
        });
        ReplyState(player, active: false, ModeSkills, TargetCount, TargetCount, 0, msg, freeMana: false);
        HellMining.OnEventParticipation(player);

        Console.WriteLine(
            $"[TimedChallenge] Finished Mode 1 for '{player.CharacterName}': {elapsedMs}ms rank={dailyRank} hard={hardMet} stone={stoneGranted}");
    }

    private static bool TryGrantStone(GameWorldRef wr, GameWorldPlayer player) {
        if (!player.InventoryManager.TryCreateItem(StoneOfIntegrityItemId, effectOverrides: null, out var mutation)) {
            Console.WriteLine($"[TimedChallenge] Failed to grant Stone of Integrity to '{player.CharacterName}' (bag full?).");
            return false;
        }

        Inventory.ApplyInventoryMutation(wr, player, mutation);
        return true;
    }

    private static bool TryFindOwnerRun(
        GameWorldRef wr,
        long monsterId,
        out GameWorldPlayer owner,
        out TargetProgress progress) {
        owner = null!;
        progress = null!;
        foreach (var p in wr.World.EnumerateConnectedPlayers()) {
            var run = p.TimedChallengeRun;
            if (run is null) {
                continue;
            }
            if (!run.Targets.TryGetValue(monsterId, out var prog)) {
                continue;
            }
            owner = p;
            progress = prog;
            return true;
        }
        return false;
    }

    private static void DespawnPlayerRunners(GameWorldRef wr, GameWorldPlayer player) {
        var ids = player.TimedChallengeMonsterIds;
        if (ids.Count == 0) {
            player.ClearTimedChallengeMonsterIds();
            return;
        }

        var snapshot = new long[ids.Count];
        for (var i = 0; i < ids.Count; i++) {
            snapshot[i] = ids[i];
        }
        player.ClearTimedChallengeMonsterIds();

        foreach (var monsterId in snapshot) {
            if (!wr.MonstersByMonsterId.TryGetValue(monsterId, out var monster)) {
                continue;
            }
            wr.World.DespawnMonsterImmediate(monster);
        }
    }

    private static void ReplyState(
        GameWorldPlayer player,
        bool active,
        int mode,
        int targetsTotal,
        int targetsCompleted,
        long startedAtMs,
        string message,
        bool freeMana,
        int? waveIndex = null,
        int? waveCount = null,
        int? phase = null) {
        var state = new TimedChallengeState {
            Active = active,
            Mode = mode,
            TargetsTotal = targetsTotal,
            TargetsCompleted = targetsCompleted,
            StartedAtMs = startedAtMs,
            Message = message ?? "",
            FreeMana = freeMana,
        };
        if (waveIndex is int wi) {
            state.WaveIndex = wi;
        }
        if (waveCount is int wc) {
            state.WaveCount = wc;
        }
        if (phase is int ph) {
            state.Phase = ph;
        }

        NetworkManager.SendToPlayer(player, new ServerMessage {
            TimedChallengeState = state,
        });
    }

    // --- Mode 4 Survival Waves (Last Stand–style) ---

    private static void StartSurvivalChallenge(GameWorldRef wr, GameWorldPlayer player) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var run = new ActiveRun {
            Mode = ModeSurvival,
            StartedAtMs = nowMs,
            SurvivalWave = 1,
        };
        player.SetTimedChallengeRun(run);
        if (!BeginSurvivalWave(wr, player, run, nowMs, toast: true)) {
            DespawnPlayerRunners(wr, player);
            player.ClearTimedChallengeRun();
            ReplyState(player, active: false, ModeSurvival, 0, 0, 0,
                "Survival: cannot start wave 1 — move to open ground.", freeMana: false);
            return;
        }
        Console.WriteLine($"[TimedChallenge] Mode 4 Survival started for '{player.CharacterName}'.");
    }

    private static bool BeginSurvivalWave(GameWorldRef wr, GameWorldPlayer player, ActiveRun run, long nowMs, bool toast) {
        // Despawn leftovers from previous wave
        if (run.AliveWaveMonsterIds.Count > 0) {
            DespawnPlayerRunners(wr, player);
            run.AliveWaveMonsterIds.Clear();
        }

        var def = survivalConfig.GetWave(run.SurvivalWave);
        run.SurvivalWaveQuota = def.Quota;
        run.SurvivalWaveSpawned = 0;
        run.SurvivalWaveName = def.Name;
        run.SurvivalWaveEndsAtMs = nowMs + survivalConfig.WaveSeconds * 1000L;
        run.SurvivalNextSpawnAtMs = nowMs + 350;
        run.WaveIndex = run.SurvivalWave - 1;
        run.SurvivalLastHudMs = 0;

        ReplySurvivalState(player, run, nowMs,
            toast
                ? $"WAVE {run.SurvivalWave}: {def.Name} — {def.Sub}"
                : SurvivalHudMessage(run, nowMs));
        return true;
    }

    private static void TickSurvival(GameWorldRef wr, GameWorldPlayer player, ActiveRun run, long nowMs) {
        if (player.IsDead) {
            FinishSurvivalRun(wr, player, run, clearedAll: false, reason: "Fallen — survival ended.");
            return;
        }

        // Drip spawn
        while (run.SurvivalNextSpawnAtMs <= nowMs &&
               run.SurvivalWaveSpawned < run.SurvivalWaveQuota &&
               run.AliveWaveMonsterIds.Count < survivalConfig.MaxConcurrent) {
            if (!TrySpawnSurvivalMob(wr, player, run)) {
                break;
            }
            run.SurvivalWaveSpawned++;
            // ~0.55–0.95s between spawns; faster as concurrent room frees
            run.SurvivalNextSpawnAtMs = nowMs + (long)(Math.Max(0.38, 0.85 - run.AliveWaveMonsterIds.Count * 0.04) * 1000);
        }

        var clearDone = run.SurvivalWaveSpawned >= run.SurvivalWaveQuota && run.AliveWaveMonsterIds.Count == 0;
        var timeUp = nowMs >= run.SurvivalWaveEndsAtMs;
        if (clearDone || timeUp) {
            if (timeUp && run.AliveWaveMonsterIds.Count > 0) {
                // Force clear field and advance (Last Stand advances on timer too)
                DespawnPlayerRunners(wr, player);
                run.AliveWaveMonsterIds.Clear();
            }
            AdvanceSurvivalWave(wr, player, run, nowMs);
            return;
        }

        // Throttled HUD refresh (~2s)
        if (nowMs - run.SurvivalLastHudMs >= 2000) {
            run.SurvivalLastHudMs = nowMs;
            ReplySurvivalState(player, run, nowMs, SurvivalHudMessage(run, nowMs));
        }
    }

    private static void OnSurvivalKill(GameWorldRef wr, GameWorldPlayer owner, ActiveRun run) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        ReplySurvivalState(owner, run, nowMs, SurvivalHudMessage(run, nowMs));
        if (run.SurvivalWaveSpawned >= run.SurvivalWaveQuota && run.AliveWaveMonsterIds.Count == 0) {
            AdvanceSurvivalWave(wr, owner, run, nowMs);
        }
    }

    private static void AdvanceSurvivalWave(GameWorldRef wr, GameWorldPlayer player, ActiveRun run, long nowMs) {
        if (run.SurvivalWave >= survivalConfig.FinalWave) {
            FinishSurvivalRun(wr, player, run, clearedAll: true,
                reason: $"Survival cleared through wave {survivalConfig.FinalWave}! Defeated {run.KillsCompleted}.");
            return;
        }

        run.SurvivalWave++;
        BeginSurvivalWave(wr, player, run, nowMs, toast: true);
        MonsterChase.EvaluateChaseForPlayer(wr, player);
    }

    private static bool TrySpawnSurvivalMob(GameWorldRef wr, GameWorldPlayer player, ActiveRun run) {
        // PO: multi-mob bestiary not interesting — Ettin-only pressure pack.
        const int ettinCatalogId = 0;
        var catalogId = ettinCatalogId;
        var scale = 1.0 + (run.SurvivalWave - 1) * 0.08;
        var hp = Math.Max(400, (int)Math.Round(1376 * scale * 0.35));
        var dmg = Math.Max(5, (int)Math.Round(20 * (1.0 + (run.SurvivalWave - 1) * 0.04)));

        var angle = (Math.PI * 2.0 * run.SurvivalWaveSpawned / Math.Max(1, run.SurvivalWaveQuota)) + run.SurvivalWave * 0.2;
        var ox = (int)Math.Round(Math.Cos(angle) * PvpSpawnPreferredDistance);
        var oy = (int)Math.Round(Math.Sin(angle) * PvpSpawnPreferredDistance);
        if (ox == 0 && oy == 0) {
            ox = PvpSpawnPreferredDistance;
        }

        if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                player,
                catalogId,
                SpawnSearchRadius,
                out var monsterId,
                allegianceOverride: MonsterAllegiance.Hostile,
                maxHpOverride: hp,
                attackDamageOverride: dmg,
                chaseMaxDistanceCellsOverride: 40,
                minDistanceFromPlayer: PvpSpawnMinDistance,
                preferredOffsetX: ox,
                preferredOffsetY: oy)) {
            return false;
        }

        run.AliveWaveMonsterIds.Add(monsterId);
        player.AddTimedChallengeMonsterId(monsterId);
        return true;
    }

    private static int PickSurvivalCatalog(ActiveRun run) {
        var lead = survivalConfig.GetWave(run.SurvivalWave);
        // Wave 1 pure lead; wave 2 mix; later recycle prior types every 3rd spawn
        if (run.SurvivalWave <= 1) {
            return lead.CatalogId;
        }
        if (run.SurvivalWave == 2) {
            return (run.SurvivalWaveSpawned % 3 == 2)
                ? survivalConfig.GetWave(1).CatalogId
                : lead.CatalogId;
        }
        if ((run.SurvivalWaveSpawned + 1) % 3 != 0) {
            return lead.CatalogId;
        }
        var prior = Math.Max(1, run.SurvivalWave - 1 - (run.SurvivalWaveSpawned % 3));
        prior = Math.Clamp(prior, 1, run.SurvivalWave - 1);
        return survivalConfig.GetWave(prior).CatalogId;
    }

    private static int SurvivalRemaining(ActiveRun run) =>
        run.AliveWaveMonsterIds.Count + Math.Max(0, run.SurvivalWaveQuota - run.SurvivalWaveSpawned);

    private static string SurvivalHudMessage(ActiveRun run, long nowMs) {
        var leftSec = Math.Max(0, (run.SurvivalWaveEndsAtMs - nowMs + 999) / 1000);
        return $"WAVE {run.SurvivalWave}/{survivalConfig.FinalWave} {run.SurvivalWaveName} · {SurvivalRemaining(run)} left · {leftSec}s · kills {run.KillsCompleted}";
    }

    private static void ReplySurvivalState(GameWorldPlayer player, ActiveRun run, long nowMs, string message) {
        ReplyState(
            player,
            active: true,
            ModeSurvival,
            targetsTotal: run.SurvivalWaveQuota,
            targetsCompleted: Math.Min(run.SurvivalWaveSpawned, run.SurvivalWaveQuota),
            startedAtMs: run.StartedAtMs,
            message: message,
            freeMana: false,
            waveIndex: run.SurvivalWave,
            waveCount: survivalConfig.FinalWave,
            phase: PhaseCombat);
        // targetsCompleted = spawned this wave (progress); kills in message
        _ = nowMs;
    }

    private static void FinishSurvivalRun(
        GameWorldRef wr,
        GameWorldPlayer player,
        ActiveRun run,
        bool clearedAll,
        string reason) {
        var elapsedMs = (int)Math.Clamp(
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - run.StartedAtMs,
            0,
            int.MaxValue);
        var waveReached = run.SurvivalWave;
        var kills = run.KillsCompleted;
        DespawnPlayerRunners(wr, player);
        player.ClearTimedChallengeRun();

        var msg = $"{reason} Wave {waveReached} · {kills} defeated · {FormatMs(elapsedMs)}.";
        NetworkManager.SendToPlayer(player, new ServerMessage {
            TimedChallengeFinished = new TimedChallengeFinished {
                Ok = clearedAll,
                Message = msg,
                Mode = ModeSurvival,
                ElapsedMs = elapsedMs,
            },
        });
        ReplyState(player, active: false, ModeSurvival, 0, kills, 0, msg, freeMana: false);
        if (clearedAll) {
            HellMining.OnEventParticipation(player);
        }
        Console.WriteLine(
            $"[TimedChallenge] Survival end '{player.CharacterName}': ok={clearedAll} wave={waveReached} kills={kills} {elapsedMs}ms");
    }

    /// <summary>Spawns one PVP wave with angular spacing at preferred distance (never on the player).</summary>
    private static bool TrySpawnPvpWave(
        GameWorldRef wr,
        GameWorldPlayer player,
        ActiveRun run,
        int catalogId,
        int waveIndex) {
        if (waveIndex < 0 || waveIndex >= PvpWaveSizes.Length) {
            return false;
        }

        var count = PvpWaveSizes[waveIndex];
        run.AliveWaveMonsterIds.Clear();
        run.WaveIndex = waveIndex;
        var spawned = 0;
        for (var i = 0; i < count; i++) {
            var angle = (Math.PI * 2.0 * i / count) + (waveIndex * 0.35);
            var ox = (int)Math.Round(Math.Cos(angle) * PvpSpawnPreferredDistance);
            var oy = (int)Math.Round(Math.Sin(angle) * PvpSpawnPreferredDistance);
            if (ox == 0 && oy == 0) {
                ox = PvpSpawnPreferredDistance;
            }

            if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                    player,
                    catalogId,
                    SpawnSearchRadius,
                    out var monsterId,
                    allegianceOverride: MonsterAllegiance.Hostile,
                    chaseMaxDistanceCellsOverride: 40,
                    minDistanceFromPlayer: PvpSpawnMinDistance,
                    preferredOffsetX: ox,
                    preferredOffsetY: oy)) {
                Console.WriteLine(
                    $"[TimedChallenge] PVP wave {waveIndex + 1} spawn failed after {spawned}/{count} for '{player.PlayerId}'.");
                break;
            }

            run.AliveWaveMonsterIds.Add(monsterId);
            player.AddTimedChallengeMonsterId(monsterId);
            spawned++;
        }

        if (spawned < count) {
            DespawnPlayerRunners(wr, player);
            run.AliveWaveMonsterIds.Clear();
            return false;
        }

        return true;
    }

    private static void TryGrantInvisibilityPotion(GameWorldRef wr, GameWorldPlayer player) {
        if (!player.InventoryManager.TryCreateItemStack(InvisibilityPotionItemId, 1, out var mutation)) {
            Console.WriteLine(
                $"[TimedChallenge] Failed to grant Invisibility Potion to '{player.CharacterName}' (bag full?).");
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, mutation);
    }

    /// <summary>Completes a PVP Skills run (Modes 2/3) with elapsed time — no Mode 1 stone/board rewards.</summary>
    private static void FinishPvpRun(GameWorldRef wr, GameWorldPlayer player, ActiveRun run) {
        var elapsedMs = (int)Math.Clamp(
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - run.StartedAtMs,
            0,
            int.MaxValue);

        DespawnPlayerRunners(wr, player);
        player.ClearTimedChallengeRun();

        var label = run.Mode switch {
            ModePvpDarkElves => "Dark Elves learning",
            ModeChallengeEasy => "Challenge Easy (scaffold)",
            ModeChallengeIntermediate => "Challenge Intermediate (scaffold)",
            ModeChallengeHard => "Challenge Hard (scaffold)",
            ModeChallengeElite => "Challenge Elite (scaffold)",
            _ => "Guards learning",
        };
        var msg = $"{label} cleared in {FormatMs(elapsedMs)}.";
        NetworkManager.SendToPlayer(player, new ServerMessage {
            TimedChallengeFinished = new TimedChallengeFinished {
                Ok = true,
                Message = msg,
                Mode = run.Mode,
                ElapsedMs = elapsedMs,
            },
        });
        ReplyState(player, active: false, run.Mode, TargetCount, TargetCount, 0, msg, freeMana: false);
        HellMining.OnEventParticipation(player);
        if (run.Mode is ModeChallengeEasy or ModeChallengeIntermediate or ModeChallengeHard or ModeChallengeElite) {
            PvpAcademy.OnChallengeCleared(wr, player, run.Mode, elapsedMs);
        }
        Console.WriteLine(
            $"[TimedChallenge] Finished Mode {run.Mode} for '{player.CharacterName}': {elapsedMs}ms");
    }

    private static string UtcDayKey() => DateTime.UtcNow.ToString("yyyy-MM-dd");

    private static string NormalizeWallet(string? wallet) =>
        string.IsNullOrWhiteSpace(wallet) ? "" : wallet.Trim();

    private static string WalletSuffix(string? wallet) {
        var w = NormalizeWallet(wallet);
        if (w.Length <= 4) {
            return w;
        }
        return w[^4..];
    }

    private static string FormatMs(int ms) {
        var totalSec = Math.Max(0, ms) / 1000;
        var m = totalSec / 60;
        var s = totalSec % 60;
        var frac = Math.Max(0, ms) % 1000;
        return $"{m}:{s:D2}.{frac:D3}";
    }

    private static void EnsureTodayUnlocked() {
        // Prune days older than 7 to keep the file small.
        var cutoff = DateTime.UtcNow.Date.AddDays(-7);
        var remove = new List<string>();
        foreach (var key in ledger.DailyBest.Keys) {
            if (DateTime.TryParse(key, out var d) && d.Date < cutoff) {
                remove.Add(key);
            }
        }
        foreach (var key in remove) {
            ledger.DailyBest.Remove(key);
        }
    }

    private static TimedChallengeLedgerFile LoadLedgerUnlocked() {
        try {
            var path = LedgerPath();
            if (!File.Exists(path)) {
                return new TimedChallengeLedgerFile();
            }
            var json = File.ReadAllText(path);
            var loaded = JsonSerializer.Deserialize<TimedChallengeLedgerFile>(json, JsonOpts());
            return loaded ?? new TimedChallengeLedgerFile();
        } catch (Exception ex) {
            Console.WriteLine($"[TimedChallenge] Ledger load failed: {ex.Message}");
            return new TimedChallengeLedgerFile();
        }
    }

    private static void SaveLedgerUnlocked() {
        try {
            var path = LedgerPath();
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir)) {
                Directory.CreateDirectory(dir);
            }
            var json = JsonSerializer.Serialize(ledger, JsonOpts());
            File.WriteAllText(path, json);
        } catch (Exception ex) {
            Console.WriteLine($"[TimedChallenge] Ledger save failed: {ex.Message}");
        }
    }

    private static string LedgerPath() =>
        Path.Combine(Directory.GetCurrentDirectory(), "Config", "TimedChallengeLedger.json");

    private static JsonSerializerOptions JsonOpts() => new() {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private sealed class TimedChallengeLedgerFile {
        public Dictionary<string, List<TimedChallengeDailyRow>> DailyBest { get; set; } =
            new(StringComparer.Ordinal);
        public Dictionary<string, TimedChallengeWalletReward> WalletRewards { get; set; } =
            new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class TimedChallengeDailyRow {
        public string Wallet { get; set; } = "";
        public string CharacterName { get; set; } = "";
        public int ElapsedMs { get; set; }
        public int Mode { get; set; } = ModeSkills;
    }

    private sealed class TimedChallengeWalletReward {
        public long ExpBoostExpiresAtMs { get; set; }
        public string? StoneGrantedUtcDay { get; set; }
    }

    private sealed class SurvivalWavesConfig {
        public int WaveSeconds { get; set; } = 60;
        public int MaxConcurrent { get; set; } = 10;
        public int FinalWave { get; set; } = 14;
        public List<SurvivalWaveDef> Waves { get; set; } = new();

        public SurvivalWaveDef GetWave(int waveNumber) {
            if (Waves.Count == 0) {
                return CreateDefault().Waves[0];
            }
            var hit = Waves.FirstOrDefault(w => w.Wave == waveNumber);
            if (hit is not null) {
                return hit;
            }
            // Clamp to last defined wave (bosses / endless reuse)
            return Waves.OrderBy(w => w.Wave).Last();
        }

        public static SurvivalWavesConfig LoadFromDisk() {
            try {
                var path = Path.Combine(Directory.GetCurrentDirectory(), "Config", "SurvivalWaves.json");
                if (!File.Exists(path)) {
                    Console.WriteLine("[TimedChallenge] SurvivalWaves.json missing — using built-in defaults.");
                    return CreateDefault();
                }
                var json = File.ReadAllText(path);
                var loaded = JsonSerializer.Deserialize<SurvivalWavesConfig>(json, JsonOpts());
                if (loaded is null || loaded.Waves.Count == 0) {
                    return CreateDefault();
                }
                loaded.WaveSeconds = loaded.WaveSeconds <= 0 ? 60 : loaded.WaveSeconds;
                loaded.MaxConcurrent = loaded.MaxConcurrent <= 0 ? 10 : loaded.MaxConcurrent;
                loaded.FinalWave = loaded.FinalWave <= 0 ? loaded.Waves.Max(w => w.Wave) : loaded.FinalWave;
                return loaded;
            } catch (Exception ex) {
                Console.WriteLine($"[TimedChallenge] SurvivalWaves load failed: {ex.Message}");
                return CreateDefault();
            }
        }

        public static SurvivalWavesConfig CreateDefault() => new() {
            WaveSeconds = 60,
            MaxConcurrent = 8,
            FinalWave = 5,
            Waves = [
                new SurvivalWaveDef { Wave = 1, Key = "ettin", Name = "ETTINS", Sub = "Pressure pack", CatalogId = 0, Quota = 3, BaseHp = 500, Damage = 18 },
                new SurvivalWaveDef { Wave = 2, Key = "ettin", Name = "ETTINS", Sub = "More bodies", CatalogId = 0, Quota = 4, BaseHp = 550, Damage = 20 },
                new SurvivalWaveDef { Wave = 3, Key = "ettin", Name = "ETTINS", Sub = "Spacing matters", CatalogId = 0, Quota = 5, BaseHp = 600, Damage = 22 },
                new SurvivalWaveDef { Wave = 4, Key = "ettin", Name = "ETTINS", Sub = "Hold the line", CatalogId = 0, Quota = 6, BaseHp = 650, Damage = 24 },
                new SurvivalWaveDef { Wave = 5, Key = "ettin", Name = "ETTINS", Sub = "Final pack", CatalogId = 0, Quota = 8, BaseHp = 700, Damage = 26 },
            ],
        };
    }

    private sealed class SurvivalWaveDef {
        public int Wave { get; set; }
        public string Key { get; set; } = "";
        public string Name { get; set; } = "WAVE";
        public string Sub { get; set; } = "";
        public int CatalogId { get; set; } = 1;
        public int Quota { get; set; } = 8;
        public int BaseHp { get; set; } = 50;
        public int Damage { get; set; } = 10;
        public bool Boss { get; set; }
    }
}
