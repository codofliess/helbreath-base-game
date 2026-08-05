import { useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import {
    ARENA_CATALOG,
    ARENA_MAGE_FREE_SPELLS,
    ARENA_POTION_POOL,
    ARENA_SKILLS_100,
    ARENA_SKILLS_50,
    ARENA_STARTER_CREDITS,
    ARENA_STAT_MIN,
    ARENA_STAT_TOTAL,
    type ArenaPath,
} from '../../constants/ArenaKitCatalog';
import { EventBus } from '../../game/EventBus';
import { TOAST_REQUESTED } from '../../constants/EventNames';
import {
    arenaKitSoftHints,
    getPvpSkills,
    kitCreditSpend,
    kitCreditsLeft,
    potionSum,
    remainingStatPoints,
    sanitizeCatalogPurchases,
    saveArenaKit,
    statsSum,
    validateArenaKit,
    type ArenaKitStats,
} from '../../utils/arenaKits';
import { getStoredWalletPubkey } from '../../utils/walletAuth';
import {
    arenaKitBuilderStore,
    closeArenaKitBuilder,
    patchArenaKitDraft,
    setArenaKitBuilderStep,
    setArenaKitDraft,
    type ArenaKitBuilderStep,
} from '../store/ArenaKitBuilder.store';

const STEPS: ArenaKitBuilderStep[] = ['identity', 'stats', 'skills', 'pots', 'catalog', 'review'];

const STEP_LABEL: Record<ArenaKitBuilderStep, string> = {
    identity: '1. Identity',
    stats: '2. Stats',
    skills: '3. Skills',
    pots: '4. Potions',
    catalog: '5. Catalog',
    review: '6. Review',
};

function StatRow({
    label,
    keyName,
    value,
    onChange,
    canInc,
    rem,
}: {
    label: string;
    keyName: keyof ArenaKitStats;
    value: number;
    onChange: (k: keyof ArenaKitStats, v: number) => void;
    canInc: boolean;
    rem: number;
}) {
    const canDec = value > ARENA_STAT_MIN;
    const canDec10 = value > ARENA_STAT_MIN;
    const canInc10 = rem > 0;
    return (
        <div className="arena-kit-stat-row">
            <span>{label}</span>
            <button
                type="button"
                className="arena-kit-stat-step10"
                disabled={!canDec10}
                title="−10"
                onClick={() => onChange(keyName, value - 10)}
            >
                −10
            </button>
            <button type="button" disabled={!canDec} title="−1" onClick={() => onChange(keyName, value - 1)}>
                −
            </button>
            <strong className="arena-kit-qty-value">{value}</strong>
            <button type="button" disabled={!canInc} title="+1" onClick={() => onChange(keyName, value + 1)}>
                +
            </button>
            <button
                type="button"
                className="arena-kit-stat-step10"
                disabled={!canInc10}
                title="+10 (o lo que quede del pool)"
                onClick={() => onChange(keyName, value + 10)}
            >
                +10
            </button>
        </div>
    );
}

/**
 * Multi-step Arena Pre-Ready fighter builder (wallet-local kits).
 */
export function ArenaKitBuilderDialog({ zIndex = 10040 }: { zIndex?: number }) {
    const { isOpen, step, draft } = useStore(arenaKitBuilderStore, (s) => s);
    const pvpSkills = useMemo(() => getPvpSkills(), []);

    if (!isOpen || !draft) {
        return null;
    }

    const rem = remainingStatPoints(draft.stats);
    const spend = kitCreditSpend(draft);
    const left = kitCreditsLeft(draft);
    const potTotal = potionSum(draft.potions);

    /** Clamp to min/pool so ±10 never soft-fails mid-build. */
    const setStat = (k: keyof ArenaKitStats, v: number) => {
        const cur = draft.stats[k];
        const others = statsSum(draft.stats) - cur;
        const maxForThis = ARENA_STAT_TOTAL - others;
        const target = Math.min(Math.max(ARENA_STAT_MIN, v), maxForThis);
        if (target === cur) {
            return;
        }
        patchArenaKitDraft({ stats: { ...draft.stats, [k]: target } });
    };

    const toggleSkill100 = (id: number) => {
        let skills100 = [...draft.skills100];
        let skills50 = draft.skills50.filter((x) => x !== id);
        if (skills100.includes(id)) {
            skills100 = skills100.filter((x) => x !== id);
        } else if (skills100.length < ARENA_SKILLS_100) {
            skills100.push(id);
        }
        patchArenaKitDraft({ skills100, skills50 });
    };

    const toggleSkill50 = (id: number) => {
        if (draft.skills100.includes(id)) {
            return;
        }
        let skills50 = [...draft.skills50];
        if (skills50.includes(id)) {
            skills50 = skills50.filter((x) => x !== id);
        } else if (skills50.length < ARENA_SKILLS_50) {
            skills50.push(id);
        }
        patchArenaKitDraft({ skills50 });
    };

    const setPath = (path: ArenaPath) => {
        patchArenaKitDraft({
            path,
            freeMageSpell: path === 'mage' ? draft.freeMageSpell ?? 'blizzard' : undefined,
        });
    };

    const addPurchase = (sku: string) => {
        const row = ARENA_CATALOG.find((c) => c.sku === sku);
        if (!row) {
            return;
        }
        const nextSpend = spend + row.cost;
        if (nextSpend > ARENA_STARTER_CREDITS) {
            EventBus.emit(TOAST_REQUESTED, {
                message: `Not enough credits (need ${row.cost}, have ${left}).`,
                severity: 'warning',
            });
            return;
        }
        const existing = draft.catalogPurchases.find((p) => p.sku === sku);
        const catalogPurchases = existing
            ? draft.catalogPurchases.map((p) => (p.sku === sku ? { ...p, qty: p.qty + 1 } : p))
            : [...draft.catalogPurchases, { sku, qty: 1 }];
        patchArenaKitDraft({ catalogPurchases });
    };

    const removePurchase = (sku: string) => {
        const catalogPurchases = draft.catalogPurchases
            .map((p) => (p.sku === sku ? { ...p, qty: p.qty - 1 } : p))
            .filter((p) => p.qty > 0);
        patchArenaKitDraft({ catalogPurchases });
    };

    const stepIndex = STEPS.indexOf(step);

    const goNext = () => {
        if (stepIndex < STEPS.length - 1) {
            setArenaKitBuilderStep(STEPS[stepIndex + 1]);
        }
    };
    const goPrev = () => {
        if (stepIndex > 0) {
            setArenaKitBuilderStep(STEPS[stepIndex - 1]);
        }
    };

    const save = (complete: boolean) => {
        // Drop removed catalog SKUs (e.g. set-hp50-war) before validate/save.
        const toSave = {
            ...draft,
            completed: complete,
            catalogPurchases: sanitizeCatalogPurchases(draft.catalogPurchases),
        };
        if (complete) {
            const errs = validateArenaKit(toSave);
            if (errs.length) {
                EventBus.emit(TOAST_REQUESTED, { message: errs[0], severity: 'warning' });
                return;
            }
        }
        const result = saveArenaKit(toSave, getStoredWalletPubkey());
        if (!result.ok) {
            EventBus.emit(TOAST_REQUESTED, { message: result.error, severity: 'error' });
            return;
        }
        EventBus.emit(TOAST_REQUESTED, {
            message: complete ? `Arena fighter ready: ${result.kit.name}` : `Draft saved: ${result.kit.name}`,
            severity: 'success',
        });
        closeArenaKitBuilder();
        // Nudge desk refresh
        window.dispatchEvent(new CustomEvent('arena-kits-changed'));
    };

    return (
        <div className="arena-kit-builder-overlay" style={{ zIndex }} onClick={closeArenaKitBuilder}>
            <div className="arena-kit-builder" onClick={(e) => e.stopPropagation()}>
                <header className="arena-kit-builder-header">
                    <h2>Arena Fighter — Slot {draft.slotIndex + 1}</h2>
                    <button type="button" className="arena-kit-builder-close" onClick={closeArenaKitBuilder}>
                        ×
                    </button>
                </header>

                <nav className="arena-kit-builder-steps">
                    {STEPS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={s === step ? 'active' : ''}
                            onClick={() => setArenaKitBuilderStep(s)}
                        >
                            {STEP_LABEL[s]}
                        </button>
                    ))}
                </nav>

                <div className="arena-kit-builder-body">
                    {step === 'identity' && (
                        <section>
                            <label>
                                Name
                                <input
                                    maxLength={10}
                                    value={draft.name}
                                    onChange={(e) => patchArenaKitDraft({ name: e.target.value })}
                                />
                            </label>
                            <div className="arena-kit-row">
                                <span>Path</span>
                                <button type="button" className={draft.path === 'war' ? 'active' : ''} onClick={() => setPath('war')}>
                                    War
                                </button>
                                <button type="button" className={draft.path === 'mage' ? 'active' : ''} onClick={() => setPath('mage')}>
                                    Mage
                                </button>
                            </div>
                            <div className="arena-kit-row">
                                <span>Gender</span>
                                <button
                                    type="button"
                                    className={draft.gender === 'male' ? 'active' : ''}
                                    onClick={() => patchArenaKitDraft({ gender: 'male' })}
                                >
                                    Male
                                </button>
                                <button
                                    type="button"
                                    className={draft.gender === 'female' ? 'active' : ''}
                                    onClick={() => patchArenaKitDraft({ gender: 'female' })}
                                >
                                    Female
                                </button>
                            </div>
                            {draft.path === 'mage' && (
                                <div className="arena-kit-row">
                                    <span>Free spell</span>
                                    {ARENA_MAGE_FREE_SPELLS.map((sp) => (
                                        <button
                                            key={sp.id}
                                            type="button"
                                            className={draft.freeMageSpell === sp.id ? 'active' : ''}
                                            onClick={() => patchArenaKitDraft({ freeMageSpell: sp.id })}
                                        >
                                            {sp.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <p className="arena-kit-hint">
                                Starter (free): Hero set, Liche neck, Wand M.Shield, Emerald Ring (3000 endu), Angelics +15,
                                free bag capes: CIC+7 (Critical Increase) + MC20/MP50% only (no plain Cape), crit +5 / 30s (cap 15). Skills: Fencing &amp;
                                Pretend Corpse available — no Physical Absorption.
                            </p>
                        </section>
                    )}

                    {step === 'stats' && (
                        <section>
                            <p>
                                Level {150} pool: <strong>{statsSum(draft.stats)}</strong> / {ARENA_STAT_TOTAL} (
                                <strong>{rem}</strong> left)
                            </p>
                            {(
                                [
                                    ['STR', 'str'],
                                    ['VIT', 'vit'],
                                    ['DEX', 'dex'],
                                    ['INT', 'int'],
                                    ['MAG', 'mag'],
                                    ['CHR', 'chr'],
                                ] as const
                            ).map(([label, key]) => (
                                <StatRow
                                    key={key}
                                    label={label}
                                    keyName={key}
                                    value={draft.stats[key]}
                                    onChange={setStat}
                                    canInc={rem > 0}
                                    rem={rem}
                                />
                            ))}
                        </section>
                    )}

                    {step === 'skills' && (
                        <section>
                            <p>
                                100% skills: {draft.skills100.length}/{ARENA_SKILLS_100} · 50% skills:{' '}
                                {draft.skills50.length}/{ARENA_SKILLS_50}{' '}
                                <span style={{ opacity: 0.75 }}>(optional — incomplete is OK for PVP)</span>
                            </p>
                            <div className="arena-kit-skill-grid">
                                {pvpSkills.map((sk) => {
                                    const at100 = draft.skills100.includes(sk.id);
                                    const at50 = draft.skills50.includes(sk.id);
                                    return (
                                        <div key={sk.id} className="arena-kit-skill-card">
                                            <strong>{sk.name}</strong>
                                            <div>
                                                <button
                                                    type="button"
                                                    className={at100 ? 'active' : ''}
                                                    onClick={() => toggleSkill100(sk.id)}
                                                >
                                                    100%
                                                </button>
                                                <button
                                                    type="button"
                                                    className={at50 ? 'active' : ''}
                                                    disabled={at100}
                                                    onClick={() => toggleSkill50(sk.id)}
                                                >
                                                    50%
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {step === 'pots' && (
                        <section>
                            <p>
                                Allocate <strong>{ARENA_POTION_POOL}</strong> pots (now {potTotal}).
                            </p>
                            {(
                                [
                                    ['Big Red', 'red'],
                                    ['Big Blue (mana)', 'blue'],
                                    ['Green Candy (50% SP)', 'greenCandy'],
                                ] as const
                            ).map(([label, key]) => (
                                <div key={key} className="arena-kit-stat-row">
                                    <span>{label}</span>
                                    <button
                                        type="button"
                                        disabled={draft.potions[key] <= 0}
                                        onClick={() =>
                                            patchArenaKitDraft({
                                                potions: { ...draft.potions, [key]: draft.potions[key] - 1 },
                                            })
                                        }
                                    >
                                        −
                                    </button>
                                    <strong className="arena-kit-qty-value">{draft.potions[key]}</strong>
                                    <button
                                        type="button"
                                        disabled={potTotal >= ARENA_POTION_POOL}
                                        onClick={() =>
                                            patchArenaKitDraft({
                                                potions: { ...draft.potions, [key]: draft.potions[key] + 1 },
                                            })
                                        }
                                    >
                                        +
                                    </button>
                                </div>
                            ))}
                        </section>
                    )}

                    {step === 'catalog' && (
                        <section>
                            <p>
                                Credits: <strong>{left}</strong> / {ARENA_STARTER_CREDITS} left (spent {spend})
                            </p>
                            <div className="arena-kit-catalog">
                                {ARENA_CATALOG.map((row) => {
                                    const qty = draft.catalogPurchases.find((p) => p.sku === row.sku)?.qty ?? 0;
                                    return (
                                        <div key={row.sku} className="arena-kit-catalog-row">
                                            <div>
                                                <strong>{row.label}</strong>
                                                <span className="arena-kit-cost">{row.cost}c</span>
                                            </div>
                                            <div className="arena-kit-qty">
                                                <button type="button" disabled={qty <= 0} onClick={() => removePurchase(row.sku)}>
                                                    −
                                                </button>
                                                <span className="arena-kit-qty-value">{qty}</span>
                                                <button type="button" onClick={() => addPurchase(row.sku)}>
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {step === 'review' && (
                        <section>
                            <ul className="arena-kit-review">
                                <li>
                                    <strong>{draft.name}</strong> · {draft.path} · {draft.gender}
                                </li>
                                <li>
                                    Stats {statsSum(draft.stats)}/{ARENA_STAT_TOTAL} (STR {draft.stats.str} … MAG{' '}
                                    {draft.stats.mag})
                                </li>
                                <li>
                                    Skills 100%: {draft.skills100.map((id) => pvpSkills.find((s) => s.id === id)?.name).join(', ') || '—'}
                                </li>
                                <li>
                                    Skills 50%: {draft.skills50.map((id) => pvpSkills.find((s) => s.id === id)?.name).join(', ') || '—'}
                                </li>
                                <li>
                                    Pots R{draft.potions.red} / B{draft.potions.blue} / Candy{draft.potions.greenCandy}
                                </li>
                                <li>
                                    Catalog {spend}c · left {left}c
                                </li>
                                {draft.catalogPurchases.length > 0 && (
                                    <li>
                                        Gear:{' '}
                                        {draft.catalogPurchases
                                            .map((p) => {
                                                const row = ARENA_CATALOG.find((c) => c.sku === p.sku);
                                                return `${p.qty}× ${row?.label ?? p.sku}`;
                                            })
                                            .join('; ')}
                                    </li>
                                )}
                                {draft.path === 'mage' && <li>Free spell: {draft.freeMageSpell}</li>}
                            </ul>
                            {validateArenaKit({ ...draft, completed: true }).map((e) => (
                                <p key={e} className="arena-kit-error">
                                    {e}
                                </p>
                            ))}
                            {arenaKitSoftHints(draft).map((h) => (
                                <p key={h} style={{ color: '#e8b86d', fontSize: 13, margin: '4px 0' }}>
                                    ℹ {h}
                                </p>
                            ))}
                        </section>
                    )}
                </div>

                <footer className="arena-kit-builder-footer">
                    <button type="button" onClick={goPrev} disabled={stepIndex === 0}>
                        Back
                    </button>
                    <button type="button" onClick={() => save(false)}>
                        Save draft
                    </button>
                    {step !== 'review' ? (
                        <button type="button" className="primary" onClick={goNext}>
                            Next
                        </button>
                    ) : (
                        <button type="button" className="primary" onClick={() => save(true)}>
                            Complete fighter
                        </button>
                    )}
                </footer>
            </div>
        </div>
    );
}

// silence unused if tree-shaken
void setArenaKitDraft;
