using System;
using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Howard / Kennedy / Gail / Perry city desks: proximity-checked info and light services
/// (guild interest flag, citizenship brief, heal/bless/donate, crusade stub).
/// </summary>
public static class CityNpcServices {
    public const int HowardCatalogNpcId = 2;
    public const int KennedyCatalogNpcId = 5;
    public const int GailCatalogNpcId = 6;
    public const int PerryCatalogNpcId = 8;

    public const int MaxInteractDistance = 2;

    /// <summary>Gold cost for a full heal at Gail.</summary>
    public const int HealGoldCost = 50;

    /// <summary>Gold cost for a short Protection From Magic blessing at Gail.</summary>
    public const int BlessGoldCost = 100;

    /// <summary>Olympia Tutelary Angel cost (Gail CMD Hall): 5 majestic / gizon points.</summary>
    public const int AngelMajesticCost = 5;

    public const int AngelStrItemId = 1108;
    public const int AngelDexItemId = 1109;
    public const int AngelIntItemId = 1110;
    public const int AngelMagItemId = 1111;

    /// <summary>Default donation when the client omits <c>donate_gold</c>.</summary>
    public const int DefaultDonateGold = 100;

    public const int MinDonateGold = 10;
    public const int MaxDonateGold = 10_000;

    /// <summary>PFM temporary-effect type/group/duration matching Spells.json id 35.</summary>
    const TemporaryEffectType BlessEffectType = TemporaryEffectType.ProtectFromMagic;
    const int BlessEffectGroup = 7;
    const int BlessDurationMs = 60_000;

