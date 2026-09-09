import { Store } from '@tanstack/react-store';
import { SPELLS, SPELL_ENERGY_BOLT_ID, SPELL_PROTECTION_FROM_ARROW_ID } from '../../constants/Spells';
import { MAGIC_SHOP_SPELL_IDS } from '../../constants/SpellAcquisition';
import { getOlympiaServerSpellId, getOlympiaSpellIdFromServer } from '../../constants/OlympiaServerSpellMap';
import { isTravelerPlayerMode } from '../../utils/playerMode';
import {
    GOLD_ITEM_ID,
    countBagGold,
    mergeOlympiaBookFromServerCatalog,
} from '../../utils/magicBookClient';
import { EventBus } from '../../game/EventBus';
import { SERVER_CITY_NPC_SERVICE_RESULT } from '../../constants/EventNames';
import { inventoryDialogStore } from './InventoryDialog.store';

/** Gold bag item id (Items.json). Re-export for shop / bag UI. */
export { GOLD_ITEM_ID };

interface MagicShopState {
    isOpen: boolean;
    activeCircle: number;
    /** Spell IDs the player has learned (purchased or starter). Olympia Magic.cfg ids. */
    learnedSpellIds: number[];
    /** Bag gold snapshot from Magic Tower open/buy replies (or bag fallback). */
    gold: number;
    /** Server NPC instance id while shop is open. */
    npcId: string | null;
    npcName: string;
    statusMessage: string;
}

function createInitialLearnedSpellIds(): number[] {
    if (isTravelerPlayerMode()) {
        return [SPELL_ENERGY_BOLT_ID];
    }
    return [...MAGIC_SHOP_SPELL_IDS];
}

/** Sum gold from the inventory dialog bag (authoritative client mirror of bag stacks). */
export function countBagGoldFromInventory(): number {
    return countBagGold(inventoryDialogStore.state.baggedItems);
}

const initialState: MagicShopState = {
    isOpen: false,
    activeCircle: 1,
    learnedSpellIds: createInitialLearnedSpellIds(),
    gold: 0,
    npcId: null,
    npcName: 'Gandalf',
    statusMessage: '',
};

export const magicShopDialogStore = new Store<MagicShopState>(initialState);

export const setMagicShopOpen = (
    value: boolean,
    opts?: { npcId?: string; npcName?: string },
) => {
    const bagGold = countBagGoldFromInventory();
    magicShopDialogStore.setState((state) => ({
        ...state,
        isOpen: value,
        npcId: value ? (opts?.npcId ?? state.npcId) : null,
        npcName: opts?.npcName ?? state.npcName,
        // Seed UI gold from bag immediately so Buy is not stuck at 0 before server open replies.
        gold: value ? Math.max(state.gold, bagGold) : state.gold,
        statusMessage: value ? '' : state.statusMessage,
    }));
};

export const setMagicShopStatusMessage = (message: string) => {
    magicShopDialogStore.setState((s) => ({ ...s, statusMessage: message }));
};

export const setMagicShopCircle = (circle: number) => {
    const clamped = Math.max(1, Math.min(10, circle));
    magicShopDialogStore.setState((state) => ({ ...state, activeCircle: clamped }));
};

export const isSpellLearned = (spellId: number): boolean => {
    return magicShopDialogStore.state.learnedSpellIds.includes(spellId);
};

/** F7 Circle rows — Olympia Magic.cfg ids in `learnedSpellIds`, not SkillLevels / catalog ids. */
export function getCastableSpells() {
    const { learnedSpellIds } = magicShopDialogStore.state;
    return SPELLS.filter((s) => learnedSpellIds.includes(s.id));
}

/** Olympia Magic.cfg ids granted while Timed Challenge Mode 1 is active. */
const PROTOCOL_SPELL_IDS = [45, 35, 13, 27, 44, SPELL_PROTECTION_FROM_ARROW_ID] as const;

/** When true, re-apply protocol book entries after server spell resyncs. */
let timedChallengeProtocolActive = false;

