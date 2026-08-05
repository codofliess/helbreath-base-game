using Mmorpg.Network;

namespace Server.Utils;

/// <summary>
/// Classifies WebSocket messages for single-connection priority queues.
/// High = combat / movement / vitals (must not sit behind chat, auction, inventory bulk).
/// Normal = meta / economy / UI.
/// Toggle via Settings <c>enableMessagePriorityQueue</c> (rollback: set false).
/// </summary>
public static class NetworkPriority {
    public enum Class : byte {
        High = 0,
        Normal = 1,
    }

    /// <summary>Outbound server→client: combat state before chat/market/warehouse noise.</summary>
    public static Class ClassifyOutbound(ServerMessage message) {
        return message.PayloadCase switch {
            // Keepalive + join bootstrap
            ServerMessage.PayloadOneofCase.PingResponse => Class.High,
            ServerMessage.PayloadOneofCase.InitialState => Class.High,
            ServerMessage.PayloadOneofCase.InitialGameWorldState => Class.High,
            ServerMessage.PayloadOneofCase.WorldsList => Class.High,
            ServerMessage.PayloadOneofCase.MonstersList => Class.High,

            // Movement / presence
            ServerMessage.PayloadOneofCase.PlayerMoved => Class.High,
            ServerMessage.PayloadOneofCase.PlayerMovementStateChanged => Class.High,
            ServerMessage.PayloadOneofCase.PositionCorrected => Class.High,
            ServerMessage.PayloadOneofCase.ResetPosition => Class.High,
            ServerMessage.PayloadOneofCase.PlayersEnteredRange => Class.High,
            ServerMessage.PayloadOneofCase.PlayersLeftRange => Class.High,
            ServerMessage.PayloadOneofCase.PlayerTeleported => Class.High,
            ServerMessage.PayloadOneofCase.PlayerIdleDirectionChanged => Class.High,
            ServerMessage.PayloadOneofCase.PlayerReconnected => Class.High,
            ServerMessage.PayloadOneofCase.PlayerDisconnected => Class.High,

            // Combat / spells / vitals / CC
            ServerMessage.PayloadOneofCase.MonsterMoved => Class.High,
            ServerMessage.PayloadOneofCase.MonstersEnteredRange => Class.High,
            ServerMessage.PayloadOneofCase.MonstersLeftRange => Class.High,
            ServerMessage.PayloadOneofCase.MonsterAttacked => Class.High,
            ServerMessage.PayloadOneofCase.MonsterAttackedMonster => Class.High,
            ServerMessage.PayloadOneofCase.PlayerAttackedMonster => Class.High,
            ServerMessage.PayloadOneofCase.PlayerAttackedPlayer => Class.High,
            ServerMessage.PayloadOneofCase.PlayerReceiveDamage => Class.High,
            ServerMessage.PayloadOneofCase.PlayerTakeDamage => Class.High,
            ServerMessage.PayloadOneofCase.MonsterTakeDamage => Class.High,
            ServerMessage.PayloadOneofCase.MonsterTakeDamageByMonster => Class.High,
            ServerMessage.PayloadOneofCase.HpUpdated => Class.High,
            ServerMessage.PayloadOneofCase.MonsterDied => Class.High,
            ServerMessage.PayloadOneofCase.PlayerDied => Class.High,
            ServerMessage.PayloadOneofCase.PlayerResurrected => Class.High,
            ServerMessage.PayloadOneofCase.SpellCastStarted => Class.High,
            ServerMessage.PayloadOneofCase.SpellCastCancelled => Class.High,
            ServerMessage.PayloadOneofCase.SpellCastFailed => Class.High,
            ServerMessage.PayloadOneofCase.CastAoeSpell => Class.High,
            ServerMessage.PayloadOneofCase.CastDirectionalAoeSpell => Class.High,
            ServerMessage.PayloadOneofCase.MonsterCastAoeSpell => Class.High,
            ServerMessage.PayloadOneofCase.MonsterCastDirectionalAoeSpell => Class.High,
            ServerMessage.PayloadOneofCase.CastEffect => Class.High,
            ServerMessage.PayloadOneofCase.TemporaryEffectApplied => Class.High,
            ServerMessage.PayloadOneofCase.TemporaryEffectExpired => Class.High,
            ServerMessage.PayloadOneofCase.PlayerParalyzed => Class.High,
            ServerMessage.PayloadOneofCase.SpawnProtectionEnabled => Class.High,
            ServerMessage.PayloadOneofCase.SpawnProtectionDisabled => Class.High,
            ServerMessage.PayloadOneofCase.PlayerAttackModeChanged => Class.High,
            ServerMessage.PayloadOneofCase.PlayerSafeAttackModeChanged => Class.High,
            ServerMessage.PayloadOneofCase.PlayerBowStancePerformed => Class.High,
            ServerMessage.PayloadOneofCase.PlayerPickupPerformed => Class.High,
            ServerMessage.PayloadOneofCase.EnemyKillAwarded => Class.High,
            ServerMessage.PayloadOneofCase.GroundStatesEnteredRange => Class.High,
            ServerMessage.PayloadOneofCase.GroundStatesLeftRange => Class.High,
            ServerMessage.PayloadOneofCase.NpcsEnteredRange => Class.High,
            ServerMessage.PayloadOneofCase.NpcsLeftRange => Class.High,

            // Equip can gate casting — keep high so bag spam cannot delay weapon updates mid-fight
            ServerMessage.PayloadOneofCase.ItemEquipped => Class.High,
            ServerMessage.PayloadOneofCase.ItemUnequipped => Class.High,
            ServerMessage.PayloadOneofCase.ItemLifeSpanUpdated => Class.High,

            // Everything else: chat, auction, warehouse, progression dumps, mining UI, etc.
            _ => Class.Normal,
        };
    }

