using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Bleeding Island arena social lobby (<c>arena-bleeding</c> — map bisle clone).
/// Safe hub for hanging out / arranging duels; open PvP outside the radius.
/// When a pact duel goes live, fighters are locked out of the safe until death or match end.
/// </summary>
public static class ArenaBleeding {
    public const string WorldId = "arena-bleeding";

    /// <summary>
    /// Lobby / revive pad = stone platform (circle tile) near map center of bisle.
    /// Minimap: grey square platform mid-island — not the dirt fields west of it.
    /// </summary>
    public const int SafeCenterX = 137;
    public const int SafeCenterY = 125;
    /// <summary>Tight radius so “safe” is the platform itself, not the whole island.</summary>
    public const int SafeRadius = 10;

    public static bool IsArenaBleedingWorld(string? worldId) =>
        string.Equals(worldId?.Trim(), WorldId, StringComparison.OrdinalIgnoreCase);

    public static bool IsInSafeZone(int x, int y) =>
        Math.Max(Math.Abs(x - SafeCenterX), Math.Abs(y - SafeCenterY)) <= SafeRadius;

    /// <summary>
    /// True when a live-duel fighter is trying to step (or stay) into the safe pad.
    /// </summary>
    public static bool BlocksSafeEntry(GameWorldPlayer player, string worldId, int destX, int destY) {
        if (player is null || !player.ArenaSafeZoneLocked) {
            return false;
        }
        if (!IsArenaBleedingWorld(worldId)) {
            return false;
        }
        return IsInSafeZone(destX, destY);
    }

    public static void GetSafeSpawn(out int x, out int y) {
        x = SafeCenterX;
        y = SafeCenterY;
    }
}
