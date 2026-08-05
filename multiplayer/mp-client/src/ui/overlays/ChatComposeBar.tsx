import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import {
    chatDialogStore,
    closeChatCompose,
    setChatComposeDraft,
} from '../store/ChatDialog.store';
import { getLocalSourceLanguageTag } from '../store/ChatTranslation.store';
import { CHAT_LOG_TABS, parseChatSendInput } from '../../constants/ChatChannels';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SUPPRESS_POINTER_INPUT } from '../../constants/EventNames';
import type { IRefPhaserGame } from '../../PhaserGame';
import '../rpg-ui.css';

interface ChatComposeBarProps {
    phaserRef: RefObject<IRefPhaserGame | null>;
    /** Arena slim: force global (shared duel log); Discord for voice. */
    duelOnly?: boolean;
}

/**
 * Olympia Enter-to-chat: single-line input docked just above the bottom hotkey bar.
 * Enter sends (or opens when closed — handled in main.tsx); Escape cancels.
 */
export function ChatComposeBar({ phaserRef, duelOnly = false }: ChatComposeBarProps) {
    const composeOpen = useStore(chatDialogStore, (s) => s.composeOpen);
    const composeDraft = useStore(chatDialogStore, (s) => s.composeDraft);
    const composeFocusSeq = useStore(chatDialogStore, (s) => s.composeFocusSeq);
    const activeChannel = useStore(chatDialogStore, (s) => s.activeChannel);
    const sendChannel = duelOnly ? 'global' : activeChannel;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [sendError, setSendError] = useState<string | undefined>(undefined);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);

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
        if (!composeOpen) {
            return;
        }
        const id = window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        });
        return () => window.cancelAnimationFrame(id);
    }, [composeOpen, composeFocusSeq]);

    if (!composeOpen || !portalTarget) {
        return null;
    }

    const suppressPointerLeak = () => {
        EventBus.emit(IN_UI_SUPPRESS_POINTER_INPUT, 150);
    };

    const sendMessage = () => {
        // Duel: bare text → global so both sides / spectators can read.
        const parsed = parseChatSendInput(composeDraft, sendChannel);
        if ('error' in parsed) {
            setSendError(parsed.error);
            return;
        }
        if (duelOnly && parsed.channel !== 'global' && parsed.channel !== 'party' && parsed.channel !== 'nearby') {
            // Allow /party for team callouts; block trade/town spam.
            if (parsed.channel === 'trade' || parsed.channel === 'town' || parsed.channel === 'guild') {
                setSendError('Duel chat: use plain text (global) or /party for team.');
                return;
            }
        }

        const game = phaserRef.current?.game;
        if (!game) {
            return;
        }

        const networkManager = getNetworkManager(game);
        if (!networkManager) {
            return;
        }

        networkManager.sendChatMessage(parsed.message, getLocalSourceLanguageTag(), {
            channel: parsed.channel,
            whisperTargetCharacterName: parsed.whisperTarget,
        });
        setSendError(undefined);
        closeChatCompose();
        suppressPointerLeak();
    };

    const channelLabel =
        activeChannel === 'all'
            ? 'Nearby'
            : (CHAT_LOG_TABS.find((t) => t.id === activeChannel)?.label ?? 'Chat');

    const placeholder =
        activeChannel === 'whisper'
            ? '/w Name message…'
            : `Message (${channelLabel}) — /w /g /p /trade…`;

    const node = (
        <div
            className="chat-compose-bar"
            role="form"
            aria-label="Chat message"
            onPointerDown={(e) => {
                e.stopPropagation();
                suppressPointerLeak();
            }}
        >
            <span className="chat-compose-bar-channel" title="Active send channel (F9 tabs)">
                {channelLabel}
            </span>
            <input
                ref={inputRef}
                type="text"
                className="chat-compose-bar-input"
                value={composeDraft}
                maxLength={256}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                    setChatComposeDraft(e.target.value);
                    if (sendError) {
                        setSendError(undefined);
                    }
                }}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        sendMessage();
                        return;
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        closeChatCompose();
                        suppressPointerLeak();
                    }
                }}
                onFocus={suppressPointerLeak}
            />
            {sendError ? <span className="chat-compose-bar-error">{sendError}</span> : null}
        </div>
    );

    return createPortal(node, portalTarget);
}
