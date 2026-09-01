using System.Buffers;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Runtime;
using System.Text.Json;
using System.Threading.Channels;
using Google.Protobuf;
using Microsoft.Extensions.Hosting;
using Mmorpg.Network;
using Server;
using Server.World;
using Server.World.Game;
using Server.World.Global;
using Server.Auth;
using Server.Helpers;
using Server.Persistence;
using Server.Utils;

/// <summary>Hard cap for a single assembled inbound WebSocket binary message (anti-OOM).</summary>
const int MaxIncomingWebSocketMessageBytes = 4096;

// ASP.NET Core host: accepts WebSocket clients, authenticates once per connection, forwards gameplay
// packets to the appropriate worker-owned world via WorldRegistry, and runs background cleanup and world-transfer loops.

try {
    GCSettings.LatencyMode = GCLatencyMode.SustainedLowLatency;
    Console.WriteLine($"[Server] GC configured: server={GCSettings.IsServerGC}, latency={GCSettings.LatencyMode}");
} catch (InvalidOperationException ex) {
    Console.Error.WriteLine($"[Server] Failed to enable sustained low-latency GC mode: {ex.Message}");
}

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
PlaytestMode.ThrowIfUnsafeConfiguration();
var appLifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
var settings = await Config.LoadSettings();
if (PlaytestMode.IsEnabled) {
    Console.WriteLine("[PLAYTEST] PostgreSQL persistence skipped — CharsPlaytest JSON is the character store.");
} else {
    await GamePersistence.InitializeAsync();
}
var antiBotToolsConfig = await Config.LoadAntiBotToolsConfig();
AntiBotTools.Initialize(antiBotToolsConfig);
TimedChallenge.Initialize();
PvpAcademy.Initialize();

// Launch security banners — ops must set these for a real soft test.
if (PlaytestMode.IsEnabled) {
    // Banner already printed from ThrowIfUnsafeConfiguration.
} else if (!WalletAuthValidator.IsRequired) {
    Console.WriteLine(
        "[SECURITY] WARNING: WALLET_AUTH_SECRET is not set — any client can spoof any wallet id. " +
        "Set WALLET_AUTH_SECRET (same as middleware) before public play.");
}
if (AdminSecurity.AllowOpenGmSandbox) {
    Console.WriteLine(
        "[SECURITY] WARNING: ALLOW_OPEN_GM_SANDBOX is on in Development — GM tools open without allowlist.");
} else {
    Console.WriteLine(
        "[SECURITY] GM sandbox locked: only GM_WALLET_ALLOWLIST wallets (or Development+ALLOW_OPEN_GM_SANDBOX). " +
        "All other sessions are forced traveler.");
}
AuctionBoardStore.Initialize(Path.Combine(Directory.GetCurrentDirectory(), PlaytestMode.CharsDirectoryName));
HellMiningStore.Initialize(Path.Combine(Directory.GetCurrentDirectory(), PlaytestMode.CharsDirectoryName));
ArenaIncentives.Initialize(Path.Combine(Directory.GetCurrentDirectory(), PlaytestMode.CharsDirectoryName));
Referral.Initialize(Path.Combine(Directory.GetCurrentDirectory(), PlaytestMode.CharsDirectoryName));
Console.WriteLine(
    $"[HellMining] TestingWeek={HellMiningStore.IsTestingWeekActive()} " +
    $"rules=login+1 / AFK+10 per 4h (max6) / 100mobs+10 (cap50 farm) / 10 classes=2x / EK+10 (cap10, no ladder) " +
    $"dailyCap={HellMiningStore.DailyTokenCap:N0} fullPoolToActive={HellMiningStore.FullDailyPoolToActivePlayers}.");
Server.Helpers.CashShop.EnsureLoaded();
var gcMonitor = settings.Debug.EnableGcLogs ? new GarbageCollectorMonitor() : null;
var worldRegistry = new WorldRegistry(settings, workerCount: settings.Threads.GameWorldWorkers, tickInterval: TimeSpan.FromMilliseconds(settings.GameWorld.TickInterval));
var sessionsByNetworkId = new ConcurrentDictionary<string, PlayerSession>(StringComparer.Ordinal);
var sessionsByServerId = new ConcurrentDictionary<Guid, PlayerSession>();

var gameWorldsAll = await Config.LoadGameWorldsConfig();
// Optional shard filter: WORLD_ID_ALLOWLIST=middleland,promiseland,abaddon (comma-separated).
// Empty = load all worlds (core). Hot event nodes set a short allowlist to save RAM/CPU.
var worldAllowlistRaw = (Environment.GetEnvironmentVariable("WORLD_ID_ALLOWLIST") ?? "").Trim();
var gameWorlds = gameWorldsAll;
if (worldAllowlistRaw.Length > 0) {
    var allow = worldAllowlistRaw
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);
    gameWorlds = gameWorldsAll.Where(gw => allow.Contains(gw.Id)).ToArray();
    Console.WriteLine(
        $"[Server] WORLD_ID_ALLOWLIST active: {gameWorlds.Length}/{gameWorldsAll.Length} worlds " +
        $"({string.Join(", ", gameWorlds.Select(g => g.Id))}).");
    if (gameWorlds.Length == 0) {
        throw new InvalidOperationException(
            "WORLD_ID_ALLOWLIST matched zero worlds — check env against GameWorlds.json ids.");
    }
}
var gameWorldsById = gameWorlds.ToDictionary(gameWorld => gameWorld.Id, StringComparer.Ordinal);
WorldLevelGates.Initialize(gameWorlds);
var worldsListMessage = NetworkManager.CreateWorldsList(gameWorlds);
var monstersConfig = await Config.LoadMonstersConfig();
var monstersListMessage = NetworkManager.CreateMonstersList(monstersConfig);
var spellsConfig = await Config.LoadSpellsConfig();
var (monsterCatalog, monstersById) = Config.BuildMonsterCatalog(monstersConfig);
var spellsById = Config.BuildSpellCatalog(spellsConfig);
Config.ValidateMonsterSpellReferences(monstersById, spellsById);
var itemsConfig = await Config.LoadItemsConfig();
var itemsById = Config.BuildItemCatalog(itemsConfig);
Server.Utils.ItemAttackCatalog.EnsureLoaded();
Server.Utils.NpcExpCatalog.EnsureLoaded();
var npcsConfig = await Config.LoadNpcsConfig();
var npcsById = Config.BuildNpcCatalog(npcsConfig);
var progressionConfig = await Config.LoadProgressionConfig();
Progression.Initialize(progressionConfig);
Console.WriteLine($"[Server] Progression loaded: maxLevel {progressionConfig.MaxLevel}, maxRebirth {progressionConfig.MaxRebirth}, {progressionConfig.Milestones.Length} milestones.");
MobSpecialty.Initialize(Path.Combine(Directory.GetCurrentDirectory(), "Config"));
var beginnerPathConfig = await Config.LoadBeginnerPathConfig();
BeginnerPath.Initialize(beginnerPathConfig);
Console.WriteLine($"[Server] BeginnerPath loaded: {beginnerPathConfig.Quests.Length} quests.");
TournamentConfig? tournamentConfig = null;
try {
    tournamentConfig = await Config.LoadTournamentConfig();
    Console.WriteLine($"[Server] Tournament loadout loaded: {tournamentConfig.Loadout.Equipped.Length} equipped slots, {tournamentConfig.Loadout.BagItems?.Length ?? 0} bag stacks.");
} catch (FileNotFoundException) {
    Console.WriteLine("[Server] Tournament.json not found; tournament arenas disabled.");
}
try {
    var arenaKitCatalog = await Config.LoadArenaKitCatalogConfig();
    ArenaLoadout.Configure(arenaKitCatalog);
} catch (FileNotFoundException) {
    Console.WriteLine("[Server] ArenaKitCatalog.json not found; kit-based arena loadout disabled (Tournament.json fallback only).");
} catch (Exception ex) {
    Console.WriteLine($"[Server] ArenaKitCatalog load failed: {ex.Message}");
}
var mapsDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Config", "maps");
var charsDirectory = Path.Combine(Directory.GetCurrentDirectory(), PlaytestMode.CharsDirectoryName);
PlaytestElonQaKit.EnsureSeeded(charsDirectory);
foreach (var gw in gameWorlds) {
    Config.ValidateGameWorldDwellAreas(gw, monstersById);
    Config.ValidateGameWorldNpcPlacements(gw, npcsById);
    Config.ValidateGameWorldNpcNotOnTeleportCells(gw);
    var teleportLocs = ResolveTeleportLocs(gw, gameWorldsById);
    var occupancyTracker = Map.LoadOccupancy(
        mapsDirectory,
        gw.Map,
        teleportLocs.SelectMany(teleportLoc => teleportLoc.Locs));
    Config.ValidateGameWorldNpcBounds(gw, occupancyTracker);
    var world = worldRegistry.RegisterGameWorld(
        gw.Id,
        gw.Map,
        gw.Music,
        occupancyTracker,
        monsterCatalog,
        monstersById,
        spellsById,
        itemsById,
        npcsById,
        gw.DwellAreas,
        teleportLocs,
        gw.Npcs,
        gw.WorkerThread,
        gw.TournamentArena == true ? tournamentConfig : null,
        ParseDefaultWeather(gw.DefaultWeather),
        gw.MiningNodes);
    if (gw.TrainingArena == true) {
        Console.WriteLine($"[Server] World '{gw.Id}' flagged trainingArena (skill practice; no tournament loadout/Elo).");
    }
    if (gw.Id == "traveler") {
        if (!occupancyTracker.IsFreeSpawnCell(Spawn.TravelerDefaultSpawnX, Spawn.TravelerDefaultSpawnY) &&
            !occupancyTracker.IsFreeDryCell(Spawn.TravelerDefaultSpawnX, Spawn.TravelerDefaultSpawnY)) {
            Console.WriteLine(
                $"[Server] WARNING: traveler hub ({Spawn.TravelerDefaultSpawnX},{Spawn.TravelerDefaultSpawnY}) is not a free dry spawn cell.");
        } else {
            Console.WriteLine(
                $"[Server] Traveler dry hub OK at ({Spawn.TravelerDefaultSpawnX},{Spawn.TravelerDefaultSpawnY}); wet/shore tiles blocked.");
        }
    }
    if (Spawn.TryGetTownDefaultSpawn(gw.Id, out var townX, out var townY)) {
        if (occupancyTracker.IsWetCell(townX, townY)) {
            Console.WriteLine(
                $"[Server] WARNING: town default spawn for '{gw.Id}' ({townX},{townY}) is WET — citizenship/TP landings will snap inland.");
        } else if (!occupancyTracker.IsFreeSpawnCell(townX, townY) && !occupancyTracker.IsFreeDryCell(townX, townY)) {
            Console.WriteLine(
                $"[Server] WARNING: town default spawn for '{gw.Id}' ({townX},{townY}) is not a free dry spawn cell.");
        } else {
            Console.WriteLine(
                $"[Server] Town dry spawn OK for '{gw.Id}' at ({townX},{townY}).");
        }
    }
    Console.WriteLine($"[Server] Loaded game world '{gw.Id}' ({gw.Name}): map {gw.Map}, size {occupancyTracker.SizeX}x{occupancyTracker.SizeY}, {occupancyTracker.OccupiedCount} blocked cells, worker thread {world.WorkerThreadId}");
}
var globalWorld = worldRegistry.RegisterGlobalWorld(new GlobalWorld("global", settings), settings.Threads.GlobalWorldWorkerThread);
Console.WriteLine($"[Server] Loaded global world 'global': worker thread {globalWorld.WorkerThreadId}");

