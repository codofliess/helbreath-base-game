using System.Collections.Generic;
using Google.Protobuf.Collections;
using Mmorpg.Network;
using Server.Helpers;
using Server.Utils;
using Server.World;

namespace Server.World.Game;

/// <summary>
/// Player and monster entities that participate in timed temporary effects (buffs/debuffs) and related network broadcasts.
/// </summary>
public abstract class GameWorldActionableEntity : GameWorldEntity {
    /// <summary>Olympia poison tick interval (classic <c>DEF_POISONTIME</c> ≈ 12s).</summary>
    public const int PoisonTickIntervalMs = 12_000;

    protected readonly Dictionary<TemporaryEffectType, ActiveTemporaryEffectSlot> activeTemporaryEffects = new();

    /// <summary>Sum of <see cref="ActiveTemporaryEffectSlot.MovementSpeedModifier"/> across active effects.</summary>
    protected double temporaryEffectMovementSpeedModifierSum;

    /// <summary>Sum of <see cref="ActiveTemporaryEffectSlot.AttackSpeedModifier"/> across active effects.</summary>
    protected double temporaryEffectAttackSpeedModifierSum;

    /// <summary>Sum of <see cref="ActiveTemporaryEffectSlot.CastSpeedModifier"/> across active effects (players only).</summary>
    protected double temporaryEffectCastSpeedModifierSum;

    protected abstract TemporaryEffectEntityKind EntityKind { get; }
    protected abstract long EntityId { get; }

    /// <summary>True when this entity has the given temporary effect (authoritative).</summary>
    public bool HasTemporaryEffect(TemporaryEffectType effectType) {
        return activeTemporaryEffects.ContainsKey(effectType);
    }

    /// <summary>Applies a temporary effect when no effect in the same <paramref name="group"/> is already active; otherwise no-op (no refresh).</summary>
    /// <remarks>Modifiers are additive to 1 for duration: effective ms = base / (1 + sum).</remarks>
    public void ApplyTemporaryEffect(
        GameWorldRef wr,
        TemporaryEffectType effectType,
        int group,
        int durationMs,
        double movementSpeedModifier,
        double attackSpeedModifier,
        double castSpeedModifier,
        int poisonLevel = 0) {
        if (!TemporaryEffects.CanApplyTemporaryEffectInGroup(activeTemporaryEffects, group)) {
            return;
        }

        var timerId = 0;
        var appliedDuration = Math.Max(0, durationMs);
        timerId = wr.Scheduler.SetTimeout(appliedDuration, () => OnTemporaryEffectTimerExpired(wr, effectType, timerId));
        var slot = new ActiveTemporaryEffectSlot {
            Group = group,
            ExpiryTimerId = timerId,
            MovementSpeedModifier = movementSpeedModifier,
            AttackSpeedModifier = attackSpeedModifier,
            CastSpeedModifier = castSpeedModifier,
            PoisonLevel = poisonLevel,
            AppliedAtUnixMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            DurationMs = appliedDuration,
        };
        activeTemporaryEffects[effectType] = slot;
        RecalculateTemporaryEffectSpeedSums();
        BroadcastTemporaryEffectApplied(wr, effectType);

        if (this is GameWorldMonster monster) {
            TimedChallenge.OnMonsterEffectApplied(wr, monster, effectType);
        } else if (this is GameWorldPlayer player) {
            if (effectType is TemporaryEffectType.DefenseShield or TemporaryEffectType.GreatDefenseShield) {
                TimedChallenge.OnPlayerDefenseShieldApplied(wr, player);
            }
            if (effectType is TemporaryEffectType.Invisibility or TemporaryEffectType.ProtectFromArrow) {
                TimedChallenge.OnPlayerBuffApplied(wr, player, effectType);
            }
        }

        if (effectType == TemporaryEffectType.Poison && poisonLevel > 0) {
            StartPoisonTicks(wr, effectType, slot);
        }
    }

    /// <summary>Re-sums modifiers from <see cref="activeTemporaryEffects"/>; <see cref="GameWorldMonster"/> omits cast.</summary>
    protected virtual void RecalculateTemporaryEffectSpeedSums() {
        double m = 0, a = 0, c = 0;
        foreach (var kv in activeTemporaryEffects) {
            m += kv.Value.MovementSpeedModifier;
            a += kv.Value.AttackSpeedModifier;
            c += kv.Value.CastSpeedModifier;
        }

        var prevMovementSum = temporaryEffectMovementSpeedModifierSum;
        temporaryEffectMovementSpeedModifierSum = m;
        temporaryEffectAttackSpeedModifierSum = a;
        temporaryEffectCastSpeedModifierSum = c;

        if (Math.Abs(prevMovementSum - m) > 1e-9) {
            OnTemporaryEffectMovementSpeedModifierSumChanged();
        }
    }

    /// <summary>Called after <see cref="temporaryEffectMovementSpeedModifierSum"/> changes. Players override to reset movement cadence.</summary>
    protected virtual void OnTemporaryEffectMovementSpeedModifierSumChanged() {
    }

    /// <summary>Removes a temporary effect and cancels its expiry timer; optionally notifies viewers.</summary>
    public void RemoveTemporaryEffect(GameWorldRef wr, TemporaryEffectType effectType, bool broadcastExpired) {
        if (!activeTemporaryEffects.TryGetValue(effectType, out var slot)) {
            return;
        }

        wr.Scheduler.ClearTimeout(slot.ExpiryTimerId);
        if (slot.PoisonTickTimerId != 0) {
            wr.Scheduler.ClearInterval(slot.PoisonTickTimerId);
        }

        activeTemporaryEffects.Remove(effectType);
        RecalculateTemporaryEffectSpeedSums();
        if (broadcastExpired) {
            BroadcastTemporaryEffectExpired(wr, effectType);
        }
    }

