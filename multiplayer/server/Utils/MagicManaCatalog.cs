namespace Server.Utils;

/// <summary>
/// Olympia <c>Magic.cfg</c> mana costs (classic Helbreath):
/// <c>magic = id Name Type Delay Last ManaCost …</c>
/// </summary>
public static class MagicManaCatalog {
    static readonly Dictionary<int, int> ManaByOlympiaId = new();
    static bool loaded;

    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        foreach (var dir in CandidateDirs()) {
            var path = Path.Combine(dir, "Magic.cfg");
            if (!File.Exists(path)) {
                continue;
            }
            ParseFile(path);
            if (ManaByOlympiaId.Count > 0) {
                Console.WriteLine($"[MagicManaCatalog] Loaded {ManaByOlympiaId.Count} mana costs from {path}");
                return;
            }
        }

        Console.WriteLine("[MagicManaCatalog] Warning: Magic.cfg not found; spell MP uses circle×3 fallback.");
    }

    /// <summary>Base MP cost for Olympia Magic.cfg id, or null if unknown.</summary>
    public static int? TryGetManaCost(int olympiaMagicId) {
        EnsureLoaded();
        return ManaByOlympiaId.TryGetValue(olympiaMagicId, out var cost) ? cost : null;
    }

    static IEnumerable<string> CandidateDirs() {
        var cwd = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;
        yield return Path.GetFullPath(Path.Combine(cwd, "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "Config", "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "Config", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(cwd, "..", "..", "..", "..", "reference"));
        yield return Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "reference"));
    }

    static void ParseFile(string path) {
        foreach (var raw in File.ReadLines(path)) {
            var line = raw.Trim();
            if (!line.StartsWith("magic", StringComparison.OrdinalIgnoreCase)) {
                continue;
            }
            var eq = line.IndexOf('=');
            if (eq < 0) {
                continue;
            }
            // id Name Type Delay Last ManaCost …
            var tokens = line[(eq + 1)..].Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length < 6) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            // tokens[1] = name (hyphenated, no spaces)
            // tokens[2]=type, [3]=delay, [4]=last, [5]=manaCost
            if (!int.TryParse(tokens[5], out var mana) || mana < 0) {
                continue;
            }
            // First definition wins (Item.cfg style).
            ManaByOlympiaId.TryAdd(id, mana);
        }
    }
}
