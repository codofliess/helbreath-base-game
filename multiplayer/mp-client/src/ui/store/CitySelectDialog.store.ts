import { Store } from '@tanstack/react-store';

export type CityFaction = 'aresden' | 'elvine';

interface CitySelectDialogState {
    isOpen: boolean;
    /** Set after the player picks Aresden/Elvine this session (survives map warps). */
    hasChosenCity: boolean;
    chosenCity: CityFaction | undefined;
}

const initialState: CitySelectDialogState = {
    isOpen: false,
    hasChosenCity: false,
    chosenCity: undefined,
};

export const citySelectDialogStore = new Store<CitySelectDialogState>(initialState);

export function setCitySelectDialogOpen(isOpen: boolean): void {
    citySelectDialogStore.setState((state) => ({ ...state, isOpen }));
}

export function markCityChosen(city: CityFaction): void {
    citySelectDialogStore.setState(() => ({
        isOpen: false,
        hasChosenCity: true,
        chosenCity: city,
    }));
}

/** Clears city-pick state on logout so the next login can show traveler → city again. */
export function resetCitySelectDialog(): void {
    citySelectDialogStore.setState(() => ({ ...initialState }));
}
