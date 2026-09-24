import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CONNECT_TO_SERVER, TOAST_REQUESTED } from '../../constants/EventNames';
import { connectDialogStore, setConnectDialogOpen, setLastConnectAttempt } from '../store/ConnectDialog.store';
import {
    getPlaytestSeat,
    isPlaytestClient,
    isPlaytestGmClient,
    PLAYTEST_GAME_HOST,
    PLAYTEST_GAME_PORT,
} from '../../playtest/playtestMode';

const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    marginTop: '4px',
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: 'var(--rpg-parchment)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    border: '1px solid #704214',
    borderRadius: '2px',
};

interface ConnectDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function ConnectDialog({
    position,
    zIndex,
    onBringToFront,
}: ConnectDialogProps) {
    const { isOpen, defaultCharacterName, lastAttempt } = useStore(connectDialogStore, (s) => s);
    const playtest = isPlaytestClient();
    const [characterName, setCharacterName] = useState('');
    const [host, setHost] = useState('localhost');
    const [portText, setPortText] = useState('1337');

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (playtest) {
            const seat = getPlaytestSeat();
            setCharacterName(seat.characterName);
            setHost(PLAYTEST_GAME_HOST);
            setPortText(String(PLAYTEST_GAME_PORT));
            return;
        }
        const init = lastAttempt ?? {
            characterName: defaultCharacterName,
            host: 'localhost',
            port: 1337,
        };
        setCharacterName(init.characterName);
        setHost(init.host);
        setPortText(String(init.port));
    }, [isOpen, defaultCharacterName, lastAttempt, playtest]);

    const handleConnect = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const seat = playtest ? getPlaytestSeat() : undefined;
        const trimmedName = seat ? seat.characterName : characterName.trim();
        const trimmedHost = seat ? PLAYTEST_GAME_HOST : host.trim();
        const portNum = seat ? PLAYTEST_GAME_PORT : Number.parseInt(portText.trim(), 10);
        if (trimmedName.length === 0) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Character name is required.', severity: 'warning' });
            return;
        }

        if (trimmedHost.length === 0) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Host is required.', severity: 'warning' });
            return;
        }

        if (!Number.isFinite(portNum) || portNum < 1 || portNum > 65535) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Port must be a number from 1 to 65535.', severity: 'warning' });
            return;
        }

        setLastConnectAttempt({
            characterName: trimmedName,
            host: trimmedHost,
            port: portNum,
        });
        setConnectDialogOpen(false);
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host: trimmedHost,
            port: portNum,
            characterName: trimmedName,
        });
    };

    if (!isOpen) {
        return null;
    }

    return (
        <DraggableDialog
            title="Connect"
            position={position}
            id="connect-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => {
                ev.preventDefault();
            }}
        >
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    color: 'var(--rpg-parchment)',
                    fontFamily: 'Georgia, serif',
                    fontSize: '14px',
                    minWidth: '280px',
                    paddingBottom: '4px',
                }}
            >
                <label>
                    Character name
                    <input
                        type="text"
                        value={characterName}
                        onChange={(ev) => setCharacterName(ev.target.value)}
                        style={inputStyle}
                        autoComplete="username"
                        readOnly={playtest}
                    />
                </label>
                {playtest && (
                    <div>
                        {isPlaytestGmClient() ? 'GM' : 'Traveler'} · {getPlaytestSeat().agentLabel} · {getPlaytestSeat().accountId}
                    </div>
                )}
                <label>
                    Host
                    <input
                        type="text"
                        value={host}
                        onChange={(ev) => setHost(ev.target.value)}
                        style={inputStyle}
                        autoComplete="off"
                        readOnly={playtest}
                    />
                </label>
                <label>
                    Port
                    <input
                        type="number"
                        min={1}
                        max={65535}
                        value={portText}
                        onChange={(ev) => setPortText(ev.target.value)}
                        style={inputStyle}
                        autoComplete="off"
                        readOnly={playtest}
                    />
                </label>
                <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: '8px' }}>
                    <RpgButton onClick={handleConnect} style={{ width: '180px' }}>
                        {playtest ? `Enter as ${characterName}` : 'Connect'}
                    </RpgButton>
                </div>
            </div>
        </DraggableDialog>
    );
}
