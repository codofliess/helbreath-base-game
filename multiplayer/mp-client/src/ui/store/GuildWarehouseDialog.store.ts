import { createDialogStore } from './utils';

interface GuildWarehouseDialogState {
    isOpen: boolean;
}

const initialState: GuildWarehouseDialogState = {
    isOpen: false,
};

const {
    store: guildWarehouseDialogStore,
    toggle: toggleGuildWarehouseDialog,
    setOpen: setGuildWarehouseDialogOpen,
} = createDialogStore(initialState);

export { guildWarehouseDialogStore, toggleGuildWarehouseDialog, setGuildWarehouseDialogOpen };

export function openGuildWarehouseDialog(): void {
    setGuildWarehouseDialogOpen(true);
}
