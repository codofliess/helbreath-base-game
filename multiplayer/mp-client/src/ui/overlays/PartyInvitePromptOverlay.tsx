import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_DECLINE_PARTY_INVITE, IN_UI_JOIN_PARTY } from '../../constants/EventNames';
import {
    closePartyInvitePrompt,
    PARTY_INVITE_DECLINE_LABEL,
    PARTY_INVITE_JOIN_LABEL,
    partyInvitePromptStore,
} from '../store/PartyInvite.store';
import '../rpg-ui.css';

/**
 * Invitee accept/decline prompt for `/invite`. Join uses the F5 party join-by-code path.
 */
export function PartyInvitePromptOverlay() {
    const open = useStore(partyInvitePromptStore, (s) => s.open);
    const message = useStore(partyInvitePromptStore, (s) => s.message);
    const partyCode = useStore(partyInvitePromptStore, (s) => s.partyCode);

    if (!open) {
        return null;
    }

    const join = () => {
        EventBus.emit(IN_UI_JOIN_PARTY, { partyCode });
        closePartyInvitePrompt();
    };

    const decline = () => {
        EventBus.emit(IN_UI_DECLINE_PARTY_INVITE);
        closePartyInvitePrompt();
    };

    return (
        <div className="party-invite-prompt" role="dialog" aria-label="Party invite">
            <p className="party-invite-prompt-text">{message}</p>
            <div className="party-invite-prompt-actions">
                <button type="button" className="party-invite-prompt-btn" onClick={join}>
                    {PARTY_INVITE_JOIN_LABEL}
                </button>
                <button type="button" className="party-invite-prompt-btn" onClick={decline}>
                    {PARTY_INVITE_DECLINE_LABEL}
                </button>
            </div>
        </div>
    );
}
