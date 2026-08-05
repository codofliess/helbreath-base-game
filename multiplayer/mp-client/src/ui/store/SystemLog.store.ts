import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    HP_UPDATED_RECEIVED,
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    OUT_UI_PLAYER_DIED,
    PARTY_STATE_RECEIVED,
    SERVER_ITEM_ADDED_TO_BAG_RECEIVED,
    SERVER_MESSAGE_RECEIVED,
    SYSTEM_LOG_APPEND,
    TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED,
    type SystemLogAppendPayload,
    type SystemLogLineKind,
} from '../../constants/EventNames';
import { getItemById, type InventoryItem } from '../../constants/Items';
import { getOlympiaItemDisplay } from '../../constants/OlympiaItemName';
import { evaluateOlympiaNftTier } from '../../utils/olympiaDropRules';
import { TemporaryEffectType } from '../../Types';
import type { PartyState } from '../../proto/generated/network';
import type { InitialGameWorldStateEventData, TemporaryEffectPlayerEventData } from '../../Types';

const MAX_LINES = 48;
const LOW_HP_RATIO = 0.2;
/** On-screen combat/event lines (HP, level-up, etc.) — 3s from appear, then gone. */
export const SYSTEM_LOG_LINE_TTL_MS = 3_000;

export interface SystemLogLine {
    id: number;
    message: string;
    kind: SystemLogLineKind;
    createdAtMs: number;
}

interface SystemLogStoreState {
    lines: SystemLogLine[];
    nextId: number;
    selfPlayerId: string | null;
    lastHp: number | null;
    lastMaxHp: number | null;
    lowHpWarned: boolean;
}

const initialState: SystemLogStoreState = {
    lines: [],
    nextId: 1,
    selfPlayerId: null,
    lastHp: null,
    lastMaxHp: null,
    lowHpWarned: false,
};

export const systemLogStore = new Store<SystemLogStoreState>(initialState);

/** Drop lines older than {@link SYSTEM_LOG_LINE_TTL_MS}. */
export function pruneExpiredSystemLogLines(nowMs: number = Date.now()): void {
    systemLogStore.setState((s) => {
        const lines = s.lines.filter((line) => nowMs - line.createdAtMs < SYSTEM_LOG_LINE_TTL_MS);
        if (lines.length === s.lines.length) {
            return s;
        }
        return { ...s, lines };
    });
}

/** Push a colored line into the Olympia-style system/combat log (auto-clears after 5s). */
export function appendSystemLog(message: string, kind: SystemLogLineKind = 'event'): void {
    const trimmed = message.trim();
    if (!trimmed) {
        return;
    }
    const now = Date.now();
    systemLogStore.setState((s) => {
        const line: SystemLogLine = {
            id: s.nextId,
            message: trimmed,
            kind,
            createdAtMs: now,
        };
        const lines = [...s.lines, line].filter((l) => now - l.createdAtMs < SYSTEM_LOG_LINE_TTL_MS);
        if (lines.length > MAX_LINES) {
            lines.splice(0, lines.length - MAX_LINES);
        }
        return { ...s, lines, nextId: s.nextId + 1 };
    });
}

/** Clears combat log lines and HP tracking on logout. */
export function resetSystemLogStore(): void {
    systemLogStore.setState(() => ({ ...initialState }));
}

function effectApplyMessage(effectType: number): { message: string; kind: SystemLogLineKind } | undefined {
    switch (effectType) {
        case TemporaryEffectType.Poison:
            return { message: 'You were poisoned!', kind: 'warning' };
        case TemporaryEffectType.Chill:
            return {
                message: 'You have been frozen! Your movement decreases to 50%.',
                kind: 'event',
            };
        case TemporaryEffectType.Paralyze:
            return { message: 'You have been paralyzed!', kind: 'warning' };
        case TemporaryEffectType.ProtectFromMagic:
            return { message: 'You are completely protected from magic!', kind: 'event' };
        case TemporaryEffectType.AbsoluteMagicProtect:
            return { message: 'You are completely protected from magic!', kind: 'event' };
        case TemporaryEffectType.DefenseShield:
        case TemporaryEffectType.GreatDefenseShield:
            return { message: 'Defense Shield activated!', kind: 'heal' };
        case TemporaryEffectType.Berserk:
            return { message: 'Berserk!', kind: 'event' };
        case TemporaryEffectType.Haste:
            return { message: 'Haste!', kind: 'event' };
        case TemporaryEffectType.Invisibility:
            return { message: 'You are invisible.', kind: 'event' };
        default:
            return undefined;
    }
}

