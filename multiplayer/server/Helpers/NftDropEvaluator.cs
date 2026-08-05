using Server.Utils;

namespace Server.Helpers;

/// <summary>
/// F6 Item Drops / NFT tier gate — keep in sync with client
/// <c>mp-client/src/utils/olympiaDropRules.ts</c>.
/// Only high-value pickups: legendary bases, stated gear thresholds (HP/MP/DR/MR≥35, any PA/MA),
/// CIC4+, and crafting stones (no Vortex).
/// </summary>
public static class NftDropEvaluator {
    /// <summary>Magic-roll / stated gear that qualifies for the frequent Rare cNFT collection.</summary>
    public const string TierRare = "rare";

    /// <summary>Named endgame Olympia items for the Legendary collection.</summary>
    public const string TierSuperRare = "super_rare";

    /// <summary>Legendary bases (product list + endgame named sets).</summary>
    static readonly HashSet<int> SuperRareItemIds = [
        // Berserk wands
        861, 862,
        // Necklace of Xelima / Merien / Ice Elemental / Medusa
        860, 858, 643, 641,
        // Ring of Abaddon / Xelima
        631, 630,
        // Devastator / Storm Bringer / Bane
        846, 845, 872,
        // Manuals: Cancel, I.M.C, Mass Blizzard, Sleep, Ice Storm
        852, 857, 873, 874, 380,
        // Xelima weapons
        610, 611, 612,
        // Merien armor / shield
        620, 621, 622,
        // Dark Knight (M/W)
        706, 707, 708, 709, 710, 717, 718, 737,
        724, 725, 726, 727, 728,
        // Kloness
        849, 850, 851, 859, 863, 864,
    ];

    static readonly HashSet<int> StoneItemIds = [
        650, // Zemstone
        656, // Stone of Xelima
        657, // Stone of Merien
        507, // Blonde Stone
        1112, // Stone of Integrity
    ];

    static readonly HashSet<int> NamedRareItemIds = [
        490, 491, 492, // Blood
        613, 614, // Medusa / Ice Elemental swords
        633, 735, // Demonpower / Dragonpower
        847, // Dark Executor
        382, // Bloody Shock Wave Manual
        853, // E.S.W Manual
        762, // Giant Battle Hammer (gen9–10 rare weapon — not common gear)
        843, // Barbarian Hammer (gen10 rare weapon)
        1314, 1315, 1316, // MS22 charge wands (Inhib / Cancel / MIM)
        1320, 1321, 1322, // Devlin / Superior / Exceptional Devlin Shield (cast-with-shield rares)
    ];

    /// <returns><c>null</c> when the pickup should not be recorded in drop_ledger / F6 log.</returns>
    public static string? EvaluateNftTier(int itemId, uint itemAttribute, int cicLevel = 0) {
        if (SuperRareItemIds.Contains(itemId)) {
            return TierSuperRare;
        }

        if (StoneItemIds.Contains(itemId)) {
            return TierRare;
        }

        if (NamedRareItemIds.Contains(itemId)) {
            return TierRare;
        }

        if (cicLevel >= 4) {
            return TierRare;
        }

        return IsStatedGearThreshold(itemAttribute) ? TierRare : null;
    }

    public static bool IsNftCandidate(ItemConfig item, uint itemAttribute, int cicLevel = 0) {
        return EvaluateNftTier(item.Id, itemAttribute, cicLevel) is not null;
    }

    public static bool IsSuperRareItemId(int itemId) => SuperRareItemIds.Contains(itemId);

    /// <summary>
    /// Stated gear: any PA/MA, or HP/MP/DR/MR display % ≥ 35 (nibble × 7).
    /// Dual magic alone no longer qualifies (was flooding F6 with low junk).
    /// </summary>
    public static bool IsStatedGearThreshold(uint itemAttribute) {
        if (itemAttribute == 0) {
            return false;
        }

        var primaryType = (itemAttribute >> 20) & 0xF;
        var primaryValue = (itemAttribute >> 16) & 0xF;
        var secondaryType = (itemAttribute >> 12) & 0xF;
        var secondaryValue = (itemAttribute >> 8) & 0xF;

        if (IsPaOrMa(primaryType, primaryValue) || IsPaOrMa(secondaryType, secondaryValue)) {
            return true;
        }

        if (HpMpDrMrPercent(primaryType, primaryValue) >= 35 ||
            HpMpDrMrPercent(secondaryType, secondaryValue) >= 35) {
            return true;
        }

        return false;
    }

    /// <summary>Legacy name kept for callers — now uses stated-gear thresholds only.</summary>
    public static bool IsMagicRollNftCandidate(uint itemAttribute) =>
        IsStatedGearThreshold(itemAttribute);

    static bool IsPaOrMa(uint type, uint value) =>
        value > 0 && type is 8 or 9;

    /// <summary>DR(3) / HP(4) / MP(6) / MR(7) → value×7 display %.</summary>
    static int HpMpDrMrPercent(uint type, uint value) {
        if (value == 0) {
            return 0;
        }

        return type switch {
            3 or 4 or 6 or 7 => (int)value * 7,
            _ => 0,
        };
    }
}
