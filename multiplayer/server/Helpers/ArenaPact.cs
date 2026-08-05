using System.Collections.Concurrent;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Arena PVP duel FSM:
/// create (scheduled open date/time) → invite/accept →
/// at opensAt: ready_window (default 15m, all must Ready) →
/// countdown (5s) → live match (15m).
/// Prize bag: <see cref="ArenaPrizeEscrow"/> (off-chain ledger first; on-chain later).
/// DC: snapshot combat (HP/pots/gear/buffs) → 120m grace → resume or forfeit.
/// N v N: team elimination wins (captain death alone does not settle).
/// </summary>
public static class ArenaPact {
    public const int CountdownSeconds = 5;
    public const int MatchDurationSeconds = 15 * 60;
    public const int DefaultReadyWindowSeconds = 15 * 60;
    /// <summary>Seconds on the map collecting tech reports before freezing the photo.</summary>
    public const int TechSampleSeconds = 6;
    public const int InviteTtlHours = 24;
    public const int MaxFighters = 2; // 1v1 MVP (roster can grow later)
    public const int MinReadyWindowSeconds = 60;
    public const int MaxReadyWindowSeconds = 60 * 60;
    /// <summary>DC grace before prize forfeit (overridden by ArenaPrizeWhitelist.json).</summary>
    public const int DcGraceMinutesFallback = 120;

    private static readonly ConcurrentDictionary<string, PactMatch> Matches = new(StringComparer.OrdinalIgnoreCase);
    private static readonly ConcurrentDictionary<Guid, string> MatchIdBySession = new();
    private static long nextMatchSeq;
    private static long lastTickMs;

    private sealed class PactFighter {
        public Guid SessionId { get; set; }
        public required string CharacterName { get; set; }
        public string Wallet { get; set; } = "";
        public bool Ready { get; set; }
        public int Team { get; init; }
        public string? KitJson { get; set; }
        public GameWorldPlayer? Player { get; set; }
        /// <summary>Self-reported client RTT ms (transparency ledger).</summary>
        public int? PingMs { get; set; }
        public int? PingVarianceMs { get; set; }
        public int? Fps { get; set; }
        public bool TechAccepted { get; set; }
        /// <summary>Invited but has not Accept / 4Honor / Decline yet.</summary>
        public bool InvitePending { get; set; }
        /// <summary>First-person stream URL (Twitch / YT / Discord Go Live).</summary>
        public string? StreamUrl { get; set; }
        public string? StreamPlatform { get; set; }
        /// <summary>After DC reconnect — apply buffs when we have GameWorldRef (warp/tick).</summary>
        public ArenaPrizeEscrow.FighterCombatSnapshot? PendingBuffRestore { get; set; }
    }

    private sealed class PactMatch {
        public required string MatchId { get; init; }
        public required string MapId { get; init; }
        public required string HostName { get; init; }
        public required Guid HostSessionId { get; init; }
        /// <summary>scheduled | ready_window | tech_sample | tech_agree | countdown | live | dc_grace | done | cancelled | expired</summary>
        public string Status { get; set; } = "scheduled";
        public string? StakeAssetId { get; set; }
        public long StakeAmount { get; set; }
        /// <summary>Prize bag (captain pledges + house sponsor). Phase 1 ledger.</summary>
        public ArenaPrizeEscrow.PrizeBag PrizeBag { get; } = ArenaPrizeEscrow.CreateEmptyBag();
        /// <summary>Combat snapshots + DC grace + tick log.</summary>
        public ArenaPrizeEscrow.MatchCombatContext Combat { get; } = new();
        /// <summary>Captain character names (team 0 / team 1). Default: first fighter each team.</summary>
        public string? CaptainTeam0 { get; set; }
        public string? CaptainTeam1 { get; set; }
        public long CreatedAtMs { get; init; }
        public long ExpiresAtMs { get; set; }
        public long OpensAtMs { get; set; }
        public int ReadyWindowSec { get; init; } = DefaultReadyWindowSeconds;
        public long ReadyEndsAtMs { get; set; }
        public long SampleEndsAtMs { get; set; }
        public long CountdownEndsAtMs { get; set; }
        public long LiveEndsAtMs { get; set; }
        public string Message { get; set; } = "";
        /// <summary>as_is | equalize_ping | fixed_delay — locked after tech vote.</summary>
        public string TechMode { get; set; } = "as_is";
        public int TechParamMinMs { get; set; } = 0;
        public int TechParamMaxMs { get; set; } = 120;
        public int TechFpsFloor { get; set; } = 30;
        public string TechProposedBy { get; set; } = "";
        /// <summary>When true, movement packets also use equalizer delay (easy switch for testing).</summary>
        public bool TechApplyToMovement { get; set; }
        /// <summary>Frozen photo after tech_sample (used for equalize + UI).</summary>
        public int SnapshotWorstPingMs { get; set; }
        public int SnapshotBestPingMs { get; set; }
        public int SnapshotLowestFps { get; set; }
        public bool TechLocked { get; set; }
        /// <summary>True after first warp-to-map for tech_sample / ready lobby.</summary>
        public bool WarpedToMap { get; set; }
        /// <summary>When true, next Tick warps all bound fighters to MapId (ready lobby).</summary>
        public bool NeedsLobbyWarp { get; set; }
        /// <summary>Published on cartelera + Discord Events.</summary>
        public bool IsPublic { get; set; }
        public string Title { get; set; } = "";
        /// <summary>Wide / cast "global cam" (Discord-style main share).</summary>
        public string? GlobalStreamUrl { get; set; }
        public string? GlobalStreamPlatform { get; set; }
        public bool LiveDiscordNotified { get; set; }
        /// <summary>UTC ms when match entered live (for incentives).</summary>
        public long LiveStartedAtMs { get; set; }
        /// <summary>Earliest UTC ms a Discord stream URL was set (landing cartelera).</summary>
        public long DiscordStreamSinceMs { get; set; }
        /// <summary>Arena $HELL participation already paid for this match.</summary>
        public bool IncentiveGranted { get; set; }
        public List<PactFighter> Fighters { get; } = new();
        public readonly object Gate = new();
    }

    /// <summary>JSON DTO for public cartelera API + Discord.</summary>
    public sealed class PublicDuelDto {
        public required string MatchId { get; init; }
        public required string Status { get; init; }
        public required string MapId { get; init; }
        public required string HostName { get; init; }
        public required string Title { get; init; }
        public bool IsPublic { get; init; }
        public long OpensAtMs { get; init; }
        public long ReadyEndsAtMs { get; init; }
        public int SecondsLeft { get; init; }
        public string? StakeAssetId { get; init; }
        public long StakeAmount { get; init; }
        public string? GlobalStreamUrl { get; init; }
        public string? GlobalStreamPlatform { get; init; }
        public string? WatchUrl { get; init; }
        public List<PublicFighterDto> Fighters { get; init; } = new();
    }

    public sealed class PublicFighterDto {
        public required string Name { get; init; }
        public int Team { get; init; }
        public bool InvitePending { get; init; }
        public bool Ready { get; init; }
        public string? StreamUrl { get; init; }
        public string? StreamPlatform { get; init; }
    }

    public static void HandleCreate(GameWorldRef wr, GameWorldPlayer player, ArenaPactCreateRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);

        // Already in a duel: if host presses Open Ready now (opens_at≈0) on a scheduled match,
        // open the Ready window early instead of failing with a dead-end message.
        if (MatchIdBySession.TryGetValue(player.SessionId, out var existingId) &&
            Matches.TryGetValue(existingId, out var existing)) {
            var wantImmediate = req.OpensAtMs <= 0 ||
                                req.OpensAtMs <= DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + 1_000;
            lock (existing.Gate) {
                if (existing.HostSessionId == player.SessionId &&
                    wantImmediate &&
                    existing.Status is "scheduled" or "ready_window") {
                    var nowEarly = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    if (existing.Status == "scheduled") {
                        existing.Status = "ready_window";
                        existing.OpensAtMs = nowEarly;
                        existing.ReadyEndsAtMs = nowEarly + existing.ReadyWindowSec * 1000L;
                        foreach (var f in existing.Fighters) {
                            f.Ready = false;
                        }
                    }
                    existing.NeedsLobbyWarp = true;
                    existing.Message =
                        $"Ready open now on {existing.MapId} — press READY. Warping to PVP map…";
                    // Refresh host kit if provided.
                    if (!string.IsNullOrWhiteSpace(req.ArenaKitJson)) {
                        player.SetArenaKitJson(req.ArenaKitJson);
                        var hostF = existing.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
                        if (hostF is not null) {
                            hostF.KitJson = req.ArenaKitJson;
                            hostF.Player = player;
                        }
                    }
                    Broadcast(existing);
                    _ = wr;
                    return;
                }
            }
            SendStateTo(player, existing,
                existing.HostSessionId == player.SessionId
                    ? $"Already in duel ({existing.Status}). Use READY / Cancel, or wait for open time."
                    : "Already in a PVP duel — cancel or finish first.");
            return;
        }

        var mapId = (req.MapId ?? "colosseum").Trim();
        if (mapId.Length == 0) {
            mapId = "colosseum";
        }