function effectExpireMessage(effectType: number): { message: string; kind: SystemLogLineKind } | undefined {
    switch (effectType) {
        case TemporaryEffectType.Poison:
            return { message: 'You are no longer poisoned.', kind: 'event' };
        case TemporaryEffectType.Chill:
            return { message: 'You are no longer frozen.', kind: 'event' };
        case TemporaryEffectType.Paralyze:
            return { message: 'You are no longer paralyzed.', kind: 'event' };
        case TemporaryEffectType.ProtectFromMagic:
        case TemporaryEffectType.AbsoluteMagicProtect:
            return { message: 'Magic protection has worn off.', kind: 'event' };
        case TemporaryEffectType.Invisibility:
            return { message: 'You are no longer invisible.', kind: 'event' };
        case TemporaryEffectType.Haste:
            return { message: 'Haste has worn off.', kind: 'event' };
        default:
            return undefined;
    }
}

EventBus.on(SYSTEM_LOG_APPEND, (payload: SystemLogAppendPayload) => {
    const kind = payload.kind ?? (payload.message.trim().toLowerCase().startsWith('tip:') ? 'tip' : 'event');
    appendSystemLog(payload.message, kind);
});

EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, (data: InitialGameWorldStateEventData) => {
    systemLogStore.setState((s) => ({
        ...s,
        selfPlayerId: data.playerId,
        lastHp: null,
        lastMaxHp: null,
        lowHpWarned: false,
    }));
});

EventBus.on(HP_UPDATED_RECEIVED, (data: { hp: number; maxHp: number }) => {
    const prev = systemLogStore.state;
    const prevHp = prev.lastHp;
    const delta = prevHp === null ? 0 : data.hp - prevHp;

    systemLogStore.setState((s) => ({
        ...s,
        lastHp: data.hp,
        lastMaxHp: data.maxHp,
    }));

    if (prevHp === null) {
        return;
    }

    if (delta < 0) {
        appendSystemLog(`HP has been decreased by ${Math.abs(delta)}points.`, 'damage');
        const ratio = data.maxHp > 0 ? data.hp / data.maxHp : 1;
        if (ratio <= LOW_HP_RATIO && !systemLogStore.state.lowHpWarned) {
            appendSystemLog('Warning! HP is very low. Danger!!', 'warning');
            systemLogStore.setState((s) => ({ ...s, lowHpWarned: true }));
        }
    } else if (delta > 0) {
        appendSystemLog(`HP has been increased by ${delta}points.`, 'heal');
        if (data.maxHp > 0 && data.hp / data.maxHp > LOW_HP_RATIO) {
            systemLogStore.setState((s) => ({ ...s, lowHpWarned: false }));
        }
    }
});

EventBus.on(SERVER_ITEM_ADDED_TO_BAG_RECEIVED, (payload: { item: InventoryItem }) => {
    const item = payload.item;
    const def = getItemById(item.itemId);
    const attr = item.itemAttribute ?? 0;
    const color = item.itemColor ?? 0;
    const name = def
        ? getOlympiaItemDisplay(def.name, attr, color, def.itemType).name
        : `Item #${item.itemId}`;
    const qty = item.quantity && item.quantity > 1 ? ` x${item.quantity}` : '';
    const tier = evaluateOlympiaNftTier(item.itemId, attr);
    const tierTag = tier === 'super_rare' ? ' [Legendary]' : tier === 'rare' ? ' [Rare]' : '';
    // All pickups go to communications; rare/legendary use warning (hot) color.
    appendSystemLog(
        `You got a ${name}${qty}${tierTag}.`,
        tier === 'super_rare' ? 'warning' : tier === 'rare' ? 'tip' : 'event',
    );
});

EventBus.on(PARTY_STATE_RECEIVED, (data: PartyState) => {
    if (data.message) {
        appendSystemLog(data.message, 'event');
    }
});

EventBus.on(SERVER_MESSAGE_RECEIVED, (data: { message: string }) => {
    if (!data.message) {
        return;
    }
    const lower = data.message.toLowerCase();
    const kind: SystemLogLineKind =
        lower.startsWith('tip:') ? 'tip' : lower.includes('warning') || lower.includes('danger') ? 'warning' : 'event';
    appendSystemLog(data.message, kind);
});

EventBus.on(OUT_UI_PLAYER_DIED, (data: { killerName?: string }) => {
    const killer = data.killerName?.trim();
    appendSystemLog(
        killer
            ? `You have died! Killed by ${killer}.`
            : 'You have died! Click the restart button…',
        'warning',
    );
});

EventBus.on(TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED, (data: TemporaryEffectPlayerEventData) => {
    const selfId = systemLogStore.state.selfPlayerId;
    if (!selfId || data.playerId !== selfId) {
        return;
    }
    const mapped = effectApplyMessage(data.temporaryEffectType);
    if (mapped) {
        appendSystemLog(mapped.message, mapped.kind);
    }
});

EventBus.on(TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED, (data: TemporaryEffectPlayerEventData) => {
    const selfId = systemLogStore.state.selfPlayerId;
    if (!selfId || data.playerId !== selfId) {
        return;
    }
    const mapped = effectExpireMessage(data.temporaryEffectType);
    if (mapped) {
        appendSystemLog(mapped.message, mapped.kind);
    }
});
