using System;

namespace Server.Helpers;

/// <summary>
/// Restart! destination policy. Chile / Olympia send citizens to city pads.
/// Garden and hunt-zone deaths always return to town so Magias testers are not
/// corpse-revived into Giant Tree / Unicorn (elvuni) or HZ hostiles.
/// Opt out of the global default with <c>REVIVE_TO_TOWN=0</c> (farm PvP testing);
/// that flag never overrides garden / hunt-zone forced town revive.
/// </summary>
public static class RevivePolicy {
    /// <summary>Worlds with no city streets — corpse revive is a death loop.</summary>
    public static bool IsForcedTownReviveWorld(string? worldId) {
        if (string.IsNullOrWhiteSpace(worldId)) {
            return false;
        }

        var id = worldId.Trim();
        if (GardenQuests.IsGardenWorld(id)) {
            return true;
        }

        return id.StartsWith("huntzone", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// When true, Restart! uses city pads / traveler hub instead of the corpse cell.
    /// Unset or <c>1</c>/<c>true</c> → town (Chile default). <c>0</c>/<c>false</c> → corpse,
    /// except on forced-town worlds.
    /// </summary>
    public static bool ShouldReviveToTown(string? worldId) {
        if (IsForcedTownReviveWorld(worldId)) {
            return true;
        }

        var flag = Environment.GetEnvironmentVariable("REVIVE_TO_TOWN");
        if (string.IsNullOrWhiteSpace(flag)) {
            return true;
        }

        return string.Equals(flag, "1", StringComparison.Ordinal)
            || string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);
    }
}
