using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Runtime mutable anti-bot / AFK / tournament-AI tool flags loaded from <c>AntiBotTools.json</c>.
/// GM clients may get/set flags; traveler sessions are rejected. Some tools enforce lightly today;
/// others only log that they would enforce until full ingress/claim pipelines exist.
/// </summary>
public static class AntiBotTools {
    private static readonly object SyncRoot = new();
    private static AntiBotToolsConfig state = new();

    /// <summary>Latest in-memory config (thread-safe snapshot via lock).</summary>
    public static AntiBotToolsConfig Snapshot {
        get {
            lock (SyncRoot) {
                return state;
            }
        }
    }

    /// <summary>True when Passport/score would gate Helvet claim (middleware can read this; no Passport call yet).</summary>
    public static bool IsClaimTimeSybilGateEnabled => Snapshot.ClaimTimeSybilGate;

    /// <summary>Loads config at process start.</summary>
    public static void Initialize(AntiBotToolsConfig config) {
        ArgumentNullException.ThrowIfNull(config);
        lock (SyncRoot) {
            state = Normalize(config);
        }
        Console.WriteLine(
            $"[AntiBotTools] Loaded flags: guildPriority={state.GuildPriorityIngress}, newPlayerSegment={state.NewPlayerSegment}, " +
            $"claimSybil={state.ClaimTimeSybilGate}, multiBox={state.IndustrialMultiBoxLimits}, afkAllowed={state.AfkOnMapAllowed}, " +
            $"tourTelemetry={state.TournamentInhumanPlayTelemetry}, highStakes={state.TournamentHighStakesMode}, softOffline={state.SoftOfflineProgression}.");
    }

    /// <summary>GM get: returns current state. Traveler / non-allowlisted sessions are rejected.</summary>
    public static void HandleGetRequest(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (!AdminSecurity.CanUseGmTools(player)) {
            RejectTraveler(player);
            return;
        }

        NetworkManager.SendToPlayer(player, new ServerMessage { AntiBotToolsState = ToProtoState(Snapshot) });
    }

    /// <summary>GM set: replaces all flags, persists JSON, replies with result. Allowlisted GM only.</summary>
    public static void HandleSetRequest(GameWorldPlayer player, SetAntiBotToolsRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (!AdminSecurity.CanUseGmTools(player)) {
            NetworkManager.SendToPlayer(player, new ServerMessage {
                SetAntiBotToolsResult = new SetAntiBotToolsResult {
                    Ok = false,
                    Message = "Only allowlisted GM sessions may change anti-bot tools.",
                    State = ToProtoState(Snapshot),
                },
            });
            RejectTraveler(player);
            return;
        }

        if (request.Flags is null) {
            NetworkManager.SendToPlayer(player, new ServerMessage {
                SetAntiBotToolsResult = new SetAntiBotToolsResult {
                    Ok = false,
                    Message = "flags payload is required.",
                    State = ToProtoState(Snapshot),
                },
            });
            return;
        }

        var updatedBy = string.IsNullOrWhiteSpace(player.CharacterName) ? player.AccountWallet : player.CharacterName;
        var next = FromProtoFlags(request.Flags, Snapshot, updatedBy);
        lock (SyncRoot) {
            state = next;
        }

        try {
            Config.SaveAntiBotToolsConfigAsync(next).GetAwaiter().GetResult();
        } catch (Exception ex) {
            Console.WriteLine($"[AntiBotTools] Persist failed after GM set by '{updatedBy}': {ex.Message}");
            NetworkManager.SendToPlayer(player, new ServerMessage {
                SetAntiBotToolsResult = new SetAntiBotToolsResult {
                    Ok = false,
                    Message = $"Flags applied in memory but persist failed: {ex.Message}",
                    State = ToProtoState(next),
                },
            });
            return;
        }

        Console.WriteLine($"[AntiBotTools] GM '{updatedBy}' updated tool flags.");
        NetworkManager.SendToPlayer(player, new ServerMessage {
            SetAntiBotToolsResult = new SetAntiBotToolsResult {
                Ok = true,
                Message = "Anti-bot tools updated.",
                State = ToProtoState(next),
            },
        });
        NetworkManager.SendToPlayer(player, new ServerMessage { AntiBotToolsState = ToProtoState(next) });
    }

