import { Store } from '@tanstack/react-store';

interface ShopDialogState {
    isOpen: boolean;
    /** Server NPC instance id (stringified int64) used for BuyShopItemRequest. */
    npcId: string | undefined;
    npcName: string;
    statusMessage: string;
}

const initialState: ShopDialogState = {
    isOpen: false,
    npcId: undefined,
    npcName: 'Shop Keeper',
    statusMessage: '',
};

export const shopDialogStore = new Store<ShopDialogState>(initialState);

export const openShopDialog = (npcId: string, npcName: string) => {
    shopDialogStore.setState(() => ({
        isOpen: true,
        npcId,
        npcName: npcName || 'Shop Keeper',
        statusMessage: '',
    }));
};

export const setShopDialogOpen = (value: boolean) => {
    shopDialogStore.setState((state) => ({
        ...state,
        isOpen: value,
        ...(value ? {} : { npcId: undefined, statusMessage: '' }),
    }));
};

export const setShopStatusMessage = (message: string) => {
    shopDialogStore.setState((state) => ({ ...state, statusMessage: message }));
};
