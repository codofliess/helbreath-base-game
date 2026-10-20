import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { chatDialogStore, type ChatMessageEntry } from '../store/ChatDialog.store';
import { chatChannelLineClass } from '../../constants/ChatChannels';
import { OLYMPIA_UI_FONT } from '../../constants/OlympiaTypography';
import { selectScreenChatLines } from './screenChatLines';
import '../rpg-ui.css';

function formatSender(entry: ChatMessageEntry): string {
    if (entry.channel === 'whisper' && entry.whisperTargetCharacterName) {
        return `${entry.senderCharacterName} → ${entry.whisperTargetCharacterName}`;
    }
    return entry.senderCharacterName;
}

/** Duel-isolated: everyone can read global/nearby/party; hide trade/town spam. */
const DUEL_CHAT_CHANNELS = new Set<ChatMessageEntry['channel']>(['global', 'nearby', 'party', 'misc']);

interface ChatWorldLogProps {
    /** Arena slim: only duel-relevant channels. */
    duelOnly?: boolean;
}

/**
 * On-screen chat lines on the left / bottom-left of the map.
 * Same text as the speech overhead and the F9 Chat Log: `Name: message`,
 * channel colour, six-line stack. A line stays fully opaque for five seconds,
 * then drops off. The Chat Log window does not hide this strip.
 */
export function ChatWorldLog({ duelOnly = false }: ChatWorldLogProps) {
    const messages = useStore(chatDialogStore, (s) => s.messages);
    const composeOpen = useStore(chatDialogStore, (s) => s.composeOpen);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement instanceof HTMLElement) {
                setPortalTarget(fullscreenElement);
            } else {
                setPortalTarget(document.body);
            }
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => setNowMs(Date.now()), 100);
        return () => window.clearInterval(id);
    }, []);

    const visible = useMemo(
        () => selectScreenChatLines(messages, nowMs, duelOnly ? DUEL_CHAT_CHANNELS : undefined),
        [messages, nowMs, duelOnly],
    );

    if (!portalTarget || visible.length === 0) {
        return null;
    }

    const node = (
        <div
            className={`chat-world-log${composeOpen ? ' chat-world-log--compose-open' : ''}${duelOnly ? ' chat-world-log--duel' : ''}`}
            aria-live="polite"
            aria-label={duelOnly ? 'Duel chat' : 'World chat'}
            style={duelOnly ? { pointerEvents: 'none' } : undefined}
        >
            <div className="chat-world-log-list">
                {visible.map((entry) => {
                    return (
                        <div
                            key={entry.id}
                            className={`chat-world-log-line ${chatChannelLineClass(entry.channel)}`}
                            style={{ fontFamily: OLYMPIA_UI_FONT }}
                        >
                            <span className="chat-world-log-sender">{formatSender(entry)}:</span>
                            <span className="chat-world-log-text">{entry.displayMessage}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return createPortal(node, portalTarget);
}
