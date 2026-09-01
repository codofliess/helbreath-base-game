using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Channels;
using Mmorpg.Network;
using Server;
using Server.Helpers;
using Server.Utils;

namespace Server.World.Game;

/// <summary>
/// Bundle of dependencies and scratch buffers passed into helpers (<see cref="Server.Helpers.Movement"/>, <see cref="Server.Helpers.Spawn"/>, <see cref="Server.Helpers.Combat"/>, <see cref="Server.Helpers.Casting"/>, etc.)
/// so they can run without capturing a wide closure. Scratch collections are owned by <see cref="GameWorld"/> and must not be retained across awaits.
/// </summary>
public struct GameWorldRef {
    /// <summary>Owning world instance for lookups (e.g. TryGetPlayerBySessionId).</summary>
    public GameWorld World;
    /// <summary>Walkable vs blocked cells for movement validation.</summary>
    public GameWorldOccupancyTracker OccupancyTracker;
    /// <summary>Server-wide tunables (radii, anti-cheat, ping policy).</summary>
    public SettingsConfig Settings;
    /// <summary>Registered world id (matches config and client routing).</summary>
    public string WorldId;
    /// <summary>Map asset name for initial state payloads.</summary>
    public string Map;
    /// <summary>Music file the client should play for this world.</summary>
    public string? Music;
    /// <summary>Config-defined teleport metadata sent to clients and used for authoritative transfer checks.</summary>
    public IReadOnlyList<GameWorldTeleportSet> TeleportLocs;
    /// <summary>Spatial index of players for neighborhood queries.</summary>
    public PlayersSpatialGrid PlayerSpatialGrid;
    /// <summary>Spatial index of monsters for neighborhood queries.</summary>
    public MonstersSpatialGrid MonsterSpatialGrid;
    /// <summary>Tracks long-lived ground effects per cell and schedules their periodic ticks or expiry callbacks.</summary>
    public GroundStateTracker GroundStateTracker;
    /// <summary>Reader for this world's mailbox; used for diagnostics (e.g. queue depth in ping responses).</summary>
    public ChannelReader<GameWorldMessage> IncomingReader;
    /// <summary>Deferred callbacks (spawn protection expiry, repeating ping checks).</summary>
    public Scheduler Scheduler;
    /// <summary>Spell catalog for <see cref="Mmorpg.Network.InitialState"/> payloads (stable id order).</summary>
    public IReadOnlyDictionary<int, SpellConfig> SpellsById;
    /// <summary>Item catalog for <see cref="Mmorpg.Network.InitialState"/> <c>items_directory</c> (stable id order in the wire payload).</summary>
    public IReadOnlyDictionary<int, ItemConfig> ItemsById;
    /// <summary>Monster catalog keyed by <c>Monsters.json</c> id for loot and dwell spawning.</summary>
    public IReadOnlyDictionary<int, MonsterConfig> MonstersById;
    /// <summary>NPC catalog for <see cref="Mmorpg.Network.InitialState"/> <c>npc_directory</c> (display names; client maps ids to sprites).</summary>
    public IReadOnlyDictionary<int, NpcConfig> NpcsById;
    /// <summary>Spatial index of NPCs for neighborhood queries.</summary>
    public NpcsSpatialGrid NpcSpatialGrid;
    /// <summary>All NPCs on this map keyed by <see cref="GameWorldNPC.NpcId"/>.</summary>
    public Dictionary<long, GameWorldNPC> NpcsByNpcId;
    /// <summary>Scratch: NPCs near a cell within view radii.</summary>
    public Dictionary<long, GameWorldNPC> NearbyNpcsByIdScratch;
    /// <summary>Scratch: NPC ids a player saw before a visibility refresh.</summary>
    public HashSet<long> NpcsPreviouslyInRangeScratch;
    /// <summary>Scratch: NPCs that entered a player’s view during <see cref="Npc.SyncPlayerNpcVisibilityAfterMovement"/>.</summary>
    public List<GameWorldNPC> PlayerNpcVisibilityEnteredScratch;
    /// <summary>Scratch: NPC ids that left a player’s view during <see cref="Npc.SyncPlayerNpcVisibilityAfterMovement"/>.</summary>
    public List<long> PlayerNpcVisibilityLeftNpcIdsScratch;
    /// <summary>Reused map of nearby player ids when building visibility updates.</summary>
    public Dictionary<long, GameWorldPlayer> NearbyPlayersByIdScratch;
    /// <summary>Reused set of who was in range before a movement for diffing enter/leave.</summary>
    public HashSet<long> PlayersPreviouslyInRangeScratch;
    /// <summary>All monsters on this map keyed by <see cref="GameWorldMonster.MonsterId"/>.</summary>
    public Dictionary<long, GameWorldMonster> MonstersByMonsterId;
    /// <summary>Scratch: monsters near a cell within view radii.</summary>
    public Dictionary<long, GameWorldMonster> NearbyMonstersByIdScratch;
    /// <summary>Scratch: monster ids a player saw before a visibility refresh.</summary>
    public HashSet<long> MonstersPreviouslyInRangeScratch;
    /// <summary>Scratch: players who could see a monster at its previous cell before a step.</summary>
    public Dictionary<long, GameWorldPlayer> MonsterStepOldViewersScratch;
    /// <summary>Scratch: players who can see a monster at its new cell after a step.</summary>
    public Dictionary<long, GameWorldPlayer> MonsterStepNewViewersScratch;
    /// <summary>Scratch: monsters that entered a player’s view during <see cref="Server.Helpers.MonsterVisibility.SyncPlayerMonsterVisibilityAfterMovement"/>.</summary>
    public List<GameWorldMonster> PlayerMonsterVisibilityEnteredScratch;
    /// <summary>Scratch: monster ids that left a player’s view during <see cref="Server.Helpers.MonsterVisibility.SyncPlayerMonsterVisibilityAfterMovement"/>.</summary>
    public List<long> PlayerMonsterVisibilityLeftMonsterIdsScratch;
    /// <summary>Scratch: players newly in range of the mover during <see cref="Server.Helpers.Movement.SyncPlayerVisibilityAfterMovement"/>.</summary>
    public List<GameWorldPlayer> MovementNewNeighborsScratch;
    /// <summary>Scratch: neighbor player ids no longer in range after a move during <see cref="Server.Helpers.Movement.SyncPlayerVisibilityAfterMovement"/>.</summary>
    public List<long> MovementLeftNeighborIdsScratch;
    /// <summary>Scratch: unique spell-affected grid cells for the current spell resolution.</summary>
    public HashSet<(int X, int Y)> SpellAffectedCellsScratch;
    /// <summary>Scratch: ground effects near a player within view radii.</summary>
    public Dictionary<long, GroundEffectState> NearbyGroundEffectsByIdScratch;
    /// <summary>Scratch: ground effect ids a player saw before a visibility refresh.</summary>
    public HashSet<long> GroundEffectsPreviouslyInRangeScratch;
    /// <summary>Scratch: ground effects newly entered into a player's view or newly created near viewers.</summary>
    public List<GroundEffectState> GroundEffectsEnteredScratch;
    /// <summary>Scratch: ground effects that left a player's view or expired for viewers.</summary>
    public List<GroundEffectState> GroundEffectsLeftScratch;
    /// <summary>Scratch: nearby viewers collected while broadcasting created or expired ground effects.</summary>
    public Dictionary<long, GameWorldPlayer> GroundEffectsViewersScratch;
    /// <summary>Scratch: top-most ground items near a player within view radii.</summary>
    public Dictionary<long, GroundItemState> NearbyGroundItemsByIdScratch;
    /// <summary>Scratch: top-most ground item ids a player saw before a visibility refresh.</summary>
    public HashSet<long> GroundItemsPreviouslyInRangeScratch;
    /// <summary>Scratch: top-most ground items newly entered into a player's view or newly revealed near viewers.</summary>
    public List<GroundItemState> GroundItemsEnteredScratch;
    /// <summary>Scratch: top-most ground items that left a player's view or were removed/replaced for viewers.</summary>
    public List<GroundItemState> GroundItemsLeftScratch;
    /// <summary>Scratch: nearby viewers collected while broadcasting dropped-item visibility changes.</summary>
    public Dictionary<long, GameWorldPlayer> GroundItemsViewersScratch;
    /// <summary>Scratch: groups <see cref="GroundStatesEnteredRange"/> payload cells by grid coordinate while building wire messages.</summary>
    public Dictionary<(int X, int Y), Mmorpg.Network.GroundStateCell> GroundStatesEnteredByCellScratch;
    /// <summary>Scratch: groups <see cref="GroundStatesLeftRange"/> payload cells by grid coordinate while building wire messages.</summary>
    public Dictionary<(int X, int Y), GroundStateCellRemoved> GroundStatesLeftByCellScratch;
}

/// <summary>
/// Single map instance: owns players, occupancy, spatial index, and inbound message mailbox. Mutated only on its assigned <see cref="WorldWorker"/> thread.
/// </summary>
public sealed class GameWorld : IWorkerWorld {
    private const int TeleportValidationRadius = 3;
    private readonly Channel<GameWorldMessage> incomingMessages;
    private readonly Dictionary<Guid, GameWorldPlayer> playersBySessionId = new();
    private readonly Dictionary<long, GameWorldPlayer> playersMap = new();
    /// <summary>Caps messages handled per worker wake; from <see cref="GameWorldRuntimeSettings.IncomingMessagesBatchSizePerDispatch"/> (<c>Settings.json</c> <c>gameWorld.incomingMessagesBatchSizePerDispatch</c>).</summary>
    private readonly int maxMessagesPerDispatch;
    private readonly SettingsConfig settings;
    private readonly Scheduler scheduler = new();
    private readonly PlayersSpatialGrid playerSpatialGrid;
    private readonly MonstersSpatialGrid monsterSpatialGrid;
    private readonly NpcsSpatialGrid npcSpatialGrid;
    private readonly GroundStateTracker groundStateTracker;
    private readonly Dictionary<long, GameWorldPlayer> nearbyPlayersByIdScratch = new();
    private readonly HashSet<long> playersPreviouslyInRangeScratch = new();
    private readonly Dictionary<long, GameWorldMonster> nearbyMonstersByIdScratch = new();
    private readonly HashSet<long> monstersPreviouslyInRangeScratch = new();
    private readonly Dictionary<long, GameWorldPlayer> monsterStepOldViewersScratch = new();
    private readonly Dictionary<long, GameWorldPlayer> monsterStepNewViewersScratch = new();
    private readonly List<GameWorldMonster> playerMonsterVisibilityEnteredScratch = new();
    private readonly List<long> playerMonsterVisibilityLeftMonsterIdsScratch = new();
    /// <summary>Scratch: snapshot of <see cref="monstersByMonsterId"/> values for one AI tick so <see cref="RemoveMonster"/> during <see cref="GameWorldMonster.TickAi"/> cannot invalidate enumeration.</summary>
    private readonly List<GameWorldMonster> monsterAiTickScratch = new();
    private readonly Dictionary<long, GameWorldNPC> nearbyNpcsByIdScratch = new();
    private readonly HashSet<long> npcsPreviouslyInRangeScratch = new();
    private readonly List<GameWorldNPC> playerNpcVisibilityEnteredScratch = new();
    private readonly List<long> playerNpcVisibilityLeftNpcIdsScratch = new();
    private readonly List<GameWorldPlayer> movementNewNeighborsScratch = new();
    private readonly List<long> movementLeftNeighborIdsScratch = new();
    private readonly HashSet<(int X, int Y)> spellAffectedCellsScratch = new();
    private readonly Dictionary<long, GroundEffectState> nearbyGroundEffectsByIdScratch = new();
    private readonly HashSet<long> groundEffectsPreviouslyInRangeScratch = new();
    private readonly List<GroundEffectState> groundEffectsEnteredScratch = new();
    private readonly List<GroundEffectState> groundEffectsLeftScratch = new();
    private readonly Dictionary<long, GameWorldPlayer> groundEffectsViewersScratch = new();
    private readonly Dictionary<long, GroundItemState> nearbyGroundItemsByIdScratch = new();
    private readonly HashSet<long> groundItemsPreviouslyInRangeScratch = new();
    private readonly List<GroundItemState> groundItemsEnteredScratch = new();
    private readonly List<GroundItemState> groundItemsLeftScratch = new();
    private readonly Dictionary<long, GameWorldPlayer> groundItemsViewersScratch = new();
    private readonly Dictionary<(int X, int Y), Mmorpg.Network.GroundStateCell> groundStatesEnteredByCellScratch = new();
    private readonly Dictionary<(int X, int Y), GroundStateCellRemoved> groundStatesLeftByCellScratch = new();
    private readonly Random monsterAiRandom = new();
    private readonly int viewRadiusX;
    private readonly int viewRadiusY;
    private WorldWorker? worker;
    /// <summary>0/1 flag: whether this world is already queued on the worker's ready queue.</summary>
    private int isScheduled;
    private readonly string id;
    private readonly string map;
    private readonly string? music;
    private readonly GameWorldOccupancyTracker occupancyTracker;
    private readonly IReadOnlyList<GameWorldTeleportSet> teleportLocs;
    private readonly Dictionary<(int X, int Y), GameWorldTeleportTarget> teleportTargetsBySourceCell = new();
    private readonly GameWorldRef gameWorldRef;
    private readonly IReadOnlyDictionary<string, MonsterConfig> monsterCatalog;
    private readonly IReadOnlyDictionary<int, MonsterConfig> monstersById;
    private readonly IReadOnlyDictionary<int, SpellConfig> spellsById;
    private readonly IReadOnlyDictionary<int, ItemConfig> itemsById;
    private readonly IReadOnlyDictionary<int, NpcConfig> npcsById;
    private readonly IReadOnlyList<GameWorldMiningNodeConfig> miningNodes;
    private readonly Dictionary<long, GameWorldMonster> monstersByMonsterId = new();
    private readonly Dictionary<long, GameWorldNPC> npcsByNpcId = new();
    /// <summary>Diagnostics: sum of per-loop <see cref="TimeSpan.TotalMilliseconds"/> since last 1s log; only on worker thread.</summary>
    private double monsterAiProfileMillisSum;
    /// <summary>Diagnostics: number of loop timings accumulated into the profile sums.</summary>
    private int monsterAiProfileSampleCount;
    /// <summary>Diagnostics: first moment after which a 1s aggregate log may be emitted; null until the first tick with monsters.</summary>
    private DateTimeOffset? monsterAiProfileWindowEndUtc;
    /// <summary>Authoritative weather for this map; defaults to dry and is broadcast to all players when changed.</summary>
    private WeatherMode currentWeather = WeatherMode.Dry;
    /// <summary>When set, this world is a tournament arena: entrants receive the standardized loadout and PvP kills are rated.</summary>
    private readonly TournamentConfig? tournamentConfig;

    /// <summary>Current weather mode for snapshots and <see cref="WeatherChanged"/> broadcasts.</summary>
    public WeatherMode CurrentWeather => currentWeather;

    /// <summary>True when this world applies tournament rules (standardized loadout on entry, rated PvP kills).</summary>
    public bool IsTournamentArena => tournamentConfig is not null;

