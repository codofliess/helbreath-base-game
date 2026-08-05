import { EventBus } from '../../game/EventBus';
import { CHAT_MESSAGE_RECEIVED } from '../../constants/EventNames';
import { shareChatMtCode } from '../../constants/ChatLanguages';
import {
    type ChatChannelId,
    chatChannelFromProto,
} from '../../constants/ChatChannels';
import {
    formatChatDisplayMessage,
    getChatTranslator,
} from '../../utils/chatTranslation/ChatTranslator';
import { createDialogStore } from './utils';
import { chatTranslationStore } from './ChatTranslation.store';
import { sysMenuDialogStore } from './SysMenuDialog.store';

export interface ChatMessageEntry {
    /** Client-local id for async display updates. */
    id: string;
    senderCharacterName: string;
    timestampMs: number;
    /** Original text as broadcast by the server. */
    message: string;
    /** Viewer-facing text (translated when applicable). */
    displayMessage: string;
    /** Speaker language/country tag when provided (eng, arg, bra, …). */
    sourceLanguageTag?: string;
    /** Olympia chat tab channel. */
    channel: Exclude<ChatChannelId, 'all'>;
    /** Whisper destination when channel is whisper. */
    whisperTargetCharacterName?: string;
}

interface ChatDialogState {
    isOpen: boolean;
    messages: ChatMessageEntry[];
    /** Active filter / send tab in the Chat Log window. */
    activeChannel: ChatChannelId;
    /**
     * Olympia Enter-to-chat: compose bar just above the bottom dock.
     * Separate from F9 Chat Log window.
     */
    composeOpen: boolean;
    composeDraft: string;
    /** Focus token bumped each open so the input re-focuses. */
    composeFocusSeq: number;
}

const MAX_CHAT_MESSAGES = 200;
let nextMessageSeq = 0;

const initialState: ChatDialogState = {
    isOpen: false,
    messages: [],
    activeChannel: 'all',
    composeOpen: false,
    composeDraft: '',
    composeFocusSeq: 0,
};

const { store: chatDialogStore, toggle: toggleChatDialog, setOpen: setChatDialogOpen } = createDialogStore(initialState);

export { chatDialogStore, toggleChatDialog, setChatDialogOpen };

export function setChatActiveChannel(channel: ChatChannelId): void {
    chatDialogStore.setState((state) => ({
        ...state,
        activeChannel: channel,
    }));
}

/** Opens Olympia-style bottom compose bar (Enter key). */
export function openChatCompose(prefill?: string): void {
    chatDialogStore.setState((state) => ({
        ...state,
        composeOpen: true,
        composeDraft: prefill !== undefined ? prefill : state.composeDraft,
        composeFocusSeq: state.composeFocusSeq + 1,
    }));
}

/** Closes compose without sending (Escape). */
export function closeChatCompose(): void {
    chatDialogStore.setState((state) => ({
        ...state,
        composeOpen: false,
        composeDraft: '',
    }));
}

export function setChatComposeDraft(draft: string): void {
    chatDialogStore.setState((state) => ({
        ...state,
        composeDraft: draft,
    }));
}

/** Clears chat history on logout (tabs reset to All). */
export function resetChatDialogStore(): void {
    chatDialogStore.setState(() => ({ ...initialState }));
}

function getLocalCharacterName(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }

    try {
        const raw = localStorage.getItem('gameState');
        if (!raw) {
            return undefined;
        }
        const state = JSON.parse(raw) as { characterName?: string };
        const name = state.characterName?.trim();
        return name && name.length > 0 ? name : undefined;
    } catch {
        return undefined;
    }
}

function isOwnChatMessage(senderCharacterName: string): boolean {
    const local = getLocalCharacterName();
    if (!local) {
        return false;
    }
    return local.localeCompare(senderCharacterName, undefined, { sensitivity: 'accent' }) === 0;
}

export const addChatMessage = (message: ChatMessageEntry) => {
    chatDialogStore.setState((state) => ({
        ...state,
        messages: [...state.messages, message].slice(-MAX_CHAT_MESSAGES),
    }));
};

function updateChatMessageDisplay(id: string, displayMessage: string): void {
    chatDialogStore.setState((state) => ({
        ...state,
        messages: state.messages.map((entry) => (entry.id === id ? { ...entry, displayMessage } : entry)),
    }));
}

/** Filters messages for the active Chat Log tab. */
export function filterChatMessages(
    messages: ChatMessageEntry[],
    activeChannel: ChatChannelId,
): ChatMessageEntry[] {
    if (activeChannel === 'all') {
        return messages;
    }
    return messages.filter((entry) => entry.channel === activeChannel);
}

EventBus.on(
    CHAT_MESSAGE_RECEIVED,
    (payload: {
        senderCharacterName: string;
        timestampMs: number;
        message: string;
        sourceLanguageTag?: string;
        channel?: number;
        whisperTargetCharacterName?: string;
    }) => {
        const channel = chatChannelFromProto(payload.channel);
        // SysMenu "Whisper" / "Shout" toggles: drop those lines when disabled.
        if (channel === 'whisper' && !sysMenuDialogStore.state.whisperEnabled) {
            return;
        }
        // Classic "Shout" maps to Global channel in this client.
        if (channel === 'global' && !sysMenuDialogStore.state.shoutEnabled) {
            return;
        }

        const id = `chat-${payload.timestampMs}-${nextMessageSeq++}`;
        const isOwn = isOwnChatMessage(payload.senderCharacterName);
        const sourceLanguageTag = payload.sourceLanguageTag?.trim() || undefined;
        const prefs = chatTranslationStore.state;
        const whisperTarget = payload.whisperTargetCharacterName?.trim() || undefined;

        const showTagImmediately =
            !isOwn &&
            prefs.showSpeakerLanguageTag &&
            Boolean(sourceLanguageTag) &&
            !shareChatMtCode(sourceLanguageTag, prefs.preferredLanguageId);
        const immediateDisplay = isOwn
            ? payload.message
            : formatChatDisplayMessage(payload.message, sourceLanguageTag, showTagImmediately);

        addChatMessage({
            id,
            senderCharacterName: payload.senderCharacterName,
            timestampMs: payload.timestampMs,
            message: payload.message,
            displayMessage: immediateDisplay,
            sourceLanguageTag,
            channel,
            ...(whisperTarget ? { whisperTargetCharacterName: whisperTarget } : {}),
        });

        if (isOwn || !sourceLanguageTag || shareChatMtCode(sourceLanguageTag, prefs.preferredLanguageId)) {
            return;
        }

        void getChatTranslator()
            .translate(payload.message, sourceLanguageTag, prefs.preferredLanguageId)
            .then((translated) => {
                const displayMessage = formatChatDisplayMessage(
                    translated,
                    sourceLanguageTag,
                    prefs.showSpeakerLanguageTag,
                );
                if (displayMessage === immediateDisplay) {
                    return;
                }
                updateChatMessageDisplay(id, displayMessage);
            });
    },
);
