import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    PLAYER_JOINED_RECEIVED,
    PLAYER_LEFT_RECEIVED,
    PLAYER_MOVED_RECEIVED,
    OUT_UI_MINIMAP_LOADING,
    TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED,
    TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED,
} from '../../constants/EventNames';
import type { NetworkPlayer, PlayerMovedEventData } from '../../Types';
import { TemporaryEffectType } from '../../Types';
import type { MinimapLoadingPayload } from './MinimapDialog.store';

/** Remote player pin for the guide-map overlay (world grid cells). */
export interface MinimapPlayerPin {
    playerId: string;
    name: string;
    x: number;
    y: number;
}

interface MinimapEntitiesState {
    /** Current map basename (e.g. aresden) for hunt-pit lookup. */
    mapName: string;
    /** Other players currently in view (updated from network). */
    players: MinimapPlayerPin[];
}

const initialState: MinimapEntitiesState = {
    mapName: '',
    players: [],
};

export const minimapEntitiesStore = new Store<MinimapEntitiesState>(initialState);

function upsertPlayer(pin: MinimapPlayerPin): void {
    minimapEntitiesStore.setState((s) => {
        const next = s.players.filter((p) => p.playerId !== pin.playerId);
        next.push(pin);
        return { ...s, players: next };
    });
}

function removePlayers(ids: string[]): void {
    if (ids.length === 0) {
        return;
    }
    const drop = new Set(ids);
    minimapEntitiesStore.setState((s) => ({
        ...s,
        players: s.players.filter((p) => !drop.has(p.playerId)),
    }));
}

EventBus.on(OUT_UI_MINIMAP_LOADING, (payload: MinimapLoadingPayload) => {
    const mapName = (payload.mapName || '').replace(/\.amd$/i, '');
    minimapEntitiesStore.setState((s) => ({
        ...s,
        mapName,
        // Clear remote pins on map change (new world view).
        players: [],
    }));
});

EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, (data: { mapName?: string; gameWorldId?: string } | undefined) => {
    const fromState = (data?.mapName || data?.gameWorldId || '').replace(/\.amd$/i, '');
    minimapEntitiesStore.setState((s) => ({
        ...s,
        // Keep mapName if payload omitted it (avoid empty → no pit markers).
        mapName: fromState || s.mapName,
        players: [],
    }));
});

function playerIsInvisible(p: NetworkPlayer): boolean {
    const fx = p.activeTemporaryEffects ?? [];
    return fx.includes(TemporaryEffectType.Invisibility);
}

EventBus.on(PLAYER_JOINED_RECEIVED, (batch: NetworkPlayer[]) => {
    for (const p of batch) {
        const name = (p.characterName || '').trim();
        if (!name) {
            continue;
        }
        // Hidden from minimap while invisible (Insk: pin reveals invi).
        if (playerIsInvisible(p)) {
            removePlayers([p.playerId]);
            continue;
        }
        upsertPlayer({
            playerId: p.playerId,
            name,
            x: p.x,
            y: p.y,
        });
    }
});

EventBus.on(TEMPORARY_EFFECT_APPLIED_FOR_PLAYER_RECEIVED, (data: { playerId: string; temporaryEffectType: number }) => {
    if (data.temporaryEffectType === TemporaryEffectType.Invisibility) {
        removePlayers([data.playerId]);
    }
});

EventBus.on(TEMPORARY_EFFECT_EXPIRED_FOR_PLAYER_RECEIVED, (data: { playerId: string; temporaryEffectType: number }) => {
    // Pin returns on next PLAYER_MOVED / join sync; no re-add without coords here.
    void data;
});

EventBus.on(PLAYER_MOVED_RECEIVED, (data: PlayerMovedEventData) => {
    minimapEntitiesStore.setState((s) => {
        const idx = s.players.findIndex((p) => p.playerId === data.playerId);
        if (idx < 0) {
            return s;
        }
        const players = s.players.slice();
        const cur = players[idx];
        players[idx] = {
            ...cur,
            x: data.destX,
            y: data.destY,
        };
        return { ...s, players };
    });
});

EventBus.on(PLAYER_LEFT_RECEIVED, (payload: { playerId: string } | string[]) => {
    if (Array.isArray(payload)) {
        removePlayers(payload.map(String));
        return;
    }
    removePlayers([String(payload.playerId)]);
});

export function resetMinimapEntitiesStore(): void {
    minimapEntitiesStore.setState(() => ({ ...initialState }));
}
