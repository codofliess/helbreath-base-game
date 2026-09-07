import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_SELECTCHAR_ACTION,
    OUT_UI_SELECTCHAR_BACK,
} from '../../constants/EventNames';
import {
    paintExplorerSelectCharRows,
    unusedDeskSlotIndex,
} from '../../game/ui/selectCharDeskSync';
import { SELECTCHAR_OCCUPIED_SLOT_LABEL } from '../../game/ui/selectCharSlotGlyphs';
import { connectDialogStore, setSelectedSlotIndex } from '../store/ConnectDialog.store';

/**
 * React Explorer SELECTCHAR. Highest-level traveler sits on the left and is
 * selected for Enter. Arrow keys move right/left; Start uses server slotIndex.
 */
export function SelectCharReactDesk() {
    const characterSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const selectedSlotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
    const loading = useStore(connectDialogStore, (s) => s.characterListLoading);
    const wallet = useStore(connectDialogStore, (s) => s.walletSession?.wallet);
    const rows = useMemo(() => paintExplorerSelectCharRows(characterSlots), [characterSlots]);
    const emptyServerSlot = unusedDeskSlotIndex(characterSlots);
    const [visualIndex, setVisualIndex] = useState(0);
    const deskRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const match = rows.findIndex((row) => row.occupied?.slotIndex === selectedSlotIndex);
        if (match >= 0) {
            setVisualIndex(match);
        }
    }, [rows, selectedSlotIndex]);

    const selectedRow = rows[visualIndex];
    const selectedOccupied = selectedRow?.occupied;
    const hasEmpty = rows.some((row) => !row.occupied);

    const selectVisual = useCallback(
        (index: number) => {
            const next = Math.max(0, Math.min(3, index));
            setVisualIndex(next);
            const row = rows[next];
            setSelectedSlotIndex(row?.occupied?.slotIndex ?? emptyServerSlot);
        },
        [emptyServerSlot, rows],
    );

    const startSelected = useCallback(() => {
        if (!selectedOccupied) {
            return;
        }
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
            kind: 'start',
            slotIndex: selectedOccupied.slotIndex,
        });
    }, [selectedOccupied]);

    const createOnEmpty = useCallback(() => {
        if (!hasEmpty) {
            return;
        }
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
            kind: 'create',
            slotIndex: emptyServerSlot,
        });
    }, [emptyServerSlot, hasEmpty]);

    useEffect(() => {
        document.body.classList.add('login-selectchar-active');
        deskRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            const target = event.target;
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                selectVisual(visualIndex + 1);
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                selectVisual(visualIndex - 1);
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (selectedOccupied) {
                    startSelected();
                } else {
                    createOnEmpty();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.classList.remove('login-selectchar-active');
            window.removeEventListener('keydown', onKey);
        };
    }, [createOnEmpty, selectVisual, selectedOccupied, startSelected, visualIndex]);

    const walletShort = wallet
        ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}`
        : '';

    return (
        <div
            ref={deskRef}
            className="login-desk-gate"
            data-dialog-id="selectchar-react-desk"
            tabIndex={0}
        >
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
                                key={`${row.occupied?.slotIndex ?? 'empty'}-${slotIndex}-${row.name}`}
                                type="button"
                                role="listitem"
                                className={`login-desk-slot${occupied ? '' : ' is-empty'}${
                                    slotIndex === visualIndex ? ' is-selected' : ''
                                }`}
                                data-occupied={occupied ? '1' : '0'}
                                onClick={() => selectVisual(slotIndex)}
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
                              ? `${SELECTCHAR_OCCUPIED_SLOT_LABEL} — ${selectedOccupied.name} ${selectedRow.lev}`
                              : 'Empty slot — Create Character'}
                    </p>
                    <p className="login-desk-nft-note">← → switch · Enter starts the selected traveler</p>
                    <div className="login-desk-actions">
                        <button
                            type="button"
                            className="login-gate-primary-btn"
                            disabled={!selectedOccupied}
                            onClick={startSelected}
                        >
                            Start
                        </button>
                        <button
                            type="button"
                            className="login-gate-secondary-btn"
                            disabled={!hasEmpty}
                            onClick={createOnEmpty}
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
