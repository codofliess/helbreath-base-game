import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import {
    explorerDollViewportHeight,
    renderSelectCharPaperDoll,
    selectCharPaperDollLookKey,
} from '../../utils/selectCharPaperDoll';
import { ReferralCharListPanel } from './ReferralCharListPanel';

type SealDrops =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error' }
    | { status: 'ready'; rows: UnclaimedDrop[] };

export interface ExplorerHubScroller {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}

/**
 * PageDown/PageUp must move `.explorer-hub-scroll` only.
 * The browser otherwise pages the gate: `overflow: hidden` is still a scrollport,
 * and the sticky header cannot stick through it, so the title leaves the viewport.
 * Home/End stay with text fields so the caret is not stolen.
 */
export function scrollExplorerHubOnPageKey(
    key: string,
    scroll: ExplorerHubScroller,
    target: EventTarget | null,
): boolean {
    if (key !== 'PageDown' && key !== 'PageUp' && key !== 'Home' && key !== 'End') {
        return false;
    }
    const tag =
        target && typeof target === 'object' && 'tagName' in target
            ? String((target as { tagName?: string }).tagName || '')
            : '';
    const editing =
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (typeof HTMLElement !== 'undefined' &&
            target instanceof HTMLElement &&
            target.isContentEditable);
    if (editing) {
        return false;
    }
    if (tag === 'INPUT' && (key === 'Home' || key === 'End')) {
        return false;
    }
    const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const page = Math.max(1, Math.floor(scroll.clientHeight * 0.85));
    if (key === 'PageDown') {
        scroll.scrollTop = Math.min(max, scroll.scrollTop + page);
        return true;
    }
    if (key === 'PageUp') {
        scroll.scrollTop = Math.max(0, scroll.scrollTop - page);
        return true;
    }
    if (key === 'Home') {
        scroll.scrollTop = 0;
        return true;
    }
    scroll.scrollTop = max;
    return true;
}

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
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const scroll = scrollRef.current;
            if (!scroll || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            if (!scrollExplorerHubOnPageKey(event.key, scroll, event.target)) {
                return;
            }
            event.preventDefault();
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

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

                <div className="explorer-hub-scroll" ref={scrollRef}>
                    <div className="explorer-hub-grid">
                        <section className="explorer-hub-roster" aria-labelledby="explorer-roster-title">
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
                        </section>

                        <ExplorerPaperDoll slot={occupied} />

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
                    </div>

                    <ReferralCharListPanel placement="embedded" />
                </div>
            </div>
        </div>
    );
}

/**
 * Largest integer scale that fits, then the integer nearest 70% of that.
 * Width and height stay whole multiples of the sprite, so the pixels stay sharp.
 */
function integerScaleNearRatio(fit: number, ratio: number): number {
    if (fit <= 1) {
        return Math.max(0, fit);
    }
    const target = fit * ratio;
    const lower = Math.max(1, Math.floor(target));
    const upper = Math.min(fit, Math.ceil(target));
    if (lower === upper) {
        return lower;
    }
    return target - lower <= upper - target ? lower : upper;
}

function scrollContentPadding(node: Element): { top: number; bottom: number } {
    const style = getComputedStyle(node);
    const top = Number.parseFloat(style.paddingTop);
    const bottom = Number.parseFloat(style.paddingBottom);
    return {
        top: Number.isFinite(top) ? top : 0,
        bottom: Number.isFinite(bottom) ? bottom : 0,
    };
}

function desktopPortrait(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(min-width: 801px)').matches;
}

/**
 * Middle column: the selected character's idle-south paper-doll.
 * The column is the scrollport, not the detail-card row, so the figure stays
 * beside the name and stats. Scale is the integer nearest 70% of that fit.
 */