    /// <summary>
    /// Inbound client→server classification (for future dual-receive queue).
    /// Equip/consume stay High so cast after equip is not reordered behind combat.
    /// </summary>
    public static Class ClassifyInbound(ClientMessage message) {
        return message.PayloadCase switch {
            ClientMessage.PayloadOneofCase.PingRequest => Class.High,
            ClientMessage.PayloadOneofCase.RequestMovement => Class.High,
            ClientMessage.PayloadOneofCase.MakeServerCellOccupiedRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerMovementStateChangeRequest => Class.High,
            ClientMessage.PayloadOneofCase.ChangePlayerIdleDirectionRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerAttackModeChangeRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerSafeAttackModeChangeRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerAttackedMonsterRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerAttackedPlayerRequest => Class.High,
            ClientMessage.PayloadOneofCase.SpellCastStartRequest => Class.High,
            ClientMessage.PayloadOneofCase.SpellCastCancelRequest => Class.High,
            ClientMessage.PayloadOneofCase.SpellCastRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerResurrectedRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerBowStanceRequested => Class.High,
            ClientMessage.PayloadOneofCase.PlayerPickupRequested => Class.High,
            ClientMessage.PayloadOneofCase.PlayerItemPickupRequested => Class.High,
            ClientMessage.PayloadOneofCase.PlayerItemDropRequested => Class.High,
            ClientMessage.PayloadOneofCase.EquipItemRequest => Class.High,
            ClientMessage.PayloadOneofCase.UnequipItemRequest => Class.High,
            ClientMessage.PayloadOneofCase.ConsumeItemRequest => Class.High,
            ClientMessage.PayloadOneofCase.WorldChangeRequest => Class.High,
            ClientMessage.PayloadOneofCase.PlayerTeleportRequested => Class.High,
            ClientMessage.PayloadOneofCase.AuthenticateRequest => Class.High,
            ClientMessage.PayloadOneofCase.LogoutRequest => Class.High,
            ClientMessage.PayloadOneofCase.LogoutCancelledRequest => Class.High,
            _ => Class.Normal,
        };
    }
}
