namespace Server.Utils;

/// <summary>
/// Olympia <c>Item.cfg</c> weight field (<c>m_wWeight</c>) per catalog id.
/// Loaded once from the same reference paths as <see cref="ItemAttackCatalog"/>.
/// </summary>
public static class ItemWeightCatalog {
    private static readonly Dictionary<int, int> WeightByItemId = new();
    private static bool loaded;

    /// <summary>Loads weight from Item.cfg / Item2 / Item3 (token index 16 after id+name, i.e. nums[14]).</summary>
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
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "Config", "reference")));
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
            if (WeightByItemId.Count > 0) {
                Console.WriteLine($"[ItemWeightCatalog] Loaded {WeightByItemId.Count} weight rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemWeightCatalog] Warning: no Item.cfg found; carry weight defaults to 0 per item.");
    }

    /// <summary>Olympia gold catalog id.</summary>
    public const int GoldItemId = 90;

    /// <summary>Raw Olympia weight units for one unit of the item (0 when unknown).</summary>
    public static int GetWeight(int itemId) {
        EnsureLoaded();
        return WeightByItemId.TryGetValue(itemId, out var w) ? Math.Max(0, w) : 0;
    }

    /// <summary>
    /// Stack weight in raw units.
    /// <b>Chain Lords:</b> gold (id 90) always weighs <c>1</c> raw unit regardless of stack size
    /// so multi-million gold piles do not fill the bag (players requested flat weight 1).
    /// Other items: weight × count, min 1 when the catalog has mass.
    /// </summary>
    public static int GetStackWeight(int itemId, int quantity) {
        // Gold: always 1 (any quantity).
        if (itemId == GoldItemId) {
            return 1;
        }
        var qty = Math.Max(1, quantity);
        long raw = (long)GetWeight(itemId) * qty;
        if (raw <= 0) {
            return GetWeight(itemId) > 0 ? 1 : 0;
        }
        if (raw > int.MaxValue) {
            return int.MaxValue;
        }
        return (int)raw;
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
            // Item = id Name type equipPos ... weight at nums[14] (token index 16 after id+name)
            if (tokens.Length < 17) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            if (!int.TryParse(tokens[16], out var weight)) {
                continue;
            }
            // First definition wins (Item.cfg then Item2/3).
            if (!WeightByItemId.ContainsKey(id)) {
                WeightByItemId[id] = Math.Max(0, weight);
            }
        }
    }
}
