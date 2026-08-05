namespace Server.Utils;

/// <summary>
/// Olympia Item.cfg / Item2 / Item3: max lifespan + list price per item id.
/// Used when <c>Items.json</c> omits <c>maxLifeSpan</c>/<c>price</c> (most gear rows today).
/// Layout after id+name: type equipPos effectType v1..v6 maxLife … price weight …
/// (price token index 15, maxLife index 11 — same as classic Helbreath cfg parsers).
/// </summary>
public static class ItemCfgStatsCatalog {
    public readonly record struct Stats(int MaxLifeSpan, int Price);

    private static readonly Dictionary<int, Stats> ByItemId = new();
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
                Console.WriteLine($"[ItemCfgStatsCatalog] Loaded {ByItemId.Count} price/lifespan rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemCfgStatsCatalog] Warning: no Item.cfg stats found.");
    }

    public static bool TryGet(int itemId, out Stats stats) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out stats);
    }

    public static int GetMaxLifeSpan(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var s) ? Math.Max(0, s.MaxLifeSpan) : 0;
    }

    public static int GetListPrice(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var s) ? Math.Max(0, s.Price) : 0;
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
            // Need at least id, name, type, equip, effect, v1-6, maxLife (index 11), … price (15)
            if (tokens.Length < 16) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            _ = int.TryParse(tokens[11], out var maxLife);
            _ = int.TryParse(tokens[15], out var price);
            // Prefer higher price / higher maxLife when duplicates across Item.cfg files.
            if (ByItemId.TryGetValue(id, out var prev)) {
                var nextLife = Math.Max(prev.MaxLifeSpan, Math.Max(0, maxLife));
                var nextPrice = Math.Max(prev.Price, Math.Max(0, price));
                ByItemId[id] = new Stats(nextLife, nextPrice);
            } else {
                ByItemId[id] = new Stats(Math.Max(0, maxLife), Math.Max(0, price));
            }
        }
    }
}
