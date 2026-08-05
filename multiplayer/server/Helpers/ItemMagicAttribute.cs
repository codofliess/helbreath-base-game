using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Full Olympia armor/weapon/jewelry magic attribute logic (Server.cpp CalcTotalItemEffect).
/// Primary/secondary bitfield + Item.cfg base DR/PA + ADDEFFECT (type 14) for rings/necklaces.
/// </summary>
public static class ItemMagicAttribute {
    // Primary types (bits 20–23)
    public const int P_Critical = 1;
    public const int P_Poisoning = 2;
    public const int P_Righteous = 3;
    public const int P_Agile = 5;
    public const int P_Light = 6;
    public const int P_Ancient = 7;
    public const int P_SharpOrEndurance = 8;
    public const int P_CastingProb = 9;
    public const int P_ManaConverting = 10;
    public const int P_Experience = 11;
    public const int P_Gold = 12;

    // Secondary types (bits 12–15)
    public const int S_PoisonResist = 1;
    public const int S_HitProb = 2;
    public const int S_DefenseRatio = 3;
    public const int S_HpRegen = 4;
    public const int S_SpRegen = 5;
    public const int S_MpRegen = 6;
    public const int S_MagicResist = 7;
    public const int S_PhysicalAbs = 8;
    public const int S_MagicAbs = 9;
    public const int S_Cad = 10;
    public const int S_Exp = 11;
    public const int S_Gold = 12;

    /// <summary>Aggregated equip bonuses matching Olympia m_iAdd* / absorption fields.</summary>
    public readonly record struct EquippedBonuses(
        int DefenseRatio,
        int PhysicalAbsorptionPercent,
        int MagicAbsorptionPercent,
        int MagicResistance,
        int HitRatio,
        int PoisonResistance,
        int HpRegenPercent,
        int MpRegenPercent,
        int SpRegenPercent,
        int ExpBonusPercent,
        int GoldBonusPercent,
        int WeaponMagicDamage,
        int ManaConvert,
        int ChargeCritical,
        int ConsecutiveAttackDamage,
        int ManaSavePercent,
        int AddPhysicalDamage,
        int AddMagicalDamage,
        int AbsAir,
        int AbsEarth,
        int AbsFire,
        int AbsWater,
        int LightWeightRawReduce,
        bool IsLucky,
        /// <summary>Agile weapon: reduce physical swing delay (ms). Olympia Attack Speed-1 ≈ ~80ms.</summary>
        int AgileAttackSpeedMsReduce,
        /// <summary>Poisoning weapon: % of physical damage applied as poison DoT contribution (20–70).</summary>
        int WeaponPoisonDamagePercent,
        /// <summary>Casting Probability flat bonus to magic cast success % (primary type 9).</summary>
        int CastingProbability);

    public static void Decode(
            uint attr,
            out int primaryType,
            out int primaryValue,
            out int secondaryType,
            out int secondaryValue,
            out int upgradeNibble) {
        primaryType = (int)((attr & 0x00F00000u) >> 20);
        primaryValue = (int)((attr & 0x000F0000u) >> 16);
        secondaryType = (int)((attr & 0x0000F000u) >> 12);
        secondaryValue = (int)((attr & 0x00000F00u) >> 8);
        upgradeNibble = (int)((attr & 0xF0000000u) >> 28);
    }

    /// <summary>
    /// Quality for physical weapons (naming + flat base damage). Not "1 magic vs 2 magic" as the
    /// damage rule itself — dual/high-value only <b>classifies</b> Exceptional.
    /// Superior = single magic; Exceptional = dual magic or primary nibble ≥ 7.
    /// </summary>
    public static string WeaponQualityName(int primaryType, int primaryValue, int secondaryType) {
        if (primaryType <= 0) {
            return "common";
        }
        if (secondaryType > 0 || primaryValue >= 7) {
            return "exceptional";
        }
        return "superior";
    }

