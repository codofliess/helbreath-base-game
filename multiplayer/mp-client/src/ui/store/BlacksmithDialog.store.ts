import { Store } from '@tanstack/react-store';

interface BlacksmithDialogState {
    isOpen: boolean;
    npcId: string | undefined;
    npcName: string;
    statusMessage: string;
}

const initialState: BlacksmithDialogState = {
    isOpen: false,
    npcId: undefined,
    npcName: 'Tom',
    statusMessage: '',
};

export const blacksmithDialogStore = new Store<BlacksmithDialogState>(initialState);

export const openBlacksmithDialog = (npcId: string, npcName: string) => {
    blacksmithDialogStore.setState(() => ({
        isOpen: true,
        npcId,
        npcName: npcName || 'Tom',
        statusMessage: '',
    }));
};

export const setBlacksmithDialogOpen = (value: boolean) => {
    blacksmithDialogStore.setState((state) => ({
        ...state,
        isOpen: value,
        ...(value ? {} : { npcId: undefined, statusMessage: '' }),
    }));
};

export const setBlacksmithStatusMessage = (message: string) => {
    blacksmithDialogStore.setState((state) => ({ ...state, statusMessage: message }));
};
