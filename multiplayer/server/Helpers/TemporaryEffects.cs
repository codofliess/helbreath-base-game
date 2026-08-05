using System.Collections.Generic;
using Mmorpg.Network;
using Server;
using Server.Utils;
using Server.World;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>Temporary-effect spell resolution, apply rules, heal/poison/utility helpers, and shared break-invisibility helpers.</summary>
public static class TemporaryEffects {
    /// <summary>Server catalog id for Armor Break (Olympia type 28 pierces Protect-From-Magic).</summary>
    public const int ArmorBreakSpellId = 15;

    /// <summary>Olympia Create-Food catalog ids (Meat / Baguette).</summary>
    public const int MeatItemId = 99;
    public const int BaguetteItemId = 98;

    /// <summary>Olympia Magery-tier summon catalog ids (Slime → Cyclops), keyed by dice result 1..10.</summary>
    private static readonly int[] SummonCreatureCatalogByTier = [
        1,  // Slime
        2,  // Giant-Ant → Ant
        3,  // Amphis → Snake
        40, // Orc
        51, // Skeleton
        12, // Clay-Golem
        28, // Stone-Golem
        36, // Orc-Mage → Master Mage Orc
        32, // Hellbound → Hellhound
        14, // Cyclops
    ];

    /// <summary>Chain Lords gold goblin (Monsters.json). Sprite uses orc pack until a dedicated goblin.spr ships.</summary>
    public const int GoldGoblinCatalogId = 9901;

    /// <summary>Charisma (Chr) required to summon a gold goblin.</summary>
    public const int GoldGoblinMinCharisma = 20;

    /// <summary>Stacked gold (item 90) required in bag to summon a gold goblin.</summary>
    public const int GoldGoblinMinGoldTokens = 10_000;

    /// <summary>Gold goblin lifetime.</summary>
    public static readonly TimeSpan GoldGoblinDuration = TimeSpan.FromMinutes(5);

    /// <summary>Baseline hit/defense ratio used when the full Olympia hit-ratio system is not modeled.</summary>
    private const int DefenseShieldBaselineRatio = 100;

    /// <summary>Returns false when any temporary effect in the same group is already active (caller should not apply or refresh).</summary>
    public static bool CanApplyTemporaryEffectInGroup(
        IReadOnlyDictionary<TemporaryEffectType, ActiveTemporaryEffectSlot> activeEffects,
        int group) {
        foreach (var kv in activeEffects) {
            if (kv.Value.Group == group) {
                return false;
            }
        }
        return true;
    }

    /// <summary>True when the target has Absolute Magic Protect or Protect From Magic (blocks hostile magic unless Armor Break pierces PFM).</summary>
    public static bool IsMagicBlockedByProtect(GameWorldActionableEntity target, int? attackingSpellId = null) {
        ArgumentNullException.ThrowIfNull(target);
        if (target.HasTemporaryEffect(TemporaryEffectType.AbsoluteMagicProtect)) {
            return true;
        }
        if (target.HasTemporaryEffect(TemporaryEffectType.ProtectFromMagic)) {
            // Olympia Armor Break adds +10000 hit ratio to pierce PFM.
            return attackingSpellId != ArmorBreakSpellId;
        }
        return false;
    }

    /// <summary>
    /// Olympia Defense / Great Defense Shield physical hit check: +40 / +100 defense ratio.
    /// Without a full hit-ratio pipeline, baselines both sides at <see cref="DefenseShieldBaselineRatio"/> so
    /// unshielded combat stays always-hit and shields reduce hit chance via <c>(hit/def)*50</c>.
    /// </summary>
    public static bool RollPhysicalHitVsDefenseShield(GameWorldActionableEntity target) {
        ArgumentNullException.ThrowIfNull(target);
        var bonus = 0;
        if (target.HasTemporaryEffect(TemporaryEffectType.GreatDefenseShield)) {
            bonus = 100;
        } else if (target.HasTemporaryEffect(TemporaryEffectType.DefenseShield)) {
            bonus = 40;
        }

        if (bonus <= 0) {
            return true;
        }

        var defense = DefenseShieldBaselineRatio + bonus;
        var destHitRatio = (int)((DefenseShieldBaselineRatio / (double)defense) * 50.0);
        if (destHitRatio < 1) {
            destHitRatio = 1;
        }

        return Random.Shared.Next(1, 101) <= destHitRatio;
    }

