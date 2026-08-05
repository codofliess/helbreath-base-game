using Mmorpg.Network;
using Server.Utils;
using Server.World.Game;

namespace Server.Helpers;

/// <summary>
/// Olympia player special abilities (Merien Shield/Plate, Xelima weapons, Ice Elemental Sword, …).
/// Equip sets the ability; Page Up activates it for <see cref="ItemSpecialAbilityCatalog.SpecAbility.ActiveDurationSec"/>,
/// then <see cref="ItemSpecialAbilityCatalog.CooldownSeconds"/> cooldown.
/// </summary>
public static class SpecialAbility {
    /// <summary>status codes matching Olympia DEF_NOTIFY_SPECIALABILITYSTATUS sV1.</summary>
    public const int StatusActivated = 1;
    public const int StatusSet = 2;
    public const int StatusExpired = 3;
    public const int StatusReleased = 4;
    public const int StatusReady = 5;

    public static void HandleActivateRequest(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        Tick(wr, player);

        if (player.SpecialAbilityType == 0) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "No special ability equipped. Equip Merien Shield/Plate, Xelima weapon, or Ice Sword."));
            return;
        }
        if (player.IsSpecialAbilityActive) {
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "Special ability is already active."));
            return;
        }
        if (!player.IsSpecialAbilityCooldownReady) {
            var left = player.SpecialAbilityCooldownRemainingSec;
            var msg = left >= 60
                ? $"Special ability available in {left / 60} minute(s)."
                : $"Special ability available in {left} second(s).";
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(msg));
            return;
        }

        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var durationSec = Math.Max(1, player.SpecialAbilityDurationSec);
        // Arena Merien override (e.g. 20s / 5 min) when kit set a custom CD.
        var cooldownSec = player.ArenaSpecialAbilityCooldownSec > 0
            ? player.ArenaSpecialAbilityCooldownSec
            : ItemSpecialAbilityCatalog.CooldownSeconds;
        player.ActivateSpecialAbility(nowMs, durationSec, cooldownSec);

        SendStatus(player, StatusActivated, player.SpecialAbilityType, durationSec);
        FanActivationVfx(wr, player);

        var label = DescribeType(player.SpecialAbilityType);
        var cdLabel = cooldownSec >= 60 ? $"{cooldownSec / 60} min" : $"{cooldownSec}s";
        NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
            $"Special ability activated! {label} for {durationSec}s. Cooldown {cdLabel}."));
    }

    /// <summary>Recompute SA from currently equipped gear; notify on change.</summary>
    public static void RecomputeFromEquipment(GameWorldRef wr, GameWorldPlayer player, bool notify) {
        ArgumentNullException.ThrowIfNull(player);
        ItemSpecialAbilityCatalog.EnsureLoaded();

        var prevType = player.SpecialAbilityType;
        int bestType = 0;
        int bestDuration = 0;
        string? bestSlot = null;
        // Prefer the most recently considered equip: defense SA and attack SA both valid;
        // if both weapon + shield equipped, Olympia uses the last CalcTotal path —
        // we prefer defense shield/armor over weapon when both present (classic equip order).
        ItemSpecialAbilityCatalog.SpecAbility? attackSa = null;
        string? attackSlot = null;
        ItemSpecialAbilityCatalog.SpecAbility? defenseSa = null;
        string? defenseSlot = null;

        foreach (var (slot, item) in player.InventoryManager.EquippedItems) {
            if (item is null || item.CurLifeSpan <= 0) {
                continue;
            }
            if (!ItemSpecialAbilityCatalog.TryGet(item.ItemId, out var sa)) {
                continue;
            }
            if (sa.IsDefense) {
                defenseSa = sa;
                defenseSlot = slot;
            } else {
                attackSa = sa;
                attackSlot = slot;
            }
        }

        // If both, keep whichever was set — Olympia can only have one type; prefer currently active family,
        // else prefer defense (Merien) when both equipped, else attack.
        if (defenseSa is { } d && attackSa is { } a) {
            if (prevType is ItemSpecialAbilityCatalog.TypeBreakWeapon
                or ItemSpecialAbilityCatalog.TypeBodyGuard
                or ItemSpecialAbilityCatalog.TypeUntouchable) {
                bestType = d.AbilityType;
                bestDuration = d.ActiveDurationSec;
                bestSlot = defenseSlot;
            } else if (prevType is >= 1 and <= 5) {
                bestType = a.AbilityType;
                bestDuration = a.ActiveDurationSec;
                bestSlot = attackSlot;
            } else {
                bestType = d.AbilityType;
                bestDuration = d.ActiveDurationSec;
                bestSlot = defenseSlot;
            }
        } else if (defenseSa is { } onlyDef) {
            bestType = onlyDef.AbilityType;
            bestDuration = onlyDef.ActiveDurationSec;
            bestSlot = defenseSlot;
        } else if (attackSa is { } onlyAtk) {
            bestType = onlyAtk.AbilityType;
            bestDuration = onlyAtk.ActiveDurationSec;
            bestSlot = attackSlot;
        }

        if (bestType != prevType) {
            if (player.IsSpecialAbilityActive) {
                player.ClearSpecialAbilityActive();
                if (notify) {
                    SendStatus(player, StatusExpired, 0, ItemSpecialAbilityCatalog.CooldownSeconds);
                }
            }
            player.SetSpecialAbilityEquipped(bestType, bestDuration, bestSlot);
            if (notify) {
                if (bestType == 0) {
                    SendStatus(player, StatusReleased, 0, 0);
                    NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                        "Special ability has been released."));
                } else {
                    var cd = player.SpecialAbilityCooldownRemainingSec;
                    SendStatus(player, StatusSet, bestType, cd);
                    NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                        $"Special ability has been set! ({DescribeType(bestType)})"));
                }
            }
        } else {
            player.SetSpecialAbilityEquipped(bestType, bestDuration, bestSlot);
        }
    }

    /// <summary>Expire active window and notify when cooldown reaches 0.</summary>
    public static void Tick(GameWorldRef wr, GameWorldPlayer player) {
        ArgumentNullException.ThrowIfNull(player);
        var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        if (player.TryExpireSpecialAbility(nowMs, out var justExpired) && justExpired) {
            var cdLeft = player.SpecialAbilityCooldownRemainingSec;
            SendStatus(player, StatusExpired, 0, cdLeft);
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                cdLeft >= 60
                    ? $"Special ability has run out! Will be available in {cdLeft / 60} minutes."
                    : $"Special ability has run out! Will be available in {cdLeft} seconds."));
        }
        if (player.TryMarkSpecialAbilityReady(nowMs)) {
            SendStatus(player, StatusReady, player.SpecialAbilityType, 0);
            NetworkManager.SendToPlayer(player, NetworkManager.CreateSendMessage(
                "Special ability is ready! Press Page Up to activate."));
        }
    }

    /// <summary>Attacker SA modifies outgoing melee damage / applies on-hit effects.</summary>
    public static int ModifyOutgoingMeleeDamage(
        GameWorldRef wr,
        GameWorldPlayer attacker,
        GameWorldActionableEntity target,
        int damage) {
        if (!attacker.IsSpecialAbilityActive || damage <= 0) {
            return damage;
        }

        var targetHp = target switch {
            GameWorldPlayer p => p.Hp,
            GameWorldMonster m => m.Hp,
            _ => 0,
        };

        switch (attacker.SpecialAbilityType) {
            case ItemSpecialAbilityCatalog.TypeHalfHp: {
                var half = Math.Max(1, targetHp / 2);
                if (half > damage) {
                    damage = half;
                }
                break;
            }
            case ItemSpecialAbilityCatalog.TypeExecute:
                damage = Math.Max(damage, targetHp);
                break;
            case ItemSpecialAbilityCatalog.TypeFreeze:
                if (target is GameWorldPlayer tp && !tp.HasTemporaryEffect(TemporaryEffectType.Chill)) {
                    tp.ApplyTemporaryEffect(wr, TemporaryEffectType.Chill, group: 2, durationMs: 30_000,
                        movementSpeedModifier: -0.5, attackSpeedModifier: 0, castSpeedModifier: 0);
                } else if (target is GameWorldMonster tm && !tm.HasTemporaryEffect(TemporaryEffectType.Chill)) {
                    tm.ApplyTemporaryEffect(wr, TemporaryEffectType.Chill, group: 2, durationMs: 30_000,
                        movementSpeedModifier: -0.5, attackSpeedModifier: 0, castSpeedModifier: 0);
                }
                break;
            case ItemSpecialAbilityCatalog.TypeParalyze:
                if (target is GameWorldPlayer tpp && !tpp.HasTemporaryEffect(TemporaryEffectType.Paralyze)) {
                    tpp.ApplyTemporaryEffect(wr, TemporaryEffectType.Paralyze, group: 3, durationMs: 10_000,
                        movementSpeedModifier: 0, attackSpeedModifier: 0, castSpeedModifier: 0);
                } else if (target is GameWorldMonster tmm && !tmm.HasTemporaryEffect(TemporaryEffectType.Paralyze)) {
                    tmm.ApplyTemporaryEffect(wr, TemporaryEffectType.Paralyze, group: 3, durationMs: 10_000,
                        movementSpeedModifier: 0, attackSpeedModifier: 0, castSpeedModifier: 0);
                }
                break;
            case ItemSpecialAbilityCatalog.TypeLifesteal: {
                var heal = Math.Max(1, damage);
                attacker.ApplyHeal(heal);
                NetworkManager.SendToPlayer(attacker, NetworkManager.CreateHpUpdated(attacker.Hp, attacker.MaxHp));
                Party.NotifyVitalsChanged(attacker);
                break;
            }
        }

        return damage;
    }

    /// <summary>Defender SA reduces or nullifies incoming physical damage; may break attacker weapon.</summary>
    public static int ModifyIncomingPhysicalDamage(
        GameWorldRef wr,
        GameWorldPlayer? attacker,
        GameWorldPlayer defender,
        int damage) {
        if (!defender.IsSpecialAbilityActive || damage <= 0) {
            return damage;
        }

        switch (defender.SpecialAbilityType) {
            case ItemSpecialAbilityCatalog.TypeUntouchable:
            case ItemSpecialAbilityCatalog.TypeBodyGuard:
                // BodyGuard ideally zeros only hits on the SA equip slot; without hit-location we treat as full block.
                return 0;
            case ItemSpecialAbilityCatalog.TypeBreakWeapon:
                if (attacker is not null) {
                    TryBreakAttackerWeapon(wr, attacker);
                }
                break;
        }

        return damage;
    }

    /// <summary>Magic damage: Merien Shield (52) / BodyGuard (51) block while active (Olympia).</summary>
    public static bool BlocksMagicDamage(GameWorldPlayer defender) {
        if (!defender.IsSpecialAbilityActive) {
            return false;
        }
        return defender.SpecialAbilityType is ItemSpecialAbilityCatalog.TypeUntouchable
            or ItemSpecialAbilityCatalog.TypeBodyGuard;
    }

    static void TryBreakAttackerWeapon(GameWorldRef wr, GameWorldPlayer attacker) {
        if (!attacker.InventoryManager.TryBreakEquippedWeaponDurability(out var mutation, out var broken) || broken is null) {
            return;
        }
        NetworkManager.SendToPlayer(
            attacker,
            NetworkManager.CreateItemLifeSpanUpdated(broken.ItemUid, broken.CurLifeSpan, broken.MaxLifeSpan));
        if (mutation.Unequipped.Count > 0 || mutation.AddedToBag.Count > 0) {
            Inventory.ApplyInventoryMutation(wr, attacker, mutation);
        }
        NetworkManager.SendToPlayer(attacker, NetworkManager.CreateSendMessage(
            "Your weapon was destroyed by Merien Plate!"));
    }

    static void FanActivationVfx(GameWorldRef wr, GameWorldPlayer player) {
        var key = player.SpecialAbilityType switch {
            ItemSpecialAbilityCatalog.TypeUntouchable => "merien-shield-activation",
            ItemSpecialAbilityCatalog.TypeBreakWeapon or ItemSpecialAbilityCatalog.TypeBodyGuard
                => "merien-shield-activation",
            _ => "weapon-special-power-activation-1",
        };
        var fx = NetworkManager.CreateCastEffect(wr.WorldId, key, player.PosX, player.PosY);
        NetworkManager.SendToPlayer(player, fx);
        foreach (var nearby in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearby, fx);
        }
        // Also notify status to nearby for optional client-side glow.
        var status = CreateStatusMessage(StatusActivated, player.SpecialAbilityType, player.SpecialAbilityDurationSec, player.PlayerId);
        foreach (var nearby in wr.PlayerSpatialGrid.GetNearbyPlayers(player.PosX, player.PosY, player.SessionId)) {
            NetworkManager.SendToPlayer(nearby, status);
        }
    }

    public static void SendStatus(GameWorldPlayer player, int status, int abilityType, int durationOrCooldownSec) {
        NetworkManager.SendToPlayer(
            player,
            CreateStatusMessage(status, abilityType, durationOrCooldownSec, player.PlayerId));
    }

    static ServerMessage CreateStatusMessage(int status, int abilityType, int durationOrCooldownSec, long playerId) {
        return new ServerMessage {
            SpecialAbilityStatus = new SpecialAbilityStatus {
                Status = status,
                AbilityType = abilityType,
                DurationOrCooldownSec = durationOrCooldownSec,
                PlayerId = playerId,
            },
        };
    }

    public static string DescribeType(int type) => type switch {
        ItemSpecialAbilityCatalog.TypeHalfHp => "Xelima (half HP strike)",
        ItemSpecialAbilityCatalog.TypeFreeze => "Ice Elemental (freeze)",
        ItemSpecialAbilityCatalog.TypeParalyze => "Paralyze strike",
        ItemSpecialAbilityCatalog.TypeExecute => "Execute",
        ItemSpecialAbilityCatalog.TypeLifesteal => "Lifesteal",
        ItemSpecialAbilityCatalog.TypeBreakWeapon => "Merien Plate (break weapon)",
        ItemSpecialAbilityCatalog.TypeBodyGuard => "Body guard",
        ItemSpecialAbilityCatalog.TypeUntouchable => "Merien Shield (untouchable)",
        _ => $"type {type}",
    };
}
