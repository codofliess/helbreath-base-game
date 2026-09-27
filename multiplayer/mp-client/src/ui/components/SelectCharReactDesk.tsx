import { useEffect, useState } from 'react';
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
import {
    citySealLabel,
    classifyEquippedCover,
    formatMonsterGroupLine,
    formatPendingNftLine,
} from '../../game/ui/selectCharCover';
import { getItemById } from '../../constants/Items';
import { fetchUnclaimedDrops, type UnclaimedDrop } from '../../utils/dropLedger';
import { connectDialogStore, setSelectedSlotIndex } from '../store/ConnectDialog.store';
import { ReferralCharListPanel } from './ReferralCharListPanel';

type SealDrops =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; rows: UnclaimedDrop[] };

/**
 * Explorer character hub: create or swap a slot, manage the referral code,
 * and read the selected character's cover (gear, seal NFT drops, monster groups).
 */
export function SelectCharReactDesk() {
    const characterSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const selectedSlotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
    const loading = useStore(connectDialogStore, (s) => s.characterListLoading);
    const wallet = useStore(connectDialogStore, (s) => s.walletSession?.wallet);
    const rows = paintSelectCharSlotRows(characterSlots);
    const selected = resolveSelectCharSelectedIndex(characterSlots, selectedSlotIndex);
    const selectedRow = rows[selected];
    const selectedOccupied = !!selectedRow?.occupied;
    const occupied = selectedRow?.occupied;
    const hasEmpty = rows.some((row) => !row.occupied);
    const [drops, setDrops] = useState<SealDrops>({ status: 'idle' });

    useEffect(() => {
        document.body.classList.add('login-selectchar-active');
        return () => {
            document.body.classList.remove('login-selectchar-active');
        };
    }, []);

    useEffect(() => {
        const seal = wallet?.trim() ?? '';
        if (!seal) {
            setDrops({ status: 'idle' });
            return;
        }
        let cancelled = false;
        setDrops({ status: 'loading' });
        fetchUnclaimedDrops(seal)
            .then((rows) => {
                if (!cancelled) {
                    setDrops({ status: 'ready', rows });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDrops({ status: 'error' });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [wallet]);

    const walletShort = wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : '';
    const gear = occupied ? classifyEquippedCover(occupied) : { legendary: [], rare: [] };
    const tiers = occupied?.monsterGroupTiers ?? [];
    const hours =
        occupied && occupied.hoursPlayed > 0
            ? `${occupied.hoursPlayed.toFixed(1)} h played`
            : 'Hours: —';

    return (
        <div className="login-desk-gate explorer-hub-gate" data-dialog-id="selectchar-react-desk">
            <div className="explorer-hub">
                <header className="explorer-hub-header">
                    <p className="login-desk-brand-kicker">Helbreath</p>
                    <h1 className="explorer-hub-title">Explorer</h1>
                    {walletShort ? <p className="explorer-hub-seal">Seal {walletShort}</p> : null}
                </header>

                <h2 id="explorer-roster-title" className="explorer-hub-kicker">
                    Characters
                </h2>
                <div className="explorer-hub-slots" role="list">
                    {rows.map((row, slotIndex) => {
                        const slotOccupied = !!row.occupied;
                        const isSelected = slotIndex === selected;
                        return (
                            <button
                                key={slotIndex}
                                type="button"
                                role="listitem"
                                aria-pressed={isSelected}
                                className={`explorer-hub-slot${slotOccupied ? '' : ' is-empty'}${
                                    isSelected ? ' is-selected' : ''
                                }`}
                                data-occupied={slotOccupied ? '1' : '0'}
                                onClick={() => setSelectedSlotIndex(slotIndex)}
                            >
                                {slotOccupied ? (
                                    <>
                                        <span className="explorer-hub-slot-kicker">
                                            {SELECTCHAR_OCCUPIED_SLOT_LABEL}
                                        </span>
                                        <span className="explorer-hub-slot-name">{row.name}</span>
                                        <span className="explorer-hub-slot-line">{row.lev}</span>
                                    </>
                                ) : (
                                    <span className="explorer-hub-slot-empty">Empty</span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <p className="explorer-hub-status">
                    {loading
                        ? 'Loading character list…'
                        : selectedOccupied
                          ? `${SELECTCHAR_OCCUPIED_SLOT_LABEL} — ${selectedRow.name} ${selectedRow.lev}`
                          : 'Empty slot — Create Character'}
                </p>
                <div className="explorer-hub-actions">
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

                <section className="explorer-hub-cover" aria-labelledby="explorer-cover-title">
                    {occupied ? (
                        <>
                            <h2 id="explorer-cover-title" className="explorer-hub-cover-name">
                                {occupied.name}
                            </h2>
                            <p className="explorer-hub-meta">
                                {citySealLabel(occupied.citizenshipSide)}
                                {' · '}
                                Level {occupied.level}
                                {occupied.rebirth > 0 ? ` · Rebirth +${occupied.rebirth}` : ''}
                                {' · '}
                                {hours}
                            </p>
                            <dl className="explorer-hub-stats">
                                <div>
                                    <dt>STR</dt>
                                    <dd>{occupied.str}</dd>
                                </div>
                                <div>
                                    <dt>VIT</dt>
                                    <dd>{occupied.vit}</dd>
                                </div>
                                <div>
                                    <dt>DEX</dt>
                                    <dd>{occupied.dex}</dd>
                                </div>
                                <div>
                                    <dt>INT</dt>
                                    <dd>{occupied.intel}</dd>
                                </div>
                                <div>
                                    <dt>MAG</dt>
                                    <dd>{occupied.mag}</dd>
                                </div>
                                <div>
                                    <dt>CHR</dt>
                                    <dd>{occupied.chr}</dd>
                                </div>
                            </dl>

                            <h3 className="explorer-hub-section">Legendary items</h3>
                            <ItemList names={gear.legendary} empty="No legendary items equipped." />

                            <h3 className="explorer-hub-section">Rare items</h3>
                            <ItemList names={gear.rare} empty="No rare items equipped." />

                            <h3 className="explorer-hub-section">Pending NFT drops</h3>
                            <p className="explorer-hub-note">
                                These drops belong to this seal. They are not stored on one character.
                            </p>
                            <SealDropList drops={drops} />

                            <h3 className="explorer-hub-section">Monster group tiers</h3>
                            {tiers.length > 0 ? (
                                <>
                                    <ul className="explorer-hub-list">
                                        {tiers.map((tier) => (
                                            <li key={tier.segment || tier.label}>
                                                {formatMonsterGroupLine(tier)}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="explorer-hub-note">
                                        Level is the highest kill specialty in that group. Character stake
                                        bonus +{occupied.monsterStakeBonus ?? 0}.
                                    </p>
                                </>
                            ) : (
                                <p className="explorer-hub-empty">
                                    Monster group levels are not in this character list.
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <h2 id="explorer-cover-title" className="explorer-hub-cover-name">
                                Empty slot
                            </h2>
                            <p className="explorer-hub-note">
                                Create a character to bind a player here. Legendary items, rare items, and
                                monster group levels appear on the character you select.
                            </p>
                            <h3 className="explorer-hub-section">Pending NFT drops</h3>
                            <p className="explorer-hub-note">
                                These drops belong to this seal. They are not stored on one character.
                            </p>
                            <SealDropList drops={drops} />
                        </>
                    )}
                </section>

                <ReferralCharListPanel placement="embedded" />
            </div>
        </div>
    );
}

function ItemList({ names, empty }: { names: string[]; empty: string }) {
    if (names.length === 0) {
        return <p className="explorer-hub-empty">{empty}</p>;
    }
    return (
        <ul className="explorer-hub-list">
            {names.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
            ))}
        </ul>
    );
}

function SealDropList({ drops }: { drops: SealDrops }) {
    if (drops.status === 'idle') {
        return <p className="explorer-hub-empty">Connect a seal to see pending NFT drops.</p>;
    }
    if (drops.status === 'loading') {
        return <p className="explorer-hub-empty">Loading pending NFT drops…</p>;
    }
    if (drops.status === 'error') {
        return <p className="explorer-hub-empty">Pending NFT drops could not be loaded.</p>;
    }
    if (drops.rows.length === 0) {
        return <p className="explorer-hub-empty">No pending NFT drops on this seal.</p>;
    }
    return (
        <ul className="explorer-hub-list">
            {drops.rows.map((drop) => {
                const name = getItemById(drop.item_id)?.name?.trim() || `Item ${drop.item_id}`;
                return <li key={drop.id}>{formatPendingNftLine(name, drop.nft_tier, drop.quantity)}</li>;
            })}
        </ul>
    );
}
