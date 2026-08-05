/**
 * Arena slim mode: duel-focused HUD — bag + combat, no click-steal clutter.
 *
 * Enabled when:
 * - URL has `?arena=1` / `?mode=arena` / `?arenaSlim=1`, or
 * - current game world id is a pact/tournament arena (colosseum, arena-duel-*, …)
 */
import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    INITIAL_GAME_WORLD_STATE_RECEIVED,
    OUT_MAP_LOADED,
    OUT_UI_SET_SELECTED_MAP,
} from '../../constants/EventNames';
import { setBagDialogTab } from './InventoryDialog.store';
import { setCharacterDialogOpen } from './CharacterDialog.store';
import { setChatActiveChannel } from './ChatDialog.store';
import { setMinimapDialogOpen } from './MinimapDialog.store';

/** Worlds that force slim HUD (match server GameWorlds pactArena / tournament arenas). */
export const ARENA_SLIM_WORLD_IDS = new Set(
    [
        'colosseum',
        'arena1',
        'arena4',
        'arena5',
        'arena6',
        'arena7',
        'arena8',
        'arena-duel-s',
        'arena-duel-m',
        'arena-duel-l',
        'arena-tourney',
        'arena-btfield',
        'arena-bleeding', // Bleeding Island social lobby + open duels
        'training', // optional practice — still slim combat focus
    ].map((s) => s.toLowerCase()),
);

export function isArenaSlimWorldId(worldId: string | undefined | null): boolean {
    if (!worldId) {
        return false;
    }
    const id = worldId.replace(/\.amd$/i, '').trim().toLowerCase();
    if (ARENA_SLIM_WORLD_IDS.has(id)) {
        return true;
    }
    // fightzone maps loaded by map name
    if (id.startsWith('fightzone') || id.startsWith('arena') || id === 'btfield') {
        return true;
    }
    return false;
}

function urlForcesArenaSlim(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        const q = new URLSearchParams(window.location.search);
        const v = (q.get('arena') || q.get('mode') || q.get('arenaSlim') || '').toLowerCase();
        return v === '1' || v === 'true' || v === 'arena' || v === 'slim' || v === 'yes';
    } catch {
        return false;
    }
}

interface ArenaSlimState {
    /** Explicit URL / manual force (stays until reload unless cleared). */
    forceEnabled: boolean;
    /** Current world is an arena map. */
    worldIsArena: boolean;
    currentWorldId: string;
}

const initial: ArenaSlimState = {
    forceEnabled: urlForcesArenaSlim(),
    worldIsArena: false,
    currentWorldId: '',
};

export const arenaSlimModeStore = new Store<ArenaSlimState>(initial);

export function isArenaSlimMode(): boolean {
    const s = arenaSlimModeStore.state;
    return s.forceEnabled || s.worldIsArena;
}

export function setArenaSlimForce(enabled: boolean): void {
    arenaSlimModeStore.setState((s) => ({ ...s, forceEnabled: enabled }));
    applyArenaSlimSideEffects();
}

function setWorldArena(worldId: string): void {
    const id = (worldId || '').replace(/\.amd$/i, '').trim();
    const worldIsArena = isArenaSlimWorldId(id);
    arenaSlimModeStore.setState((s) => ({
        ...s,
        currentWorldId: id,
        worldIsArena,
    }));
    applyArenaSlimSideEffects();
}

/** Close heavy panels, force bag tab, duel chat channel, body class. */
function applyArenaSlimSideEffects(): void {
    const on = isArenaSlimMode();
    if (typeof document !== 'undefined') {
        document.body.classList.toggle('arena-slim-mode', on);
    }
    if (!on) {
        return;
    }
    // No F5 paperdoll / character panel during duel.
    setCharacterDialogOpen(false);
    // Bag only — no Item Drops tab noise.
    setBagDialogTab('bag');
    // Shared duel channel: global so everyone in the match can read (team Discord for voice).
    setChatActiveChannel('global');
    // Minimap on for multi-fighter PvP (party / friends location).
    setMinimapDialogOpen(true);
}

// —— Event wiring (side-effect import from App or main) ——

let wired = false;

export function wireArenaSlimModeListeners(): void {
    if (wired) {
        return;
    }
    wired = true;

    EventBus.on(OUT_UI_SET_SELECTED_MAP, (mapOrWorld: string | undefined) => {
        if (typeof mapOrWorld === 'string') {
            setWorldArena(mapOrWorld);
        }
    });

    EventBus.on(INITIAL_GAME_WORLD_STATE_RECEIVED, (data: { mapName?: string; gameWorldId?: string } | undefined) => {
        const id = data?.gameWorldId || data?.mapName || '';
        if (id) {
            setWorldArena(id);
        }
    });

    EventBus.on(OUT_MAP_LOADED, () => {
        // Re-assert after map load (world id may already be set).
        applyArenaSlimSideEffects();
    });

    // Initial URL force
    if (urlForcesArenaSlim()) {
        applyArenaSlimSideEffects();
    }
}
