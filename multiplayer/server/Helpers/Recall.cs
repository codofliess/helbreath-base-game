using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Recall spell / scroll (Olympia <c>RequestTeleportHandler</c> mode '1').
/// Lands on mapdata <c>initial-point</c> gray platforms — NOT intermap warp corridors.
/// With city papers: always city multi-pad dice (guard TP platforms) so repeated Recalls
/// rotate around the city. Without papers: traveler hub. Farm pads remain for farm→city gray warps.
/// </summary>
public static class Recall {
    /// <summary>
    /// Legacy Olympia break (farm under 80 / city at 80+). Unused for spell Recall destination —
    /// citizens always land on city pads so multi-TP rotation works at any level.
    /// </summary>
    public const int CityRecallMinLevel = 80;

    public const int RecallScrollItemId = 114;
    public const int ServerRecallSpellId = 50;

    /// <summary>
    /// Olympia mapdata initial-point coords (gray platforms).
    /// Source: tmp-mapdata aresden/elvine/arefarm/elvfarm.
    /// </summary>
    static readonly Dictionary<string, (int X, int Y)[]> RecallPadsByWorld = new(StringComparer.OrdinalIgnoreCase) {
        ["aresden"] = [
            (140, 49),
            (68, 125),
            (170, 145),
            (140, 205),
            (116, 245),
        ],
        ["elvine"] = [
            (158, 57),
            (110, 89),
            (170, 145),
            (242, 129),
            (158, 249),
        ],
        // Recall lands a few steps NE of the gray warp platform (platform = city TP; not the landing cell).
        // Elvine farm platform center (117,158) from live client coords; Aresden (50,95).
        // Landing = +3 X, -3 Y (diagonal up-right on map).
        ["arefarm"] = [
            (53, 92),
        ],
        ["elvfarm"] = [
            (120, 155),
        ],
        ["traveler"] = [
            (Spawn.TravelerDefaultSpawnX, Spawn.TravelerDefaultSpawnY),
        ],
    };

    /// <summary>Safe AFK zone = Chebyshev radius around each gray pad (matches guard dwell ±3).</summary>
    const int SafeZoneRadius = 3;

    /// <summary>Gray farm platforms that warp to city (also AFK guard hubs). Coords = visual pad center.</summary>
    public static readonly Dictionary<string, (int X, int Y)> FarmGrayPadByWorld = new(StringComparer.OrdinalIgnoreCase) {
        ["arefarm"] = (50, 95),
        ["elvfarm"] = (117, 158),
    };

    public static bool IsInGuardedTeleportSafeZone(string worldId, int x, int y) {
        if (string.IsNullOrWhiteSpace(worldId)) {
            return false;
        }

        var wid = worldId.Trim();
        if (RecallPadsByWorld.TryGetValue(wid, out var pads)) {
            foreach (var (px, py) in pads) {
                if (Math.Max(Math.Abs(x - px), Math.Abs(y - py)) <= SafeZoneRadius) {
                    return true;
                }
            }
        }

        // Also cover the gray warp platform itself (recall lands a few cells NE of it).
        if (FarmGrayPadByWorld.TryGetValue(wid, out var gray)) {
            if (Math.Max(Math.Abs(x - gray.X), Math.Abs(y - gray.Y)) <= SafeZoneRadius) {
                return true;
            }
        }

        return false;
    }

    /// <summary>Random city initial-point (Olympia multi-pad dice) for farm→city gray-pad warps.</summary>
    public static bool TryPickRandomCityPad(string cityWorldId, out int x, out int y) {
        x = 0;
        y = 0;
        if (string.IsNullOrWhiteSpace(cityWorldId) ||
            !RecallPadsByWorld.TryGetValue(cityWorldId.Trim(), out var pads) ||
            pads.Length == 0) {
            return false;
        }

        var pick = pads.Length == 1 ? 0 : Random.Shared.Next(pads.Length);
        x = pads[pick].X;
        y = pads[pick].Y;
        return true;
    }

    /// <summary>True when standing on the farm gray platform that should warp to the city.</summary>
    public static bool IsOnFarmGrayWarpPad(string farmWorldId, int x, int y) {
        if (!FarmGrayPadByWorld.TryGetValue(farmWorldId, out var gray)) {
            return false;
        }

        // 3×3 platform footprint around pad center.
        return Math.Max(Math.Abs(x - gray.X), Math.Abs(y - gray.Y)) <= 1;
    }

    /// <summary>
    /// Resolves destination world + one random initial-point (Olympia GetMapInitialPoint dice).
    /// </summary>
    public static bool TryResolveDestination(
        GameWorldPlayer player,
        string currentWorldId,
        out string worldId,
        out int x,
        out int y,
        out string reason) {
        worldId = "";
        x = 0;
        y = 0;
        reason = "";

        if (player.IsDead) {
            reason = "Cannot recall while dead.";
            return false;
        }

        var side = ResolveSide(player, currentWorldId);
        var level = player.Level;

        // Citizens always land on city multi-pad hubs (guard TP platforms). Farm single-pad
        // made repeated Recalls feel broken under L80 ("always the same spot").
        if (side == "aresden") {
            worldId = "aresden";
            reason = $"Recall (L{level}) → Aresden city TP pad.";
        } else if (side == "elvine") {
            worldId = "elvine";
            reason = $"Recall (L{level}) → Elvine city TP pad.";
        } else {
            worldId = "traveler";
            reason = "Recall → Traveler hub (no city papers).";
        }

        if (!RecallPadsByWorld.TryGetValue(worldId, out var pads) || pads.Length == 0) {
            reason = "Recall pad config missing.";
            return false;
        }

        // Placeholder coords — TryExecute re-rolls with avoid-current via TryPickPad.
        x = pads[0].X;
        y = pads[0].Y;
        return true;
    }