    public GameWorld(
        string id,
        string map,
        string? music,
        GameWorldOccupancyTracker occupancyTracker,
        SettingsConfig settings,
        IReadOnlyDictionary<string, MonsterConfig> monsterCatalog,
        IReadOnlyDictionary<int, MonsterConfig> monstersById,
        IReadOnlyDictionary<int, SpellConfig> spellsById,
        IReadOnlyDictionary<int, ItemConfig> itemsById,
        IReadOnlyDictionary<int, NpcConfig> npcsById,
        IReadOnlyList<GameWorldDwellAreaConfig>? dwellAreas = null,
        IReadOnlyList<GameWorldTeleportSet>? teleportLocs = null,
        IReadOnlyList<GameWorldNpcPlacementConfig>? initialNpcs = null,
        TournamentConfig? tournamentConfig = null,
        WeatherMode defaultWeather = WeatherMode.Dry,
        IReadOnlyList<GameWorldMiningNodeConfig>? miningNodes = null) {
        this.tournamentConfig = tournamentConfig;
        this.miningNodes = miningNodes is { Count: > 0 }
            ? miningNodes
            : Array.Empty<GameWorldMiningNodeConfig>();
        currentWeather = defaultWeather;
        if (string.IsNullOrWhiteSpace(id)) {
            throw new ArgumentException("Game world id is required.", nameof(id));
        }
        if (string.IsNullOrWhiteSpace(map)) {
            throw new ArgumentException("Map name is required.", nameof(map));
        }
        ArgumentNullException.ThrowIfNull(occupancyTracker);
        ArgumentNullException.ThrowIfNull(settings);
        ArgumentNullException.ThrowIfNull(monsterCatalog);
        ArgumentNullException.ThrowIfNull(monstersById);
        ArgumentNullException.ThrowIfNull(spellsById);
        ArgumentNullException.ThrowIfNull(itemsById);
        ArgumentNullException.ThrowIfNull(npcsById);
        this.monsterCatalog = monsterCatalog;
        this.monstersById = monstersById;
        this.spellsById = spellsById;
        this.itemsById = itemsById;
        this.npcsById = npcsById;
        var incomingQueueSize = settings.GameWorld.IncomingMessagesQueueSize;
        var batchPerDispatch = settings.GameWorld.IncomingMessagesBatchSizePerDispatch;

        this.id = id;
        this.map = map;
        this.music = music;
        this.occupancyTracker = occupancyTracker;
        this.settings = settings;
        this.teleportLocs = teleportLocs ?? Array.Empty<GameWorldTeleportSet>();
        viewRadiusX = settings.Radius.ViewRadiusX;
        viewRadiusY = settings.Radius.ViewRadiusY;
        playerSpatialGrid = new PlayersSpatialGrid(viewRadiusX, viewRadiusY);
        monsterSpatialGrid = new MonstersSpatialGrid(viewRadiusX, viewRadiusY);
        npcSpatialGrid = new NpcsSpatialGrid(viewRadiusX, viewRadiusY);
        groundStateTracker = new GroundStateTracker(
            occupancyTracker.SizeX,
            occupancyTracker.SizeY,
            viewRadiusX,
            viewRadiusY,
            settings.MaxDroppedItemsInStack,
            scheduler,
            HandleGroundEffectTick,
            HandleGroundEffectExpired);
        maxMessagesPerDispatch = batchPerDispatch;
        foreach (var teleportLoc in this.teleportLocs) {
            foreach (var sourceLoc in teleportLoc.Locs) {
                if (!teleportTargetsBySourceCell.TryAdd((sourceLoc.X, sourceLoc.Y), teleportLoc.Target)) {
                    throw new InvalidOperationException(
                        $"Game world '{id}' has duplicate teleport source cell ({sourceLoc.X}, {sourceLoc.Y}).");
                }
            }
        }
        scheduler.SetInterval(1000, RunPingVarianceCheck);
        // Olympia TimeHit/Mana/StaminarPointsUp (~3s cadence).
        scheduler.SetInterval(3000, RunPlayerVitalRegenTick);
        // Ground loot despawn: 15 minutes after drop (monster or player).
        scheduler.SetInterval(30_000, RunGroundItemExpiryTick);
        // Olympia hunger drain (DEF_HUNGERTIME = 60s; check every 15s).
        scheduler.SetInterval(15_000, RunPlayerHungerTick);
        scheduler.SetInterval(5000, () => AntiBotTools.TickWorld(gameWorldRef));
        scheduler.SetInterval(5000, () => AuctionBoard.TickWorld(gameWorldRef));
        scheduler.SetInterval(5000, () => HellMining.TickWorld(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
        scheduler.SetInterval(10_000, () => Referral.Tick(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()));
        // Play-mine session minutes (1-min heartbeat for daily report + activity settle).
        scheduler.SetInterval(60_000, RecordHellMiningSessionMinutes);
        // Mode 4 Survival: drip spawn + 60s wave timer (~1s cadence).
        scheduler.SetInterval(1000, () => TimedChallenge.TickWorld(gameWorldRef));
        incomingMessages = Channel.CreateBounded<GameWorldMessage>(new BoundedChannelOptions(incomingQueueSize) {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false,
        });
        gameWorldRef = new GameWorldRef {
            World = this,
            OccupancyTracker = occupancyTracker,
            Settings = settings,
            WorldId = id,
            Map = map,
            Music = music,
            TeleportLocs = this.teleportLocs,
            SpellsById = spellsById,
            ItemsById = itemsById,
            MonstersById = monstersById,
            NpcsById = npcsById,
            PlayerSpatialGrid = playerSpatialGrid,
            MonsterSpatialGrid = monsterSpatialGrid,
            NpcSpatialGrid = npcSpatialGrid,
            NpcsByNpcId = npcsByNpcId,
            NearbyNpcsByIdScratch = nearbyNpcsByIdScratch,
            NpcsPreviouslyInRangeScratch = npcsPreviouslyInRangeScratch,
            PlayerNpcVisibilityEnteredScratch = playerNpcVisibilityEnteredScratch,
            PlayerNpcVisibilityLeftNpcIdsScratch = playerNpcVisibilityLeftNpcIdsScratch,
            GroundStateTracker = groundStateTracker,
            IncomingReader = incomingMessages.Reader,
            Scheduler = scheduler,
            NearbyPlayersByIdScratch = nearbyPlayersByIdScratch,
            PlayersPreviouslyInRangeScratch = playersPreviouslyInRangeScratch,
            MonstersByMonsterId = monstersByMonsterId,
            NearbyMonstersByIdScratch = nearbyMonstersByIdScratch,
            MonstersPreviouslyInRangeScratch = monstersPreviouslyInRangeScratch,
            MonsterStepOldViewersScratch = monsterStepOldViewersScratch,
            MonsterStepNewViewersScratch = monsterStepNewViewersScratch,
            PlayerMonsterVisibilityEnteredScratch = playerMonsterVisibilityEnteredScratch,
            PlayerMonsterVisibilityLeftMonsterIdsScratch = playerMonsterVisibilityLeftMonsterIdsScratch,
            MovementNewNeighborsScratch = movementNewNeighborsScratch,
            MovementLeftNeighborIdsScratch = movementLeftNeighborIdsScratch,
            SpellAffectedCellsScratch = spellAffectedCellsScratch,
            NearbyGroundEffectsByIdScratch = nearbyGroundEffectsByIdScratch,
            GroundEffectsPreviouslyInRangeScratch = groundEffectsPreviouslyInRangeScratch,
            GroundEffectsEnteredScratch = groundEffectsEnteredScratch,
            GroundEffectsLeftScratch = groundEffectsLeftScratch,
            GroundEffectsViewersScratch = groundEffectsViewersScratch,
            NearbyGroundItemsByIdScratch = nearbyGroundItemsByIdScratch,
            GroundItemsPreviouslyInRangeScratch = groundItemsPreviouslyInRangeScratch,
            GroundItemsEnteredScratch = groundItemsEnteredScratch,
            GroundItemsLeftScratch = groundItemsLeftScratch,
            GroundItemsViewersScratch = groundItemsViewersScratch,
            GroundStatesEnteredByCellScratch = groundStatesEnteredByCellScratch,
            GroundStatesLeftByCellScratch = groundStatesLeftByCellScratch,
        };

        SpawnConfiguredNpcs(initialNpcs);
        if (dwellAreas is not null && dwellAreas.Count > 0) {
            SpawnDwellAreaMonsters(dwellAreas, monstersById);
        }

        // Nemesis-style color dragons: 1 every 4h UTC, daily-shuffled for timezone fairness.
        MiddlelandDragonRotation.Start(gameWorldRef);
    }

    /// <summary>Last Middleland dragon rotation spawn (day key + slot); prevents re-spawn after kill in the same 4h window.</summary>
    string? dragonRotationSpawnDay;
    int dragonRotationSpawnSlot = -1;
    int dragonRotationSpawnCatalogId;
    long dragonRotationSpawnMonsterId;

    public bool TryGetDragonRotationSpawnedSlot(out string dayKey, out int slot) {
        dayKey = dragonRotationSpawnDay ?? string.Empty;
        slot = dragonRotationSpawnSlot;
        return dragonRotationSpawnDay is not null && dragonRotationSpawnSlot >= 0;
    }

    public void MarkDragonRotationSpawned(string dayKey, int slot, int catalogId, long monsterId) {
        dragonRotationSpawnDay = dayKey;
        dragonRotationSpawnSlot = slot;
        dragonRotationSpawnCatalogId = catalogId;
        dragonRotationSpawnMonsterId = monsterId;
    }

    /// <summary>True when any living (non-dead) monster matches one of the catalog ids.</summary>
    public bool TryFindLivingMonsterByCatalogIds(ReadOnlySpan<int> catalogIds, out string name, out long monsterId) {
        name = string.Empty;
        monsterId = 0;
        foreach (var monster in monstersByMonsterId.Values) {
            if (monster.Dead) {
                continue;
            }
            foreach (var catalogId in catalogIds) {
                if (monster.CatalogMonsterId == catalogId) {
                    name = monster.Name;
                    monsterId = monster.MonsterId;
                    return true;
                }
            }
        }
        return false;
    }

    /// <summary>
    /// Spawns one non-dwell catalog monster near a random pad (search radius 12). Used by Middleland dragon rotation.
    /// </summary>
    public bool TrySpawnCatalogMonsterAtPads(
        int catalogMonsterId,
        ReadOnlySpan<(int X, int Y)> pads,
        out long monsterId,
        out string name,
        out int spawnX,
        out int spawnY) {
        monsterId = 0;
        name = string.Empty;
        spawnX = 0;
        spawnY = 0;
        if (!monstersById.TryGetValue(catalogMonsterId, out var template)) {
            Console.WriteLine($"[GameWorld:{id}] TrySpawnCatalogMonsterAtPads: unknown catalog id {catalogMonsterId}.");
            return false;
        }

        if (pads.Length == 0) {
            return false;
        }

        // Shuffle pad order so location varies.
        var order = new int[pads.Length];
        for (var i = 0; i < order.Length; i++) {
            order[i] = i;
        }
        for (var i = order.Length - 1; i > 0; i--) {
            var j = monsterAiRandom.Next(i + 1);
            (order[i], order[j]) = (order[j], order[i]);
        }

        var movementSpeedMs = template.MovementSpeed > 0 ? template.MovementSpeed : (template.MovementSpeed == 0 ? 0 : 220);
        const int searchRadius = 14;
        foreach (var padIndex in order) {
            var (px, py) = pads[padIndex];
            var freeCell = Location.FindNearestFreeLocation(
                (x, y) => occupancyTracker.IsFreeAndNotTeleportCell(x, y),
                px,
                py,
                searchRadius);
            if (!freeCell.HasValue) {
                continue;
            }

            var maxX = Math.Max(0, occupancyTracker.SizeX - 1);
            var maxY = Math.Max(0, occupancyTracker.SizeY - 1);
            var dwell = new MonsterDwellArea(0, 0, maxX, maxY);
            if (!TrySpawnMonster(
                    template,
                    freeCell.Value.X,
                    freeCell.Value.Y,
                    movementSpeedMs,
                    dwell,
                    hasDwellArea: false,
                    initialFacingDirection: 4,
                    attackTypeOverride: null,
                    allegianceOverride: null,
                    stunDurationMsOverride: null,
                    maxHpOverride: null,
                    attackDamageOverride: null,
                    attackSpeedMsOverride: null,
                    attackRecoveryMsOverride: null,
                    chaseMaxDistanceCellsOverride: null,
                    attackRangeCellsOverride: null,
                    out var spawned) ||
                spawned is null) {
                continue;
            }

            monsterId = spawned.MonsterId;
            name = spawned.Name;
            spawnX = spawned.PosX;
            spawnY = spawned.PosY;
            return true;
        }

        return false;
    }

    /// <summary>Promise Land Dungeons coal/crystal nodes (and any map that defines <c>miningNodes</c>).</summary>
    public IReadOnlyList<GameWorldMiningNodeConfig> MiningNodes => miningNodes;

    public bool TryGetMonsterByMonsterId(long monsterId, out GameWorldMonster monster) {
        return monstersByMonsterId.TryGetValue(monsterId, out monster!);
    }

    /// <summary>Removes a corpse after decay (tile was freed when the monster died): drops spatial index, notifies viewers with <see cref="MonstersLeftRange"/>; dwell spawns schedule a respawn after <see cref="MonsterDefaultsConfig.RespawnTime"/> defaults or catalog <c>respawnTime</c>.</summary>
    public void RemoveMonster(GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);
        if (!monstersByMonsterId.TryGetValue(monster.MonsterId, out var existing) || !ReferenceEquals(existing, monster)) {
            return;
        }

        TimedChallenge.OnMonsterRemoved(gameWorldRef, monster);

        var scheduleDwellRespawn = monster.HasDwellArea;
        var respawnCatalogId = monster.CatalogMonsterId;
        var respawnDwell = monster.DwellArea;
        var respawnDelayMs = settings.MonsterDefaults.RespawnTime;
        if (monstersById.TryGetValue(respawnCatalogId, out var respawnTemplate)) {
            respawnDelayMs = respawnTemplate.RespawnTime ?? settings.MonsterDefaults.RespawnTime;
        }

        var monstersLeftRangeMessage = NetworkManager.CreateMonstersLeftRange(monster.MonsterId);
        foreach (var playerId in monster.PlayersInRange) {
            if (!TryGetConnectedPlayerById(playerId, out var viewer) || viewer.Disconnected) {
                continue;
            }

            viewer.RemoveMonsterInRange(monster.MonsterId);
            NetworkManager.SendToPlayer(viewer, monstersLeftRangeMessage);
        }

        monster.ClearPlayersInRange();
        monsterSpatialGrid.Remove(monster);
        monstersByMonsterId.Remove(monster.MonsterId);

        if (scheduleDwellRespawn) {
            scheduler.SetTimeout(respawnDelayMs, () => TryRespawnDwellMonster(respawnCatalogId, respawnDwell));
        }
    }

    /// <summary>
    /// Immediately removes a living or dead monster from the map (frees the cell if still occupied).
    /// Used by Training Arena re-apply / leave — never schedules dwell respawn for non-dwell summons.
    /// </summary>
    public void DespawnMonsterImmediate(GameWorldMonster monster) {
        ArgumentNullException.ThrowIfNull(monster);
        if (!monster.Dead) {
            occupancyTracker.SetFree(monster.PosX, monster.PosY);
        }

        RemoveMonster(monster);
    }

    /// <summary>
    /// Spawns one catalog monster on a free cell near the player without dwell respawn (Training Arena / summon style).
    /// Returns false when the catalog id is unknown or no free cell is found within <paramref name="searchRadius"/>.
    /// When <paramref name="minDistanceFromPlayer"/> &gt; 0, skips the player's cell and any cell closer than that Chebyshev distance
    /// (PVP Skills waves must not stack into an impossible melee box on the player).
    /// </summary>
    public bool TrySpawnCatalogMonsterNearPlayer(
        GameWorldPlayer player,
        int catalogMonsterId,
        int searchRadius,
        out long monsterId,
        MonsterAllegiance? allegianceOverride = null,
        int? movementSpeedMsOverride = null,
        int? maxHpOverride = null,
        int? attackDamageOverride = null,
        int? chaseMaxDistanceCellsOverride = null,
        int minDistanceFromPlayer = 0,
        int? preferredOffsetX = null,
        int? preferredOffsetY = null) {
        ArgumentNullException.ThrowIfNull(player);
        monsterId = 0;
        if (!monstersById.TryGetValue(catalogMonsterId, out var template)) {
            Console.WriteLine($"[GameWorld:{id}] TrySpawnCatalogMonsterNearPlayer: unknown catalog id {catalogMonsterId}.");
            return false;
        }

        var radius = Math.Max(1, searchRadius);
        var minDist = Math.Max(0, minDistanceFromPlayer);
        var searchX = player.PosX + (preferredOffsetX ?? 0);
        var searchY = player.PosY + (preferredOffsetY ?? 0);
        var freeCell = Location.FindNearestFreeLocation(
            (x, y) => {
                if (!occupancyTracker.IsFreeAndNotTeleportCell(x, y)) {
                    return false;
                }
                if (minDist <= 0) {
                    return true;
                }
                return Location.GetDistance(player.PosX, player.PosY, x, y) >= minDist;
            },
            searchX,
            searchY,
            radius);
        if (!freeCell.HasValue) {
            return false;
        }

        var maxX = Math.Max(0, occupancyTracker.SizeX - 1);
        var maxY = Math.Max(0, occupancyTracker.SizeY - 1);
        var dwell = new MonsterDwellArea(0, 0, maxX, maxY);
        var catalogSpeed = template.MovementSpeed > 0 ? template.MovementSpeed : (template.MovementSpeed == 0 ? 0 : 220);
        var movementSpeedMs = movementSpeedMsOverride ?? catalogSpeed;
        if (!TrySpawnMonster(
                template,
                freeCell.Value.X,
                freeCell.Value.Y,
                movementSpeedMs,
                dwell,
                hasDwellArea: false,
                initialFacingDirection: 4,
                attackTypeOverride: null,
                allegianceOverride: allegianceOverride,
                stunDurationMsOverride: null,
                maxHpOverride: maxHpOverride,
                attackDamageOverride: attackDamageOverride,
                attackSpeedMsOverride: null,
                attackRecoveryMsOverride: null,
                chaseMaxDistanceCellsOverride: chaseMaxDistanceCellsOverride,
                attackRangeCellsOverride: null,
                out var spawned) ||
            spawned is null) {
            return false;
        }

        monsterId = spawned.MonsterId;
        return true;
    }

    /// <summary>Spawns one instance of a catalog monster inside <paramref name="dwell"/> after a dwell instance was removed (summons never call this).</summary>
    private void TryRespawnDwellMonster(int catalogMonsterId, MonsterDwellArea dwell) {
        if (!monstersById.TryGetValue(catalogMonsterId, out var template)) {
            Console.WriteLine($"[GameWorld:{id}] Monster respawn: catalog id {catalogMonsterId} is not defined.");
            return;
        }

        var movementSpeedMs = template.MovementSpeed > 0 ? template.MovementSpeed : (template.MovementSpeed == 0 ? 0 : 220);
        if (!TryFindFreeCellInDwell(dwell, monsterAiRandom, out var sx, out var sy)) {
            Console.WriteLine($"[GameWorld:{id}] Monster respawn: no free cell in dwell for catalog id {catalogMonsterId}.");
            return;
        }

        if (!TrySpawnMonster(template, sx, sy, movementSpeedMs, dwell, hasDwellArea: true, initialFacingDirection: 4, attackTypeOverride: null, allegianceOverride: null, stunDurationMsOverride: null, maxHpOverride: null, attackDamageOverride: null, attackSpeedMsOverride: null, attackRecoveryMsOverride: null, chaseMaxDistanceCellsOverride: null, attackRangeCellsOverride: null, out _)) {
            Console.WriteLine($"[GameWorld:{id}] Monster respawn: failed to occupy cell ({sx},{sy}) for catalog id {catalogMonsterId}.");
        }
    }

    /// <summary>Removes the player from every monster's visibility set and clears the player's monster and NPC range sets. Call before <see cref="GameWorldPlayer.DetachConnection"/> or world removal.</summary>
    private void UnlinkPlayerFromAllMonstersVisibility(GameWorldPlayer player) {
        foreach (var monsterId in player.MonstersInRange) {
            if (monstersByMonsterId.TryGetValue(monsterId, out var monster)) {
                monster.RemovePlayerInRange(player.PlayerId);
            }
        }

        player.ClearMonstersInRange();
        player.ClearNpcsInRange();
    }

    public int ConnectedPlayerCount => playersBySessionId.Count;
    public int WorkerThreadId => worker?.ManagedThreadId ?? throw new InvalidOperationException($"Game world '{id}' is not yet attached to a worker.");
    public bool RequiresPeriodicUpdate => true;

    /// <summary>Posts a message to the world's single-reader channel and wakes the worker if needed.</summary>
    public ValueTask EnqueueAsync(GameWorldMessage message, CancellationToken cancellationToken = default) {
        ArgumentNullException.ThrowIfNull(message);
        if (worker is null) {
            throw new InvalidOperationException($"Game world '{id}' must be registered to a worker before it can receive messages.");
        }

        if (incomingMessages.Writer.TryWrite(message)) {
            worker.Schedule(this);
            return ValueTask.CompletedTask;
        }

        return EnqueueSlowAsync(message, cancellationToken);
    }

    public void AttachToWorker(WorldWorker value) {
        ArgumentNullException.ThrowIfNull(value);
        if (worker is not null) {
            throw new InvalidOperationException($"Game world '{id}' is already attached to worker '{worker.Name}'.");
        }

        worker = value;
    }

    /// <summary>Returns true if this thread should enqueue the world onto the worker (first schedule wins).</summary>
    public bool TryMarkScheduled() {
        return Interlocked.Exchange(ref isScheduled, 1) == 0;
    }

    /// <summary>Drains up to the configured max messages per dispatch and re-schedules if the mailbox still has work.</summary>
    public void ProcessPendingMessages() {
        Volatile.Write(ref isScheduled, 0);

        var processedMessages = 0;
        while (processedMessages < maxMessagesPerDispatch &&
               incomingMessages.Reader.TryRead(out var message)) {
            HandleMessage(message);
            processedMessages++;
        }

        if (incomingMessages.Reader.TryPeek(out _)) {
            worker!.Schedule(this);
        }
    }

    /// <summary>World tick hook: scheduler jobs and monster AI run once per worker tick (<see cref="WorldWorker"/>).</summary>
    public void Update(TimeSpan _) {
        try {
            OnWorldTick();
        } catch (Exception ex) {
            Console.Error.WriteLine($"[GameWorld:{id}] Error during world tick: {ex}");
        }
    }

    /// <summary>Async wait when the bounded mailbox is full (backpressure).</summary>
    private async ValueTask EnqueueSlowAsync(GameWorldMessage message, CancellationToken cancellationToken) {
        await incomingMessages.Writer.WriteAsync(message, cancellationToken);
        worker!.Schedule(this);
    }

    /// <summary>Dispatches one mailbox item to the appropriate handler; logs and continues on handler exceptions.</summary>
    private void HandleMessage(GameWorldMessage message) {
        try {
            switch (message) {
                case PlayerConnectedMessage connectedMessage:
                    HandlePlayerConnected(connectedMessage);
                    break;
                case PlayerReconnectedMessage reconnectedMessage:
                    HandlePlayerReconnected(reconnectedMessage);
                    break;
                case PlayerDisconnectedMessage disconnectedMessage:
                    HandlePlayerDisconnected(disconnectedMessage);
                    break;
                case RemoveDisconnectedPlayerMessage removeDisconnectedPlayerMessage:
                    HandleRemoveDisconnectedPlayer(removeDisconnectedPlayerMessage);
                    break;
                case SavePlayerStateRequestMessage savePlayerStateRequestMessage:
                    HandleSavePlayerStateRequest(savePlayerStateRequestMessage);
                    break;
                case TransferPlayerOutMessage transferPlayerOutMessage:
                    HandleTransferPlayerOut(transferPlayerOutMessage);
                    break;
                case TransferPlayerInMessage transferPlayerInMessage:
                    HandleTransferPlayerIn(transferPlayerInMessage);
                    break;
                case ClientPacketMessage packetMessage:
                    HandleClientPacket(packetMessage);
                    break;
                default:
                    throw new InvalidOperationException($"Unhandled message type '{message.GetType().Name}' in world '{id}'.");
            }
        } catch (Exception ex) {
            Console.WriteLine($"[GameWorld:{id}] Error handling message type '{message.GetType().Name}': {ex}");
        }
    }

    /// <summary>Creates the in-world entity and runs the standard join flow (spawn, visibility, protection).</summary>
    private void HandlePlayerConnected(PlayerConnectedMessage connectedMessage) {
        var player = CreatePlayer(
            connectedMessage.SessionId,
            connectedMessage.SendMessage,
            connectedMessage.RequestDisconnect,
            connectedMessage.RequestWorldChange,
            connectedMessage.InterruptLogoutDueToCombat,
            connectedMessage.PersistedState?.X,
            connectedMessage.PersistedState?.Y);
        player.SetCharacterName(connectedMessage.CharacterName);
        player.SetAccountWallet(connectedMessage.AccountWallet);
        if (!string.IsNullOrWhiteSpace(connectedMessage.ArenaKitJson)) {
            player.SetArenaKitJson(connectedMessage.ArenaKitJson);
        }
        if (connectedMessage.PersistedState is not null) {
            player.ApplyPersistedState(connectedMessage.PersistedState);
            if (connectedMessage.TravelerMode) {
                if (PlaytestMode.AllowsSandboxSelfEdit(connectedMessage.AccountWallet)) {
                    player.SetTravelerMode(true);
                } else {
                    player.ApplyTravelerModeConstraints();
                }
            }
        } else {
            // Brand-new character: soft starter (never GM OP kit), desk slot, optional create appearance.
            player.SetSlotIndex(connectedMessage.SlotIndex);
            player.ApplyTravelerNewCharacterDefaults();
            if (connectedMessage.TravelerMode) {
                player.SetTravelerMode(true);
            }
            if (connectedMessage.Gender is int gender) {
                player.SetAppearance(
                    gender,
                    connectedMessage.SkinColor ?? 0,
                    connectedMessage.HairStyleIndex ?? 0,
                    connectedMessage.UnderwearColorIndex ?? 0);
            }
            player.TryApplyCreateCharacterStats(
                connectedMessage.Str,
                connectedMessage.Vit,
                connectedMessage.Dex,
                connectedMessage.Int,
                connectedMessage.Mag,
                connectedMessage.Chr);
        }
        ApplyTournamentEntry(player, connectedMessage.PersistedState);
        player.SetLastKnownIp(connectedMessage.RemoteIp);
        if (string.IsNullOrWhiteSpace(player.CitizenshipSide)) {
            player.SetCitizenshipSide(CityNpcServices.ResolveCitizenshipSidePublic(id));
        }
        OnlinePlayerDirectory.Register(player);
        Console.WriteLine($"[GameWorld:{id}] Player connected. Players on world: {playersBySessionId.Count}");
        Spawn.CompletePlayerJoin(gameWorldRef, player, includeSpellsInInitialState: true);
        Referral.OnPlayerEnteredWorld(gameWorldRef, player, connectedMessage.ReferralCode);
        ArenaPact.OnPlayerJoined(player);
    }

    /// <summary>Rebinds send/disconnect callbacks, sends self state, and notifies nearby players of reconnection visibility.</summary>
    private void HandlePlayerReconnected(PlayerReconnectedMessage reconnectedMessage) {
        if (!playersBySessionId.TryGetValue(reconnectedMessage.SessionId, out var reconnectedPlayer)) {
            Console.WriteLine($"[GameWorld:{id}] Received reconnect for unknown session '{reconnectedMessage.SessionId}'.");
            return;
        }

        reconnectedPlayer.SetCharacterName(reconnectedMessage.CharacterName);
        reconnectedPlayer.SetAccountWallet(reconnectedMessage.AccountWallet);
        reconnectedPlayer.SetLastKnownIp(reconnectedMessage.RemoteIp);
        reconnectedPlayer.AttachConnection(reconnectedMessage.SendMessage, reconnectedMessage.RequestDisconnect);
        OnlinePlayerDirectory.Register(reconnectedPlayer);
        // Traveler: always re-anchor to inland dry hub on reconnect (never resume coastal/wet saves).
        ForceTravelerToHub(reconnectedPlayer, reason: "reconnect");
        Spawn.SendInitialState(gameWorldRef, reconnectedPlayer, includeSpells: true);
        Spawn.SendInitialGameWorldState(gameWorldRef, reconnectedPlayer);
        ArenaPact.OnPlayerJoined(reconnectedPlayer);

        Movement.FillNearbyPlayersById(
            playerSpatialGrid,
            reconnectedPlayer.PosX,
            reconnectedPlayer.PosY,
            reconnectedPlayer.SessionId,
            nearbyPlayersByIdScratch);
        var nearbyPlayers = nearbyPlayersByIdScratch;
        var playerReconnectedMessage = NetworkManager.CreatePlayerReconnected(reconnectedPlayer.PlayerId);
        Movement.SendPlayersSnapshotsBulk(reconnectedPlayer, nearbyPlayers.Values);
        foreach (var nearbyPlayer in nearbyPlayers.Values) {
            if (!nearbyPlayer.Disconnected) {
                NetworkManager.SendToPlayer(nearbyPlayer, playerReconnectedMessage);
            }
        }

        reconnectedPlayer.ReplacePlayersInRange(nearbyPlayers.Keys);
        MonsterVisibility.SendMonstersInRangeOnPlayerJoin(gameWorldRef, reconnectedPlayer);
        Npc.SendNpcsInRangeOnPlayerJoin(gameWorldRef, reconnectedPlayer);
        GroundStateVisibility.SendGroundStatesInRangeOnPlayerJoin(gameWorldRef, reconnectedPlayer);
        // Mobile auction purchases waiting at delivery desk → bag.
        MarketSideDoor.TryDeliverDeskClaims(gameWorldRef, reconnectedPlayer);
        Console.WriteLine($"[GameWorld:{id}] Player reconnected. Players on world: {playersBySessionId.Count}");
    }

    /// <summary>Detaches the socket; if the session remains in grace, broadcasts disconnected state to viewers in range.</summary>
    private void HandlePlayerDisconnected(PlayerDisconnectedMessage disconnectedMessage) {
        if (playersBySessionId.TryGetValue(disconnectedMessage.SessionId, out var disconnectedPlayer)) {
            disconnectedPlayer.DetachConnection();
            if (disconnectedMessage.SessionRemainsActive) {
                var playerDisconnectedMessage = NetworkManager.CreatePlayerDisconnected(disconnectedPlayer.PlayerId);
                foreach (var nearbyPlayer in playerSpatialGrid.GetNearbyPlayers(disconnectedPlayer.PosX, disconnectedPlayer.PosY, disconnectedPlayer.SessionId)) {
                    NetworkManager.SendToPlayer(nearbyPlayer, playerDisconnectedMessage);
                }
            } else {
                UnlinkPlayerFromAllMonstersVisibility(disconnectedPlayer);
            }
        }
        Console.WriteLine($"[GameWorld:{id}] Player disconnected. Players on world: {playersBySessionId.Count}");
    }

    /// <summary>Final removal after grace: notifies range, frees the cell, and drops player from maps and grid.</summary>
    private void HandleRemoveDisconnectedPlayer(RemoveDisconnectedPlayerMessage removeDisconnectedPlayerMessage) {
        if (!playersBySessionId.TryGetValue(removeDisconnectedPlayerMessage.SessionId, out var disconnectedPlayer)) {
            return;
        }
        if (!disconnectedPlayer.Disconnected) {
            return;
        }

        UnlinkPlayerFromAllMonstersVisibility(disconnectedPlayer);

        Party.OnPlayerRemoved(disconnectedPlayer);
        ArenaPact.OnPlayerLeft(disconnectedPlayer);
        StreamDirectory.OnPlayerLeft(disconnectedPlayer);
        OnlinePlayerDirectory.Unregister(disconnectedPlayer);

        if (TrainingArena.IsTrainingWorld(id)) {
            TrainingArena.DespawnPlayerTrainingDummies(gameWorldRef, disconnectedPlayer);
        }
        TimedChallenge.OnPlayerLeaveWorld(gameWorldRef, disconnectedPlayer);

        var removedLeftMessage = NetworkManager.CreatePlayersLeftRange(disconnectedPlayer.PlayerId);
        foreach (var nearbyPlayer in playerSpatialGrid.GetNearbyPlayers(disconnectedPlayer.PosX, disconnectedPlayer.PosY, disconnectedPlayer.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, removedLeftMessage);
            nearbyPlayer.RemovePlayerInRange(disconnectedPlayer.PlayerId);
        }

        occupancyTracker.SetFree(disconnectedPlayer.PosX, disconnectedPlayer.PosY);
        playerSpatialGrid.Remove(disconnectedPlayer);
        playersMap.Remove(disconnectedPlayer.PlayerId);
        playersBySessionId.Remove(removeDisconnectedPlayerMessage.SessionId);
        Console.WriteLine($"[GameWorld:{id}] Removed disconnected player after grace period. Players on world: {playersBySessionId.Count}");
    }

    /// <summary>Strips the player from this world and completes <see cref="TransferPlayerOutMessage.Completion"/> with state for the target world.</summary>
    private void HandleTransferPlayerOut(TransferPlayerOutMessage transferPlayerOutMessage) {
        if (!playersBySessionId.TryGetValue(transferPlayerOutMessage.SessionId, out var player)) {
            transferPlayerOutMessage.Completion.TrySetResult(null);
            return;
        }

        UnlinkPlayerFromAllMonstersVisibility(player);

        OnlinePlayerDirectory.Unregister(player);

        if (TrainingArena.IsTrainingWorld(id)) {
            TrainingArena.DespawnPlayerTrainingDummies(gameWorldRef, player);
        }
        TimedChallenge.OnPlayerLeaveWorld(gameWorldRef, player);

        var transferredLeftMessage = NetworkManager.CreatePlayersLeftRange(player.PlayerId);
        foreach (var nearbyPlayer in playerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, transferredLeftMessage);
            nearbyPlayer.RemovePlayerInRange(player.PlayerId);
        }

        occupancyTracker.SetFree(player.PosX, player.PosY);
        playerSpatialGrid.Remove(player);
        playersMap.Remove(player.PlayerId);
        playersBySessionId.Remove(transferPlayerOutMessage.SessionId);
        player.DetachConnection();
        transferPlayerOutMessage.Completion.TrySetResult(
            new TransferredPlayerState(
                transferPlayerOutMessage.SessionId,
                player.CreatePersistenceState(id),
                player.TravelerMode,
                player.AccountWallet,
                player.LastKnownIp,
                player.ArenaKitJson));
        Console.WriteLine($"[GameWorld:{id}] Player transferred to world '{transferPlayerOutMessage.TargetWorldId}'. Players on world: {playersBySessionId.Count}");
    }