/** Resets traveler starter / GM full unlock on logout. */
export function resetMagicShopLearnedSpells() {
    timedChallengeProtocolActive = false;
    magicShopDialogStore.setState((s) => ({
        ...s,
        isOpen: false,
        learnedSpellIds: createInitialLearnedSpellIds(),
        gold: 0,
        npcId: null,
        statusMessage: '',
        activeCircle: 1,
    }));
}

export function setTimedChallengeProtocolSpellsUnlocked(unlocked: boolean): void {
    if (!isTravelerPlayerMode()) {
        return;
    }

    timedChallengeProtocolActive = unlocked;
    if (!unlocked) {
        // Leave book alone — tower purchases stay; next InitialState/open trims protocol-only ids.
        return;
    }
    magicShopDialogStore.setState((s) => ({
        ...s,
        learnedSpellIds: [...new Set([...s.learnedSpellIds, ...PROTOCOL_SPELL_IDS])],
    }));
}

/**
 * Align combat unlocks from InitialState (Spells.json ids) into the F7 Olympia book.
 * Union only — an Energy-Bolt-only snapshot must not wipe Missile/Heal/Create Food
 * after a magic-shop `learned=` ACK (Circle One uses Olympia ids 0/1/2, not catalog 0/29/31).
 */
export function applyServerSpellUnlocks(serverSpellIds: number[]) {
    if (!isTravelerPlayerMode()) {
        return;
    }

    magicShopDialogStore.setState((s) => ({
        ...s,
        learnedSpellIds: mergeOlympiaBookFromServerCatalog(
            s.learnedSpellIds,
            serverSpellIds,
            getOlympiaSpellIdFromServer,
            SPELL_ENERGY_BOLT_ID,
            timedChallengeProtocolActive ? [...PROTOCOL_SPELL_IDS] : [],
        ),
    }));
}

function parseMagicTowerSummary(summary: string): { gold: number; learned: number[] } {
    let gold = -1;
    const learned: number[] = [];
    for (const part of summary.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0) {
            continue;
        }
        const k = part.slice(0, eq).trim();
        const v = part.slice(eq + 1).trim();
        if (k === 'gold' && v) {
            const n = Number.parseInt(v, 10);
            if (Number.isFinite(n)) {
                gold = n;
            }
        } else if (k === 'learned' && v) {
            for (const id of v.split(',')) {
                const n = Number.parseInt(id.trim(), 10);
                if (Number.isFinite(n)) {
                    learned.push(n);
                }
            }
        }
    }
    return { gold, learned };
}

// Magic Tower replies reuse CityNpcServiceResult with role magic-shop.
EventBus.on(SERVER_CITY_NPC_SERVICE_RESULT, (payload: {
    ok?: boolean;
    message?: string;
    role?: string;
    cityServicesSummary?: string;
    goldSpent?: number;
}) => {
    if (payload.role !== 'magic-shop') {
        return;
    }
    const summary = payload.cityServicesSummary ?? '';
    const parsed = parseMagicTowerSummary(summary);
    // Prefer summary gold=; fall back to goldSpent (server puts bag balance there for magic-shop).
    let gold = parsed.gold;
    if (gold < 0 && typeof payload.goldSpent === 'number' && payload.goldSpent >= 0) {
        gold = payload.goldSpent;
    }
    if (gold < 0) {
        gold = countBagGoldFromInventory();
    }
    // Server `learned=` is the full Magic Tower set — replace, do not merge (Unlearn must drop).
    const learned = parsed.learned;
    magicShopDialogStore.setState((s) => {
        const clientOnly = s.learnedSpellIds.filter(
            (id) => id !== SPELL_ENERGY_BOLT_ID && getOlympiaServerSpellId(id) === undefined,
        );
        const next = [...new Set([
            SPELL_ENERGY_BOLT_ID,
            ...learned,
            ...clientOnly,
            ...(timedChallengeProtocolActive ? [...PROTOCOL_SPELL_IDS] : []),
        ])];
        return {
            ...s,
            gold,
            learnedSpellIds: next,
            statusMessage: payload.message ?? s.statusMessage,
        };
    });
});