ValueTask RouteClientPacketAsync(PlayerSession session, ClientMessage clientMessage, CancellationToken cancellationToken) {
    if (GlobalPacketRouting.ShouldRouteToGlobalWorld(clientMessage)) {
        return worldRegistry.RouteGlobalMessageAsync(
            new GlobalClientPacketMessage(session.SessionId, clientMessage),
            cancellationToken);
    }

    return worldRegistry.RouteGameWorldMessageAsync(
        GetCurrentGameWorldId(session),
        new ClientPacketMessage(session.SessionId, clientMessage),
        cancellationToken);
}

using var disconnectedPlayerCleanupCts = CancellationTokenSource.CreateLinkedTokenSource(appLifetime.ApplicationStopping);
using var worldTransferCts = CancellationTokenSource.CreateLinkedTokenSource(appLifetime.ApplicationStopping);
var worldTransferRequests = Channel.CreateUnbounded<WorldTransferRequest>(new UnboundedChannelOptions {
    SingleReader = true,
    SingleWriter = false,
});
var disconnectedPlayerCleanupTask = RunDisconnectedPlayerCleanupLoopAsync(
    worldRegistry,
    sessionsByNetworkId,
    sessionsByServerId,
    disconnectedPlayerCleanupCts.Token);
// Periodic autosave: Force-kill / crash restarts were dropping in-memory progress (traveler JSON
// only flushed on disconnect / graceful CTRL+C). 30s dual-write keeps rollback windows small.
var playerAutosaveTask = RunPlayerAutosaveLoopAsync(
    worldRegistry,
    sessionsByServerId,
    charsDirectory,
    disconnectedPlayerCleanupCts.Token);
var worldTransferTask = RunWorldTransferLoopAsync(
    worldRegistry,
    sessionsByServerId,
    worldTransferRequests.Reader,
    charsDirectory,
    worldTransferCts.Token);
app.Lifetime.ApplicationStopping.Register(() => {
    // Persist before disposing the registry: workers stop processing mailboxes on dispose, so WebSocket
    // teardown can no longer route SavePlayerStateRequestMessage and would skip saves on CTRL+C.
    try {
        // Run persistence on the thread pool so we await async work without sync-over-async on the host
        // stopping callback (avoids SynchronizationContext deadlocks).
        Task.Run(() => PersistAllPlayerStatesOnShutdownAsync(worldRegistry, sessionsByServerId, charsDirectory))
            .GetAwaiter()
            .GetResult();
    } catch (Exception ex) {
        Console.Error.WriteLine($"[Server] Error persisting player state during shutdown: {ex}");
    }
    disconnectedPlayerCleanupCts.Cancel();
    worldTransferCts.Cancel();
    worldRegistry.Dispose();
    gcMonitor?.Dispose();
});

app.UseWebSockets();

// Public realm snapshot for landing (local + nginx on play.chainlords.net) + CORS.
app.MapGet("/api/realm-stats", (HttpContext http) => {
    http.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    http.Response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
    http.Response.Headers.Append("Cache-Control", "no-store, max-age=0");
    var snap = RealmStats.Compute(SnapshotRealmSessions(sessionsByServerId));
    return Results.Json(new {
        // Landing (primary): rolling 4h activity
        playersOnLast4h = snap.PlayersOnLast4h,
        eksLast4h = snap.EksLast4h,
        // Compat / debug
        online = snap.OnlineNow,
        onlineNow = snap.OnlineNow,
        updatedAtUtc = snap.UpdatedAtUtc,
        source = "game-server",
        windowHours = 4,
    });
});

app.MapMethods("/api/realm-stats", new[] { "OPTIONS" }, (HttpContext http) => {
    http.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    http.Response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
    http.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Realm-Stats-Secret");
    return Results.NoContent();
});

// Public PVP cartelera (chainlords.net / play Watch multi-cam). CORS open for landing.
static void AppendDuelsCors(HttpContext http) {
    http.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    http.Response.Headers.Append("Access-Control-Allow-Methods", "GET, OPTIONS");
    http.Response.Headers.Append("Cache-Control", "no-store, max-age=0");
}

app.MapGet("/api/duels/upcoming", (HttpContext http) => {
    AppendDuelsCors(http);
    var rows = ArenaPact.ListPublicUpcoming();
    return Results.Json(new { duels = rows, source = "game-server", updatedAtUtc = DateTime.UtcNow });
});
app.MapGet("/api/duels/live", (HttpContext http) => {
    AppendDuelsCors(http);
    var rows = ArenaPact.ListPublicLive();
    return Results.Json(new { duels = rows, source = "game-server", updatedAtUtc = DateTime.UtcNow });
});

// Bleeding Island arena lobby: who is online so desk can show "ON — offer duels".
app.MapGet("/api/arena/bleeding-online", (HttpContext http) => {
    AppendDuelsCors(http);
    var worldId = ArenaBleeding.WorldId;
    var names = new List<string>();
    foreach (var session in sessionsByServerId.Values) {
        string name;
        string wid;
        bool connected;
        lock (session.SyncRoot) {
            connected = session.WebSocket is not null;
            wid = session.CurrentGameWorldId ?? string.Empty;
            name = (session.CharacterName ?? string.Empty).Trim();
        }
        if (!connected || name.Length == 0) {
            continue;
        }
        if (!string.Equals(wid, worldId, StringComparison.OrdinalIgnoreCase)) {
            continue;
        }
        names.Add(name);
    }
    names.Sort(StringComparer.OrdinalIgnoreCase);
    var players = names.Select(n => new { name = n }).ToList();
    return Results.Json(new {
        worldId,
        count = players.Count,
        players,
        source = "game-server",
        updatedAtUtc = DateTime.UtcNow,
    });
});
app.MapMethods("/api/arena/{**rest}", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.NoContent();
});
app.MapGet("/api/duels/{matchId}", (HttpContext http, string matchId) => {
    AppendDuelsCors(http);
    var row = ArenaPact.GetPublicById(matchId);
    if (row is null) {
        return Results.NotFound(new { error = "Duel not found or not public." });
    }
    return Results.Json(row);
});
// Full cartelera: PVP + World MMORPG + Tournament stages (empty shells always present).
app.MapGet("/api/streams", (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.Json(StreamDirectory.BuildCarteleraSnapshot());
});
app.MapGet("/api/streams/world", (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.Json(new {
        live = StreamDirectory.ListLive("world"),
        source = "game-server",
        updatedAtUtc = DateTime.UtcNow,
    });
});
app.MapMethods("/api/duels/{**rest}", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    http.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type");
    return Results.NoContent();
});
app.MapMethods("/api/duels/upcoming", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.NoContent();
});
app.MapMethods("/api/duels/live", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.NoContent();
});
app.MapMethods("/api/streams", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.NoContent();
});
app.MapMethods("/api/streams/{**rest}", new[] { "OPTIONS" }, (HttpContext http) => {
    AppendDuelsCors(http);
    return Results.NoContent();
});

ArenaPactDiscord.EnsureLoaded();

// Push live counts to public landing-api so chainlords.net is not stuck at 0.
_ = Task.Run(() => RealmStats.RunPushLoopAsync(
    () => SnapshotRealmSessions(sessionsByServerId),
    disconnectedPlayerCleanupCts.Token));

// Priority-queue telemetry (combat vs meta outbound) — JSON under Chars/reports/net-priority-*.json
_ = Task.Run(async () => {
    var reportsDir = Path.Combine(charsDirectory, "reports");
    using var timer = new PeriodicTimer(TimeSpan.FromMinutes(5));
    try {
        while (await timer.WaitForNextTickAsync(disconnectedPlayerCleanupCts.Token)) {
            NetworkPriorityMetrics.MaybeWriteReport(reportsDir, minIntervalSec: 300);
        }
    } catch (OperationCanceledException) {
        // shutdown
    }
}, disconnectedPlayerCleanupCts.Token);
Console.WriteLine(
    $"[Server] Message priority queue: {(settings.EnableMessagePriorityQueue ? "ON (combat>meta outbound)" : "OFF (legacy FIFO)")} " +
    $"— toggle Settings.json enableMessagePriorityQueue");

