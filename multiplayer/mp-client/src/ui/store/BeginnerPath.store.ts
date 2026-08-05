import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    BEGINNER_PATH_STATE_RECEIVED,
    SYSTEM_LOG_APPEND,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import type { BeginnerPathState } from '../../proto/generated/network';

interface BeginnerPathStoreState {
    enrolled: boolean;
    abandoned: boolean;
    activeQuestId: string | null;
    activeQuestTitle: string;
    activeQuestHint: string;
    progress: number;
    required: number;
    objectiveKind: string;
    uiActionId: string;
    completedQuestIds: string[];
    canEnroll: boolean;
    statusMessage: string;
    nextStubTitle: string;
}

const initialState: BeginnerPathStoreState = {
    enrolled: false,
    abandoned: false,
    activeQuestId: null,
    activeQuestTitle: '',
    activeQuestHint: '',
    progress: 0,
    required: 0,
    objectiveKind: '',
    uiActionId: '',
    completedQuestIds: [],
    canEnroll: true,
    statusMessage: 'Optional beginner training (1→80).',
    nextStubTitle: '',
};

export const beginnerPathStore = new Store<BeginnerPathStoreState>(initialState);

function applyState(data: BeginnerPathState): void {
    const prev = beginnerPathStore.state;
    const next: BeginnerPathStoreState = {
        enrolled: data.enrolled,
        abandoned: data.abandoned,
        activeQuestId: data.activeQuestId ?? null,
        activeQuestTitle: data.activeQuestTitle || '',
        activeQuestHint: data.activeQuestHint || '',
        progress: data.progress,
        required: data.required,
        objectiveKind: data.objectiveKind || '',
        uiActionId: data.uiActionId || '',
        completedQuestIds: [...(data.completedQuestIds ?? [])],
        canEnroll: data.canEnroll,
        statusMessage: data.statusMessage || '',
        nextStubTitle: data.nextStubTitle || '',
    };
    beginnerPathStore.setState(() => next);

    if (prev.activeQuestId && next.activeQuestId && prev.activeQuestId !== next.activeQuestId) {
        EventBus.emit(TOAST_REQUESTED, {
            message: `Beginner quest: ${next.activeQuestTitle}`,
            severity: 'info',
        });
    } else if (prev.activeQuestId && !next.activeQuestId && next.enrolled && !next.abandoned) {
        EventBus.emit(TOAST_REQUESTED, {
            message: 'Beginner path 1→80 complete. Tips remain in Shift+F10.',
            severity: 'info',
        });
    } else if (!prev.abandoned && next.abandoned) {
        EventBus.emit(TOAST_REQUESTED, {
            message: 'Beginner training abandoned — no penalty. Play freely.',
            severity: 'info',
        });
    } else if (!prev.enrolled && next.enrolled) {
        EventBus.emit(TOAST_REQUESTED, {
            message: 'Beginner training enrolled. Open Quest (F5) for hints.',
            severity: 'info',
        });
        if (next.activeQuestHint) {
            EventBus.emit(SYSTEM_LOG_APPEND, {
                message: next.activeQuestHint.toLowerCase().startsWith('tip:')
                    ? next.activeQuestHint
                    : `Tip: ${next.activeQuestHint}`,
                kind: 'tip',
            });
        }
    }
}

EventBus.on(BEGINNER_PATH_STATE_RECEIVED, (data: BeginnerPathState) => {
    applyState(data);
});

/** Clears beginner-path UI state on logout. */
export function resetBeginnerPathStore(): void {
    beginnerPathStore.setState(() => ({ ...initialState }));
}
