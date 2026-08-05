import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SUPPRESS_POINTER_INPUT } from '../../constants/EventNames';
import { getNetworkManager } from '../../utils/RegistryUtils';
import type { IRefPhaserGame } from '../../PhaserGame';
import {
    chatDialogStore,
    filterChatMessages,
    setChatActiveChannel,
    type ChatMessageEntry,
} from '../store/ChatDialog.store';
import { getLocalSourceLanguageTag } from '../store/ChatTranslation.store';
import {
    CHAT_LOG_TABS,
    chatChannelLineClass,
    parseChatSendInput,
} from '../../constants/ChatChannels';
import { OlympiaDialogShell, stopOlympiaPointer } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import { CHAT_DIALOG_BG, DIALOG_BTN_OK, DIALOG_BTN_OK_HOVER } from '../../constants/SpriteKeys';

interface ChatDialogProps {
    messages: ChatMessageEntry[];
    position: { x: number; y: number };
    phaserRef: RefObject<IRefPhaserGame | null>;
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

function formatSenderLabel(entry: ChatMessageEntry): string {
    if (entry.channel === 'whisper' && entry.whisperTargetCharacterName) {
        return `${entry.senderCharacterName} → ${entry.whisperTargetCharacterName}`;
    }
    return entry.senderCharacterName;
}

export function ChatDialog({
    messages,
    position,
    phaserRef,
    onClose,
    zIndex,
    onBringToFront,
}: ChatDialogProps) {
    const [draft, setDraft] = useState('');
    const [sendError, setSendError] = useState<string | undefined>(undefined);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const activeChannel = useStore(chatDialogStore, (s) => s.activeChannel);

    const visibleMessages = useMemo(
        () => filterChatMessages(messages, activeChannel),
        [messages, activeChannel],
    );

    useEffect(() => {
        const element = messagesRef.current;
        if (!element) {
            return;
        }
        element.scrollTop = element.scrollHeight;
    }, [visibleMessages.length, activeChannel]);

    const formattedMessages = useMemo(() => {
        return visibleMessages.map((entry) => ({
            key: entry.id,
            time: new Date(entry.timestampMs).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            }),
            ...entry,
        }));
    }, [visibleMessages]);

    const suppressPointerLeak = () => {
        EventBus.emit(IN_UI_SUPPRESS_POINTER_INPUT, 150);
    };

    const sendMessage = () => {
        const parsed = parseChatSendInput(draft, activeChannel);
        if ('error' in parsed) {
            setSendError(parsed.error);
            return;
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
        setDraft('');
        setSendError(undefined);
        suppressPointerLeak();
    };

    const placeholder =
        activeChannel === 'whisper'
            ? '/w Name message…'
            : activeChannel === 'all'
              ? 'Message (Nearby) or /w Name…'
              : `Message (${CHAT_LOG_TABS.find((t) => t.id === activeChannel)?.label ?? 'Chat'})…`;

    return (
        <OlympiaDialogShell
            id="chat-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
            width={420}
            minHeight={210}
            bgSpriteKey={CHAT_DIALOG_BG}
            rootClassName="chat-dialog-root"
        >
            <div className="olympia-dialog-title-bar hb-nemesis-dialog-title">Chat Log</div>
            <div
                className="chat-dialog-content"
                onPointerDown={(e) => {
                    e.stopPropagation();
                    suppressPointerLeak();
                }}
            >
                <div className="chat-dialog-tabs" role="tablist" aria-label="Chat channels">
                    {CHAT_LOG_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeChannel === tab.id}
                            className={`chat-dialog-tab${activeChannel === tab.id ? ' chat-dialog-tab--active' : ''}`}
                            onClick={() => {
                                setChatActiveChannel(tab.id);
                                suppressPointerLeak();
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div ref={messagesRef} className="chat-dialog-messages">
                    {formattedMessages.length === 0 ? (
                        <div className="chat-dialog-empty">No messages in this channel.</div>
                    ) : (
                        formattedMessages.map((entry) => (
                            <div
                                key={entry.key}
                                className={`chat-dialog-line ${chatChannelLineClass(entry.channel)}`}
                            >
                                <span className="chat-dialog-time">[{entry.time}] </span>
                                <span className="chat-dialog-sender">{formatSenderLabel(entry)}:</span>{' '}
                                <span>{entry.displayMessage}</span>
                            </div>
                        ))
                    )}
                </div>

                {sendError ? <div className="chat-dialog-send-error">{sendError}</div> : null}

                <div className="chat-dialog-input-row">
                    <input
                        type="text"
                        className="olympia-input chat-dialog-input"
                        value={draft}
                        maxLength={256}
                        placeholder={placeholder}
                        onChange={(e) => {
                            setDraft(e.target.value);
                            if (sendError) {
                                setSendError(undefined);
                            }
                        }}
                        onFocus={suppressPointerLeak}
                        onPointerDown={(e) => {
                            stopOlympiaPointer(e);
                            suppressPointerLeak();
                        }}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <OlympiaSpriteButton
                        normalKey={DIALOG_BTN_OK}
                        hoverKey={DIALOG_BTN_OK_HOVER}
                        title="Send"
                        fallbackLabel="Send"
                        onClick={sendMessage}
                        disabled={!draft.trim()}
                        className="chat-dialog-send-btn"
                    />
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