// Per-connection state machine: authenticate → route binary ClientMessage to GameWorld; teardown notifies world and drains send queue.
app.Map("/ws", async context => {
    if (!context.WebSockets.IsWebSocketRequest) {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsync("Expected a WebSocket request.");
        return;
    }

    using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
    var remoteIp = context.Connection.RemoteIpAddress?.ToString();
    Console.WriteLine($"[Server] WebSocket opened from {remoteIp}:{context.Connection.RemotePort}");
    // Auction IP blocks apply to board actions (TryEnsureCanTrade), not the whole socket —
    // players must still log in to settle fee debt.

    var currentGameWorldId = settings.InitialMap;
    PlayerSession? authenticatedSession = null;
    var disconnectRequested = new TaskCompletionSource<string?>(TaskCreationOptions.RunContinuationsAsynchronously);
    using var receiveCts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted, appLifetime.ApplicationStopping);
    using var authenticationTimeoutCts = CancellationTokenSource.CreateLinkedTokenSource(receiveCts.Token);
    authenticationTimeoutCts.CancelAfter(settings.Ping.Timeout);
    using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted, appLifetime.ApplicationStopping);
    using var sendLock = new SemaphoreSlim(1, 1);
    var receiveBuffer = ArrayPool<byte>.Shared.Rent(MaxIncomingWebSocketMessageBytes);
    var messageScratch = ArrayPool<byte>.Shared.Rent(MaxIncomingWebSocketMessageBytes);
    // Dual outbound queues (still one WebSocket): High = combat/move/vitals, Normal = meta.
    // When enableMessagePriorityQueue is false, only the high channel is used (legacy FIFO).
    var channelOpts = new UnboundedChannelOptions {
        SingleReader = true,
        SingleWriter = false,
    };
    var outgoingHigh = Channel.CreateUnbounded<ServerMessage>(channelOpts);
    var outgoingNormal = Channel.CreateUnbounded<ServerMessage>(channelOpts);
    var usePriorityQueue = settings.EnableMessagePriorityQueue;
    var disconnectCloseTask = SendServerDisconnectAsync(webSocket, sendLock, disconnectRequested.Task);
    var sendLoopTask = SendOutgoingMessagesAsync(
        webSocket,
        outgoingHigh.Reader,
        outgoingNormal.Reader,
        usePriorityQueue,
        sendLock,
        settings.EnableZeroCopyProtobufTransfer,
        settings.MaxConsecutiveOutboundSendFailures,
        receiveCts,
        sendCts.Token);
    var isConnectedToGameWorld = false;

    void EnqueueOutgoingMessage(ServerMessage responseMessage) {
        if (!usePriorityQueue) {
            NetworkPriorityMetrics.RecordOutboundEnqueued(NetworkPriority.Class.High, otherQueueHadPending: false);
            outgoingHigh.Writer.TryWrite(responseMessage);
            return;
        }

        var cls = NetworkPriority.ClassifyOutbound(responseMessage);
        if (cls == NetworkPriority.Class.High) {
            var normalPending = outgoingNormal.Reader.CanCount && outgoingNormal.Reader.Count > 0;
            NetworkPriorityMetrics.RecordOutboundEnqueued(NetworkPriority.Class.High, normalPending);
            outgoingHigh.Writer.TryWrite(responseMessage);
        } else {
            NetworkPriorityMetrics.RecordOutboundEnqueued(NetworkPriority.Class.Normal, otherQueueHadPending: false);
            outgoingNormal.Writer.TryWrite(responseMessage);
        }
    }

    void RequestDisconnect(string? message) {
        if (!string.IsNullOrWhiteSpace(message)) {
            Console.WriteLine($"[Server] Disconnect requested: {message}");
        } else {
            Console.WriteLine("[Server] Disconnect requested (no message).");
        }
        disconnectRequested.TrySetResult(message);
    }

    void RequestWorldChange(WorldTransferDestination destination) {
        if (authenticatedSession is null || string.IsNullOrWhiteSpace(destination.WorldId)) {
            return;
        }

        worldTransferRequests.Writer.TryWrite(
            new WorldTransferRequest(
                authenticatedSession.SessionId,
                destination.WorldId,
                destination.SpawnX,
                destination.SpawnY));
    }

    EnqueueOutgoingMessage(worldsListMessage);
    EnqueueOutgoingMessage(monstersListMessage);

    try {
        while (webSocket.State == WebSocketState.Open) {
            var receiveToken = isConnectedToGameWorld ? receiveCts.Token : authenticationTimeoutCts.Token;
            var (messageType, payload) = await ReceiveMessageAsync(webSocket, receiveBuffer, messageScratch, receiveToken);
            if (messageType == WebSocketMessageType.Close) {
                await SendCloseFrameAsync(
                    WebSocketCloseStatus.NormalClosure,
                    "Closing connection",
                    webSocket,
                    sendLock,
                    receiveCts.Token);
                return;
            }

            if (messageType != WebSocketMessageType.Binary) {
                if (!isConnectedToGameWorld) {
                    RequestDisconnect("Send binary authentication message before sending other traffic.");
                    return;
                }

                continue;
            }

            ClientMessage clientMessage;
            try {
                clientMessage = ClientMessage.Parser.ParseFrom(payload.Span);
            } catch (InvalidProtocolBufferException) {
                RequestDisconnect("Failed to parse client message.");
                return;
            }

            if (!isConnectedToGameWorld) {
                if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.CharacterListRequest) {
                    var listReq = clientMessage.CharacterListRequest;
                    if (!WalletAuthValidator.TryValidate(listReq.Id.Trim(), listReq.AuthToken, out var listAuthError)) {
                        RequestDisconnect(listAuthError);
                        return;
                    }

                    var wallet = listReq.Id.Trim();
                    if (GamePersistence.Current is not null && !PlaytestMode.IsIsolatedAccount(wallet)) {
                        await GamePersistence.Current.UpsertAccountLoginAsync(wallet, receiveCts.Token);
                    }

                    var listTravelerMode = PlaytestMode.IsEnabled
                        || IsTravelerPlayerMode(listReq.HasPlayerMode ? listReq.PlayerMode : null);
                    var entries = await GamePersistence.ListCharactersDualAsync(
                        GamePersistence.Current,
                        charsDirectory,
                        wallet,
                        listTravelerMode);
                    var listResponse = new CharacterListResponse();
                    string? bestName = null;
                    var bestScore = -1;
                    foreach (var entry in entries) {
                        var summary = new CharacterSlotSummary {
                            SlotIndex = entry.SlotIndex,
                            Name = entry.Name,
                            Level = entry.Level,
                            Exp = entry.Exp,
                            Rebirth = entry.Rebirth,
                            HoursPlayed = entry.HoursPlayed,
                            Str = entry.Str,
                            Vit = entry.Vit,
                            Dex = entry.Dex,
                            Intel = entry.Int,
                            Mag = entry.Mag,
                            Chr = entry.Chr,
                            Gender = (PlayerGender)entry.GenderValue,
                            SkinColor = (PlayerSkinColor)entry.SkinColorValue,
                            HairStyleIndex = entry.HairStyleIndex,
                            UnderwearColorIndex = entry.UnderwearColorIndex,
                            CitizenshipSide = string.IsNullOrWhiteSpace(entry.CitizenshipSide)
                                ? "traveler"
                                : entry.CitizenshipSide.Trim().ToLowerInvariant(),
                        };
                        // Olympia DrawObject_OnMove_ForMenu: walk/rotate with equipped gear.
                        if (entry.Equipped is { Count: > 0 }) {
                            foreach (var eq in entry.Equipped) {
                                if (string.IsNullOrWhiteSpace(eq.Slot) || eq.ItemId <= 0) {
                                    continue;
                                }
                                summary.Equipped.Add(new CharacterEquipPreview {
                                    Slot = eq.Slot,
                                    ItemId = eq.ItemId,
                                });
                            }
                        }
                        listResponse.Characters.Add(summary);
                        // Prefer highest rebirth then level for the public referral slug.
                        var score = entry.Rebirth * 10_000 + entry.Level;
                        if (score > bestScore && !string.IsNullOrWhiteSpace(entry.Name)) {
                            bestScore = score;
                            bestName = entry.Name;
                        }
                    }

                    var refCode = ReferralStore.GetOrCreateCode(wallet, bestName);
                    listResponse.ReferralCode = refCode;
                    listResponse.ReferralAlreadyAttributed = ReferralStore.TryGetAttribution(wallet, out _);
                    if (!string.IsNullOrEmpty(refCode)) {
                        listResponse.ReferralShareUrl = $"https://play.chainlords.net/?ref={refCode}";
                    }

                    // Seed hub duel inbox for world character names on this wallet.
                    foreach (var invite in ArenaPact.CollectInvitesForNames(
                                 listResponse.Characters.Select(c => c.Name))) {
                        listResponse.ArenaPactInvites.Add(invite);
                    }

                    EnqueueOutgoingMessage(new ServerMessage { CharacterListResponse = listResponse });
                    // Stay pre-world so the client can AuthenticateRequest with the chosen slot.
                    continue;
                }

                // Hub inbox: wallet-auth list of PVP invites for kit/character names (pre-world).
                // Optional: filter_names[0] = "__decline__:<matchId>:<inviteeName>" to decline from hub.
                if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.ArenaPactListRequest) {
                    var inboxReq = clientMessage.ArenaPactListRequest;
                    if (!inboxReq.HasId || !inboxReq.HasAuthToken) {
                        RequestDisconnect("Arena pact inbox requires wallet auth on hub.");
                        return;
                    }
                    if (!WalletAuthValidator.TryValidate(inboxReq.Id.Trim(), inboxReq.AuthToken, out var inboxAuthError)) {
                        RequestDisconnect(inboxAuthError);
                        return;
                    }
                    var filterNames = inboxReq.FilterNames?.Where(n => !string.IsNullOrWhiteSpace(n)).Select(n => n.Trim()).ToList()
                                     ?? new List<string>();
                    // Decline action piggybacks on authenticated inbox channel.
                    foreach (var raw in filterNames.ToList()) {
                        if (!raw.StartsWith("__decline__:", StringComparison.OrdinalIgnoreCase)) {
                            continue;
                        }
                        var parts = raw.Split(':', 3, StringSplitOptions.None);
                        if (parts.Length == 3 &&
                            ArenaPact.TryHubDecline(parts[1], parts[2], out _)) {
                            filterNames.Remove(raw);
                        }
                    }
                    EnqueueOutgoingMessage(new ServerMessage {
                        ArenaPactListResponse = ArenaPact.BuildInboxResponse(
                            filterNames.Where(n => !n.StartsWith("__", StringComparison.Ordinal))),
                    });
                    continue;
                }

                if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.CharacterNameCheckRequest) {
                    var nameReq = clientMessage.CharacterNameCheckRequest;
                    if (!WalletAuthValidator.TryValidate(nameReq.Id.Trim(), nameReq.AuthToken, out var nameAuthError)) {
                        RequestDisconnect(nameAuthError);
                        return;
                    }

                    var nameWallet = nameReq.Id.Trim();
                    var (nameAvailable, nameMessage) = await GamePersistence.CheckCharacterNameAvailabilityAsync(
                        GamePersistence.Current,
                        charsDirectory,
                        nameWallet,
                        nameReq.CharacterName,
                        OnlinePlayerDirectory.IsDisplayNameTakenByOtherWallet);
                    EnqueueOutgoingMessage(new ServerMessage {
                        CharacterNameCheckResponse = new CharacterNameCheckResponse {
                            Available = nameAvailable,
                            Message = nameMessage,
                            CharacterName = nameReq.CharacterName?.Trim() ?? string.Empty,
                        },
                    });
                    // Stay pre-world so Create Character can keep checking while typing.
                    continue;
                }

                if (clientMessage.PayloadCase != ClientMessage.PayloadOneofCase.AuthenticateRequest) {
                    RequestDisconnect("Authenticate, request character list, or check a name before sending other messages.");
                    return;
                }

                var initialGameWorldId = settings.SpawnToRandomMap && gameWorlds.Length > 0
                    ? gameWorlds[Random.Shared.Next(gameWorlds.Length)].Id
                    : settings.InitialMap;
                var authReq = clientMessage.AuthenticateRequest;
                if (PlaytestMode.IsEnabled) {
                    if (!PlaytestMode.IsIsolatedAccount(authReq.Id)) {
                        RequestDisconnect("Playtest door only accepts the isolated ElonQa account.");
                        return;
                    }
                    authReq.CharacterName = PlaytestMode.CharacterName;
                    authReq.PlayerMode = "traveler";
                    if (gameWorldsById.ContainsKey("traveler")) {
                        initialGameWorldId = "traveler";
                    }
                }
                var clientTravelerMode = IsTravelerPlayerMode(authReq.HasPlayerMode ? authReq.PlayerMode : null);
                // Security: never trust client "gm" mode alone — force traveler unless wallet is GM-allowlisted
                // (or Development + ALLOW_OPEN_GM_SANDBOX). Prevents free CreateItem / teleport / kill-all.
                var travelerMode = AdminSecurity.ShouldForceTravelerMode(authReq.Id, clientTravelerMode);
                if (!clientTravelerMode && travelerMode) {
                    var idPreview = string.IsNullOrEmpty(authReq.Id) ? "?" : authReq.Id[..Math.Min(8, authReq.Id.Length)];
                    Console.WriteLine($"[Server] Forced traveler mode for non-allowlisted wallet (client claimed GM). id={idPreview}…");
                }
                // Multi-box / capacity stubs run before session create (reconnects skip the industrial cap).
                var pendingOnline = sessionsByNetworkId.Count;
                // Detect whether this auth will reconnect an existing session after TryAuthenticatePlayer.
                // Pre-check capacity for brand-new network ids only when industrial limits are on.
                var willLikelyReconnect = sessionsByNetworkId.ContainsKey(authReq.Id);
                if (!willLikelyReconnect &&
                    !AntiBotTools.TryAllowNewSession(authReq.Id, travelerMode, pendingOnline, out var antiBotReject)) {
                    RequestDisconnect(antiBotReject ?? "Session rejected by anti-bot tools.");
                    return;
                }

                if (authReq.HasPreferredInitialWorldId && !PlaytestMode.IsEnabled) {
                    var preferredWorldId = authReq.PreferredInitialWorldId.Trim();
                    if (preferredWorldId.Length > 0 && gameWorldsById.TryGetValue(preferredWorldId, out var preferredGw)) {
                        // Arena / tournament preferred world always wins (even for traveler clients with kit).
                        initialGameWorldId = preferredWorldId;
                        if (preferredGw.TournamentArena == true) {
                            Console.WriteLine($"[Server] Arena entry → world '{preferredWorldId}' (kit={(authReq.HasArenaKitJson ? "yes" : "no")}).");
                        }
                    } else if (preferredWorldId.Length > 0) {
                        Console.WriteLine(
                            $"[Server] Ignoring unknown preferred_initial_world_id '{preferredWorldId}'; using '{initialGameWorldId}'.");
                        if (travelerMode && gameWorldsById.ContainsKey("traveler")) {
                            initialGameWorldId = "traveler";
                        }
                    }
                } else if (travelerMode && gameWorldsById.ContainsKey("traveler")) {
                    // Traveler client always starts in the traveler zone (never GM sandbox world).
                    initialGameWorldId = "traveler";
                }
                var authSlotIndex = clientMessage.AuthenticateRequest.HasSlotIndex
                    ? Math.Clamp(clientMessage.AuthenticateRequest.SlotIndex, 0, 3)
                    : 0;
                int? authGender = authReq.HasGender ? (int)authReq.Gender : null;
                int? authSkin = authReq.HasSkinColor ? (int)authReq.SkinColor : null;
                int? authHair = authReq.HasHairStyleIndex ? Math.Clamp(authReq.HairStyleIndex, 0, 7) : null;
                int? authUnderwear = authReq.HasUnderwearColorIndex
                    ? Math.Clamp(authReq.UnderwearColorIndex, 0, 7)
                    : null;
                int? authStr = authReq.HasStr ? authReq.Str : null;
                int? authVit = authReq.HasVit ? authReq.Vit : null;
                int? authDex = authReq.HasDex ? authReq.Dex : null;
                int? authInt = authReq.HasIntel ? authReq.Intel : null;
                int? authMag = authReq.HasMag ? authReq.Mag : null;
                int? authChr = authReq.HasChr ? authReq.Chr : null;
                if (!TryAuthenticatePlayer(
                    authReq.Id,
                    authReq.CharacterName,
                    authReq.AuthToken,
                    webSocket,
                    initialGameWorldId,
                    sessionsByNetworkId,
                    sessionsByServerId,
                    worldRegistry,
                    out authenticatedSession,
                    out var isReconnect,
                    out var authenticationError)) {
                    RequestDisconnect(authenticationError);
                    return;
                }

                var session = authenticatedSession ?? throw new InvalidOperationException("Authenticated session was not created.");
                lock (session.SyncRoot) {
                    session.TravelerMode = travelerMode;
                }
                if (GamePersistence.Current is not null && !PlaytestMode.IsIsolatedAccount(session.NetworkId)) {
                    await GamePersistence.Current.UpsertAccountLoginAsync(session.NetworkId, receiveCts.Token);
                }

                PlayerPersistenceState? loadedPlayerState = null;
                if (!isReconnect) {
                    loadedPlayerState = await GamePersistence.LoadCharacterDualAsync(
                        GamePersistence.Current,
                        charsDirectory,
                        session.NetworkId,
                        session.CharacterName,
                        travelerMode);
                    if (PlaytestMode.IsEnabled && loadedPlayerState is null) {
                        loadedPlayerState = PlaytestElonQaKit.LoadPreferredState(charsDirectory);
                    }
                    // Brand-new create: only via Create Character desk (name + looks + stats).
                    if (loadedPlayerState is null) {
                        if (!authReq.HasGender || !authReq.HasStr) {
                            RequestDisconnect(
                                "Create your character first: choose a name, appearance, and stats.");
                            return;
                        }
                        var (nameAvailable, nameMessage) = await GamePersistence.CheckCharacterNameAvailabilityAsync(
                            GamePersistence.Current,
                            charsDirectory,
                            session.NetworkId,
                            session.CharacterName,
                            OnlinePlayerDirectory.IsDisplayNameTakenByOtherWallet);
                        if (!nameAvailable) {
                            RequestDisconnect(string.IsNullOrWhiteSpace(nameMessage)
                                ? "That name is already taken."
                                : nameMessage);
                            return;
                        }
                    } else if (!GamePersistence.IsValidCharacterNameFormat(session.CharacterName, out var invalidNameMsg)) {
                        // Incomplete auto-stubs (e.g. HB_wallet…) cannot be entered — Create Character again.
                        RequestDisconnect(string.IsNullOrWhiteSpace(invalidNameMsg)
                            ? "This character is incomplete. Create a character with a proper name first."
                            : "This character is incomplete. Create a character with a proper name first.");
                        return;
                    }
                    // Arena kit entry: always honor preferred tournament/pact map (never restore city WH).
                    var forceArenaWorld = authReq.HasArenaKitJson &&
                                         !string.IsNullOrWhiteSpace(authReq.ArenaKitJson) &&
                                         gameWorldsById.TryGetValue(initialGameWorldId, out var preferredArenaGw) &&
                                         preferredArenaGw.TournamentArena == true;

                    if (forceArenaWorld) {
                        lock (session.SyncRoot) {
                            session.CurrentGameWorldId = initialGameWorldId;
                        }
                        Console.WriteLine(
                            $"[Server] Arena kit forces world '{initialGameWorldId}' (skip city WH restore).");
                    } else if (loadedPlayerState is not null) {
                        if (travelerMode) {
                            // Citizens (aresden/elvine) restore last city world; pure travelers always use traveler hub.
                            // (Old code always forced traveler and wiped city logins after picking a city.)
                            var (resolvedGameWorldId, resolvedPlayerState) = ResolveTravelerModeLoginJoin(
                                loadedPlayerState,
                                worldRegistry,
                                gameWorldsById,
                                initialGameWorldId);
                            loadedPlayerState = resolvedPlayerState;
                            lock (session.SyncRoot) {
                                session.CurrentGameWorldId = resolvedGameWorldId;
                            }
                        } else {
                            var (resolvedGameWorldId, resolvedPlayerState) = ResolveLoadedPlayerJoin(
                                loadedPlayerState,
                                worldRegistry,
                                gameWorldsById,
                                initialGameWorldId);
                            loadedPlayerState = resolvedPlayerState;
                            lock (session.SyncRoot) {
                                session.CurrentGameWorldId = resolvedGameWorldId;
                            }
                        }
                    } else {
                        // New character: preferred world if set, else traveler hub.
                        var spawnWorld = gameWorldsById.ContainsKey(initialGameWorldId)
                            ? initialGameWorldId
                            : (gameWorldsById.ContainsKey("traveler") ? "traveler" : initialGameWorldId);
                        lock (session.SyncRoot) {
                            session.CurrentGameWorldId = spawnWorld;
                        }
                    }
                }

                currentGameWorldId = session.CurrentGameWorldId;
                lock (session.SyncRoot) {
                    session.SendMessage = EnqueueOutgoingMessage;
                    session.RequestDisconnect = RequestDisconnect;
                    session.RequestWorldChange = RequestWorldChange;
                }
                var authArenaKitJson = authReq.HasArenaKitJson && !string.IsNullOrWhiteSpace(authReq.ArenaKitJson)
                    ? authReq.ArenaKitJson
                    : null;
                GameWorldMessage gameWorldMessage = isReconnect
                    ? new PlayerReconnectedMessage(session.SessionId, EnqueueOutgoingMessage, RequestDisconnect, RequestWorldChange, session.CharacterName, session.NetworkId, remoteIp)
                    : new PlayerConnectedMessage(
                        session.SessionId,
                        EnqueueOutgoingMessage,
                        RequestDisconnect,
                        RequestWorldChange,
                        loadedPlayerState,
                        session.CharacterName,
                        session.NetworkId,
                        CreateInterruptLogoutDueToCombat(session),
                        authSlotIndex,
                        authGender,
                        authSkin,
                        authHair,
                        authUnderwear,
                        travelerMode,
                        authStr,
                        authVit,
                        authDex,
                        authInt,
                        authMag,
                        authChr,
                        remoteIp,
                        authReq.HasReferralCode ? authReq.ReferralCode : null,
                        authArenaKitJson);
                GlobalWorldMessage globalWorldMessage = isReconnect
                    ? new GlobalPlayerReconnectedMessage(session.SessionId, EnqueueOutgoingMessage, session.CharacterName)
                    : new GlobalPlayerConnectedMessage(session.SessionId, EnqueueOutgoingMessage, session.CharacterName);
                await worldRegistry.RouteGameWorldMessageAsync(currentGameWorldId, gameWorldMessage, receiveCts.Token);
                await worldRegistry.RouteGlobalMessageAsync(globalWorldMessage, receiveCts.Token);
                isConnectedToGameWorld = true;
                continue;
            }

            if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.AuthenticateRequest) {
                RequestDisconnect("Authenticate may only be sent once per connection.");
                return;
            }

            if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.LogoutRequest) {
                var waitSeconds = settings.LogoutTime;
                var logoutAllowedAt = waitSeconds > 0
                    ? DateTimeOffset.UtcNow.AddSeconds(waitSeconds).AddMilliseconds(-500)
                    : DateTimeOffset.UtcNow;
                lock (authenticatedSession!.SyncRoot) {
                    authenticatedSession.LogoutAllowedAtUtc = logoutAllowedAt;
                }
                EnqueueOutgoingMessage(new ServerMessage { LogoutResponse = new LogoutResponse { Wait = waitSeconds } });
                continue;
            }

            if (clientMessage.PayloadCase == ClientMessage.PayloadOneofCase.LogoutCancelledRequest) {
                lock (authenticatedSession!.SyncRoot) {
                    authenticatedSession.LogoutAllowedAtUtc = null;
                }
                continue;
            }

            currentGameWorldId = GetCurrentGameWorldId(authenticatedSession!);
            await RouteClientPacketAsync(authenticatedSession!, clientMessage, receiveCts.Token);
        }
    } catch (OperationCanceledException) when (!isConnectedToGameWorld &&
        authenticationTimeoutCts.IsCancellationRequested &&
        !receiveCts.IsCancellationRequested) {
        RequestDisconnect("Authentication request not received in time.");
    } catch (OperationCanceledException) {
        // Do not close here; let finally drain the send queue first
    } catch (WebSocketException ex) when (ex.WebSocketErrorCode is WebSocketError.ConnectionClosedPrematurely
        or WebSocketError.InvalidState
        or WebSocketError.Faulted) {
        // Client closed abruptly; treat as normal disconnect, handled in finally
    } catch (IOException) {
        // Client reset / half-closed TCP during read — normal browser tab close; do not fail the host.
    } catch (WebSocketException ex) {
        Console.Error.WriteLine($"[Server] WebSocket error ({ex.WebSocketErrorCode}): {ex.Message}");
    } catch (IncomingWebSocketMessageTooLargeException) {
        Console.Error.WriteLine($"[Server] WebSocket closed: incoming message exceeded {MaxIncomingWebSocketMessageBytes} bytes.");
    } catch (Exception ex) {
        Console.Error.WriteLine($"[Server] Unexpected error: {ex}");
    } finally {
        if (authenticatedSession is not null) {
            var shouldNotifyWorld = false;
            var sessionRemainsActive = false;
            lock (authenticatedSession.SyncRoot) {
                if (ReferenceEquals(authenticatedSession.WebSocket, webSocket)) {
                    authenticatedSession.WebSocket = null;
                    authenticatedSession.SendMessage = null;
                    authenticatedSession.RequestDisconnect = null;
                    authenticatedSession.RequestWorldChange = null;
                    var now = DateTimeOffset.UtcNow;
                    var allowedAt = authenticatedSession.LogoutAllowedAtUtc;
                    if (allowedAt.HasValue && now >= allowedAt.Value) {
                        authenticatedSession.DisconnectDeadlineUtc = now;
                    } else {
                        authenticatedSession.DisconnectDeadlineUtc = now.AddSeconds(settings.Timings.DisconnectTime);
                    }
                    sessionRemainsActive = authenticatedSession.DisconnectDeadlineUtc > now;
                    authenticatedSession.LogoutAllowedAtUtc = null;
                    authenticatedSession.CleanupStarted = false;
                    currentGameWorldId = authenticatedSession.CurrentGameWorldId;
                    shouldNotifyWorld = true;
                }
            }

            if (shouldNotifyWorld) {
                try {
                    await worldRegistry.RouteGameWorldMessageAsync(
                        currentGameWorldId,
                        new PlayerDisconnectedMessage(authenticatedSession.SessionId, sessionRemainsActive),
                        CancellationToken.None);
                    await worldRegistry.RouteGlobalMessageAsync(
                        new GlobalPlayerDisconnectedMessage(authenticatedSession.SessionId, sessionRemainsActive),
                        CancellationToken.None);
                    var persistedState = await CapturePlayerPersistenceStateAsync(
                        worldRegistry,
                        currentGameWorldId,
                        authenticatedSession.SessionId,
                        CancellationToken.None);
                    if (persistedState is not null) {
                        await SavePlayerPersistenceStateAsync(charsDirectory, authenticatedSession, persistedState);
                    }
                } catch (Exception exception) when (exception is ObjectDisposedException or KeyNotFoundException) {
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[Server] Failed to persist player '{authenticatedSession.NetworkId}' on disconnect: {ex}");
                }
            }
        }

        disconnectRequested.TrySetResult(null);
        outgoingHigh.Writer.TryComplete();
        outgoingNormal.Writer.TryComplete();
        try {
            await sendLoopTask;
        } catch (OperationCanceledException) {
        } catch (Exception ex) {
            // Send loop should be self-contained; never let teardown fault kill the process.
            Console.Error.WriteLine($"[Server] Send loop ended with error: {ex.Message}");
        }
        try {
            await disconnectCloseTask;
        } catch (OperationCanceledException) {
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] Disconnect-close task error: {ex.Message}");
        }

        try {
            if (webSocket.State == WebSocketState.Open) {
                await SendCloseFrameAsync(WebSocketCloseStatus.NormalClosure, "Closing connection", webSocket, sendLock, CancellationToken.None);
            }
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] Error closing websocket on disconnect: {ex.Message}");
        }

        Console.WriteLine($"[Server] WebSocket disconnected from {context.Connection.RemoteIpAddress}:{context.Connection.RemotePort}");
        ArrayPool<byte>.Shared.Return(messageScratch);
        ArrayPool<byte>.Shared.Return(receiveBuffer);
    }
});

