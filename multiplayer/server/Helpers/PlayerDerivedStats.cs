using Server;
using Server.Utils;
using Server.World;
using Server.World.Game;
using Mmorpg.Network;

namespace Server.Helpers;

/// <summary>
/// Olympia-derived combat stats: angelic pendant bonuses, max HP/MP/SP,
/// melee damage from Item.cfg dice + STR (iCalculateAttackEffect), and regen ticks.
/// </summary>
public static class PlayerDerivedStats {
    public const int AngelStrId = 1108;
    public const int AngelDexId = 1109;
    public const int AngelIntId = 1110;
    public const int AngelMagId = 1111;

    /// <summary>Olympia: angelic bonus = upgrade nibble + 1 while pendant equipped.</summary>
    public static void GetAngelicBonuses(GameWorldPlayer player, out int angelStr, out int angelDex, out int angelInt, out int angelMag) {
        angelStr = angelDex = angelInt = angelMag = 0;
        ArgumentNullException.ThrowIfNull(player);
        foreach (var eq in player.InventoryManager.EquippedItems.Values) {
            var upgrade = MajesticUpgrade.GetUpgradeLevel(eq.ItemAttribute);
            var bonus = upgrade + 1;
            switch (eq.ItemId) {
                case AngelStrId:
                    angelStr = Math.Max(angelStr, bonus);
                    break;
                case AngelDexId:
                    angelDex = Math.Max(angelDex, bonus);
                    break;
                case AngelIntId:
                    angelInt = Math.Max(angelInt, bonus);
                    break;
                case AngelMagId:
                    angelMag = Math.Max(angelMag, bonus);
                    break;
            }
        }
    }

    /// <summary>
    /// CIC craft bonuses from equipped cape/shield/armor (sum of CicStatValue by kind).
    /// Kind 1=HP, 2=SP, 3=MP — only items with CicLevel ≥ 3 contribute.
    /// </summary>
    public static void GetCicEquippedBonuses(GameWorldPlayer player, out int cicHp, out int cicSp, out int cicMp) {
        cicHp = cicSp = cicMp = 0;
        ArgumentNullException.ThrowIfNull(player);
        foreach (var eq in player.InventoryManager.EquippedItems.Values) {
            if (eq.CicLevel < CicItemCraft.MinCic || eq.CicStatValue <= 0) {
                continue;
            }
            switch (eq.CicStatKind) {
                case CicItemCraft.StatHp:
                    cicHp += eq.CicStatValue;
                    break;
                case CicItemCraft.StatSp:
                    cicSp += eq.CicStatValue;
                    break;
                case CicItemCraft.StatMp:
                    cicMp += eq.CicStatValue;
                    break;
            }
        }
    }

    public static int EffectiveStr(GameWorldPlayer player) {
        GetAngelicBonuses(player, out var a, out _, out _, out _);
        return player.Str + a;
    }

    public static int EffectiveDex(GameWorldPlayer player) {
        GetAngelicBonuses(player, out _, out var a, out _, out _);
        return player.Dex + a;
    }

    public static int EffectiveInt(GameWorldPlayer player) {
        GetAngelicBonuses(player, out _, out _, out var a, out _);
        return player.Int + a;
    }

    public static int EffectiveMag(GameWorldPlayer player) {
        GetAngelicBonuses(player, out _, out _, out _, out var a);
        return player.Mag + a;
    }

    /// <summary>
    /// Olympia normal cast bar when Mag ≥ 50 <b>or</b> Magic skill is 100% (even with Mag &lt; 50).
    /// This is classic full cast — not turbo. Lower ms = faster animation.
    /// </summary>
    public const int FullCastSpeedMs = 1200;
    /// <summary>Slower cast when Mag &lt; 50 and Magic skill &lt; 100 (incomplete casting).</summary>
    public const int SlowCastSpeedMs = 1800;