    /// <summary>
    /// Called before accepting a new (non-reconnect) authenticate. Returns false when industrial multi-box
    /// limits would refuse the join; also logs guild-priority / new-player segment stubs near capacity.
    /// </summary>
    public static bool TryAllowNewSession(string networkId, bool travelerMode, int currentOnline, out string? rejectReason) {
        rejectReason = null;
        var snap = Snapshot;

        if (snap.IndustrialMultiBoxLimits && currentOnline >= Math.Max(1, snap.MaxConcurrentSessions)) {
            rejectReason =
                $"Industrial multi-box limits: server at {currentOnline}/{snap.MaxConcurrentSessions} sessions.";
            Console.WriteLine($"[AntiBotTools] Rejected '{networkId}' — {rejectReason}");
            return false;
        }

        if (snap.GuildPriorityIngress && currentOnline >= snap.NearCapacityOnline) {
            Console.WriteLine(
                $"[AntiBotTools] Would enforce guild-priority ingress for '{networkId}' " +
                $"(online={currentOnline}, nearCapacity={snap.NearCapacityOnline}, traveler={travelerMode}).");
        }

        if (snap.NewPlayerSegment) {
            Console.WriteLine(
                $"[AntiBotTools] Would route '{networkId}' through new-player segment " +
                $"(queue/overflow/delayed claim stub; traveler={travelerMode}).");
        }

        if (snap.ClaimTimeSybilGate) {
            Console.WriteLine(
                $"[AntiBotTools] Claim-time sybil gate ON — Helvet/airdrop claim would require Passport/score (wallet '{networkId}').");
        }

        if (snap.IndustrialMultiBoxLimits) {
            Console.WriteLine(
                $"[AntiBotTools] Would apply action-rate ceiling ({snap.ActionRateCeilingPerMin}/min) " +
                $"and wallet-clustering hooks for '{networkId}'.");
        }

        return true;
    }

    /// <summary>Marks recent gameplay so AFK timers reset (move / cast / attack / chat).</summary>
    public static void NoteGameplayActivity(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        player.NoteGameplayActivity(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    /// <summary>
    /// Periodic world tick: AFK warn/kick when AFK-on-map is OFF; soft offline XP drip when flagged.
    /// </summary>
    public static void TickWorld(GameWorldRef wr) {
        var snap = Snapshot;
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // Bleeding Island lobby: always allow AFK (Arena incentives require multi-hour presence).
        var arenaAfkExempt = ArenaIncentives.IsAntiAfkExemptWorld(wr.WorldId);

        foreach (var player in wr.World.EnumerateConnectedPlayers()) {
            if (player.Disconnected || player.IsDead) {
                continue;
            }

            var idleMs = nowMs - player.LastGameplayActivityMs;
            if (!snap.AfkOnMapAllowed && !arenaAfkExempt) {
                if (idleMs >= snap.AfkKickAfterMs) {
                    Console.WriteLine(
                        $"[AntiBotTools] AFK kick player {player.PlayerId} '{player.CharacterName}' idleMs={idleMs}.");
                    player.RequestDisconnect("You were disconnected for being AFK too long (AFK-on-map is disabled).");
                    continue;
                }

                if (idleMs >= snap.AfkWarnAfterMs && !player.AfkWarned) {
                    player.AfkWarned = true;
                    NetworkManager.SendToPlayer(
                        player,
                        NetworkManager.CreateChatMessageReceived(
                            "System",
                            nowMs,
                            $"AFK warning: move or act soon or you will be kicked ({snap.AfkKickAfterMs / 1000}s idle max)."));
                    Console.WriteLine(
                        $"[AntiBotTools] AFK warn player {player.PlayerId} '{player.CharacterName}' idleMs={idleMs}.");
                }
            }

            if (snap.SoftOfflineProgression && idleMs >= snap.AfkWarnAfterMs) {
                TrySoftOfflineDrip(player, snap, nowMs);
            }
        }
    }

    /// <summary>Logs high-stakes stream/identity stub when a player enters a tournament arena and the flag is ON.</summary>
    public static void OnTournamentEntry(GameWorldPlayer player, string worldId) {
        ArgumentNullException.ThrowIfNull(player);
        if (!Snapshot.TournamentHighStakesMode) {
            return;
        }

        Console.WriteLine(
            $"[AntiBotTools] Would require stream/identity stub before prize for '{player.CharacterName}' " +
            $"entering tournament world '{worldId}' (high-stakes mode ON).");
    }

    /// <summary>When tournament telemetry is ON, logs cast-interval anomaly signals in arena worlds.</summary>
    public static void NoteTournamentCast(
        GameWorldPlayer player,
        string worldId,
        bool isTournamentArena,
        long elapsedSinceStartMs,
        int castSpeedMs) {
        ArgumentNullException.ThrowIfNull(player);
        if (!isTournamentArena || !Snapshot.TournamentInhumanPlayTelemetry) {
            return;
        }

        if (elapsedSinceStartMs >= 0 && elapsedSinceStartMs < castSpeedMs * 0.5) {
            Console.WriteLine(
                $"[AntiBotTools:telemetry] cast anomaly world={worldId} player={player.PlayerId} '{player.CharacterName}' " +
                $"elapsedMs={elapsedSinceStartMs} castSpeedMs={castSpeedMs}.");
        }
    }

    /// <summary>When tournament telemetry is ON, logs ultra-fast move deltas in arena worlds.</summary>
    public static void NoteTournamentMove(GameWorldPlayer player, string worldId, bool isTournamentArena, long deltaMs) {
        ArgumentNullException.ThrowIfNull(player);
        if (!isTournamentArena || !Snapshot.TournamentInhumanPlayTelemetry) {
            return;
        }

        if (deltaMs > 0 && deltaMs < 40) {
            Console.WriteLine(
                $"[AntiBotTools:telemetry] move anomaly world={worldId} player={player.PlayerId} '{player.CharacterName}' deltaMs={deltaMs}.");
        }
    }

    private static void TrySoftOfflineDrip(GameWorldPlayer player, AntiBotToolsConfig snap, long nowMs) {
        if (player.LastSoftOfflineDripMs > 0 &&
            nowMs - player.LastSoftOfflineDripMs < Math.Max(1000, snap.SoftOfflineTickMs)) {
            return;
        }

        player.LastSoftOfflineDripMs = nowMs;
        var xp = Math.Max(0, snap.SoftOfflineXpPerTick);
        if (xp <= 0 || Progression.Config is null) {
            Console.WriteLine(
                $"[AntiBotTools] Would drip soft offline XP for '{player.CharacterName}' (xp={xp}).");
            return;
        }

        var before = player.Exp;
        if (player.LevelBlocked || player.Level >= (Progression.Config?.MaxLevel ?? int.MaxValue)) {
            Progression.ApplyMajesticFromExp(player, xp);
            Console.WriteLine(
                $"[AntiBotTools] Soft offline drip +{xp} XP → majestic for '{player.CharacterName}' (block/max).");
            Progression.SendProgressionUpdated(player, leveledUp: false);
            return;
        }

        var newExp = before > long.MaxValue - xp ? long.MaxValue : before + xp;
        var newLevel = Progression.GetLevelForExp(newExp, player.Rebirth);
        var leveledUp = player.AddExp(xp, newLevel);
        Console.WriteLine(
            $"[AntiBotTools] Soft offline drip +{xp} XP for '{player.CharacterName}' (exp {before}->{player.Exp}, leveledUp={leveledUp}).");
        Progression.SendProgressionUpdated(player, leveledUp);
    }

    private static void RejectTraveler(GameWorldPlayer player) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived("System", nowMs, "Anti-bot tools are GM-only."));
        Console.WriteLine($"[AntiBotTools] Rejected traveler session player {player.PlayerId}.");
    }

