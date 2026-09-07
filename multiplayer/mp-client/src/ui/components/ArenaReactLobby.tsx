import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_ARENA_ACTION, OUT_UI_ARENA_BACK } from '../../constants/EventNames';
import {
    connectDialogStore,
    setArenaDeskIndex,
} from '../store/ConnectDialog.store';
import {
    getArenaKitForSlot,
    isArenaKitComplete,
    type ArenaSlotIndex,
} from '../../utils/arenaKits';
import { getStoredWalletPubkey } from '../../utils/walletAuth';

/**
 * React Arena Pre-Ready lobby. Does not construct Phaser — hub Arena clicks
 * were loading ArenaSelectCharDesk and Aw Snapping Chrome Error 9.
 */
export function ArenaReactLobby() {
    const walletSession = useStore(connectDialogStore, (s) => s.walletSession);
    const deskIndex = useStore(connectDialogStore, (s) => s.arenaDeskIndex);
    const [kitTick, setKitTick] = useState(0);
    const wallet = walletSession?.wallet ?? getStoredWalletPubkey();
    const selected = Math.max(0, Math.min(3, deskIndex)) as ArenaSlotIndex;
    const selectedKit = getArenaKitForSlot(selected, wallet);

    useEffect(() => {
        const bump = () => setKitTick((n) => n + 1);
        window.addEventListener('arena-kits-changed', bump);
        return () => window.removeEventListener('arena-kits-changed', bump);
    }, []);

    return (
        <div className="login-arena-lobby" data-dialog-id="arena-react-lobby" data-kit-tick={kitTick}>
            <div className="login-hub-atmosphere" aria-hidden="true" />
            <div className="login-arena-lobby-panel">
                <p className="login-hub-path-kicker">The Coliseum</p>
                <h2 className="login-hub-path-title">Helbreath Arena</h2>
                <p className="login-hub-path-lead">
                    Pre-Ready fighters. Phaser stays off until you enter a world.
                </p>
                {walletSession ? (
                    <div className="login-gate-wallet-chip">
                        Seal {walletSession.wallet.slice(0, 4)}…{walletSession.wallet.slice(-4)}
                    </div>
                ) : null}
                <div className="login-desk-slots" role="list">
                    {([0, 1, 2, 3] as ArenaSlotIndex[]).map((i) => {
                        const kit = getArenaKitForSlot(i, wallet);
                        const named = !!kit?.name?.trim();
                        const complete = !!(kit && named && isArenaKitComplete(kit));
                        return (
                            <button
                                key={i}
                                type="button"
                                role="listitem"
                                className={`login-desk-slot${named ? '' : ' is-empty'}${
                                    i === selected ? ' is-selected' : ''
                                }`}
                                onClick={() => {
                                    setArenaDeskIndex(i);
                                    EventBus.emit(OUT_UI_ARENA_ACTION, {
                                        kind: 'select',
                                        deskIndex: i,
                                    });
                                }}
                            >
                                {named && kit ? (
                                    <>
                                        <span className="login-desk-slot-bracket">
                                            {complete ? 'Ready' : 'Draft'}
                                        </span>
                                        <span className="login-desk-slot-name">{kit.name}</span>
                                        <span className="login-desk-slot-line">
                                            {kit.path} · slot {i + 1}
                                        </span>
                                    </>
                                ) : (
                                    <span className="login-desk-slot-empty">Empty kit</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="login-arena-lobby-actions login-desk-actions">
                    <button
                        type="button"
                        className="login-gate-primary-btn"
                        onClick={() =>
                            EventBus.emit(OUT_UI_ARENA_ACTION, {
                                kind: 'save',
                                deskIndex: selected,
                            })
                        }
                    >
                        {selectedKit ? 'Edit Fighter' : 'Create Fighter'}
                    </button>
                    <button
                        type="button"
                        className="login-gate-secondary-btn"
                        onClick={() =>
                            EventBus.emit(OUT_UI_ARENA_ACTION, {
                                kind: 'enter',
                                deskIndex: selected,
                            })
                        }
                    >
                        Create PVP Duel
                    </button>
                    <button
                        type="button"
                        className="login-gate-secondary-btn"
                        onClick={() =>
                            EventBus.emit(OUT_UI_ARENA_ACTION, {
                                kind: 'enter-bleeding',
                                deskIndex: selected,
                            })
                        }
                    >
                        Enter Bleeding Island
                    </button>
                    <button
                        type="button"
                        className="login-gate-secondary-btn"
                        onClick={() => EventBus.emit(OUT_UI_ARENA_BACK)}
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
