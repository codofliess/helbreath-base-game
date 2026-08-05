using System.Collections.Generic;
using System.Linq;
using Mmorpg.Network;
using Server;
using Server.World;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Spawn selection, initial world snapshot, spawn protection timing, and related broadcasts.</summary>
public static class Spawn {
    /// <summary>
    /// Inland traveler hub on map <c>default</c> (dry grass; no sprite-18/19 within ~20 tiles).
    /// Single source of truth for traveler login, transfer, death, and wet-cell reconnect snap.
    /// </summary>
    public const int TravelerDefaultSpawnX = 90;
    public const int TravelerDefaultSpawnY = 80;

    /// <summary>
    /// Classic Helbreath town-plaza tiles (city-hall door exits in <c>GameWorlds.json</c>).
    /// Used when a transfer has no teleport destination so <c>SpawnInMiddle</c> cannot drop citizens into water/wilds.
    /// Aresden (149,127) and Elvine (149,131) are dry plaza on their city maps — but the same numbers are
    /// coastal water on traveler map <c>default</c>, so the client must load the city .amd before applying them.
    /// </summary>
    /// <summary>
    /// Default city spawn = Olympia mapdata initial-point #1 (primary gray pad), not intermap gates.
    /// Aresden (140,49) · Elvine (158,57) · farms use their single village pad.
    /// </summary>
    public static bool TryGetTownDefaultSpawn(string worldId, out int x, out int y) {
        if (string.Equals(worldId, "aresden", StringComparison.Ordinal)) {
            x = 140;
            y = 49;
            return true;
        }

        if (string.Equals(worldId, "elvine", StringComparison.Ordinal)) {
            x = 158;
            y = 57;
            return true;
        }

        if (string.Equals(worldId, "arefarm", StringComparison.Ordinal)) {
            x = 50;
            y = 95;
            return true;
        }

        if (string.Equals(worldId, "elvfarm", StringComparison.Ordinal)) {
            x = 124;
            y = 151;
            return true;
        }

        x = 0;
        y = 0;
        return false;
    }

    /// <summary>Traveler soft zone on map <c>default</c> — never uses raw map-center (can sit near shore pits).</summary>
    public static bool TryGetTravelerDefaultSpawn(string worldId, out int x, out int y) {
        if (string.Equals(worldId, "traveler", StringComparison.Ordinal)) {
            x = TravelerDefaultSpawnX;
            y = TravelerDefaultSpawnY;
            return true;
        }

        x = 0;
        y = 0;
        return false;
    }

    /// <summary>Bleeding Island arena lobby safe pad (hang-out / post-duel revive).</summary>
    public static bool TryGetArenaBleedingSpawn(string worldId, out int x, out int y) {
        if (ArenaBleeding.IsArenaBleedingWorld(worldId)) {
            ArenaBleeding.GetSafeSpawn(out x, out y);
            return true;
        }

        x = 0;
        y = 0;
        return false;
    }

    public static (int X, int Y) GetSpawnLocation(GameWorldRef wr) {
        if (TryGetTownDefaultSpawn(wr.WorldId, out var townX, out var townY)) {
            return GetSpawnLocation(wr, townX, townY);
        }

        if (TryGetTravelerDefaultSpawn(wr.WorldId, out var travelerX, out var travelerY)) {
            return GetSpawnLocation(wr, travelerX, travelerY);
        }

        if (TryGetArenaBleedingSpawn(wr.WorldId, out var biX, out var biY)) {
            return GetSpawnLocation(wr, biX, biY);
        }

        int startX, startY;
        if (wr.Settings.SpawnInMiddle) {
            startX = wr.OccupancyTracker.SizeX / 2;
            startY = wr.OccupancyTracker.SizeY / 2;
        } else {
            startX = Random.Shared.Next(wr.OccupancyTracker.SizeX);
            startY = Random.Shared.Next(wr.OccupancyTracker.SizeY);
        }

        return GetSpawnLocation(wr, startX, startY);
    }