    /// <summary>
    /// Random pad among world hubs; prefers a different platform than the player's current cell
    /// so spam-Recall rotates around the city.
    /// </summary>
    static bool TryPickPad(
            string worldId,
            int avoidX,
            int avoidY,
            out int x,
            out int y,
            out string padNote) {
        x = 0;
        y = 0;
        padNote = "";
        if (!RecallPadsByWorld.TryGetValue(worldId, out var pads) || pads.Length == 0) {
            return false;
        }

        if (pads.Length == 1) {
            x = pads[0].X;
            y = pads[0].Y;
            padNote = $"({x},{y})";
            return true;
        }

        var different = new List<int>();
        for (var i = 0; i < pads.Length; i++) {
            var (px, py) = pads[i];
            if (Math.Max(Math.Abs(px - avoidX), Math.Abs(py - avoidY)) > SafeZoneRadius) {
                different.Add(i);
            }
        }

        var pool = different.Count > 0 ? different : Enumerable.Range(0, pads.Length).ToList();
        var pick = pool[Random.Shared.Next(pool.Count)];
        x = pads[pick].X;
        y = pads[pick].Y;
        padNote = $"({x},{y}) pad {pick + 1}/{pads.Length}";
        return true;
    }

    public static bool TryExecute(GameWorldRef wr, GameWorldPlayer player, out string message) {
        ArgumentNullException.ThrowIfNull(player);

        if (!TryResolveDestination(player, wr.WorldId, out var destWorld, out _, out _, out var reason)) {
            message = reason;
            return false;
        }

        if (!TryPickPad(destWorld, player.PosX, player.PosY, out var destX, out var destY, out var padNote)) {
            message = "Recall pad config missing.";
            return false;
        }

        reason = $"{reason} {padNote}.";

        if (string.Equals(destWorld, wr.WorldId, StringComparison.OrdinalIgnoreCase)) {
            var (sx, sy) = FindSafeLanding(wr, destX, destY, destWorld);
            if (!IsInGuardedTeleportSafeZone(destWorld, sx, sy)) {
                sx = destX;
                sy = destY;
                if (!wr.OccupancyTracker.IsFree(sx, sy)) {
                    message = "Recall pad is blocked — step aside and try again.";
                    return false;
                }
            }

            var prevX = player.PosX;
            var prevY = player.PosY;
            if (sx == prevX && sy == prevY &&
                RecallPadsByWorld.TryGetValue(destWorld, out var allPads)) {
                foreach (var (px, py) in allPads) {
                    var (tx, ty) = FindSafeLanding(wr, px, py, destWorld);
                    if (tx != prevX || ty != prevY) {
                        sx = tx;
                        sy = ty;
                        break;
                    }
                }
            }

            if (sx == prevX && sy == prevY) {
                message = reason + " (already on a free pad).";
                Notify(player, message);
                return true;
            }

            wr.OccupancyTracker.SetFree(prevX, prevY);
            wr.OccupancyTracker.SetOccupied(sx, sy);
            Movement.SetPlayerPosition(wr, player, sx, sy);
            Movement.SyncPlayerVisibilityAfterMovement(
                wr,
                player,
                prevX,
                prevY,
                sx,
                sy,
                broadcastPlayerMoved: true,
                dashAttack: false,
                playerMovedTeleport: true);
            NetworkManager.SendToPlayer(player, NetworkManager.CreatePlayerTeleported(sx, sy));
            message = reason;
            Notify(player, message);
            Console.WriteLine(
                $"[Recall] {player.CharacterName} same-world {wr.WorldId} ({prevX},{prevY})→({sx},{sy}) L{player.Level}");
            return true;
        }

        player.RequestWorldChange(new WorldTransferDestination(destWorld, destX, destY));
        message = reason;
        Notify(player, message);
        Console.WriteLine(
            $"[Recall] {player.CharacterName} transfer {wr.WorldId}→{destWorld} ({destX},{destY}) L{player.Level}");
        return true;
    }

    static (int X, int Y) FindSafeLanding(GameWorldRef wr, int preferredX, int preferredY, string worldId) {
        if (wr.OccupancyTracker.IsFree(preferredX, preferredY)) {
            return (preferredX, preferredY);
        }

        for (var r = 1; r <= SafeZoneRadius; r++) {
            for (var dy = -r; dy <= r; dy++) {
                for (var dx = -r; dx <= r; dx++) {
                    if (Math.Abs(dx) != r && Math.Abs(dy) != r) {
                        continue;
                    }

                    var x = preferredX + dx;
                    var y = preferredY + dy;
                    if (!IsInGuardedTeleportSafeZone(worldId, x, y)) {
                        continue;
                    }

                    if (wr.OccupancyTracker.IsFree(x, y)) {
                        return (x, y);
                    }
                }
            }
        }

        return Spawn.GetSpawnLocation(wr, preferredX, preferredY);
    }

    static string ResolveSide(GameWorldPlayer player, string currentWorldId) {
        var side = (player.CitizenshipSide ?? "").Trim().ToLowerInvariant();
        if (side is "aresden" or "elvine") {
            return side;
        }

        // Do NOT infer from intermap world ids (arefarm etc.) when papers are missing —
        // only use explicit papers; traveler stays traveler.
        var inferred = CityNpcServices.ResolveCitizenshipSidePublic(currentWorldId);
        if (inferred is "aresden" or "elvine") {
            return inferred;
        }

        return "traveler";
    }

    static void Notify(GameWorldPlayer player, string message) {
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "System",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                message ?? ""));
    }
}
