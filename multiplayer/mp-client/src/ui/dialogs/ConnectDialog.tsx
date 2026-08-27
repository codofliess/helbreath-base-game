import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CONNECT_TO_SERVER, TOAST_REQUESTED } from '../../constants/EventNames';
import { connectDialogStore, setConnectDialogOpen, setLastConnectAttempt } from '../store/ConnectDialog.store';
import {
    FORBIDDEN_PRODUCTION_PLAY_HOST,
    IS_PLAYTEST,
    PLAYTEST_CHARACTER_NAME,
    PLAYTEST_WS_PORT,
    getPlaytestWsHost,
    isRunningOnForbiddenProductionHost,
} from '../../playtest';

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
    const [characterName, setCharacterName] = useState('');
    const [host, setHost] = useState('localhost');
    const [portText, setPortText] = useState('1337');
    const blockedOnProductionHost = IS_PLAYTEST && isRunningOnForbiddenProductionHost();

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (IS_PLAYTEST) {
            setCharacterName(PLAYTEST_CHARACTER_NAME);
            setHost(getPlaytestWsHost());
            setPortText(String(PLAYTEST_WS_PORT));
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
    }, [isOpen, defaultCharacterName, lastAttempt]);

    const handleConnect = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (IS_PLAYTEST) {
            if (blockedOnProductionHost) {
                EventBus.emit(TOAST_REQUESTED, {
                    message: `Playtest builds must not run on ${FORBIDDEN_PRODUCTION_PLAY_HOST}.`,
                    severity: 'error',
                });
                return;
            }
            const playtestHost = getPlaytestWsHost();
            setLastConnectAttempt({
                characterName: PLAYTEST_CHARACTER_NAME,
                host: playtestHost,
                port: PLAYTEST_WS_PORT,
            });
            setConnectDialogOpen(false);
            EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
                host: playtestHost,
                port: PLAYTEST_WS_PORT,
                characterName: PLAYTEST_CHARACTER_NAME,
            });
            return;
        }

        const trimmedName = characterName.trim();
        if (trimmedName.length === 0) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Character name is required.', severity: 'warning' });
            return;
        }

        const trimmedHost = host.trim();
        if (trimmedHost.length === 0) {
            EventBus.emit(TOAST_REQUESTED, { message: 'Host is required.', severity: 'warning' });
            return;
        }

        const portNum = Number.parseInt(portText.trim(), 10);
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
            title={IS_PLAYTEST ? 'Playtest' : 'Connect'}
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
                {IS_PLAYTEST ? (
                    <>
                        <p style={{ margin: 0, lineHeight: 1.45 }}>
                            Dedicated playtest host. No Phantom, wallet connect, $HELL, airdrop, or mint.
                        </p>
                        <p style={{ margin: 0, lineHeight: 1.45 }}>
                            Character: <strong>{PLAYTEST_CHARACTER_NAME}</strong>
                        </p>
                        {blockedOnProductionHost ? (
                            <p style={{ margin: 0, color: '#c45c5c', lineHeight: 1.45 }}>
                                Refusing to connect: this playtest build is on {FORBIDDEN_PRODUCTION_PLAY_HOST}. Use a separate host.
                            </p>
                        ) : null}
                        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: '8px' }}>
                            <RpgButton onClick={handleConnect} style={{ width: '180px' }} disabled={blockedOnProductionHost}>
                                {`Enter as ${PLAYTEST_CHARACTER_NAME}`}
                            </RpgButton>
                        </div>
                    </>
                ) : (
                    <>
                        <label>
                            Character name
                            <input
                                type="text"
                                value={characterName}
                                onChange={(ev) => setCharacterName(ev.target.value)}
                                style={inputStyle}
                                autoComplete="username"
                            />
                        </label>
                        <label>
                            Host
                            <input
                                type="text"
                                value={host}
                                onChange={(ev) => setHost(ev.target.value)}
                                style={inputStyle}
                                autoComplete="off"
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
                            />
                        </label>
                        <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: '8px' }}>
                            <RpgButton onClick={handleConnect} style={{ width: '140px' }}>
                                Connect
                            </RpgButton>
                        </div>
                    </>
                )}
            </div>
        </DraggableDialog>
    );
}
