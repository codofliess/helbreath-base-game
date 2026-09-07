import { useEffect } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_SELECTCHAR_ACTION,
    OUT_UI_SELECTCHAR_BACK,
} from '../../constants/EventNames';
import {
    paintSelectCharSlotRows,
    resolveSelectCharSelectedIndex,
} from '../../game/ui/selectCharDeskSync';
import { SELECTCHAR_OCCUPIED_SLOT_LABEL } from '../../game/ui/selectCharSlotGlyphs';
import { connectDialogStore, setSelectedSlotIndex } from '../store/ConnectDialog.store';

/**
 * React Explorer SELECTCHAR. Occupied + name + level are DOM text so KindGem
 * does not need Phaser desks (those OOMed Chrome Error 9 after PR #48).
 */
export function SelectCharReactDesk() {
    const characterSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const selectedSlotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
    const loading = useStore(connectDialogStore, (s) => s.characterListLoading);
    const wallet = useStore(connectDialogStore, (s) => s.walletSession?.wallet);
    const rows = paintSelectCharSlotRows(characterSlots);
    const selected = resolveSelectCharSelectedIndex(characterSlots, selectedSlotIndex);
    const selectedOccupied = !!rows[selected]?.occupied;
    const hasEmpty = rows.some((row) => !row.occupied);

    useEffect(() => {
        document.body.classList.add('login-selectchar-active');
        return () => {
            document.body.classList.remove('login-selectchar-active');
        };
    }, []);

    const walletShort = wallet
        ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
        : '';

    return (
        <div className="login-desk-gate" data-dialog-id="selectchar-react-desk">
            <div className="login-desk-frame login-desk-frame--fallback">
                <div className="login-desk-brand">
                    <span className="login-desk-brand-kicker">Helbreath</span>
                    <span className="login-desk-brand-title">Explorer</span>
                </div>
                <div className="login-desk-slots" role="list">
                    {rows.map((row, slotIndex) => {
                        const occupied = !!row.occupied;
                        return (
                            <button
                                key={slotIndex}
                                type="button"
                                role="listitem"
                                className={`login-desk-slot${occupied ? '' : ' is-empty'}${
                                    slotIndex === selected ? ' is-selected' : ''
                                }`}
                                data-occupied={occupied ? '1' : '0'}
                                onClick={() => setSelectedSlotIndex(slotIndex)}
                            >
                                {occupied ? (
                                    <>
                                        <span className="login-desk-slot-bracket">
                                            {SELECTCHAR_OCCUPIED_SLOT_LABEL}
                                        </span>
                                        <span className="login-desk-slot-name">{row.name}</span>
                                        <span className="login-desk-slot-line">{row.lev}</span>
                                    </>
                                ) : (
                                    <span className="login-desk-slot-empty">Empty</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="login-desk-form-slot">
                    {walletShort ? <div className="login-desk-wallet-chip">Seal {walletShort}</div> : null}
                    <p className="login-desk-status">
                        {loading
                            ? 'Loading character list…'
                            : selectedOccupied
                              ? `${SELECTCHAR_OCCUPIED_SLOT_LABEL} — ${rows[selected].name} ${rows[selected].lev}`
                              : 'Empty slot — Create Character'}
                    </p>
                    <div className="login-desk-actions">
                        <button
                            type="button"
                            className="login-gate-primary-btn"
                            disabled={!selectedOccupied}
                            onClick={() =>
                                EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                                    kind: 'start',
                                    slotIndex: selected,
                                })
                            }
                        >
                            Start
                        </button>
                        <button
                            type="button"
                            className="login-gate-secondary-btn"
                            disabled={!hasEmpty}
                            onClick={() => {
                                const empty = rows.findIndex((r) => !r.occupied);
                                EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                                    kind: 'create',
                                    slotIndex: empty >= 0 ? empty : selected,
                                });
                            }}
                        >
                            Create Character
                        </button>
                        <button
                            type="button"
                            className="login-gate-secondary-btn"
                            onClick={() => EventBus.emit(OUT_UI_SELECTCHAR_BACK)}
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