        if (!string.IsNullOrWhiteSpace(req.ArenaKitJson)) {
            player.SetArenaKitJson(req.ArenaKitJson);
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var readyWindowSec = req.ReadyWindowSec > 0
            ? Math.Clamp(req.ReadyWindowSec, MinReadyWindowSeconds, MaxReadyWindowSeconds)
            : DefaultReadyWindowSeconds;

        // opens_at_ms = 0 → open Ready window immediately.
        long opensAt = req.OpensAtMs > 0 ? req.OpensAtMs : now;
        // Clamp: not more than 7 days out; allow up to 30s in the past as "now".
        if (opensAt < now - 30_000) {
            opensAt = now;
        }
        if (opensAt > now + 7L * 24 * 3600_000) {
            SendStateTo(player, null, "Open time must be within 7 days.");
            return;
        }

        var id = $"pact-{Interlocked.Increment(ref nextMatchSeq):x}-{now:x}";
        var isImmediate = opensAt <= now + 1_000;
        var hostStream = NormalizeStreamUrl(req.HasHostStreamUrl ? req.HostStreamUrl : null);
        var globalStream = NormalizeStreamUrl(req.HasGlobalStreamUrl ? req.GlobalStreamUrl : null);
        var title = (req.HasTitle ? req.Title : null)?.Trim() ?? "";
        if (title.Length == 0) {
            title = $"PVP · {player.CharacterName}";
        }
        var match = new PactMatch {
            MatchId = id,
            MapId = mapId,
            HostName = player.CharacterName,
            HostSessionId = player.SessionId,
            StakeAssetId = req.HasStakeAssetId ? req.StakeAssetId : null,
            StakeAmount = req.HasStakeAmount ? req.StakeAmount : 0,
            CreatedAtMs = now,
            ExpiresAtMs = Math.Max(opensAt, now) + InviteTtlHours * 3600_000L,
            OpensAtMs = opensAt,
            ReadyWindowSec = readyWindowSec,
            Message = isImmediate
                ? $"Ready on {mapId} — {readyWindowSec / 60} min for everyone to press Ready. Warping to PVP map…"
                : $"PVP duel scheduled. Opens {FormatUtc(opensAt)}. Invite your opponent.",
            Status = isImmediate ? "ready_window" : "scheduled",
            // Immediate ready: host (and later invitees) warp straight to assigned PVP map.
            NeedsLobbyWarp = isImmediate,
            IsPublic = req.IsPublic,
            Title = title.Length > 80 ? title[..80] : title,
            GlobalStreamUrl = globalStream,
            GlobalStreamPlatform = DetectStreamPlatform(globalStream),
        };
        if (isImmediate) {
            match.ReadyEndsAtMs = now + readyWindowSec * 1000L;
        }

        match.Fighters.Add(new PactFighter {
            SessionId = player.SessionId,
            CharacterName = player.CharacterName,
            Wallet = player.AccountWallet ?? "",
            Ready = false,
            Team = 0,
            KitJson = player.ArenaKitJson,
            Player = player,
            InvitePending = false,
            StreamUrl = hostStream,
            StreamPlatform = DetectStreamPlatform(hostStream),
        });
        NoteDiscordStreamLocked(match, hostStream, globalStream, now);

        Matches[id] = match;
        MatchIdBySession[player.SessionId] = id;
        Broadcast(match);
        if (match.IsPublic) {
            ArenaPactDiscord.NotifyPublicDuelCreated(ToPublicDto(match));
        }
        _ = wr;
    }

    public static void HandleSetStream(GameWorldRef wr, GameWorldPlayer player, ArenaPactSetStreamRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }
        var url = NormalizeStreamUrl(req.StreamUrl);
        if (url is null && !string.IsNullOrWhiteSpace(req.StreamUrl)) {
            SendStateTo(player, match, "Invalid stream URL (use https:// twitch / youtube / discord).");
            return;
        }
        lock (match.Gate) {
            if (match.Status is "done" or "cancelled" or "expired") {
                SendStateTo(player, match, "Duel already finished.");
                return;
            }
            if (req.IsGlobal) {
                if (player.SessionId != match.HostSessionId) {
                    SendStateTo(player, match, "Only the host can set the global cam.");
                    return;
                }
                match.GlobalStreamUrl = url;
                match.GlobalStreamPlatform = DetectStreamPlatform(url);
                match.Message = url is null
                    ? "Global cam cleared."
                    : $"Global cam set ({match.GlobalStreamPlatform}).";
                if (url is not null) {
                    NoteDiscordStreamLocked(match, null, url, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                }
            } else {
                var fighter = match.Fighters.FirstOrDefault(f =>
                    f.SessionId == player.SessionId ||
                    string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
                if (fighter is null) {
                    SendStateTo(player, match, "Not on this duel roster.");
                    return;
                }
                fighter.StreamUrl = url;
                fighter.StreamPlatform = DetectStreamPlatform(url);
                fighter.Player = player;
                fighter.SessionId = player.SessionId;
                match.Message = url is null
                    ? $"{player.CharacterName} cleared POV stream."
                    : $"{player.CharacterName} set POV stream ({fighter.StreamPlatform}).";
                if (url is not null) {
                    NoteDiscordStreamLocked(match, url, null, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                }
            }
        }
        Broadcast(match);
        _ = wr;
    }

    public static void HandleInvite(GameWorldRef wr, GameWorldPlayer player, ArenaPactInviteRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!TryGetOwnedMatch(player, req.MatchId, out var match) || match is null) {
            SendStateTo(player, null, "Duel not found or you are not the host.");
            return;
        }

        var targetName = (req.TargetCharacterName ?? "").Trim();
        if (targetName.Length == 0) {
            SendStateTo(player, match, "Enter opponent character name.");
            return;
        }

        if (string.Equals(targetName, player.CharacterName, StringComparison.OrdinalIgnoreCase)) {
            SendStateTo(player, match, "Cannot invite yourself.");
            return;
        }

        OnlinePlayerDirectory.TryGetByCharacterName(targetName, out var target);
        if (target is not null && target.SessionId == player.SessionId) {
            SendStateTo(player, match, "Cannot invite yourself.");
            return;
        }

        if (target is not null && MatchIdBySession.ContainsKey(target.SessionId)) {
            SendStateTo(player, match, $"{target.CharacterName} is already in a duel.");
            return;
        }

        lock (match.Gate) {
            if (match.Status is "countdown" or "live" or "done" or "cancelled" or "expired" or "tech_sample" or "tech_agree") {
                SendStateTo(player, match, "Cannot invite in current duel state.");
                return;
            }
            if (match.Fighters.Count >= MaxFighters &&
                !match.Fighters.Any(f => string.Equals(f.CharacterName, targetName, StringComparison.OrdinalIgnoreCase))) {
                SendStateTo(player, match, "Roster full (1v1).");
                return;
            }
            if (match.Fighters.Any(f =>
                    string.Equals(f.CharacterName, targetName, StringComparison.OrdinalIgnoreCase))) {
                SendStateTo(player, match, "Already invited.");
                return;
            }

            var displayName = target?.CharacterName ?? targetName;
            var fighter = new PactFighter {
                SessionId = target?.SessionId ?? Guid.Empty,
                CharacterName = displayName,
                Wallet = target?.AccountWallet ?? "",
                Ready = false,
                Team = 1,
                KitJson = target?.ArenaKitJson,
                Player = target,
                InvitePending = true,
            };
            match.Fighters.Add(fighter);
            if (target is not null) {
                MatchIdBySession[target.SessionId] = match.MatchId;
            }

            var stakeNote = FormatStakeNote(match);
            match.Message = target is not null
                ? $"Invited {displayName} (online).{stakeNote}"
                : $"Invited {displayName} (offline — will see invite on hub / when online).{stakeNote}";
        }

        Broadcast(match);
        if (target is not null) {
            NetworkManager.SendToPlayer(target, NetworkManager.CreateSendMessage(
                $"[Arena] {player.CharacterName} challenged you to a PVP duel on {match.MapId}{FormatStakeNote(match)}. Accept / Decline / 4Honor on the landing or in Create PVP Duel."));
            // Push full state so UI can open Accept/Decline.
            SendStateTo(target, match, match.Message);
        }
        _ = wr;
    }

    public static void HandleRespond(GameWorldRef wr, GameWorldPlayer player, ArenaPactRespondRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }

        var mode = (req.HasResponseMode ? req.ResponseMode : null)?.Trim().ToLowerInvariant() ?? "";
        if (mode.Length == 0) {
            mode = req.Accept ? "accept" : "decline";
        }

        lock (match.Gate) {
            var fighter = match.Fighters.FirstOrDefault(f =>
                f.SessionId == player.SessionId ||
                (f.InvitePending &&
                 string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase)));
            if (fighter is null) {
                SendStateTo(player, match, "You are not on this duel roster.");
                return;
            }

            if (mode is "decline" or "reject" or "no") {
                match.Fighters.RemoveAll(f =>
                    f.SessionId == player.SessionId ||
                    string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
                MatchIdBySession.TryRemove(player.SessionId, out _);
                if (player.SessionId == match.HostSessionId) {
                    CancelLocked(match, "Host cancelled.");
                } else {
                    match.Message = $"{player.CharacterName} declined.";
                    Broadcast(match);
                }
                SendStateTo(player, null, "Declined PVP duel.");
                return;
            }

            // honor = accept but clear stakes (play for honor, no bolsa $)
            if (mode is "honor" or "4honor" or "for_honor") {
                match.StakeAmount = 0;
                match.StakeAssetId = null;
                _ = ArenaPrizeEscrow.TryRefund(match.PrizeBag, "honor_accept", out _);
                match.PrizeBag.State = ArenaPrizeEscrow.BagDrafting;
                match.PrizeBag.Pledges.Clear();
                match.PrizeBag.HousePledges.Clear();
                match.Message = $"{player.CharacterName} accepted for Honor (no prize bag).";
            } else {
                EnsureCaptainsLocked(match);
                var bagNote = "";
                if (match.PrizeBag.State is ArenaPrizeEscrow.BagDrafting or ArenaPrizeEscrow.BagEditing) {
                    var caps = GetCaptainNames(match);
                    if (caps.Count >= 2 && match.PrizeBag.PendingConfirmNames.Count == 0 &&
                        ArenaPrizeEscrow.TryLockBag(match.PrizeBag, out _)) {
                        var sum = ArenaPrizeEscrow.SummarizeBag(match.PrizeBag);
                        bagNote = string.IsNullOrEmpty(sum) ? " Prize bag LOCKED (empty)." : $" Prize bag LOCKED ({sum}).";
                    }
                }
                match.Message = match.Status == "ready_window"
                    ? $"{player.CharacterName} joined. Press Ready before the window ends.{bagNote}"
                    : $"{player.CharacterName} accepted. Waiting for open time.{bagNote}";
            }

            if (!string.IsNullOrWhiteSpace(req.ArenaKitJson)) {
                player.SetArenaKitJson(req.ArenaKitJson);
                fighter.KitJson = req.ArenaKitJson;
            }
            if (req.HasStreamUrl) {
                var sUrl = NormalizeStreamUrl(req.StreamUrl);
                fighter.StreamUrl = sUrl;
                fighter.StreamPlatform = DetectStreamPlatform(sUrl);
                if (sUrl is not null) {
                    NoteDiscordStreamLocked(match, sUrl, null, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                }
            }
            fighter.Player = player;
            fighter.SessionId = player.SessionId;
            fighter.CharacterName = player.CharacterName;
            fighter.Wallet = player.AccountWallet ?? fighter.Wallet;
            fighter.InvitePending = false;
            MatchIdBySession[player.SessionId] = match.MatchId;

            // If ready window already open, pull them onto the PVP map.
            if (match.Status == "ready_window") {
                match.NeedsLobbyWarp = true;
            }
        }

        Broadcast(match);
        _ = wr;
    }

    public static void HandleReady(GameWorldRef wr, GameWorldPlayer player, ArenaPactReadyRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }

        lock (match.Gate) {
            if (match.Status != "ready_window") {
                SendStateTo(player, match,
                    match.Status == "scheduled"
                        ? "Ready is locked until the scheduled open time."
                        : "Ready is only available during the Ready window.");
                return;
            }

            var fighter = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            if (fighter is null) {
                SendStateTo(player, match, "Not on roster.");
                return;
            }
            if (fighter.InvitePending) {
                SendStateTo(player, match, "Accept the invite first (Accept / 4Honor), then Ready.");
                return;
            }

            if (!string.IsNullOrWhiteSpace(req.ArenaKitJson)) {
                player.SetArenaKitJson(req.ArenaKitJson);
                fighter.KitJson = req.ArenaKitJson;
            }
            if (req.HasReportPingMs) {
                fighter.PingMs = Math.Clamp(req.ReportPingMs, 0, 5000);
            }
            if (req.HasReportPingVarianceMs) {
                fighter.PingVarianceMs = Math.Clamp(req.ReportPingVarianceMs, 0, 5000);
            }
            if (req.HasReportFps) {
                fighter.Fps = Math.Clamp(req.ReportFps, 0, 1000);
            }
            fighter.Ready = req.Ready;
            fighter.Player = player;

            // Only accepted (non-pending) fighters count toward Ready.
            var accepted = match.Fighters.Where(f => !f.InvitePending).ToList();
            var readyCount = accepted.Count(f => f.Ready);
            var total = accepted.Count;
            var techNote = BuildTechFairnessNote(match);
            if (total >= 2 && accepted.All(f => f.Ready)) {
                // All Ready → tech_sample (map already should be warping/warped from ready lobby).
                BeginTechSampleLocked(match);
            } else {
                foreach (var f in match.Fighters) {
                    f.TechAccepted = false;
                }
                match.Message = req.Ready
                    ? $"Ready {readyCount}/{total}. Waiting for everyone… {techNote}".Trim()
                    : $"{player.CharacterName} unready. Ready {readyCount}/{total}.";
            }
        }

        Broadcast(match);
        _ = wr;
    }

