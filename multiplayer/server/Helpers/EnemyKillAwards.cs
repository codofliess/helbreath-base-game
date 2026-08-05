using Mmorpg.Network;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Open-world Enemy Kill eligibility (±10 level) and gallery rarity from opposing-city killer rank.
/// Rank/ladder lookup is stubbed until the city killer board exists.
/// </summary>
public static class EnemyKillAwards {
    /// <summary>Victim must be at least killer level − 10 (includes equals and superiors).</summary>
    public const int MaxLevelAdvantageOverVictim = 10;

    /// <summary>
    /// Returns true when this PvP death should award an EK (and thus an auto-screenshot signal).
    /// Tournament arenas never award open-world EKs.
    /// </summary>
    public static bool IsEligibleEnemyKill(GameWorldPlayer killer, GameWorldPlayer victim, bool isTournamentArena) {
        if (isTournamentArena || killer is null || victim is null) {
            return false;
        }

        if (ReferenceEquals(killer, victim) || killer.PlayerId == victim.PlayerId) {
            return false;
        }

        // Same explicit city citizenship → not an Enemy Kill (travelers / empty sides still eligible in MVP).
        var killerSide = NormalizeSide(killer.CitizenshipSide);
        var victimSide = NormalizeSide(victim.CitizenshipSide);
        if (killerSide is "aresden" or "elvine"
            && victimSide is "aresden" or "elvine"
            && killerSide == victimSide) {
            return false;
        }

        return victim.Level >= killer.Level - MaxLevelAdvantageOverVictim;
    }

    /// <summary>
    /// Locked PO gallery rarity from opposing-city killer rank. Null/out-of-range → Unspecified.
    /// </summary>
    public static EkScreenshotRarity RarityFromOpposingCityKillerRank(int? rank) {
        if (!rank.HasValue || rank.Value < 1) {
            return EkScreenshotRarity.Unspecified;
        }

        if (rank.Value <= 10) {
            return EkScreenshotRarity.Legendary;
        }

        if (rank.Value <= 50) {
            return EkScreenshotRarity.Rare;
        }

        if (rank.Value <= 200) {
            return EkScreenshotRarity.Common;
        }

        return EkScreenshotRarity.Unspecified;
    }

    /// <summary>
    /// Placeholder until a per-city killer ladder exists. Always returns null so rarity stays Unspecified in MVP.
    /// </summary>
    public static int? TryGetOpposingCityKillerRank(GameWorldPlayer victim) {
        _ = victim;
        return null;
    }

    private static string NormalizeSide(string? side) {
        return (side ?? string.Empty).Trim().ToLowerInvariant();
    }
}