    /// <summary>Handles <see cref="CityNpcServiceRequest"/> for the four city service NPCs.</summary>
    public static void HandleCityNpcServiceRequest(
        GameWorldRef wr,
        GameWorldPlayer player,
        CityNpcServiceRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        Console.WriteLine(
            $"[CityNpc] {player.CharacterName} world={wr.WorldId} reqWorld={request.GameWorldId} action={request.Action} npcId={request.NpcId}");

        // Packet is already on this world's player mailbox. Stale client gameWorldId after
        // city teleports used to drop Magic Tower buys with no reply — accept and log.
        if (!string.IsNullOrWhiteSpace(request.GameWorldId) &&
            !IsRequestForCurrentWorld(wr, request.GameWorldId)) {
            Console.WriteLine(
                $"[CityNpc] Ignoring stale gameWorldId '{request.GameWorldId}' (world is '{wr.WorldId}') for {player.CharacterName}.");
        }

        // Gandalf / Magic Tower shares CityNpcServiceRequest (open / buy_spell / learn:ID).
        if (MagicTower.TryHandleCityService(wr, player, request)) {
            return;
        }

        // Garden Warden (areuni / elvuni) — unicorn & troll contribution quests.
        if (wr.NpcsByNpcId.TryGetValue(request.NpcId, out var gardenNpc) &&
            GardenQuests.IsGardenWarden(gardenNpc.CatalogNpcId)) {
            var gDist = Math.Max(Math.Abs(player.PosX - gardenNpc.PosX), Math.Abs(player.PosY - gardenNpc.PosY));
            if (gDist > MaxInteractDistance) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage("Move closer to the Garden Warden."));
                return;
            }
            GardenQuests.TryHandleService(wr, player, request, gardenNpc.CatalogNpcId);
            return;
        }

        // Cathedral PvP Academy desks (Drill Instructor + Arena Master).
        if (wr.NpcsByNpcId.TryGetValue(request.NpcId, out var academyNpc) &&
            PvpAcademy.IsAcademyCatalog(academyNpc.CatalogNpcId)) {
            var dist = Math.Max(Math.Abs(player.PosX - academyNpc.PosX), Math.Abs(player.PosY - academyNpc.PosY));
            if (dist > MaxInteractDistance) {
                var sideA = ResolveCitizenshipSide(wr.WorldId);
                SendResult(player, ok: false, "Move closer to the Academy desk.", PvpAcademy.RoleForCatalog(academyNpc.CatalogNpcId), "", sideA);
                return;
            }
            PvpAcademy.TryHandleService(wr, player, request, academyNpc.CatalogNpcId);
            return;
        }

        var side = ResolveCitizenshipSide(wr.WorldId);
        if (!TryValidateCityNpc(wr, player, request.NpcId, out var npc, out var role, out var error)) {
            SendResult(player, ok: false, error, role, npcName: "", side);
            return;
        }

        var npcName = wr.NpcsById.TryGetValue(npc.CatalogNpcId, out var catalog) ? catalog.Name : RoleLabel(role);
        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();

        // Olympia City Hall (Kennedy) charged teleport: action "teleport:<key>".
        if (action.StartsWith("teleport:", StringComparison.Ordinal) && role == "city-hall") {
            HandleCityHallTeleport(wr, player, role, npcName, side, action["teleport:".Length..]);
            return;
        }

        switch (action) {
            case "" or "open":
                SendOpenSnapshot(player, role, npcName, side);
                return;
            case "register_guild_interest":
                HandleRegisterGuildInterest(player, role, npcName, side);
                return;
            case "city_brief":
                HandleCityBrief(player, role, npcName, side);
                return;
            case "teleport_list":
                HandleTeleportList(player, role, npcName, side);
                return;
            case "open_warehouse_hint":
                HandleWarehouseHint(player, role, npcName, side);
                return;
            case "heal":
                HandleHeal(wr, player, role, npcName, side);
                return;
            case "bless":
                HandleBless(wr, player, role, npcName, side);
                return;
            case "donate":
                HandleDonate(
                    wr,
                    player,
                    role,
                    npcName,
                    side,
                    request.HasDonateGold ? request.DonateGold : DefaultDonateGold);
                return;
            case "claim_angel_str":
                HandleClaimAngel(wr, player, role, npcName, side, AngelStrItemId, "STR");
                return;
            case "claim_angel_dex":
                HandleClaimAngel(wr, player, role, npcName, side, AngelDexItemId, "DEX");
                return;
            case "claim_angel_int":
                HandleClaimAngel(wr, player, role, npcName, side, AngelIntItemId, "INT");
                return;
            case "claim_angel_mag":
                HandleClaimAngel(wr, player, role, npcName, side, AngelMagItemId, "MAG");
                return;
            case "crusade_brief":
                HandleCrusadeBrief(player, role, npcName, side);
                return;
            default:
                SendResult(player, ok: false, "Unknown city service action.", role, npcName, side);
                return;
        }
    }

    /// <summary>
    /// City Hall free teleports for tester week. Keys stay in sync with client <c>NpcTalkDialog</c>.
    /// Landing cells prefer Olympia initial-points / GameWorlds teleport pads; transfer still snaps to nearest free dry spawn.
    /// </summary>
    public static readonly (string Key, string Label, int CostGold)[] CityHallTeleportCatalog = [
        // —— Home city ——
        ("city", "Home · City plaza", 0),
        ("farm", "Home · Farm village", 0),
        ("cityhall", "Home · City Hall (this building)", 0),
        ("shop", "Home · Shop", 0),
        ("blacksmith", "Home · Blacksmith", 0),
        ("warehouse", "Home · Warehouse", 0),
        ("cathedral", "Home · Cathedral", 0),
        ("guildhall", "Home · Guild Hall", 0),
        ("commandhall", "Home · Command Hall", 0),
        ("garden", "Home · Garden (unicorn)", 0),
        ("barracks", "Home · Farm Barracks", 0),
        ("city_dungeon", "Home · City Dungeon 1", 0),
        ("other_city", "Enemy · City plaza (test)", 0),
        ("other_farm", "Enemy · Farm village (test)", 0),
        // —— Wild / war ——
        ("middleland", "Wild · Middleland", 0),
        ("promiseland", "Wild · Promiseland", 0),
        ("middled1n", "Dungeon · Promise Land D1 (N)", 0),
        ("middled1x", "Dungeon · Promise Land D1 (S)", 0),
        ("huntzone1", "Hunt · Zone 1", 0),
        ("huntzone2", "Hunt · Zone 2", 0),
        ("huntzone3", "Hunt · Zone 3", 0),
        ("huntzone4", "Hunt · Zone 4", 0),
        ("icebound", "Wild · Icebound", 0),
        ("toh1", "Wild · Tower of Hell 1", 0),
        ("toh2", "Wild · Tower of Hell 2", 0),
        ("toh3", "Wild · Tower of Hell 3", 0),
        ("abaddon", "Wild · Abaddon", 0),
        ("infernia_a", "Wild · Infernia A", 0),
        ("infernia_b", "Wild · Infernia B", 0),
        ("procella", "Wild · Procella", 0),
        ("druncncity", "Wild · Druncnian City", 0),
        ("dglv2", "Dungeon · Level 2", 0),
        ("dglv3", "Dungeon · Level 3", 0),
        ("dglv4", "Dungeon · Level 4", 0),
        ("bisle", "Wild · Bleeding Island", 0),
        ("maze", "Wild · Maze", 0),
        ("btfield", "Event · Battlefield", 0),
        ("godh", "Event · God's Heldenian", 0),
        ("hrampart", "Event · Heldenian Rampart", 0),
        // —— Soft / test ——
        ("traveler", "Soft · Traveler Zone", 0),
        ("training", "Soft · Training Arena", 0),
        ("colosseum", "Soft · Colosseum", 0),
        ("arena1", "Soft · Arena 1", 0),
        ("resurr1", "Soft · Resurrection Zone", 0),
    ];

    static void HandleTeleportList(GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "city-hall") {
            SendResult(player, ok: false, "Only City Hall offers municipal teleports.", role, npcName, side);
            return;
        }

        var lines = new System.Text.StringBuilder();
        lines.AppendLine("City Hall teleports (Olympia-style — testing free):");
        foreach (var (key, label, cost) in CityHallTeleportCatalog) {
            lines.AppendLine(cost > 0 ? $"  · {label} ({cost}g) [{key}]" : $"  · {label} [free] [{key}]");
        }
        lines.Append("William (warehouse storage) is also in this hall.");
        SendResult(player, ok: true, lines.ToString().TrimEnd(), role, npcName, side);
    }

    static void HandleWarehouseHint(GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "city-hall") {
            SendResult(player, ok: false, "Warehouse is managed by William.", role, npcName, side);
            return;
        }

        SendResult(
            player,
            ok: true,
            "Olympia places William in City Hall for storage. Talk to William next to the desk to open your warehouse (deposit/withdraw).",
            role,
            npcName,
            side);
    }

    static void HandleCityHallTeleport(
        GameWorldRef wr,
        GameWorldPlayer player,
        string role,
        string npcName,
        string side,
        string destKey) {
        if (player.IsDead) {
            SendResult(player, ok: false, "The dead cannot take municipal teleports. Restart first.", role, npcName, side);
            return;
        }

        destKey = (destKey ?? "").Trim().ToLowerInvariant();
        var entry = default((string Key, string Label, int CostGold));
        var found = false;
        foreach (var e in CityHallTeleportCatalog) {
            if (e.Key == destKey) {
                entry = e;
                found = true;
                break;
            }
        }
        if (!found) {
            SendResult(player, ok: false, $"Unknown teleport '{destKey}'. Ask for teleport list.", role, npcName, side);
            return;
        }

        if (!TryResolveCityHallTeleport(side, destKey, out var worldId, out var x, out var y, out var resolveErr)) {
            SendResult(player, ok: false, resolveErr, role, npcName, side);
            return;
        }

        if (entry.CostGold > 0) {
            if (!player.InventoryManager.TrySpendGold(entry.CostGold, out var spendResult)) {
                SendResult(player, ok: false, $"Need {entry.CostGold} gold for {entry.Label}.", role, npcName, side);
                return;
            }
            Inventory.ApplyInventoryMutation(wr, player, spendResult);
        }

        SendResult(
            player,
            ok: true,
            $"Teleporting to {entry.Label}…",
            role,
            npcName,
            side,
            goldSpent: entry.CostGold);

        // Same-world snap vs cross-world transfer.
        if (string.Equals(wr.WorldId, worldId, StringComparison.OrdinalIgnoreCase)) {
            var maxRadius = Math.Max(wr.OccupancyTracker.SizeX, wr.OccupancyTracker.SizeY);
            var loc = Location.FindNearestFreeLocation(wr.OccupancyTracker.IsFreeSpawnCell, x, y, maxRadius)
                ?? Location.FindNearestFreeLocation(wr.OccupancyTracker.IsFreeDryCell, x, y, maxRadius);
            if (loc is null) {
                NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage("Teleport failed: no free cell."));
                return;
            }
            var prevX = player.PosX;
            var prevY = player.PosY;
            wr.OccupancyTracker.SetFree(prevX, prevY);
            wr.OccupancyTracker.SetOccupied(loc.Value.X, loc.Value.Y);
            Movement.SetPlayerPosition(wr, player, loc.Value.X, loc.Value.Y);
            Movement.SyncPlayerVisibilityAfterMovement(
                wr,
                player,
                prevX,
                prevY,
                loc.Value.X,
                loc.Value.Y,
                broadcastPlayerMoved: true,
                dashAttack: false,
                playerMovedTeleport: true);
            NetworkManager.SendToPlayer(
                player,
                NetworkManager.CreateSendMessage($"Arrived: {entry.Label} ({loc.Value.X},{loc.Value.Y})."));
            return;
        }

        player.RequestWorldChange(new WorldTransferDestination(worldId, x, y));
    }

    static bool TryResolveCityHallTeleport(
        string citizenshipSide,
        string key,
        out string worldId,
        out int x,
        out int y,
        out string error) {
        worldId = "";
        x = 0;
        y = 0;
        error = "";
        var home = citizenshipSide is "aresden" or "elvine" ? citizenshipSide : "aresden";
        var enemy = home == "aresden" ? "elvine" : "aresden";
        var are = home == "aresden";

        // Home-side building / farm world ids (side-aware).
        string HomeWorld(string areId, string elvId) => are ? areId : elvId;

        switch (key) {
            // —— Home city ——
            case "farm":
                worldId = HomeWorld("arefarm", "elvfarm");
                return Spawn.TryGetTownDefaultSpawn(worldId, out x, out y)
                    || SetFallback(out x, out y, are ? 50 : 124, are ? 95 : 151);
            case "city":
                worldId = home;
                return Spawn.TryGetTownDefaultSpawn(home, out x, out y)
                    || Recall.TryPickRandomCityPad(home, out x, out y)
                    || SetFallback(out x, out y, are ? 140 : 158, are ? 49 : 57);
            case "cityhall":
                // Interior of city hall (Kennedy's building) — mapdata initial-point.
                worldId = HomeWorld("arecityhall", "elvcityhall");
                return SetFallback(out x, out y, 50, 41);
            case "shop":
                worldId = HomeWorld("areshop", "elvshop");
                return SetFallback(out x, out y, 51, 41);
            case "blacksmith":
                worldId = HomeWorld("arebsmith", "elvbsmith");
                return SetFallback(out x, out y, 41, 37);
            case "warehouse":
                worldId = HomeWorld("arewrhus", "elvwrhus");
                return SetFallback(out x, out y, 69, 43);
            case "cathedral":
                worldId = HomeWorld("arecath", "elvcath");
                return SetFallback(out x, out y, are ? 34 : 30, are ? 42 : 43);
            case "guildhall":
                worldId = HomeWorld("aregldhall", "elvgldhall");
                return SetFallback(out x, out y, 37, 48);
            case "commandhall":
                worldId = HomeWorld("arecmdhall", "elvcmdhall");
                return SetFallback(out x, out y, 40, 52);
            case "garden":
                // Unicorn garden entrance pads from GameWorlds.
                worldId = HomeWorld("areuni", "elvuni");
                return SetFallback(out x, out y, are ? 85 : 173, are ? 23 : 24);
            case "barracks":
                worldId = HomeWorld("arebrk11", "elvbrk11");
                return SetFallback(out x, out y, 67, 70);
            case "city_dungeon":
                // Olympia city dungeon initial-points (mapdata).
                worldId = HomeWorld("aresdend1", "elvined1");
                return SetFallback(out x, out y, are ? 111 : 98, are ? 91 : 92);
            case "other_city":
                worldId = enemy;
                return Spawn.TryGetTownDefaultSpawn(enemy, out x, out y)
                    || Recall.TryPickRandomCityPad(enemy, out x, out y)
                    || SetFallback(out x, out y, enemy == "aresden" ? 140 : 158, enemy == "aresden" ? 49 : 57);
            case "other_farm":
                worldId = enemy == "aresden" ? "arefarm" : "elvfarm";
                return Spawn.TryGetTownDefaultSpawn(worldId, out x, out y)
                    || SetFallback(out x, out y, enemy == "aresden" ? 50 : 124, enemy == "aresden" ? 95 : 151);

            // —— Wild / dungeon (fixed world ids) ——
            // Prefer Olympia initial-points / known dry teleport pads. Transfer snaps to free dry cell.
            case "middleland":
            case "ml":
                // Near Aresden ML gate pads (dry road), not map center water.
                worldId = "middleland";
                return SetFallback(out x, out y, 152, 500);
            case "dungeon": // legacy key
            case "middled1n":
                worldId = "middled1n";
                return SetFallback(out x, out y, 181, 124);
            case "middled1x":
                worldId = "middled1x";
                return SetFallback(out x, out y, 70, 108);
            case "promiseland":
            case "pl":
                // mapdata 2ndmiddle initial-point 125,125
                worldId = "promiseland";
                return SetFallback(out x, out y, 125, 125);
            case "icebound":
                // mapdata icebound initial-point 264,260
                worldId = "icebound";
                return SetFallback(out x, out y, 264, 260);
            case "huntzone1":
                worldId = "huntzone1";
                return SetFallback(out x, out y, 50, 122);
            case "huntzone2":
                worldId = "huntzone2";
                return SetFallback(out x, out y, 44, 90);
            case "huntzone3":
                // GameWorlds teleport pad
                worldId = "huntzone3";
                return SetFallback(out x, out y, 50, 166);
            case "huntzone4":
                worldId = "huntzone4";
                return SetFallback(out x, out y, 23, 93);
            case "toh1":
                worldId = "toh1";
                return SetFallback(out x, out y, 145, 32);
            case "toh2":
                worldId = "toh2";
                return SetFallback(out x, out y, 39, 38);
            case "toh3":
                worldId = "toh3";
                return SetFallback(out x, out y, 93, 40);
            case "abaddon":
                // No mapdata pad — use inland-ish anchor; IsFreeSpawnCell snaps off water/walls.
                worldId = "abaddon";
                return SetFallback(out x, out y, 60, 60);
            case "infernia_a":
            case "infernia-a":
                worldId = "infernia-a";
                return SetFallback(out x, out y, 50, 50);
            case "infernia_b":
            case "infernia-b":
                worldId = "infernia-b";
                return SetFallback(out x, out y, 50, 50);
            case "procella":
                worldId = "procella";
                return SetFallback(out x, out y, 50, 50);
            case "druncncity":
                worldId = "druncncity";
                return SetFallback(out x, out y, 80, 80);
            case "dglv2":
                worldId = "dglv2";
                return SetFallback(out x, out y, 40, 40);
            case "dglv3":
                worldId = "dglv3";
                return SetFallback(out x, out y, 40, 40);
            case "dglv4":
                worldId = "dglv4";
                return SetFallback(out x, out y, 40, 40);
            case "bisle":
                worldId = "bisle";
                return SetFallback(out x, out y, 60, 60);
            case "maze":
                worldId = "maze";
                return SetFallback(out x, out y, 40, 40);
            case "btfield":
                worldId = "btfield";
                return SetFallback(out x, out y, 50, 50);
            case "godh":
                worldId = "godh";
                return SetFallback(out x, out y, 50, 50);
            case "hrampart":
                worldId = "hrampart";
                return SetFallback(out x, out y, 50, 50);

            // —— Soft / test ——
            case "traveler":
                worldId = "traveler";
                return Spawn.TryGetTravelerDefaultSpawn("traveler", out x, out y)
                    || SetFallback(out x, out y, Spawn.TravelerDefaultSpawnX, Spawn.TravelerDefaultSpawnY);
            case "training":
                worldId = "training";
                return SetFallback(out x, out y, 50, 50);
            case "colosseum":
                worldId = "colosseum";
                return SetFallback(out x, out y, 50, 50);
            case "arena1":
                worldId = "arena1";
                return SetFallback(out x, out y, 50, 50);
            case "resurr1":
                worldId = "resurr1";
                return SetFallback(out x, out y, 40, 40);

            default:
                error = $"Unknown destination '{key}'. Ask for teleport list.";
                return false;
        }
    }

    static bool SetFallback(out int x, out int y, int fx, int fy) {
        x = fx;
        y = fy;
        return true;
    }

    static void HandleRegisterGuildInterest(GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "guild-hall") {
            SendResult(player, ok: false, "Only Howard keeps the guild registry.", role, npcName, side);
            return;
        }

        var already = player.GuildInterestRegistered;
        player.SetGuildInterestRegistered(true);
        BeginnerPath.OnGuildHallInterest(player);

        var message = already
            ? "You are already on the guild interest register. Full guild create/join ships later (Fase H)."
            : "Registered. Your interest in guilds is on file — enough for training. Full guild create/join ships later (Fase H).";
        SendResult(player, ok: true, message, role, npcName, side);
    }

    static void HandleCityBrief(GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "city-hall") {
            SendResult(player, ok: false, "Only Kennedy handles city hall briefs.", role, npcName, side);
            return;
        }

        var message = side switch {
            "aresden" => "You stand in Aresden. Citizenship is set by the Traveler Zone city pick — papers are on file here.",
            "elvine" => "You stand in Elvine. Citizenship is set by the Traveler Zone city pick — papers are on file here.",
            "traveler" => "Travelers have no city papers yet. Choose Aresden or Elvine in the Traveler Zone first.",
            _ => "This hall keeps city records. Classic services (rename, contribution) are not live yet.",
        };
        SendResult(player, ok: true, message, role, npcName, side);
    }

    static void HandleHeal(GameWorldRef wr, GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "cathedral") {
            SendResult(player, ok: false, "Only Gail offers cathedral healing.", role, npcName, side);
            return;
        }

        if (player.IsDead) {
            SendResult(player, ok: false, "The fallen need resurrection rites — heal cannot raise the dead.", role, npcName, side);
            return;
        }

        if (player.Hp >= player.MaxHp) {
            SendResult(player, ok: true, "You are already at full health.", role, npcName, side);
            return;
        }

        if (!player.InventoryManager.TrySpendGold(HealGoldCost, out var spendResult)) {
            SendResult(player, ok: false, $"Need {HealGoldCost} gold for a cathedral heal.", role, npcName, side);
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, spendResult);
        player.ApplyHeal(player.MaxHp - player.Hp);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateHpUpdated(player.Hp, player.MaxHp));
        Party.NotifyVitalsChanged(player);
        SendResult(
            player,
            ok: true,
            $"Gail restores your wounds (−{HealGoldCost}g).",
            role,
            npcName,
            side,
            goldSpent: HealGoldCost);
    }

    static void HandleBless(GameWorldRef wr, GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "cathedral") {
            SendResult(player, ok: false, "Only Gail offers cathedral blessings.", role, npcName, side);
            return;
        }

        if (player.IsDead) {
            SendResult(player, ok: false, "Blessings cannot reach the fallen.", role, npcName, side);
            return;
        }

        if (HasProtectFamilyBuff(player)) {
            SendResult(player, ok: true, "A protection blessing is already upon you.", role, npcName, side, blessed: true);
            return;
        }

        if (!player.InventoryManager.TrySpendGold(BlessGoldCost, out var spendResult)) {
            SendResult(player, ok: false, $"Need {BlessGoldCost} gold for a blessing.", role, npcName, side);
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, spendResult);
        player.ApplyTemporaryEffect(
            wr,
            BlessEffectType,
            BlessEffectGroup,
            BlessDurationMs,
            movementSpeedModifier: 0,
            attackSpeedModifier: 0,
            castSpeedModifier: 0);
        SendResult(
            player,
            ok: true,
            $"Gail grants Protection From Magic for 60s (−{BlessGoldCost}g).",
            role,
            npcName,
            side,
            goldSpent: BlessGoldCost,
            blessed: true);
    }

    /// <summary>
    /// Olympia GetAngelHandler / Gail CMD Hall: Tutelary Angel pendant for 5 majestics.
    /// Base pendant = upgrade nibble 0 → +1 stat when equipped; upgrade with majestics to +15.
    /// Available once the character can hold majestics (max level / block-level farm).
    /// </summary>
    static void HandleClaimAngel(
        GameWorldRef wr,
        GameWorldPlayer player,
        string role,
        string npcName,
        string side,
        int itemId,
        string statLabel) {
        // Gail (cathedral) is the product desk; Perry command-hall also accepts for Olympia location parity.
        if (role is not ("cathedral" or "command-hall")) {
            SendResult(player, ok: false, "Only Gail (cathedral / command) hands out Tutelary Angels.", role, npcName, side);
            return;
        }

        var maxLevel = Progression.Config?.MaxLevel ?? 150;
        if (player.Level < maxLevel && !player.LevelBlocked) {
            SendResult(
                player,
                ok: false,
                $"Tutelary Angels require level {maxLevel} (or Block Level). You are L{player.Level}. Farm to max, then earn majestics.",
                role,
                npcName,
                side);
            return;
        }

        if (player.MajesticPoints < AngelMajesticCost) {
            SendResult(
                player,
                ok: false,
                $"Need {AngelMajesticCost} majestics (have {player.MajesticPoints}). At max level, kill exp becomes majestics.",
                role,
                npcName,
                side);
            return;
        }

        if (!PlayerDerivedStats.CanCarryAdditional(player, itemId, 1)) {
            SendResult(player, ok: false, "Too heavy to receive the pendant — free bag weight first.", role, npcName, side);
            return;
        }

        if (!player.TrySpendMajesticPoints(AngelMajesticCost)) {
            SendResult(player, ok: false, $"Need {AngelMajesticCost} majestics.", role, npcName, side);
            return;
        }

        if (!player.InventoryManager.TryCreateItemStack(itemId, 1, out var grantResult)) {
            player.AddMajesticPoints(AngelMajesticCost); // refund
            SendResult(player, ok: false, "Your bag is full.", role, npcName, side);
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, grantResult);

        // Soulbound (Olympia unique-owner touch) — pendant is bound to the character.
        InventoryItemState? granted = null;
        foreach (var bag in player.InventoryManager.BagItems) {
            if (bag.ItemId == itemId) {
                granted = bag;
            }
        }
        if (granted is not null && granted.BindState == ItemBind.BindStateUnbound) {
            granted.BindState = ItemBind.BindStateSoulbound;
            granted.BoundGuildId = "";
            // Base +0 nibble → equip bonus +1 (upgrade nibble + 1).
            granted.ItemAttribute = MajesticUpgrade.SetUpgradeLevel(granted.ItemAttribute, 0);
            var mut = new InventoryMutationResult();
            mut.AddedToBag.Add(granted.Clone());
            Inventory.ApplyInventoryMutation(wr, player, mut);
        }

        Progression.SendProgressionUpdated(player, leveledUp: false);
        SendResult(
            player,
            ok: true,
            $"Gail hands you Angelic Pandent({statLabel}) (−{AngelMajesticCost} majestics → {player.MajesticPoints} left). Equip accessory; upgrade with majestics in bag (RMB) toward +15.",
            role,
            npcName,
            side);
        Console.WriteLine(
            $"[CityNpc] {player.CharacterName} claimed angel {statLabel} id={itemId} maj left={player.MajesticPoints}");
    }

    static void HandleDonate(
        GameWorldRef wr,
        GameWorldPlayer player,
        string role,
        string npcName,
        string side,
        int amount) {
        if (role != "cathedral") {
            SendResult(player, ok: false, "Only Gail accepts cathedral donations.", role, npcName, side);
            return;
        }

        var gold = Math.Clamp(amount, MinDonateGold, MaxDonateGold);
        if (!player.InventoryManager.TrySpendGold(gold, out var spendResult)) {
            SendResult(player, ok: false, $"Need {gold} gold to donate.", role, npcName, side);
            return;
        }

        Inventory.ApplyInventoryMutation(wr, player, spendResult);
        SendResult(
            player,
            ok: true,
            $"The cathedral accepts your offering of {gold}g. May fortune favor you.",
            role,
            npcName,
            side,
            goldSpent: gold);
    }

    static void HandleCrusadeBrief(GameWorldPlayer player, string role, string npcName, string side) {
        if (role != "command-hall") {
            SendResult(player, ok: false, "Only Perry briefs war command.", role, npcName, side);
            return;
        }

        var message =
            "Crusade is not scheduled. When war horns sound, this hall will post side orders, FOE rules, and rally points. " +
            "For now: keep your city strong and train.";
        SendResult(player, ok: true, message, role, npcName, side, crusadeStatus: "inactive");
    }

    static void SendOpenSnapshot(GameWorldPlayer player, string role, string npcName, string side) {
        var message = role switch {
            "guild-hall" => player.GuildInterestRegistered
                ? "Welcome back. You are on the guild interest register."
                : "Welcome to the Guild Hall. Register interest for training — full guild ops come later.",
            "city-hall" => "City Hall. Free tester teleports to every map (Page list below). William = warehouse.",
            "cathedral" =>
                $"Cathedral. Heal / bless / donate. Tutelary Angels (STR/DEX/INT/MAG) for {AngelMajesticCost} majestics each at L{Progression.Config?.MaxLevel ?? 150}+ (you have {player.MajesticPoints} maj).",
            "command-hall" =>
                $"Command Hall. Crusade brief + Tutelary Angels ({AngelMajesticCost} maj each · you have {player.MajesticPoints} maj).",
            _ => "Greetings.",
        };
        SendResult(player, ok: true, message, role, npcName, side);
    }

    static bool TryValidateCityNpc(
        GameWorldRef wr,
        GameWorldPlayer player,
        long npcId,
        out GameWorldNPC npc,
        out string role,
        out string error) {
        npc = null!;
        role = string.Empty;
        error = string.Empty;

        if (!wr.NpcsByNpcId.TryGetValue(npcId, out var found)) {
            error = "That NPC is not here.";
            return false;
        }

        role = RoleForCatalog(found.CatalogNpcId);
        if (string.IsNullOrEmpty(role)) {
            error = "You must talk to a city service NPC.";
            return false;
        }

        var dist = Math.Max(Math.Abs(player.PosX - found.PosX), Math.Abs(player.PosY - found.PosY));
        if (dist > MaxInteractDistance) {
            error = $"Move closer to {RoleLabel(role)}.";
            return false;
        }

        npc = found;
        return true;
    }

    static string RoleForCatalog(int catalogNpcId) => catalogNpcId switch {
        HowardCatalogNpcId => "guild-hall",
        KennedyCatalogNpcId => "city-hall",
        GailCatalogNpcId => "cathedral",
        PerryCatalogNpcId => "command-hall",
        _ => string.Empty,
    };

    static string RoleLabel(string role) => role switch {
        "guild-hall" => "Howard",
        "city-hall" => "Kennedy",
        "cathedral" => "Gail",
        "command-hall" => "Perry",
        _ => "the NPC",
    };

    /// <summary>Maps a world id to citizenship side for auction city gates (aresden / elvine / traveler / neutral).</summary>
    public static string ResolveCitizenshipSidePublic(string worldId) => ResolveCitizenshipSide(worldId);

    static string ResolveCitizenshipSide(string worldId) {
        if (string.IsNullOrWhiteSpace(worldId)) {
            return "unknown";
        }

        var id = worldId.Trim().ToLowerInvariant();
        if (id is "traveler" or "traveller") {
            return "traveler";
        }

        if (id.StartsWith("are", StringComparison.Ordinal) || id.Contains("aresden", StringComparison.Ordinal)) {
            return "aresden";
        }

        if (id.StartsWith("elv", StringComparison.Ordinal) || id.Contains("elvine", StringComparison.Ordinal)) {
            return "elvine";
        }

        return "neutral";
    }

    static string BuildCityServicesSummary(string side) {
        var citizen = side switch {
            "aresden" => "Citizen context: Aresden.",
            "elvine" => "Citizen context: Elvine.",
            "traveler" => "Citizen context: Traveler (no papers).",
            _ => "Citizen context: open-world / neutral map.",
        };
        return citizen +
            " Live: citizenship brief, FREE teleports to all maps (tester week), warehouse via William. " +
            "Landings use dry pads + auto snap off water.";
    }

    /// <summary>True when any protect-family (group 7) buff is already active — same gate as spell buffs.</summary>
    static bool HasProtectFamilyBuff(GameWorldPlayer player) {
        return player.HasTemporaryEffect(TemporaryEffectType.ProtectFromMagic)
            || player.HasTemporaryEffect(TemporaryEffectType.ProtectFromArrow)
            || player.HasTemporaryEffect(TemporaryEffectType.AbsoluteMagicProtect);
    }

    static bool IsRequestForCurrentWorld(GameWorldRef wr, string requestWorldId) {
        return string.Equals(requestWorldId, wr.WorldId, StringComparison.Ordinal);
    }

    static void SendResult(
        GameWorldPlayer player,
        bool ok,
        string message,
        string role,
        string npcName,
        string citizenshipSide,
        int goldSpent = 0,
        string? crusadeStatus = null,
        bool? blessed = null) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateCityNpcServiceResult(
                ok,
                message,
                role ?? string.Empty,
                npcName ?? string.Empty,
                player.GuildInterestRegistered,
                BuildCityServicesSummary(citizenshipSide),
                citizenshipSide,
                player.Hp,
                player.MaxHp,
                goldSpent,
                crusadeStatus ?? (role == "command-hall" ? "inactive" : string.Empty),
                blessed ?? player.HasTemporaryEffect(BlessEffectType)));
    }
}
