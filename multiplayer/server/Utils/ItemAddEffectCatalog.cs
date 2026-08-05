namespace Server.Utils;

/// <summary>
/// Olympia Item.cfg effect type 14 (ADDEFFECT) for necklaces / rings / accessories.
/// Subtype in value1, magnitude in value2 (Server.cpp CalcTotalItemEffect DEF_ITEMEFFECTTYPE_ADDEFFECT).
/// </summary>
public static class ItemAddEffectCatalog {
    public const int EffectTypeAddEffect = 14;

    // Subtypes (m_sItemEffectValue1)
    public const int SubMagicResist = 1;
    public const int SubManaSave = 2;
    public const int SubPhysicalDamage = 3;
    public const int SubDefenseRatio = 4;
    public const int SubLucky = 5;
    public const int SubMagicalDamage = 6;
    public const int SubAbsAir = 7;
    public const int SubAbsEarth = 8;
    public const int SubAbsFire = 9;
    public const int SubAbsWater = 10;
    public const int SubPoisonResist = 11;
    public const int SubHitRatio = 12;

    public readonly record struct AddEffect(int Subtype, int Value);

    private static readonly Dictionary<int, AddEffect> ByItemId = new();
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
                Console.WriteLine($"[ItemAddEffectCatalog] Loaded {ByItemId.Count} ADDEFFECT rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemAddEffectCatalog] Warning: no Item.cfg ADDEFFECT rows found.");
    }

    public static bool TryGet(int itemId, out AddEffect effect) =>
        ByItemId.TryGetValue(itemId, out effect);

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
            // Item = id Name type equipPos effectType v1 v2 ...
            if (tokens.Length < 7) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            if (!int.TryParse(tokens[4], out var effectType) || effectType != EffectTypeAddEffect) {
                continue;
            }
            if (!int.TryParse(tokens[5], out var subtype)) {
                continue;
            }
            var value = 0;
            _ = int.TryParse(tokens[6], out value);
            // Lucky (5) may have value 0 and still be active in some rows — store when subtype known.
            if (subtype <= 0) {
                continue;
            }
            ByItemId[id] = new AddEffect(subtype, value);
        }
    }
}
