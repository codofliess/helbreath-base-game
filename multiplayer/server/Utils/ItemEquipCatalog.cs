using Server.Helpers;

namespace Server.Utils;

/// <summary>
/// Olympia Item.cfg fields needed for equip gates (weight, level, armor "Available for above Str/Dex/…").
/// Token layout after id+name: type equipPos effectType v1..v6 maxLife … price weight appr speed level gender …
/// </summary>
public static class ItemEquipCatalog {
    public readonly record struct Row(
        int Weight,
        int LevelLimit,
        int EquipPos,
        int EffectType,
        int EffectValue4,
        int EffectValue5,
        /// <summary>Olympia Item.cfg m_sRelatedSkill (7 Short-Sword, 9 Fencing, 14 Hammer, 21 Staff/Wand…).</summary>
        int RelatedSkill);

    static readonly Dictionary<int, Row> ByItemId = new();
    static bool loaded;

    public static void EnsureLoaded() {
        if (loaded) {
            return;
        }
        loaded = true;

        var candidates = new List<string>();
        var cwd = Directory.GetCurrentDirectory();
        var baseDir = AppContext.BaseDirectory;
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "Config", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "Config", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(baseDir, "..", "reference")));
        candidates.Add(Path.GetFullPath(Path.Combine(cwd, "..", "..", "..", "..", "reference")));

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
                Console.WriteLine($"[ItemEquipCatalog] Loaded {ByItemId.Count} equip rows from {dir}");
                return;
            }
        }

        Console.WriteLine("[ItemEquipCatalog] Warning: no Item.cfg found; equip STR/level gates use weight catalog only.");
    }

    public static bool TryGet(int itemId, out Row row) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out row);
    }

    /// <summary>
    /// Olympia equip STR floor from mass: <c>m_wWeight / 100</c> (integer).
    /// Light primary (type 6) reduces requirement by <c>value × 4</c> stones (same feel as bag weight).
    /// Armor may also declare <c>Available for above Str X</c> via effectType=DEFENSE, v4=10, v5=X.
    /// </summary>
    /// <summary>
    /// Product STR floors that override weight/100 (Arena / Olympia parity fixes).
    /// Blood Rapier: 39 STR · Merien Shield: 40 STR.
    /// </summary>
    private static readonly Dictionary<int, int> RequiredStrOverrides = new() {
        [492] = 39, // Blood Rapier
        [620] = 40, // Merien Shield
    };

    public static int GetRequiredStr(int itemId, uint itemAttribute) {
        EnsureLoaded();
        if (RequiredStrOverrides.TryGetValue(itemId, out var forced) && forced > 0) {
            return forced;
        }

        var weight = ItemWeightCatalog.GetWeight(itemId);
        if (ByItemId.TryGetValue(itemId, out var row) && row.Weight > 0) {
            weight = row.Weight;
        }

        // Floor stones from raw weight (Olympia ItemEquipHandler).
        var stones = weight > 0 ? weight / 100 : 0;

        ItemMagicAttribute.Decode(itemAttribute, out var pType, out var pValue, out _, out _, out _);
        if (pType == ItemMagicAttribute.P_Light && pValue > 0) {
            stones = Math.Max(0, stones - pValue * 4);
        }

        // Armor "Available for above Str N" (Client shop / bag detail).
        if (ByItemId.TryGetValue(itemId, out row)
            && row.EffectType == 2 /* DEFENSE */
            && row.EffectValue4 == 10
            && row.EffectValue5 > 0) {
            stones = Math.Max(stones, row.EffectValue5);
        }

        // Heavy armor UI rule (weight ≥ 1100 raw → show Required Str): always enforce weight floor.
        // Weapons also use weight/100 as Required Str in Olympia.
        return stones;
    }

    /// <summary>Weapon full-swing / speed field override (Olympia Speed token). Blood Rapier = 1 full swing.</summary>
    public static int GetWeaponSpeed(int itemId) {
        EnsureLoaded();
        if (itemId == 492) {
            return 1; // Blood Rapier — 1 full swing
        }
        if (ByItemId.TryGetValue(itemId, out var row)) {
            // Speed is not stored on Row today; return 0 = unknown.
            _ = row;
        }
        return 0;
    }

    public static int GetLevelLimit(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var row) ? Math.Max(0, row.LevelLimit) : 0;
    }

    public static int GetRelatedSkill(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var row) ? row.RelatedSkill : 0;
    }

    public static int GetEquipPos(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var row) ? row.EquipPos : 0;
    }

    public static int GetEffectType(int itemId) {
        EnsureLoaded();
        return ByItemId.TryGetValue(itemId, out var row) ? row.EffectType : 0;
    }

    /// <summary>Olympia equipPos: 7=LHAND shield, 8=RHAND, 9=TWOHAND.</summary>
    public const int EquipPosLhand = 7;
    public const int EquipPosRhand = 8;
    public const int EquipPosTwoHand = 9;

    /// <summary>Olympia relatedSkill values used for cast-weapon rules.</summary>
    public const int SkillShortSword = 7;
    public const int SkillFencing = 9;
    public const int SkillStaffWand = 21;

    /// <summary>
    /// Dex/Vit/Int/Mag/Chr floors from armor "Available for above …" (v4 11–15).
    /// Returns (statKind, minValue) or (0,0) if none.
    /// statKind: 11=Dex 12=Vit 13=Int 14=Mag 15=Chr (matches Item.cfg).
    /// </summary>
    public static (int StatKind, int MinValue) GetSecondaryStatRequirement(int itemId) {
        EnsureLoaded();
        if (!ByItemId.TryGetValue(itemId, out var row) || row.EffectType != 2 || row.EffectValue5 <= 0) {
            return (0, 0);
        }
        return row.EffectValue4 switch {
            11 or 12 or 13 or 14 or 15 => (row.EffectValue4, row.EffectValue5),
            _ => (0, 0),
        };
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
            // Need id..weight (16) and preferably level (19).
            if (tokens.Length < 17) {
                continue;
            }
            if (!int.TryParse(tokens[0], out var id)) {
                continue;
            }
            if (ByItemId.ContainsKey(id)) {
                continue; // first definition wins
            }

            _ = int.TryParse(tokens.Length > 3 ? tokens[3] : "0", out var equipPos);
            _ = int.TryParse(tokens.Length > 4 ? tokens[4] : "0", out var effectType);
            _ = int.TryParse(tokens.Length > 8 ? tokens[8] : "0", out var v4);
            _ = int.TryParse(tokens.Length > 9 ? tokens[9] : "0", out var v5);
            _ = int.TryParse(tokens[16], out var weight);
            _ = int.TryParse(tokens.Length > 19 ? tokens[19] : "0", out var levelLimit);
            // Olympia Item.cfg relatedSkill is typically token 23 (after gender).
            _ = int.TryParse(tokens.Length > 23 ? tokens[23] : "0", out var relatedSkill);

            ByItemId[id] = new Row(
                Math.Max(0, weight),
                Math.Max(0, levelLimit),
                equipPos,
                effectType,
                v4,
                v5,
                Math.Max(0, relatedSkill));
        }
    }
}