function ExplorerPaperDoll({ slot }: { slot: CharacterSlotSummary | undefined }) {
    const frameRef = useRef<HTMLDivElement>(null);
    const slotRef = useRef(slot);
    slotRef.current = slot;
    const lookKey = slot ? selectCharPaperDollLookKey(slot) : '';
    const [avatar, setAvatar] = useState<{ key: string; url?: string; reason?: string } | undefined>();
    const painted = avatar?.key === lookKey ? avatar : undefined;
    const url = painted?.url;
    const reason = painted?.reason;
    const [natural, setNatural] = useState<{ w: number; h: number } | undefined>();
    const [box, setBox] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const current = slotRef.current;
        if (!current || !lookKey) {
            setAvatar(undefined);
            setNatural(undefined);
            return;
        }
        let cancelled = false;
        const key = lookKey;
        const name = current.name || 'character';
        setNatural(undefined);
        setAvatar(undefined);
        void renderSelectCharPaperDoll(current).then((next) => {
            if (cancelled) {
                return;
            }
            if (next.url) {
                setAvatar({ key, url: next.url });
                return;
            }
            const why = next.reason ?? 'compose returned no image';
            console.warn(`[explorer-hub] paper-doll unavailable for ${name}: ${why}`);
            setAvatar({ key, reason: why });
        });
        return () => {
            cancelled = true;
        };
    }, [lookKey]);

    useEffect(() => {
        if (!url) {
            setNatural(undefined);
            return;
        }
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            }
        };
        img.onerror = () => {
            if (cancelled) {
                return;
            }
            const why = 'composed image failed to decode';
            console.warn(`[explorer-hub] paper-doll unavailable for ${slotRef.current?.name || 'character'}: ${why}`);
            setNatural(undefined);
            setAvatar({ key: lookKey, reason: why });
        };
        img.src = url;
        return () => {
            cancelled = true;
        };
    }, [lookKey, url]);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame) {
            return;
        }
        const scroll = frame.closest('.explorer-hub-scroll');
        const measure = () => {
            const width = Math.floor(frame.getBoundingClientRect().width);
            const frameHeight = Math.floor(frame.getBoundingClientRect().height);
            const port =
                scroll instanceof HTMLElement
                    ? explorerDollViewportHeight(
                          scroll.clientHeight,
                          scrollContentPadding(scroll).top,
                          scrollContentPadding(scroll).bottom,
                      )
                    : frameHeight;
            const height = desktopPortrait() ? port : frameHeight > 16 ? frameHeight : port;
            setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        if (scroll) {
            observer.observe(scroll);
        }
        return () => observer.disconnect();
    }, []);

    const viewportHeight = desktopPortrait() && box.h > 16 ? box.h : undefined;
    const fit =
        natural && box.w > 16 && box.h > 16
            ? Math.max(
                  1,
                  Math.min(
                      Math.floor((box.w - 12) / natural.w),
                      Math.floor((box.h - 12) / natural.h),
                  ),
              )
            : 0;
    const scale = integerScaleNearRatio(fit, 0.7);
    const drawnW = natural && scale > 0 ? natural.w * scale : 0;
    const drawnH = natural && scale > 0 ? natural.h * scale : 0;
    const showSprite = !!url && drawnW > 0 && drawnH > 0;

    return (
        <section
            className="explorer-hub-doll"
            aria-label="Selected character"
            ref={frameRef}
            data-doll-state={showSprite ? 'ready' : slot ? (reason ? 'fallback' : 'loading') : 'empty'}
            style={viewportHeight ? { height: viewportHeight, maxHeight: viewportHeight } : undefined}
        >
            {showSprite ? (
                <img
                    className="explorer-hub-doll-sprite"
                    src={url}
                    alt=""
                    width={drawnW}
                    height={drawnH}
                    style={{ width: drawnW, height: drawnH }}
                    draggable={false}
                    data-explorer-doll={slot?.name ?? ''}
                    data-doll-fit={fit}
                    data-doll-scale={scale}
                />
            ) : (
                <p className="explorer-hub-doll-fallback">
                    <strong>{slot?.name || 'Empty slot'}</strong>
                    {slot
                        ? reason
                            ? 'Portrait unavailable'
                            : 'Painting portrait…'
                        : 'Create a character to see a portrait here.'}
                </p>
            )}
        </section>
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
