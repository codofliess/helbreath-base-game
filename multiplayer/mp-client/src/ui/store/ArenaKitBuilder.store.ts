import { Store } from '@tanstack/react-store';
import { sanitizeCatalogPurchases, type ArenaKit, type ArenaSlotIndex } from '../../utils/arenaKits';

export type ArenaKitBuilderStep =
    | 'identity'
    | 'stats'
    | 'skills'
    | 'pots'
    | 'catalog'
    | 'review';

export interface ArenaKitBuilderState {
    isOpen: boolean;
    step: ArenaKitBuilderStep;
    slotIndex: ArenaSlotIndex;
    /** Working draft; null when closed. */
    draft: ArenaKit | null;
}

const initial: ArenaKitBuilderState = {
    isOpen: false,
    step: 'identity',
    slotIndex: 0,
    draft: null,
};

export const arenaKitBuilderStore = new Store<ArenaKitBuilderState>(initial);

export function openArenaKitBuilder(slotIndex: ArenaSlotIndex, draft: ArenaKit) {
    // Drop removed SKUs (set-hp50-war, etc.) so Review never hard-blocks Complete.
    const catalogPurchases = sanitizeCatalogPurchases(draft.catalogPurchases ?? []);
    arenaKitBuilderStore.setState(() => ({
        isOpen: true,
        step: 'identity',
        slotIndex,
        draft: { ...draft, slotIndex, catalogPurchases },
    }));
}

export function closeArenaKitBuilder() {
    arenaKitBuilderStore.setState(() => ({ ...initial }));
}

export function setArenaKitBuilderStep(step: ArenaKitBuilderStep) {
    arenaKitBuilderStore.setState((s) => ({ ...s, step }));
}

export function setArenaKitDraft(draft: ArenaKit) {
    arenaKitBuilderStore.setState((s) => ({ ...s, draft }));
}

export function patchArenaKitDraft(patch: Partial<ArenaKit>) {
    arenaKitBuilderStore.setState((s) => {
        if (!s.draft) {
            return s;
        }
        return { ...s, draft: { ...s.draft, ...patch } };
    });
}
