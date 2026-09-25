import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { PARTY_INVITE_PROMPT_RECEIVED } from '../../constants/EventNames';

/** Client labels for the invitee prompt (server sends the sentence). */
export const PARTY_INVITE_JOIN_LABEL = 'Join';
export const PARTY_INVITE_DECLINE_LABEL = 'Decline';

export function partyInvitePromptText(inviterName: string): string {
    return `${inviterName} invites you to their party.`;
}

export interface PartyInvitePromptState {
    open: boolean;
    inviterName: string;
    message: string;
    partyCode: string;
}

const initialState: PartyInvitePromptState = {
    open: false,
    inviterName: '',
    message: '',
    partyCode: '',
};

export const partyInvitePromptStore = new Store<PartyInvitePromptState>(initialState);

export function applyPartyInvitePrompt(data: {
    inviterName: string;
    message: string;
    partyCode: string;
}): void {
    partyInvitePromptStore.setState(() => ({
        open: true,
        inviterName: data.inviterName,
        message: data.message,
        partyCode: data.partyCode,
    }));
}

export function closePartyInvitePrompt(): void {
    partyInvitePromptStore.setState(() => ({ ...initialState }));
}

EventBus.on(
    PARTY_INVITE_PROMPT_RECEIVED,
    (data: { inviterName: string; message: string; partyCode: string }) => {
        applyPartyInvitePrompt(data);
    },
);
