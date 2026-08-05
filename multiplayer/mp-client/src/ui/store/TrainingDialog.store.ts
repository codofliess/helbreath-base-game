import { Store } from '@tanstack/react-store';
import { TRAINING_PRESETS } from '../../constants/TrainingPresets';

export type TrainingDialogPanel = 'arena' | 'farm' | 'challenge';

interface TrainingDialogState {
    isOpen: boolean;
    selectedPresetId: string;
    /** Preferred tab when opening from Skill dialog / hotkeys. */
    preferredPanel: TrainingDialogPanel;
}

export const trainingDialogStore = new Store<TrainingDialogState>({
    isOpen: false,
    selectedPresetId: TRAINING_PRESETS[0]?.id ?? 'mage_chase_1',
    preferredPanel: 'arena',
});

export function toggleTrainingDialog(): void {
    trainingDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setTrainingDialogOpen(value: boolean, preferredPanel?: TrainingDialogPanel): void {
    trainingDialogStore.setState((s) => ({
        ...s,
        isOpen: value,
        ...(preferredPanel ? { preferredPanel } : {}),
    }));
}

export function setTrainingPresetId(presetId: string): void {
    trainingDialogStore.setState((s) => ({ ...s, selectedPresetId: presetId }));
}

export function setTrainingPreferredPanel(panel: TrainingDialogPanel): void {
    trainingDialogStore.setState((s) => ({ ...s, preferredPanel: panel }));
}
