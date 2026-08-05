namespace Server.Utils;

/// <summary>
/// Olympia <c>Npc.cfg</c> exp → kill award base, then <c>MonsterExpFactor</c> + GetExp.
/// Live L33 RB0 anchors: Slime≈1140, Ant≈3000, Orc≈3500, Scorpion=5940, Cyclops≈17000
/// (specials e.g. Anti-Magic ≈25000 via SA exp %). Low-tier full ExpDice×HitDice; mid/high
/// compress HitDice weight so Cyclops is not ~77k. Rare per-npc overrides when still off.
/// </summary>
public static class NpcExpCatalog {
    public readonly record struct ExpRow(int ExpMin, int ExpMax, int HitDice);

    private static readonly Dictionary<string, ExpRow> ByName = new(StringComparer.OrdinalIgnoreCase);
    private static bool loaded;

    /// <summary>
    /// Pre-<c>MonsterExpFactor</c> base (Npc.cfg name). Prefer the capped formula; use only when
    /// live still disagrees. L33 award ≈ base × 65 × GetExp(≈2.2).
    /// </summary>
    private static readonly Dictionary<string, int> LiveBaseExpOverride = new(StringComparer.OrdinalIgnoreCase) {
        // Capped formula → 30 (≈4290); live ~3500 → base 25 (≈3575).
        ["Orc"] = 25,
    };