await app.RunAsync($"http://0.0.0.0:{settings.Port}");
disconnectedPlayerCleanupCts.Cancel();
worldTransferCts.Cancel();
try {
    await disconnectedPlayerCleanupTask;
} catch (OperationCanceledException) {
}
try {
    await worldTransferTask;
} catch (OperationCanceledException) {
}
gcMonitor?.Dispose();

/// <summary>
/// Creates a new session or reattaches an existing one within the reconnect grace window.
/// Live duplicate sockets are rejected. Expired reconnect slots are purged so the player can
/// log in fresh (previous bug: marking <c>CleanupStarted</c> without removing the session
/// permanently blocked login with "Reconnect window has expired.").
/// </summary>
static bool TryAuthenticatePlayer(
    string networkId,
    string characterName,
    string authToken,
    WebSocket webSocket,
    string initialGameWorldId,
    ConcurrentDictionary<string, PlayerSession> sessionsByNetworkId,
    ConcurrentDictionary<Guid, PlayerSession> sessionsByServerId,
    WorldRegistry worldRegistry,
    out PlayerSession? session,
    out bool isReconnect,
    out string? errorMessage) {
    session = null;
    isReconnect = false;
    errorMessage = null;

    if (string.IsNullOrWhiteSpace(networkId)) {
        errorMessage = "Authentication id is required.";
        return false;
    }

    if (!WalletAuthValidator.TryValidate(networkId.Trim(), authToken, out errorMessage)) {
        return false;
    }

    var trimmedCharacterName = characterName.Trim();
    if (string.IsNullOrEmpty(trimmedCharacterName)) {
        errorMessage = "Character name is required.";
        return false;
    }

    while (true) {
        if (sessionsByNetworkId.TryGetValue(networkId, out var existingSession)) {
            Guid? staleSessionId = null;
            string? staleWorldId = null;
            lock (existingSession.SyncRoot) {
                if (existingSession.WebSocket is not null) {
                    errorMessage = "This player is already connected.";
                    return false;
                }
                if (!existingSession.DisconnectDeadlineUtc.HasValue) {
                    // Socket cleared but not yet in grace — treat as busy.
                    errorMessage = "This player is already connected.";
                    return false;
                }

                var expired = existingSession.CleanupStarted
                    || existingSession.DisconnectDeadlineUtc.Value <= DateTimeOffset.UtcNow;
                if (expired) {
                    // Purge stale slot and allow a brand-new login (not a hard lockout).
                    existingSession.CleanupStarted = true;
                    staleSessionId = existingSession.SessionId;
                    staleWorldId = existingSession.CurrentGameWorldId;
                } else {
                    existingSession.WebSocket = webSocket;
                    existingSession.DisconnectDeadlineUtc = null;
                    existingSession.CleanupStarted = false;
                    existingSession.CharacterName = trimmedCharacterName;
                    session = existingSession;
                    isReconnect = true;
                    return true;
                }
            }

            if (staleSessionId is Guid purgeId) {
                sessionsByServerId.TryRemove(purgeId, out _);
                sessionsByNetworkId.TryRemove(networkId, out _);
                var worldId = staleWorldId ?? string.Empty;
                // Best-effort: drop in-world ghost from the expired reconnect session.
                _ = Task.Run(async () => {
                    try {
                        if (!string.IsNullOrEmpty(worldId)) {
                            await worldRegistry.RouteGameWorldMessageAsync(
                                worldId,
                                new RemoveDisconnectedPlayerMessage(purgeId),
                                CancellationToken.None).ConfigureAwait(false);
                        }
                        await worldRegistry.RouteGlobalMessageAsync(
                            new GlobalRemoveDisconnectedPlayerMessage(purgeId),
                            CancellationToken.None).ConfigureAwait(false);
                    } catch (Exception ex) {
                        Console.Error.WriteLine(
                            $"[Server] Stale-session world purge failed for '{networkId}': {ex.Message}");
                    }
                });
                Console.WriteLine(
                    $"[Server] Purged expired reconnect session for wallet …{Tail(networkId, 8)} — allowing fresh login.");
                continue;
            }
        }

        var newSession = new PlayerSession(networkId, Guid.NewGuid(), initialGameWorldId, webSocket, trimmedCharacterName);
        if (!sessionsByNetworkId.TryAdd(networkId, newSession)) {
            continue;
        }
        if (!sessionsByServerId.TryAdd(newSession.SessionId, newSession)) {
            sessionsByNetworkId.TryRemove(networkId, out _);
            continue;
        }

        session = newSession;
        return true;
    }
}