    /// <summary>Creates a fresh in-world player from transfer state and runs the same join path as a new connection.</summary>
    private void HandleTransferPlayerIn(TransferPlayerInMessage transferPlayerInMessage) {
        var player = CreatePlayer(
            transferPlayerInMessage.Player.SessionId,
            transferPlayerInMessage.SendMessage,
            transferPlayerInMessage.RequestDisconnect,
            transferPlayerInMessage.RequestWorldChange,
            transferPlayerInMessage.InterruptLogoutDueToCombat,
            transferPlayerInMessage.SpawnX,
            transferPlayerInMessage.SpawnY);
        player.ApplyPersistedState(transferPlayerInMessage.Player.State);
        if (!string.IsNullOrWhiteSpace(transferPlayerInMessage.Player.AccountWallet)) {
            player.SetAccountWallet(transferPlayerInMessage.Player.AccountWallet);
        }
        if (!string.IsNullOrWhiteSpace(transferPlayerInMessage.Player.ArenaKitJson)) {
            player.SetArenaKitJson(transferPlayerInMessage.Player.ArenaKitJson);
        }
        player.SetLastKnownIp(transferPlayerInMessage.Player.RemoteIp);
        // Citizenship papers are sticky: never flip aresden↔elvine just because the player walked
        // into the other city's map/farm (enemy visit / wrong pad). First claim only when still traveler.
        var worldSide = CityNpcServices.ResolveCitizenshipSidePublic(id);
        var papers = (player.CitizenshipSide ?? string.Empty).Trim().ToLowerInvariant();
        if (papers is "aresden" or "elvine") {
            // Keep existing city papers — do not overwrite from map id.
        } else if (worldSide is "aresden" or "elvine") {
            // Traveler first city seal (Traveler Zone pad → city).
            player.SetCitizenshipSide(worldSide);
            Console.WriteLine(
                $"[GameWorld:{id}] Citizenship first-claim → {worldSide} for {player.CharacterName} (was '{papers}').");
        } else if (string.IsNullOrWhiteSpace(papers) || papers is "traveler" or "neutral" or "unknown") {
            if (!string.IsNullOrWhiteSpace(worldSide) && worldSide is not "unknown") {
                player.SetCitizenshipSide(worldSide);
            }
        }
        if (transferPlayerInMessage.Player.TravelerMode) {
            if (PlaytestMode.AllowsSandboxSelfEdit(player.AccountWallet)) {
                player.SetTravelerMode(true);
            } else {
                // CreatePlayer seeds GM HP (1000); keep traveler soft pools without wiping city-transfer inventory.
                player.RestoreTravelerCombatPools();
            }
        }
        ApplyTournamentEntry(player, transferPlayerInMessage.Player.State);
        OnlinePlayerDirectory.Register(player);
        Console.WriteLine($"[GameWorld:{id}] Player transferred in. Players on world: {playersBySessionId.Count}");
        // Arena must resync full spell directory (empty InitialState wipes client VFX table → Blizzard invisible).
        // Travelers also need learned unlocks re-pushed after map change.
        var includeSpells = player.InTournamentArena
            || player.TravelerMode
            || PlaytestMode.AllowsSandboxSelfEdit(player.AccountWallet);
        Spawn.CompletePlayerJoin(gameWorldRef, player, includeSpellsInInitialState: includeSpells);
    }