    private static AntiBotToolsConfig Normalize(AntiBotToolsConfig c) => c with {
        MaxConcurrentSessions = Math.Clamp(c.MaxConcurrentSessions, 1, 100_000),
        ActionRateCeilingPerMin = Math.Clamp(c.ActionRateCeilingPerMin, 1, 1_000_000),
        AfkWarnAfterMs = Math.Max(5_000, c.AfkWarnAfterMs),
        AfkKickAfterMs = Math.Max(c.AfkWarnAfterMs + 1_000, c.AfkKickAfterMs),
        SoftOfflineXpPerTick = Math.Clamp(c.SoftOfflineXpPerTick, 0, 1000),
        SoftOfflineTickMs = Math.Clamp(c.SoftOfflineTickMs, 5_000, 3_600_000),
        NearCapacityOnline = Math.Clamp(c.NearCapacityOnline, 1, 1_000_000),
        UpdatedBy = string.IsNullOrWhiteSpace(c.UpdatedBy) ? "bootstrap" : c.UpdatedBy.Trim(),
    };

    private static AntiBotToolsConfig FromProtoFlags(AntiBotToolsFlags flags, AntiBotToolsConfig previous, string updatedBy) =>
        Normalize(previous with {
            GuildPriorityIngress = flags.GuildPriorityIngress,
            NewPlayerSegment = flags.NewPlayerSegment,
            ClaimTimeSybilGate = flags.ClaimTimeSybilGate,
            IndustrialMultiBoxLimits = flags.IndustrialMultiBoxLimits,
            AfkOnMapAllowed = flags.AfkOnMapAllowed,
            TournamentInhumanPlayTelemetry = flags.TournamentInhumanPlayTelemetry,
            TournamentHighStakesMode = flags.TournamentHighStakesMode,
            SoftOfflineProgression = flags.SoftOfflineProgression,
            UpdatedBy = updatedBy,
            UpdatedAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        });

    private static AntiBotToolsState ToProtoState(AntiBotToolsConfig c) => new() {
        Flags = new AntiBotToolsFlags {
            GuildPriorityIngress = c.GuildPriorityIngress,
            NewPlayerSegment = c.NewPlayerSegment,
            ClaimTimeSybilGate = c.ClaimTimeSybilGate,
            IndustrialMultiBoxLimits = c.IndustrialMultiBoxLimits,
            AfkOnMapAllowed = c.AfkOnMapAllowed,
            TournamentInhumanPlayTelemetry = c.TournamentInhumanPlayTelemetry,
            TournamentHighStakesMode = c.TournamentHighStakesMode,
            SoftOfflineProgression = c.SoftOfflineProgression,
        },
        MaxConcurrentSessions = c.MaxConcurrentSessions,
        ActionRateCeilingPerMin = c.ActionRateCeilingPerMin,
        AfkWarnAfterMs = c.AfkWarnAfterMs,
        AfkKickAfterMs = c.AfkKickAfterMs,
        UpdatedBy = c.UpdatedBy ?? "",
        UpdatedAtMs = c.UpdatedAtMs,
    };
}