    /// <summary>
    /// Flat <b>base damage</b> for physical weapons (CL product rule — NOT vanilla client "Damage+value×7").
    /// <list type="bullet">
    /// <item>Superior (any physical magic, no Sharp/Ancient) → +1</item>
    /// <item>Superior Sharp → +2</item>
    /// <item>Exceptional Sharp → +3</item>
    /// <item>Superior Ancient → +3</item>
    /// <item>Exceptional Ancient → +4</item>
    /// </list>
    /// Sharp is always <b>1 less</b> than Ancient at the same quality.
    /// Formula: qualityBase (Superior=1 / Exceptional=2) + Sharp(+1) / Ancient(+2).
    /// </summary>
    public static int WeaponQualityBaseDamage(int primaryType, int primaryValue, int secondaryType) {
        if (primaryType <= 0) {
            return 0;
        }
        var exceptional = secondaryType > 0 || primaryValue >= 7;
        var qualityBase = exceptional ? 2 : 1;
        return primaryType switch {
            P_SharpOrEndurance => qualityBase + 1, // +2 / +3
            P_Ancient => qualityBase + 2, // +3 / +4 (always Sharp+1)
            _ => qualityBase, // Superior Light/Agile/… = +1; Exceptional same without Sharp = +2
        };
    }

    public static bool IsDefenseGear(ItemConfig? def) {
        if (def is null) {
            return false;
        }
        return def.ItemType is "shield" or "armor" or "hauberk" or "leggings" or "boots" or "helmet" or "cape";
    }

    public static bool IsWeapon(ItemConfig? def) =>
        def is not null && string.Equals(def.ItemType, "weapon", StringComparison.OrdinalIgnoreCase);