    /// <summary>Returns the player's latest authoritative snapshot for immediate persistence in <c>Server.cs</c>.</summary>
    private void HandleSavePlayerStateRequest(SavePlayerStateRequestMessage savePlayerStateRequestMessage) {
        if (!playersBySessionId.TryGetValue(savePlayerStateRequestMessage.SessionId, out var player)) {
            savePlayerStateRequestMessage.Completion.TrySetResult(null);
            return;
        }

        savePlayerStateRequestMessage.Completion.TrySetResult(player.CreatePersistenceState(id));
    }

    /// <summary>Routes deserialized client payloads to movement, combat, ping, world change, or admin occupancy requests.</summary>
    private void HandleClientPacket(ClientPacketMessage message) {
        if (!playersBySessionId.TryGetValue(message.SessionId, out var playerConnection)) {
            Console.WriteLine($"[GameWorld:{id}] Received packet for unknown session '{message.SessionId}'.");
            return;
        }

        switch (message.Message.PayloadCase) {
            case ClientMessage.PayloadOneofCase.PingRequest:
                HandlePingRequest(playerConnection, message.Message.PingRequest);
                break;
            case ClientMessage.PayloadOneofCase.RequestMovement:
                if (!IsRequestForCurrentWorld(message.Message.RequestMovement.GameWorldId)) {
                    break;
                }
                Movement.HandleRequestMovement(gameWorldRef, playerConnection, message.Message.RequestMovement);
                break;
            case ClientMessage.PayloadOneofCase.MakeServerCellOccupiedRequest: {
                    if (AdminSecurity.RejectIfNotGm(playerConnection, "MakeServerCellOccupied")) {
                        break;
                    }
                    var occ = message.Message.MakeServerCellOccupiedRequest;
                    Movement.HandleMakeServerCellOccupiedRequest(gameWorldRef, occ.X, occ.Y, id);
                    break;
                }
            case ClientMessage.PayloadOneofCase.PlayerTeleportRequested:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "PlayerTeleport")) {
                    break;
                }
                Movement.HandlePlayerTeleportRequested(gameWorldRef, playerConnection, message.Message.PlayerTeleportRequested, id);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerMovementSpeedRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeMovementSpeed")) {
                    break;
                }
                Movement.HandleChangePlayerMovementSpeed(gameWorldRef, playerConnection, message.Message.ChangePlayerMovementSpeedRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAttackStunDurationRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAttackStunDuration")) {
                    break;
                }
                HandleChangePlayerAttackStunDuration(playerConnection, message.Message.ChangePlayerAttackStunDurationRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAttackSpeedRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAttackSpeed")) {
                    break;
                }
                HandleChangePlayerAttackSpeed(playerConnection, message.Message.ChangePlayerAttackSpeedRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerCastSpeedRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeCastSpeed")) {
                    break;
                }
                HandleChangePlayerCastSpeed(playerConnection, message.Message.ChangePlayerCastSpeedRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAttackTypeRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAttackType")) {
                    break;
                }
                HandleChangePlayerAttackType(playerConnection, message.Message.ChangePlayerAttackTypeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAllowDashAttackRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAllowDashAttack")) {
                    break;
                }
                HandleChangePlayerAllowDashAttack(playerConnection, message.Message.ChangePlayerAllowDashAttackRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAppearanceRequest:
                HandleChangePlayerAppearance(playerConnection, message.Message.ChangePlayerAppearanceRequest);
                break;
            case ClientMessage.PayloadOneofCase.CreateItemRequest:
                Inventory.HandleCreateItemRequest(gameWorldRef, playerConnection, message.Message.CreateItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.BuyShopItemRequest:
                Shop.HandleBuyShopItemRequest(gameWorldRef, playerConnection, message.Message.BuyShopItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.RepairItemRequest:
                Shop.HandleRepairItemRequest(gameWorldRef, playerConnection, message.Message.RepairItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.SellBagItemRequest:
                Shop.HandleSellBagItemRequest(gameWorldRef, playerConnection, message.Message.SellBagItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.OpenWarehouseRequest:
                Warehouse.HandleOpenWarehouseRequest(gameWorldRef, playerConnection, message.Message.OpenWarehouseRequest);
                break;
            case ClientMessage.PayloadOneofCase.WarehouseDepositRequest:
                Warehouse.HandleWarehouseDepositRequest(gameWorldRef, playerConnection, message.Message.WarehouseDepositRequest);
                break;
            case ClientMessage.PayloadOneofCase.WarehouseWithdrawRequest:
                Warehouse.HandleWarehouseWithdrawRequest(gameWorldRef, playerConnection, message.Message.WarehouseWithdrawRequest);
                break;
            case ClientMessage.PayloadOneofCase.MoveItemInBagRequest:
                Inventory.HandleMoveItemInBagRequest(gameWorldRef, playerConnection, message.Message.MoveItemInBagRequest);
                break;
            case ClientMessage.PayloadOneofCase.EquipItemRequest:
                Inventory.HandleEquipItemRequest(gameWorldRef, playerConnection, message.Message.EquipItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.UnequipItemRequest:
                Inventory.HandleUnequipItemRequest(gameWorldRef, playerConnection, message.Message.UnequipItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.ConsumeItemRequest:
                Inventory.HandleConsumeItemRequest(gameWorldRef, playerConnection, message.Message.ConsumeItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerItemDropRequested:
                HandlePlayerItemDropRequested(playerConnection, message.Message.PlayerItemDropRequested);
                break;
            case ClientMessage.PayloadOneofCase.ItemBindRequest:
                ItemBind.HandleRequest(gameWorldRef, playerConnection, message.Message.ItemBindRequest);
                break;
            case ClientMessage.PayloadOneofCase.BuyCashShopItemRequest:
                CashShop.HandleBuyRequest(gameWorldRef, playerConnection, message.Message.BuyCashShopItemRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerItemPickupRequested:
                HandlePlayerItemPickupRequested(playerConnection, message.Message.PlayerItemPickupRequested);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAttackRangeRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAttackRange")) {
                    break;
                }
                HandleChangePlayerAttackRange(playerConnection, message.Message.ChangePlayerAttackRangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerAttackDamageRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "ChangeAttackDamage")) {
                    break;
                }
                HandleChangePlayerAttackDamage(playerConnection, message.Message.ChangePlayerAttackDamageRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerMovementStateChangeRequest:
                Movement.HandlePlayerMovementStateChange(gameWorldRef, playerConnection, message.Message.PlayerMovementStateChangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerAttackModeChangeRequest:
                Movement.HandlePlayerAttackModeChange(gameWorldRef, playerConnection, message.Message.PlayerAttackModeChangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerSafeAttackModeChangeRequest:
                Movement.HandlePlayerSafeAttackModeChange(gameWorldRef, playerConnection, message.Message.PlayerSafeAttackModeChangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ChangePlayerIdleDirectionRequest:
                Movement.HandleChangePlayerIdleDirection(gameWorldRef, playerConnection, message.Message.ChangePlayerIdleDirectionRequest);
                break;
            case ClientMessage.PayloadOneofCase.WorldChangeRequest:
                HandleWorldChangeRequest(playerConnection, message.Message.WorldChangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.SummonMonsterRequested:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "SummonMonster")) {
                    break;
                }
                HandleSummonMonsterRequested(playerConnection, message.Message.SummonMonsterRequested);
                break;
            case ClientMessage.PayloadOneofCase.KillAllMonstersRequested:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "KillAllMonsters")) {
                    break;
                }
                Combat.HandleKillAllMonstersRequested(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.SummonNpcRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "SummonNpc")) {
                    break;
                }
                Npc.HandleSummonNpcRequest(gameWorldRef, id, playerConnection, message.Message.SummonNpcRequest);
                break;
            case ClientMessage.PayloadOneofCase.KillAllNpcsRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "KillAllNpcs")) {
                    break;
                }
                Npc.HandleKillAllNpcsRequest(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.PlayerAttackedMonsterRequest:
                Combat.HandlePlayerAttackedMonsterRequest(gameWorldRef, id, playerConnection, message.Message.PlayerAttackedMonsterRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerAttackedPlayerRequest:
                Combat.HandlePlayerAttackedPlayerRequest(gameWorldRef, id, playerConnection, message.Message.PlayerAttackedPlayerRequest);
                break;
            case ClientMessage.PayloadOneofCase.PlayerResurrectedRequest:
                HandlePlayerResurrectRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.PlayerPickupRequested:
                HandlePlayerPickupRequested(playerConnection, message.Message.PlayerPickupRequested);
                break;
            case ClientMessage.PayloadOneofCase.PlayerBowStanceRequested:
                HandlePlayerBowStanceRequested(playerConnection, message.Message.PlayerBowStanceRequested);
                break;
            case ClientMessage.PayloadOneofCase.SpellCastStartRequest:
                Casting.HandleSpellCastStartRequest(gameWorldRef, spellsById, playerConnection, message.Message.SpellCastStartRequest);
                break;
            case ClientMessage.PayloadOneofCase.SpellCastCancelRequest:
                Casting.HandleSpellCastCancelRequest(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.SpellCastRequest:
                Casting.HandleSpellCastRequest(gameWorldRef, id, spellsById, playerConnection, message.Message.SpellCastRequest);
                break;
            case ClientMessage.PayloadOneofCase.WeatherChangeRequest:
                if (AdminSecurity.RejectIfNotGm(playerConnection, "WeatherChange")) {
                    break;
                }
                HandleWeatherChangeRequest(playerConnection, message.Message.WeatherChangeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ClaimKillMilestoneRequest:
                Progression.HandleClaimKillMilestoneRequest(gameWorldRef, playerConnection, message.Message.ClaimKillMilestoneRequest);
                break;
            case ClientMessage.PayloadOneofCase.LevelUpSettingsRequest:
                Progression.HandleLevelUpSettingsRequest(gameWorldRef, playerConnection, message.Message.LevelUpSettingsRequest);
                break;
            case ClientMessage.PayloadOneofCase.RebirthRequest:
                Progression.HandleRebirthRequest(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.RebirthRollbackRequest:
                Progression.HandleRebirthRollbackRequest(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.SetLevelBlockRequest:
                Progression.HandleSetLevelBlockRequest(gameWorldRef, playerConnection, message.Message.SetLevelBlockRequest);
                break;
            case ClientMessage.PayloadOneofCase.MajesticUpgradeRequest:
                MajesticUpgrade.HandleMajesticUpgradeRequest(gameWorldRef, playerConnection, message.Message.MajesticUpgradeRequest);
                break;
            case ClientMessage.PayloadOneofCase.StoneItemUpgradeRequest:
                ItemStoneUpgrade.HandleRequest(gameWorldRef, playerConnection, message.Message.StoneItemUpgradeRequest);
                break;
            case ClientMessage.PayloadOneofCase.SkillGatherRequest:
                Skills.HandleGatherRequest(gameWorldRef, playerConnection, message.Message.SkillGatherRequest);
                break;
            case ClientMessage.PayloadOneofCase.GetSkillsStateRequest:
                Skills.HandleGetSkillsState(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.ItemDisenchantRequest:
                Enchanting.HandleDisenchant(gameWorldRef, playerConnection, message.Message.ItemDisenchantRequest.ItemUid);
                break;
            case ClientMessage.PayloadOneofCase.ItemEnchantRequest:
                Enchanting.HandleEnchantItem(
                    gameWorldRef,
                    playerConnection,
                    message.Message.ItemEnchantRequest.ItemUid,
                    message.Message.ItemEnchantRequest.Kind);
                break;
            case ClientMessage.PayloadOneofCase.EnchantMaterialUpgradeRequest: {
                var r = message.Message.EnchantMaterialUpgradeRequest;
                Enchanting.HandleUpgradeMaterial(playerConnection, r.Kind, r.Type, r.Level, r.Mode);
                break;
            }
            case ClientMessage.PayloadOneofCase.GetEnchantMaterialsRequest:
                Enchanting.SendMaterialsState(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.MajesticStatRespecRequest:
                Progression.HandleMajesticStatRespecRequest(gameWorldRef, playerConnection, message.Message.MajesticStatRespecRequest);
                break;
            case ClientMessage.PayloadOneofCase.CicItemMergeRequest:
                CicItemCraft.HandleMerge(gameWorldRef, playerConnection, message.Message.CicItemMergeRequest);
                break;
            case ClientMessage.PayloadOneofCase.SiphonGemUpgradeRequest:
                SiphonGems.HandleGemUpgrade(playerConnection, message.Message.SiphonGemUpgradeRequest.ItemUid);
                break;
            case ClientMessage.PayloadOneofCase.ActivateSpecialAbilityRequest:
                SpecialAbility.HandleActivateRequest(gameWorldRef, playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.SetSuperAttackArmedRequest:
                Progression.HandleSetSuperAttackArmed(
                    playerConnection,
                    message.Message.SetSuperAttackArmedRequest.Armed);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactCreateRequest:
                ArenaPact.HandleCreate(gameWorldRef, playerConnection, message.Message.ArenaPactCreateRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactInviteRequest:
                ArenaPact.HandleInvite(gameWorldRef, playerConnection, message.Message.ArenaPactInviteRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactRespondRequest:
                ArenaPact.HandleRespond(gameWorldRef, playerConnection, message.Message.ArenaPactRespondRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactReadyRequest:
                ArenaPact.HandleReady(gameWorldRef, playerConnection, message.Message.ArenaPactReadyRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactCancelRequest:
                ArenaPact.HandleCancel(gameWorldRef, playerConnection, message.Message.ArenaPactCancelRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactListRequest:
                ArenaPact.HandleList(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactTechProposeRequest:
                ArenaPact.HandleTechPropose(gameWorldRef, playerConnection, message.Message.ArenaPactTechProposeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactTechVoteRequest:
                ArenaPact.HandleTechVote(gameWorldRef, playerConnection, message.Message.ArenaPactTechVoteRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactTechReportRequest:
                ArenaPact.HandleTechReport(gameWorldRef, playerConnection, message.Message.ArenaPactTechReportRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactSetStreamRequest:
                ArenaPact.HandleSetStream(gameWorldRef, playerConnection, message.Message.ArenaPactSetStreamRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactPrizePledgeRequest:
                ArenaPact.HandlePrizePledge(playerConnection, message.Message.ArenaPactPrizePledgeRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactPrizeConfirmRequest:
                ArenaPact.HandlePrizeConfirm(playerConnection, message.Message.ArenaPactPrizeConfirmRequest);
                break;
            case ClientMessage.PayloadOneofCase.ArenaPactSignLossRequest:
                ArenaPact.HandleSignLoss(playerConnection, message.Message.ArenaPactSignLossRequest);
                break;
            case ClientMessage.PayloadOneofCase.StreamBroadcastRequest:
                StreamDirectory.HandleAnnounce(gameWorldRef, playerConnection, message.Message.StreamBroadcastRequest);
                break;
            case ClientMessage.PayloadOneofCase.BeginnerPathEnrollRequest:
                BeginnerPath.HandleEnrollRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.BeginnerPathAbandonRequest:
                BeginnerPath.HandleAbandonRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.BeginnerPathTalkRequest:
                BeginnerPath.HandleTalkRequest(playerConnection, message.Message.BeginnerPathTalkRequest);
                break;
            case ClientMessage.PayloadOneofCase.BeginnerPathUiActionRequest:
                BeginnerPath.HandleUiActionRequest(playerConnection, message.Message.BeginnerPathUiActionRequest);
                break;
            case ClientMessage.PayloadOneofCase.ApplyTrainingPresetRequest:
                TrainingArena.HandleApplyPresetRequest(gameWorldRef, playerConnection, message.Message.ApplyTrainingPresetRequest);
                break;
            case ClientMessage.PayloadOneofCase.StartTimedChallengeRequest:
                TimedChallenge.HandleStartRequest(gameWorldRef, playerConnection, message.Message.StartTimedChallengeRequest);
                break;
            case ClientMessage.PayloadOneofCase.AbortTimedChallengeRequest:
                TimedChallenge.HandleAbortRequest(gameWorldRef, playerConnection, message.Message.AbortTimedChallengeRequest);
                break;
            case ClientMessage.PayloadOneofCase.GetTimedChallengeLeaderboardRequest:
                TimedChallenge.HandleLeaderboardRequest(playerConnection, message.Message.GetTimedChallengeLeaderboardRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardBrowseRequest:
                AuctionBoard.HandleBrowseRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardBrowseRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardCreateRequest:
                AuctionBoard.HandleCreateRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardCreateRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardBidRequest:
                AuctionBoard.HandleBidRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardBidRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardBuyRequest:
                AuctionBoard.HandleBuyRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardBuyRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardCancelRequest:
                AuctionBoard.HandleCancelRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardCancelRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuctionBoardSettleDebtRequest:
                AuctionBoard.HandleSettleDebtRequest(gameWorldRef, playerConnection, message.Message.AuctionBoardSettleDebtRequest);
                break;
            case ClientMessage.PayloadOneofCase.HellMiningStatusRequest:
                HellMining.HandleStatusRequest(playerConnection, message.Message.HellMiningStatusRequest);
                break;
            case ClientMessage.PayloadOneofCase.HellMiningClaimRequest:
                HellMining.HandleClaimRequest(playerConnection, message.Message.HellMiningClaimRequest);
                break;
            case ClientMessage.PayloadOneofCase.CreatePartyRequest:
                Party.HandleCreateRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.JoinPartyRequest:
                Party.HandleJoinRequest(playerConnection, message.Message.JoinPartyRequest);
                break;
            case ClientMessage.PayloadOneofCase.LeavePartyRequest:
                Party.HandleLeaveRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.CityNpcServiceRequest:
                CityNpcServices.HandleCityNpcServiceRequest(
                    gameWorldRef,
                    playerConnection,
                    message.Message.CityNpcServiceRequest);
                break;
            case ClientMessage.PayloadOneofCase.GetAntiBotToolsRequest:
                AntiBotTools.HandleGetRequest(playerConnection);
                break;
            case ClientMessage.PayloadOneofCase.SetAntiBotToolsRequest:
                AntiBotTools.HandleSetRequest(playerConnection, message.Message.SetAntiBotToolsRequest);
                break;
            case ClientMessage.PayloadOneofCase.AuthenticateRequest:
                playerConnection.RequestDisconnect("Authenticate messages are only allowed before joining the game world.");
                break;
            case ClientMessage.PayloadOneofCase.None:
                break;
            default:
                throw new InvalidOperationException(
                    $"Unhandled client payload '{message.Message.PayloadCase}' in world '{id}'.");
        }
    }

    private void HandlePingRequest(GameWorldPlayer playerConnection, PingRequest pingRequest) {
        Ping.HandlePingRequest(gameWorldRef, playerConnection, pingRequest);
    }

    /// <summary>Updates authoritative weather and broadcasts <see cref="WeatherChanged"/> to every connected player in this world.</summary>
    private void HandleWeatherChangeRequest(GameWorldPlayer player, WeatherChangeRequest request) {
        var mode = request.Weather;
        if (!IsWeatherModeDefined(mode)) {
            Console.WriteLine($"[GameWorld:{id}] Ignoring weather change request with unknown mode {(int)mode}.");
            return;
        }

        if (mode == currentWeather) {
            return;
        }

        currentWeather = mode;
        var msg = NetworkManager.CreateWeatherChanged(mode);
        foreach (var recipient in playersBySessionId.Values) {
            if (recipient.Disconnected) {
                continue;
            }

            NetworkManager.SendToPlayer(recipient, msg);
        }
    }

    private static bool IsWeatherModeDefined(WeatherMode mode) {
        return mode switch {
            WeatherMode.Dry or WeatherMode.RainLight or WeatherMode.RainMedium or WeatherMode.RainHeavy
                or WeatherMode.SnowLight or WeatherMode.SnowMedium or WeatherMode.SnowHeavy => true,
            _ => false,
        };
    }

    private void RunPingVarianceCheck() {
        Ping.CheckPingVarianceAndDisconnectExcessive(gameWorldRef);
    }

    /// <summary>Play-mine: +1 connected minute for each non-disconnected player on this world.</summary>
    private void RecordHellMiningSessionMinutes() {
        foreach (var player in EnumerateConnectedPlayers()) {
            if (player.Disconnected || string.IsNullOrWhiteSpace(player.AccountWallet)) {
                continue;
            }
            HellMining.OnSessionMinute(player);
            // Arena: AFK 2h on Bleeding Island → daily $HELL incentive.
            ArenaIncentives.OnSessionMinute(id, player);
        }
    }

    public IEnumerable<GameWorldPlayer> EnumerateConnectedPlayers() => playersBySessionId.Values;

    /// <summary>Frees the corpse tile, drops monster chase on this player, resolves PvP kill attribution, and fans out <see cref="PlayerDied"/> to viewers (including the victim).</summary>
    public void HandlePlayerDeath(GameWorldRef wr, GameWorldPlayer player) {
        if (!player.IsDead) {
            return;
        }

        player.ClearAllTemporaryEffects(wr);

        occupancyTracker.SetFree(player.PosX, player.PosY);
        foreach (var monster in monstersByMonsterId.Values) {
            monster.StopChasingPlayerIfTarget(player.PlayerId);
        }

        long? killerPlayerId = null;
        string? killerName = null;
        if (player.TryGetRecentPlayerAttacker(out var attackerPlayerId, out var attackerName)) {
            killerPlayerId = attackerPlayerId;
            killerName = attackerName;
            if (TryGetConnectedPlayerById(attackerPlayerId, out var killer)
                && killer.PlayerId != player.PlayerId) {
                PvpKillLedger.TryRecordKill(wr, killer, player, rated: IsTournamentArena);
                var eligibleGalleryEk = EnemyKillAwards.IsEligibleEnemyKill(killer, player, IsTournamentArena);
                if (eligibleGalleryEk) {
                    PvpAcademy.RecordEnemyKill(killer);
                    RealmStats.RecordEnemyKill();
                    var rank = EnemyKillAwards.TryGetOpposingCityKillerRank(player);
                    var rarity = EnemyKillAwards.RarityFromOpposingCityKillerRank(rank);
                    var ekCount = PvpAcademy.GetEkCount(killer);
                    var ekMsg = NetworkManager.CreateEnemyKillAwarded(
                        player.PlayerId,
                        player.CharacterName ?? string.Empty,
                        player.Level,
                        killer.Level,
                        rank,
                        rarity,
                        id,
                        ekCount);
                    NetworkManager.SendToPlayer(killer, ekMsg);
                    HellMining.OnEnemyKillAwarded(killer, rank, rarity);
                } else if (!IsTournamentArena && HellMiningStore.IsTestingWeekActive()) {
                    // Testing week: same-city / sparring PvP still earns mining EK credits (cap 10/day).
                    // Gallery EK + academy ladder stay restricted to opposing-city eligible kills.
                    HellMining.OnEnemyKillAwarded(killer, victimCityKillerRank: null, EkScreenshotRarity.Unspecified);
                }
            }
        }

        var diedMsg = NetworkManager.CreatePlayerDied(player.PlayerId, player.PosX, player.PosY, killerPlayerId, killerName);
        // Victim must always get PlayerDied (death dialog + killer name); nearby fan-out covers spectators.
        NetworkManager.SendToPlayer(player, diedMsg);
        foreach (var recipient in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(recipient, diedMsg);
        }
    }

    /// <summary>Swaps the entrant onto the kit-based Arena loadout (or equal Tournament.json fallback) in arena worlds; no-op elsewhere. The real character is stashed and restored on save/transfer out.</summary>
    private void ApplyTournamentEntry(GameWorldPlayer player, PlayerPersistenceState? realState) {
        if (tournamentConfig is null) {
            return;
        }

        var loadout = tournamentConfig.Loadout;
        // Path-aware fallback: invalid/missing kit + path=mage → Cap/Robe/wand (not war FH + Long Sword).
        var peekPath = ArenaLoadout.TryPeekPath(player.ArenaKitJson);
        var equippedIds = ArenaLoadout.BuildFallbackEquippedIds(peekPath, player.GenderValue, loadout).ToList();

        // Prefer Arena kit level (150) when a kit is present; otherwise max-level equal footing.
        var maxLevel = !string.IsNullOrWhiteSpace(player.ArenaKitJson)
            ? (ArenaLoadout.IsConfigured ? 150 : Progression.Config?.MaxLevel ?? 180)
            : Progression.Config?.MaxLevel ?? 180;
        // Fresh characters that spawn directly in the arena stash their pre-loadout defaults so nothing tournament-issued can persist.
        player.EnterTournamentArena(
            realState ?? player.CreatePersistenceState(id),
            equippedIds,
            loadout.BagItems,
            maxLevel,
            itemsById);
        if (player.InTournamentArena) {
            SpecialAbility.RecomputeFromEquipment(gameWorldRef, player, notify: false);
            // Ensure traveler spell directory + client book match full arena unlocks (Blizzard VFX/damage).
            ArenaLoadout.GrantFullArenaSpellBook(player);
        }
        Console.WriteLine(
            $"[GameWorld:{id}] Tournament/Arena loadout applied to '{player.CharacterName}'" +
            (string.IsNullOrWhiteSpace(player.ArenaKitJson)
                ? " (equal footing)."
                : peekPath is not null
                    ? $" (kit; peekPath={peekPath})."
                    : " (kit)."));
        AntiBotTools.OnTournamentEntry(player, id);
    }

    /// <summary>
    /// Restart! / revive. Testing default: revive on (or next to) the death cell so farm/PvP testing is fast.
    /// Set env <c>REVIVE_TO_TOWN=1</c> to restore Olympia-style city-pad / traveler-hub revive.
    /// </summary>
    private void HandlePlayerResurrectRequest(GameWorldPlayer player) {
        if (!player.IsDead) {
            return;
        }

        // Bleeding Island arena: always revive in the safe lobby; clear duel safe-lock.
        if (Helpers.ArenaBleeding.IsArenaBleedingWorld(id)) {
            player.SetArenaSafeZoneLocked(false);
            Helpers.ArenaBleeding.GetSafeSpawn(out var sx, out var sy);
            var (rx, ry) = Helpers.Spawn.GetSpawnLocation(gameWorldRef, sx, sy);
            CompleteLocalResurrection(player, rx, ry);
            return;
        }

        // Testing: always revive near corpse (ground fields still blocked briefly by spawn protection).
        if (!IsReviveToTownEnabled()) {
            CompleteLocalResurrection(player, player.PosX, player.PosY);
            return;
        }

        // Production / opt-in: citizens → city pad, travelers → hub.
        if (TryResolveResurrectDestination(player, out var destWorldId, out var destX, out var destY)) {
            if (!string.Equals(destWorldId, id, StringComparison.OrdinalIgnoreCase)) {
                // Alive for transfer path; join on dest world full-heals and clears death UI via InitialState.
                player.ApplyResurrection();
                Party.NotifyVitalsChanged(player);
                Console.WriteLine(
                    $"[GameWorld:{id}] Resurrect-transfer '{player.CharacterName}' {id}→{destWorldId} ({destX},{destY})");
                player.RequestWorldChange(new WorldTransferDestination(destWorldId, destX, destY));
                return;
            }

            CompleteLocalResurrection(player, destX, destY);
            return;
        }

        // Fallback: nearest free dry cell from corpse (or traveler hub search anchor).
        var maxRadius = Math.Max(occupancyTracker.SizeX, occupancyTracker.SizeY);
        int searchX = player.PosX;
        int searchY = player.PosY;
        if (Spawn.TryGetTravelerDefaultSpawn(id, out var hubX, out var hubY)) {
            searchX = hubX;
            searchY = hubY;
        }

        var loc = Location.FindNearestFreeLocation(occupancyTracker.IsFreeSpawnCell, searchX, searchY, maxRadius)
            ?? Location.FindNearestFreeLocation(occupancyTracker.IsFreeDryCell, searchX, searchY, maxRadius);
        if (!loc.HasValue) {
            Console.WriteLine($"[GameWorld:{id}] Resurrect failed: no free dry cell near ({searchX},{searchY}) for player {player.PlayerId}.");
            return;
        }

        CompleteLocalResurrection(player, loc.Value.X, loc.Value.Y);
    }

    /// <summary>When true, Restart! sends citizens to town pads (Olympia). Default false for testing week.</summary>
    private static bool IsReviveToTownEnabled() {
        var flag = Environment.GetEnvironmentVariable("REVIVE_TO_TOWN");
        return string.Equals(flag, "1", StringComparison.Ordinal)
            || string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>City pad for citizens, traveler hub for travelers; false only when no known hub.</summary>
    private bool TryResolveResurrectDestination(GameWorldPlayer player, out string destWorldId, out int x, out int y) {
        destWorldId = string.Empty;
        x = 0;
        y = 0;

        var side = (player.CitizenshipSide ?? string.Empty).Trim().ToLowerInvariant();
        if (side is "aresden" or "elvine") {
            destWorldId = side;
            if (Recall.TryPickRandomCityPad(side, out x, out y)) {
                return true;
            }
            if (Spawn.TryGetTownDefaultSpawn(side, out x, out y)) {
                return true;
            }
            return false;
        }

        // No city papers → traveler hub (even if currently on another map).
        if (Spawn.TryGetTravelerDefaultSpawn("traveler", out x, out y)) {
            destWorldId = "traveler";
            return true;
        }

        return false;
    }

    /// <summary>Same-world revive: occupy free cell near preferred pad, restore HP, protect, fan-out packets.</summary>
    private void CompleteLocalResurrection(GameWorldPlayer player, int preferredX, int preferredY) {
        var maxRadius = Math.Max(occupancyTracker.SizeX, occupancyTracker.SizeY);
        var loc = Location.FindNearestFreeLocation(occupancyTracker.IsFreeSpawnCell, preferredX, preferredY, maxRadius)
            ?? Location.FindNearestFreeLocation(occupancyTracker.IsFreeDryCell, preferredX, preferredY, maxRadius);
        if (!loc.HasValue) {
            Console.WriteLine(
                $"[GameWorld:{id}] Resurrect failed: no free cell near ({preferredX},{preferredY}) for player {player.PlayerId}.");
            return;
        }

        var prevX = player.PosX;
        var prevY = player.PosY;
        var rx = loc.Value.X;
        var ry = loc.Value.Y;

        // Death already freed the corpse tile; re-occupy the landing cell.
        occupancyTracker.SetOccupied(rx, ry);
        Movement.SetPlayerPosition(gameWorldRef, player, rx, ry);
        player.ApplyResurrection();
        Party.NotifyVitalsChanged(player);
        Movement.SyncPlayerVisibilityAfterMovement(
            gameWorldRef,
            player,
            prevX,
            prevY,
            rx,
            ry,
            broadcastPlayerMoved: true,
            dashAttack: false,
            playerMovedTeleport: true);

        // Brief spawn protection so standing ground fields do not instantly re-kill after Restart!.
        ApplyResurrectionSpawnProtection(player);

        var resMsg = NetworkManager.CreatePlayerResurrected(player.PlayerId, rx, ry, player.Hp, player.MaxHp);
        // Victim must always receive the packet (death dialog clear + client revive) — do not rely on spatial neighbors only.
        NetworkManager.SendToPlayer(player, resMsg);
        foreach (var recipient in gameWorldRef.PlayerSpatialGrid.GetNearbyPlayers(rx, ry, player.SessionId, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(recipient, resMsg);
        }

        Console.WriteLine(
            $"[GameWorld:{id}] Resurrected '{player.CharacterName}' ({prevX},{prevY})→({rx},{ry}) HP={player.Hp}/{player.MaxHp}");
    }

    /// <summary>Enables temporary spawn protection after Restart! (same timer as world join when configured).</summary>
    private void ApplyResurrectionSpawnProtection(GameWorldPlayer player) {
        // Testing: short grace only (ground-field anti-instant-kill). Long 20s protection made
        // hostiles permanently ignore players until they moved (and re-chase was missing on expire).
        var periodSeconds = settings.Timings.SpawnProtectionTime;
        if (periodSeconds <= 0 || periodSeconds > 5) {
            periodSeconds = 3;
        }

        player.SetSpawnProtection(true);
        var sessionId = player.SessionId;
        scheduler.SetTimeout(periodSeconds * 1000, () => {
            if (!TryGetPlayerBySessionId(sessionId, out var p) || !p.SpawnProtection) {
                return;
            }
            Spawn.DisableSpawnProtectionAndNotify(gameWorldRef, p);
        });
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSpawnProtectionEnabled(player.PlayerId));
    }

    private void HandleChangePlayerAttackStunDuration(GameWorldPlayer player, ChangePlayerAttackStunDurationRequest request) {
        player.SetAttackStunDurationMs(request.AttackStunDurationMs);
    }

    private void HandleChangePlayerAttackSpeed(GameWorldPlayer player, ChangePlayerAttackSpeedRequest request) {
        player.SetAttackSpeedMs(request.AttackSpeedMs);
    }

    private void HandleChangePlayerCastSpeed(GameWorldPlayer player, ChangePlayerCastSpeedRequest request) {
        player.SetCastSpeedMs(request.CastSpeedMs);
    }

    private void HandleChangePlayerAttackType(GameWorldPlayer player, ChangePlayerAttackTypeRequest request) {
        player.SetAttackType(request.AttackType);
    }

    private void HandleChangePlayerAllowDashAttack(GameWorldPlayer player, ChangePlayerAllowDashAttackRequest request) {
        player.SetAllowDashAttack(request.AllowDashAttack);
    }

    /// <summary>Persists appearance on the player, strips gender-incompatible equipment (broadcast to self and nearby), and fans out <see cref="Mmorpg.Network.PlayerAppearanceChanged"/> to nearby observers (excluding the actor).</summary>
    private void HandleChangePlayerAppearance(GameWorldPlayer player, ChangePlayerAppearanceRequest request) {
        player.SetAppearance((int)request.Gender, (int)request.SkinColor, request.HairStyleIndex, request.UnderwearColorIndex);
        Inventory.UnequipItemsInvalidForCurrentGender(gameWorldRef, player);
        var msg = NetworkManager.CreatePlayerAppearanceChanged(
            player.PlayerId,
            request.Gender,
            request.SkinColor,
            player.HairStyleIndex,
            player.UnderwearColorIndex);
        foreach (var nearbyPlayer in gameWorldRef.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, msg);
        }
    }

    private void HandleChangePlayerAttackRange(GameWorldPlayer player, ChangePlayerAttackRangeRequest request) {
        player.SetAttackRangeCells(request.AttackRangeCells);
    }

    private void HandleChangePlayerAttackDamage(GameWorldPlayer player, ChangePlayerAttackDamageRequest request) {
        player.SetAttackDamage(request.AttackDamage);
    }

    /// <summary>Removes one bag item from the player, places it on the current cell as the new top-most dropped item, and broadcasts the resulting visibility change.</summary>
    /// <remarks>
    /// Bag remove happens first; if ground placement fails we restore the item to the bag so gear never evaporates.
    /// </remarks>
    private void HandlePlayerItemDropRequested(GameWorldPlayer player, PlayerItemDropRequested request) {
        if (player.IsDead) {
            return;
        }

        if (!Inventory.TryRemoveBagItemForGroundDrop(gameWorldRef, player, request.ItemUid, out var droppedItem) || droppedItem is null) {
            return;
        }
        // Non-stackable / damaged rows can carry Quantity=0 from legacy saves — clamp so ground add never throws.
        if (droppedItem.Quantity <= 0) {
            droppedItem.Quantity = 1;
        }
        if (!groundStateTracker.TryAddDroppedItem(droppedItem, player.PosX, player.PosY, out var previousTopItem, out var addedItem) || addedItem is null) {
            // Restore to bag so the item is not lost between remove and ground place.
            if (Inventory.TryAddGroundItemToBag(
                    gameWorldRef,
                    player,
                    new Server.Utils.GroundItemState(
                        droppedItem.ItemId,
                        droppedItem.ItemUid,
                        Math.Max(1, droppedItem.Quantity),
                        droppedItem.EffectOverrides,
                        player.PosX,
                        player.PosY,
                        droppedItem.ItemAttribute,
                        droppedItem.ItemColor,
                        droppedItem.CurLifeSpan,
                        droppedItem.MaxLifeSpan,
                        droppedItem.BindState,
                        droppedItem.BoundGuildId))) {
                Console.Error.WriteLine(
                    $"[Drop] Ground place failed; restored itemId={droppedItem.ItemId} uid={droppedItem.ItemUid} to bag for {player.CharacterName}.");
            } else {
                Console.Error.WriteLine(
                    $"[Drop] CRITICAL item loss risk itemId={droppedItem.ItemId} uid={droppedItem.ItemUid} player={player.CharacterName} — ground and bag both failed.");
            }
            return;
        }

        GroundStateVisibility.BroadcastGroundItemTopStateChanged(gameWorldRef, previousTopItem, addedItem);
    }

    /// <summary>Authoritative pickup: locks out other actions for animation ms minus ping variance; fans out <see cref="Mmorpg.Network.PlayerPickupPerformed"/> to nearby observers (excluding the actor).</summary>
    private void HandlePlayerPickupRequested(GameWorldPlayer player, PlayerPickupRequested request) {
        if (player.IsDead) {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (player.IsPickupOrBowStanceLockoutActive(now)) {
            return;
        }

        var d = request.Direction;
        if (d < 0 || d > 7) {
            return;
        }

        player.SetFacingDirection(d);
        player.BeginPickupActionLockout(settings.Timings.PlayerPickupAnimationTime);
        var msg = NetworkManager.CreatePlayerPickupPerformed(player.PlayerId, d, settings.Timings.PlayerPickupAnimationTime);
        foreach (var nearbyPlayer in gameWorldRef.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, msg);
        }
    }

    /// <summary>Moves up to <see cref="PlayerItemPickupRequested.MaxItems"/> top ground-stack items on the player's cell into the bag (clamped 1–9).</summary>
    /// <remarks>Ground removal and bag add are separate steps: they are not atomic and are not transactional. If a later step fails after an earlier one succeeded, the stack can be lost. Keep this in mind for any future changes here.</remarks>
    private void HandlePlayerItemPickupRequested(GameWorldPlayer player, PlayerItemPickupRequested request) {
        if (player.IsDead) {
            return;
        }

        GroundItemPickup.TryPickupItemsAtPlayerCell(gameWorldRef, player, request.MaxItems);
    }

    /// <summary>Authoritative bow stance (peace mode, ceremonial): valid grid direction; locks out other actions; fans out <see cref="Mmorpg.Network.PlayerBowStancePerformed"/> to nearby observers (excluding the actor).</summary>
    private void HandlePlayerBowStanceRequested(GameWorldPlayer player, PlayerBowStanceRequested request) {
        if (player.IsDead) {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        if (player.IsPickupOrBowStanceLockoutActive(now)) {
            return;
        }

        if (player.AttackMode) {
            return;
        }

        var gridDir = request.Direction;
        if (gridDir < 0 || gridDir > 7) {
            return;
        }

        player.SetFacingDirection(gridDir);
        player.BeginBowStanceActionLockout(settings.Timings.PlayerBowAnimationTime);
        var msg = NetworkManager.CreatePlayerBowStancePerformed(player.PlayerId, gridDir, settings.Timings.PlayerBowAnimationTime);
        foreach (var nearbyPlayer in gameWorldRef.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, msg);
        }
    }

    /// <summary>Debug summon: validates request fields, then spawns up to <c>summon_count</c> catalog monsters on free cells near the player.</summary>
    private void HandleSummonMonsterRequested(GameWorldPlayer player, SummonMonsterRequested request) {
        if (player.IsDead) {
            return;
        }
        if (player.IsPickupOrBowStanceLockoutActive(DateTimeOffset.UtcNow)) {
            return;
        }
        if (string.IsNullOrWhiteSpace(request.Sprite)) {
            return;
        }

        if (!monsterCatalog.TryGetValue(request.Sprite.Trim(), out var catalogEntry)) {
            Console.WriteLine($"[GameWorld:{id}] Unknown monster sprite '{request.Sprite}' from player '{player.PlayerId}'.");
            return;
        }

        var summonSearchRadius = Math.Max(occupancyTracker.SizeX, occupancyTracker.SizeY);
        var maxX = Math.Max(0, occupancyTracker.SizeX - 1);
        var maxY = Math.Max(0, occupancyTracker.SizeY - 1);
        var dwell = new MonsterDwellArea(0, 0, maxX, maxY);
        var speedMs = request.MovementSpeedMs;
        if (speedMs == 2000) {
            speedMs = 0;
        } else if (speedMs <= 0) {
            speedMs = 0;
        }
        var facing = request.Direction;
        if (facing < 0 || facing > 7) {
            return;
        }
        var atk = request.AttackType;
        if (atk < 0 || atk > 3) {
            return;
        }
        var allegianceValue = request.Allegiance;
        if (allegianceValue < (int)MonsterAllegiance.Hostile || allegianceValue > (int)MonsterAllegiance.Friendly) {
            return;
        }
        var stunMs = request.StunDurationMs;
        if (stunMs < 100 || stunMs > 2000) {
            return;
        }
        var maxHpReq = request.MaxHp;
        if (maxHpReq < 1 || maxHpReq > 1000) {
            return;
        }
        var attackDamage = request.AttackDamage;
        if (attackDamage < 1 || attackDamage > 1000) {
            return;
        }
        var attackSpeedMsReq = request.AttackSpeedMs;
        if (attackSpeedMsReq < 200 || attackSpeedMsReq > 2000) {
            return;
        }
        int? attackRecoveryMsOverride = null;
        if (request.HasAttackRecoveryMs) {
            var recoveryMs = request.AttackRecoveryMs;
            if (recoveryMs < 0 || recoveryMs > 2000) {
                return;
            }
            attackRecoveryMsOverride = recoveryMs;
        }
        int? chaseMaxDistanceCellsOverride = null;
        if (request.HasChaseRangeCells) {
            var chaseRange = request.ChaseRangeCells;
            if (chaseRange < 1 || chaseRange > 20) {
                return;
            }
            chaseMaxDistanceCellsOverride = chaseRange;
        }
        int? attackRangeCellsOverride = null;
        if (request.HasAttackRangeCells) {
            var attackRange = request.AttackRangeCells;
            if (attackRange < 1 || attackRange > 20) {
                return;
            }
            attackRangeCellsOverride = attackRange;
        }
        var summonCount = request.SummonCount;
        if (summonCount < 1 || summonCount > 1000) {
            return;
        }

        var summoned = 0;
        for (var i = 0; i < summonCount; i++) {
            var freeCell = Location.FindNearestFreeLocation(
                occupancyTracker.IsFreeAndNotTeleportCell,
                player.PosX,
                player.PosY,
                summonSearchRadius);
            if (!freeCell.HasValue) {
                if (summoned == 0) {
                    Console.WriteLine($"[GameWorld:{id}] No free cell near player '{player.PlayerId}' for monster summon.");
                }
                break;
            }

            var spawnX = freeCell.Value.X;
            var spawnY = freeCell.Value.Y;
            if (!TrySpawnMonster(
                    catalogEntry,
                    spawnX,
                    spawnY,
                    speedMs,
                    dwell,
                    hasDwellArea: false,
                    facing,
                    (AttackType)atk,
                    (MonsterAllegiance)allegianceValue,
                    stunMs,
                    maxHpReq,
                    attackDamage,
                    attackSpeedMsReq,
                    attackRecoveryMsOverride,
                    chaseMaxDistanceCellsOverride,
                    attackRangeCellsOverride,
                    out _)) {
                Console.WriteLine($"[GameWorld:{id}] Summon failed to place monster at ({spawnX},{spawnY}) for player '{player.PlayerId}'.");
                break;
            }

            summoned++;
        }

        if (summoned > 0) {
            Console.WriteLine(
                $"[GameWorld:{id}] Summoned {summoned} monster(s) '{catalogEntry.Name}' ({catalogEntry.Sprite}) near player '{player.PlayerId}'.");
        }
    }

    private void HandleWorldChangeRequest(GameWorldPlayer player, WorldChangeRequest request) {
        if (player.IsDead) {
            return;
        }
        if (player.IsPickupOrBowStanceLockoutActive(DateTimeOffset.UtcNow)) {
            return;
        }
        if (!IsRequestForCurrentWorld(request.GameWorldId)) {
            return;
        }
        if (string.IsNullOrWhiteSpace(request.WorldId) ||
            string.Equals(request.WorldId, id, StringComparison.Ordinal)) {
            return;
        }

        string destWorldId;
        int? destX;
        int? destY;
        if (!request.ValidateTeleport) {
            // Non-GM clients must stand on a configured pad (ValidateTeleport=true).
            // Unvalidated transfers were used for free map-switch and could dump players
            // at wrong town/farm defaults (e.g. water edge) when SpawnX/Y are null.
            if (!AdminSecurity.IsGmWallet(player.AccountWallet)) {
                Console.WriteLine(
                    $"[GameWorld:{id}] Rejected unvalidated world change for '{player.CharacterName}' at ({player.PosX},{player.PosY}) → '{request.WorldId}' (need pad + validateTeleport).");
                return;
            }
            destWorldId = request.WorldId;
            destX = null;
            destY = null;
        } else {
            var teleportTarget = ResolveTeleportTargetNearPlayer(player, request.WorldId);
            if (teleportTarget is null) {
                Console.WriteLine(
                    $"[GameWorld:{id}] Invalid teleport coordinates from player '{player.PlayerId}' at ({player.PosX}, {player.PosY}) for requested world '{request.WorldId}'.");
                return;
            }

            if (!string.IsNullOrWhiteSpace(request.WorldId) &&
                !string.Equals(request.WorldId, teleportTarget.WorldId, StringComparison.Ordinal)) {
                Console.WriteLine(
                    $"[GameWorld:{id}] Teleport world mismatch for player '{player.PlayerId}' at ({player.PosX}, {player.PosY}): requested '{request.WorldId}', authoritative '{teleportTarget.WorldId}'.");
            }

            destWorldId = teleportTarget.WorldId;
            destX = teleportTarget.Loc.X;
            destY = teleportTarget.Loc.Y;

            // Farm gray pad → random city initial-point (not a fixed edge cell).
            if (Helpers.Recall.IsOnFarmGrayWarpPad(id, player.PosX, player.PosY) &&
                (string.Equals(destWorldId, "elvine", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(destWorldId, "aresden", StringComparison.OrdinalIgnoreCase)) &&
                Helpers.Recall.TryPickRandomCityPad(destWorldId, out var cityX, out var cityY)) {
                destX = cityX;
                destY = cityY;
            }
        }

        // Chain Lords map brackets (PL ≤110, PL Dungeons ≤120).
        if (!WorldLevelGates.CanEnter(destWorldId, player.Level, out var levelError)) {
            Console.WriteLine(
                $"[GameWorld:{id}] Level gate blocked '{player.CharacterName}' L{player.Level} → '{destWorldId}': {levelError}");
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateChatMessageReceived(
                    "System",
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    levelError ?? "Level too high for that map.",
                    channel: ChatChannel.Global));
            return;
        }

        player.RequestWorldChange(new WorldTransferDestination(destWorldId, destX, destY));
    }

    /// <summary>Rejects stale client packets that were sent from another world but arrived after the session had already transferred.</summary>
    private bool IsRequestForCurrentWorld(string requestWorldId) {
        if (string.Equals(requestWorldId, id, StringComparison.Ordinal)) {
            return true;
        }

        return false;
    }

    /// <summary>Finds the nearest configured teleport source cell within a small Chebyshev radius so ordered packet handling can tolerate slight position lag.</summary>
    private GameWorldTeleportTarget? ResolveTeleportTargetNearPlayer(GameWorldPlayer player, string requestedWorldId) {
        if (teleportTargetsBySourceCell.TryGetValue((player.PosX, player.PosY), out var exactTarget)) {
            if (!string.IsNullOrWhiteSpace(requestedWorldId) &&
                !string.Equals(exactTarget.WorldId, requestedWorldId, StringComparison.Ordinal)) {
                Console.WriteLine(
                    $"[GameWorld:{id}] Teleport cell ({player.PosX}, {player.PosY}) → '{exactTarget.WorldId}' but client requested '{requestedWorldId}'; using radius match.");
                return ResolveTeleportTargetWithinRadius(player, requestedWorldId);
            }
            return exactTarget;
        }

        return ResolveTeleportTargetWithinRadius(player, requestedWorldId);
    }

    private GameWorldTeleportTarget? ResolveTeleportTargetWithinRadius(GameWorldPlayer player, string requestedWorldId) {
        GameWorldTeleportTarget? matchedTeleportTarget = null;
        var bestDistance = int.MaxValue;

        foreach (var ((sourceX, sourceY), candidateTarget) in teleportTargetsBySourceCell) {
            if (!string.IsNullOrWhiteSpace(requestedWorldId) &&
                !string.Equals(candidateTarget.WorldId, requestedWorldId, StringComparison.Ordinal)) {
                continue;
            }

            var distance = Location.GetDistance(player.PosX, player.PosY, sourceX, sourceY);
            if (distance > TeleportValidationRadius || distance >= bestDistance) {
                continue;
            }

            bestDistance = distance;
            matchedTeleportTarget = candidateTarget;
        }

        return matchedTeleportTarget;
    }

    /// <summary>Allocates spawn cell, constructs <see cref="GameWorldPlayer"/>, registers maps and spatial grid.</summary>
    private GameWorldPlayer CreatePlayer(
        Guid sessionId,
        Action<ServerMessage> sendMessage,
        Action<string?> requestDisconnect,
        Action<WorldTransferDestination> requestWorldChange,
        Action interruptLogoutDueToCombat,
        int? preferredSpawnX = null,
        int? preferredSpawnY = null) {
        // Traveler: ignore transfer/save preferred coords — GetSpawnLocation re-anchors to inland hub.
        var useDefaultSpawn =
            Spawn.TryGetTravelerDefaultSpawn(id, out _, out _)
            || !preferredSpawnX.HasValue
            || !preferredSpawnY.HasValue;
        var spawnLocation = useDefaultSpawn
            ? Spawn.GetSpawnLocation(gameWorldRef)
            : Spawn.GetSpawnLocation(gameWorldRef, preferredSpawnX!.Value, preferredSpawnY!.Value);
        var player = new GameWorldPlayer(
            sessionId,
            sendMessage,
            requestDisconnect,
            requestWorldChange,
            interruptLogoutDueToCombat,
            itemsById,
            settings.MovementSpeedViolationsChecker,
            settings.Ping.VarianceSampleSize,
            settings.Timings.AntiHackTimingLagFactor);
        player.SetInitialState(spawnLocation.X, spawnLocation.Y);
        occupancyTracker.SetOccupied(spawnLocation.X, spawnLocation.Y);
        playersBySessionId[sessionId] = player;
        playersMap[player.PlayerId] = player;
        playerSpatialGrid.Add(player, player.PosX, player.PosY);
        if (Spawn.TryGetTravelerDefaultSpawn(id, out _, out _)) {
            Console.WriteLine(
                $"[GameWorld:{id}] Traveler spawn at ({spawnLocation.X},{spawnLocation.Y}) (hub {Spawn.TravelerDefaultSpawnX},{Spawn.TravelerDefaultSpawnY}).");
        }
        return player;
    }

    /// <summary>
    /// Hard-forces a traveler onto the inland dry hub (login/reconnect/respawn safety net).
    /// Ignores prior save coords so coastal shore never resumes.
    /// </summary>
    private void ForceTravelerToHub(GameWorldPlayer player, string reason) {
        if (!Spawn.TryGetTravelerDefaultSpawn(id, out var hubX, out var hubY)) {
            return;
        }

        var prevX = player.PosX;
        var prevY = player.PosY;
        var loc = Spawn.GetSpawnLocation(gameWorldRef, hubX, hubY);
        if (prevX == loc.X && prevY == loc.Y) {
            return;
        }

        occupancyTracker.SetFree(prevX, prevY);
        occupancyTracker.SetOccupied(loc.X, loc.Y);
        Movement.SetPlayerPosition(gameWorldRef, player, loc.X, loc.Y);
        Console.WriteLine(
            $"[GameWorld:{id}] Forced traveler '{player.PlayerId}' to hub ({loc.X},{loc.Y}) from ({prevX},{prevY}) [{reason}].");
    }

    public bool TryGetPlayerBySessionId(Guid sessionId, out GameWorldPlayer player) {
        return playersBySessionId.TryGetValue(sessionId, out player!);
    }

    public bool TryGetConnectedPlayerById(long playerId, out GameWorldPlayer player) {
        return playersMap.TryGetValue(playerId, out player!);
    }

    /// <summary>
    /// Fallback login placement hint. Traveler uses the inland dry hub; other worlds use map center.
    /// Actual spawn still runs nearest-free / dry-cell lookup via <see cref="Spawn.GetSpawnLocation"/>.
    /// </summary>
    public (int X, int Y) GetCenterSpawnHint() {
        if (Spawn.TryGetTravelerDefaultSpawn(id, out var hubX, out var hubY)) {
            return (hubX, hubY);
        }

        return (occupancyTracker.SizeX / 2, occupancyTracker.SizeY / 2);
    }

    /// <summary>
    /// Olympia TimeHitPointsUp / TimeManaPointsUp / TimeStaminarPointsUp (~3s).
    /// HP∝Vit, MP∝Mag+Angelic, SP∝Vit/3 (+ early-level bonus).
    /// Low hunger (≤30) slows regen like Olympia (extra delay scales with emptiness).
    /// </summary>
    private void RunPlayerVitalRegenTick() {
        foreach (var player in EnumerateConnectedPlayers()) {
            if (player.IsDead || player.Disconnected) {
                continue;
            }
            // Olympia: when hunger ≤ 30, HP/MP ticks are delayed by (30-hunger)*1000 ms.
            // Approximate with a skip chance so low hunger feels sluggish.
            if (player.HungerStatus <= 30 && player.HungerStatus >= 0) {
                var skipChance = (30 - player.HungerStatus) / 30.0; // 0 at 30, 1 at 0
                if (Random.Shared.NextDouble() < skipChance * 0.7) {
                    continue;
                }
            }
            var changed = false;
            if (player.Hp < player.MaxHp) {
                var gain = PlayerDerivedStats.RollHpRegen(player);
                if (gain > 0) {
                    player.ApplyHeal(gain);
                    changed = true;
                }
            }
            if (player.Mp < player.MaxMp) {
                var gain = PlayerDerivedStats.RollMpRegen(player);
                if (gain > 0) {
                    player.ApplyMpRestore(gain);
                    changed = true;
                }
            }
            if (player.Sp < player.MaxSp) {
                var gain = PlayerDerivedStats.RollSpRegen(player);
                if (gain > 0) {
                    player.ApplySpRestore(gain);
                    changed = true;
                }
            }
            // Super Attack charge passive regen (~every 12 regen ticks ≈ +1 charge).
            if (player.TickSuperAttackRegen()) {
                changed = true;
            }
            if (changed) {
                Progression.SendProgressionUpdated(player, leveledUp: false);
            }
        }

        // Advance arena pact countdown / 15m timer (global store; safe from any world tick).
        // Pass wr so DC reconnect can restore temporary effects (buffs good+bad).
        ArenaPact.Tick((p, mapId) => {
            if (p.Disconnected) {
                return;
            }
            p.RequestWorldChange(new WorldTransferDestination(mapId, null, null));
        }, gameWorldRef);
    }

    /// <summary>Despawn ground loot after 15 minutes (monster drop or player drop).</summary>
    private void RunGroundItemExpiryTick() {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var changes = groundStateTracker.PurgeExpiredDroppedItems(nowMs);
        foreach (var (prev, next) in changes) {
            GroundStateVisibility.BroadcastGroundItemTopStateChanged(gameWorldRef, prev, next);
        }
    }

    /// <summary>Olympia hunger drain: −1 per 60s when level ≥ 20. Also ticks SA expiry/ready.</summary>
    private void RunPlayerHungerTick() {
        var now = DateTimeOffset.UtcNow;
        foreach (var player in EnumerateConnectedPlayers()) {
            if (Hunger.TryTickDrain(player, now)) {
                Progression.SendProgressionUpdated(player, leveledUp: false);
            }
            SpecialAbility.Tick(gameWorldRef, player);
        }
    }

    /// <summary>Runs due <see cref="Scheduler"/> callbacks and one monster AI pass per world tick.</summary>
    private void OnWorldTick() {
        scheduler.TriggerDueItems();
        var now = DateTimeOffset.UtcNow;
        var profileMonsterAi = settings.Debug.ProfileMonstersAILoop;
        if (monstersByMonsterId.Count > 0) {
            if (profileMonsterAi) {
                monsterAiProfileWindowEndUtc ??= now.AddSeconds(1);
            }
            var loopStart = profileMonsterAi ? DateTimeOffset.UtcNow : default;
            monsterAiTickScratch.Clear();
            foreach (var monster in monstersByMonsterId.Values) {
                monsterAiTickScratch.Add(monster);
            }

            foreach (var monster in monsterAiTickScratch) {
                // Timed summons (gold goblin 5 min): despawn cleanly when expired.
                if (monster.SummonExpiresAtUtc is DateTimeOffset expires && now >= expires && !monster.Dead) {
                    DespawnMonsterImmediate(monster);
                    continue;
                }
                monster.TickAi(gameWorldRef, monsterAiRandom, now);
            }
            if (profileMonsterAi) {
                monsterAiProfileMillisSum += (DateTimeOffset.UtcNow - loopStart).TotalMilliseconds;
                monsterAiProfileSampleCount++;
            }
        }

        if (profileMonsterAi) {
            FlushMonsterAiProfileIfDue(now);
            if (monstersByMonsterId.Count == 0 && monsterAiProfileSampleCount == 0) {
                monsterAiProfileWindowEndUtc = null;
            }
        }
    }

    /// <summary>When the current 1s window has ended, logs total and mean loop time in ms, then starts a new window from <paramref name="now"/>.</summary>
    private void FlushMonsterAiProfileIfDue(DateTimeOffset now) {
        if (monsterAiProfileWindowEndUtc is null || now < monsterAiProfileWindowEndUtc.Value) {
            return;
        }

        if (monsterAiProfileSampleCount > 0) {
            var totalMillis = monsterAiProfileMillisSum;
            var averageMillis = totalMillis / monsterAiProfileSampleCount;
            Console.WriteLine(
                $"[GameWorld:{id}] Monster AI loop (1s window): total {totalMillis:F3} ms, avg {averageMillis:F3} ms, {monsterAiProfileSampleCount} samples");
            monsterAiProfileMillisSum = 0;
            monsterAiProfileSampleCount = 0;
        }

        monsterAiProfileWindowEndUtc = now.AddSeconds(1);
    }

    /// <summary>Spawns <see cref="GameWorldConfig.Npcs"/> after the world ref is initialized and before dwell monsters so random spawns cannot take the same walkable cell.</summary>
    private void SpawnConfiguredNpcs(IReadOnlyList<GameWorldNpcPlacementConfig>? configs) {
        if (configs is null || configs.Count == 0) {
            return;
        }

        foreach (var p in configs) {
            Npc.SpawnWorldNpcAtCell(gameWorldRef, p.NpcId, p.X, p.Y, p.Direction);
        }
    }

    /// <summary>Places configured dwell populations after the world ref is initialized; logs and skips cells that stay blocked.</summary>
    private void SpawnDwellAreaMonsters(IReadOnlyList<GameWorldDwellAreaConfig> configs, IReadOnlyDictionary<int, MonsterConfig> catalogByMonsterId) {
        var maxX = Math.Max(0, occupancyTracker.SizeX - 1);
        var maxY = Math.Max(0, occupancyTracker.SizeY - 1);
        foreach (var cfg in configs) {
            if (!catalogByMonsterId.TryGetValue(cfg.MonsterId, out var template)) {
                continue;
            }

            var dwell = ClampDwellBoundsToArea(cfg.Area, maxX, maxY);
            var movementSpeedMs = template.MovementSpeed > 0 ? template.MovementSpeed : (template.MovementSpeed == 0 ? 0 : 220);
            for (var i = 0; i < cfg.Count; i++) {
                if (!TryFindFreeCellInDwell(dwell, monsterAiRandom, out var sx, out var sy)) {
                    Console.WriteLine(
                        $"[GameWorld:{id}] Dwell spawn: no free cell for monster id {cfg.MonsterId} ({i + 1}/{cfg.Count}) in configured area.");
                    continue;
                }

                if (!TrySpawnMonster(template, sx, sy, movementSpeedMs, dwell, hasDwellArea: true, initialFacingDirection: 4, attackTypeOverride: null, allegianceOverride: null, stunDurationMsOverride: null, maxHpOverride: null, attackDamageOverride: null, attackSpeedMsOverride: null, attackRecoveryMsOverride: null, chaseMaxDistanceCellsOverride: null, attackRangeCellsOverride: null, out _)) {
                    Console.WriteLine(
                        $"[GameWorld:{id}] Dwell spawn: failed to occupy cell ({sx},{sy}) for monster id {cfg.MonsterId}.");
                }
            }
        }
    }

    private static MonsterDwellArea ClampDwellBoundsToArea(GameWorldDwellAreaBoundsConfig? area, int maxX, int maxY) {
        int rawX1;
        int rawY1;
        int rawX2;
        int rawY2;
        if (area is null) {
            rawX1 = 0;
            rawY1 = 0;
            rawX2 = maxX;
            rawY2 = maxY;
        } else {
            rawX1 = area.X1;
            rawY1 = area.Y1;
            rawX2 = area.X2;
            rawY2 = area.Y2;
        }

        var xLo = Math.Clamp(Math.Min(rawX1, rawX2), 0, maxX);
        var xHi = Math.Clamp(Math.Max(rawX1, rawX2), 0, maxX);
        var yLo = Math.Clamp(Math.Min(rawY1, rawY2), 0, maxY);
        var yHi = Math.Clamp(Math.Max(rawY1, rawY2), 0, maxY);
        return new MonsterDwellArea(xLo, yLo, xHi, yHi);
    }

    /// <summary>Random then scan for a walkable non-teleport cell inside the inclusive dwell rectangle.</summary>
    private bool TryFindFreeCellInDwell(MonsterDwellArea dwell, Random random, out int spawnX, out int spawnY) {
        var xMin = Math.Min(dwell.X1, dwell.X2);
        var xMax = Math.Max(dwell.X1, dwell.X2);
        var yMin = Math.Min(dwell.Y1, dwell.Y2);
        var yMax = Math.Max(dwell.Y1, dwell.Y2);
        const int maxRandomAttempts = 400;
        for (var attempt = 0; attempt < maxRandomAttempts; attempt++) {
            var rx = random.Next(xMin, xMax + 1);
            var ry = random.Next(yMin, yMax + 1);
            if (occupancyTracker.IsFreeAndNotTeleportCell(rx, ry)) {
                spawnX = rx;
                spawnY = ry;
                return true;
            }
        }

        for (var ry = yMin; ry <= yMax; ry++) {
            for (var rx = xMin; rx <= xMax; rx++) {
                if (occupancyTracker.IsFreeAndNotTeleportCell(rx, ry)) {
                    spawnX = rx;
                    spawnY = ry;
                    return true;
                }
            }
        }

        spawnX = 0;
        spawnY = 0;
        return false;
    }

    /// <summary>Creates a monster, occupies the cell, indexes it in maps, and notifies nearby players. <paramref name="initialFacingDirection"/> is authoritative grid facing 0–7 (matches client direction indices). When <paramref name="attackTypeOverride"/> is set (summon dialog), it overrides the catalog&apos;s attack type. When <paramref name="allegianceOverride"/> is set, it overrides catalog <c>allegiance</c> (hostile auto-aggro vs neutral retaliate-only). When <paramref name="stunDurationMsOverride"/> is set, it overrides <c>attackStunDuration</c> from the catalog for player stunlock duration. When <paramref name="maxHpOverride"/> is set, it overrides catalog <c>hp</c> for initial max/current HP. When <paramref name="attackDamageOverride"/> is set, both <see cref="GameWorldMonster.AttackDamageMin"/> and <see cref="GameWorldMonster.AttackDamageMax"/> are set to that value. When <paramref name="attackSpeedMsOverride"/> is set, it overrides catalog <c>attackSpeed</c> (full swing duration in ms). When <paramref name="attackRecoveryMsOverride"/> is set, it overrides catalog <c>attackRecoveryTime</c> (post-hit idle gate in ms, plus half swing). When <paramref name="chaseMaxDistanceCellsOverride"/> is set, it overrides catalog <c>chaseMaxDistance</c> (max Chebyshev cells before chase is dropped). When <paramref name="attackRangeCellsOverride"/> is set, it overrides catalog <c>attackRange</c> (Chebyshev cells for melee reach).</summary>
    private bool TrySpawnMonster(
        MonsterConfig template,
        int spawnX,
        int spawnY,
        int movementSpeedMs,
        MonsterDwellArea dwell,
        bool hasDwellArea,
        int initialFacingDirection,
        AttackType? attackTypeOverride,
        MonsterAllegiance? allegianceOverride,
        int? stunDurationMsOverride,
        int? maxHpOverride,
        int? attackDamageOverride,
        int? attackSpeedMsOverride,
        int? attackRecoveryMsOverride,
        int? chaseMaxDistanceCellsOverride,
        int? attackRangeCellsOverride,
        out GameWorldMonster? spawned) {
        spawned = null;
        if (!occupancyTracker.IsFreeAndNotTeleportCell(spawnX, spawnY)) {
            return false;
        }

        var monsterGuid = Guid.NewGuid();
        var chaseDistanceCells = template.ChaseDistance ?? settings.MonsterDefaults.ChaseDistance;
        var chaseMaxDistanceCells = chaseMaxDistanceCellsOverride ?? template.ChaseMaxDistance ?? settings.MonsterDefaults.ChaseMaxDistance;
        var attackRangeCells = attackRangeCellsOverride ?? template.AttackRange ?? 1;
        // When catalog omits attackSpeed, use Olympia ActionTime (movementSpeed) — not the global default 600,
        // which made Trolls/Orcs attack hyper-fast relative to their ActionTime 900/1400.
        var attackSpeedMs = attackSpeedMsOverride
            ?? template.AttackSpeed
            ?? (template.MovementSpeed > 0 ? template.MovementSpeed : settings.MonsterDefaults.AttackSpeed);
        int attackDamageMin;
        int attackDamageMax;
        if (attackDamageOverride.HasValue) {
            attackDamageMin = attackDamageOverride.Value;
            attackDamageMax = attackDamageOverride.Value;
        } else {
            attackDamageMin = template.AttackDamageMin ?? settings.MonsterDefaults.AttackDamageMin;
            attackDamageMax = template.AttackDamageMax ?? settings.MonsterDefaults.AttackDamageMax;
        }
        var attackRecoveryMs = attackRecoveryMsOverride ?? template.AttackRecoveryTime ?? settings.MonsterDefaults.AttackRecoveryTime;
        var minIdleTimeMs = template.MinIdleTime ?? settings.MonsterDefaults.MinIdleTime;
        var maxIdleTimeMs = template.MaxIdleTime ?? settings.MonsterDefaults.MaxIdleTime;
        var attackType = attackTypeOverride ?? (AttackType)(template.AttackType ?? 0);
        var allegiance = allegianceOverride ?? (MonsterAllegiance)(template.Allegiance ?? 0);
        var stunDurationMs = stunDurationMsOverride ?? template.AttackStunDuration ?? 100;
        var rangedAttack = template.RangedAttack ?? false;
        var maxHp = maxHpOverride ?? template.Hp ?? settings.MonsterDefaults.Hp;
        var corpseDecayMs = template.CorpseDecayTime ?? settings.MonsterDefaults.CorpseDecayTime;
        var monster = new GameWorldMonster(
            monsterGuid,
            template.Name,
            template.Sprite,
            spawnX,
            spawnY,
            movementSpeedMs,
            chaseDistanceCells,
            chaseMaxDistanceCells,
            attackRangeCells,
            attackSpeedMs,
            attackDamageMin,
            attackDamageMax,
            attackRecoveryMs,
            minIdleTimeMs,
            maxIdleTimeMs,
            dwell,
            hasDwellArea,
            attackType,
            allegiance,
            stunDurationMs,
            rangedAttack,
            MonsterEntityState.Idle,
            maxHp,
            corpseDecayMs,
            template.Id,
            initialFacingDirection,
            template.Spells ?? Array.Empty<MonsterSpellEntry>(),
            template.MagicLevel ?? 0,
            template.MaxMana ?? 0,
            template.MagicHitRatio ?? 0);
        // Olympia SA (Anti-Magic etc.): ~35% on Cyclops → extra kill exp (live ~25k vs ~17k normal).
        MonsterSpecialAbility.RollForSpawn(template.Name, out var sa, out var saExpPct);
        monster.SetSpecialAbility(sa, saExpPct);
        // Neutral animals (e.g. Unicorn hitsToAggro=2): stay passive until Nth player hit.
        if (template.HitsToAggro is int hitsToAggro) {
            monster.SetHitsToAggro(hitsToAggro);
        }
        occupancyTracker.SetOccupied(spawnX, spawnY);
        monstersByMonsterId[monster.MonsterId] = monster;
        monsterSpatialGrid.Add(monster, spawnX, spawnY);
        MonsterVisibility.BroadcastMonsterSpawnToNearbyPlayers(gameWorldRef, monster);
        spawned = monster;
        return true;
    }

    /// <summary>Ground-effect scheduler callback for periodic fields: damages any player or monster currently occupying the effect cell.</summary>
    private void HandleGroundEffectTick(GroundEffectState effect) {
        foreach (var targetPlayer in gameWorldRef.PlayerSpatialGrid.GetPlayersInRectangle(effect.PosX, effect.PosY, effect.PosX, effect.PosY, excludeDisconnected: false)) {
            if (targetPlayer.PosX != effect.PosX || targetPlayer.PosY != effect.PosY) {
                continue;
            }

            Combat.ApplyGroundEffectDamageToPlayer(gameWorldRef, effect.CasterPlayerId, effect.DamagePerTick, targetPlayer, effect.SpellAttackType, effect.SpellId);
        }

        foreach (var targetMonster in gameWorldRef.MonsterSpatialGrid.GetMonstersInRectangle(effect.PosX, effect.PosY, effect.PosX, effect.PosY)) {
            if (targetMonster.PosX != effect.PosX || targetMonster.PosY != effect.PosY || targetMonster.Dead) {
                continue;
            }

            Combat.ApplyGroundEffectDamageToMonster(gameWorldRef, effect.CasterPlayerId, effect.DamagePerTick, targetMonster, effect.SpellAttackType, effect.SpellId);
        }
    }

    /// <summary>Ground-effect expiry callback: removes the expired effect from nearby clients while leaving other cell effects intact.</summary>
    private void HandleGroundEffectExpired(GroundEffectState effect) {
        GroundStateVisibility.BroadcastGroundEffectsRemoved(gameWorldRef, effect);
    }

}
