using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Join-time path hints and citizen safe-enter so Magias testers land on Elvine
/// streets / Gandalf instead of Garden, Hunt Zone, or the slime traveler pad.
/// </summary>
public static class CityEscape {
    /// <summary>Legacy traveler / City Hall landing — Elvine slime plaza (dwell 151–166 × 122–141).</summary>
    public const int ElvineHostilePlazaX = 149;
    public const int ElvineHostilePlazaY = 131;

    /// <summary>Legacy traveler / City Hall landing — Aresden slime plaza (dwell 151–166 × 118–137).</summary>
    public const int AresdenHostilePlazaX = 149;
    public const int AresdenHostilePlazaY = 127;

    /// <summary>Chebyshev radius covering Settings view (18×11) plus the slime dwell around the old pad.</summary>
    public const int HostilePlazaSnapRadius = 18;

    /// <summary>
    /// Worlds that look like "outside town" (field / garden / HZ / farm / city dungeon).
    /// Login and death must not restore these as the city.
    /// </summary>
    public static bool IsEscapeFieldWorld(string? worldId) {
        if (string.IsNullOrWhiteSpace(worldId)) {
            return false;
        }

        var id = worldId.Trim();
        if (GardenQuests.IsGardenWorld(id)) {
            return true;
        }

        if (id.StartsWith("huntzone", StringComparison.OrdinalIgnoreCase)) {
            return true;
        }

        return id.Equals("elvfarm", StringComparison.OrdinalIgnoreCase)
            || id.Equals("arefarm", StringComparison.OrdinalIgnoreCase)
            || id.Equals("elvined1", StringComparison.OrdinalIgnoreCase)
            || id.Equals("aresdend1", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// True on the old traveler / City Hall slime pads (and the hunt dwell they sit in).
    /// View from these cells never includes Wizard Tower (180,77).
    /// </summary>
    public static bool IsHostileCityHuntPlaza(string? worldId, int x, int y) {
        if (string.Equals(worldId, "elvine", StringComparison.OrdinalIgnoreCase)) {
            return Math.Max(Math.Abs(x - ElvineHostilePlazaX), Math.Abs(y - ElvineHostilePlazaY))
                <= HostilePlazaSnapRadius;
        }

        if (string.Equals(worldId, "aresden", StringComparison.OrdinalIgnoreCase)) {
            return Math.Max(Math.Abs(x - AresdenHostilePlazaX), Math.Abs(y - AresdenHostilePlazaY))
                <= HostilePlazaSnapRadius;
        }

        return false;
    }

    /// <summary>
    /// Home-city interiors (Wizard Tower, City Hall, shop, …). Garden / farm / dungeon are excluded.
    /// </summary>
    public static bool IsHomeCityInterior(string? side, string? worldId) {
        if (string.IsNullOrWhiteSpace(side) || string.IsNullOrWhiteSpace(worldId)) {
            return false;
        }

        if (IsEscapeFieldWorld(worldId)) {
            return false;
        }

        var id = worldId.Trim().ToLowerInvariant();
        if (id is "elvine" or "aresden") {
            return false;
        }

        var s = side.Trim().ToLowerInvariant();
        if (s == "elvine") {
            return id.StartsWith("elv", StringComparison.Ordinal) || id.Contains("elvine", StringComparison.Ordinal);
        }

        if (s == "aresden") {
            return id.StartsWith("are", StringComparison.Ordinal) || id.Contains("aresden", StringComparison.Ordinal);
        }

        return false;
    }

    /// <summary>
    /// Login / first enter must leave garden, hunt-zone, farm, city dungeon, traveler hub,
    /// or the slime plaza and land on the Olympia city pad.
    /// </summary>
    public static bool ShouldForceCitySafeEnter(string? citizenshipSide, string? worldId, int x, int y) {
        if (IsEscapeFieldWorld(worldId)) {
            return true;
        }

        if (string.Equals(worldId, "traveler", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(worldId)) {
            return true;
        }

        return IsHostileCityHuntPlaza(worldId, x, y);
    }

    /// <summary>
    /// When true, <paramref name="worldId"/>/<paramref name="x"/>/<paramref name="y"/> become the town pad.
    /// Keeps Wizard Tower / City Hall / non-plaza city streets.
    /// </summary>
    public static bool TryResolveCitizenSafeEnter(
        string? citizenshipSide,
        string? requestedWorldId,
        int requestedX,
        int requestedY,
        out string worldId,
        out int x,
        out int y) {
        worldId = requestedWorldId ?? "";
        x = requestedX;
        y = requestedY;

        var side = (citizenshipSide ?? "").Trim().ToLowerInvariant();
        if (side is not ("aresden" or "elvine")) {
            side = CityNpcServices.ResolveCitizenshipSidePublic(requestedWorldId ?? "");
        }

        if (side is not ("aresden" or "elvine")) {
            return false;
        }

        if (IsHomeCityInterior(side, requestedWorldId)) {
            return false;
        }

        if (!ShouldForceCitySafeEnter(side, requestedWorldId, requestedX, requestedY)) {
            return false;
        }

        if (!Spawn.TryGetTownDefaultSpawn(side, out x, out y)) {
            x = requestedX;
            y = requestedY;
            return false;
        }

        worldId = side;
        return true;
    }

    /// <summary>Same-world remap of the slime traveler pad onto Olympia initial-point #1.</summary>
    public static bool TrySnapHostilePlazaToTown(string? worldId, int x, int y, out int townX, out int townY) {
        townX = x;
        townY = y;
        if (!IsHostileCityHuntPlaza(worldId, x, y)) {
            return false;
        }

        return Spawn.TryGetTownDefaultSpawn(worldId ?? "", out townX, out townY);
    }

    /// <summary>One system line after join / transfer onto garden, huntzone, or home city.</summary>
    public static void NotifyOnJoin(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var worldId = wr.WorldId ?? "";

        string? hint = null;
        if (string.Equals(worldId, "elvuni", StringComparison.OrdinalIgnoreCase)) {
            hint = "Elvine Garden (hostile) — not city streets. Blue wall east (176,20-28) → Hunt Zone 1, then south gate to Elvine. Restart! also returns to Elvine plaza. Gandalf is in the Wizard Tower door (180,77).";
        } else if (string.Equals(worldId, "areuni", StringComparison.OrdinalIgnoreCase)) {
            hint = "Aresden Garden (hostile) — not city streets. Blue tiles north (y=20) → Hunt Zone 2, then city. Restart! returns to Aresden plaza. Gandalf is in the Wizard Tower.";
        } else if (string.Equals(worldId, "huntzone1", StringComparison.OrdinalIgnoreCase)) {
            hint = "Hunt Zone 1. South blue tiles (y=179) → Elvine city. West blue tiles (x=20) are the Garden (Giant Tree / Unicorn). Restart! returns to Elvine plaza. Gandalf: Wizard Tower door (180,77).";
        } else if (string.Equals(worldId, "huntzone2", StringComparison.OrdinalIgnoreCase)) {
            hint = "Hunt Zone 2. North/city-side blue tiles return to Aresden. South blue tiles are the Garden. Restart! returns to Aresden plaza.";
        } else if (string.Equals(worldId, "elvine", StringComparison.OrdinalIgnoreCase)) {
            hint = "Elvine city streets. Safe plaza is (158,57). Magic Tower (Gandalf) door at (180,77) — learn Fire Strike there. City Hall (Kennedy) can teleport you to the tower.";
        } else if (string.Equals(worldId, "elvwzdtwr", StringComparison.OrdinalIgnoreCase)
            || string.Equals(worldId, "arewzdtwr", StringComparison.OrdinalIgnoreCase)) {
            hint = "Wizard Tower. Talk to Gandalf to buy / learn circle spells (Fire Strike, Recall, Triple Energy Bolt).";
        }

        if (string.IsNullOrEmpty(hint)) {
            return;
        }

        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(hint));
        NetworkManager.SendToPlayer(
            player,
            NetworkManager.CreateChatMessageReceived(
                "System",
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                hint));
    }
}
