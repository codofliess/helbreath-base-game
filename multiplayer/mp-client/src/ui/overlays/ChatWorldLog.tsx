import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { chatDialogStore, type ChatMessageEntry } from '../store/ChatDialog.store';
import { chatChannelLineClass } from '../../constants/ChatChannels';
import { OLYMPIA_UI_FONT } from '../../constants/OlympiaTypography';
import '../rpg-ui.css';

/** Olympia map log shows only a short stack (≈4 lines). */
const MAX_VISIBLE_LINES = 4;
/** Lines older than this drop off the map strip (ms). */
const LINE_TTL_MS = 35_000;

function formatSender(entry: ChatMessageEntry): string {
    if (entry.channel === 'whisper' && entry.whisperTargetCharacterName) {
        return `${entry.senderCharacterName} → ${entry.whisperTargetCharacterName}`;
    }
    return entry.senderCharacterName;
}

/** Duel-isolated: everyone can read global/nearby/party; hide trade/town spam. */
const DUEL_CHAT_CHANNELS = new Set(['global', 'nearby', 'party', 'misc']);

interface ChatWorldLogProps {
    /** Arena slim: only duel-relevant channels. */
    duelOnly?: boolean;
}

/**
 * Olympia-style world chat when F9 Chat Log is closed:
 * bare PutString2 lines top-left over the map (no box), max 4 lines, channel colors.
 * F9 open → hide this strip (history lives in the dialog).
 */
export function ChatWorldLog({ duelOnly = false }: ChatWorldLogProps) {
    const messages = useStore(chatDialogStore, (s) => s.messages);
    const f9Open = useStore(chatDialogStore, (s) => s.isOpen);
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
        const id = window.setInterval(() => setNowMs(Date.now()), 500);
        return () => window.clearInterval(id);
    }, []);

    const visible = useMemo(() => {
        let list = messages;
        if (duelOnly) {
            list = messages.filter((m) => DUEL_CHAT_CHANNELS.has(m.channel));
        }
        const recent = list.slice(-MAX_VISIBLE_LINES);
        return recent.filter((m) => nowMs - m.timestampMs < LINE_TTL_MS);
    }, [messages, nowMs, duelOnly]);

    // F9 Chat Log open → only the dialog; map strip hidden (Olympia).
    // Duel strip: pointer-events none so chat never steals cast clicks.
    if (!portalTarget || f9Open || visible.length === 0) {
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
                    const ageMs = Math.max(0, nowMs - entry.timestampMs);
                    const fadeStart = LINE_TTL_MS * 0.7;
                    const opacity =
                        ageMs < fadeStart
                            ? 1
                            : Math.max(0.2, 1 - (ageMs - fadeStart) / (LINE_TTL_MS - fadeStart));
                    return (
                        <div
                            key={entry.id}
                            className={`chat-world-log-line ${chatChannelLineClass(entry.channel)}`}
                            style={{ opacity, fontFamily: OLYMPIA_UI_FONT }}
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
