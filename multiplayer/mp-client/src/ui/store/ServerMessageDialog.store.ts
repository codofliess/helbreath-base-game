import { EventBus } from '../../game/EventBus';
import { SERVER_MESSAGE_RECEIVED, TOAST_REQUESTED } from '../../constants/EventNames';
import { createDialogStore } from './utils';

interface ServerMessageDialogState {
    isOpen: boolean;
    message: string;
}

const initialState: ServerMessageDialogState = {
    isOpen: false,
    message: '',
};

const { store: serverMessageDialogStore, setOpen: setServerMessageDialogOpen } = createDialogStore(initialState);

export { serverMessageDialogStore, setServerMessageDialogOpen };

export const setServerMessageDialogMessage = (message: string) => {
    serverMessageDialogStore.setState((state) => ({ ...state, message }));
};

/** Connection / kick noise — toast only, never a blocking modal. */
const TRANSIENT_SERVER_MSG =
    /disconnect|failed to connect|not receiving ping|too high ping|browser tab was suspended|timed out|character list|connection closed|closing connection/i;

/** Same text within this window is dropped (stops modal/toast spam when the stack flaps). */
const DEDUPE_MS = 12_000;
let lastMsg = '';
let lastAt = 0;

/**
 * Olympia-style notices: floating letters only (bottom stack).
 * NEVER open a blocking "Server Message" modal mid-fight (shield unequip, SA release, etc.).
 */
EventBus.on(SERVER_MESSAGE_RECEIVED, ({ message }: { message: string }) => {
    const text = (message ?? '').trim();
    if (!text) {
        return;
    }
    const now = Date.now();
    if (text === lastMsg && now - lastAt < DEDUPE_MS) {
        return;
    }
    lastMsg = text;
    lastAt = now;

    const severity = TRANSIENT_SERVER_MSG.test(text)
        ? 'warning'
        : /error|fail|cannot|can't|unable|denied|invalid/i.test(text)
          ? 'error'
          : /success|released|equipped|unequipped|ok|done/i.test(text)
            ? 'success'
            : 'info';

    EventBus.emit(TOAST_REQUESTED, {
        message: text,
        severity,
        autoClose: severity === 'error' ? 5000 : 3500,
    });
});
