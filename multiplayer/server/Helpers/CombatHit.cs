using Server;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia-inspired hit/miss and magic resist rolls.
/// Not a 1:1 port of Client/Server.cpp tables — playable city-feel defaults with skill hooks.
/// </summary>
public static class CombatHit {
    public const int MinHitChance = 18;
    public const int MaxHitChance = 97;

    /// <summary>
    /// Melee (or bow) swing vs living monster. False = miss (0 damage, no wear ideally).
    /// </summary>
    public static bool RollMeleeHitMonster(GameWorldPlayer attacker, GameWorldMonster target) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(target);
        var chance = MeleeHitChanceVsMonster(attacker, target);
        return Random.Shared.Next(1, 101) <= chance;
    }

    /// <summary>Melee vs another player (after defense-shield path).</summary>
    public static bool RollMeleeHitPlayer(GameWorldPlayer attacker, GameWorldPlayer target) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(target);
        var chance = MeleeHitChanceVsPlayer(attacker, target);
        return Random.Shared.Next(1, 101) <= chance;
    }

    public static int MeleeHitChanceVsMonster(GameWorldPlayer attacker, GameWorldMonster target) {
        var dex = Math.Max(1, PlayerDerivedStats.EffectiveDex(attacker));
        // Base 72% + DEX/4, minus monster toughness (HP-band proxy for gen).
        var gen = EstimateMonsterGen(target);
        var chance = 72 + dex / 4 - gen * 3;
        chance += WeaponMasteryBonus(attacker);
        chance += MobSpecialty.HitChanceBonusPoints(attacker, target.CatalogMonsterId);
        // Olympia war Hero full set: +100 Hit Ratio → /10 on our % scale.
        chance += HeroSetBonus.ExtraHitRatio(attacker) / 10;
        return Math.Clamp(chance, MinHitChance, MaxHitChance);
    }

    public static int MeleeHitChanceVsPlayer(GameWorldPlayer attacker, GameWorldPlayer target) {
        var dex = Math.Max(1, PlayerDerivedStats.EffectiveDex(attacker));
        var targetDex = Math.Max(1, PlayerDerivedStats.EffectiveDex(target));
        var chance = 70 + dex / 4 - targetDex / 6;
        chance += WeaponMasteryBonus(attacker);
        // Attacker magic hit-ratio secondary (AR+)
        var atkBonuses = ItemMagicAttribute.ComputeEquippedBonuses(attacker);
        chance += atkBonuses.HitRatio / 10;
        // Olympia war Hero full set: +100 Hit Ratio.
        chance += HeroSetBonus.ExtraHitRatio(attacker) / 10;
        // Defender Defense Ratio (base armor v1 + magic DR) reduces hit chance.
        var defRatio = PlayerDerivedStats.GetDefenseRatio(target);
        chance -= defRatio / 8;
        // Physical Absorption skill (dodge-ish feel).
        var abs = target.GetSkillLevel(Skills.PhysicalAbsorption);
        chance -= abs / 8;
        return Math.Clamp(chance, MinHitChance, MaxHitChance);
    }

    public static int MagicHitChanceVsMonster(GameWorldPlayer caster, GameWorldMonster target, int spellHitChanceBonus = 0) {
        var mag = Math.Max(0, PlayerDerivedStats.EffectiveMag(caster));
        var chance = 78 + mag / 5;
        // Monster catalog MagicHitRatio: higher = harder to land (0–100 scale if set).
        var mhr = target.MagicHitRatio;
        if (mhr > 0) {
            chance -= Math.Clamp(mhr, 0, 60) / 2;
        } else {
            chance -= EstimateMonsterGen(target) * 2;
        }
        chance += caster.GetSkillLevel(Skills.StaffMastery) / 5;
        chance += MobSpecialty.HitChanceBonusPoints(caster, target.CatalogMonsterId);
        chance += spellHitChanceBonus;
        return Math.Clamp(chance, MinHitChance, MaxHitChance);
    }

    public static int MagicHitChanceVsPlayer(GameWorldPlayer caster, GameWorldPlayer target, int spellHitChanceBonus = 0) {
        var mag = Math.Max(0, PlayerDerivedStats.EffectiveMag(caster));
        var chance = 76 + mag / 5;
        chance -= target.GetSkillLevel(Skills.MagicResistance) / 4;
        // Magic Resistance secondary on gear (value*7)
        var defB = ItemMagicAttribute.ComputeEquippedBonuses(target);
        chance -= defB.MagicResistance / 10;
        chance += caster.GetSkillLevel(Skills.StaffMastery) / 6;
        chance += spellHitChanceBonus;
        return Math.Clamp(chance, MinHitChance, MaxHitChance);
    }

    public static bool RollMagicHitMonster(GameWorldPlayer caster, GameWorldMonster target, SpellConfig? spell = null) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(target);
        var bonus = spell?.HitChanceBonus ?? 0;
        var chance = MagicHitChanceVsMonster(caster, target, bonus);
        return Random.Shared.Next(1, 101) <= chance;
    }

    public static bool RollMagicHitPlayer(GameWorldPlayer caster, GameWorldPlayer target, SpellConfig? spell = null) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(target);
        var bonus = spell?.HitChanceBonus ?? 0;
        var chance = MagicHitChanceVsPlayer(caster, target, bonus);
        return Random.Shared.Next(1, 101) <= chance;
    }

    /// <summary>+0..12 from weapon mastery matching equipped type (Sword/Axe/Bow/Staff).</summary>
    public static int WeaponMasteryBonus(GameWorldPlayer attacker) {
        var skillId = ResolveWeaponMasterySkill(attacker);
        if (skillId < 0) {
            return 0;
        }
        return attacker.GetSkillLevel(skillId) / 8; // 0–12 at 0–100
    }

    /// <summary>Small skill XP drip on successful hits (combat masteries).</summary>
    public static void TryTrainWeaponSkillOnHit(GameWorldPlayer attacker) {
        var skillId = ResolveWeaponMasterySkill(attacker);
        if (skillId < 0) {
            return;
        }
        var level = attacker.GetSkillLevel(skillId);
        if (level >= Skills.MaxLevel) {
            return;
        }
        // ~8% chance to +1 mastery per successful hit (soft grind).
        if (Random.Shared.Next(1, 101) <= 8) {
            attacker.SetSkillLevel(skillId, level + 1);
        }
    }

    public static void TryTrainMagicResistanceOnSpellHit(GameWorldPlayer defender) {
        var level = defender.GetSkillLevel(Skills.MagicResistance);
        if (level >= Skills.MaxLevel) {
            return;
        }
        if (Random.Shared.Next(1, 101) <= 5) {
            defender.SetSkillLevel(Skills.MagicResistance, level + 1);
        }
    }

    static int ResolveWeaponMasterySkill(GameWorldPlayer attacker) {
        if (!attacker.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return Skills.LongSword; // bare hand trains sword lightly
        }
        ItemAttackCatalog.EnsureLoaded();
        if (!ItemAttackCatalog.TryGet(weapon.ItemId, out var dice)) {
            return Skills.LongSword;
        }
        // Heuristic from weapon type / name path in catalog: bow vs staff vs axe vs sword.
        // ItemAttackCatalog may only have dice — use item id name via items if available later.
        // Bow ids commonly high dice type; use simple id ranges from Olympia families.
        var id = weapon.ItemId;
        // Staff / wands
        if ((id >= 256 && id <= 259) || (id >= 270 && id <= 280) || id == 846 || id == 861 || id == 862) {
            return Skills.StaffMastery;
        }
        // Rapiers / fencing (Blood, Xelima, Knight, DK, base rapiers)
        if (id is 34 or 35 or 36 or 492 or 612 or 671 or 717) {
            return Skills.Fencing;
        }
        // Bows
        if ((id >= 800 && id <= 830) || id == 241 || id == 242) {
            return Skills.BowMastery;
        }
        // Axes (Light Axe family ~59–74)
        if (id >= 59 && id <= 80) {
            return Skills.AxeMastery;
        }
        // Hammers (Olympia relatedSkill 14 → CL Hammer Mastery)
        if (id is 760 or 761 or 762 or 843) {
            return Skills.HammerMastery;
        }
        return Skills.LongSword;
    }

    static int EstimateMonsterGen(GameWorldMonster m) {
        // Fallback when GenLevel unset: rough from max HP bands.
        var hp = m.MaxHp;
        if (hp <= 20) return 1;
        if (hp <= 80) return 2;
        if (hp <= 200) return 3;
        if (hp <= 500) return 5;
        if (hp <= 1200) return 7;
        if (hp <= 2500) return 9;
        return 10;
    }
}
