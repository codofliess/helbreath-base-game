import { Store } from '@tanstack/react-store';

export interface WarehouseItemRow {
    itemId: number;
    itemUid: string;
    quantity: number;
    name: string;
}

interface WarehouseDialogState {
    isOpen: boolean;
    npcId: string | undefined;
    npcName: string;
    items: WarehouseItemRow[];
    maxSlots: number;
    statusMessage: string;
}

const initialState: WarehouseDialogState = {
    isOpen: false,
    npcId: undefined,
    npcName: 'William',
    items: [],
    maxSlots: 120,
    statusMessage: '',
};

export const warehouseDialogStore = new Store<WarehouseDialogState>(initialState);

export const openWarehouseDialog = (npcId: string, npcName: string) => {
    warehouseDialogStore.setState(() => ({
        isOpen: true,
        npcId,
        npcName: npcName || 'William',
        items: [],
        maxSlots: 120,
        statusMessage: 'Opening warehouse…',
    }));
};

export const setWarehouseDialogOpen = (value: boolean) => {
    warehouseDialogStore.setState((state) => ({
        ...state,
        isOpen: value,
        ...(value
            ? {}
            : { npcId: undefined, items: [], statusMessage: '' }),
    }));
};

export const setWarehouseStatusMessage = (message: string) => {
    warehouseDialogStore.setState((state) => ({ ...state, statusMessage: message }));
};

export const applyWarehouseState = (payload: {
    items: WarehouseItemRow[];
    maxSlots: number;
    message: string;
}) => {
    warehouseDialogStore.setState((state) => ({
        ...state,
        items: payload.items,
        maxSlots: payload.maxSlots > 0 ? payload.maxSlots : state.maxSlots,
        statusMessage: payload.message || state.statusMessage,
    }));
};