    /// <summary>Mana-save wands (effect type 13) — primary nibble meaning differs from melee.</summary>
    public static bool IsManaSaveWand(ItemConfig? def) {
        if (def is null) {
            return false;
        }
        if (def.OlympiaEffectType == OlympiaItemEffectType.AttackManaSave) {
            return true;
        }
        return IsWeapon(def) && def.Name.Contains("Wand", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Catalog base Mana Save % from wand name (MS0/10/20/22). Magic primary is CP/HP/MP vamp separately.</summary>
    public static int CatalogManaSavePercent(ItemConfig? def) {
        if (def is null || !IsManaSaveWand(def)) {
            return 0;
        }
        var name = def.Name;
        if (name.Contains("MS22", StringComparison.OrdinalIgnoreCase)) {
            return 22;
        }
        if (name.Contains("MS20", StringComparison.OrdinalIgnoreCase)) {
            return 20;
        }
        if (name.Contains("MS10", StringComparison.OrdinalIgnoreCase)) {
            return 10;
        }
        // MS0 / unnamed base wand
        if (name.Contains("MS0", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Wand", StringComparison.OrdinalIgnoreCase)) {
            // M.Shield and MS0 → 0 catalog MS; still a wand for affix rules.
            if (name.Contains("MS0", StringComparison.OrdinalIgnoreCase)) {
                return 0;
            }
            if (name.Contains("M.Shield", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("MShield", StringComparison.OrdinalIgnoreCase)) {
                return 0;
            }
        }
        return 0;
    }

    public static bool IsJewelrySlot(string slot) =>
        slot is "necklace" or "ring-left" or "ring-right" or "accessory" or "ring";

    public static bool IsJewelry(ItemConfig? def) {
        if (def is null) {
            return false;
        }
        return def.ItemType is "necklace" or "ring" or "accessory";
    }

    /// <summary>
    /// Drop-time: Endurance primary on defense gear boosts MaxLifeSpan.
    /// Olympia does not apply Endurance as Damage+; that string was a classic GetItemName quirk for type 8.
    /// </summary>
    public static void ApplyDropTimeEffects(InventoryItemState item, ItemConfig def) {
        ArgumentNullException.ThrowIfNull(item);
        ArgumentNullException.ThrowIfNull(def);
        if (item.ItemAttribute == 0) {
            return;
        }

        Decode(item.ItemAttribute, out var pType, out var pValue, out _, out _, out _);
        if (pType != P_SharpOrEndurance || pValue <= 0 || !IsDefenseGear(def)) {
            return;
        }

        item.EnsureCatalogDurability(def);
        if (item.MaxLifeSpan <= 1) {
            return;
        }

        // Product scale: nibble×7, hard cap 91% (same band as MR/DR/etc. — never ×15 / 135%+).
        var pct = Math.Min(91, Math.Clamp(pValue, 0, 13) * 7);
        var boosted = (int)Math.Round(item.MaxLifeSpan * (100 + pct) / 100.0);
        if (boosted < item.MaxLifeSpan) {
            boosted = item.MaxLifeSpan;
        }
        item.MaxLifeSpan = boosted;
        item.CurLifeSpan = item.MaxLifeSpan;
    }

    /// <summary>
    /// Full equip scan: base Item.cfg DR/PA + magic primary/secondary + ADDEFFECT jewelry.
    /// </summary>
    public static EquippedBonuses ComputeEquippedBonuses(
            GameWorldPlayer player,
            IReadOnlyDictionary<int, ItemConfig>? itemsById = null) {
        ArgumentNullException.ThrowIfNull(player);
        ItemDefenseCatalog.EnsureLoaded();
        ItemAddEffectCatalog.EnsureLoaded();

        var dr = 0;
        var paBody = 0;
        var paLegs = 0;
        var paArms = 0;
        var paHead = 0;
        var paShield = 0;
        var paOther = 0;

        var ma = 0;
        var mr = 0;
        var hit = 0;
        var pr = 0;
        var hpR = 0;
        var mpR = 0;
        var spR = 0;
        var expB = 0;
        var goldB = 0;
        var weaponDmg = 0;
        var manaConv = 0;
        var chargeCrit = 0;
        var cad = 0;
        var manaSave = 0;
        var addPhys = 0;
        var addMag = 0;
        var absAir = 0;
        var absEarth = 0;
        var absFire = 0;
        var absWater = 0;
        var lightWeight = 0;
        var isLucky = false;
        var agileMs = 0;
        var poisonPct = 0;
        var castingProb = 0;

        foreach (var (slot, eq) in player.InventoryManager.EquippedItems) {
            ItemConfig? def = null;
            if (itemsById is null || !itemsById.TryGetValue(eq.ItemId, out def)) {
                player.InventoryManager.TryGetItemConfig(eq.ItemId, out def!);
            }

            var isWeapon = IsWeapon(def) || string.Equals(slot, "weapon", StringComparison.OrdinalIgnoreCase);
            var isWand = IsManaSaveWand(def);
            var isDefense = IsDefenseGear(def) || IsDefenseSlot(slot);
            var isJewelry = IsJewelry(def) || IsJewelrySlot(slot);

            // Catalog base Mana Save on MS0/10/20/22 wands (magic primary is CP/HP/MP vamp).
            if (isWand) {
                manaSave += CatalogManaSavePercent(def);
            }

            // —— Base Item.cfg defense stats ——
            if (isDefense && ItemDefenseCatalog.TryGet(eq.ItemId, out ItemDefenseCatalog.DefenseStats baseStats)) {
                dr += baseStats.DefenseRatio;
                if (string.Equals(slot, "shield", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(def?.ItemType, "shield", StringComparison.OrdinalIgnoreCase)) {
                    var v1 = baseStats.DefenseRatio;
                    paShield += Math.Max(0, v1 - v1 / 3);
                } else {
                    AddPaToSlot(slot, baseStats.PhysicalAbsorptionPercent, ref paBody, ref paLegs, ref paArms, ref paHead, ref paOther);
                }
            }

            // —— ADDEFFECT jewelry (Item.cfg effect type 14) ——
            if (isJewelry && ItemAddEffectCatalog.TryGet(eq.ItemId, out var addFx)) {
                // CL product: Necklace of Ice Elemental (643) = MA only, NOT freeze immunity /
                // ice-abs that would blunt Mass Blizzard chill. Skip AbsWater from this piece.
                if (eq.ItemId == 643) {
                    ma += 35;
                    if (ma > 80) {
                        ma = 80;
                    }
                } else {
                    ApplyAddEffect(addFx, ref dr, ref mr, ref manaSave, ref addPhys, ref addMag,
                        ref absAir, ref absEarth, ref absFire, ref absWater, ref pr, ref hit, ref isLucky,
                        ref paBody, ref paLegs, ref paArms, ref paHead, ref paOther);
                }
            }

            // Upgrade nibble (Xelima weapons / Merien armor).
            var upgradeLevel = (int)((eq.ItemAttribute & 0xF0000000u) >> 28);
            if (isWeapon && upgradeLevel > 0) {
                // Xelima: flat physical+magical damage per +N.
                addPhys += upgradeLevel;
                addMag += upgradeLevel;
            }
            if (isDefense && upgradeLevel > 0) {
                // Merien: +1 DR per upgrade level; endurance is max-lifespan on stone success.
                // PA starts at +5: +5→+1 PA, +6→+2, … +10→+6 (then flat).
                dr += upgradeLevel;
                if (upgradeLevel >= 5) {
                    var paMerien = Math.Min(6, upgradeLevel - 4);
                    if (string.Equals(slot, "shield", StringComparison.OrdinalIgnoreCase)) {
                        paShield += paMerien;
                    } else {
                        AddPaToSlot(slot, paMerien, ref paBody, ref paLegs, ref paArms, ref paHead, ref paOther);
                    }
                }
            }

            if (eq.ItemAttribute == 0) {
                continue;
            }

            Decode(eq.ItemAttribute, out var pType, out var pValue, out var sType, out var sValue, out _);

            // —— Primary magic ——
            if (isWeapon) {
                if (isWand) {
                    // Wand primary: CP / HP Vamp / MP Vamp (type 4 Strong never on melee; reused on wands).
                    switch (pType) {
                        case P_CastingProb when pValue > 0:
                            castingProb += pValue;
                            break;
                        case 4 when pValue > 0: // HP Vamp
                            hpR += pValue * 7;
                            break;
                        case P_Light when pValue > 0: // type 6 → MP Vamp on wands
                            mpR += pValue * 7;
                            break;
                        case P_ManaConverting when pValue > 0:
                            // Legacy rolled Mana Save primary (older drops) still applies.
                            manaSave += pValue;
                            break;
                    }
                } else {
                    // Flat base damage from quality + Sharp/Ancient (never value×7).
                    weaponDmg += WeaponQualityBaseDamage(pType, pValue, sType);
                    switch (pType) {
                        case P_CastingProb when pValue > 0:
                            castingProb += pValue;
                            break;
                        case P_Agile:
                            // Physical swing faster (Olympia Attack Speed-1 ≈ one speed step).
                            agileMs += 80;
                            break;
                        case P_Poisoning when pValue > 0:
                            // Poison Damage 20%–70% (value×5, floor 4 → 20).
                            poisonPct = Math.Max(poisonPct, Math.Clamp(pValue * 5, 20, 70));
                            break;
                        case P_ManaConverting:
                            // Melee weapons never roll Mana Converting.
                            break;
                        case P_Light when pValue > 0:
                            // Weight− and full-swing Str− (value×4 stones) → raw units ×100
                            lightWeight += pValue * 4 * 100;
                            break;
                        // Type 4 Strong = disabled for weapons — ignore if present on old data.
                        case 4:
                            break;
                    }
                }
            } else if (isDefense) {
                switch (pType) {
                    case 11 when pValue > 0: // equip TransMana
                        manaConv += pValue;
                        if (manaConv > 13) {
                            manaConv = 13;
                        }
                        break;
                    case 12 when pValue > 0: // Charge Critical
                        chargeCrit += pValue;
                        if (chargeCrit > 20) {
                            chargeCrit = 20;
                        }
                        break;
                    case P_Critical when pValue > 0:
                        chargeCrit += pValue;
                        if (chargeCrit > 20) {
                            chargeCrit = 20;
                        }
                        break;
                    case P_ManaConverting when pValue > 0:
                        manaConv += pValue;
                        if (manaConv > 13) {
                            manaConv = 13;
                        }
                        break;
                    case P_Light when pValue > 0:
                        // Light armor: weight − value*4 stones; also lower str-feel
                        lightWeight += pValue * 4 * 100;
                        break;
                    case P_CastingProb when pValue > 0:
                        castingProb += pValue;
                        break;
                    case P_Ancient:
                        weaponDmg += 1; // defense Ancient still bumps attack dice slightly in Olympia
                        break;
                }
            }

            // —— Secondary magic (weapon + armor) ——
            // Per-piece fragment caps: *7 stats nibble ≤ 13 (display 91); PA/MA nibble ≤ 13 (display 39≈40).
            if (sType > 0 && sValue > 0) {
                var frag7 = Math.Clamp(sValue, 0, 13);
                var fragAbs = Math.Clamp(sValue, 0, 13);
                switch (sType) {
                    case S_PoisonResist:
                        pr += frag7 * 7;
                        break;
                    case S_HitProb:
                        // Hitting Probability +1..+7 nibble → HR% * 7 (Olympia)
                        hit += Math.Clamp(sValue, 1, 7) * 7;
                        break;
                    case S_DefenseRatio:
                        dr += frag7 * 7;
                        break;
                    case S_HpRegen:
                        hpR += frag7 * 7;
                        break;
                    case S_SpRegen:
                        spR += frag7 * 7;
                        break;
                    case S_MpRegen:
                        mpR += frag7 * 7;
                        break;
                    case S_MagicResist:
                        mr += frag7 * 7;
                        break;
                    case S_PhysicalAbs:
                        var paAdd = fragAbs * 3;
                        if (string.Equals(slot, "shield", StringComparison.OrdinalIgnoreCase)) {
                            paShield += paAdd;
                        } else {
                            AddPaToSlot(slot, paAdd, ref paBody, ref paLegs, ref paArms, ref paHead, ref paOther);
                        }
                        break;
                    case S_MagicAbs:
                        ma += fragAbs * 3;
                        if (ma > 80) {
                            ma = 80;
                        }
                        break;
                    case S_Cad:
                        // Consecutive Attack Damage +1..+7 flat when combo count > 1
                        cad += Math.Clamp(sValue, 1, 7);
                        break;
                    case S_Exp:
                        // Exp +1..+7 → +10%..+70%
                        expB += Math.Clamp(sValue, 1, 7) * 10;
                        break;
                    case S_Gold:
                        // Gold/Rep-style +1..+7 → +10%..+70%
                        goldB += Math.Clamp(sValue, 1, 7) * 10;
                        break;
                }
            }
        }

        var expectedPa = paShield
            + (int)Math.Round(paBody * 0.50)
            + (int)Math.Round(paLegs * 0.25)
            + (int)Math.Round(paArms * 0.15)
            + (int)Math.Round(paHead * 0.10)
            + (int)Math.Round(paOther * 0.05);
        expectedPa = Math.Clamp(expectedPa, 0, 80);

        if (manaSave > 80) {
            manaSave = 80;
        }

        return new EquippedBonuses(
            DefenseRatio: Math.Max(0, dr),
            PhysicalAbsorptionPercent: expectedPa,
            MagicAbsorptionPercent: Math.Clamp(ma, 0, 80),
            MagicResistance: Math.Max(0, mr),
            HitRatio: Math.Max(0, hit),
            PoisonResistance: Math.Max(0, pr),
            HpRegenPercent: Math.Max(0, hpR),
            MpRegenPercent: Math.Max(0, mpR),
            SpRegenPercent: Math.Max(0, spR),
            ExpBonusPercent: Math.Max(0, expB),
            GoldBonusPercent: Math.Max(0, goldB),
            WeaponMagicDamage: Math.Max(0, weaponDmg),
            ManaConvert: manaConv,
            ChargeCritical: chargeCrit,
            ConsecutiveAttackDamage: Math.Max(0, cad),
            ManaSavePercent: Math.Max(0, manaSave),
            AddPhysicalDamage: Math.Max(0, addPhys),
            AddMagicalDamage: Math.Max(0, addMag),
            AbsAir: Math.Max(0, absAir),
            AbsEarth: Math.Max(0, absEarth),
            AbsFire: Math.Max(0, absFire),
            AbsWater: Math.Max(0, absWater),
            LightWeightRawReduce: Math.Max(0, lightWeight),
            IsLucky: isLucky,
            AgileAttackSpeedMsReduce: Math.Max(0, agileMs),
            WeaponPoisonDamagePercent: Math.Clamp(poisonPct, 0, 70),
            CastingProbability: Math.Max(0, castingProb));
    }

    static void ApplyAddEffect(
            ItemAddEffectCatalog.AddEffect fx,
            ref int dr,
            ref int mr,
            ref int manaSave,
            ref int addPhys,
            ref int addMag,
            ref int absAir,
            ref int absEarth,
            ref int absFire,
            ref int absWater,
            ref int pr,
            ref int hit,
            ref bool isLucky,
            ref int paBody,
            ref int paLegs,
            ref int paArms,
            ref int paHead,
            ref int paOther) {
        switch (fx.Subtype) {
            case ItemAddEffectCatalog.SubMagicResist:
                mr += fx.Value;
                break;
            case ItemAddEffectCatalog.SubManaSave:
                manaSave += fx.Value;
                break;
            case ItemAddEffectCatalog.SubPhysicalDamage:
                addPhys += fx.Value;
                break;
            case ItemAddEffectCatalog.SubDefenseRatio:
                dr += fx.Value;
                break;
            case ItemAddEffectCatalog.SubLucky:
                // Lucky ring: value may be 0; presence of subtype enables luck
                isLucky = true;
                break;
            case ItemAddEffectCatalog.SubMagicalDamage:
                addMag += fx.Value;
                break;
            case ItemAddEffectCatalog.SubAbsAir:
                absAir += fx.Value;
                break;
            case ItemAddEffectCatalog.SubAbsEarth:
                absEarth += fx.Value;
                break;
            case ItemAddEffectCatalog.SubAbsFire:
                absFire += fx.Value;
                break;
            case ItemAddEffectCatalog.SubAbsWater:
                absWater += fx.Value;
                break;
            case ItemAddEffectCatalog.SubPoisonResist:
                pr += fx.Value;
                break;
            case ItemAddEffectCatalog.SubHitRatio:
                hit += fx.Value;
                break;
            // Magic gems purity formulas (13–15, 30) — approximate when value is purity/5 or /10
            case 13: // Magic Ruby → HP recovery %
                // purity/5 already baked into value by item gen when present; treat Value as regen%
                break;
            case 14: // Magic Diamond → hit
                hit += Math.Max(0, fx.Value);
                break;
            case 15: // Magic Emerald → MA %
                // applied as magic abs via value
                break;
            case 30: // Magic Sapphire → PA on all armor slots
                var sapphire = Math.Max(0, fx.Value);
                paHead += sapphire;
                paBody += sapphire;
                paArms += sapphire;
                paLegs += sapphire;
                break;
        }
    }

    static bool IsDefenseSlot(string slot) =>
        slot is "armor" or "hauberk" or "leggings" or "boots" or "helmet" or "cape" or "shield";

    static void AddPaToSlot(
            string slot,
            int pa,
            ref int body,
            ref int legs,
            ref int arms,
            ref int head,
            ref int other) {
        if (pa <= 0) {
            return;
        }
        switch (slot) {
            case "armor":
                body += pa;
                break;
            case "leggings":
                legs += pa;
                break;
            case "hauberk":
                arms += pa;
                break;
            case "helmet":
                head += pa;
                break;
            default:
                other += pa;
                break;
        }
    }

    public static int GetEquippedWeaponMagicDamage(GameWorldPlayer player) =>
        ComputeEquippedBonuses(player).WeaponMagicDamage;

    public static int GetEquippedMagicPhysicalAbsorptionPercent(GameWorldPlayer player) =>
        ComputeEquippedBonuses(player).PhysicalAbsorptionPercent;

    public static int GetEquippedMagicDefenseRatio(GameWorldPlayer player) =>
        ComputeEquippedBonuses(player).DefenseRatio;
}