    /// <summary>Catalog display name → Npc.cfg name (same map as sync-olympia-pits.mjs).</summary>
    private static readonly Dictionary<string, string> CatalogNameToNpc = new(StringComparer.OrdinalIgnoreCase) {
        ["Ettin"] = "Ettin",
        ["Slime"] = "Slime",
        ["Ant"] = "Giant-Ant",
        ["Snake"] = "Amphis",
        ["Dragon"] = "Barlog",
        ["Bunny"] = "Rabbit",
        ["Beholder"] = "Beholder",
        ["Cannibal Plant"] = "Cannibal-Plant",
        ["Cat"] = "Cat",
        ["Centaurus"] = "Centaurus",
        ["Clay Golem"] = "Clay-Golem",
        ["Claw Turtle"] = "Claw-Turtle",
        ["Cyclops"] = "Cyclops",
        ["Dark Elf"] = "Dark-Elf",
        ["Demon"] = "Demon",
        ["Frost"] = "Frost",
        ["Gargoyle"] = "Gagoyle",
        ["Giant Cray Fish"] = "Giant-Crayfish",
        ["Giant Frog"] = "Giant-Frog",
        ["Giant Lizard"] = "Giant-Lizard",
        ["Giant Tree"] = "Giant-Plant",
        ["Stone Golem"] = "Stone-Golem",
        ["Guard"] = "Guard-Aresden",
        ["Hellhound"] = "Hellbound",
        ["Hellclaw"] = "Hellclaw",
        ["Ice Golem"] = "Ice-Golem",
        ["Master Mage Orc"] = "MasterMage-Orc",
        ["Minotaur"] = "Minotaurs",
        ["Mountain Giant"] = "Mountain-Giant",
        ["Nizie"] = "Nizie",
        ["Orc"] = "Orc",
        ["Dire Boar"] = "DireBoar",
        ["Dummy"] = "Dummy",
        ["Training Dummy"] = "Dummy",
        ["Fire Wyvern"] = "Fire-Wyvern",
        ["Wyvern"] = "Wyvern",
        // Middleland Nemesis-style dragons (exp ladder ≈ Wyvern; Black ≈ Abaddon).
        ["Earth Dragon"] = "Fire-Wyvern",
        ["Illusion Dragon"] = "Wyvern",
        ["Lightning Dragon"] = "Fire-Wyvern",
        ["Poison Dragon"] = "Wyvern",
        ["Black Dragon"] = "Abaddon",
        ["Lich"] = "Liche",
        ["Ogre"] = "Orge",
        ["Rudolph"] = "Rudolph",
        ["Scarecrow"] = "Scarecrow",
        ["Scorpion"] = "Scorpion",
        ["Skeleton"] = "Skeleton",
        ["Stalker"] = "Stalker",
        ["Tentocle"] = "Tentocle",
        ["Tigerworm"] = "Tigerworm",
        ["Troll"] = "Troll",
        ["Unicorn"] = "Unicorn",
        ["Werewolf"] = "WereWolf",
        ["Zombie"] = "Zombie",
        ["Abaddon"] = "Abaddon",
        ["Abaddon (incomplete)"] = "Abaddon",
    };

    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        var candidates = new List<string>();
        var cwd = Directory.GetCurrentDirectory();
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "..", "..", "reference")));

        foreach (var dir in candidates.Distinct(StringComparer.OrdinalIgnoreCase)) {
            var path = Path.Combine(dir, "Npc.cfg");
            if (!File.Exists(path)) {
                continue;
            }
            ParseFile(path);
            if (ByName.Count > 0) {
                Console.WriteLine($"[NpcExpCatalog] Loaded {ByName.Count} NPC exp rows from {path}");
                return;
            }
        }

        Console.WriteLine("[NpcExpCatalog] Warning: Npc.cfg not found; exp falls back to MaxHp.");
    }

    public static bool TryGetByCatalogName(string catalogName, out ExpRow row) {
        row = default;
        if (string.IsNullOrWhiteSpace(catalogName)) {
            return false;
        }
        if (CatalogNameToNpc.TryGetValue(catalogName.Trim(), out var npcName) &&
            ByName.TryGetValue(npcName, out row)) {
            return true;
        }
        return ByName.TryGetValue(catalogName.Trim(), out row) ||
               ByName.TryGetValue(catalogName.Trim().Replace(' ', '-'), out row);
    }

    /// <summary>
    /// Live-calibrated base pool: override if present, else capped ExpDice×HitDice weight.
    /// Factor 65 + L33 GetExp×2.2 → Slime~1144, Ant~3432, Orc~3575, Scorpion~6006, Cyclops~17017.
    /// </summary>
    public static int RollBaseExp(string? catalogOrNpcName, ExpRow row) {
        if (TryGetLiveBaseOverride(catalogOrNpcName, out var over)) {
            return over;
        }
        var dice = RollExpDiceOnly(row);
        return Math.Max(1, (int)Math.Round(dice * HitDiceWeightForExp(dice, row.HitDice)));
    }

    /// <inheritdoc cref="RollBaseExp(string?, ExpRow)"/>
    public static int RollBaseExp(ExpRow row) => RollBaseExp(null, row);

    public static int AverageBaseExp(string? catalogOrNpcName, ExpRow row) {
        if (TryGetLiveBaseOverride(catalogOrNpcName, out var over)) {
            return over;
        }
        var min = Math.Max(0, row.ExpMin);
        var max = Math.Max(min, row.ExpMax);
        var avgDice = Math.Max(1, (min + max) / 2);
        return Math.Max(1, (int)Math.Round(avgDice * HitDiceWeightForExp(avgDice, row.HitDice)));
    }

    /// <summary>
    /// HitDice multiplies ExpDice fully for low-tier (Slime HD2, Ant HD3).
    /// Mid/high ExpDice compress: <c>maxWeight = max(0.33, 42/ExpDice)</c>
    /// → Scorpion ~1.5×dice, Cyclops ~0.33×dice (live ~17k normals at L33).
    /// </summary>
    private static double HitDiceWeightForExp(int expDice, int hitDice) {
        var dice = Math.Max(1, expDice);
        var hd = Math.Max(1, hitDice);
        var maxWeight = Math.Max(0.33, 42.0 / dice);
        return Math.Min(hd, maxWeight);
    }

    /// <inheritdoc cref="AverageBaseExp(string?, ExpRow)"/>
    public static int AverageBaseExp(ExpRow row) => AverageBaseExp(null, row);

    private static bool TryGetLiveBaseOverride(string? catalogOrNpcName, out int baseExp) {
        baseExp = 0;
        if (string.IsNullOrWhiteSpace(catalogOrNpcName)) {
            return false;
        }
        var key = catalogOrNpcName.Trim();
        if (LiveBaseExpOverride.TryGetValue(key, out baseExp)) {
            return true;
        }
        if (CatalogNameToNpc.TryGetValue(key, out var npcName) &&
            LiveBaseExpOverride.TryGetValue(npcName, out baseExp)) {
            return true;
        }
        var dashed = key.Replace(' ', '-');
        return LiveBaseExpOverride.TryGetValue(dashed, out baseExp);
    }

    private static int RollExpDiceOnly(ExpRow row) {
        var min = Math.Max(0, row.ExpMin);
        var max = Math.Max(min, row.ExpMax);
        if (max <= min) {
            return Math.Max(1, min);
        }
        return Random.Shared.Next(min, max + 1);
    }

    private static void ParseFile(string path) {
        foreach (var raw in File.ReadLines(path)) {
            var line = raw.Trim();
            if (!line.StartsWith("Npc", StringComparison.OrdinalIgnoreCase)) {
                continue;
            }
            var eq = line.IndexOf('=');
            if (eq < 0) {
                continue;
            }
            var parts = line[(eq + 1)..].Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            // Name Type HitDice DR HR MinBrav ExpDiceMin ExpDiceMax ...
            if (parts.Length < 9) {
                continue;
            }
            var name = parts[0];
            if (!int.TryParse(parts[2], out var hitDice) ||
                !int.TryParse(parts[6], out var expMin) ||
                !int.TryParse(parts[7], out var expMax)) {
                continue;
            }
            if (expMax < expMin) {
                // Single ExpDice field + ADT in next column
                expMax = expMin;
            }
            ByName.TryAdd(name, new ExpRow(expMin, expMax, Math.Max(1, hitDice)));
        }
    }
}