    /// <summary>
    /// Fastest cast duration (ms) allowed for this player right now.
    /// Magic skill 100% unlocks Olympia full cast (1200ms) even without Mag 50.
    /// </summary>
    public static int FastestAllowedCastSpeedMs(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var magicSkill = player.GetSkillLevel(Skills.Magic);
        if (magicSkill >= 100) {
            return FullCastSpeedMs;
        }
        if (EffectiveMag(player) >= 50) {
            return FullCastSpeedMs;
        }
        return SlowCastSpeedMs;
    }

    /// <summary>Apply authoritative cast speed (Olympia full 1200ms when Magic 100% or Mag ≥ 50).</summary>
    public static void ApplyAuthoritativeCastSpeed(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var fastest = FastestAllowedCastSpeedMs(player);
        player.SetCastSpeedMs(fastest);
    }

    public static void Refresh(GameWorldPlayer player, bool fillIncreasedPools = false) {
        ArgumentNullException.ThrowIfNull(player);
        ItemAttackCatalog.EnsureLoaded();
        player.RecalcOlympiaVitalsWithAngelic(fillIncreasedPools);
        player.RecalculateMeleeDamageFromStats();
    }

    /// <summary>
    /// Olympia <c>iCalculateAttackEffect</c> melee (SM path for standard monsters):
    /// bare hand: Dice(1, (Str+Angelic)/12);
    /// weapon: Dice(throw, range) + bonus, then + (damage * Str/5 %), then + upgrade nibble.
    /// </summary>
    public static int RollMeleeDamage(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ItemAttackCatalog.EnsureLoaded();
        var strEff = Math.Max(1, EffectiveStr(player));

        InventoryItemState? weapon = null;
        if (player.InventoryManager.EquippedItems.TryGetValue("weapon", out var w)) {
            weapon = w;
        }

        int damage;
        if (weapon is null) {
            // Olympia: iDice(1, (Str+Angelic)/12) then clamp ≥1 — with starter STR (~10–20) that is
            // always 1 until Str 24. Keep the same shape but use /6 so early bare-hand is 1–2+ and
            // still scales; equip a weapon for real damage (dagger 1d5 + STR%).
            var sides = Math.Max(2, strEff / 6);
            damage = Random.Shared.Next(1, sides + 1);
            // Same STR% bonus weapons get (Str/5 of base).
            var dTmp1 = (double)damage;
            var dTmp2 = strEff / 5.0;
            damage = (int)(dTmp1 + dTmp1 * (dTmp2 / 100.0) + 0.5);
        } else if (ItemAttackCatalog.TryGet(weapon.ItemId, out var dice)) {
            // Melee weapons (type &lt; 40 path): dice + bonus, then STR% = base * (Str/5)/100
            damage = ItemAttackCatalog.RollWeaponDamageSm(dice);
            var dTmp1 = (double)damage;
            var dTmp2 = strEff / 5.0;
            var dTmp3 = dTmp1 + dTmp1 * (dTmp2 / 100.0);
            damage = (int)(dTmp3 + 0.5);
            // Upgrade nibble → m_iAddPhysicalDamage
            damage += MajesticUpgrade.GetUpgradeLevel(weapon.ItemAttribute);
            // Name suffix +1/+2 in catalog (Dagger+1 id 4) already baked into Item.cfg bonus field.
        } else {
            // Unknown weapon: use a conservative dagger-like 1d5 + STR% + upgrade
            damage = Random.Shared.Next(1, 6);
            var dTmp1 = (double)damage;
            var dTmp2 = strEff / 5.0;
            damage = (int)(dTmp1 + dTmp1 * (dTmp2 / 100.0) + 0.5);
            damage += MajesticUpgrade.GetUpgradeLevel(weapon.ItemAttribute);
        }

        // Sharp (type 8) / Ancient (type 7) on the equipped weapon only — never from armor Endurance.
        var bonuses = ItemMagicAttribute.ComputeEquippedBonuses(player);
        damage += bonuses.WeaponMagicDamage;

        // Necklace/ring ADDEFFECT physical damage + weapon upgrade nibble (already partly in addPhys).
        damage += bonuses.AddPhysicalDamage;

        // Poisoning primary: +20%..+70% of base physical as poison-damage contribution.
        if (bonuses.WeaponPoisonDamagePercent > 0) {
            damage += Math.Max(1, damage * bonuses.WeaponPoisonDamagePercent / 100);
        }

        // Olympia full Hero set: War +5 AP, Mage +4 damage (Server.cpp m_cHeroArmourBonus).
        damage += HeroSetBonus.ExtraPhysicalDamage(player);

        // Kloness weapons / necklace: reputation-scaled flat damage (Olympia wiki Rare Items).
        damage += KlonessPhysicalBonus(player, targetPlayer: null);

        return Math.Max(1, damage);
    }

