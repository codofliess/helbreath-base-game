using Mmorpg.Network;
using Server;
using Server.World;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Authoritative combat resolution for a single map: player and monster hit validation (including lag-compensated delays),
/// damage and crowd-control application to monsters and players, and related visibility fan-out.
/// </summary>
public static class Combat {
    private readonly record struct MonsterAttackResolution(
        int HpAfter,
        AttackType PacketAttackType,
        int StunlockMs,
        int? KnockbackDurationMs,
        int? KnockbackFromX,
        int? KnockbackFromY,
        int? KnockbackDestX,
        int? KnockbackDestY);

    /// <summary>Applies lethal damage to every living monster on this map (debug/admin summon dialog) and fans out <see cref="MonsterTakeDamage"/> / <see cref="MonsterDied"/> like normal combat.</summary>
    public static void HandleKillAllMonstersRequested(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        if (AdminSecurity.RejectIfNotGm(player, "KillAllMonsters")) {
            return;
        }

        if (player.IsDead) {
            return;
        }
        if (player.IsPickupOrBowStanceLockoutActive(DateTimeOffset.UtcNow)) {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var snapshot = new List<GameWorldMonster>(wr.MonstersByMonsterId.Count);
        foreach (var monster in wr.MonstersByMonsterId.Values) {
            snapshot.Add(monster);
        }

        foreach (var monster in snapshot) {
            if (monster.Dead) {
                continue;
            }

            var damage = monster.Hp;
            if (!monster.TryApplyAttackerHit(wr, damage, now, out var hpAfter)) {
                continue;
            }

            MonsterVisibility.BroadcastMonsterTakeDamage(
                wr,
                monster,
                damage,
                AttackType.NoInterrupt,
                hpAfter);
            if (hpAfter == 0) {
                MonsterVisibility.BroadcastMonsterDied(wr, monster);
            }
        }
    }

    /// <summary>Schedules authoritative player-versus-monster hit validation after lag compensation and fans out attack animation sync immediately.</summary>
    public static void HandlePlayerAttackedMonsterRequest(GameWorldRef wr, string worldIdForLogging, GameWorldPlayer player, PlayerAttackedMonsterRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead || !player.AttackMode) {
            return;
        }
        if (player.IsPickupOrBowStanceLockoutActive(DateTimeOffset.UtcNow)) {
            return;
        }
        if (request.MonsterId == 0 || !player.IsMonsterInRange(request.MonsterId)) {
            return;
        }
        if (!wr.MonstersByMonsterId.TryGetValue(request.MonsterId, out var targetMonster) || targetMonster.Dead) {
            return;
        }

        AntiBotTools.NoteGameplayActivity(player);
        // Reject duplicate swing packets at intake (double-click / dual client paths).
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!player.TryBeginAttackRequest(nowMs, out var minAttackIntervalMs, out var elapsedAttackRequestMs)) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Rejected rapid attack packet from player {player.PlayerId} " +
                $"(elapsedMs={elapsedAttackRequestMs:F0}, minIntervalMs={minAttackIntervalMs:F0}).");
            return;
        }
        // Str/level gate: heavy weapons (GBH, etc.) unequip if the player cannot use them.
        if (!EquipCombatRules.PrepareForMelee(wr, player, out _)) {
            return;
        }
        if (targetMonster.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
            return;
        }

        if (player.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, player);
        }

        TemporaryEffects.BreakInvisibilityIfPresent(wr, player);

        var attackType = (AttackType)request.AttackType;
        // Server-authoritative ranged flag (client cannot bypass Defense Shield by spoofing rangedAttack).
        var isRanged = player.AttackRange > 1;
        var distanceNow = Location.GetDistance(player.PosX, player.PosY, targetMonster.PosX, targetMonster.PosY);
        if (distanceNow > player.AttackRange + 1) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Warning: player {player.PlayerId}'s attack was rejected: target beyond allowed range (distance={distanceNow}, maxAllowed={player.AttackRange + 1}); skipping damage delivery.");
            return;
        }

        if (attackType == AttackType.Interrupt) {
            targetMonster.ClearPendingAttackDamageFromPlayerInterrupt();
        }

        BroadcastPlayerAttackVisual(
            wr,
            player,
            NetworkManager.CreatePlayerAttackedMonster(
                player.PlayerId,
                ResolvePlayerAttackDirection(player, targetMonster.PosX, targetMonster.PosY),
                player.AttackSpeedMs,
                isRanged,
                targetMonster.MonsterId,
                player.PosX,
                player.PosY,
                request.AttackType));

        var attackerSessionId = player.SessionId;
        var targetMonsterId = request.MonsterId;
        var capturedInterruptedCount = player.InterruptedCount;
        var delayMs = ComputePlayerAttackDelayMs(wr, player, isRanged, targetMonster.PosX, targetMonster.PosY);
        wr.Scheduler.SetTimeout(delayMs, () => {
            if (!wr.World.TryGetPlayerBySessionId(attackerSessionId, out var attacker) || attacker.Disconnected) {
                return;
            }
            if (attacker.InterruptedCount != capturedInterruptedCount) {
                return;
            }
            if (!wr.MonstersByMonsterId.TryGetValue(targetMonsterId, out var delayedTargetMonster) || delayedTargetMonster.Dead) {
                return;
            }
            if (delayedTargetMonster.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
                return;
            }
            if (!attacker.IsMonsterInRange(targetMonsterId)) {
                return;
            }
            if (Location.GetDistance(attacker.PosX, attacker.PosY, delayedTargetMonster.PosX, delayedTargetMonster.PosY) > attacker.AttackRange + 1) {
                return;
            }
            if (!TryRecordPlayerAttackDamageDelivery(worldIdForLogging, attacker)) {
                return;
            }
            if (isRanged && delayedTargetMonster.HasTemporaryEffect(TemporaryEffectType.ProtectFromArrow)) {
                return;
            }

            ApplyPlayerAttackToMonster(wr, attacker, delayedTargetMonster, attackType);
        });
    }

    /// <summary>Schedules authoritative player-versus-player hit validation after lag compensation and fans out attack animation sync immediately.</summary>
    public static void HandlePlayerAttackedPlayerRequest(GameWorldRef wr, string worldIdForLogging, GameWorldPlayer player, PlayerAttackedPlayerRequest request) {
        ArgumentNullException.ThrowIfNull(player);
        ArgumentNullException.ThrowIfNull(request);

        if (player.IsDead || !player.AttackMode) {
            return;
        }
        if (player.IsPickupOrBowStanceLockoutActive(DateTimeOffset.UtcNow)) {
            return;
        }
        if (request.TargetPlayerId == 0 || request.TargetPlayerId == player.PlayerId || !player.IsPlayerInRange(request.TargetPlayerId)) {
            return;
        }
        var nowMsPvp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (!player.TryBeginAttackRequest(nowMsPvp, out var minPvpIntervalMs, out var elapsedPvpRequestMs)) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Rejected rapid PvP attack packet from player {player.PlayerId} " +
                $"(elapsedMs={elapsedPvpRequestMs:F0}, minIntervalMs={minPvpIntervalMs:F0}).");
            return;
        }
        if (!wr.World.TryGetConnectedPlayerById(request.TargetPlayerId, out var targetPlayer) || targetPlayer.IsDead) {
            return;
        }

        // Str/level gate (same as PvM): illegal heavy weapons strip + cancel swing.
        if (!EquipCombatRules.PrepareForMelee(wr, player, out _)) {
            return;
        }

        if (targetPlayer.SpawnProtection) {
            return;
        }

        if (targetPlayer.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
            return;
        }

        // Olympia Safe Attack: only allow PvP vs opposing-city enemies (relationship code 2).
        if (player.SafeAttackMode && !IsSafeAttackAllowedEnemy(player, targetPlayer)) {
            return;
        }

        var attackType = (AttackType)request.AttackType;
        // Server-authoritative ranged flag — never trust client request.RangedAttack.
        var isRanged = player.AttackRange > 1;
        var distanceNow = Location.GetDistance(player.PosX, player.PosY, targetPlayer.PosX, targetPlayer.PosY);
        if (distanceNow > player.AttackRange + 1) {
            Console.WriteLine(
                $"[GameWorld:{worldIdForLogging}] Warning: player {player.PlayerId}'s PvP attack was rejected: target beyond allowed range (distance={distanceNow}, maxAllowed={player.AttackRange + 1}); skipping damage delivery.");
            return;
        }

        if (player.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, player);
        }

        TemporaryEffects.BreakInvisibilityIfPresent(wr, player);

        BroadcastPlayerAttackVisual(
            wr,
            player,
            NetworkManager.CreatePlayerAttackedPlayer(
                player.PlayerId,
                ResolvePlayerAttackDirection(player, targetPlayer.PosX, targetPlayer.PosY),
                player.AttackSpeedMs,
                isRanged,
                targetPlayer.PlayerId,
                player.PosX,
                player.PosY,
                request.AttackType));

        var attackerSessionId = player.SessionId;
        var targetPlayerId = request.TargetPlayerId;
        var capturedInterruptedCount = player.InterruptedCount;
        var delayMs = ComputePlayerAttackDelayMs(wr, player, isRanged, targetPlayer.PosX, targetPlayer.PosY);
        wr.Scheduler.SetTimeout(delayMs, () => {
            if (!wr.World.TryGetPlayerBySessionId(attackerSessionId, out var attacker) || attacker.Disconnected) {
                return;
            }
            if (attacker.InterruptedCount != capturedInterruptedCount) {
                return;
            }
            if (!wr.World.TryGetConnectedPlayerById(targetPlayerId, out var delayedTargetPlayer) || delayedTargetPlayer.IsDead) {
                return;
            }
            if (delayedTargetPlayer.SpawnProtection) {
                return;
            }
            if (delayedTargetPlayer.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
                return;
            }
            if (attacker.SafeAttackMode && !IsSafeAttackAllowedEnemy(attacker, delayedTargetPlayer)) {
                return;
            }
            if (!attacker.IsPlayerInRange(targetPlayerId)) {
                return;
            }
            if (Location.GetDistance(attacker.PosX, attacker.PosY, delayedTargetPlayer.PosX, delayedTargetPlayer.PosY) > attacker.AttackRange + 1) {
                return;
            }
            if (!TryRecordPlayerAttackDamageDelivery(worldIdForLogging, attacker)) {
                return;
            }
            if (isRanged && delayedTargetPlayer.HasTemporaryEffect(TemporaryEffectType.ProtectFromArrow)) {
                return;
            }

            ApplyPlayerAttackToPlayer(wr, attacker, delayedTargetPlayer, attackType, checkDefenseShield: !isRanged);
        });
    }

    /// <summary>After an accepted dash step, applies any immediate player combat hit that the movement packet encoded.</summary>
    public static void HandlePlayerDashAttackAfterMovement(GameWorldRef wr, GameWorldPlayer attacker, RequestMovement requestMovement) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(requestMovement);

        if (!requestMovement.DashAttack || !requestMovement.HasAttackType || !attacker.AttackMode) {
            return;
        }
        // Traveler/normal clients cannot enable dash via packet; only GM sandbox sets AllowDashAttack.
        if (!attacker.AllowDashAttack) {
            return;
        }

        var attackType = (AttackType)requestMovement.AttackType;
        if (requestMovement.HasMonsterId) {
            if (!wr.MonstersByMonsterId.TryGetValue(requestMovement.MonsterId, out var targetMonster) || targetMonster.Dead) {
                return;
            }
            if (targetMonster.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
                return;
            }
            if (Location.GetDistance(requestMovement.CurX, requestMovement.CurY, targetMonster.PosX, targetMonster.PosY) > attacker.AttackRange + 1) {
                return;
            }
            if (Location.GetDistance(attacker.PosX, attacker.PosY, targetMonster.PosX, targetMonster.PosY) > attacker.AttackRange + 1) {
                return;
            }
            if (attackType == AttackType.Interrupt) {
                targetMonster.ClearPendingAttackDamageFromPlayerInterrupt();
            }
            if (attacker.SpawnProtection) {
                Spawn.DisableSpawnProtectionAndNotify(wr, attacker);
            }

            TemporaryEffects.BreakInvisibilityIfPresent(wr, attacker);
            ApplyPlayerAttackToMonster(wr, attacker, targetMonster, attackType);
            attacker.ClearLastPlayerAttackDamageDeliveryTime();
            return;
        }

        if (!requestMovement.HasPlayerId || requestMovement.PlayerId == 0 || requestMovement.PlayerId == attacker.PlayerId) {
            return;
        }
        if (!wr.World.TryGetConnectedPlayerById(requestMovement.PlayerId, out var targetPlayer) || targetPlayer.IsDead) {
            return;
        }
        if (targetPlayer.SpawnProtection) {
            return;
        }
        if (targetPlayer.HasTemporaryEffect(TemporaryEffectType.Invisibility)) {
            return;
        }
        if (attacker.SafeAttackMode && !IsSafeAttackAllowedEnemy(attacker, targetPlayer)) {
            return;
        }
        if (!attacker.IsPlayerInRange(requestMovement.PlayerId)) {
            return;
        }
        if (Location.GetDistance(requestMovement.CurX, requestMovement.CurY, targetPlayer.PosX, targetPlayer.PosY) > attacker.AttackRange + 1) {
            return;
        }
        if (Location.GetDistance(attacker.PosX, attacker.PosY, targetPlayer.PosX, targetPlayer.PosY) > attacker.AttackRange + 1) {
            return;
        }

        if (attacker.SpawnProtection) {
            Spawn.DisableSpawnProtectionAndNotify(wr, attacker);
        }

        TemporaryEffects.BreakInvisibilityIfPresent(wr, attacker);
        ApplyPlayerAttackToPlayer(wr, attacker, targetPlayer, attackType, checkDefenseShield: true);
        attacker.ClearLastPlayerAttackDamageDeliveryTime();
    }

    public static void ApplyMonsterAttackToMonster(GameWorldRef wr, GameWorldMonster attacker, GameWorldMonster targetMonster, int damage) {
        // Gold goblins / protected summons: monsters cannot damage them (players still can).
        if (targetMonster.ImmuneToMonsterDamage) {
            return;
        }

        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(targetMonster);

        if (!TryResolveMonsterAttack(
                wr,
                targetMonster,
                damage,
                attacker.AttackType,
                attacker.StunDurationMs,
                attacker.PosX,
                attacker.PosY,
                out var resolution)) {
            return;
        }

        if (resolution.HpAfter > 0) {
            targetMonster.SetAggroFromDamageMonsterAttacker(attacker.MonsterId, attacker.Allegiance);
        }

        MonsterVisibility.BroadcastMonsterTakeDamageByMonster(
            wr,
            targetMonster,
            damage,
            attacker.MonsterId,
            resolution.PacketAttackType,
            resolution.HpAfter,
            resolution.StunlockMs,
            resolution.KnockbackDurationMs,
            resolution.KnockbackDestX,
            resolution.KnockbackDestY,
            resolution.KnockbackFromX,
            resolution.KnockbackFromY);
        if (resolution.HpAfter == 0) {
            MonsterVisibility.BroadcastMonsterDied(wr, targetMonster, ResolveSummonOwnerKiller(wr, attacker));
        }
    }

    /// <summary>When a player-owned summon lands the killing blow, credit that player for exp/kills.</summary>
    static GameWorldPlayer? ResolveSummonOwnerKiller(GameWorldRef wr, GameWorldMonster attacker) {
        if (attacker.SummonOwnerPlayerId is not long ownerId) {
            return null;
        }
        if (!wr.World.TryGetConnectedPlayerById(ownerId, out var owner) || owner.Disconnected || owner.IsDead) {
            return null;
        }
        // Only credit friendly summons (player followers), not farm guards without an owner.
        return owner;
    }

    /// <summary>Applies authoritative player damage to a monster for non-melee sources (for example, server-resolved spells) while reusing normal damage and death fan-out.</summary>
    public static void ApplyPlayerDamageToMonster(GameWorldRef wr, GameWorldPlayer attacker, GameWorldMonster targetMonster, AttackType attackType) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(targetMonster);

        ApplyPlayerAttackToMonster(wr, attacker, targetMonster, attackType);
    }

    /// <summary>
    /// Applies Olympia magic-damage roll to a monster (Magic.cfg dice + Mag/3.3%), not melee STR damage.
    /// </summary>
    public static void ApplyPlayerSpellDamageToMonster(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldMonster targetMonster,
        AttackType attackType,
        SpellConfig spell) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(targetMonster);
        ArgumentNullException.ThrowIfNull(spell);

        if (TimedChallenge.IsChallengeMonster(attacker, targetMonster.MonsterId)) {
            TimedChallenge.OnWeaponHit(wr, attacker, targetMonster);
            return;
        }

        // Magic hit/miss (MR + monster magicHitRatio). Utility/CC spells resolve elsewhere.
        // Sleep wake extra hit ignores MR.
        var guaranteed = false;
        if (!CombatHit.RollMagicHitMonster(attacker, targetMonster, spell)) {
            if (targetMonster.HasTemporaryEffect(TemporaryEffectType.Sleep) &&
                spell.MaxHitsPerTarget is > 1) {
                guaranteed = true; // multi-hit sleep: still deliver +1 guaranteed path below
            } else {
                MonsterVisibility.BroadcastMonsterTakeDamage(
                    wr,
                    targetMonster,
                    damage: 0,
                    AttackType.NoInterrupt,
                    targetMonster.Hp);
                return;
            }
        }

        void DeliverSpellHit(int dmg, bool ignoreMrAlreadyHit) {
            if (dmg <= 0 && !ignoreMrAlreadyHit) {
                return;
            }
            dmg = PlayerDerivedStats.ApplySleepWakeBonus(wr, targetMonster, dmg, out var woke);
            if (!TryResolveMonsterAttack(
                    wr,
                    targetMonster,
                    dmg,
                    attackType,
                    attacker.AttackStunDurationMs,
                    attacker.PosX,
                    attacker.PosY,
                    out var resolution)) {
                return;
            }
            if (resolution.HpAfter > 0) {
                targetMonster.SetAggroFromDamagePlayerAttacker(attacker.PlayerId);
            }
            MonsterVisibility.BroadcastMonsterTakeDamage(
                wr,
                targetMonster,
                dmg,
                resolution.PacketAttackType,
                resolution.HpAfter,
                resolution.StunlockMs,
                resolution.KnockbackDurationMs,
                resolution.KnockbackDestX,
                resolution.KnockbackDestY,
                resolution.KnockbackFromX,
                resolution.KnockbackFromY);
            if (resolution.HpAfter == 0) {
                MonsterVisibility.BroadcastMonsterDied(wr, targetMonster, attacker);
            }
            // Multi-hit spell + sleep wake: +1 guaranteed hit that always lands.
            if (woke && spell.MaxHitsPerTarget is > 1 && targetMonster.Hp > 0) {
                var extra = PlayerDerivedStats.RollMagicDamage(attacker, spell);
                extra = MobSpecialty.ApplyOutgoingDamageBonus(attacker, targetMonster.CatalogMonsterId, extra);
                if (TryResolveMonsterAttack(
                        wr,
                        targetMonster,
                        extra,
                        attackType,
                        0,
                        attacker.PosX,
                        attacker.PosY,
                        out var extraRes)) {
                    MonsterVisibility.BroadcastMonsterTakeDamage(
                        wr, targetMonster, extra, extraRes.PacketAttackType, extraRes.HpAfter);
                    if (extraRes.HpAfter == 0) {
                        MonsterVisibility.BroadcastMonsterDied(wr, targetMonster, attacker);
                    }
                }
            }
        }

        if (!guaranteed) {
            var damage = PlayerDerivedStats.RollMagicDamage(attacker, spell);
            damage = MobSpecialty.ApplyOutgoingDamageBonus(attacker, targetMonster.CatalogMonsterId, damage);
            DeliverSpellHit(damage, ignoreMrAlreadyHit: false);
        } else {
            // Guaranteed multi-hit sleep strike (ignores MR).
            var damage = PlayerDerivedStats.RollMagicDamage(attacker, spell);
            damage = MobSpecialty.ApplyOutgoingDamageBonus(attacker, targetMonster.CatalogMonsterId, damage);
            DeliverSpellHit(damage, ignoreMrAlreadyHit: true);
        }
    }

    /// <summary>Applies authoritative player damage to another player for non-melee sources (for example, server-resolved spells) while reusing normal damage, interrupt, and death fan-out.</summary>
    public static void ApplyPlayerDamageToPlayer(GameWorldRef wr, GameWorldPlayer attacker, GameWorldPlayer targetPlayer, AttackType attackType) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(targetPlayer);

        if (targetPlayer.IsDead || targetPlayer.SpawnProtection) {
            return;
        }

        ApplyPlayerAttackToPlayer(wr, attacker, targetPlayer, attackType, checkDefenseShield: false);
    }

    /// <summary>Applies Olympia magic-damage roll to another player (no physical defense-shield check).</summary>
    public static void ApplyPlayerSpellDamageToPlayer(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldPlayer targetPlayer,
        AttackType attackType,
        SpellConfig spell) {
        ArgumentNullException.ThrowIfNull(attacker);
        ArgumentNullException.ThrowIfNull(targetPlayer);
        ArgumentNullException.ThrowIfNull(spell);

        if (targetPlayer.IsDead || targetPlayer.SpawnProtection) {
            return;
        }

        // Never self-damage with direct spells (AoE collectors also skip caster; hard guard here).
        if (ReferenceEquals(attacker, targetPlayer) || attacker.PlayerId == targetPlayer.PlayerId) {
            return;
        }

        // Safe Attack on: no magic damage to same-city (only opposing-city FOE).
        if (attacker.SafeAttackMode && !IsSafeAttackAllowedEnemy(attacker, targetPlayer)) {
            return;
        }

        // Duel equalizer: delay full magic resolution (hit roll + dmg) for better connections.
        var duelDelay = ArenaPact.GetCombatDelayMs(attacker);
        if (duelDelay > 0) {
            var atkId = attacker.PlayerId;
            var tgtId = targetPlayer.PlayerId;
            var spellId = spell.Id;
            wr.Scheduler.SetTimeout(duelDelay, () => {
                if (!wr.World.TryGetConnectedPlayerById(atkId, out var atk) ||
                    !wr.World.TryGetConnectedPlayerById(tgtId, out var tgt) ||
                    atk.IsDead ||
                    tgt.IsDead) {
                    return;
                }
                if (!wr.SpellsById.TryGetValue(spellId, out var sp) || sp is null) {
                    return;
                }
                // Avoid re-entering delay.
                ApplyPlayerSpellDamageToPlayerImmediate(wr, atk, tgt, attackType, sp);
            });
            return;
        }

        ApplyPlayerSpellDamageToPlayerImmediate(wr, attacker, targetPlayer, attackType, spell);
    }

    private static void ApplyPlayerSpellDamageToPlayerImmediate(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldPlayer targetPlayer,
        AttackType attackType,
        SpellConfig spell) {
        var wasSleeping = targetPlayer.HasTemporaryEffect(TemporaryEffectType.Sleep);
        if (!CombatHit.RollMagicHitPlayer(attacker, targetPlayer, spell)) {
            // Sleep multi-hit: still deliver one guaranteed wake strike.
            if (!(wasSleeping && spell.MaxHitsPerTarget is > 1)) {
                ApplyPlayerAttackToPlayerWithDamageImmediate(wr, attacker, targetPlayer, attackType, damage: 0, checkDefenseShield: false, wearWeapon: false);
                return;
            }
        }
        // Merien Shield / body-guard SA: block magic while active (Olympia 51/52).
        if (SpecialAbility.BlocksMagicDamage(targetPlayer)) {
            ApplyPlayerAttackToPlayerWithDamageImmediate(wr, attacker, targetPlayer, attackType, damage: 0, checkDefenseShield: false, wearWeapon: false);
            return;
        }
        var damage = PlayerDerivedStats.RollMagicDamageVsPlayer(attacker, spell, targetPlayer);
        damage = PlayerDerivedStats.ApplyMagicMitigation(targetPlayer, damage);
        damage = PlayerDerivedStats.ApplySleepWakeBonus(wr, targetPlayer, damage, out var woke);
        CombatHit.TryTrainMagicResistanceOnSpellHit(targetPlayer);
        ApplyPlayerAttackToPlayerWithDamageImmediate(wr, attacker, targetPlayer, attackType, damage, checkDefenseShield: false, wearWeapon: false);
        // Multi-hit + sleep: +1 guaranteed hit (ignores MR; still mitigated by MA).
        if (woke && spell.MaxHitsPerTarget is > 1 && !targetPlayer.IsDead) {
            var extra = PlayerDerivedStats.RollMagicDamageVsPlayer(attacker, spell, targetPlayer);
            extra = PlayerDerivedStats.ApplyMagicMitigation(targetPlayer, extra);
            ApplyPlayerAttackToPlayerWithDamageImmediate(wr, attacker, targetPlayer, attackType, extra, checkDefenseShield: false, wearWeapon: false);
        }
    }

    /// <summary>Applies spell damage from a monster to a player using explicit damage and spell hit mode; reuses monster melee knockback/stun rules with <paramref name="spellAttackType"/>.</summary>
    public static void ApplyMonsterSpellDamageToPlayer(
        GameWorldRef wr,
        GameWorldMonster caster,
        GameWorldPlayer target,
        int damage,
        AttackType spellAttackType) {
        ArgumentNullException.ThrowIfNull(caster);
        // Farm/city Guard (Friendly) must never hurt players — AFK sentry vs pulled mobs only.
        if (caster.Allegiance == MonsterAllegiance.Friendly) {
            return;
        }
        ArgumentNullException.ThrowIfNull(target);

        if (damage <= 0 || target.IsDead || target.SpawnProtection) {
            return;
        }

        damage = MobSpecialty.ApplyIncomingDamageReduction(target, caster.CatalogMonsterId, damage);
        if (damage <= 0) {
            return;
        }

        var px = target.PosX;
        var py = target.PosY;
        var attackTypeOut = spellAttackType;
        var stunPacketMs = 0;
        var knockbackDurMs = 0;
        var destKbX = -1;
        var destKbY = -1;

        var remainingStunlock = target.GetRemainingCombatStunlockMs(DateTimeOffset.UtcNow);
        var wantDamageMove = damage >= GetDamageMoveThreshold(wr) || spellAttackType == AttackType.Knockback;
        if ((spellAttackType == AttackType.Stun || spellAttackType == AttackType.Knockback) && remainingStunlock > 0 && !wantDamageMove) {
            attackTypeOut = AttackType.Interrupt;
        } else if (spellAttackType == AttackType.Stun && !wantDamageMove) {
            stunPacketMs = caster.StunDurationMs;
        } else if (wantDamageMove) {
            stunPacketMs = caster.StunDurationMs;
            if (TryApplyDamageMoveStep(wr, caster.PosX, caster.PosY, target, px, py, out var kx, out var ky)) {
                attackTypeOut = AttackType.Knockback;
                knockbackDurMs = wr.Settings.Timings.KnockbackTimeMs;
                destKbX = kx;
                destKbY = ky;
            } else if (spellAttackType is AttackType.Stun or AttackType.Knockback) {
                attackTypeOut = AttackType.Stun;
            }
        }

        MonsterVisibility.BroadcastPlayerReceiveDamage(
            wr,
            target.PlayerId,
            damage,
            caster.MonsterId,
            attackTypeOut,
            stunPacketMs,
            knockbackDurMs,
            destKbX,
            destKbY,
            knockbackDurMs > 0 ? px : null,
            knockbackDurMs > 0 ? py : null);
    }

    /// <summary>Applies spell damage from a monster to another monster with explicit damage and spell hit mode.</summary>
    public static void ApplyMonsterSpellDamageToMonster(
        GameWorldRef wr,
        GameWorldMonster caster,
        GameWorldMonster targetMonster,
        int damage,
        AttackType spellAttackType) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(targetMonster);
        if (targetMonster.ImmuneToMonsterDamage) {
            return;
        }

        if (!TryResolveMonsterAttack(
                wr,
                targetMonster,
                damage,
                spellAttackType,
                caster.StunDurationMs,
                caster.PosX,
                caster.PosY,
                out var resolution)) {
            return;
        }

        if (resolution.HpAfter > 0) {
            targetMonster.SetAggroFromDamageMonsterAttacker(caster.MonsterId, caster.Allegiance);
        }

        MonsterVisibility.BroadcastMonsterTakeDamageByMonster(
            wr,
            targetMonster,
            damage,
            caster.MonsterId,
            resolution.PacketAttackType,
            resolution.HpAfter,
            resolution.StunlockMs,
            resolution.KnockbackDurationMs,
            resolution.KnockbackDestX,
            resolution.KnockbackDestY,
            resolution.KnockbackFromX,
            resolution.KnockbackFromY);
        if (resolution.HpAfter == 0) {
            MonsterVisibility.BroadcastMonsterDied(wr, targetMonster, ResolveSummonOwnerKiller(wr, caster));
        }
    }

    /// <summary>Applies any step-on-only ground effects on the player's current cell.</summary>
    public static void ApplyGroundEffectStepDamageToPlayer(GameWorldRef wr, GameWorldPlayer targetPlayer) {
        ArgumentNullException.ThrowIfNull(targetPlayer);
        if (!wr.GroundStateTracker.TryGetEffectsAtCell(targetPlayer.PosX, targetPlayer.PosY, out var cellEffects) || cellEffects is null) {
            return;
        }

        foreach (var effect in cellEffects) {
            if (effect.HasPeriodicDamage) {
                continue;
            }

            ApplyGroundEffectDamageToPlayer(
                wr,
                effect.CasterPlayerId,
                effect.DamagePerTick,
                targetPlayer,
                effect.SpellAttackType,
                effect.SpellId);
        }
    }

    /// <summary>Applies any step-on-only ground effects on the monster's current cell.</summary>
    public static void ApplyGroundEffectStepDamageToMonster(GameWorldRef wr, GameWorldMonster targetMonster) {
        ArgumentNullException.ThrowIfNull(targetMonster);
        if (!wr.GroundStateTracker.TryGetEffectsAtCell(targetMonster.PosX, targetMonster.PosY, out var cellEffects) || cellEffects is null) {
            return;
        }

        foreach (var effect in cellEffects) {
            if (effect.HasPeriodicDamage) {
                continue;
            }

            ApplyGroundEffectDamageToMonster(
                wr,
                effect.CasterPlayerId,
                effect.DamagePerTick,
                targetMonster,
                effect.SpellAttackType,
                effect.SpellId);
        }
    }

    /// <summary>Applies authoritative ground-effect damage to a monster using the captured caster id and damage snapshot from effect creation.</summary>
    public static void ApplyGroundEffectDamageToMonster(GameWorldRef wr, long attackerPlayerId, int damage, GameWorldMonster targetMonster, AttackType attackType, int spellId) {
        ArgumentNullException.ThrowIfNull(targetMonster);
        if (damage <= 0 || targetMonster.Dead) {
            return;
        }

        var attackStunDurationMs = 0;
        var attackerPosX = targetMonster.PosX;
        var attackerPosY = targetMonster.PosY;
        if (wr.World.TryGetConnectedPlayerById(attackerPlayerId, out var caster)) {
            attackerPosX = caster.PosX;
            attackerPosY = caster.PosY;
            if (attackType == AttackType.Stun) {
                attackStunDurationMs = caster.AttackStunDurationMs;
            }
        }

        if (!TryResolveMonsterAttack(
                wr,
                targetMonster,
                damage,
                attackType,
                attackStunDurationMs,
                attackerPosX,
                attackerPosY,
                out var resolution)) {
            return;
        }

        if (resolution.HpAfter > 0) {
            targetMonster.SetAggroFromDamagePlayerAttacker(attackerPlayerId);
        }

        MonsterVisibility.BroadcastMonsterTakeDamage(
            wr,
            targetMonster,
            damage,
            resolution.PacketAttackType,
            resolution.HpAfter,
            resolution.StunlockMs,
            resolution.KnockbackDurationMs,
            resolution.KnockbackDestX,
            resolution.KnockbackDestY,
            resolution.KnockbackFromX,
            resolution.KnockbackFromY);
        if (resolution.HpAfter == 0) {
            MonsterVisibility.BroadcastMonsterDied(
                wr,
                targetMonster,
                wr.World.TryGetConnectedPlayerById(attackerPlayerId, out var killerPlayer) ? killerPlayer : null);
        } else {
            TryApplyGroundEffectSpellTemporaryEffectsAfterDamage(wr, spellId, targetMonster);
        }
    }

    /// <summary>Applies authoritative ground-effect damage to a player using the captured caster id and damage snapshot from effect creation.</summary>
    public static void ApplyGroundEffectDamageToPlayer(GameWorldRef wr, long attackerPlayerId, int damage, GameWorldPlayer targetPlayer, AttackType attackType, int spellId) {
        ArgumentNullException.ThrowIfNull(targetPlayer);
        if (damage <= 0 || targetPlayer.IsDead || targetPlayer.SpawnProtection) {
            return;
        }

        // Ground fields (Fire Field, poison, etc.) hit everyone on the cell equally — including the caster.

        var stunDuration = 0;
        if (attackType == AttackType.Stun && wr.World.TryGetConnectedPlayerById(attackerPlayerId, out var caster)) {
            stunDuration = caster.AttackStunDurationMs;
        }

        MonsterVisibility.BroadcastPlayerTakeDamage(
            wr,
            targetPlayer.PlayerId,
            damage,
            attackerPlayerId,
            attackType,
            stunDuration);

        if (!targetPlayer.IsDead) {
            TryApplyGroundEffectSpellTemporaryEffectsAfterDamage(wr, spellId, targetPlayer);
        }
    }

    /// <summary>Applies spell <c>temporaryEffects</c> for a ground-effect spell after damage is delivered (periodic tick or step-on).</summary>
    private static void TryApplyGroundEffectSpellTemporaryEffectsAfterDamage(GameWorldRef wr, int spellId, GameWorldActionableEntity target) {
        if (!wr.SpellsById.TryGetValue(spellId, out var spell)) {
            return;
        }

        TemporaryEffects.ApplySpellTemporaryEffectsOnHit(wr, spell, target);
    }

    private static int ResolvePlayerAttackDirection(GameWorldPlayer attacker, int targetX, int targetY) {
        var attackDirection = Location.GetNextGridDirection(attacker.PosX, attacker.PosY, targetX, targetY);
        if (attackDirection < 0 || attackDirection > 7) {
            return attacker.FacingDirection;
        }

        return attackDirection;
    }

    private static void BroadcastPlayerAttackVisual(GameWorldRef wr, GameWorldPlayer attacker, ServerMessage attackVisual) {
        foreach (var recipient in wr.PlayerSpatialGrid.GetNearbyPlayers(attacker.PosX, attacker.PosY, attacker.SessionId, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(recipient, attackVisual);
        }
    }

    private static int ComputePlayerAttackDelayMs(GameWorldRef wr, GameWorldPlayer attacker, bool rangedAttack, int targetX, int targetY) {
        // Feel B: land damage slightly earlier in the swing (was AttackSpeed/2).
        // Still waits for animation start; floor 28ms avoids same-tick double-apply weirdness.
        var delayMs = Math.Max(28, (attacker.AttackSpeedMs * 2) / 5);
        if (rangedAttack) {
            delayMs += Projectile.ComputeTravelTime(attacker.PosX, attacker.PosY, targetX, targetY, wr.Settings.Timings.ArrowSpeed);
        }

        return delayMs;
    }

    /// <summary>
    /// Olympia DamageMove thresholds (player targets only): open maps ≥50 dmg; fight zones / arena ≥80.
    /// Never used to knock monsters — high player damage does not patear bichos.
    /// </summary>
    public static int GetDamageMoveThreshold(GameWorldRef wr) {
        ArgumentNullException.ThrowIfNull(wr);
        if (wr.World.IsTournamentArena) {
            return 80;
        }
        var id = wr.WorldId ?? "";
        if (id.Contains("fightzone", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("colosseum", StringComparison.OrdinalIgnoreCase) ||
            id.Contains("btfield", StringComparison.OrdinalIgnoreCase)) {
            return 80;
        }
        return 50;
    }

    /// <summary>1-tile kick away from attacker if dest is free (not teleport pad).</summary>
    public static bool TryApplyDamageMoveStep(
        GameWorldRef wr,
        int attackerX,
        int attackerY,
        GameWorldPlayer targetPlayer,
        int fromX,
        int fromY,
        out int destX,
        out int destY) {
        destX = fromX;
        destY = fromY;
        ArgumentNullException.ThrowIfNull(wr);
        ArgumentNullException.ThrowIfNull(targetPlayer);

        var dir = Location.GetNextGridDirection(attackerX, attackerY, fromX, fromY);
        if (dir < 0 || dir > 7) {
            return false;
        }
        Location.GetDirectionDelta(dir, out var kdx, out var kdy);
        var kx = fromX + kdx;
        var ky = fromY + kdy;
        if (!wr.OccupancyTracker.IsFreeAndNotTeleportCell(kx, ky)) {
            return false;
        }
        wr.OccupancyTracker.SetFree(fromX, fromY);
        wr.OccupancyTracker.SetOccupied(kx, ky);
        Movement.SetPlayerPosition(wr, targetPlayer, kx, ky);
        Movement.SyncPlayerVisibilityAfterMovement(wr, targetPlayer, fromX, fromY, kx, ky, broadcastPlayerMoved: false);
        ApplyGroundEffectStepDamageToPlayer(wr, targetPlayer);
        destX = kx;
        destY = ky;
        return true;
    }

    private static bool TryRecordPlayerAttackDamageDelivery(string worldIdForLogging, GameWorldPlayer attacker) {
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (attacker.TryRecordPlayerAttackDamageDelivery(nowMs, out var minIntervalMs, out var elapsedSinceLastDeliveryMs)) {
            return true;
        }

        Console.WriteLine(
            $"[GameWorld:{worldIdForLogging}] Warning: player {attacker.PlayerId}'s attack speed was detected to be erratic (elapsedMs={elapsedSinceLastDeliveryMs:F1}, minIntervalMs={minIntervalMs:F1}); skipping melee damage delivery.");
        return false;
    }

    private static bool TryResolveMonsterAttack(
        GameWorldRef wr,
        GameWorldMonster targetMonster,
        int damage,
        AttackType attackType,
        int attackStunDurationMs,
        int attackerPosX,
        int attackerPosY,
        out MonsterAttackResolution resolution) {
        resolution = default;
        var now = DateTimeOffset.UtcNow;
        if (!targetMonster.TryApplyAttackerHit(wr, damage, now, out var hpAfter)) {
            return false;
        }

        var stunlockMs = 0;
        int? knockbackDurMs = null;
        int? kbFromX = null;
        int? kbFromY = null;
        int? kbDestX = null;
        int? kbDestY = null;
        var packetAttackType = attackType;

        if (hpAfter > 0) {
            // Olympia: high-damage "DamageMove" (pateo) does NOT apply to monsters — only PvP and
            // monster→player. Explicit AttackType.Knockback still moves a mob (rare catalog cases).
            // Stun still applies for Interrupt/Stun attack types without displacing the mob.
            var wantKb = attackType == AttackType.Knockback;
            if (attackType == AttackType.Stun && !wantKb) {
                if (targetMonster.TryApplyStunlock(now, attackStunDurationMs)) {
                    stunlockMs = attackStunDurationMs;
                }
            } else if (wantKb) {
                var fromX = targetMonster.PosX;
                var fromY = targetMonster.PosY;
                if (targetMonster.TryApplyKnockbackFromAttacker(wr, attackerPosX, attackerPosY, out var destX, out var destY)) {
                    packetAttackType = AttackType.Knockback;
                    if (targetMonster.TryApplyStunlock(now, attackStunDurationMs)) {
                        stunlockMs = attackStunDurationMs;
                    }
                    knockbackDurMs = wr.Settings.Timings.KnockbackTimeMs;
                    kbFromX = fromX;
                    kbFromY = fromY;
                    kbDestX = destX;
                    kbDestY = destY;
                } else if (attackType is AttackType.Stun or AttackType.Knockback) {
                    packetAttackType = AttackType.Stun;
                    if (targetMonster.TryApplyStunlock(now, attackStunDurationMs)) {
                        stunlockMs = attackStunDurationMs;
                    }
                }
            } else if (attackType == AttackType.Interrupt) {
                // No knockback on mobs for normal/high-damage weapon hits — keeps fencing trains tight.
            }
        }

        resolution = new MonsterAttackResolution(
            hpAfter,
            packetAttackType,
            stunlockMs,
            knockbackDurMs,
            kbFromX,
            kbFromY,
            kbDestX,
            kbDestY);
        return true;
    }

    private static void ApplyPlayerAttackToMonster(GameWorldRef wr, GameWorldPlayer attacker, GameWorldMonster targetMonster, AttackType attackType) {
        // Timed Challenge Route B: melee weapon hit marks poison protocol without needing to kill runners.
        if (TimedChallenge.IsChallengeMonster(attacker, targetMonster.MonsterId)) {
            TimedChallenge.OnWeaponHit(wr, attacker, targetMonster);
            return;
        }

        // Hit/miss before damage (Olympia-feel). Miss = 0 dmg, still animates via caller.
        if (!CombatHit.RollMeleeHitMonster(attacker, targetMonster)) {
            attacker.ResetMeleeCombo();
            MonsterVisibility.BroadcastMonsterTakeDamage(
                wr,
                targetMonster,
                damage: 0,
                AttackType.NoInterrupt,
                targetMonster.Hp);
            return;
        }

        attacker.NoteMeleeComboHit();
        SpecialAbility.Tick(wr, attacker);
        var saBefore = attacker.SuperAttackLeft;
        // Bane (Olympia): "Hits twice" — resolve two damage applications when target still alive.
        var hitCount = PlayerDerivedStats.HasBaneEquipped(attacker) ? 2 : 1;
        var lastHp = targetMonster.Hp;
        var totalDamage = 0;
        for (var hit = 0; hit < hitCount && lastHp > 0; hit++) {
            var damage = PlayerDerivedStats.RollMeleeDamage(attacker);
            damage = PlayerDerivedStats.ApplyCadIfCombo(attacker, damage);
            // Only first Bane swing may consume SA (double crit); second is follow-up.
            if (hit == 0) {
                damage = PlayerDerivedStats.ApplySuperAttackIfAvailable(attacker, damage);
            }
            damage = MobSpecialty.ApplyOutgoingDamageBonus(attacker, targetMonster.CatalogMonsterId, damage);
            damage = SpecialAbility.ModifyOutgoingMeleeDamage(wr, attacker, targetMonster, damage);
            damage = PlayerDerivedStats.ApplySleepWakeBonus(wr, targetMonster, damage, out _);
            if (!TryResolveMonsterAttack(
                    wr,
                    targetMonster,
                    damage,
                    attackType,
                    attacker.AttackStunDurationMs,
                    attacker.PosX,
                    attacker.PosY,
                    out var resolution)) {
                break;
            }
            totalDamage += damage;
            lastHp = resolution.HpAfter;
            if (resolution.HpAfter > 0) {
                targetMonster.SetAggroFromDamagePlayerAttacker(attacker.PlayerId);
            }
            MonsterVisibility.BroadcastMonsterTakeDamage(
                wr,
                targetMonster,
                damage,
                resolution.PacketAttackType,
                resolution.HpAfter,
                resolution.StunlockMs,
                resolution.KnockbackDurationMs,
                resolution.KnockbackDestX,
                resolution.KnockbackDestY,
                resolution.KnockbackFromX,
                resolution.KnockbackFromY);
            if (resolution.HpAfter == 0) {
                MonsterVisibility.BroadcastMonsterDied(wr, targetMonster, attacker);
                break;
            }
        }

        CombatHit.TryTrainWeaponSkillOnHit(attacker);
        ApplyEquippedWeaponWear(wr, attacker);
        if (totalDamage > 0) {
            SiphonGems.ApplyOnHit(attacker, totalDamage);
        }
        if (attacker.SuperAttackLeft != saBefore) {
            Progression.SendProgressionUpdated(attacker, leveledUp: false);
        }
    }

    private static void ApplyPlayerAttackToPlayer(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldPlayer targetPlayer,
        AttackType attackType,
        bool checkDefenseShield) {
        var damage = PlayerDerivedStats.RollMeleeDamageVsPlayer(attacker, targetPlayer);
        ApplyPlayerAttackToPlayerWithDamage(wr, attacker, targetPlayer, attackType, damage, checkDefenseShield, wearWeapon: true);
    }

    /// <summary>PvP hit with an explicit damage roll (melee or magic).</summary>
    private static void ApplyPlayerAttackToPlayerWithDamage(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldPlayer targetPlayer,
        AttackType attackType,
        int damage,
        bool checkDefenseShield,
        bool wearWeapon = true) {
        // Arena duel equalizer: delay better connections toward agreed floor (or fixed delay).
        var duelDelay = ArenaPact.GetCombatDelayMs(attacker);
        if (duelDelay > 0) {
            var atkId = attacker.PlayerId;
            var tgtId = targetPlayer.PlayerId;
            wr.Scheduler.SetTimeout(duelDelay, () => {
                if (!wr.World.TryGetConnectedPlayerById(atkId, out var atk) ||
                    !wr.World.TryGetConnectedPlayerById(tgtId, out var tgt) ||
                    atk.IsDead ||
                    tgt.IsDead) {
                    return;
                }
                ApplyPlayerAttackToPlayerWithDamageImmediate(wr, atk, tgt, attackType, damage, checkDefenseShield, wearWeapon);
            });
            return;
        }

        ApplyPlayerAttackToPlayerWithDamageImmediate(wr, attacker, targetPlayer, attackType, damage, checkDefenseShield, wearWeapon);
    }

    private static void ApplyPlayerAttackToPlayerWithDamageImmediate(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldPlayer targetPlayer,
        AttackType attackType,
        int damage,
        bool checkDefenseShield,
        bool wearWeapon = true) {
        var stunPacketMs = 0;
        var knockbackDurMs = 0;
        var destKbX = -1;
        var destKbY = -1;
        var attackTypeOut = attackType;
        var px = targetPlayer.PosX;
        var py = targetPlayer.PosY;

        if (checkDefenseShield && !TemporaryEffects.RollPhysicalHitVsDefenseShield(targetPlayer)) {
            // Gold Carp food buff: +10% chance to still land when shield would stop the hit.
            var savedByCarp = attacker is GameWorldPlayer atkHit
                && atkHit.HasFoodHitBonus
                && Random.Shared.Next(1, 101) <= 10;
            if (!savedByCarp) {
                damage = 0;
                attackTypeOut = AttackType.NoInterrupt;
            }
        }

        // Melee hit/miss vs player (DEX + masteries). Skip if already zeroed by shield.
        var saBefore = attacker.SuperAttackLeft;
        if (damage > 0 && wearWeapon && !CombatHit.RollMeleeHitPlayer(attacker, targetPlayer)) {
            damage = 0;
            attackTypeOut = AttackType.NoInterrupt;
            attacker.ResetMeleeCombo();
        } else if (damage > 0 && wearWeapon) {
            attacker.NoteMeleeComboHit();
            damage = PlayerDerivedStats.ApplyCadIfCombo(attacker, damage);
            // Super Attack only after confirmed hit (not on miss).
            damage = PlayerDerivedStats.ApplySuperAttackIfAvailable(attacker, damage);
        }

        // Armor / shield DF from Item.cfg — without this, naked == full plate (tester report).
        if (damage > 0 && wearWeapon) {
            damage = PlayerDerivedStats.ApplyPhysicalMitigation(targetPlayer, damage);
        }

        // Attacker SA (Xelima half-HP, Ice freeze, …) then defender SA (Merien shield/plate).
        SpecialAbility.Tick(wr, attacker);
        SpecialAbility.Tick(wr, targetPlayer);
        if (damage > 0 && wearWeapon) {
            damage = SpecialAbility.ModifyOutgoingMeleeDamage(wr, attacker, targetPlayer, damage);
        }
        if (damage > 0) {
            damage = SpecialAbility.ModifyIncomingPhysicalDamage(wr, attacker, targetPlayer, damage);
        }

        if (attacker.SuperAttackLeft != saBefore) {
            Progression.SendProgressionUpdated(attacker, leveledUp: false);
        }

        if (!targetPlayer.IsDead && damage > 0) {
            // Olympia DamageMove (PvP only for player→player):
            // ≥50 open / ≥80 fight zones kick 1 tile — unless weapon is Short-Sword or Fencing
            // (skill 7/9): those never patean so multi-crit trains keep the rival next to you.
            var damageMoveThreshold = GetDamageMoveThreshold(wr);
            var fencingOrShort = EquipCombatRules.IsShortSwordOrFencingWeapon(attacker);
            var wantDamageMove = !fencingOrShort &&
                (damage >= damageMoveThreshold || attackType == AttackType.Knockback);
            if (attackType == AttackType.Stun && !wantDamageMove) {
                stunPacketMs = attacker.AttackStunDurationMs;
            } else if (wantDamageMove) {
                stunPacketMs = attacker.AttackStunDurationMs;
                if (TryApplyDamageMoveStep(wr, attacker.PosX, attacker.PosY, targetPlayer, px, py,
                        out var kx, out var ky)) {
                    attackTypeOut = AttackType.Knockback;
                    knockbackDurMs = wr.Settings.Timings.KnockbackTimeMs;
                    destKbX = kx;
                    destKbY = ky;
                } else if (attackType == AttackType.Stun || attackType == AttackType.Knockback) {
                    // Blocked cell: still interrupt with stun packet (Olympia fallback).
                    attackTypeOut = AttackType.Stun;
                }
            }
        }

        MonsterVisibility.BroadcastPlayerTakeDamage(
            wr,
            targetPlayer.PlayerId,
            damage,
            attacker.PlayerId,
            attackTypeOut,
            stunPacketMs,
            knockbackDurMs,
            destKbX,
            destKbY,
            knockbackDurMs > 0 ? px : null,
            knockbackDurMs > 0 ? py : null);

        if (wearWeapon && damage > 0) {
            CombatHit.TryTrainWeaponSkillOnHit(attacker);
            ApplyEquippedWeaponWear(wr, attacker);
            SiphonGems.ApplyOnHit(attacker, damage);
        }
    }

    /// <summary>Olympia fair-weather weapon wear (−1 durability per hit); unequips at 0.</summary>
    static void ApplyEquippedWeaponWear(GameWorldRef wr, GameWorldPlayer attacker) {
        if (!attacker.InventoryManager.TryApplyEquippedWeaponWear(out var mutation, out var worn) || worn is null) {
            return;
        }

        NetworkManager.SendToPlayer(
            attacker,
            NetworkManager.CreateItemLifeSpanUpdated(worn.ItemUid, worn.CurLifeSpan, worn.MaxLifeSpan));
        if (mutation.Unequipped.Count > 0 || mutation.AddedToBag.Count > 0) {
            Inventory.ApplyInventoryMutation(wr, attacker, mutation);
        }
    }

    /// <summary>
    /// Olympia Safe Attack relationship code 2: both players have opposing city citizenship (aresden vs elvine).
    /// Same-city, self, traveler, or empty sides are blocked while Safe Attack is on.
    /// </summary>
    public static bool IsSafeAttackAllowedEnemy(GameWorldPlayer attacker, GameWorldPlayer target) {
        if (ReferenceEquals(attacker, target) || attacker.PlayerId == target.PlayerId) {
            return false;
        }
        return IsOpposingCityFoe(attacker, target);
    }

    /// <summary>
    /// True when Safe Attack forbids harming this player (self, same city, travelers…).
    /// Used by melee, magic damage, Paralyze / Hold Person.
    /// </summary>
    public static bool IsSafeAttackBlockedTarget(GameWorldPlayer attacker, GameWorldPlayer target) {
        return attacker.SafeAttackMode && !IsSafeAttackAllowedEnemy(attacker, target);
    }

    /// <summary>
    /// True when both have opposing city citizenship (aresden vs elvine). Used for Safe Attack FOE
    /// and open-world "war enemy" checks. Travelers are never FOE here.
    /// </summary>
    public static bool IsOpposingCityFoe(GameWorldPlayer a, GameWorldPlayer b) {
        var attackerSide = NormalizeCitizenshipSide(a.CitizenshipSide);
        var targetSide = NormalizeCitizenshipSide(b.CitizenshipSide);
        return (attackerSide == "aresden" && targetSide == "elvine")
            || (attackerSide == "elvine" && targetSide == "aresden");
    }

    /// <summary>
    /// Same-city ally (aresden/elvine matching sides). Never true for self or travelers.
    /// Used by Haste: only friends of the same city, never the caster.
    /// </summary>
    public static bool IsSameCityAlly(GameWorldPlayer caster, GameWorldPlayer target) {
        ArgumentNullException.ThrowIfNull(caster);
        ArgumentNullException.ThrowIfNull(target);
        if (ReferenceEquals(caster, target) || caster.PlayerId == target.PlayerId) {
            return false;
        }

        var casterSide = NormalizeCitizenshipSide(caster.CitizenshipSide);
        var targetSide = NormalizeCitizenshipSide(target.CitizenshipSide);
        if (casterSide is not ("aresden" or "elvine") || targetSide is not ("aresden" or "elvine")) {
            return false;
        }

        return casterSide == targetSide;
    }

    /// <summary>
    /// Open-world PvP hostility for UI/aura: opposing city always hostile; same-city only if either
    /// has Attack Mode on without Safe Attack (gray area / free PK) — marked as non-FOE criminal path later.
    /// </summary>
    public static bool IsOpenWorldHostileTarget(GameWorldPlayer attacker, GameWorldPlayer target) {
        if (IsOpposingCityFoe(attacker, target)) {
            return true;
        }
        // Free-for-all when both attack modes and Safe Attack off (classic risk).
        if (attacker.AttackMode && target.AttackMode
            && !attacker.SafeAttackMode && !target.SafeAttackMode) {
            return true;
        }
        return false;
    }

    static string NormalizeCitizenshipSide(string? side) {
        return (side ?? string.Empty).Trim().ToLowerInvariant();
    }
}