    /// <summary>Cancels all temporary-effect timers and clears state; emits expire for each (e.g. on death / Cancellation).</summary>
    public void ClearAllTemporaryEffects(GameWorldRef wr) {
        if (activeTemporaryEffects.Count == 0) {
            return;
        }

        var types = new TemporaryEffectType[activeTemporaryEffects.Count];
        activeTemporaryEffects.Keys.CopyTo(types, 0);
        foreach (var et in types) {
            RemoveTemporaryEffect(wr, et, broadcastExpired: true);
        }
    }

    /// <summary>Copies active temporary-effect keys into a protobuf repeated field (visibility snapshots).</summary>
    protected void CopyActiveTemporaryEffectTypesTo(RepeatedField<TemporaryEffectType> dest) {
        ArgumentNullException.ThrowIfNull(dest);
        dest.Clear();
        foreach (var kv in activeTemporaryEffects) {
            dest.Add(kv.Key);
        }
    }

    /// <summary>
    /// Arena DC snapshot: all active buffs (good + bad) with remaining ms for resume on re-login.
    /// </summary>
    public List<Helpers.ArenaPrizeEscrow.BuffSnapshot> SnapshotActiveTemporaryEffectsForArena() {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var list = new List<Helpers.ArenaPrizeEscrow.BuffSnapshot>(activeTemporaryEffects.Count);
        foreach (var kv in activeTemporaryEffects) {
            var slot = kv.Value;
            var elapsed = slot.AppliedAtUnixMs > 0 ? (int)Math.Max(0, now - slot.AppliedAtUnixMs) : 0;
            var remaining = slot.DurationMs > 0
                ? Math.Max(0, slot.DurationMs - elapsed)
                : 1_000; // unknown duration → 1s floor so we do not drop the effect silently
            if (remaining <= 0) {
                continue;
            }
            list.Add(new Helpers.ArenaPrizeEscrow.BuffSnapshot {
                EffectType = (int)kv.Key,
                Group = slot.Group,
                RemainingMs = remaining,
                MovementSpeedModifier = slot.MovementSpeedModifier,
                AttackSpeedModifier = slot.AttackSpeedModifier,
                CastSpeedModifier = slot.CastSpeedModifier,
                PoisonLevel = slot.PoisonLevel,
            });
        }
        return list;
    }

    private void StartPoisonTicks(GameWorldRef wr, TemporaryEffectType effectType, ActiveTemporaryEffectSlot slot) {
        var poisonLevel = slot.PoisonLevel;
        var tickId = wr.Scheduler.SetInterval(PoisonTickIntervalMs, () => {
            if (!activeTemporaryEffects.TryGetValue(effectType, out var current) || current.PoisonLevel <= 0) {
                return;
            }

            TemporaryEffects.ApplyPoisonTickDamage(wr, this, current.PoisonLevel);
        });
        slot.PoisonTickTimerId = tickId;
        // First tick after one interval (Olympia waits DEF_POISONTIME from apply).
        _ = poisonLevel;
    }

    private void OnTemporaryEffectTimerExpired(GameWorldRef wr, TemporaryEffectType effectType, int expectedTimerId) {
        if (!activeTemporaryEffects.TryGetValue(effectType, out var slot) || slot.ExpiryTimerId != expectedTimerId) {
            return;
        }

        if (slot.PoisonTickTimerId != 0) {
            wr.Scheduler.ClearInterval(slot.PoisonTickTimerId);
        }

        activeTemporaryEffects.Remove(effectType);
        RecalculateTemporaryEffectSpeedSums();
        BroadcastTemporaryEffectExpired(wr, effectType);
    }

    /// <summary>Effective movement/attack/cast ms after debuffs for network payloads.</summary>
    protected abstract int GetEffectiveMovementSpeedMsForBroadcast();

    protected abstract int GetEffectiveAttackSpeedMsForBroadcast();

    protected abstract int? GetEffectiveCastSpeedMsForBroadcast();

    private void BroadcastTemporaryEffectApplied(GameWorldRef wr, TemporaryEffectType effectType) {
        var message = NetworkManager.CreateTemporaryEffectApplied(
            EntityKind,
            EntityId,
            effectType,
            GetEffectiveMovementSpeedMsForBroadcast(),
            GetEffectiveAttackSpeedMsForBroadcast(),
            GetEffectiveCastSpeedMsForBroadcast());
        foreach (var recipient in wr.PlayerSpatialGrid.GetNearbyPlayers(PosX, PosY, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(recipient, message);
        }
    }

    private void BroadcastTemporaryEffectExpired(GameWorldRef wr, TemporaryEffectType effectType) {
        var message = NetworkManager.CreateTemporaryEffectExpired(
            EntityKind,
            EntityId,
            effectType,
            GetEffectiveMovementSpeedMsForBroadcast(),
            GetEffectiveAttackSpeedMsForBroadcast(),
            GetEffectiveCastSpeedMsForBroadcast());
        foreach (var recipient in wr.PlayerSpatialGrid.GetNearbyPlayers(PosX, PosY, excludeDisconnected: true)) {
            NetworkManager.SendToPlayer(recipient, message);
        }
    }
}
