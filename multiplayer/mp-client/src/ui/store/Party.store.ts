import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { PARTY_STATE_RECEIVED, TOAST_REQUESTED } from '../../constants/EventNames';
import type { PartyState } from '../../proto/generated/network';

/** One party member row for the F5 Party panel (name + vitals). */
export interface PartyMemberRow {
    name: string;
    hp: number;
    maxHp: number;
    isLeader: boolean;
}

interface PartyStoreState {
    inParty: boolean;
    partyCode: string;
    members: PartyMemberRow[];
    /** Denormalized names for callers that only need the list. */
    memberNames: string[];
    isLeader: boolean;
    message: string;
}

const initialState: PartyStoreState = {
    inParty: false,
    partyCode: '',
    members: [],
    memberNames: [],
    isLeader: false,
    message: '',
};

export const partyStore = new Store<PartyStoreState>(initialState);

EventBus.on(PARTY_STATE_RECEIVED, (data: PartyState) => {
    const members: PartyMemberRow[] = (data.members ?? []).map((m) => ({
        name: m.name,
        hp: m.hp,
        maxHp: m.maxHp,
        isLeader: m.isLeader,
    }));
    const next: PartyStoreState = {
        inParty: data.inParty,
        partyCode: data.partyCode || '',
        members,
        memberNames: members.map((m) => m.name),
        isLeader: data.isLeader,
        message: data.message || '',
    };
    partyStore.setState(() => next);
    if (next.message) {
        EventBus.emit(TOAST_REQUESTED, { message: next.message, severity: 'info' });
    }
});

/** Clears party UI state on logout. */
export function resetPartyStore(): void {
    partyStore.setState(() => ({ ...initialState }));
}
