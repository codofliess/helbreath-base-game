using System.Collections.Generic;

namespace Server.Helpers;

/// <summary>
/// Chain Lords map level brackets (PL outdoor ≤110, PL Dungeons ≤120).
/// Populated once from <c>GameWorlds.json</c> <c>maxPlayerLevel</c> / <c>minPlayerLevel</c>.
/// </summary>
public static class WorldLevelGates {
    static readonly Dictionary<string, (int? Min, int? Max)> capsByWorldId =
        new(StringComparer.Ordinal);

    public static void Initialize(IEnumerable<GameWorldConfig> worlds) {
        ArgumentNullException.ThrowIfNull(worlds);
        capsByWorldId.Clear();
        foreach (var w in worlds) {
            if (w.MinPlayerLevel is null && w.MaxPlayerLevel is null) {
                continue;
            }
            capsByWorldId[w.Id] = (w.MinPlayerLevel, w.MaxPlayerLevel);
        }
        Console.WriteLine($"[WorldLevelGates] Loaded level caps for {capsByWorldId.Count} world(s).");
    }

    /// <summary>Returns false when the player's level is outside the destination world's bracket.</summary>
    public static bool CanEnter(string worldId, int playerLevel, out string? error) {
        error = null;
        if (string.IsNullOrWhiteSpace(worldId) || !capsByWorldId.TryGetValue(worldId, out var cap)) {
            return true;
        }

        if (cap.Min is int min && playerLevel < min) {
            error = $"Requires level {min}+ to enter.";
            return false;
        }
        if (cap.Max is int max && playerLevel > max) {
            error = $"Max level {max} for this map (you are L{playerLevel}). Use Block Level to park mid-bracket.";
            return false;
        }
        return true;
    }
}