static string Tail(string value, int n) {
    if (string.IsNullOrEmpty(value) || value.Length <= n) {
        return value ?? string.Empty;
    }
    return value[^n..];
}

/// <summary>Maps GameWorlds.json <c>defaultWeather</c> strings to proto <see cref="WeatherMode"/> (dry when unset/unknown).</summary>
static WeatherMode ParseDefaultWeather(string? raw) {
    if (string.IsNullOrWhiteSpace(raw)) {
        return WeatherMode.Dry;
    }

    return raw.Trim().ToLowerInvariant() switch {
        "dry" => WeatherMode.Dry,
        "rain-light" => WeatherMode.RainLight,
        "rain-medium" => WeatherMode.RainMedium,
        "rain-heavy" => WeatherMode.RainHeavy,
        "snow-light" => WeatherMode.SnowLight,
        "snow-medium" => WeatherMode.SnowMedium,
        "snow-heavy" => WeatherMode.SnowHeavy,
        _ => WeatherMode.Dry,
    };
}

static GameWorldTeleportSet[] ResolveTeleportLocs(
    GameWorldConfig gameWorld,
    IReadOnlyDictionary<string, GameWorldConfig> gameWorldsById) {
    var configuredTeleportLocs = gameWorld.TeleportLocs;
    if (configuredTeleportLocs is null || configuredTeleportLocs.Length == 0) {
        return Array.Empty<GameWorldTeleportSet>();
    }

    var resolvedTeleportLocs = new GameWorldTeleportSet[configuredTeleportLocs.Length];
    for (var index = 0; index < configuredTeleportLocs.Length; index++) {
        var teleportLoc = configuredTeleportLocs[index];
        if (!gameWorldsById.TryGetValue(teleportLoc.Target.WorldId, out var targetWorld)) {
            throw new InvalidOperationException(
                $"Game world '{gameWorld.Id}' references unknown teleport target world '{teleportLoc.Target.WorldId}'.");
        }

        resolvedTeleportLocs[index] = new GameWorldTeleportSet(
            teleportLoc.Locs,
            new GameWorldTeleportTarget(
                teleportLoc.Target.WorldId,
                targetWorld.Map,
                teleportLoc.Target.Loc));
    }

    return resolvedTeleportLocs;
}

