import { useEffect, useRef, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_SELECTCHAR_ACTION,
    OUT_UI_SELECTCHAR_BACK,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import {
    paintSelectCharSlotRows,
    resolveSelectCharSelectedIndex,
} from '../../game/ui/selectCharDeskSync';
import { SELECTCHAR_OCCUPIED_SLOT_LABEL } from '../../game/ui/selectCharSlotGlyphs';
import {
    canConfirmSelectCharDelete,
    isSelectCharStartKey,
    readLastUsedCharacterName,
    resolveRememberedSelectCharIndex,
    selectCharIndexFromKeyboardEvent,
    writeLastUsedCharacterName,
} from '../../game/ui/selectCharSelection';
import { connectDialogStore, setSelectedSlotIndex } from '../store/ConnectDialog.store';
import { ReferralCharListPanel } from './ReferralCharListPanel';
import { SelectCharSlotAvatar } from './SelectCharSlotAvatar';

/**
 * React Explorer SELECTCHAR — four equal slots, keyboard/mouse selection,
 * last-used preselect, no KindGem overlay cards on top of the desk.
 */
export function SelectCharReactDesk() {
    const characterSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const selectedSlotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
    const loading = useStore(connectDialogStore, (s) => s.characterListLoading);
    const wallet = useStore(connectDialogStore, (s) => s.walletSession?.wallet);
    const rememberedApplied = useRef(false);
    const gateRef = useRef<HTMLDivElement>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTyped, setDeleteTyped] = useState('');

    const rows = paintSelectCharSlotRows(characterSlots);
    const selected = resolveSelectCharSelectedIndex(characterSlots, selectedSlotIndex);
    const selectedOccupied = rows[selected]?.occupied;
    const hasEmpty = rows.some((row) => !row.occupied);

    useEffect(() => {
        document.body.classList.add('login-selectchar-active');
        gateRef.current?.focus();
        return () => {
            document.body.classList.remove('login-selectchar-active');
        };
    }, []);

    useEffect(() => {
        if (!deleteOpen) {
            return;
        }
        const onWin = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setDeleteOpen(false);
                setDeleteTyped('');
            }
        };
        window.addEventListener('keydown', onWin);
        return () => window.removeEventListener('keydown', onWin);
    }, [deleteOpen]);

    useEffect(() => {
        if (rememberedApplied.current || characterSlots.length === 0) {
            return;
        }
        rememberedApplied.current = true;
        const remembered = resolveRememberedSelectCharIndex(
            characterSlots,
            readLastUsedCharacterName(wallet),
            selectedSlotIndex,
        );
        if (remembered !== selectedSlotIndex) {
            setSelectedSlotIndex(remembered);
        }
    }, [characterSlots, selectedSlotIndex, wallet]);

    const walletShort = wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : '';

    const startSelected = () => {
        if (!selectedOccupied) {
            return;
        }
        writeLastUsedCharacterName(wallet, selectedOccupied.name);
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
            kind: 'start',
            slotIndex: selected,
        });
    };

    const createAtEmpty = () => {
        const empty = rows.findIndex((r) => !r.occupied);
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
            kind: 'create',
            slotIndex: empty >= 0 ? empty : selected,
        });
    };

    const onDeskKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (deleteOpen) {
            if (event.key === 'Escape') {
                event.preventDefault();
                setDeleteOpen(false);
                setDeleteTyped('');
            }
            return;
        }
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
            return;
        }
        const next = selectCharIndexFromKeyboardEvent(selected, event.key, event.shiftKey);
        if (next !== undefined) {
            event.preventDefault();
            setSelectedSlotIndex(next);
            return;
        }
        if (isSelectCharStartKey(event.key)) {
            event.preventDefault();
            if (selectedOccupied) {
                startSelected();
            } else {
                createAtEmpty();
            }
        }
    };

    const confirmDelete = () => {
        if (!canConfirmSelectCharDelete(deleteTyped, selectedOccupied?.name)) {
            return;
        }
        setDeleteOpen(false);
        setDeleteTyped('');
        EventBus.emit(TOAST_REQUESTED, {
            message: 'Delete Character is not available yet.',
            severity: 'warning',
            autoClose: 4500,
        });
    };

    return (
        <div
            ref={gateRef}
            className="login-desk-gate login-desk-gate--explorer"
            data-dialog-id="selectchar-react-desk"
            tabIndex={-1}
            onKeyDown={onDeskKeyDown}
        >
            <div className="login-desk-stack">
                <div className="login-desk-frame login-desk-frame--fallback login-desk-frame--explorer">
                    <div className="login-desk-brand">
                        <span className="login-desk-brand-kicker">Helbreath</span>
                        <span className="login-desk-brand-title">Explorer</span>
                    </div>
                    {walletShort ? (
                        <div className="login-desk-wallet-chip login-desk-wallet-chip--corner">
                            Seal {walletShort}
                        </div>
                    ) : null}
                    <div className="login-desk-slots" role="listbox" aria-label="Character slots">
                        {rows.map((row, slotIndex) => {
                            const occupied = !!row.occupied;
                            const isSelected = slotIndex === selected;
                            const label = occupied
                                ? `${row.name}, ${row.lev}${row.town ? `, ${row.town}` : ''}`
                                : `Empty slot ${slotIndex + 1}, Create Character`;
                            return (
                                <button
                                    key={slotIndex}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-label={label}
                                    tabIndex={isSelected ? 0 : -1}
                                    className={`login-desk-slot${occupied ? '' : ' is-empty'}${
                                        isSelected ? ' is-selected' : ''
                                    }`}
                                    data-occupied={occupied ? '1' : '0'}
                                    data-slot-index={slotIndex}
                                    onClick={() => setSelectedSlotIndex(slotIndex)}
                                    onDoubleClick={() => {
                                        setSelectedSlotIndex(slotIndex);
                                        if (occupied) {
                                            writeLastUsedCharacterName(wallet, row.occupied!.name);
                                            EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                                                kind: 'start',
                                                slotIndex,
                                            });
                                        } else {
                                            EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                                                kind: 'create',
                                                slotIndex,
                                            });
                                        }
                                    }}
                                >
                                    {occupied && row.occupied ? (
                                        <>
                                            <SelectCharSlotAvatar slot={row.occupied} />
                                            <span className="login-desk-slot-bracket">
                                                {SELECTCHAR_OCCUPIED_SLOT_LABEL}
                                            </span>
                                            <span className="login-desk-slot-name">{row.name}</span>
                                            <span className="login-desk-slot-line">{row.lev}</span>
                                            {row.town ? (
                                                <span className="login-desk-slot-town">{row.town}</span>
                                            ) : null}
                                            {row.lastMap ? (
                                                <span className="login-desk-slot-map">{row.lastMap}</span>
                                            ) : null}
                                        </>
                                    ) : (
                                        <span className="login-desk-slot-empty">Create Character</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="login-desk-form-slot">
                        <p className="login-desk-status">
                            {loading
                                ? 'Loading character list…'
                                : selectedOccupied
                                  ? `${SELECTCHAR_OCCUPIED_SLOT_LABEL} — ${rows[selected].name} ${rows[selected].lev}`
                                  : 'Empty slot — Create Character'}
                        </p>
                        <div className="login-desk-actions login-desk-actions--row">
                            <button
                                type="button"
                                className="login-gate-primary-btn"
                                aria-label="Start with selected character"
                                disabled={!selectedOccupied}
                                onClick={startSelected}
                            >
                                Start
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn"
                                aria-label="Create Character"
                                disabled={!hasEmpty}
                                onClick={createAtEmpty}
                            >
                                Create Character
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn"
                                aria-label="Delete selected character"
                                disabled={!selectedOccupied}
                                onClick={() => {
                                    setDeleteTyped('');
                                    setDeleteOpen(true);
                                }}
                            >
                                Delete
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn"
                                aria-label="Back to hub"
                                onClick={() => EventBus.emit(OUT_UI_SELECTCHAR_BACK)}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
                <ReferralCharListPanel variant="inline" />
            </div>
            {deleteOpen && selectedOccupied ? (
                <div
                    className="login-desk-delete-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="selectchar-delete-title"
                >
                    <div className="login-desk-delete-modal__panel">
                        <h2 id="selectchar-delete-title">Delete character</h2>
                        <p>
                            Type <strong>{selectedOccupied.name}</strong> exactly to confirm.
                        </p>
                        <label className="login-gate-field">
                            <span>Character name</span>
                            <input
                                className="olympia-input"
                                value={deleteTyped}
                                onChange={(e) => setDeleteTyped(e.target.value)}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Type the character name to confirm delete"
                            />
                        </label>
                        <div className="login-desk-actions login-desk-actions--row">
                            <button
                                type="button"
                                className="login-gate-primary-btn"
                                disabled={!canConfirmSelectCharDelete(deleteTyped, selectedOccupied.name)}
                                onClick={confirmDelete}
                            >
                                Confirm delete
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn"
                                onClick={() => {
                                    setDeleteOpen(false);
                                    setDeleteTyped('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
