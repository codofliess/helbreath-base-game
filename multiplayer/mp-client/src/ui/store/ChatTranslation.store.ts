import { Store } from '@tanstack/react-store';
import {
    CHAT_LANGUAGE_OPTIONS,
    detectDefaultChatLanguageId,
    getChatLanguageById,
} from '../../constants/ChatLanguages';

interface ChatTranslationState {
    preferredLanguageId: string;
    showSpeakerLanguageTag: boolean;
}

const STORAGE_KEY = 'hb-chat-translation';

function defaultState(): ChatTranslationState {
    return {
        preferredLanguageId: detectDefaultChatLanguageId(),
        showSpeakerLanguageTag: true,
    };
}

function loadState(): ChatTranslationState {
    if (typeof window === 'undefined') {
        return defaultState();
    }

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return defaultState();
        }

        const parsed = JSON.parse(raw) as Partial<ChatTranslationState>;
        const preferredLanguageId =
            typeof parsed.preferredLanguageId === 'string' && getChatLanguageById(parsed.preferredLanguageId)
                ? parsed.preferredLanguageId
                : detectDefaultChatLanguageId();

        return {
            preferredLanguageId,
            showSpeakerLanguageTag: parsed.showSpeakerLanguageTag ?? true,
        };
    } catch {
        return defaultState();
    }
}

function persist(state: ChatTranslationState): void {
    if (typeof window === 'undefined') {
        return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const chatTranslationStore = new Store<ChatTranslationState>(loadState());

function updatePrefs(patch: Partial<ChatTranslationState>): void {
    chatTranslationStore.setState((s) => {
        const next = { ...s, ...patch };
        persist(next);
        return next;
    });
}

export function setPreferredChatLanguageId(languageId: string): void {
    if (!getChatLanguageById(languageId)) {
        console.warn('[ChatTranslation] unknown language id', languageId);
        return;
    }
    updatePrefs({ preferredLanguageId: languageId });
}

export function setShowSpeakerLanguageTag(value: boolean): void {
    updatePrefs({ showSpeakerLanguageTag: value });
}

/** Speaker tag attached to outbound chat (eng/arg/bra/…). */
export function getLocalSourceLanguageTag(): string {
    const option = getChatLanguageById(chatTranslationStore.state.preferredLanguageId);
    return option?.tag ?? CHAT_LANGUAGE_OPTIONS[0].tag;
}