static string GetCurrentGameWorldId(PlayerSession session) {
    lock (session.SyncRoot) {
        return session.CurrentGameWorldId;
    }
}

/// <summary>Snapshot connected sessions for <see cref="RealmStats"/> (landing page counters).</summary>
static List<RealmStats.PlayerSessionView> SnapshotRealmSessions(
    ConcurrentDictionary<Guid, PlayerSession> sessions) {
    var list = new List<RealmStats.PlayerSessionView>(sessions.Count);
    foreach (var session in sessions.Values) {
        bool connected;
        string worldId;
        string networkId;
        lock (session.SyncRoot) {
            connected = session.WebSocket is not null;
            worldId = session.CurrentGameWorldId ?? string.Empty;
            networkId = session.NetworkId ?? string.Empty;
        }
        list.Add(new RealmStats.PlayerSessionView(connected, worldId, networkId));
    }
    return list;
}

static async Task SavePlayerPersistenceStateAsync(
    string charsDirectory,
    PlayerSession session,
    PlayerPersistenceState state) {
    string networkId;
    string characterName;
    bool travelerMode;
    lock (session.SyncRoot) {
        networkId = session.NetworkId;
        characterName = session.CharacterName;
        travelerMode = session.TravelerMode;
    }

    await GamePersistence.SaveCharacterDualAsync(
        GamePersistence.Current,
        charsDirectory,
        networkId,
        characterName,
        state,
        travelerMode);
}

/// <summary>True when the client announced real-player / traveler mode on authenticate or character list.</summary>
static bool IsTravelerPlayerMode(string? playerMode) {
    if (string.IsNullOrWhiteSpace(playerMode)) {
        return false;
    }

    var normalized = playerMode.Trim().ToLowerInvariant();
    return normalized is "traveler" or "traveller" or "player";
}

/// <summary>
/// Traveler-client login: pure travelers always enter the soft zone hub; Aresden/Elvine citizens
/// restore their last valid city/world (or city plaza if last world was traveler/invalid).
/// </summary>
static (string WorldId, PlayerPersistenceState State) ResolveTravelerModeLoginJoin(
    PlayerPersistenceState loadedState,
    WorldRegistry worldRegistry,
    IReadOnlyDictionary<string, GameWorldConfig> gameWorldsById,
    string defaultWorldId) {
    ArgumentNullException.ThrowIfNull(loadedState);
    var side = GamePersistence.NormalizeCitizenshipSide(loadedState.CitizenshipSide);

    if (side is not ("aresden" or "elvine")) {
        // No city papers — always soft traveler hub.
        if (gameWorldsById.ContainsKey("traveler") &&
            worldRegistry.TryGetGameWorld("traveler", out var travelerWorld) &&
            travelerWorld is not null) {
            var hub = Spawn.TryGetTravelerDefaultSpawn("traveler", out var hx, out var hy)
                ? (hx, hy)
                : (Spawn.TravelerDefaultSpawnX, Spawn.TravelerDefaultSpawnY);
            return ("traveler", loadedState with {
                GameWorldId = "traveler",
                X = hub.Item1,
                Y = hub.Item2,
                CitizenshipSide = "traveler",
            });
        }
        return ResolveLoadedPlayerJoin(loadedState, worldRegistry, gameWorldsById, defaultWorldId);
    }

    // Citizen: prefer last saved world when it still exists and is not pure traveler hub.
    var savedWorld = loadedState.GameWorldId?.Trim() ?? string.Empty;
    var savedIsTraveler = string.Equals(savedWorld, "traveler", StringComparison.OrdinalIgnoreCase);
    if (!savedIsTraveler &&
        gameWorldsById.ContainsKey(savedWorld) &&
        worldRegistry.TryGetGameWorld(savedWorld, out var savedGw) &&
        savedGw is not null) {
        return (savedWorld, loadedState with {
            GameWorldId = savedWorld,
            CitizenshipSide = side,
        });
    }

    // Last logout was traveler (or invalid world) but papers say city → city plaza.
    if (gameWorldsById.ContainsKey(side) &&
        worldRegistry.TryGetGameWorld(side, out var cityWorld) &&
        cityWorld is not null) {
        if (Spawn.TryGetTownDefaultSpawn(side, out var tx, out var ty)) {
            return (side, loadedState with {
                GameWorldId = side,
                X = tx,
                Y = ty,
                CitizenshipSide = side,
            });
        }
        var center = cityWorld.GetCenterSpawnHint();
        return (side, loadedState with {
            GameWorldId = side,
            X = center.X,
            Y = center.Y,
            CitizenshipSide = side,
        });
    }

    return ResolveLoadedPlayerJoin(loadedState, worldRegistry, gameWorldsById, defaultWorldId);
}

static (string WorldId, PlayerPersistenceState State) ResolveLoadedPlayerJoin(
    PlayerPersistenceState loadedState,
    WorldRegistry worldRegistry,
    IReadOnlyDictionary<string, GameWorldConfig> gameWorldsById,
    string defaultWorldId) {
    ArgumentNullException.ThrowIfNull(loadedState);
    const string requestedFallbackWorldId = "aresden";

    if (gameWorldsById.ContainsKey(loadedState.GameWorldId) &&
        worldRegistry.TryGetGameWorld(loadedState.GameWorldId, out var loadedWorld) &&
        loadedWorld is not null) {
        return (loadedState.GameWorldId, loadedState);
    }

    if (gameWorldsById.TryGetValue(requestedFallbackWorldId, out var fallbackGameWorld) &&
        worldRegistry.TryGetGameWorld(requestedFallbackWorldId, out var fallbackWorld) &&
        fallbackWorld is not null) {
        var center = fallbackWorld.GetCenterSpawnHint();
        return (requestedFallbackWorldId, loadedState with {
            GameWorldId = fallbackGameWorld.Id,
            X = center.X,
            Y = center.Y,
        });
    }

    Console.Error.WriteLine(
        $"[Server] Saved world '{loadedState.GameWorldId}' was not found and fallback world '{requestedFallbackWorldId}' is unavailable. Using defaults.");
    if (gameWorldsById.TryGetValue(defaultWorldId, out var defaultGameWorld) &&
        worldRegistry.TryGetGameWorld(defaultWorldId, out var defaultWorld) &&
        defaultWorld is not null) {
        var center = defaultWorld.GetCenterSpawnHint();
        return (defaultWorldId, loadedState with {
            GameWorldId = defaultGameWorld.Id,
            X = center.X,
            Y = center.Y,
        });
    }

    return (defaultWorldId, loadedState);
}

static async Task<PlayerPersistenceState?> CapturePlayerPersistenceStateAsync(
    WorldRegistry worldRegistry,
    string gameWorldId,
    Guid sessionId,
    CancellationToken cancellationToken) {
    var completion = new TaskCompletionSource<PlayerPersistenceState?>(TaskCreationOptions.RunContinuationsAsynchronously);
    await worldRegistry.RouteGameWorldMessageAsync(
        gameWorldId,
        new SavePlayerStateRequestMessage(sessionId, completion),
        cancellationToken);
    return await completion.Task.WaitAsync(cancellationToken);
}

/// <summary>
/// Snapshots every known session while <see cref="WorldRegistry"/> is still processing mailboxes,
/// so orderly server shutdown (e.g. CTRL+C) does not drop in-memory progress when websockets tear down after dispose.
/// </summary>
static async Task PersistAllPlayerStatesOnShutdownAsync(
    WorldRegistry worldRegistry,
    ConcurrentDictionary<Guid, PlayerSession> sessionsByServerId,
    string charsDirectory) {
    Console.WriteLine($"[Persistence] Shutdown save for {sessionsByServerId.Count} session(s)…");
    foreach (var session in sessionsByServerId.Values.ToArray()) {
        string worldId;
        Guid sessionId;
        string networkId;
        lock (session.SyncRoot) {
            worldId = session.CurrentGameWorldId;
            sessionId = session.SessionId;
            networkId = session.NetworkId;
        }

        try {
            var persistedState = await CapturePlayerPersistenceStateAsync(
                worldRegistry,
                worldId,
                sessionId,
                CancellationToken.None).ConfigureAwait(false);
            if (persistedState is not null) {
                await SavePlayerPersistenceStateAsync(charsDirectory, session, persistedState).ConfigureAwait(false);
            }
        } catch (Exception exception) when (exception is ObjectDisposedException or KeyNotFoundException) {
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] Failed to persist player '{networkId}' on shutdown: {ex}");
        }
    }
}

