using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Encoding + overlay for the live traveler named exactly <c>Elon</c> on wallet
/// <c>4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K</c>. Olympia nibbles via
/// <see cref="Enchanting.Encode"/> / <see cref="MajesticUpgrade"/>. Not invoked from
/// server startup — door is <c>ops/apply-live-elon-warrior-kit.py</c> (allowlist + env + --apply).
/// </summary>
public static class LiveElonWarriorKit {
    public const string CharacterName = "Elon";
    public const string AccountWallet = "4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K";

    public const int Level = PlaytestElonQaKit.Level;
    public const int Str = PlaytestElonQaKit.Str;
    public const int Intel = PlaytestElonQaKit.Intel;
    public const int Mag = PlaytestElonQaKit.Mag;
    public const int Vit = PlaytestElonQaKit.Vit;
    public const int Chr = PlaytestElonQaKit.Chr;
    public const int Dex = PlaytestElonQaKit.Dex;
    public const long ExpForLevel150 = PlaytestElonQaKit.ExpForLevel150;

    public const int GiantBattleHammerId = PlaytestElonQaKit.GiantBattleHammerId;
    public const int HeroHelmId = 403;
    public const int HeroArmorId = 411;
    public const int HeroHauberkId = 419;
    public const int HeroLeggingsId = 423;
    public const int NeutralCapeId = 402;
    public const int AresdenHeroCapeId = 400;
    public const int ElvineHeroCapeId = 401;
    public const int HeroCapId = 407;
    public const int HeroRobeId = 415;
    public const int WingsHelmId = 751;
    public const int PlateMailId = 458;
    public const int PlateLeggingsId = 462;
    public const int PlateHauberkId = 454;
    public const int PlateCapeId = 402;

    /// <summary>
    /// MS22: CP nibble 15 (4-bit max; product CP40 does not fit). HR nibble 13 → display ×7 ≈ 91
    /// (closest to requested HR90). Combat still clamps S_HitProb to 7 unless that code changes.
    /// </summary>
    public const int WandCastingProbNibble = 15;
    public const int WandHitProbNibble = 13;

    /// <summary>Upgrade nibble 7 on GBH (visual/stat +7; 762 is not on the DK majestic id list).</summary>
    public const int HammerUpgradeNibble = 7;

    public const int CicLevel = 4;
    public const int CicHpKind = CicItemCraft.StatHp;
    public const int CicHpValue = 70;

    /// <summary>
    /// Extra bag cape: Mana Converting nibble 15 (4-bit max; product MCon20 does not fit;
    /// combat clamps MCon to 13). DR nibble 11 → 77 (closest to 80; 12 would be 84).
    /// </summary>
    public const int CapeMconNibble = 15;
    public const int CapeDrNibble = 11;

    public static uint CapeMconDrAttribute => Enchanting.Encode(
        ItemMagicAttribute.P_ManaConverting,
        CapeMconNibble,
        ItemMagicAttribute.S_DefenseRatio,
        CapeDrNibble,
        upgrade: 0);

    public static uint WandItemAttribute => Enchanting.Encode(
        ItemMagicAttribute.P_CastingProb,
        WandCastingProbNibble,
        ItemMagicAttribute.S_HitProb,
        WandHitProbNibble,
        upgrade: 0);

    public static uint HammerPlus7Attribute => MajesticUpgrade.SetUpgradeLevel(0, HammerUpgradeNibble);

    public static bool IsTargetCharacter(string? name) =>
        string.Equals((name ?? string.Empty).Trim(), CharacterName, StringComparison.Ordinal);

    public static bool IsTargetWallet(string? wallet) =>
        string.Equals((wallet ?? string.Empty).Trim(), AccountWallet, StringComparison.Ordinal);

