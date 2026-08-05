namespace Server.Utils;

/// <summary>
/// Olympia Item.cfg effect type 2 (defense gear): value1 = Defense Ratio, value2 = Physical Absorption %.
/// Matches Server.cpp CalcTotalItemEffect DEFENSE case (v1 → m_iDefenseRatio, v2 → m_iDamageAbsorption_Armor).
/// </summary>
public static class ItemDefenseCatalog {
    public readonly record struct DefenseStats(int DefenseRatio, int PhysicalAbsorptionPercent);

    private static readonly Dictionary<int, DefenseStats> ByItemId = new();
    private static bool loaded;

    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        var candidates = new List<string>();
        var cwd = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "Config", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "..", "reference")));
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
                Console.WriteLine($"[ItemDefenseCatalog] Loaded {ByItemId.Count} defense rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemDefenseCatalog] Warning: no Item.cfg defense rows found.");
    }

    public static bool TryGet(int itemId, out DefenseStats stats) =>
        ByItemId.TryGetValue(itemId, out stats);

    /// <summary>Legacy: Defense Ratio only (Item.cfg value1).</summary>
    public static bool TryGet(int itemId, out int defenseRatio) {
        if (ByItemId.TryGetValue(itemId, out var s)) {
            defenseRatio = s.DefenseRatio;
            return true;
        }
        defenseRatio = 0;
        return false;
    }

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
            // Item = id Name type equipPos effectType v1 v2 v3 v4 v5 v6 ...
            if (tokens.Length < 7) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            if (!int.TryParse(tokens[4], out var effectType) || effectType != 2) {
                continue;
            }
            if (!int.TryParse(tokens[5], out var defRatio)) {
                continue;
            }
            var pa = 0;
            _ = int.TryParse(tokens[6], out pa);
            if (defRatio <= 0 && pa <= 0) {
                continue;
            }
            // Prefer higher DR if duplicated across files.
            if (!ByItemId.TryGetValue(id, out var prev) || defRatio > prev.DefenseRatio) {
                ByItemId[id] = new DefenseStats(Math.Max(0, defRatio), Math.Max(0, pa));
            }
        }
    }
}
