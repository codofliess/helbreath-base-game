namespace Server.Utils;

/// <summary>
/// Olympia Item.cfg special abilities (effect types 24 ATTACK_SPECABLTY / 25 DEFENSE_SPECABLTY).
/// <c>specialEffect</c> = ability type; <c>specialEffectValue1</c> = active duration seconds.
/// </summary>
public static class ItemSpecialAbilityCatalog {
    public const int EffectTypeAttackSpecAblty = 24;
    public const int EffectTypeDefenseSpecAblty = 25;

    /// <summary>Olympia DEF_SPECABLTYTIMESEC — 20 minutes between uses.</summary>
    public const int CooldownSeconds = 1200;

    // Attack SA types (weapon)
    public const int TypeHalfHp = 1;       // Xelima — damage at least half of target HP
    public const int TypeFreeze = 2;       // Ice Elemental Sword — chill
    public const int TypeParalyze = 3;     // Hold-style
    public const int TypeExecute = 4;      // Full HP damage
    public const int TypeLifesteal = 5;    // Heal attacker by damage

    // Defense SA types (armor/shield)
    public const int TypeBreakWeapon = 50; // Merien Plate — zero attacker weapon lifespan
    public const int TypeBodyGuard = 51;   // Zero damage when hit lands on SA equip slot
    public const int TypeUntouchable = 52; // Merien Shield — full physical immunity while active

    public readonly record struct SpecAbility(
        int AbilityType,
        int ActiveDurationSec,
        bool IsDefense);

    private static readonly Dictionary<int, SpecAbility> ByItemId = new();
    private static bool loaded;

    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        foreach (var dir in CandidateDirs()) {
            if (!Directory.Exists(dir)) {
                continue;
            }
            foreach (var name in new[] { "Item.cfg", "Item2.cfg", "Item3.cfg" }) {
                var path = Path.Combine(dir, name);
                if (File.Exists(path)) {
                    ParseFile(path);
                }
            }
            if (ByItemId.Count > 0) {
                Console.WriteLine($"[ItemSpecialAbilityCatalog] Loaded {ByItemId.Count} SA items from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemSpecialAbilityCatalog] Warning: no Item.cfg SA rows found.");
    }

    public static bool TryGet(int itemId, out SpecAbility ability) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out ability);
    }

    static IEnumerable<string> CandidateDirs() {
        var cwd = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "Config", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "..", "..", "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "reference"));
    }

    static void ParseFile(string path) {
        foreach (var raw in File.ReadLines(path)) {
            var line = raw.Trim();
            if (!line.StartsWith("Item", StringComparison.OrdinalIgnoreCase)) {
                continue;
            }
            var eq = line.IndexOf('=');
            if (eq < 0) {
                continue;
            }
            var tokens = line[(eq + 1)..].Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            // id name type equip effectType v1..v6 maxLife specialEffect sprite frame price weight appr speed level gender specVal1 specVal2 ...
            if (tokens.Length < 22) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            if (!int.TryParse(tokens[4], out var effectType) ||
                (effectType != EffectTypeAttackSpecAblty && effectType != EffectTypeDefenseSpecAblty)) {
                continue;
            }
            if (!int.TryParse(tokens[12], out var specialEffect) || specialEffect <= 0) {
                continue;
            }
            var duration = 60;
            if (int.TryParse(tokens[21], out var d) && d > 0) {
                duration = d;
            }
            ByItemId[id] = new SpecAbility(specialEffect, duration, effectType == EffectTypeDefenseSpecAblty);
        }
    }
}