    /// <summary>
    /// Nearest free dry spawn from <paramref name="startX"/>/<paramref name="startY"/>.
    /// Traveler world always re-anchors the search at the inland hub so transfer/save coords cannot pull toward coastal shore.
    /// </summary>
    public static (int X, int Y) GetSpawnLocation(GameWorldRef wr, int startX, int startY) {
        if (TryGetTravelerDefaultSpawn(wr.WorldId, out var hubX, out var hubY)) {
            startX = hubX;
            startY = hubY;
        }

        var maxRadius = Math.Max(wr.OccupancyTracker.SizeX, wr.OccupancyTracker.SizeY);
        return Location.FindNearestFreeLocation(wr.OccupancyTracker.IsFreeSpawnCell, startX, startY, maxRadius)
            ?? throw new InvalidOperationException($"Game world '{wr.WorldId}' could not find a free spawn location.");
    }

    /// <summary>Sends spell entries when <paramref name="includeSpells"/> is true, item directory on every send, plus session-scoped player tunables; called on every join (spells omitted on world transfer).</summary>
    public static void SendInitialState(GameWorldRef wr, GameWorldPlayer player, bool includeSpells) {
        IEnumerable<SpellConfig> spells;
        if (!includeSpells) {
            spells = Array.Empty<SpellConfig>();
        } else if (player.TravelerMode) {
            // Traveler: Energy Bolt + Magic Tower combat unlocks (never full GM sandbox).
            var list = new List<SpellConfig>();
            if (wr.SpellsById.TryGetValue(0, out var energyBolt)) {
                list.Add(energyBolt);
            }
            foreach (var olympiaId in player.GetLearnedOlympiaSpellIds()) {
                if (!Helpers.MagicTower.OlympiaToServerSpellId.TryGetValue(olympiaId, out var serverId) ||
                    serverId == 0) {
                    continue;
                }
                if (wr.SpellsById.TryGetValue(serverId, out var cfg) &&
                    !list.Exists(s => s.Id == cfg.Id)) {
                    list.Add(cfg);
                }
            }
            spells = list;
        } else {
            spells = wr.SpellsById.OrderBy(kv => kv.Key).Select(kv => kv.Value);
        }
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateInitialState(
                spells,
                wr.ItemsById.Values.OrderBy(i => i.Id),
                player.InventoryManager.BagItems,
                player.InventoryManager.EquippedItems,
                player.PlayerId,
                player.MovementSpeedMs,
                player.BaseMovementSpeedMs,
                player.RunningMode,
                wr.Settings.Ping.Interval,
                player.AttackMode,
                player.AttackRange,
                player.Damage,
                player.AttackSpeedMs,
                wr.Settings.Timings.ArrowSpeed,
                player.Hp,
                player.MaxHp,
                wr.Settings.Timings.PlayerPickupAnimationTime,
                wr.Settings.Timings.PlayerBowAnimationTime,
                player.AttackStunDurationMs,
                player.CastSpeedMs,
                player.AttackType,
                player.AllowDashAttack,
                (PlayerGender)player.GenderValue,
                (PlayerSkinColor)player.SkinColorValue,
                player.HairStyleIndex,
                player.UnderwearColorIndex,
                wr.NpcsById.Values.OrderBy(n => n.Id),
                player.Str,
                player.Vit,
                player.Dex,
                player.Int,
                player.Mag,
                player.Chr,
                Progression.GetLuPoints(player),
                player.Mp,
                player.MaxMp,
                player.Sp,
                player.MaxSp,
                player.SafeAttackMode,
                player.CitizenshipSide));
    }

    /// <summary>Map snapshot on load: position, teleports, music, death flag, weather.</summary>
    public static void SendInitialGameWorldState(GameWorldRef wr, GameWorldPlayer player) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateInitialGameWorldState(
                wr.WorldId,
                wr.Map,
                wr.Music,
                player.PosX,
                player.PosY,
                player.FacingDirection,
                wr.TeleportLocs,
                player.IsDead,
                wr.World.CurrentWeather));
    }

    /// <summary>Sends <see cref="Mmorpg.Network.InitialState"/> (spells only on first join / reconnect), then <see cref="Mmorpg.Network.InitialGameWorldState"/>, spawn protection, visibility.</summary>
    public static void CompletePlayerJoin(GameWorldRef wr, GameWorldPlayer player, bool includeSpellsInInitialState) {
        // Play-mine: first presence of the UTC day earns +1 credit (testing-week friendly).
        HellMining.OnPlayerJoined(player);
        // Floor every skill to 20% (skill manuals removed from shop).
        Skills.ApplyStartingDefaults(player);
        // Strip gear that fails Str/level (e.g. Horned with low Str) before snapshot.
        Inventory.UnequipItemsInvalidForStats(wr, player);
        // Equip Merien/Xelima/Ice SA from currently worn gear (silent on join).
        SpecialAbility.RecomputeFromEquipment(wr, player, notify: false);
        SendInitialState(wr, player, includeSpellsInInitialState);
        SendInitialGameWorldState(wr, player);
        Progression.SendProgressionState(wr, player);
        Skills.SendSkillsState(player);
        if (player.SpecialAbilityType != 0) {
            SpecialAbility.SendStatus(
                player,
                SpecialAbility.StatusSet,
                player.SpecialAbilityType,
                player.SpecialAbilityCooldownRemainingSec);
        }
        Enchanting.SendMaterialsState(player);
        BeginnerPath.SendState(player);
        BeginnerPath.OnWorldEntered(player, wr.WorldId);
        MarketSideDoor.TryDeliverDeskClaims(wr, player);

        var periodSeconds = wr.Settings.Timings.SpawnProtectionTime;
        if (periodSeconds > 0) {
            player.SetSpawnProtection(true);
            var sessionId = player.SessionId;
            wr.Scheduler.SetTimeout(periodSeconds * 1000, () => OnSpawnProtectionTimeout(wr, sessionId));
        }

        Movement.FillNearbyPlayersById(wr.PlayerSpatialGrid, player.PosX, player.PosY, player.SessionId, wr.NearbyPlayersByIdScratch);
        var nearbyPlayers = wr.NearbyPlayersByIdScratch;
        Movement.SendPlayersSnapshotsBulk(player, nearbyPlayers.Values);
        var joinerEnteredForOthers = NetworkManager.CreatePlayersEnteredRange(player);
        foreach (var nearbyPlayer in nearbyPlayers.Values) {
            if (!nearbyPlayer.Disconnected) {
                NetworkManager.SendToPlayer(nearbyPlayer, joinerEnteredForOthers);
                nearbyPlayer.AddPlayerInRange(player.PlayerId);
            }
        }

        if (periodSeconds > 0) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSpawnProtectionEnabled(player.PlayerId));
        }

        player.ReplacePlayersInRange(nearbyPlayers.Keys);
        MonsterVisibility.SendMonstersInRangeOnPlayerJoin(wr, player);
        Npc.SendNpcsInRangeOnPlayerJoin(wr, player);
        GroundStateVisibility.SendGroundStatesInRangeOnPlayerJoin(wr, player);
    }

    private static void OnSpawnProtectionTimeout(GameWorldRef wr, Guid sessionId) {
        if (!wr.World.TryGetPlayerBySessionId(sessionId, out var player)) {
            return;
        }
        if (!player.SpawnProtection) {
            return;
        }
        DisableSpawnProtectionAndNotify(wr, player);
    }

    public static void DisableSpawnProtectionAndNotify(GameWorldRef wr, GameWorldPlayer player) {
        if (!player.SpawnProtection) {
            return;
        }

        player.SetSpawnProtection(false);
        var spawnProtectionDisabledMessage = NetworkManager.CreateSpawnProtectionDisabled(player.PlayerId);
        NetworkManager.SendToPlayer(player, spawnProtectionDisabledMessage);
        foreach (var nearbyPlayer in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearbyPlayer, spawnProtectionDisabledMessage);
        }

        // Critical: while protected, MonsterChase stops hostiles from targeting this player.
        // Without a re-eval on expire, mobs keep ignoring them until the next movement packet.
        MonsterChase.EvaluateChaseForPlayer(wr, player);
    }
}