    /// <summary>Olympia <c>ArmorLifeDecrement</c> for Armor Break (and similar): shreds equipped durable armor on a player target.</summary>
    public static void ApplyArmorLifeDecrement(GameWorldRef wr, GameWorldPlayer target, int amount) {
        ArgumentNullException.ThrowIfNull(target);
        if (amount <= 0 || target.IsDead) {
            return;
        }

        if (!target.InventoryManager.TryApplyArmorLifeDecrement(amount, out var mutation, out var wornItems) ||
            wornItems.Count == 0) {
            return;
        }

        foreach (var worn in wornItems) {
            NetworkManager.SendToPlayer(
                target,
                NetworkManager.CreateItemLifeSpanUpdated(worn.ItemUid, worn.CurLifeSpan, worn.MaxLifeSpan));
        }

        if (mutation.Unequipped.Count > 0 || mutation.AddedToBag.Count > 0) {
            Inventory.ApplyInventoryMutation(wr, target, mutation);
        }
    }

    /// <summary>Applies on-hit temporary effects from <paramref name="spell"/> to <paramref name="target"/> after damage resolves.</summary>
    public static void ApplySpellTemporaryEffectsOnHit(GameWorldRef wr, SpellConfig spell, GameWorldActionableEntity target) {
        ApplySpellTemporaryEffectsOnHit(wr, spell, target, casterPlayer: null);
    }

    /// <summary>
    /// On-hit status effects. When <paramref name="casterPlayer"/> has Safe Attack on, skips self and same-city players.
    /// </summary>
    public static void ApplySpellTemporaryEffectsOnHit(
        GameWorldRef wr,
        SpellConfig spell,
        GameWorldActionableEntity target,
        GameWorldPlayer? casterPlayer) {
        ArgumentNullException.ThrowIfNull(spell);
        ArgumentNullException.ThrowIfNull(target);
        if (spell.TemporaryEffects is not { Length: > 0 } rows) {
            return;
        }
        if (IsMagicBlockedByProtect(target, spell.Id)) {
            return;
        }
        if (casterPlayer is not null &&
            target is GameWorldPlayer targetPlayer &&
            Combat.IsSafeAttackBlockedTarget(casterPlayer, targetPlayer)) {
            return;
        }

        foreach (var row in rows) {
            var moveMod = row.MovementSpeedModifier ?? 0;
            var attackMod = row.AttackSpeedModifier ?? 0;
            var castMod = row.CastSpeedModifier ?? 0;
            if (target is GameWorldMonster) {
                castMod = 0;
            }

            var poisonLevel = row.Type == (int)TemporaryEffectType.Poison ? (spell.PoisonLevel ?? 0) : 0;
            // Olympia poison status applies to players only — except Timed Challenge runners (Route B).
            if (row.Type == (int)TemporaryEffectType.Poison) {
                if (target is GameWorldPlayer) {
                    // ok
                } else if (target is GameWorldMonster poisonMonster && TimedChallenge.AllowsPoisonOnMonster(poisonMonster)) {
                    // ok
                } else {
                    continue;
                }
            }

            // Olympia: MagicLevel >= 6 monsters are immune to HOLDOBJECT (Paralyze / Hold Person).
            if (row.Type == (int)TemporaryEffectType.Paralyze &&
                target is GameWorldMonster holdTarget &&
                Math.Abs(holdTarget.MagicLevel) >= 6) {
                continue;
            }

            // Berserk only buffs players, summons, and friendly guards — never wild hostiles/neutrals.
            if (row.Type == (int)TemporaryEffectType.Berserk && !CanReceiveBerserk(target)) {
                continue;
            }

            target.ApplyTemporaryEffect(
                wr,
                (TemporaryEffectType)row.Type,
                row.Group,
                row.Duration,
                moveMod,
                attackMod,
                castMod,
                poisonLevel);
        }
    }