/// <summary>
/// Dual-writes every connected (or grace-period) session every 30s so Force-kill restarts
/// lose at most one autosave window instead of an entire play session.
/// </summary>
static async Task RunPlayerAutosaveLoopAsync(
    WorldRegistry worldRegistry,
    ConcurrentDictionary<Guid, PlayerSession> sessionsByServerId,
    string charsDirectory,
    CancellationToken cancellationToken) {
    using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
    while (await timer.WaitForNextTickAsync(cancellationToken).ConfigureAwait(false)) {
        try {
            var sessions = sessionsByServerId.Values.ToArray();
            if (sessions.Length == 0) {
                continue;
            }

            foreach (var session in sessions) {
                string worldId;
                Guid sessionId;
                string networkId;
                bool transferPending;
                lock (session.SyncRoot) {
                    worldId = session.CurrentGameWorldId;
                    sessionId = session.SessionId;
                    networkId = session.NetworkId;
                    transferPending = session.IsWorldTransferPending;
                }

                if (transferPending || string.IsNullOrWhiteSpace(worldId)) {
                    continue;
                }

                try {
                    var persistedState = await CapturePlayerPersistenceStateAsync(
                        worldRegistry,
                        worldId,
                        sessionId,
                        cancellationToken).ConfigureAwait(false);
                    if (persistedState is not null) {
                        await SavePlayerPersistenceStateAsync(charsDirectory, session, persistedState)
                            .ConfigureAwait(false);
                    }
                } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
                    throw;
                } catch (Exception exception) when (exception is ObjectDisposedException or KeyNotFoundException) {
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[Persistence] Autosave failed for '{networkId}': {ex.Message}");
                }
            }
        } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
            throw;
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Persistence] Autosave loop error: {ex.Message}");
        }
    }
}

/// <summary>
/// Periodically removes sessions whose disconnect deadline passed and notifies worlds via <see cref="RemoveDisconnectedPlayerMessage"/>.
/// </summary>
static async Task RunDisconnectedPlayerCleanupLoopAsync(
    WorldRegistry worldRegistry,
    ConcurrentDictionary<string, PlayerSession> sessionsByNetworkId,
    ConcurrentDictionary<Guid, PlayerSession> sessionsByServerId,
    CancellationToken cancellationToken) {
    using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(500));
    while (await timer.WaitForNextTickAsync(cancellationToken)) {
        try {
            var currentTime = DateTimeOffset.UtcNow;
            foreach (var session in sessionsByServerId.Values) {
                var shouldRemovePlayer = false;
                string worldIdForCleanup = string.Empty;
                lock (session.SyncRoot) {
                    // Still live on a socket → keep.
                    if (session.WebSocket is not null) {
                        continue;
                    }
                    // Not in disconnect grace → keep (or wait for disconnect path to set deadline).
                    if (!session.DisconnectDeadlineUtc.HasValue) {
                        continue;
                    }
                    // Still inside reconnect window → keep.
                    if (session.DisconnectDeadlineUtc.Value > currentTime) {
                        continue;
                    }
                    // Expired grace: remove even if CleanupStarted was set elsewhere (auth used to
                    // mark CleanupStarted without removing → permanent "Reconnect window has expired").
                    if (!session.CleanupStarted) {
                        session.CleanupStarted = true;
                    }
                    shouldRemovePlayer = true;
                    worldIdForCleanup = session.CurrentGameWorldId;
                }

                if (!shouldRemovePlayer) {
                    continue;
                }

                try {
                    await worldRegistry.RouteGameWorldMessageAsync(
                        worldIdForCleanup,
                        new RemoveDisconnectedPlayerMessage(session.SessionId),
                        cancellationToken);
                    await worldRegistry.RouteGlobalMessageAsync(
                        new GlobalRemoveDisconnectedPlayerMessage(session.SessionId),
                        cancellationToken);
                } catch (Exception exception) when (exception is ObjectDisposedException or KeyNotFoundException) {
                } catch (Exception ex) {
                    Console.Error.WriteLine($"[Server] Error routing remove-disconnected for session '{session.SessionId}': {ex}");
                }

                sessionsByServerId.TryRemove(session.SessionId, out _);
                sessionsByNetworkId.TryRemove(session.NetworkId, out _);
            }
        } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
            throw;
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] Error in disconnected player cleanup loop: {ex}");
        }
    }
}

/// <summary>
/// Serializes cross-world moves: remove player from source world, capture transferable state, join target world on the same connection callbacks.
/// </summary>
static async Task RunWorldTransferLoopAsync(
    WorldRegistry worldRegistry,
    ConcurrentDictionary<Guid, PlayerSession> sessionsByServerId,
    ChannelReader<WorldTransferRequest> worldTransferRequests,
    string charsDirectory,
    CancellationToken cancellationToken) {
    await foreach (var request in worldTransferRequests.ReadAllAsync(cancellationToken)) {
        PlayerSession? session = null;
        try {
            if (!sessionsByServerId.TryGetValue(request.SessionId, out session)) {
                continue;
            }

            string sourceWorldId;
            Action<ServerMessage>? sendMessage;
            Action<string?>? requestDisconnect;
            Action<WorldTransferDestination>? requestWorldChange;
            lock (session.SyncRoot) {
                if (session.IsWorldTransferPending ||
                    string.Equals(session.CurrentGameWorldId, request.TargetWorldId, StringComparison.Ordinal) ||
                    session.SendMessage is null ||
                    session.RequestDisconnect is null ||
                    session.RequestWorldChange is null ||
                    session.WebSocket is null) {
                    continue;
                }

                sourceWorldId = session.CurrentGameWorldId;
                sendMessage = session.SendMessage;
                requestDisconnect = session.RequestDisconnect;
                requestWorldChange = session.RequestWorldChange;
                session.IsWorldTransferPending = true;
            }

            if (!worldRegistry.TryGetGameWorld(request.TargetWorldId, out _)) {
                sendMessage!(new ServerMessage {
                    SendMessage = new SendMessage {
                        Message = $"World '{request.TargetWorldId}' was not found.",
                    },
                });
                lock (session.SyncRoot) {
                    session.IsWorldTransferPending = false;
                }
                continue;
            }

            var transferCompletion = new TaskCompletionSource<TransferredPlayerState?>(TaskCreationOptions.RunContinuationsAsynchronously);
            try {
                await worldRegistry.RouteGameWorldMessageAsync(
                    sourceWorldId,
                    new TransferPlayerOutMessage(request.SessionId, request.TargetWorldId, transferCompletion),
                    cancellationToken);

                var transferState = await transferCompletion.Task.WaitAsync(cancellationToken);
                if (transferState is null) {
                    continue;
                }

                lock (session.SyncRoot) {
                    session.CurrentGameWorldId = request.TargetWorldId;
                }

                await worldRegistry.RouteGameWorldMessageAsync(
                    request.TargetWorldId,
                    new TransferPlayerInMessage(
                        transferState,
                        request.SpawnX,
                        request.SpawnY,
                        sendMessage!,
                        requestDisconnect!,
                        requestWorldChange!,
                        CreateInterruptLogoutDueToCombat(session)),
                    cancellationToken);
                var persistedState = await CapturePlayerPersistenceStateAsync(
                    worldRegistry,
                    request.TargetWorldId,
                    request.SessionId,
                    cancellationToken);
                if (persistedState is not null) {
                    await SavePlayerPersistenceStateAsync(charsDirectory, session, persistedState);
                }
            } catch (Exception ex) when (ex is not OperationCanceledException) {
                Console.Error.WriteLine($"[Server] Failed to transfer player '{request.SessionId}' to world '{request.TargetWorldId}': {ex}");
            } finally {
                lock (session.SyncRoot) {
                    session.IsWorldTransferPending = false;
                }
            }
        } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
            throw;
        } catch (Exception ex) {
            Console.Error.WriteLine($"[Server] Unexpected error in world transfer loop for session '{request.SessionId}': {ex}");
            if (session is not null) {
                lock (session.SyncRoot) {
                    session.IsWorldTransferPending = false;
                }
            }
        }
    }
}

/// <summary>Clears <see cref="PlayerSession.LogoutAllowedAtUtc"/> and notifies the client when combat cancels a pending logout.</summary>
/// <remarks>
/// Uses <see cref="PlayerSession.SendMessage"/> at invoke time (not a captured enqueue delegate) so reconnect
/// replaces the socket while <see cref="GameWorldPlayer"/> still uses the same interrupt callback from first join.
/// </remarks>
static Action CreateInterruptLogoutDueToCombat(PlayerSession session) {
    ArgumentNullException.ThrowIfNull(session);
    return () => {
        Action<ServerMessage>? send;
        lock (session.SyncRoot) {
            if (!session.LogoutAllowedAtUtc.HasValue) {
                return;
            }

            session.LogoutAllowedAtUtc = null;
            send = session.SendMessage;
        }

        send?.Invoke(NetworkManager.CreateLogoutCancelled());
    };
}

/// <summary>Accumulates multi-frame WebSocket messages into <paramref name="messageScratch"/> when needed; total size is capped.</summary>
static async Task<(WebSocketMessageType MessageType, ReadOnlyMemory<byte> Payload)> ReceiveMessageAsync(
    WebSocket webSocket,
    byte[] receiveBuffer,
    byte[] messageScratch,
    CancellationToken cancellationToken) {
    if (receiveBuffer.Length < MaxIncomingWebSocketMessageBytes || messageScratch.Length < MaxIncomingWebSocketMessageBytes) {
        throw new InvalidOperationException("Receive buffers must be at least MaxIncomingWebSocketMessageBytes.");
    }

    var assembled = 0;
    while (true) {
        var result = await webSocket.ReceiveAsync(receiveBuffer, cancellationToken);
        if (result.MessageType == WebSocketMessageType.Close) {
            return (result.MessageType, ReadOnlyMemory<byte>.Empty);
        }

        if (result.Count > MaxIncomingWebSocketMessageBytes) {
            throw new IncomingWebSocketMessageTooLargeException();
        }

        if (assembled + result.Count > MaxIncomingWebSocketMessageBytes) {
            throw new IncomingWebSocketMessageTooLargeException();
        }

        if (result.EndOfMessage && assembled == 0) {
            return (result.MessageType, receiveBuffer.AsMemory(0, result.Count));
        }

        receiveBuffer.AsSpan(0, result.Count).CopyTo(messageScratch.AsSpan(assembled, result.Count));
        assembled += result.Count;
        if (result.EndOfMessage) {
            return (result.MessageType, messageScratch.AsMemory(0, assembled));
        }
    }
}

/// <summary>
/// When protobuf serialization disagrees with <see cref="IMessage.CalculateSize"/>, the send loop logs once and aborts the
/// connection instead of retrying (avoids log-spam from a corrupted or inconsistent in-memory message).
/// </summary>
const string ProtobufEncodeInvariantViolationMessagePrefix = "Protobuf encode invariant violated: ";

static bool IsProtobufEncodeInvariantViolation(Exception ex) =>
    ex is InvalidOperationException ioe && ioe.Message.StartsWith(ProtobufEncodeInvariantViolationMessagePrefix, StringComparison.Ordinal);