    public static void HandleTechReport(GameWorldRef wr, GameWorldPlayer player, ArenaPactTechReportRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            return;
        }

        lock (match.Gate) {
            if (match.Status is not ("tech_sample" or "tech_agree" or "countdown" or "live")) {
                return;
            }
            var fighter = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            if (fighter is null) {
                return;
            }
            fighter.Player = player;
            fighter.PingMs = Math.Clamp(req.PingMs, 0, 5000);
            fighter.PingVarianceMs = Math.Clamp(req.PingVarianceMs, 0, 5000);
            fighter.Fps = Math.Clamp(req.Fps, 0, 1000);
            // During sample, broadcast lightly so UI can show live readings.
            if (match.Status == "tech_sample") {
                match.Message =
                    $"Measuring tech on map… {Math.Max(0, (match.SampleEndsAtMs - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) / 1000)}s left. {BuildTechFairnessNote(match)}";
            }
        }
        if (match.Status == "tech_sample") {
            Broadcast(match);
        }
        _ = wr;
    }

    public static void HandleTechPropose(GameWorldRef wr, GameWorldPlayer player, ArenaPactTechProposeRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }

        lock (match.Gate) {
            if (match.Status != "tech_agree") {
                SendStateTo(player, match, "Tech agreement is only open after the tech photo is ready.");
                return;
            }
            if (!match.Fighters.Any(f => f.SessionId == player.SessionId)) {
                SendStateTo(player, match, "Not on roster.");
                return;
            }

            var mode = NormalizeTechMode(req.Mode);
            var minMs = Math.Clamp(req.ParamMinMs, 0, 500);
            var maxMs = Math.Clamp(req.ParamMaxMs, 0, 500);
            if (maxMs < minMs) {
                (minMs, maxMs) = (maxMs, minMs);
            }
            var fpsFloor = Math.Clamp(req.FpsFloor, 0, 120);

            match.TechMode = mode;
            match.TechParamMinMs = minMs;
            match.TechParamMaxMs = maxMs;
            match.TechFpsFloor = fpsFloor;
            match.TechApplyToMovement = req.ApplyToMovement;
            match.TechProposedBy = player.CharacterName;
            foreach (var f in match.Fighters) {
                f.TechAccepted = false;
            }
            // Proposer auto-accepts their own proposal.
            var me = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            if (me is not null) {
                me.TechAccepted = true;
            }
            match.Message =
                $"{player.CharacterName} proposed tech: {DescribeTech(match)}. Captains must Accept.";
        }

        Broadcast(match);
        _ = wr;
    }

    public static void HandleTechVote(GameWorldRef wr, GameWorldPlayer player, ArenaPactTechVoteRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }

        lock (match.Gate) {
            if (match.Status != "tech_agree") {
                SendStateTo(player, match, "No active tech vote.");
                return;
            }
            var fighter = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            if (fighter is null) {
                SendStateTo(player, match, "Not on roster.");
                return;
            }

            if (!req.Accept) {
                fighter.TechAccepted = false;
                foreach (var f in match.Fighters) {
                    f.TechAccepted = false;
                }
                match.Message = $"{player.CharacterName} rejected tech — propose again.";
                Broadcast(match);
                return;
            }

            fighter.TechAccepted = true;
            var accepted = match.Fighters.Count(f => f.TechAccepted);
            var total = match.Fighters.Count;
            if (total >= 2 && match.Fighters.All(f => f.TechAccepted)) {
                match.TechLocked = true;
                match.Status = "countdown";
                match.CountdownEndsAtMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + CountdownSeconds * 1000L;
                match.Message =
                    $"Tech locked: {DescribeTech(match)}. Fight in {CountdownSeconds}s… PHOTO worst ping {match.SnapshotWorstPingMs}ms / lowest FPS {match.SnapshotLowestFps}.";
            } else {
                match.Message = $"Tech accept {accepted}/{total} — {DescribeTech(match)}";
            }
        }

        Broadcast(match);
        _ = wr;
    }

    /// <summary>
    /// Combat input delay for a live duel fighter under the locked tech profile.
    /// equalize_ping: clamp(worst−mine, min, max). fixed_delay: max for all. as_is: 0.
    /// </summary>
    public static int GetCombatDelayMs(GameWorldPlayer player) =>
        GetDelayMs(player, forMovement: false);

    /// <summary>Same equalizer, only when tech_apply_to_movement is ON (easy switch).</summary>
    public static int GetMovementDelayMs(GameWorldPlayer player) =>
        GetDelayMs(player, forMovement: true);

    private static int GetDelayMs(GameWorldPlayer player, bool forMovement) {
        if (player is null || !MatchIdBySession.TryGetValue(player.SessionId, out var matchId)) {
            return 0;
        }
        if (!Matches.TryGetValue(matchId, out var match)) {
            return 0;
        }
        lock (match.Gate) {
            if (match.Status != "live" || !match.TechLocked) {
                return 0;
            }
            if (forMovement && !match.TechApplyToMovement) {
                return 0;
            }
            var fighter = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            if (fighter is null) {
                return 0;
            }
            return ComputeDelayMsLocked(match, fighter);
        }
    }

    private static int ComputeDelayMsLocked(PactMatch match, PactFighter fighter) {
        return match.TechMode switch {
            "fixed_delay" => Math.Clamp(match.TechParamMaxMs, 0, 500),
            "equalize_ping" => ComputeEqualizeDelayMs(match, fighter),
            _ => 0,
        };
    }

    private static int ComputeEqualizeDelayMs(PactMatch match, PactFighter fighter) {
        var myPing = fighter.PingMs ?? match.SnapshotBestPingMs;
        var worst = match.SnapshotWorstPingMs > 0 ? match.SnapshotWorstPingMs : myPing;
        var raw = worst - myPing;
        if (raw < match.TechParamMinMs) {
            raw = match.TechParamMinMs;
        }
        if (raw > match.TechParamMaxMs) {
            raw = match.TechParamMaxMs;
        }
        return Math.Max(0, raw);
    }

    /// <summary>True if this fighter is a team captain (host, or first fighter of their team).</summary>
    private static bool IsCaptain(PactMatch match, PactFighter fighter) {
        if (fighter.SessionId == match.HostSessionId) {
            return true;
        }
        var firstOfTeam = match.Fighters.FirstOrDefault(f => f.Team == fighter.Team);
        return firstOfTeam is not null && firstOfTeam.SessionId == fighter.SessionId;
    }

    public static void HandleCancel(GameWorldRef wr, GameWorldPlayer player, ArenaPactCancelRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }

        lock (match.Gate) {
            if (player.SessionId != match.HostSessionId &&
                !match.Fighters.Any(f => f.SessionId == player.SessionId)) {
                SendStateTo(player, null, "Not your duel.");
                return;
            }
            CancelLocked(match, $"{player.CharacterName} cancelled the PVP duel.");
        }
        _ = wr;
    }

    public static void HandleList(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        PurgeExpired();
        var list = new ArenaPactListResponse();
        foreach (var m in Matches.Values) {
            if (m.Status is "done" or "cancelled" or "expired") {
                continue;
            }
            // Host / roster / pending invitee see the duel; others get open public list of scheduled.
            var relevant = m.HostSessionId == player.SessionId ||
                           m.Fighters.Any(f =>
                               f.SessionId == player.SessionId ||
                               string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
            if (relevant || m.Status is "scheduled" or "ready_window") {
                list.Matches.Add(ToProto(m));
            }
        }
        NetworkManager.SendToPlayer(player, new ServerMessage { ArenaPactListResponse = list });
    }

    /// <summary>
    /// Hub decline (authenticated via short-lived WS): remove pending invite by name + match id.
    /// </summary>
    public static bool TryHubDecline(string matchId, string inviteeName, out string message) {
        message = "Duel not found.";
        if (string.IsNullOrWhiteSpace(matchId) || string.IsNullOrWhiteSpace(inviteeName)) {
            return false;
        }
        if (!Matches.TryGetValue(matchId.Trim(), out var match)) {
            return false;
        }
        lock (match.Gate) {
            var fighter = match.Fighters.FirstOrDefault(f =>
                f.InvitePending &&
                string.Equals(f.CharacterName, inviteeName.Trim(), StringComparison.OrdinalIgnoreCase));
            if (fighter is null) {
                message = "No pending invite for that name.";
                return false;
            }
            match.Fighters.Remove(fighter);
            if (fighter.SessionId != Guid.Empty) {
                MatchIdBySession.TryRemove(fighter.SessionId, out _);
            }
            match.Message = $"{fighter.CharacterName} declined (hub).";
            Broadcast(match);
            message = "Declined PVP duel.";
            return true;
        }
    }

    /// <summary>Hub / character-list: open invites matching any of the given names (case-insensitive).</summary>
    public static IReadOnlyList<ArenaPactState> CollectInvitesForNames(IEnumerable<string> names) {
        PurgeExpired();
        var set = new HashSet<string>(
            names.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()),
            StringComparer.OrdinalIgnoreCase);
        if (set.Count == 0) {
            return Array.Empty<ArenaPactState>();
        }
        var result = new List<ArenaPactState>();
        foreach (var m in Matches.Values) {
            if (m.Status is "done" or "cancelled" or "expired") {
                continue;
            }
            lock (m.Gate) {
                var hit = m.Fighters.Any(f =>
                    f.InvitePending && set.Contains(f.CharacterName));
                if (hit) {
                    result.Add(ToProto(m));
                }
            }
        }
        return result;
    }

    /// <summary>Pre-world hub list (wallet-authenticated). Returns invites for filter_names.</summary>
    public static ArenaPactListResponse BuildInboxResponse(IEnumerable<string> filterNames) {
        var list = new ArenaPactListResponse();
        foreach (var s in CollectInvitesForNames(filterNames)) {
            list.Matches.Add(s);
        }
        return list;
    }

    /// <summary>
    /// When a player joins any world: bind pending invites by character name and push duel state.
    /// </summary>
    public static void OnPlayerJoined(GameWorldPlayer player) {
        if (player is null || string.IsNullOrWhiteSpace(player.CharacterName)) {
            return;
        }
        PurgeExpired();
        foreach (var match in Matches.Values) {
            if (match.Status is "done" or "cancelled" or "expired") {
                continue;
            }
            lock (match.Gate) {
                var fighter = match.Fighters.FirstOrDefault(f =>
                    string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
                if (fighter is null) {
                    continue;
                }
                fighter.Player = player;
                fighter.SessionId = player.SessionId;
                fighter.Wallet = player.AccountWallet ?? fighter.Wallet;
                MatchIdBySession[player.SessionId] = match.MatchId;

                // DC reconnect: restore combat snapshot (HP/pots/gear/buffs) and resume live.
                if (match.Status == "dc_grace" &&
                    string.Equals(match.Combat.DcCharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase)) {
                    TryResumeFromDcLocked(match, player, fighter);
                    continue;
                }

                if (match.Status == "ready_window" && !fighter.InvitePending) {
                    match.NeedsLobbyWarp = true;
                }
            }
            SendStateTo(player, match,
                match.Fighters.Any(f => f.SessionId == player.SessionId && f.InvitePending)
                    ? $"[Arena] Challenge from {match.HostName} on {match.MapId}{FormatStakeNote(match)}. Accept / Decline / 4Honor."
                    : match.Message);
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                $"[Arena] You have a PVP duel with {match.HostName} ({match.Status}). Check Create PVP Duel / hub inbox."));
        }
    }

    /// <summary>Captain pledges whitelist asset into the prize bag (drafting/editing only).</summary>
    public static void HandlePrizePledge(GameWorldPlayer player, ArenaPactPrizePledgeRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }
        lock (match.Gate) {
            if (!TryGetCaptainFighter(match, player, out var fighter) || fighter is null) {
                SendStateTo(player, match, "Only team captains can pledge to the prize bag.");
                return;
            }
            // Pledging while locked → enter edit mode and require dual re-OK first.
            if (match.PrizeBag.State == ArenaPrizeEscrow.BagLocked) {
                if (!ArenaPrizeEscrow.TryBeginEdit(match.PrizeBag, player.CharacterName, out var editErr)) {
                    SendStateTo(player, match, editErr);
                    return;
                }
                ArenaPrizeEscrow.RequireReconfirmFrom(match.PrizeBag, GetCaptainNames(match));
            }
            if (!ArenaPrizeEscrow.TryPledge(
                    match.PrizeBag,
                    player.CharacterName,
                    player.AccountWallet ?? "",
                    fighter.Team,
                    req.AssetId ?? "",
                    req.Amount,
                    req.HasInstanceId ? req.InstanceId : null,
                    out var err)) {
                SendStateTo(player, match, err);
                return;
            }
            match.Message =
                $"{player.CharacterName} pledged {req.Amount} {req.AssetId}. Bag={match.PrizeBag.State}. ({ArenaPrizeEscrow.SummarizeBag(match.PrizeBag)})";
            Broadcast(match);
        }
    }

    /// <summary>Both captains re-OK after bag edit (or confirm draft lock).</summary>
    public static void HandlePrizeConfirm(GameWorldPlayer player, ArenaPactPrizeConfirmRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }
        lock (match.Gate) {
            if (!TryGetCaptainFighter(match, player, out _)) {
                SendStateTo(player, match, "Only captains can confirm the prize bag.");
                return;
            }
            if (match.PrizeBag.State == ArenaPrizeEscrow.BagDrafting) {
                ArenaPrizeEscrow.RequireReconfirmFrom(match.PrizeBag, GetCaptainNames(match));
            }
            if (!ArenaPrizeEscrow.TryCaptainConfirm(match.PrizeBag, player.CharacterName, out var err)) {
                SendStateTo(player, match, err);
                return;
            }
            var pending = match.PrizeBag.PendingConfirmNames.Count;
            match.Message = pending == 0
                ? $"Prize bag LOCKED ({ArenaPrizeEscrow.SummarizeBag(match.PrizeBag)})."
                : $"{player.CharacterName} confirmed bag — waiting {pending} more captain OK.";
            Broadcast(match);
        }
    }

    /// <summary>DC player signs loss early → prize to other team.</summary>
    public static void HandleSignLoss(GameWorldPlayer player, ArenaPactSignLossRequest req) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(req);
        if (!Matches.TryGetValue(req.MatchId ?? "", out var match)) {
            SendStateTo(player, null, "Duel not found.");
            return;
        }
        lock (match.Gate) {
            if (match.Status is not ("live" or "dc_grace" or "countdown")) {
                SendStateTo(player, match, "Can only sign loss during live / DC grace.");
                return;
            }
            var fighter = match.Fighters.FirstOrDefault(f =>
                string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
            if (fighter is null) {
                SendStateTo(player, match, "Not in this duel.");
                return;
            }
            var winnerTeam = fighter.Team == 0 ? 1 : 0;
            var winnerCap = GetCaptainNameForTeam(match, winnerTeam) ?? "opponent";
            _ = ArenaPrizeEscrow.TrySettle(match.PrizeBag, winnerCap, "signed_loss", out _);
            match.Status = "done";
            match.Message = $"{player.CharacterName} signed LOSS — prize bag → {winnerCap}.";
            _ = ArenaPrizeEscrow.CompressTickLog(match.Combat);
            TryGrantDuelIncentivesLocked(match);
            Broadcast(match);
            ClearSessions(match);
        }
    }

    /// <summary>Call from vital regen tick (any world) — throttled process-wide.</summary>
    /// <param name="wrForBuffs">When provided, applies pending DC buff restores for players in this world.</param>
    public static void Tick(Action<GameWorldPlayer, string> requestWorldChange, GameWorldRef? wrForBuffs = null) {
        ArgumentNullException.ThrowIfNull(requestWorldChange);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var prev = Interlocked.Read(ref lastTickMs);
        if (now - prev < 400) {
            // Still apply buff restores every call when wr is present (cheap).
            if (wrForBuffs.HasValue) {
                ApplyPendingBuffRestores(wrForBuffs.Value);
            }
            return;
        }
        if (Interlocked.CompareExchange(ref lastTickMs, now, prev) != prev) {
            if (wrForBuffs.HasValue) {
                ApplyPendingBuffRestores(wrForBuffs.Value);
            }
            return;
        }

        if (wrForBuffs.HasValue) {
            ApplyPendingBuffRestores(wrForBuffs.Value);
        }

        foreach (var match in Matches.Values) {
            lock (match.Gate) {
                if (match.Status is "done" or "cancelled" or "expired") {
                    continue;
                }

                // Hard TTL (never expire mid-fight or DC grace — those have their own clocks)
                if (now >= match.ExpiresAtMs &&
                    match.Status is not ("countdown" or "live" or "dc_grace" or "tech_agree" or "tech_sample")) {
                    match.Status = "expired";
                    match.Message = "Duel expired.";
                    if (match.PrizeBag.State is not (ArenaPrizeEscrow.BagSettled or ArenaPrizeEscrow.BagRefunded)) {
                        _ = ArenaPrizeEscrow.TryRefund(match.PrizeBag, "match_expired", out _);
                    }
                    Broadcast(match);
                    ClearSessions(match);
                    continue;
                }

                if ((match.Status is "tech_agree" or "tech_sample") &&
                    match.ReadyEndsAtMs > 0 &&
                    now >= match.ReadyEndsAtMs) {
                    match.Status = "expired";
                    match.Message = "Tech phase timed out with Ready window.";
                    Broadcast(match);
                    ClearSessions(match);
                    continue;
                }

                // scheduled → ready_window at opensAt
                if (match.Status == "scheduled" && now >= match.OpensAtMs) {
                    match.Status = "ready_window";
                    match.ReadyEndsAtMs = now + match.ReadyWindowSec * 1000L;
                    foreach (var f in match.Fighters) {
                        f.Ready = false;
                    }
                    match.NeedsLobbyWarp = true;
                    match.Message =
                        $"Arena open on {match.MapId}! {match.ReadyWindowSec / 60} min Ready — warping fighters to PVP map.";
                    Broadcast(match);
                    // fall through to lobby warp in same tick
                }

                // ready_window expired without all Ready
                if (match.Status == "ready_window" && match.ReadyEndsAtMs > 0 && now >= match.ReadyEndsAtMs) {
                    match.Status = "expired";
                    match.Message = "Ready window ended — not everyone was Ready. Duel cancelled.";
                    Broadcast(match);
                    ClearSessions(match);
                    continue;
                }

                // Ready lobby / accept: warp bound fighters to assigned PVP map immediately.
                if (match.NeedsLobbyWarp && match.Status is "ready_window" or "tech_sample") {
                    match.NeedsLobbyWarp = false;
                    WarpFightersLocked(match, requestWorldChange);
                    if (match.Status == "tech_sample") {
                        match.WarpedToMap = true;
                    }
                }

                // All ready → tech_sample: warp everyone once to the duel map for measuring.
                if (match.Status == "tech_sample" && !match.WarpedToMap) {
                    match.WarpedToMap = true;
                    WarpFightersLocked(match, requestWorldChange);
                }

                // tech_sample → freeze PHOTO → tech_agree
                if (match.Status == "tech_sample" && now >= match.SampleEndsAtMs) {
                    FreezeTechPhotoLocked(match);
                    match.Status = "tech_agree";
                    match.Message =
                        $"TECH PHOTO ready. Worst ping {match.SnapshotWorstPingMs}ms · best {match.SnapshotBestPingMs}ms · lowest FPS {match.SnapshotLowestFps}. Captains: pick buffer or as-is.";
                    // Seed default equalize suggestion from photo.
                    match.TechMode = "equalize_ping";
                    match.TechParamMinMs = 0;
                    match.TechParamMaxMs = Math.Clamp(
                        Math.Max(30, match.SnapshotWorstPingMs - match.SnapshotBestPingMs + 20),
                        30,
                        150);
                    match.TechFpsFloor = 30;
                    match.TechProposedBy = "(photo auto)";
                    foreach (var f in match.Fighters) {
                        f.TechAccepted = false;
                    }
                    Broadcast(match);
                    continue;
                }

                // countdown → live (already on map; do not re-warp)
                if (match.Status == "countdown" && now >= match.CountdownEndsAtMs) {
                    match.Status = "live";
                    match.LiveStartedAtMs = now;
                    match.LiveEndsAtMs = now + MatchDurationSeconds * 1000L;
                    ArenaPrizeEscrow.FreezeForLive(match.PrizeBag);
                    CaptureAllFightersCombatLocked(match);
                    // Bleeding Island: lock safe lobby for all bound fighters until death / match end.
                    if (ArenaBleeding.IsArenaBleedingWorld(match.MapId)) {
                        SetFightersSafeZoneLock(match, locked: true);
                    }
                    match.Message =
                        $"Fight! Tech={DescribeTech(match)}. Bag={match.PrizeBag.State}. PHOTO worst {match.SnapshotWorstPingMs}ms / FPS {match.SnapshotLowestFps}.";
                    Broadcast(match);
                    if (match.IsPublic && !match.LiveDiscordNotified) {
                        match.LiveDiscordNotified = true;
                        ArenaPactDiscord.NotifyPublicDuelLive(ToPublicDto(match));
                    }
                    continue;
                }

                // live: tick log + match clock (time expiry does NOT auto-settle prize — need death/wipe or DC rules)
                if (match.Status == "live") {
                    ArenaPrizeEscrow.AppendTickSample(
                        match.Combat,
                        match.Fighters.Select(f => f.Player),
                        now);
                    if (now >= match.LiveEndsAtMs) {
                        match.Status = "done";
                        match.Message = "Time! Match ended (no elimination — prize held; ops/admin).";
                        TryGrantDuelIncentivesLocked(match);
                        Broadcast(match);
                        ClearSessions(match);
                    }
                    continue;
                }

                // dc_grace: wait for reconnect (120m) or forfeit prize to other team
                if (match.Status == "dc_grace") {
                    if (now >= match.Combat.DcGraceEndsAtMs) {
                        SettleForfeitDcLocked(match);
                        continue;
                    }
                    var leftSec = (int)Math.Max(0, (match.Combat.DcGraceEndsAtMs - now) / 1000);
                    if (leftSec % 30 == 0) {
                        match.Message =
                            $"DC grace: {match.Combat.DcCharacterName} has {leftSec / 60}m left to reconnect (bag locked). Or sign loss.";
                        Broadcast(match);
                    }
                }
            }
        }
    }

    public static void OnPlayerLeft(GameWorldPlayer player) {
        if (!MatchIdBySession.TryGetValue(player.SessionId, out var matchId)) {
            return;
        }
        if (!Matches.TryGetValue(matchId, out var match)) {
            MatchIdBySession.TryRemove(player.SessionId, out _);
            return;
        }

        lock (match.Gate) {
            // LIVE / COUNTDOWN DC → grace period (do NOT void match or steal bag immediately).
            if (match.Status is "live" or "countdown") {
                EnterDcGraceLocked(match, player);
                return;
            }

            if (match.Status == "dc_grace") {
                // Already in grace — keep bag locked.
                MatchIdBySession.TryRemove(player.SessionId, out _);
                var f = match.Fighters.FirstOrDefault(x =>
                    string.Equals(x.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
                if (f is not null) {
                    f.Player = null;
                    f.SessionId = Guid.Empty;
                }
                return;
            }

            if (player.SessionId == match.HostSessionId) {
                CancelLocked(match, "Host left.");
                if (match.PrizeBag.State is not (ArenaPrizeEscrow.BagSettled or ArenaPrizeEscrow.BagRefunded)) {
                    _ = ArenaPrizeEscrow.TryRefund(match.PrizeBag, "host_left_pre_live", out _);
                }
                return;
            }

            var fighter = match.Fighters.FirstOrDefault(f => f.SessionId == player.SessionId);
            MatchIdBySession.TryRemove(player.SessionId, out _);
            if (fighter is not null && fighter.InvitePending) {
                // Keep invite queued offline so hub still shows it.
                fighter.SessionId = Guid.Empty;
                fighter.Player = null;
                match.Message = $"{player.CharacterName} went offline — invite still pending.";
                Broadcast(match);
                return;
            }

            match.Fighters.RemoveAll(f => f.SessionId == player.SessionId);
            match.Message = $"{player.CharacterName} left.";
            Broadcast(match);
        }
    }

    private static bool TryGetOwnedMatch(GameWorldPlayer player, string? matchId, out PactMatch? match) {
        match = null;
        if (string.IsNullOrWhiteSpace(matchId) || !Matches.TryGetValue(matchId, out match)) {
            return false;
        }
        return match.HostSessionId == player.SessionId;
    }

    private static void EnsureCaptainsLocked(PactMatch match) {
        match.CaptainTeam0 ??= match.Fighters.FirstOrDefault(f => f.Team == 0)?.CharacterName;
        match.CaptainTeam1 ??= match.Fighters.FirstOrDefault(f => f.Team == 1)?.CharacterName;
        // Host is always team0 captain if unset.
        match.CaptainTeam0 ??= match.HostName;
    }

    private static List<string> GetCaptainNames(PactMatch match) {
        EnsureCaptainsLocked(match);
        var list = new List<string>(2);
        if (!string.IsNullOrWhiteSpace(match.CaptainTeam0)) {
            list.Add(match.CaptainTeam0);
        }
        if (!string.IsNullOrWhiteSpace(match.CaptainTeam1)) {
            list.Add(match.CaptainTeam1);
        }
        return list;
    }

    private static string? GetCaptainNameForTeam(PactMatch match, int team) {
        EnsureCaptainsLocked(match);
        return team == 0 ? match.CaptainTeam0 : match.CaptainTeam1;
    }

    private static bool TryGetCaptainFighter(PactMatch match, GameWorldPlayer player, out PactFighter? fighter) {
        EnsureCaptainsLocked(match);
        fighter = match.Fighters.FirstOrDefault(f =>
            string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
        if (fighter is null) {
            return false;
        }
        var isCap =
            string.Equals(match.CaptainTeam0, player.CharacterName, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(match.CaptainTeam1, player.CharacterName, StringComparison.OrdinalIgnoreCase) ||
            // 1v1: every fighter is captain of their team until roster grows.
            match.Fighters.Count <= 2;
        return isCap;
    }

    private static void CaptureAllFightersCombatLocked(PactMatch match) {
        foreach (var f in match.Fighters) {
            var p = f.Player;
            if (p is null || p.Disconnected) {
                continue;
            }
            var snap = ArenaPrizeEscrow.CaptureFighter(p, f.Team);
            match.Combat.ByName[f.CharacterName] = snap;
        }
    }

    private static void EnterDcGraceLocked(PactMatch match, GameWorldPlayer player) {
        var fighter = match.Fighters.FirstOrDefault(f =>
            f.SessionId == player.SessionId ||
            string.Equals(f.CharacterName, player.CharacterName, StringComparison.OrdinalIgnoreCase));
        if (fighter is null) {
            return;
        }

        // Snapshot everyone still online + the DC player.
        CaptureAllFightersCombatLocked(match);
        var snap = ArenaPrizeEscrow.CaptureFighter(player, fighter.Team);
        match.Combat.ByName[player.CharacterName] = snap;

        var graceMin = Math.Max(1, ArenaPrizeEscrow.GetConfig().DcGraceMinutes);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        match.Combat.DcCharacterName = player.CharacterName;
        match.Combat.DcTeam = fighter.Team;
        match.Combat.DcStartedAtMs = now;
        match.Combat.DcGraceEndsAtMs = now + graceMin * 60_000L;
        match.Status = "dc_grace";
        ArenaPrizeEscrow.MarkDcGrace(match.PrizeBag);

        fighter.Player = null;
        fighter.SessionId = Guid.Empty;
        MatchIdBySession.TryRemove(player.SessionId, out _);

        match.Message =
            $"{player.CharacterName} DC — combat snapshot saved (HP/buffs/pots/gear). " +
            $"{graceMin} min to reconnect and resume, or sign loss. Prize bag stays locked.";
        match.ExpiresAtMs = Math.Max(match.ExpiresAtMs, match.Combat.DcGraceEndsAtMs + 60_000);
        Broadcast(match);
        Console.WriteLine(
            $"[ArenaPact] DC grace match={match.MatchId} who={player.CharacterName} ends={match.Combat.DcGraceEndsAtMs}");
    }

    private static void TryResumeFromDcLocked(PactMatch match, GameWorldPlayer player, PactFighter fighter) {
        // Need a GameWorldRef to restore buffs — apply pools/gear first; buffs need wr from warp tick.
        if (match.Combat.ByName.TryGetValue(player.CharacterName, out var snap)) {
            // Pools + gear immediately; buffs restored when we have wr on next world tick via pending flag.
            player.ForceCombatPools(snap.Hp, snap.MaxHp, snap.Mp, snap.MaxMp, snap.Sp, snap.MaxSp);
            fighter.PendingBuffRestore = snap;
        }

        fighter.Player = player;
        fighter.SessionId = player.SessionId;
        MatchIdBySession[player.SessionId] = match.MatchId;
        match.Status = "live";
        ArenaPrizeEscrow.ResumeFromDc(match.PrizeBag);
        match.Combat.DcCharacterName = null;
        match.Combat.DcTeam = -1;
        match.NeedsLobbyWarp = true; // back onto arena map if they logged in elsewhere
        match.Message =
            $"{player.CharacterName} reconnected — duel RESUMED from DC snapshot (buffs restored on map). Bag={match.PrizeBag.State}.";
        Broadcast(match);
        Console.WriteLine($"[ArenaPact] Resume from DC match={match.MatchId} who={player.CharacterName}");
    }

    private static void SettleForfeitDcLocked(PactMatch match) {
        var loserTeam = match.Combat.DcTeam;
        var winnerTeam = loserTeam == 0 ? 1 : 0;
        var winnerCap = GetCaptainNameForTeam(match, winnerTeam) ?? "opponent";
        _ = ArenaPrizeEscrow.TrySettle(match.PrizeBag, winnerCap, "forfeit_dc_timeout", out _);
        match.Status = "done";
        match.Message =
            $"DC timeout (120m) — {match.Combat.DcCharacterName} forfeited. Prize bag → {winnerCap}.";
        _ = ArenaPrizeEscrow.CompressTickLog(match.Combat);
        TryGrantDuelIncentivesLocked(match);
        Broadcast(match);
        ClearSessions(match);
        Console.WriteLine($"[ArenaPact] DC forfeit settle match={match.MatchId} winner={winnerCap}");
    }

    /// <summary>Mark earliest Discord stream URL (landing / cartelera) for 15m stream bonus.</summary>
    private static void NoteDiscordStreamLocked(PactMatch match, string? povUrl, string? globalUrl, long nowMs) {
        var platformPov = DetectStreamPlatform(povUrl);
        var platformGlobal = DetectStreamPlatform(globalUrl);
        if (ArenaIncentives.IsDiscordStreamPlatform(platformPov) ||
            ArenaIncentives.IsDiscordStreamPlatform(platformGlobal)) {
            if (match.DiscordStreamSinceMs <= 0) {
                match.DiscordStreamSinceMs = nowMs;
            }
        }
    }

    /// <summary>
    /// Pay both fighters Arena duel incentives once the match has been live.
    /// Stream bonus when Discord share was up ≥15 minutes (landing).
    /// </summary>
    private static void TryGrantDuelIncentivesLocked(PactMatch match) {
        if (match.IncentiveGranted) {
            return;
        }
        if (match.LiveStartedAtMs <= 0) {
            return; // never went live — no participation pay
        }
        match.IncentiveGranted = true;
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        // Re-scan active URLs in case platform was set without NoteDiscordStreamLocked race.
        if (match.DiscordStreamSinceMs <= 0) {
            if (ArenaIncentives.IsDiscordStreamPlatform(match.GlobalStreamPlatform) ||
                match.Fighters.Any(f => ArenaIncentives.IsDiscordStreamPlatform(f.StreamPlatform))) {
                match.DiscordStreamSinceMs = match.LiveStartedAtMs > 0 ? match.LiveStartedAtMs : nowMs;
            }
        }
        var streamMs = match.DiscordStreamSinceMs > 0 ? nowMs - match.DiscordStreamSinceMs : 0;
        var streamed = streamMs >= ArenaIncentives.StreamMinutesRequired * 60_000L;

        var roster = match.Fighters
            .Select(f => (Wallet: (string?)f.Wallet, CharacterName: (string?)f.CharacterName, Player: f.Player))
            .ToList();
        try {
            ArenaIncentives.OnDuelCompleted(roster, streamed, match.MatchId);
        } catch (Exception ex) {
            Console.WriteLine($"[ArenaPact] Incentive grant failed match={match.MatchId}: {ex.Message}");
        }
    }

    private static void CancelLocked(PactMatch match, string reason) {
        match.Status = "cancelled";
        match.Message = reason;
        Broadcast(match);
        ClearSessions(match);
        Matches.TryRemove(match.MatchId, out _);
    }

    private static void ClearSessions(PactMatch match) {
        SetFightersSafeZoneLock(match, locked: false);
        foreach (var f in match.Fighters) {
            if (f.SessionId != Guid.Empty) {
                MatchIdBySession.TryRemove(f.SessionId, out _);
            }
        }
    }

    private static void SetFightersSafeZoneLock(PactMatch match, bool locked) {
        foreach (var f in match.Fighters) {
            if (f.InvitePending) {
                continue;
            }
            var p = f.Player;
            if ((p is null || p.Disconnected) &&
                OnlinePlayerDirectory.TryGetByCharacterName(f.CharacterName, out var live) &&
                live is not null) {
                p = live;
                f.Player = live;
            }
            p?.SetArenaSafeZoneLocked(locked);
        }
    }

    private static void PurgeExpired() {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var match in Matches.Values) {
            if (match.Status is "done" or "cancelled" or "expired") {
                if (now - match.CreatedAtMs > 3600_000) {
                    Matches.TryRemove(match.MatchId, out _);
                }
            }
        }
    }

    private static void Broadcast(PactMatch match) {
        foreach (var f in match.Fighters) {
            var proto = ToProto(match);
            // Personal delay only (never teammates' numbers). Always send in 1v1 / to every fighter
            // so both sides can read "your delay" once tech is locked.
            if (match.TechLocked && match.Status is "countdown" or "live" or "tech_agree") {
                proto.YourDelayMs = ComputeDelayMsLocked(match, f);
            }
            var msg = new ServerMessage { ArenaPactState = proto };
            var p = f.Player;
            if (p is not null && !p.Disconnected) {
                NetworkManager.SendToPlayer(p, msg);
            } else if (OnlinePlayerDirectory.TryGetByCharacterName(f.CharacterName, out var live) && live is not null) {
                f.Player = live;
                NetworkManager.SendToPlayer(live, msg);
            }
        }
    }

    private static void SendStateTo(GameWorldPlayer player, PactMatch? match, string message) {
        if (match is null) {
            NetworkManager.SendToPlayer(player, new ServerMessage {
                ArenaPactState = new ArenaPactState {
                    MatchId = "",
                    Status = "none",
                    Message = message,
                },
            });
            return;
        }
        var proto = ToProto(match);
        proto.Message = message;
        NetworkManager.SendToPlayer(player, new ServerMessage { ArenaPactState = proto });
    }

    private static ArenaPactState ToProto(PactMatch match) {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var secondsLeft = 0;
        if (match.Status == "scheduled" && match.OpensAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.OpensAtMs - now) / 1000.0);
        } else if ((match.Status == "ready_window" || match.Status == "tech_agree") && match.ReadyEndsAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.ReadyEndsAtMs - now) / 1000.0);
        } else if (match.Status == "tech_sample" && match.SampleEndsAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.SampleEndsAtMs - now) / 1000.0);
        } else if (match.Status == "countdown" && match.CountdownEndsAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.CountdownEndsAtMs - now) / 1000.0);
        } else if (match.Status == "live" && match.LiveEndsAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.LiveEndsAtMs - now) / 1000.0);
        }

        if (match.Status == "dc_grace" && match.Combat.DcGraceEndsAtMs > now) {
            secondsLeft = (int)Math.Ceiling((match.Combat.DcGraceEndsAtMs - now) / 1000.0);
        }

        var state = new ArenaPactState {
            MatchId = match.MatchId,
            Status = match.Status,
            MapId = match.MapId,
            HostName = match.HostName,
            SecondsLeft = Math.Max(0, secondsLeft),
            Message = match.Message,
            ExpiresAtMs = match.ExpiresAtMs,
            OpensAtMs = match.OpensAtMs,
            ReadyEndsAtMs = match.ReadyEndsAtMs,
            ReadyWindowSec = match.ReadyWindowSec,
            TechMode = match.TechMode,
            TechParamMinMs = match.TechParamMinMs,
            TechParamMaxMs = match.TechParamMaxMs,
            TechFpsFloor = match.TechFpsFloor,
            TechProposedBy = match.TechProposedBy ?? "",
            TechApplyToMovement = match.TechApplyToMovement,
            IsPublic = match.IsPublic,
        };
        if (!string.IsNullOrWhiteSpace(match.Title)) {
            state.Title = match.Title;
        }
        if (!string.IsNullOrWhiteSpace(match.GlobalStreamUrl)) {
            state.GlobalStreamUrl = match.GlobalStreamUrl;
            state.GlobalStreamPlatform = match.GlobalStreamPlatform ?? DetectStreamPlatform(match.GlobalStreamUrl);
        }
        if (match.IsPublic) {
            state.WatchUrl = ArenaPactDiscord.BuildWatchUrl(match.MatchId);
        }
        if (!string.IsNullOrWhiteSpace(match.StakeAssetId)) {
            state.StakeAssetId = match.StakeAssetId;
        }
        if (match.StakeAmount > 0) {
            state.StakeAmount = match.StakeAmount;
        }
        // Prize bag (phase 1)
        state.PrizeBagState = match.PrizeBag.State;
        var summary = ArenaPrizeEscrow.SummarizeBag(match.PrizeBag);
        if (!string.IsNullOrEmpty(summary)) {
            state.PrizeSummary = summary;
        }
        foreach (var line in match.PrizeBag.Pledges.Concat(match.PrizeBag.HousePledges)) {
            var pl = new ArenaPactPrizeLine {
                AssetId = line.AssetId,
                Amount = line.Amount,
                CaptainName = line.CaptainName,
                Team = line.Team,
            };
            if (!string.IsNullOrEmpty(line.InstanceId)) {
                pl.InstanceId = line.InstanceId;
            }
            state.PrizeLines.Add(pl);
        }
        foreach (var name in match.PrizeBag.PendingConfirmNames) {
            state.PrizePendingConfirm.Add(name);
        }
        if (!string.IsNullOrWhiteSpace(match.Combat.DcCharacterName)) {
            state.DcCharacterName = match.Combat.DcCharacterName;
            state.DcGraceEndsAtMs = match.Combat.DcGraceEndsAtMs;
        }
        if (match.SnapshotWorstPingMs > 0) {
            state.TechWorstPingMs = match.SnapshotWorstPingMs;
        } else {
            var pings = match.Fighters.Where(f => f.PingMs is > 0).Select(f => f.PingMs!.Value).ToList();
            if (pings.Count > 0) {
                state.TechWorstPingMs = pings.Max();
            }
        }
        if (match.SnapshotLowestFps > 0) {
            state.TechLowestFps = match.SnapshotLowestFps;
        } else {
            var fpsList = match.Fighters.Where(f => f.Fps is > 0).Select(f => f.Fps!.Value).ToList();
            if (fpsList.Count > 0) {
                state.TechLowestFps = fpsList.Min();
            }
        }
        foreach (var f in match.Fighters) {
            var row = new ArenaPactFighter {
                CharacterName = f.CharacterName,
                Wallet = f.Wallet ?? "",
                Ready = f.Ready,
                Team = f.Team,
                TechAccepted = f.TechAccepted,
                InvitePending = f.InvitePending,
            };
            if (f.PingMs is int ping) {
                row.PingMs = ping;
            }
            if (f.PingVarianceMs is int varMs) {
                row.PingVarianceMs = varMs;
            }
            if (f.Fps is int fps) {
                row.Fps = fps;
            }
            if (!string.IsNullOrWhiteSpace(f.StreamUrl)) {
                row.StreamUrl = f.StreamUrl;
                row.StreamPlatform = f.StreamPlatform ?? DetectStreamPlatform(f.StreamUrl);
            }
            state.Fighters.Add(row);
        }
        return state;
    }

    /// <summary>Public cartelera: upcoming + ready (not cancelled).</summary>
    public static IReadOnlyList<PublicDuelDto> ListPublicUpcoming() {
        PurgeExpired();
        var list = new List<PublicDuelDto>();
        foreach (var m in Matches.Values) {
            if (!m.IsPublic) {
                continue;
            }
            if (m.Status is "done" or "cancelled" or "expired") {
                continue;
            }
            if (m.Status is "live" or "countdown") {
                continue; // live has its own endpoint
            }
            lock (m.Gate) {
                list.Add(ToPublicDto(m));
            }
        }
        return list.OrderBy(d => d.OpensAtMs).ToList();
    }

    public static IReadOnlyList<PublicDuelDto> ListPublicLive() {
        PurgeExpired();
        var list = new List<PublicDuelDto>();
        foreach (var m in Matches.Values) {
            if (!m.IsPublic) {
                continue;
            }
            if (m.Status is not ("live" or "countdown" or "tech_sample" or "tech_agree")) {
                continue;
            }
            lock (m.Gate) {
                list.Add(ToPublicDto(m));
            }
        }
        return list;
    }

    public static PublicDuelDto? GetPublicById(string matchId) {
        if (string.IsNullOrWhiteSpace(matchId) || !Matches.TryGetValue(matchId.Trim(), out var m)) {
            return null;
        }
        // Direct watch link works even if not listed on cartelera (friends-only share).
        if (m.Status is "done" or "cancelled" or "expired") {
            lock (m.Gate) {
                return ToPublicDto(m); // still show VODs/streams if any
            }
        }
        lock (m.Gate) {
            return ToPublicDto(m);
        }
    }

    private static PublicDuelDto ToPublicDto(PactMatch match) {
        var proto = ToProto(match);
        return new PublicDuelDto {
            MatchId = match.MatchId,
            Status = match.Status,
            MapId = match.MapId,
            HostName = match.HostName,
            Title = string.IsNullOrWhiteSpace(match.Title) ? $"PVP · {match.HostName}" : match.Title,
            IsPublic = match.IsPublic,
            OpensAtMs = match.OpensAtMs,
            ReadyEndsAtMs = match.ReadyEndsAtMs,
            SecondsLeft = proto.SecondsLeft,
            StakeAssetId = match.StakeAssetId,
            StakeAmount = match.StakeAmount,
            GlobalStreamUrl = match.GlobalStreamUrl,
            GlobalStreamPlatform = match.GlobalStreamPlatform,
            WatchUrl = ArenaPactDiscord.BuildWatchUrl(match.MatchId),
            Fighters = match.Fighters.Select(f => new PublicFighterDto {
                Name = f.CharacterName,
                Team = f.Team,
                InvitePending = f.InvitePending,
                Ready = f.Ready,
                StreamUrl = f.StreamUrl,
                StreamPlatform = f.StreamPlatform,
            }).ToList(),
        };
    }

    private static string? NormalizeStreamUrl(string? raw) {
        if (string.IsNullOrWhiteSpace(raw)) {
            return null;
        }
        var u = raw.Trim();
        if (u.Length > 400) {
            u = u[..400];
        }
        if (!Uri.TryCreate(u, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)) {
            return null;
        }
        return uri.ToString();
    }

    private static string? DetectStreamPlatform(string? url) {
        if (string.IsNullOrWhiteSpace(url)) {
            return null;
        }
        var u = url.ToLowerInvariant();
        if (u.Contains("twitch.tv") || u.Contains("twitch.com")) {
            return "twitch";
        }
        if (u.Contains("youtube.com") || u.Contains("youtu.be")) {
            return "youtube";
        }
        if (u.Contains("discord") || u.Contains("discordapp")) {
            return "discord";
        }
        return "other";
    }

    private static void WarpFightersLocked(PactMatch match, Action<GameWorldPlayer, string> requestWorldChange) {
        foreach (var f in match.Fighters) {
            if (f.InvitePending) {
                continue;
            }
            // Refresh live player ref if session rebound
            if ((f.Player is null || f.Player.Disconnected) &&
                f.SessionId != Guid.Empty &&
                OnlinePlayerDirectory.TryGetByCharacterName(f.CharacterName, out var live) &&
                live is not null) {
                f.Player = live;
                f.SessionId = live.SessionId;
            }
            if (!string.IsNullOrWhiteSpace(f.KitJson) && f.Player is not null) {
                f.Player.SetArenaKitJson(f.KitJson);
            }
            if (f.Player is not null && !f.Player.Disconnected) {
                try {
                    requestWorldChange(f.Player, match.MapId);
                } catch (Exception ex) {
                    Console.WriteLine($"[ArenaPact] Warp failed for {f.CharacterName}: {ex.Message}");
                }
            }
        }
    }

    /// <summary>Restore DC buffs (good+bad) when the player is on a world with a GameWorldRef.</summary>
    private static void ApplyPendingBuffRestores(GameWorldRef wr) {
        foreach (var match in Matches.Values) {
            if (match.Status is not ("live" or "dc_grace")) {
                continue;
            }
            lock (match.Gate) {
                foreach (var f in match.Fighters) {
                    if (f.PendingBuffRestore is null || f.Player is null || f.Player.Disconnected) {
                        continue;
                    }
                    // Apply using this world's scheduler; if player is elsewhere, warp path will retry.
                    try {
                        ArenaPrizeEscrow.ApplyFighterSnapshot(wr, f.Player, f.PendingBuffRestore);
                        f.PendingBuffRestore = null;
                    } catch (Exception ex) {
                        Console.WriteLine($"[ArenaPact] Buff restore failed for {f.CharacterName}: {ex.Message}");
                    }
                }
            }
        }
    }

    private static void BeginTechSampleLocked(PactMatch match) {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        match.Status = "tech_sample";
        match.SampleEndsAtMs = now + TechSampleSeconds * 1000L;
        match.TechLocked = false;
        match.NeedsLobbyWarp = true; // ensure everyone is on the map for the photo
        match.WarpedToMap = false;
        foreach (var f in match.Fighters) {
            f.TechAccepted = false;
        }
        match.Message =
            $"All Ready — warping to {match.MapId}. Measuring tech {TechSampleSeconds}s (send ping/FPS)…";
    }

    private static string FormatStakeNote(PactMatch match) {
        if (match.StakeAmount <= 0) {
            return " · for Honor (no stake)";
        }
        var asset = string.IsNullOrWhiteSpace(match.StakeAssetId) ? "USDT" : match.StakeAssetId!;
        return $" · bolsa {match.StakeAmount} {asset} each";
    }

    private static void FreezeTechPhotoLocked(PactMatch match) {
        var pings = match.Fighters.Where(f => f.PingMs is > 0).Select(f => f.PingMs!.Value).ToList();
        var fpsList = match.Fighters.Where(f => f.Fps is > 0).Select(f => f.Fps!.Value).ToList();
        match.SnapshotWorstPingMs = pings.Count > 0 ? pings.Max() : 0;
        match.SnapshotBestPingMs = pings.Count > 0 ? pings.Min() : 0;
        match.SnapshotLowestFps = fpsList.Count > 0 ? fpsList.Min() : 0;
    }

    private static string NormalizeTechMode(string? mode) {
        var m = (mode ?? "as_is").Trim().ToLowerInvariant();
        return m switch {
            "equalize_ping" or "equalize" or "ping" => "equalize_ping",
            "fixed_delay" or "fixed" or "symmetric" => "fixed_delay",
            _ => "as_is",
        };
    }

    private static string DescribeTech(PactMatch match) {
        var move = match.TechApplyToMovement ? "move ON" : "move OFF";
        return match.TechMode switch {
            "equalize_ping" =>
                $"Equalize ping (min {match.TechParamMinMs}–max {match.TechParamMaxMs}ms, FPS floor {match.TechFpsFloor}, {move})",
            "fixed_delay" =>
                $"Fixed delay {match.TechParamMaxMs}ms all (FPS floor {match.TechFpsFloor}, {move})",
            _ => $"As-is (no equalize, FPS floor {match.TechFpsFloor}, {move})",
        };
    }

    private static string FormatUtc(long ms) {
        return DateTimeOffset.FromUnixTimeMilliseconds(ms).UtcDateTime.ToString("yyyy-MM-dd HH:mm") + " UTC";
    }

    /// <summary>
    /// Short transparency blurb: worst reported ping / lowest FPS among fighters with data.
    /// Caps are advisory for now (matching systems come later).
    /// </summary>
    private static string BuildTechFairnessNote(PactMatch match) {
        var pings = match.Fighters.Where(f => f.PingMs is > 0).Select(f => f.PingMs!.Value).ToList();
        var fpsList = match.Fighters.Where(f => f.Fps is > 0).Select(f => f.Fps!.Value).ToList();
        if (pings.Count == 0 && fpsList.Count == 0) {
            return "";
        }
        var parts = new List<string>();
        if (pings.Count > 0) {
            parts.Add($"worst ping {pings.Max()}ms (range {pings.Min()}–{pings.Max()})");
        }
        if (fpsList.Count > 0) {
            parts.Add($"lowest FPS {fpsList.Min()}");
        }
        return "[Tech: " + string.Join(", ", parts) + "]";
    }
}
