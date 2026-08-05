namespace Server.Utils;

/// <summary>
/// Olympia <c>Item.cfg</c> attack dice for weapons (effect values 1–6):
/// SM throw/range/bonus + L throw/range/bonus. Loaded once at process start.
/// </summary>
public static class ItemAttackCatalog {
    public readonly record struct AttackDice(
        int SmThrow,
        int SmRange,
        int SmBonus,
        int LThrow,
        int LRange,
        int LBonus);

    private static readonly Dictionary<int, AttackDice> ByItemId = new();
    private static bool loaded;

    /// <summary>Loads <c>reference/Item.cfg</c> (+ Item2/3) relative to the process content root or known repo paths.</summary>
    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        var candidates = new List<string>();
        var cwd = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;
        // multiplayer/server → repo root
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "reference")));
        // Deployed layout: /opt/chainlords/server/reference or next to dll
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "Config", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "Config", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "..", "reference")));
        // bin/Debug/netX.0 → walk up
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "..", "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "reference")));

        foreach (var dir in candidates.Distinct(StringComparer.OrdinalIgnoreCase)) {
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
                Console.WriteLine($"[ItemAttackCatalog] Loaded {ByItemId.Count} weapon dice rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemAttackCatalog] Warning: no Item.cfg found; weapon damage will use STR fallbacks only.");
    }

    public static bool TryGet(int itemId, out AttackDice dice) =>
        ByItemId.TryGetValue(itemId, out dice);

    private static void ParseFile(string path) {
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
            // Item = id Name type equipPos effectType v1 v2 v3 v4 v5 v6 maxLife ...
            if (tokens.Length < 11) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            // effectType at index 4 (after id, name, itemType, equipPos)
            if (!int.TryParse(tokens[4], out var effectType) || effectType is not (1 or 12 or 13)) {
                // 1=attack, 12=attack+defense, 13=mana-save wand — still use dice if present
                // Keep only classic attack weapons (type 1) primarily
            }
            if (!int.TryParse(tokens[2], out var itemType) || itemType != 1) {
                // itemType 1 = equip weapon in Olympia cfg
                continue;
            }
            // 1=attack, 12=attack+defense, 24=attack special ability (Xelima / Ice Sword)
            if (!int.TryParse(tokens[4], out effectType) || effectType is not (1 or 12 or 24)) {
                continue;
            }

            int Ev(int i) => int.TryParse(tokens[5 + i], out var v) ? v : 0;
            var dice = new AttackDice(
                Math.Max(1, Ev(0)),
                Math.Max(1, Ev(1)),
                Math.Max(0, Ev(2)),
                Math.Max(1, Ev(3)),
                Math.Max(1, Ev(4)),
                Math.Max(0, Ev(5)));
            ByItemId.TryAdd(id, dice);
        }
    }

    /// <summary>Olympia <c>iDice(throw, range)</c> then + bonus (per SM/L table; we use SM for standard mobs).</summary>
    public static int RollWeaponDamageSm(AttackDice dice) {
        var sum = 0;
        for (var i = 0; i < dice.SmThrow; i++) {
            sum += Random.Shared.Next(1, dice.SmRange + 1);
        }
        return Math.Max(1, sum + dice.SmBonus);
    }

    public static int AverageWeaponDamageSm(AttackDice dice) {
        // throw * (range+1)/2 + bonus
        var avg = dice.SmThrow * (dice.SmRange + 1) / 2.0 + dice.SmBonus;
        return Math.Max(1, (int)Math.Round(avg));
    }
}
