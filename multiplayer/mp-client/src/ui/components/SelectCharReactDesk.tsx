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
    formatSelectCharTown,
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
    const selectedTown = selectedOccupied ? formatSelectCharTown(selectedOccupied.citizenshipSide) : '';

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
                        <span className="login-desk-brand-kicker">Under the Goddesses</span>
                        <span className="login-desk-brand-title">Choose your hero</span>
                    </div>
                    {walletShort ? (
                        <div className="login-desk-wallet-chip login-desk-wallet-chip--corner">
                            Sealed · {walletShort}
                        </div>
                    ) : null}
                    <p className="login-desk-selected-lead" aria-live="polite">
                        {loading
                            ? 'Loading character list…'
                            : selectedOccupied
                              ? `${rows[selected].name} · ${rows[selected].heroLine ?? rows[selected].lev}${
                                    selectedTown ? ` · ${selectedTown}` : ''
                                }`
                              : 'Pledge a new hero'}
                    </p>
                    <div className="login-desk-slots" role="listbox" aria-label="Character slots">
                        {rows.map((row, slotIndex) => {
                            const occupied = !!row.occupied;
                            const isSelected = slotIndex === selected;
                            const town = row.town ?? '';
                            const label = occupied
                                ? `${row.name}, ${row.heroLine ?? row.lev}${town ? `, ${town}` : ''}`
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
                                    data-town={town}
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
                                            <SelectCharSlotAvatar
                                                slot={row.occupied}
                                                animate={isSelected}
                                            />
                                            <span className="login-desk-slot-name">{row.name}</span>
                                            <span className="login-desk-slot-line">
                                                {row.heroLine ?? row.lev}
                                            </span>
                                            {town ? (
                                                <span className="login-desk-slot-town">{town}</span>
                                            ) : null}
                                            {row.lastMap ? (
                                                <span className="login-desk-slot-map">
                                                    Last seen: {row.lastMap}
                                                </span>
                                            ) : null}
                                            <span className="login-desk-slot-faction" data-town={town} />
                                        </>
                                    ) : (
                                        <>
                                            <span className="login-desk-slot-empty">+ Create Character</span>
                                            <span className="login-desk-slot-pledge">Pledge a new hero</span>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className="login-desk-form-slot">
                        <span className="sr-only">{SELECTCHAR_OCCUPIED_SLOT_LABEL}</span>
                        <div className="login-desk-actions login-desk-actions--row">
                            <button
                                type="button"
                                className="login-gate-primary-btn login-desk-enter-btn"
                                aria-label="Enter World with selected character"
                                disabled={!selectedOccupied}
                                onClick={startSelected}
                            >
                                Enter World
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn login-desk-quiet-btn"
                                aria-label="Create"
                                disabled={!hasEmpty}
                                onClick={createAtEmpty}
                            >
                                Create
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn login-desk-quiet-btn"
                                aria-label="Back to hub"
                                onClick={() => EventBus.emit(OUT_UI_SELECTCHAR_BACK)}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="login-gate-secondary-btn login-desk-quiet-btn"
                                aria-label="Delete selected character"
                                disabled={!selectedOccupied}
                                onClick={() => {
                                    setDeleteTyped('');
                                    setDeleteOpen(true);
                                }}
                            >
                                Delete
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
                        <h2 id="selectchar-delete-title">Delete hero</h2>
                        <p>
                            Type <strong>{selectedOccupied.name}</strong> to delete this hero forever.
                        </p>
                        <label className="login-gate-field">
                            <span>Hero name</span>
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
