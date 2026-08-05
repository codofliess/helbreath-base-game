namespace Server.Utils;

/// <summary>
/// Olympia NPC special abilities (Server.cpp <c>_cGetSpecialAbility</c> + exp boost on create).
/// Live Cyclops: normals ≈17k, Anti-Magic specials ≈25k (≈+47% from SA case 4 AbsDamage roll).
/// </summary>
public static class MonsterSpecialAbility {
    /// <summary>0 = none; 1 Clairvoyant; 2 Break magic protect; 3 Anti-Physical; 4 Anti-Magic; 5 Poison; 6 Crit poison; 7 Explosive; 8 Crit explosive.</summary>
    public static void RollForSpawn(string catalogName, out int specialAbility, out int expBonusPercent) {
        specialAbility = 0;
        expBonusPercent = 0;
        if (string.IsNullOrWhiteSpace(catalogName)) {
            return;
        }

        var (probPercent, kind) = LookupSpawnTable(catalogName.Trim());
        if (probPercent <= 0 || Random.Shared.Next(1, 101) > probPercent) {
            return;
        }

        specialAbility = RollKind(kind);
        expBonusPercent = ExpBonusPercentFor(specialAbility);
    }

    /// <summary>Applies stored SA exp % (already rolled at spawn) to a pre-GetExp pool.</summary>
    public static long ApplyExpBonus(long baseExp, int expBonusPercent) {
        if (baseExp <= 0 || expBonusPercent <= 0) {
            return baseExp;
        }
        return Math.Max(1, (long)Math.Round(baseExp * (1.0 + expBonusPercent / 100.0)));
    }

    private static (int ProbPercent, int Kind) LookupSpawnTable(string name) {
        // Prob/kind from Olympia Server.cpp summon/spawn tables (iProbSA / iKindSA).
        return name.ToLowerInvariant() switch {
            "slime" or "orc" or "ogre" or "orge" or "werewolf" or "were-wolf" or "stalker"
                or "hellclaw" or "wyvern" or "fire wyvern" or "barlog" or "tentocle"
                or "centaurus" or "giant lizard" or "minotaur" or "minotaurs" or "abaddon"
                or "claw turtle" or "giant cray fish" or "giant crayfish" or "giant tree"
                or "giant plant" or "master mage orc" or "nizie" or "tigerworm"
                or "mountain giant" or "rabbit" or "bunny" => (20, 1),
            "ant" or "giant-ant" or "giant ant" or "cat" or "giant frog" => (20, 2),
            "zombie" or "scorpion" or "snake" or "amphis" or "troll" or "dark elf" => (20, 3),
            "stone golem" or "clay golem" or "beholder" or "cannibal plant" or "rudolph"
                or "dire boar" => (20, 5),
            // Unicorn (open ML): high SA rate, kind 8 → Anti-Physical / Anti-Magic / Crit-Explosive / etc.
            // Garden unicorns share the same name; Olympia gardens also roll SA at lower density in practice.
            "orc mage" or "orc-mage" or "unicorn" or "middleland unicorn" => (30, 8),
            // Cyclops / Frost / Ice-Golem / Ettin / Demon / Skeleton / Hellbound / Gargoyle: 35%, kind 8
            "cyclops" or "frost" or "ice golem" or "ettin" or "demon" or "skeleton"
                or "hellhound" or "hellbound" or "gargoyle" or "gagoyle" or "liche" or "lich"
                => (35, 8),
            _ => (15, 1),
        };
    }

    private static int RollKind(int kind) => kind switch {
        1 => Random.Shared.Next(1, 3) switch { 1 => 3, _ => 4 },
        2 => Random.Shared.Next(1, 4) switch { 1 => 3, 2 => 4, _ => 5 },
        3 => Random.Shared.Next(1, 5) switch { 1 => 3, 2 => 4, 3 => 5, _ => 6 },
        4 => Random.Shared.Next(1, 4) switch { 1 => 3, 2 => 4, _ => 7 },
        5 => Random.Shared.Next(1, 5) switch { 1 => 3, 2 => 4, 3 => 7, _ => 8 },
        6 => Random.Shared.Next(1, 4) switch { 1 => 3, 2 => 4, _ => 5 },
        7 => Random.Shared.Next(1, 4) switch { 1 => 1, 2 => 2, _ => 4 },
        8 => Random.Shared.Next(1, 6) switch { 1 => 1, 2 => 2, 3 => 4, 4 => 3, _ => 8 },
        9 => Random.Shared.Next(1, 9),
        _ => 0,
    };

    /// <summary>Olympia create-NPC exp boosts (Server.cpp cases 1–8).</summary>
    private static int ExpBonusPercentFor(int specialAbility) => specialAbility switch {
        1 => 25, // Clairvoyant
        2 => 30, // Destruction of Magic Protection
        // Anti-Physical / Anti-Magic: AbsDamage = 20 + dice(1,60) → +21..80% (live anti-magic clops ~+47%)
        3 or 4 => 20 + Random.Shared.Next(1, 61),
        5 => 15, // Poisonous
        6 or 7 => 20, // Crit poison / Explosive
        8 => 25, // Critical-Explosive
        _ => 0,
    };
}
