using System.Text.Json;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// PLAYTEST=1 only: ElonQa L150 Ice Bound walk kit. JSON under <c>CharsPlaytest/</c> (and the
/// committed <c>PlaytestKits/</c> template) wins over Postgres. Never writes live <c>Chars/</c>.
/// </summary>
public static class PlaytestElonQaKit {
    public const int Level = 150;
    public const int Str = 182;
    public const int Intel = 65;
    public const int Mag = 50;
    public const int Vit = 80;
    public const int Chr = 12;
    /// <summary>Remainder of the L150 517-point pool after STR/INT/MAG/VIT/CHR.</summary>
    public const int Dex = 128;
    public const long ExpForLevel150 = 47_023_054;
    public const int HubX = 90;
    public const int HubY = 80;
    public const string HubWorldId = "traveler";
    public const int GiantBattleHammerId = 762;
    public const int MerienShieldId = 620;
    public const int StormBringerId = 845;
    public const int IceElementalNeckId = 643;
    public const int XelimaNeckId = 860;
    public const int Ms22WandId = 1314;
    public const string SaveFileName = "playtest-elonqa.traveler.json";
    public const string TemplateRelativePath = "PlaytestKits/playtest-elonqa.traveler.json";

    static readonly JsonSerializerOptions JsonOptions = new() {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    /// <summary>L150 create-pool remainder: 70 + 149×3 = 517; 182+65+50+80+12+128 = 517.</summary>
    public static int StatTotal => Str + Intel + Mag + Vit + Chr + Dex;

    /// <summary>
    /// Copies the committed kit into <c>CharsPlaytest/</c> when missing or when a starter L1 would
    /// hide it. Never writes <c>Chars/</c> (PauPau / live slots).
    /// </summary>
    public static void EnsureSeeded(string charsPlaytestDirectory) {
        if (!PlaytestMode.IsEnabled) {
            return;
        }

        Directory.CreateDirectory(charsPlaytestDirectory);
        var destPath = Path.Combine(charsPlaytestDirectory, SaveFileName);
        var existing = TryLoadFile(destPath);
        if (IsKitComplete(existing)) {
            Console.WriteLine($"[PLAYTEST] ElonQa kit already in '{destPath}' (L{existing!.Level}).");
            return;
        }

        var template = TryLoadFile(ResolveTemplatePath()) ?? CreateState();
        var charsFallback = TryLoadCharsFallback(charsPlaytestDirectory);
        if (IsKitComplete(charsFallback) && !IsKitComplete(template)) {
            template = charsFallback!;
        }

        if (!IsKitComplete(template)) {
            template = CreateState();
        }

        template = WithTravelerHub(template);
        WriteAtomic(destPath, template);
        Console.WriteLine(
            $"[PLAYTEST] Seeded ElonQa L{template.Level} kit → '{destPath}' " +
            $"(JSON wins over Postgres; live Chars/ not written).");
    }

    /// <summary>Load CharsPlaytest JSON, else template, else built-in kit. Always traveler hub spawn.</summary>
    public static PlayerPersistenceState LoadPreferredState(string charsPlaytestDirectory) {
        EnsureSeeded(charsPlaytestDirectory);
        var destPath = Path.Combine(charsPlaytestDirectory, SaveFileName);
        var state = TryLoadFile(destPath) ?? CreateState();
        if (IsStarterL1(state)) {
            state = CreateState();
            WriteAtomic(destPath, state);
        }

        return WithTravelerHub(state);
    }

    /// <summary>
    /// True when the incoming snapshot is a starter L1 that must not replace a seeded L150 kit.
    /// Allows later playtest progress (still L150, walked maps) to save.
    /// </summary>
    public static bool ShouldWriteSave(string charsPlaytestDirectory, PlayerPersistenceState incoming) {
        var destPath = Path.Combine(charsPlaytestDirectory, SaveFileName);
        var existing = TryLoadFile(destPath);
        if (existing is null) {
            return true;
        }

        if (IsKitComplete(existing) && IsStarterL1(incoming)) {
            Console.WriteLine(
                "[PLAYTEST] Refusing to overwrite the L150 ElonQa kit with a starter L1 snapshot.");
            return false;
        }

        return true;
    }

    public static bool IsKitComplete(PlayerPersistenceState? state) {
        if (state is null || state.Level < Level) {
            return false;
        }

        if (state.EquippedItems is not null) {
            foreach (var row in state.EquippedItems) {
                if (row.Item.ItemId == GiantBattleHammerId &&
                    string.Equals(row.Slot, "weapon", StringComparison.OrdinalIgnoreCase)) {
                    return true;
                }
            }
        }

        if (state.BagItems is not null) {
            foreach (var row in state.BagItems) {
                if (row.ItemId == GiantBattleHammerId) {
                    return true;
                }
            }
        }

        return false;
    }

    public static bool IsStarterL1(PlayerPersistenceState? state) {
        if (state is null) {
            return true;
        }

        if (state.Level >= 10) {
            return false;
        }

        return state.Level <= 1 && state.Str <= 14 && state.Vit <= 14;
    }

    /// <summary>Ice Bound walk starts in traveler city, never already on icebound.</summary>
    public static PlayerPersistenceState WithTravelerHub(PlayerPersistenceState state) {
        return state with {
            GameWorldId = HubWorldId,
            X = HubX,
            Y = HubY,
            CharacterName = PlaytestMode.CharacterName,
            CitizenshipSide = "traveler",
            SlotIndex = 0,
        };
    }

    /// <summary>Programmatic kit used when the committed JSON template is missing.</summary>
    public static PlayerPersistenceState CreateState() {
        var skills = new int[Skills.SkillCount];
        for (var i = 0; i < skills.Length; i++) {
            skills[i] = Skills.StartingSkillLevel;
        }
        skills[Skills.HammerMastery] = Skills.MaxLevel;
        skills[Skills.Magic] = 50;
        skills[Skills.StaffMastery] = 50;

        long uid = 9_000_001;
        PersistedEquippedItem Eq(int itemId, int curLife, int maxLife, uint attr = 0) {
            return new PersistedEquippedItem(
                itemId,
                uid++,
                BagX: null,
                BagY: null,
                EffectOverrides: null,
                ItemAttribute: attr,
                ItemColor: 0,
                CurLifeSpan: curLife,
                MaxLifeSpan: maxLife);
        }

        PersistedInventoryItem Bag(int itemId, int bagX, int bagY, int curLife, int maxLife, uint attr = 0) {
            return new PersistedInventoryItem(
                itemId,
                uid++,
                bagX,
                bagY,
                Quantity: 1,
                BagZIndex: bagX + bagY * 8,
                EffectOverrides: null,
                ItemAttribute: attr,
                ItemColor: 0,
                CurLifeSpan: curLife,
                MaxLifeSpan: maxLife);
        }

        // Wand MS22: Casting Probability nibble 15 + Hitting Probability nibble 7 (bitfield max).
        // Product labels "CP40 / hitting 80" do not fit the 4-bit Olympia nibbles; this is the cap.
        var wandAttr = EncodeMagic(
            ItemMagicAttribute.P_CastingProb,
            15,
            ItemMagicAttribute.S_HitProb,
            7);
        var xelimaHitAttr = EncodeMagic(0, 0, ItemMagicAttribute.S_HitProb, 7);

        return new PlayerPersistenceState(
            HubWorldId,
            HubX,
            HubY,
            MovementSpeedMs: 260,
            CastSpeedMs: 1200,
            AttackSpeedMs: 800,
            AttackRange: 1,
            Damage: 8,
            StunDuration: 500,
            AttackType: 1,
            AttackMode: true,
            RunMode: true,
            AllowDashAttack: false,
            GenderValue: 0,
            SkinColorValue: 0,
            HairStyleIndex: 0,
            UnderwearColorIndex: 0,
            FacingDirection: 4,
            BagItems: [
                Bag(407, 0, 0, 0, 0), // a Hero Cap(M)
                Bag(415, 1, 0, 0, 0), // a Hero Robe(M)
                Bag(419, 2, 0, 0, 0), // a Hero Hauberk(M) spare (mage set)
                Bag(423, 3, 0, 0, 0), // a Hero Leggings(M) spare (mage set)
                Bag(MerienShieldId, 4, 0, 0, 0),
                Bag(StormBringerId, 5, 0, 0, 0),
                Bag(IceElementalNeckId, 6, 0, 0, 0),
                Bag(XelimaNeckId, 7, 0, 0, 0, xelimaHitAttr),
                Bag(Ms22WandId, 0, 1, 200, 200, wandAttr),
            ],
            EquippedItems: [
                new PersistedEquippedInventoryItem("weapon", Eq(GiantBattleHammerId, 6000, 6000)),
                new PersistedEquippedInventoryItem("helmet", Eq(403, 0, 0)),
                new PersistedEquippedInventoryItem("armor", Eq(411, 0, 0)),
                new PersistedEquippedInventoryItem("hauberk", Eq(419, 0, 0)),
                new PersistedEquippedInventoryItem("leggings", Eq(423, 0, 0)),
                new PersistedEquippedInventoryItem("cape", Eq(402, 0, 0)),
            ],
            CharacterName: PlaytestMode.CharacterName,
            Exp: ExpForLevel150,
            Level: Level,
            Rebirth: 0,
            MonsterKills: null,
            ClaimedMilestones: null,
            SlotIndex: 0,
            HoursPlayed: 0,
            Str: Str,
            Vit: Vit,
            Dex: Dex,
            Int: Intel,
            Mag: Mag,
            Chr: Chr,
            BeginnerPath: null,
            WarehouseItems: null,
            GuildInterestRegistered: false,
            CitizenshipSide: "traveler",
            GuildId: "",
            GuildRank: 0,
            Reputation: 0,
            SafeAttackMode: false,
            MajesticPoints: 0,
            LearnedOlympiaSpellIds: null,
            LevelBlocked: false,
            HungerStatus: 100,
            SkillLevels: skills,
            StakedHell: 0,
            EnchantMaterials: null,
            Contribution: 0,
            GardenQuestId: "",
            GardenQuestProgress: 0,
            RebirthRollback: null);
    }

    public static uint EncodeMagic(int primaryType, int primaryValue, int secondaryType, int secondaryValue) {
        return ((uint)(primaryType & 0xF) << 20)
            | ((uint)(primaryValue & 0xF) << 16)
            | ((uint)(secondaryType & 0xF) << 12)
            | ((uint)(secondaryValue & 0xF) << 8);
    }

    static string ResolveTemplatePath() {
        var cwd = Path.Combine(Directory.GetCurrentDirectory(), TemplateRelativePath);
        if (File.Exists(cwd)) {
            return cwd;
        }

        return Path.Combine(AppContext.BaseDirectory, TemplateRelativePath);
    }

    static PlayerPersistenceState? TryLoadCharsFallback(string charsPlaytestDirectory) {
        var parent = Directory.GetParent(charsPlaytestDirectory)?.FullName;
        if (string.IsNullOrEmpty(parent)) {
            return null;
        }

        var liveChars = Path.Combine(parent, "Chars", SaveFileName);
        return TryLoadFile(liveChars);
    }

    static PlayerPersistenceState? TryLoadFile(string? path) {
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path)) {
            return null;
        }

        try {
            using var stream = File.OpenRead(path);
            return JsonSerializer.Deserialize<PlayerPersistenceState>(stream, JsonOptions);
        } catch (Exception ex) {
            Console.Error.WriteLine($"[PLAYTEST] Failed to read '{path}': {ex.Message}");
            return null;
        }
    }

    static void WriteAtomic(string path, PlayerPersistenceState state) {
        Directory.CreateDirectory(Path.GetDirectoryName(path) ?? ".");
        var tempPath = $"{path}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(state, JsonOptions);
        File.WriteAllText(tempPath, json);
        File.Move(tempPath, path, overwrite: true);
    }
}