/// <summary>
/// Drains per-connection outbound channel(s), encodes protobuf with pooled buffers, and sends under <paramref name="sendLock"/>.
/// When <paramref name="usePriorityQueue"/> is true: always flush High (combat) before Normal (meta).
/// </summary>
static async Task SendOutgoingMessagesAsync(
    WebSocket webSocket,
    ChannelReader<ServerMessage> outgoingHigh,
    ChannelReader<ServerMessage> outgoingNormal,
    bool usePriorityQueue,
    SemaphoreSlim sendLock,
    bool enableZeroCopyProtobufTransfer,
    int maxConsecutiveSendFailures,
    CancellationTokenSource? abortConnectionOnSendCircuitBreaker,
    CancellationToken cancellationToken) {
    var consecutiveSendFailures = 0;

    async Task<bool> SendOneAsync(ServerMessage message) {
        if (webSocket.State != WebSocketState.Open) {
            return false;
        }

        try {
            var payloadSize = message.CalculateSize();
            byte[]? rentedPayload = null;
            try {
                ReadOnlyMemory<byte> payloadMemory;
                if (payloadSize == 0) {
                    payloadMemory = ReadOnlyMemory<byte>.Empty;
                } else {
                    rentedPayload = ArrayPool<byte>.Shared.Rent(payloadSize);
                    if (enableZeroCopyProtobufTransfer) {
                        try {
                            message.WriteTo(rentedPayload.AsSpan(0, payloadSize));
                        } catch (InvalidOperationException ex) {
                            throw new InvalidOperationException(
                                $"{ProtobufEncodeInvariantViolationMessagePrefix}zero-copy write failed (CalculateSize was {payloadSize}).",
                                ex);
                        }
                        payloadMemory = rentedPayload.AsMemory(0, payloadSize);
                    } else {
                        using var payloadStream = new MemoryStream(rentedPayload, 0, payloadSize, writable: true, publiclyVisible: true);
                        using (var codedOutput = new CodedOutputStream(payloadStream, leaveOpen: true)) {
                            message.WriteTo(codedOutput);
                            codedOutput.Flush();
                        }

                        if (payloadStream.Position != payloadSize) {
                            throw new InvalidOperationException(
                                $"{ProtobufEncodeInvariantViolationMessagePrefix}encoded length {payloadStream.Position} does not match CalculateSize {payloadSize}.");
                        }

                        payloadMemory = rentedPayload.AsMemory(0, payloadSize);
                    }
                }

                await sendLock.WaitAsync(cancellationToken);
                try {
                    if (webSocket.State != WebSocketState.Open) {
                        return false;
                    }

                    await webSocket.SendAsync(
                        payloadMemory,
                        WebSocketMessageType.Binary,
                        true,
                        cancellationToken);
                } finally {
                    sendLock.Release();
                }
            } finally {
                if (rentedPayload is not null) {
                    ArrayPool<byte>.Shared.Return(rentedPayload);
                }
            }

            consecutiveSendFailures = 0;
            return true;
        } catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) {
            throw;
        } catch (Exception ex) when (IsProtobufEncodeInvariantViolation(ex)) {
            Console.Error.WriteLine($"[Server] Fatal protobuf encode error; closing connection: {ex}");
            abortConnectionOnSendCircuitBreaker?.Cancel();
            return false;
        } catch (IOException) {
            return false;
        } catch (WebSocketException) {
            return false;
        } catch (Exception ex) {
            consecutiveSendFailures++;
            Console.Error.WriteLine($"[Server] Error sending outbound message: {ex}");
            if (webSocket.State != WebSocketState.Open) {
                return false;
            }

            if (maxConsecutiveSendFailures > 0 && consecutiveSendFailures >= maxConsecutiveSendFailures) {
                Console.Error.WriteLine(
                    $"[Server] Outbound send circuit breaker: {consecutiveSendFailures} consecutive failures; aborting connection.");
                abortConnectionOnSendCircuitBreaker?.Cancel();
                return false;
            }

            return true; // keep draining after transient encode/send error
        }
    }

    // Drain helper: High first, then a small Normal batch so combat cannot starve forever behind meta.
    const int MaxNormalPerCycle = 8;

    while (true) {
        // Wait until either queue has data (or both completed).
        var highWait = outgoingHigh.WaitToReadAsync(cancellationToken);
        var normalWait = usePriorityQueue
            ? outgoingNormal.WaitToReadAsync(cancellationToken)
            : new ValueTask<bool>(false);

        // Prefer completing whichever becomes ready first.
        if (!highWait.IsCompleted && usePriorityQueue && !normalWait.IsCompleted) {
            var highTask = highWait.AsTask();
            var normalTask = normalWait.AsTask();
            await Task.WhenAny(highTask, normalTask);
        } else if (!highWait.IsCompleted) {
            await highWait;
        } else if (usePriorityQueue && !normalWait.IsCompleted) {
            await normalWait;
        }

        if (webSocket.State != WebSocketState.Open) {
            return;
        }

        var highSent = 0;
        while (outgoingHigh.TryRead(out var highMsg)) {
            if (!await SendOneAsync(highMsg)) {
                return;
            }
            highSent++;
        }

        var normalSent = 0;
        if (usePriorityQueue) {
            while (normalSent < MaxNormalPerCycle && outgoingNormal.TryRead(out var normalMsg)) {
                if (!await SendOneAsync(normalMsg)) {
                    return;
                }
                normalSent++;
            }
        }

        if (highSent > 0 || normalSent > 0) {
            NetworkPriorityMetrics.RecordFlushCycle(highSent, normalSent);
            continue;
        }

        // Both empty — if both completed, exit; else loop (spurious wake).
        if (outgoingHigh.Completion.IsCompleted &&
            (!usePriorityQueue || outgoingNormal.Completion.IsCompleted)) {
            // Drain any race leftovers.
            while (outgoingHigh.TryRead(out var h)) {
                if (!await SendOneAsync(h)) {
                    return;
                }
            }
            if (usePriorityQueue) {
                while (outgoingNormal.TryRead(out var n)) {
                    if (!await SendOneAsync(n)) {
                        return;
                    }
                }
            }
            return;
        }
    }
}

static async Task SendServerDisconnectAsync(
    WebSocket webSocket,
    SemaphoreSlim sendLock,
    Task<string?> disconnectRequestedTask) {
    try {
        var disconnectReason = await disconnectRequestedTask;
        if (string.IsNullOrEmpty(disconnectReason)) {
            return;
        }

        await SendCloseFrameAsync(WebSocketCloseStatus.NormalClosure, disconnectReason, webSocket, sendLock, CancellationToken.None);
    } catch (Exception ex) {
        Console.Error.WriteLine($"[Server] Error sending server-initiated disconnect: {ex}");
    }
}

static async Task SendCloseFrameAsync(
    WebSocketCloseStatus closeStatus,
    string closeDescription,
    WebSocket webSocket,
    SemaphoreSlim sendLock,
    CancellationToken cancellationToken) {
    await sendLock.WaitAsync(cancellationToken);
    try {
        if (webSocket.State == WebSocketState.Open || webSocket.State == WebSocketState.CloseReceived) {
            await webSocket.CloseOutputAsync(closeStatus, closeDescription, cancellationToken);
        }
    } catch (WebSocketException ex) when (ex.WebSocketErrorCode is WebSocketError.ConnectionClosedPrematurely
        or WebSocketError.InvalidState
        or WebSocketError.Faulted) {
        // Peer already gone — expected.
    } catch (IOException) {
        // Matches WER AppCrash signature: System.IO.IOException under System.Net.Sockets when TCP is already dead.
    } catch (ObjectDisposedException) {
    } finally {
        sendLock.Release();
    }
}

/// <summary>Thrown when an assembled inbound WebSocket message exceeds <see cref="MaxIncomingWebSocketMessageBytes"/>.</summary>
sealed class IncomingWebSocketMessageTooLargeException : Exception {
    public IncomingWebSocketMessageTooLargeException() : base("Incoming WebSocket message exceeds maximum allowed size.") { }
}

/// <summary>
/// Authoritative server-side session: maps client network id to stable <see cref="SessionId"/>, holds the live socket and outbound enqueue delegate,
/// and tracks logout/reconnect/world-transfer coordination guarded by <see cref="SyncRoot"/>.
/// </summary>
public sealed class PlayerSession {
    public PlayerSession(string networkId, Guid sessionId, string currentGameWorldId, WebSocket webSocket, string characterName) {
        NetworkId = networkId;
        SessionId = sessionId;
        CurrentGameWorldId = currentGameWorldId;
        WebSocket = webSocket;
        CharacterName = characterName;
    }

    /// <summary>Per-session lock for fields mutated from the WebSocket loop and background tasks.</summary>
    public object SyncRoot { get; } = new();
    /// <summary>Client-supplied stable identity string (e.g. from authenticate payload).</summary>
    public string NetworkId { get; }
    /// <summary>Display name from the client authenticate payload.</summary>
    public string CharacterName { get; set; }
    /// <summary>Server-generated id used in world messages and dictionaries.</summary>
    public Guid SessionId { get; }
    /// <summary>Logical world the player is joined to; updated after successful transfer-in.</summary>
    public string CurrentGameWorldId { get; set; }
    /// <summary>Active socket for this session when connected; null while in reconnect grace.</summary>
    public WebSocket? WebSocket { get; set; }
    /// <summary>Enqueues protobuf <see cref="ServerMessage"/> to the connection send loop.</summary>
    public Action<ServerMessage>? SendMessage { get; set; }
    /// <summary>Requests an orderly close with optional reason shown to the client.</summary>
    public Action<string?>? RequestDisconnect { get; set; }
    /// <summary>Queues an asynchronous world change handled by <c>RunWorldTransferLoopAsync</c>.</summary>
    public Action<WorldTransferDestination>? RequestWorldChange { get; set; }
    /// <summary>When set and in the past, session dictionaries may be purged unless still within grace.</summary>
    public DateTimeOffset? DisconnectDeadlineUtc { get; set; }
    /// <summary>Earliest UTC instant logout is allowed; cleared if logout is cancelled.</summary>
    public DateTimeOffset? LogoutAllowedAtUtc { get; set; }
    /// <summary>Prevents double cleanup when the periodic remover has already started for this session.</summary>
    public bool CleanupStarted { get; set; }
    /// <summary>True while a transfer is in flight to avoid overlapping world moves.</summary>
    public bool IsWorldTransferPending { get; set; }
    /// <summary>When true, this session came from the traveler client (:8081): soft combat, limited spells, separate save file.</summary>
    public bool TravelerMode { get; set; }
}

/// <summary>Work item for the world-transfer channel: move <see cref="SessionId"/> to <see cref="TargetWorldId"/> and spawn near the authoritative target cell.</summary>
public sealed record WorldTransferRequest(Guid SessionId, string TargetWorldId, int? SpawnX, int? SpawnY);