    /// <summary>
    /// Melee damage vs a player (enables Kloness "rep above target" bonus).
    /// </summary>
    public static int RollMeleeDamageVsPlayer(GameWorldPlayer attacker, GameWorldPlayer target) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(target);
        // Base path without PvP kloness, then re-apply with target.
        var damage = RollMeleeDamage(attacker);
        // RollMeleeDamage already applied self-rep Kloness once; strip and re-apply full formula.
        damage -= KlonessPhysicalBonus(attacker, targetPlayer: null);
        damage += KlonessPhysicalBonus(attacker, target);
        return Math.Max(1, damage);
    }

    // --- Legendary weapon bonuses (helbreath.net/wiki/Rare_Items) ---
    public const int KlonessBladeId = 849;
    public const int KlonessAxeId = 850;
    public const int KlonessEsterkId = 851;
    public const int NecklaceOfKlonessId = 859;
    public const int BerserkWandMs20Id = 861;
    public const int BerserkWandMs10Id = 862;
    public const int KlonessWandMs20Id = 863;
    public const int KlonessWandMs10Id = 864;
    /// <summary>Olympia rare hammer — double hits; SA crits consume 2 charges and double SA damage.</summary>
    public const int BaneId = 872;
    public const int NecklaceOfIceElementalId = 643;
    public const int MassBlizzardSpellId = 23;
    public const int SleepSpellId = 52;

    /// <summary>
    /// Kloness melee weapons: +1 dmg per 182 self-rep (cap 11) + +1 per 36 rep above target (cap 11).
    /// Necklace of Kloness: +1 per 500 self-rep (cap 4) + +1 per 100 above target (cap 4).
    /// </summary>
    public static int KlonessPhysicalBonus(GameWorldPlayer attacker, GameWorldPlayer? targetPlayer) {
        ArgumentNullException.ThrowIfNull(attacker);
        var rep = Math.Max(0, attacker.Reputation);
        var bonus = 0;

        if (attacker.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) && weapon is not null) {
            if (weapon.ItemId is KlonessBladeId or KlonessAxeId or KlonessEsterkId) {
                bonus += Math.Min(11, rep / 182);
                if (targetPlayer is not null) {
                    var diff = rep - Math.Max(0, targetPlayer.Reputation);
                    if (diff > 0) {
                        bonus += Math.Min(11, diff / 36);
                    }
                }
            }
        }

        if (attacker.InventoryManager.EquippedItems.TryGetValue("necklace", out var neck) &&
            neck is not null &&
            neck.ItemId == NecklaceOfKlonessId) {
            bonus += Math.Min(4, rep / 500);
            if (targetPlayer is not null) {
                var diff = rep - Math.Max(0, targetPlayer.Reputation);
                if (diff > 0) {
                    bonus += Math.Min(4, diff / 100);
                }
            }
        }

        return bonus;
    }

    /// <summary>
    /// Kloness wands: +1 magic dmg per 200 self-rep (cap 10) + +1 per 44 rep above target (cap 9).
    /// </summary>
    public static int KlonessMagicalBonus(GameWorldPlayer caster, GameWorldPlayer? targetPlayer) {
        ArgumentNullException.ThrowIfNull(caster);
        if (!caster.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            return 0;
        }
        if (weapon.ItemId is not (KlonessWandMs20Id or KlonessWandMs10Id)) {
            return 0;
        }
        var rep = Math.Max(0, caster.Reputation);
        var bonus = Math.Min(10, rep / 200);
        if (targetPlayer is not null) {
            var diff = rep - Math.Max(0, targetPlayer.Reputation);
            if (diff > 0) {
                bonus += Math.Min(9, diff / 44);
            }
        }
        return bonus;
    }

    /// <summary>True when Berserk Wand (MS10/MS20) is equipped — magical damage +25% (wiki).</summary>
    public static bool HasBerserkWandEquipped(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return player.InventoryManager.EquippedItems.TryGetValue("weapon", out var w) &&
               w is not null &&
               w.ItemId is BerserkWandMs20Id or BerserkWandMs10Id;
    }

    /// <summary>
    /// CAD after a confirmed hit and combo advance (Olympia m_iAddCD when combo count &gt; 1).
    /// </summary>
    public static int ApplyCadIfCombo(GameWorldPlayer attacker, int damage) {
        if (damage <= 0 || attacker.ComboAttackCount <= 1) {
            return damage;
        }
        var cad = ItemMagicAttribute.ComputeEquippedBonuses(attacker).ConsecutiveAttackDamage;
        if (cad <= 0) {
            return damage;
        }
        return damage + cad;
    }

    /// <summary>
    /// Apply Super Attack charge if available (call only after a confirmed hit).
    /// Olympia: +damage * Level/100 and skill-style bump; consumes 1 SuperAttackLeft.
    /// Bane (872): consumes 2 charges and doubles the SA-boosted damage (wiki: hits twice / crits twice as fast).
    /// </summary>
    public static int ApplySuperAttackIfAvailable(GameWorldPlayer attacker, int damage) {
        if (damage <= 0) {
            return damage;
        }
        var bane = HasBaneEquipped(attacker);
        // Bane needs 2 charges for a full double-crit; fall back to 1-charge SA if only one left.
        if (bane) {
            if (attacker.SuperAttackArmed && attacker.SuperAttackLeft >= 2) {
                if (!attacker.TryConsumeSuperAttackCharge() || !attacker.TryConsumeSuperAttackCharge()) {
                    return damage;
                }
                var saBonus = (int)(damage * (attacker.Level / 100.0) + 0.5);
                damage += Math.Max(1, saBonus);
                damage += damage / 10;
                damage *= 2; // double crit damage
                return Math.Max(1, damage);
            }
        }
        if (!attacker.TryConsumeSuperAttackCharge()) {
            return damage;
        }
        var sa = (int)(damage * (attacker.Level / 100.0) + 0.5);
        damage += Math.Max(1, sa);
        damage += damage / 10;
        return Math.Max(1, damage);
    }

    public static bool HasBaneEquipped(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return player.InventoryManager.EquippedItems.TryGetValue("weapon", out var w) &&
               w is not null &&
               w.ItemId == BaneId;
    }

    /// <summary>
    /// Sleep wake: first hit that lands on a sleeping target deals +100% and clears Sleep.
    /// Returns true when the target was sleeping (caller may grant multi-hit +1 guaranteed strike).
    /// </summary>
    public static int ApplySleepWakeBonus(GameWorldRef wr, GameWorldActionableEntity target, int damage, out bool wokeFromSleep) {
        wokeFromSleep = false;
        if (damage <= 0 || target is null) {
            return damage;
        }
        if (!target.HasTemporaryEffect(TemporaryEffectType.Sleep)) {
            return damage;
        }
        wokeFromSleep = true;
        target.RemoveTemporaryEffect(wr, TemporaryEffectType.Sleep, broadcastExpired: true);
        return Math.Max(1, damage * 2);
    }

    public static int EstimateMeleeDamage(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ItemAttackCatalog.EnsureLoaded();
        var strEff = Math.Max(1, EffectiveStr(player));
        if (!player.InventoryManager.EquippedItems.TryGetValue("weapon", out var weapon) || weapon is null) {
            var sides = Math.Max(2, strEff / 6);
            var avg = (1 + sides) / 2.0;
            return Math.Max(1, (int)Math.Round(avg + avg * (strEff / 5.0 / 100.0)));
        }
        var b = ItemMagicAttribute.ComputeEquippedBonuses(player);
        var magicAdd = b.WeaponMagicDamage + b.AddPhysicalDamage;
        if (ItemAttackCatalog.TryGet(weapon.ItemId, out var dice)) {
            var baseAvg = ItemAttackCatalog.AverageWeaponDamageSm(dice);
            var withStr = baseAvg + baseAvg * (strEff / 5.0 / 100.0);
            return Math.Max(1, (int)Math.Round(withStr) + MajesticUpgrade.GetUpgradeLevel(weapon.ItemAttribute) + magicAdd);
        }
        var fallback = 3 + MajesticUpgrade.GetUpgradeLevel(weapon.ItemAttribute);
        return Math.Max(1, (int)Math.Round(fallback + fallback * (strEff / 500.0)) + magicAdd);
    }

    /// <summary>
    /// Olympia <c>Effect_Damage_Spot</c> magic damage:
    /// <c>iDice(count, sides) + bonus</c>, then Mag% = base * (1 + Mag/3.3 / 100).
    /// Uses <see cref="SpellConfig"/> dice when present; otherwise a conservative mid-tier fallback.
    /// </summary>
    public static int RollMagicDamage(GameWorldPlayer caster, SpellConfig spell) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(spell);

        var count = spell.DamageDiceCount is int c && c > 0 ? c : 2;
        var sides = spell.DamageDiceSides is int s && s > 0 ? s : 6;
        var bonus = spell.DamageDiceBonus ?? 0;

        var damage = 0;
        for (var i = 0; i < count; i++) {
            damage += Random.Shared.Next(1, sides + 1);
        }
        damage += bonus;
        if (damage < 0) {
            damage = 0;
        }

        // Olympia: dTmp2 = Mag / 3.3; damage += damage * (dTmp2 / 100)
        var magEff = Math.Max(0, EffectiveMag(caster));
        var magPct = magEff / 3.3;
        var scaled = damage + damage * (magPct / 100.0);
        damage = (int)(scaled + 0.5);

        // Necklace / ring ADDEFFECT Magical Damage + weapon upgrade nibble.
        damage += ItemMagicAttribute.ComputeEquippedBonuses(caster).AddMagicalDamage;

        // Olympia mage Hero full set: +4 damage on attack paths (m_cHeroArmourBonus == 2).
        damage += HeroSetBonus.ExtraMagicDamage(caster);

        // Berserk Wand: Magical damage +25% (helbreath.net/wiki/Rare_Items).
        if (HasBerserkWandEquipped(caster)) {
            damage = (int)(damage * 1.25 + 0.5);
        }

        // Spell-specific scale (Mass Blizzard +5%, etc.).
        if (spell.DamageMultiplier is double mult && mult > 0 && Math.Abs(mult - 1.0) > 0.0001) {
            damage = (int)(damage * mult + 0.5);
        }

        // Kloness wand reputation scaling (self only here; PvP path re-applies with target).
        damage += KlonessMagicalBonus(caster, targetPlayer: null);

        return Math.Max(1, damage);
    }

    /// <summary>Spell damage vs a player (Kloness wand PvP rep-diff bonus).</summary>
    public static int RollMagicDamageVsPlayer(GameWorldPlayer caster, SpellConfig spell, GameWorldPlayer target) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(spell);
        ArgumentNullException.ThrowIfNull(target);
        var damage = RollMagicDamage(caster, spell);
        damage -= KlonessMagicalBonus(caster, targetPlayer: null);
        damage += KlonessMagicalBonus(caster, target);
        return Math.Max(1, damage);
    }

    /// <summary>Applies defender magic absorb after spell damage is rolled.</summary>
    public static int FinalizeSpellDamageOnPlayer(GameWorldPlayer defender, int damage) =>
        ApplyMagicMitigation(defender, damage);

    public static int RollHpRegen(GameWorldPlayer player) {
        var vit = Math.Max(1, player.Vit);
        var roll = Random.Shared.Next(1, vit + 1);
        var min = vit / 2;
        if (roll < min) {
            roll = min;
        }
        var baseAmt = Math.Max(1, roll);
        // Olympia m_iAddHP: secondary HP Recovery value*7 as % boost to regen tick.
        var pct = ItemMagicAttribute.ComputeEquippedBonuses(player).HpRegenPercent;
        // Cash shoes/cape: HP Recovery% (stacks additively with fragment regen).
        CashShopBoosts.GetEquippedRegenBonus(player, out var cashHp, out _);
        pct += cashHp;
        if (pct > 0) {
            baseAmt += baseAmt * pct / 100;
        }
        // Cash HP tablet: +50% regen amount (and more frequent feel via larger ticks).
        if (CashShopBoosts.HasHpTablet(player)) {
            baseAmt += baseAmt / 2;
        }
        return Math.Max(1, baseAmt);
    }

    public static int RollMpRegen(GameWorldPlayer player) {
        var mag = Math.Max(1, EffectiveMag(player));
        var baseAmt = Math.Max(1, Random.Shared.Next(1, mag + 1));
        var pct = ItemMagicAttribute.ComputeEquippedBonuses(player).MpRegenPercent;
        CashShopBoosts.GetEquippedRegenBonus(player, out _, out var cashMp);
        pct += cashMp;
        if (pct > 0) {
            baseAmt += baseAmt * pct / 100;
        }
        return Math.Max(1, baseAmt);
    }

    public static int RollSpRegen(GameWorldPlayer player) {
        var sides = Math.Max(1, player.Vit / 3);
        var total = Random.Shared.Next(1, sides + 1);
        if (player.Level <= 20) {
            total += 15;
        } else if (player.Level <= 40) {
            total += 10;
        } else if (player.Level <= 60) {
            total += 5;
        }
        var pct = ItemMagicAttribute.ComputeEquippedBonuses(player).SpRegenPercent;
        if (pct > 0) {
            total += total * pct / 100;
        }
        return Math.Max(1, total);
    }

    /// <summary>
    /// Olympia max carry in raw weight units: (Str+Angelic + Level) × 5 × 100.
    /// Display stones = raw / 100 (see client Weight: N Stone).
    /// </summary>
    public static int MaxCarryWeightRaw(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ItemWeightCatalog.EnsureLoaded();
        var strEff = Math.Max(1, EffectiveStr(player));
        var level = Math.Max(1, player.Level);
        return (strEff + level) * 5 * 100;
    }

    /// <summary>Max carry in stones (UI).</summary>
    public static int MaxCarryWeightStones(GameWorldPlayer player) =>
        MaxCarryWeightRaw(player) / 100;

    /// <summary>
    /// Olympia Defense Ratio: Dex*2 base is applied in hit tables; here we return
    /// Item.cfg value1 sum + magic secondary DR (value*7) + skill PA contribution to avoid.
    /// </summary>
    public static int GetDefenseRatio(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var b = ItemMagicAttribute.ComputeEquippedBonuses(player);
        // Olympia baseline DR includes Dex*2; we keep a lighter Dex term for hit/avoid feel.
        return Math.Max(0, b.DefenseRatio + EffectiveDex(player) * 2 + player.GetSkillLevel(Skills.PhysicalAbsorption) / 8);
    }

    /// <summary>Expected physical absorption % (weighted hit locations + shield + magic PA), capped 80.</summary>
    public static int GetPhysicalAbsorptionPercent(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return ItemMagicAttribute.ComputeEquippedBonuses(player).PhysicalAbsorptionPercent;
    }

    /// <summary>Magic absorption % from secondary MA, capped 80 (Olympia m_iAddAbsMD).</summary>
    public static int GetMagicAbsorptionPercent(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return ItemMagicAttribute.ComputeEquippedBonuses(player).MagicAbsorptionPercent;
    }

    /// <summary>Legacy name used by combat — maps to physical absorption %.</summary>
    public static int GetPhysicalDefense(GameWorldPlayer player) => GetPhysicalAbsorptionPercent(player);

    /// <summary>
    /// Applies Olympia physical absorption % (base Item.cfg v2 + magic PA secondary, hit-location weighted).
    /// Cap 80%. Formula: damage - damage * abs% / 100, min 1 if damage was positive.
    /// </summary>
    public static int ApplyPhysicalMitigation(GameWorldPlayer defender, int damage) {
        if (damage <= 0) {
            return 0;
        }
        var absPercent = Math.Min(80, GetPhysicalAbsorptionPercent(defender));
        if (absPercent <= 0) {
            return damage;
        }
        var absorbed = damage * absPercent / 100;
        return Math.Max(1, damage - absorbed);
    }

    /// <summary>Applies magic absorption % to spell damage (Olympia m_iAddAbsMD).</summary>
    public static int ApplyMagicMitigation(GameWorldPlayer defender, int damage) {
        if (damage <= 0) {
            return 0;
        }
        var absPercent = Math.Min(80, GetMagicAbsorptionPercent(defender));
        if (absPercent <= 0) {
            return damage;
        }
        var absorbed = damage * absPercent / 100;
        return Math.Max(1, damage - absorbed);
    }

    /// <summary>
    /// Olympia m_iAddTransMana + Charge Critical: after taking damage, restore MP and/or gain SA charge.
    /// Returns true when MP or SuperAttackLeft changed (caller should sync ProgressionUpdated).
    /// </summary>
    public static bool ApplyOnDamageTakenGearEffects(GameWorldPlayer defender, int damage) {
        if (damage <= 0 || defender.IsDead) {
            return false;
        }
        var b = ItemMagicAttribute.ComputeEquippedBonuses(defender);
        var changed = false;
        if (b.ManaConvert > 0) {
            var restore = (int)(damage * (b.ManaConvert / 100.0) + 1.0);
            if (restore > 0) {
                var before = defender.Mp;
                defender.ApplyMpRestore(restore);
                if (defender.Mp != before) {
                    changed = true;
                }
            }
        }
        if (defender.TryGainChargeCritical(b.ChargeCritical)) {
            changed = true;
        }
        return changed;
    }

    /// <summary>Legacy name — mana convert only (prefer <see cref="ApplyOnDamageTakenGearEffects"/>).</summary>
    public static void ApplyManaConvertOnDamageTaken(GameWorldPlayer defender, int damage) =>
        ApplyOnDamageTakenGearEffects(defender, damage);

    /// <summary>Secondary Exp fragment total (value*10) from equipped gear — percent bonus to kill exp.</summary>
    public static int GetGearExpBonusPercent(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return ItemMagicAttribute.ComputeEquippedBonuses(player).ExpBonusPercent;
    }

    /// <summary>Secondary Gold fragment total (value*10) from equipped gear — percent bonus to gold drops.</summary>
    public static int GetGearGoldBonusPercent(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        return ItemMagicAttribute.ComputeEquippedBonuses(player).GoldBonusPercent;
    }

    /// <summary>
    /// Classic Helbreath / Olympia MP cost from <c>Magic.cfg</c> ManaCost column,
    /// then Mana Save % (necklace/MS wands, cap 80): cost = max(1, base × (100−save)/100).
    /// </summary>
    public static int ComputeSpellManaCost(GameWorldPlayer caster, int serverSpellId) {
        ArgumentNullException.ThrowIfNull(caster);
        Server.Utils.MagicManaCatalog.EnsureLoaded();

        // Spells.json id → Olympia Magic.cfg id → mana cost.
        var olympiaId = MagicCastSuccess.OlympiaIdForServerSpell(serverSpellId);
        var baseCost = Server.Utils.MagicManaCatalog.TryGetManaCost(olympiaId)
            ?? Math.Max(1, MagicCastSuccess.CircleForServerSpellId(serverSpellId) * 10);

        var save = ItemMagicAttribute.ComputeEquippedBonuses(caster).ManaSavePercent;
        if (save <= 0) {
            return Math.Max(1, baseCost);
        }
        save = Math.Min(80, save);
        var cost = (int)(baseCost * (100 - save) / 100.0 + 0.5);
        return Math.Max(1, cost);
    }

    /// <summary>
    /// Current bag + equipped weight in raw units.
    /// Gold always 1; each piece with Light primary subtracts value×4 stones from that piece (min 1).
    /// </summary>
    public static int CurrentCarryWeightRaw(GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        ItemWeightCatalog.EnsureLoaded();
        long total = 0;
        foreach (var item in player.InventoryManager.BagItems) {
            total += EffectiveItemWeightRaw(item, item.Quantity);
        }
        foreach (var item in player.InventoryManager.EquippedItems.Values) {
            total += EffectiveItemWeightRaw(item, 1);
        }
        if (total > int.MaxValue) {
            return int.MaxValue;
        }
        return (int)total;
    }

    /// <summary>
    /// Per-item weight after Light primary (type 6): −value×4 stones (×100 raw), floor 1.
    /// Bag + equip both benefit so "Light" gear actually feels light (Boris report).
    /// </summary>
    public static int EffectiveItemWeightRaw(InventoryItemState item, int quantity) {
        ArgumentNullException.ThrowIfNull(item);
        var raw = ItemWeightCatalog.GetStackWeight(item.ItemId, quantity);
        if (raw <= 0 || item.ItemId == ItemWeightCatalog.GoldItemId) {
            return raw;
        }
        ItemMagicAttribute.Decode(item.ItemAttribute, out var pType, out var pValue, out _, out _, out _);
        if (pType != ItemMagicAttribute.P_Light || pValue <= 0) {
            return raw;
        }
        // value×4 stones → raw units (*100). Stronger feel than a tiny total-bag discount.
        var reduce = pValue * 4 * 100;
        return Math.Max(1, raw - reduce);
    }

    /// <summary>Current carry in stones (ceil total raw / 100 for bag footer).</summary>
    public static int CurrentCarryWeightStones(GameWorldPlayer player) =>
        Math.Max(0, (CurrentCarryWeightRaw(player) + 99) / 100);

    /// <summary>
    /// True when adding <paramref name="itemId"/> × <paramref name="quantity"/> would not exceed max carry.
    /// Gold adds 0 effective mass (stack always weight 1 total already held or not).
    /// Endgame Item.cfg weights soft-capped per piece for the check only.
    /// </summary>
    public static bool CanCarryAdditional(GameWorldPlayer player, int itemId, int quantity) {
        ArgumentNullException.ThrowIfNull(player);
        // Gold never blocks pickup by weight.
        if (itemId == ItemWeightCatalog.GoldItemId) {
            return true;
        }
        var qty = Math.Max(1, quantity);
        var add = ItemWeightCatalog.GetStackWeight(itemId, qty);
        if (add <= 0) {
            return true;
        }

        // Soft-cap a single non-stack piece at 40 stones (4000 raw) for the overweight check only.
        const int maxSinglePieceRaw = 40 * 100;
        if (qty == 1 && add > maxSinglePieceRaw) {
            add = maxSinglePieceRaw;
        }

        return (long)CurrentCarryWeightRaw(player) + add <= MaxCarryWeightRaw(player);
    }
}
