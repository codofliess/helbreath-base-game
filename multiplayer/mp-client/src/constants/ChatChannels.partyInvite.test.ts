import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseChatSendInput } from '../constants/ChatChannels';
import {
    applyPartyInvitePrompt,
    closePartyInvitePrompt,
    PARTY_INVITE_DECLINE_LABEL,
    PARTY_INVITE_JOIN_LABEL,
    partyInvitePromptStore,
    partyInvitePromptText,
} from '../ui/store/PartyInvite.store';

describe('parseChatSendInput /invite and /party', () => {
    it('treats /party invite … as party chat, not an invite command', () => {
        const parsed = parseChatSendInput('/party invite Juan to the raid', 'nearby');
        assert.ok(!('error' in parsed));
        assert.ok(!('inviteName' in parsed));
        assert.equal('channel' in parsed && parsed.channel, 'party');
        assert.equal('message' in parsed && parsed.message, 'invite Juan to the raid');
    });

    it('parses /invite Name for the party invite command', () => {
        const parsed = parseChatSendInput('/invite Bob', 'nearby');
        assert.deepEqual(parsed, { inviteName: 'Bob' });
    });

    it('parses /invite with no name so the server can send usage copy', () => {
        const parsed = parseChatSendInput('/invite', 'nearby');
        assert.deepEqual(parsed, { inviteName: '' });
    });
});

describe('party invite prompt (client)', () => {
    it('shows server prompt text with Join and Decline buttons', () => {
        closePartyInvitePrompt();
        const inviter = 'Alice';
        applyPartyInvitePrompt({
            inviterName: inviter,
            message: partyInvitePromptText(inviter),
            partyCode: '12345',
        });
        assert.equal(partyInvitePromptStore.state.open, true);
        assert.equal(partyInvitePromptStore.state.message, 'Alice invites you to their party.');
        assert.equal(PARTY_INVITE_JOIN_LABEL, 'Join');
        assert.equal(PARTY_INVITE_DECLINE_LABEL, 'Decline');
        closePartyInvitePrompt();
        assert.equal(partyInvitePromptStore.state.open, false);
    });
});