    /// <summary>Resolves non-damage spell casts at a cell (buffs, heal, cure, cancel, food, summon).</summary>
    public static void ResolveUtilityOrBuffSpellAtCell(
        GameWorldRef wr,
        GameWorldPlayer caster,
        SpellConfig spell,
        int targetX,
        int targetY) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(spell);

        if (spell.CreateFood == true) {
            ResolveCreateFood(wr, targetX, targetY);
            return;
        }

        if (spell.SummonCreature == true) {
            ResolveSummonCreature(wr, caster, targetX, targetY);
            return;
        }

        if (spell.HealDiceCount is int diceCount && spell.HealDiceSides is int diceSides) {
            ResolveHealAtCell(wr, targetX, targetY, diceCount, diceSides, spell.HealBonus ?? 0);
            return;
        }

        if (spell.CurePoison == true) {
            ResolveCurePoisonAtCell(wr, targetX, targetY);
            return;
        }

        if (spell.ClearTemporaryEffects == true) {
            ResolveCancellationAtCell(wr, targetX, targetY);
            return;
        }

        ResolveBuffSpellAtCell(wr, caster, spell, targetX, targetY);
    }

    /// <summary>Resolves buff-only spell casts (occupant at cell or AoE radius, apply effects).</summary>
    public static void ResolveBuffSpellAtCell(
        GameWorldRef wr,
        GameWorldPlayer caster,
        SpellConfig spell,
        int targetX,
        int targetY) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(spell);
        if (spell.TemporaryEffects is not { Length: > 0 } rows) {
            return;
        }

        var aoe = Math.Max(0, spell.AoeRadius ?? 0);
        var hostile = IsHostileDebuffSpell(spell);
        var isHaste = IsHasteSpell(spell);
        // Single-cell buffs: body click (chest/head) still applies — same as heal.
        if (aoe == 0) {
            var bodyTarget = FindPlayerAtCellOrBody(wr, targetX, targetY);
            if (bodyTarget is not null) {
                // Haste: same-city allies only — never self, never travelers/enemies.
                if (isHaste && !Combat.IsSameCityAlly(caster, bodyTarget)) {
                    if (bodyTarget.PlayerId == caster.PlayerId) {
                        NetworkManager.SendToPlayer(caster, NetworkManager.CreateSendMessage(
                            "Haste can only be cast on same-city allies, not yourself."));
                    } else {
                        NetworkManager.SendToPlayer(caster, NetworkManager.CreateSendMessage(
                            "Haste only works on allies of the same city."));
                    }
                // Safe Attack: Paralyze/Hold/etc. must not hit self or same-city (Boris report).
                } else if (hostile && Combat.IsSafeAttackBlockedTarget(caster, bodyTarget)) {
                    // skip player
                } else if (!(hostile && IsMagicBlockedByProtect(bodyTarget, spell.Id)) &&
                    !(spell.TemporaryEffects![0].Type == (int)TemporaryEffectType.Inhibition &&
                      bodyTarget.HasTemporaryEffect(TemporaryEffectType.AbsoluteMagicProtect))) {
                    ApplyBuffRowsToEntity(wr, caster, spell, rows, bodyTarget);
                }
            }
            // Haste is player-only (same-city allies); never apply to monsters.
            if (!isHaste) {
                // Monsters: exact feet cell OR body column (chest/head click 1–3 tiles north of feet).
                // Without this, Paralyze/Poison VFX lands north of Ogre and the status never applies.
                var bodyMonster = FindMonsterAtCellOrBody(wr, targetX, targetY);
                if (bodyMonster is not null) {
                    if (!(IsHostileDebuffSpell(spell) && IsMagicBlockedByProtect(bodyMonster, spell.Id))) {
                        ApplyBuffRowsToEntity(wr, caster, spell, rows, bodyMonster);
                    }
                }
            }
            return;
        }

        var minX = targetX - aoe;
        var maxX = targetX + aoe;
        var minY = targetY - aoe;
        var maxY = targetY + aoe;

        foreach (var p in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (p.IsDead) {
                continue;
            }
            if (Math.Max(Math.Abs(p.PosX - targetX), Math.Abs(p.PosY - targetY)) > aoe) {
                continue;
            }
            if (isHaste && !Combat.IsSameCityAlly(caster, p)) {
                continue;
            }
            if (hostile && Combat.IsSafeAttackBlockedTarget(caster, p)) {
                continue;
            }
            if (hostile && IsMagicBlockedByProtect(p, spell.Id)) {
                continue;
            }
            // Inhibition / confuse: Absolute Magic Protect blocks (Olympia PROTECT==5).
            if (spell.TemporaryEffects![0].Type == (int)TemporaryEffectType.Inhibition &&
                p.HasTemporaryEffect(TemporaryEffectType.AbsoluteMagicProtect)) {
                continue;
            }

            ApplyBuffRowsToEntity(wr, caster, spell, rows, p);
        }

        // Haste never applies to monsters (even in AoE).
        if (isHaste) {
            return;
        }

        foreach (var m in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (m.Dead) {
                continue;
            }
            if (Math.Max(Math.Abs(m.PosX - targetX), Math.Abs(m.PosY - targetY)) > aoe) {
                continue;
            }
            if (IsHostileDebuffSpell(spell) && IsMagicBlockedByProtect(m, spell.Id)) {
                continue;
            }

            ApplyBuffRowsToEntity(wr, caster, spell, rows, m);
        }
    }

    /// <summary>Olympia poison tick: <c>iDice(1, poisonLevel)</c>, floors HP at 1, fans out HP update.</summary>
    public static void ApplyPoisonTickDamage(GameWorldRef wr, GameWorldActionableEntity entity, int poisonLevel) {
        ArgumentNullException.ThrowIfNull(entity);
        if (poisonLevel <= 0 || entity is not GameWorldPlayer player || player.IsDead) {
            return;
        }

        var damage = Random.Shared.Next(1, poisonLevel + 1);
        player.ApplyPoisonDamage(damage);
        NetworkManager.SendToPlayer(player, NetworkManager.CreateHpUpdated(player.Hp, player.MaxHp));
        Party.NotifyVitalsChanged(player);
    }

    /// <summary>Removes invisibility from the entity when they begin or complete a spell cast, attack, etc.</summary>
    public static void BreakInvisibilityIfPresent(GameWorldRef wr, GameWorldActionableEntity entity) {
        ArgumentNullException.ThrowIfNull(entity);
        if (entity.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
            entity.RemoveTemporaryEffect(wr, TemporaryEffectType.Invisibility, broadcastExpired: true);
        }
    }

    private static bool IsHostileDebuffSpell(SpellConfig spell) {
        if (spell.TemporaryEffects is not { Length: > 0 } rows) {
            return false;
        }
        var t = rows[0].Type;
        return t is (int)TemporaryEffectType.Poison
            or (int)TemporaryEffectType.ConfuseLanguage
            or (int)TemporaryEffectType.Confusion
            or (int)TemporaryEffectType.Illusion
            or (int)TemporaryEffectType.IllusionMovement
            or (int)TemporaryEffectType.Inhibition
            or (int)TemporaryEffectType.Paralyze
            or (int)TemporaryEffectType.Chill
            or (int)TemporaryEffectType.Sleep;
    }

    /// <summary>
    /// Berserk may buff players (self/allies) and friendly units only:
    /// player summons (<see cref="GameWorldMonster.SummonOwnerPlayerId"/>) and town guards
    /// (<see cref="MonsterAllegiance.Friendly"/>). Hostile/neutral mobs and other enemies never receive it.
    /// </summary>
    private static bool CanReceiveBerserk(GameWorldActionableEntity entity) {
        if (entity is GameWorldPlayer) {
            return true;
        }

        if (entity is GameWorldMonster monster) {
            if (monster.SummonOwnerPlayerId is not null) {
                return true;
            }

            return monster.Allegiance == MonsterAllegiance.Friendly;
        }

        return false;
    }

    /// <summary>True when the spell's primary timed effect is Haste (run-speed buff).</summary>
    private static bool IsHasteSpell(SpellConfig spell) {
        return spell.TemporaryEffects is { Length: > 0 } rows
            && rows[0].Type == (int)TemporaryEffectType.Haste;
    }

    /// <summary>
    /// Haste is ally-only: same city (aresden/elvine), never self, never monsters/travelers/enemies.
    /// </summary>
    private static bool CanReceiveHaste(GameWorldPlayer caster, GameWorldActionableEntity entity) {
        return entity is GameWorldPlayer target && Combat.IsSameCityAlly(caster, target);
    }

    private static void ApplyBuffRowsToEntity(
        GameWorldRef wr,
        GameWorldPlayer? caster,
        SpellConfig spell,
        SpellTimedEffectSpec[] rows,
        GameWorldActionableEntity entity) {
        foreach (var row in rows) {
            // Berserk: summons + friendly guards only among monsters (not wild hostiles / neutrals).
            if (row.Type == (int)TemporaryEffectType.Berserk && !CanReceiveBerserk(entity)) {
                continue;
            }

            // Haste: same-city allies only — never self, never mobs.
            if (row.Type == (int)TemporaryEffectType.Haste &&
                (caster is null || !CanReceiveHaste(caster, entity))) {
                continue;
            }

            var poisonLevel = row.Type == (int)TemporaryEffectType.Poison ? (spell.PoisonLevel ?? 0) : 0;
            if (row.Type == (int)TemporaryEffectType.Poison) {
                if (entity is GameWorldPlayer) {
                    // ok
                } else if (entity is GameWorldMonster poisonMonster && TimedChallenge.AllowsPoisonOnMonster(poisonMonster)) {
                    // ok
                } else {
                    continue;
                }
            }

            var castMod = entity is GameWorldMonster ? 0 : (row.CastSpeedModifier ?? 0);
            entity.ApplyTemporaryEffect(
                wr,
                (TemporaryEffectType)row.Type,
                row.Group,
                row.Duration,
                row.MovementSpeedModifier ?? 0,
                row.AttackSpeedModifier ?? 0,
                castMod,
                poisonLevel);
        }
    }

    private static void ResolveHealAtCell(GameWorldRef wr, int targetX, int targetY, int diceCount, int diceSides, int bonus) {
        var amount = RollDice(diceCount, diceSides) + bonus;
        var p = FindPlayerAtCellOrBody(wr, targetX, targetY);
        if (p is null) {
            return;
        }

        p.ApplyHeal(amount);
        NetworkManager.SendToPlayer(p, NetworkManager.CreateHpUpdated(p.Hp, p.MaxHp));
        Party.NotifyVitalsChanged(p);
    }

    private static void ResolveCurePoisonAtCell(GameWorldRef wr, int targetX, int targetY) {
        var p = FindPlayerAtCellOrBody(wr, targetX, targetY);
        if (p is null) {
            return;
        }

        if (p.HasTemporaryEffect(TemporaryEffectType.Poison)) {
            p.RemoveTemporaryEffect(wr, TemporaryEffectType.Poison, broadcastExpired: true);
        }
    }

    /// <summary>
    /// Cancellation: strip all temporary effects from the target at the cell.
    /// Works on self, same-city allies, enemies, and monsters (any living entity under the click).
    /// Does not require hostile/friendly checks — Olympia Cancellation is universal dispel.
    /// </summary>
    private static void ResolveCancellationAtCell(GameWorldRef wr, int targetX, int targetY) {
        var p = FindPlayerAtCellOrBody(wr, targetX, targetY);
        if (p is not null) {
            p.ClearAllTemporaryEffects(wr);
            return;
        }

        var m = FindMonsterAtCellOrBody(wr, targetX, targetY);
        m?.ClearAllTemporaryEffects(wr);
    }

    /// <summary>
    /// True when a living player or monster occupies the cast cell (feet or body column).
    /// Used to suppress ground cast VFX for entity-targeted buffs/cancels on empty air.
    /// </summary>
    public static bool HasEntityAtCellOrBody(GameWorldRef wr, int targetX, int targetY) {
        return FindPlayerAtCellOrBody(wr, targetX, targetY) is not null
            || FindMonsterAtCellOrBody(wr, targetX, targetY) is not null;
    }

    /// <summary>
    /// Cancellation / self-utility: if the click lands on the caster's body column (or slightly
    /// loose self pad), snap to caster feet so self-dispel VFX and resolve land on the player.
    /// Prefer any other living player already under the click (friend/enemy dispel).
    /// </summary>
    public static void TrySnapCancellationOrSelfTarget(
        GameWorldRef wr,
        GameWorldPlayer caster,
        ref int targetX,
        ref int targetY) {
        ArgumentNullException.ThrowIfNull(caster);
        var other = FindPlayerAtCellOrBody(wr, targetX, targetY);
        if (other is not null) {
            targetX = other.PosX;
            targetY = other.PosY;
            return;
        }

        var mon = FindMonsterAtCellOrBody(wr, targetX, targetY);
        if (mon is not null) {
            targetX = mon.PosX;
            targetY = mon.PosY;
            return;
        }

        // Loose self pad: feet + up to 3 north, ±1 sideways, or adjacent cell under feet (misclick).
        if (IsLooseSelfCancelHit(caster.PosX, caster.PosY, targetX, targetY)) {
            targetX = caster.PosX;
            targetY = caster.PosY;
        }
    }

    /// <summary>Self-cancel hit volume: standard body column plus 1-cell Chebyshev around feet.</summary>
    internal static bool IsLooseSelfCancelHit(int feetX, int feetY, int clickX, int clickY) {
        if (IsBodyHitCell(feetX, feetY, clickX, clickY)) {
            return true;
        }
        var dx = Math.Abs(clickX - feetX);
        var dyUp = feetY - clickY;
        // Slightly taller body (3 tiles north) for self cancel.
        if (dx <= 1 && dyUp >= 1 && dyUp <= 3) {
            return true;
        }
        // Adjacent foot misclick (1 cell away).
        return Math.Max(dx, Math.Abs(clickY - feetY)) <= 1;
    }

    /// <summary>
    /// Olympia body target: click on chest/head maps to a cell north of feet.
    /// Prefer exact feet cell, else any living player whose body column covers the click cell.
    /// Body volume: feet cell + up to 2 tiles north, ±1 east/west (shoulders).
    /// </summary>
    private static GameWorldPlayer? FindPlayerAtCellOrBody(GameWorldRef wr, int targetX, int targetY) {
        foreach (var p in wr.PlayerSpatialGrid.GetPlayersInRectangle(targetX, targetY, targetX, targetY, excludeDisconnected: false)) {
            if (!p.IsDead && p.PosX == targetX && p.PosY == targetY) {
                return p;
            }
        }

        // Feet may be south of a head/chest click — search a small neighborhood.
        var minX = targetX - 1;
        var maxX = targetX + 1;
        var minY = targetY;
        var maxY = targetY + 2;
        GameWorldPlayer? best = null;
        var bestDist = int.MaxValue;
        foreach (var p in wr.PlayerSpatialGrid.GetPlayersInRectangle(minX, minY, maxX, maxY, excludeDisconnected: false)) {
            if (p.IsDead || !IsBodyHitCell(p.PosX, p.PosY, targetX, targetY)) {
                continue;
            }
            // Prefer the player whose feet are closest (Chebyshev) to the click.
            var d = Math.Max(Math.Abs(p.PosX - targetX), Math.Abs(p.PosY - targetY));
            if (d < bestDist) {
                bestDist = d;
                best = p;
            }
        }
        return best;
    }

    /// <summary>
    /// Same body-column logic for monsters (Paralyze on Ogre chest, etc.).
    /// Tall mobs use up to 3 tiles north of feet.
    /// </summary>
    private static GameWorldMonster? FindMonsterAtCellOrBody(GameWorldRef wr, int targetX, int targetY) {
        foreach (var m in wr.MonsterSpatialGrid.GetMonstersInRectangle(targetX, targetY, targetX, targetY)) {
            if (!m.Dead && m.PosX == targetX && m.PosY == targetY) {
                return m;
            }
        }

        var minX = targetX - 1;
        var maxX = targetX + 1;
        var minY = targetY;
        var maxY = targetY + 3;
        GameWorldMonster? best = null;
        var bestDist = int.MaxValue;
        foreach (var m in wr.MonsterSpatialGrid.GetMonstersInRectangle(minX, minY, maxX, maxY)) {
            if (m.Dead || !IsMonsterBodyHitCell(m.PosX, m.PosY, targetX, targetY)) {
                continue;
            }
            var d = Math.Max(Math.Abs(m.PosX - targetX), Math.Abs(m.PosY - targetY));
            if (d < bestDist) {
                bestDist = d;
                best = m;
            }
        }
        return best;
    }

    /// <summary>
    /// Snap cast cell to player/monster feet when the click landed on their body column.
    /// Call before fanning cast VFX so Paralyze/Poison FX appears on the entity, not 2 tiles north.
    /// </summary>
    public static void TrySnapBuffTargetToEntityBody(GameWorldRef wr, ref int targetX, ref int targetY) {
        var p = FindPlayerAtCellOrBody(wr, targetX, targetY);
        if (p is not null) {
            targetX = p.PosX;
            targetY = p.PosY;
            return;
        }
        var m = FindMonsterAtCellOrBody(wr, targetX, targetY);
        if (m is not null) {
            targetX = m.PosX;
            targetY = m.PosY;
        }
    }

    /// <summary>True when <paramref name="clickX"/>/<paramref name="clickY"/> lands on the standing body of a player at feet (<paramref name="feetX"/>,<paramref name="feetY"/>).</summary>
    internal static bool IsBodyHitCell(int feetX, int feetY, int clickX, int clickY) {
        var dx = Math.Abs(clickX - feetX);
        var dyUp = feetY - clickY; // positive when click is north of feet (chest/head)
        if (dx > 1) {
            return false;
        }
        // Feet tile: exact only. Torso/head: 1–2 cells north, ±1 sideways.
        if (dyUp == 0) {
            return dx == 0;
        }
        return dyUp >= 1 && dyUp <= 2;
    }

    /// <summary>Monster body column: feet + up to 3 tiles north (tall Ogres), ±1 sideways.</summary>
    internal static bool IsMonsterBodyHitCell(int feetX, int feetY, int clickX, int clickY) {
        var dx = Math.Abs(clickX - feetX);
        var dyUp = feetY - clickY;
        if (dx > 1) {
            return false;
        }
        if (dyUp == 0) {
            return dx == 0;
        }
        return dyUp >= 1 && dyUp <= 3;
    }

    private static void ResolveCreateFood(GameWorldRef wr, int targetX, int targetY) {
        if (targetX < 0 || targetY < 0 ||
            targetX >= wr.OccupancyTracker.SizeX ||
            targetY >= wr.OccupancyTracker.SizeY) {
            return;
        }

        var itemId = Random.Shared.Next(1, 3) == 1 ? MeatItemId : BaguetteItemId;
        var droppedItem = new InventoryItemState(
            itemId,
            ItemUidGenerator.Allocate(),
            bagX: null,
            bagY: null,
            quantity: 1,
            bagZIndex: 0,
            effectOverrides: null,
            itemAttribute: 0,
            itemColor: 0);

        if (!wr.GroundStateTracker.TryAddDroppedItem(droppedItem, targetX, targetY, out var previousTopItem, out var addedItem) ||
            addedItem is null) {
            return;
        }

        GroundStateVisibility.BroadcastGroundItemTopStateChanged(wr, previousTopItem, addedItem);
    }

    /// <summary>Max live summons per caster (combat pets + gold goblin collector).</summary>
    public const int MaxAliveSummonsPerPlayer = 5;

    /// <summary>Counts non-dead monsters owned by this player via <see cref="GameWorldMonster.SummonOwnerPlayerId"/>.</summary>
    public static int CountAliveSummons(GameWorldRef wr, long ownerPlayerId) {
        var count = 0;
        foreach (var monster in wr.MonstersByMonsterId.Values) {
            if (monster.Dead) {
                continue;
            }
            if (monster.SummonOwnerPlayerId == ownerPlayerId) {
                count++;
            }
        }
        return count;
    }

    private static void ResolveSummonCreature(GameWorldRef wr, GameWorldPlayer caster, int targetX, int targetY) {
        // Olympia Magery skill is not modeled; caster Level stands in for Magery mastery (0–100 scale via clamp).
        // Chain Lords: with Luck(Chr)≥20 and ≥10k gold in bag → gold goblin (5 min, picks gold, immune to mobs).
        _ = targetX;
        _ = targetY;

        var alive = CountAliveSummons(wr, caster.PlayerId);
        if (alive >= MaxAliveSummonsPerPlayer) {
            NetworkManager.SendToPlayer(caster, NetworkManager.CreateSendMessage(
                $"Summon Creature: already have {alive}/{MaxAliveSummonsPerPlayer} summons alive (includes gold goblin)."));
            return;
        }

        var bagGold = caster.InventoryManager.CountGold();
        var canGoblin = caster.Chr >= GoldGoblinMinCharisma && bagGold >= GoldGoblinMinGoldTokens;
        var catalogId = canGoblin
            ? GoldGoblinCatalogId
            : RollSummonCreatureCatalogId(caster.Level);

        if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                caster,
                catalogId,
                searchRadius: 4,
                out var summonedMonsterId,
                MonsterAllegiance.Friendly)) {
            // Goblin catalog missing on older configs → fall back to tier roll once.
            if (canGoblin && catalogId == GoldGoblinCatalogId) {
                catalogId = RollSummonCreatureCatalogId(caster.Level);
                if (!wr.World.TrySpawnCatalogMonsterNearPlayer(
                        caster,
                        catalogId,
                        searchRadius: 4,
                        out summonedMonsterId,
                        MonsterAllegiance.Friendly)) {
                    Console.WriteLine($"[TemporaryEffects] Summon Creature failed for player {caster.PlayerId} (catalog {catalogId}).");
                    NetworkManager.SendToPlayer(caster, NetworkManager.CreateSendMessage(
                        "Summon Creature failed — no free cell nearby."));
                    return;
                }
            } else {
                Console.WriteLine($"[TemporaryEffects] Summon Creature failed for player {caster.PlayerId} (catalog {catalogId}).");
                return;
            }
        }

        if (wr.World.TryGetMonsterByMonsterId(summonedMonsterId, out var summoned) && !summoned.Dead) {
            summoned.SummonOwnerPlayerId = caster.PlayerId;
            if (canGoblin && catalogId == GoldGoblinCatalogId) {
                summoned.SummonCollectorOnly = true;
                summoned.ImmuneToMonsterDamage = true;
                summoned.SummonExpiresAtUtc = DateTimeOffset.UtcNow.Add(GoldGoblinDuration);
                // Speed/damage come from Monsters.json (700ms step, 0 dmg — pure collector).
                NetworkManager.SendToPlayer(caster, NetworkManager.CreateSendMessage(
                    "A gold goblin answers your call! It only collects gold & ground items for 5 minutes (Charisma 20+, immune to monsters)."));
            }
        }
    }

    private static int RollSummonCreatureCatalogId(int casterLevel) {
        var mageryProxy = Math.Clamp(casterLevel, 1, 100);
        var rollMax = Math.Max(1, mageryProxy / 10);
        var tier = Random.Shared.Next(1, rollMax + 1);
        var tierFloor = Math.Max(1, mageryProxy / 20);
        if (tier < tierFloor) {
            tier = tierFloor;
        }

        if (tier > SummonCreatureCatalogByTier.Length) {
            tier = SummonCreatureCatalogByTier.Length;
        }

        return SummonCreatureCatalogByTier[tier - 1];
    }

    private static int RollDice(int count, int sides) {
        var total = 0;
        for (var i = 0; i < count; i++) {
            total += Random.Shared.Next(1, sides + 1);
        }
        return total;
    }
}