    /// <summary>
    /// Overlay kit onto an existing snapshot. Keeps map/xy, appearance, warehouse, hours, slot,
    /// rebirth, citizenship. Equips hero warrior (M). Bag: GBH +7, MS22, mage cap/robe, CIC4 HP70 plate set.
    /// </summary>
    public static PlayerPersistenceState ApplyToExisting(PlayerPersistenceState existing) {
        ArgumentNullException.ThrowIfNull(existing);

        var skills = existing.SkillLevels is { Length: > 0 }
            ? (int[])existing.SkillLevels.Clone()
            : new int[Skills.SkillCount];
        if (skills.Length < Skills.SkillCount) {
            var grown = new int[Skills.SkillCount];
            Array.Copy(skills, grown, skills.Length);
            skills = grown;
        }
        for (var i = 0; i < skills.Length; i++) {
            if (skills[i] < Skills.StartingSkillLevel) {
                skills[i] = Skills.StartingSkillLevel;
            }
        }
        skills[Skills.HammerMastery] = Skills.MaxLevel;
        skills[Skills.Magic] = Math.Max(skills[Skills.Magic], 50);
        skills[Skills.StaffMastery] = Math.Max(skills[Skills.StaffMastery], 50);

        long uid = NextItemUid(existing);

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

        PersistedInventoryItem Bag(
            int itemId,
            int bagX,
            int bagY,
            int curLife,
            int maxLife,
            uint attr = 0,
            int cicLevel = 0,
            int cicKind = 0,
            int cicValue = 0) {
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
                MaxLifeSpan: maxLife,
                BindState: 0,
                BoundGuildId: "",
                CicLevel: cicLevel,
                CicStatKind: cicKind,
                CicStatValue: cicValue);
        }

        var capeId = CapeIdForCitizenship(existing.CitizenshipSide);

        return existing with {
            AttackType = 1,
            AttackRange = 1,
            BagItems = [
                Bag(GiantBattleHammerId, 0, 0, 6000, 6000, HammerPlus7Attribute),
                Bag(PlaytestElonQaKit.Ms22WandId, 1, 0, 200, 200, WandItemAttribute),
                Bag(HeroCapId, 2, 0, 0, 0),
                Bag(HeroRobeId, 3, 0, 0, 0),
                Bag(WingsHelmId, 0, 1, 0, 0, cicLevel: CicLevel, cicKind: CicHpKind, cicValue: CicHpValue),
                Bag(PlateMailId, 1, 1, 0, 0, cicLevel: CicLevel, cicKind: CicHpKind, cicValue: CicHpValue),
                Bag(PlateLeggingsId, 2, 1, 0, 0, cicLevel: CicLevel, cicKind: CicHpKind, cicValue: CicHpValue),
                Bag(PlateHauberkId, 3, 1, 0, 0, cicLevel: CicLevel, cicKind: CicHpKind, cicValue: CicHpValue),
                Bag(PlateCapeId, 4, 1, 0, 0, cicLevel: CicLevel, cicKind: CicHpKind, cicValue: CicHpValue),
                Bag(PlateCapeId, 5, 1, 0, 0, CapeMconDrAttribute),
            ],
            EquippedItems = [
                new PersistedEquippedInventoryItem("helmet", Eq(HeroHelmId, 0, 0)),
                new PersistedEquippedInventoryItem("armor", Eq(HeroArmorId, 0, 0)),
                new PersistedEquippedInventoryItem("hauberk", Eq(HeroHauberkId, 0, 0)),
                new PersistedEquippedInventoryItem("leggings", Eq(HeroLeggingsId, 0, 0)),
                new PersistedEquippedInventoryItem("cape", Eq(capeId, 0, 0)),
            ],
            CharacterName = CharacterName,
            Exp = Math.Max(existing.Exp, ExpForLevel150),
            Level = Level,
            Str = Str,
            Vit = Vit,
            Dex = Dex,
            Int = Intel,
            Mag = Mag,
            Chr = Chr,
            SkillLevels = skills,
        };
    }

    public static int CapeIdForCitizenship(string? side) {
        var s = (side ?? string.Empty).Trim().ToLowerInvariant();
        if (s == "aresden") {
            return AresdenHeroCapeId;
        }
        if (s == "elvine") {
            return ElvineHeroCapeId;
        }
        return NeutralCapeId;
    }

    static long NextItemUid(PlayerPersistenceState state) {
        long max = 9_100_000;
        void Consider(long uid) {
            if (uid > max) {
                max = uid;
            }
        }

        if (state.BagItems is not null) {
            foreach (var row in state.BagItems) {
                Consider(row.ItemUid);
            }
        }
        if (state.EquippedItems is not null) {
            foreach (var row in state.EquippedItems) {
                Consider(row.Item.ItemUid);
            }
        }
        if (state.WarehouseItems is not null) {
            foreach (var row in state.WarehouseItems) {
                Consider(row.ItemUid);
            }
        }
        return max + 1;
    }
}
