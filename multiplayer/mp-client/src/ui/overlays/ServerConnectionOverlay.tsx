import { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { getChatLanguageById } from '../../constants/ChatLanguages';
import { chatTranslationStore } from '../store/ChatTranslation.store';
import {
    gameServerLinkStore,
    refreshGameConnectionOverlay,
    serverConnectionCopy,
} from '../../utils/gameConnectionGate';
import { retryExistingGameConnect } from '../../utils/gameReconnect';

/**
 * Non-dismissable cover while GameWorld is up without a live join.
 * Reconectar retries the existing Start flow; an unbound wallet returns to Bind Phantom.
 */
export function ServerConnectionOverlay() {
    const phase = useStore(gameServerLinkStore, (state) => state.phase);
    const showOverlay = useStore(gameServerLinkStore, (state) => state.showOverlay);
    const reason = useStore(gameServerLinkStore, (state) => state.reason);
    const languageId = useStore(chatTranslationStore, (state) => state.preferredLanguageId);

    useEffect(() => {
        const id = window.setInterval(() => refreshGameConnectionOverlay(), 1000);
        return () => window.clearInterval(id);
    }, []);

    if (!showOverlay || !reason) {
        return null;
    }

    const copy = serverConnectionCopy(getChatLanguageById(languageId)?.mtCode);
    const reasonText = reason === 'connection-lost' ? copy.reasonConnectionLost : copy.reasonNotConnected;

    return (
        <div
            className="server-connection-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="server-connection-title"
            aria-describedby="server-connection-reason"
            onContextMenu={(event) => event.preventDefault()}
        >
            <div className="server-connection-overlay-card">
                <h2 id="server-connection-title" className="server-connection-overlay-title">
                    {copy.title}
                </h2>
                <p id="server-connection-reason" className="server-connection-overlay-reason">
                    {reasonText}
                </p>
                <button
                    type="button"
                    className="login-gate-primary-btn server-connection-overlay-reconnect"
                    disabled={phase === 'connecting'}
                    onClick={() => retryExistingGameConnect()}
                >
                    {copy.reconnect}
                </button>
            </div>
        </div>
    );
}
