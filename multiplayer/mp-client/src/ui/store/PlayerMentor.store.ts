import { Store } from '@tanstack/react-store';

const STORAGE_KEY = 'hb-player-mentor-minimized';

export interface MentorChatLine {
    id: string;
    role: 'user' | 'mentor';
    text: string;
    source?: 'local' | 'grok' | 'client';
}

interface PlayerMentorState {
    minimized: boolean;
    pending: boolean;
    error: string | null;
    messages: MentorChatLine[];
}

function readMinimized(): boolean {
    if (typeof localStorage === 'undefined') {
        return false;
    }
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function persistMinimized(minimized: boolean): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, minimized ? '1' : '0');
    } catch {
        // private mode / quota — ignore
    }
}

const initialState: PlayerMentorState = {
    minimized: readMinimized(),
    pending: false,
    error: null,
    messages: [],
};

export const playerMentorStore = new Store<PlayerMentorState>(initialState);

export function setMentorMinimized(minimized: boolean): void {
    persistMinimized(minimized);
    playerMentorStore.setState((s) => ({ ...s, minimized }));
}

export function setMentorPending(pending: boolean): void {
    playerMentorStore.setState((s) => ({ ...s, pending, error: pending ? null : s.error }));
}

export function setMentorError(error: string | null): void {
    playerMentorStore.setState((s) => ({ ...s, error, pending: false }));
}

export function appendMentorMessage(line: Omit<MentorChatLine, 'id'>): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    playerMentorStore.setState((s) => {
        const messages = [...s.messages, { ...line, id }];
        return { ...s, messages: messages.length > 40 ? messages.slice(-40) : messages };
    });
}
