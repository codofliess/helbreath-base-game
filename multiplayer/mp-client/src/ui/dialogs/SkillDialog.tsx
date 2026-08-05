import { useStore } from '@tanstack/react-store';
import { useEffect, useState, type WheelEvent } from 'react';
import { toast } from 'react-toastify';
import {
    getOlympiaSkillById,
    OLYMPIA_SKILLS,
    SKILL_MAX_LEVEL,
} from '../../constants/OlympiaSkills';
import { DIALOG_SCROLL_THUMB, SKILL_DIALOG_BG, SKILL_DIALOG_TITLE } from '../../constants/SpriteKeys';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { appStore } from '../store/App.store';
import {
    getSkillLevel,
    setSelectedSkillId,
    setSkillDialogOpen,
    setSkillScrollOffset,
    skillDialogStore,
} from '../store/SkillDialog.store';
import { timedChallengeStore } from '../store/TimedChallenge.store';
import { setTrainingDialogOpen } from '../store/TrainingDialog.store';

/** Rows that fit above the detail panel (classic showed 17 full-height; detail needs room). */
const VISIBLE_ROWS = 9;

type SkillDialogView = 'skills' | 'pvp';

interface SkillDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

function skillDisplayName(name: string): string {
    return name.replace(/-/g, ' ');
}

function formatElapsed(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * F8 Skill dialog: skill list + training entry row (PVP Skills / Arena / CC Skills).
 * PVP Skills opens Guard + Dark Elf waves (modes 2–3). Survival (mode 4) is on Training → Challenge.
 */
export function SkillDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: SkillDialogProps) {
    const isOpen = useStore(skillDialogStore, (s) => s.isOpen);
    const scrollOffset = useStore(skillDialogStore, (s) => s.scrollOffset);
    const selectedSkillId = useStore(skillDialogStore, (s) => s.selectedSkillId);
    const levelsById = useStore(skillDialogStore, (s) => s.levelsById);
    const challenge = useStore(timedChallengeStore);
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const scrollThumb = spriteFrameMap.get(DIALOG_SCROLL_THUMB);
    const titleOverlay = spriteFrameMap.get(SKILL_DIALOG_TITLE);
    const [view, setView] = useState<SkillDialogView>('skills');
    const [nowMs, setNowMs] = useState(() => Date.now());

    const maxScroll = Math.max(0, OLYMPIA_SKILLS.length - VISIBLE_ROWS);
    const clampedScroll = Math.min(scrollOffset, maxScroll);
    const visibleSkills = OLYMPIA_SKILLS.slice(clampedScroll, clampedScroll + VISIBLE_ROWS);
    const selectedSkill = selectedSkillId !== undefined ? getOlympiaSkillById(selectedSkillId) : undefined;
    const selectedLevel = selectedSkill
        ? getSkillLevel(selectedSkill.id, selectedSkill.level)
        : 0;
    const showScrollbar = OLYMPIA_SKILLS.length > VISIBLE_ROWS;
    // Keep thumb fully inside the track (avoid -50% clip at 0% / 100%).
    const thumbTopPct = maxScroll <= 0 ? 8 : 8 + (clampedScroll / maxScroll) * 84;

    useEffect(() => {
        if (!isOpen || selectedSkillId !== undefined) {
            return;
        }
        setSelectedSkillId(OLYMPIA_SKILLS[0]?.id);
    }, [isOpen, selectedSkillId]);

    useEffect(() => {
        if (!isOpen) {
            setView('skills');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const game = phaserRef?.current?.game;
        const nm = game ? getNetworkManager(game) : undefined;
        nm?.requestSkillsState();
    }, [isOpen, phaserRef]);

    useEffect(() => {
        if (!challenge.active || view !== 'pvp') {
            return;
        }
        const id = window.setInterval(() => setNowMs(Date.now()), 250);
        return () => window.clearInterval(id);
    }, [challenge.active, view]);

    if (!isOpen) {
        return null;
    }

    const onListWheel = (e: WheelEvent<HTMLDivElement>) => {
        if (maxScroll <= 0) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        const step = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
        if (step === 0) {
            return;
        }
        setSkillScrollOffset(Math.min(maxScroll, Math.max(0, clampedScroll + step)));
    };

    const atMax = selectedLevel >= SKILL_MAX_LEVEL;
    const progressPct = Math.min(SKILL_MAX_LEVEL, Math.max(0, selectedLevel));

    const getNetwork = () => {
        const game = phaserRef?.current?.game;
        return game ? getNetworkManager(game) : undefined;
    };

    const startChallenge = (mode: number) => {
        const networkManager = getNetwork();
        if (!networkManager) {
            toast.error('Not connected — join a world first.');
            return;
        }
        networkManager.requestStartTimedChallenge(mode);
    };

    const abortChallenge = () => {
        getNetwork()?.requestAbortTimedChallenge();
    };

    const liveElapsed =
        challenge.active && challenge.startedAtMs > 0
            ? Math.max(0, nowMs - challenge.startedAtMs)
            : challenge.lastElapsedMs;

    const pvpActive = challenge.active && (challenge.mode === 2 || challenge.mode === 3);

    return (
        <OlympiaDialogShell
            id="skill-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setSkillDialogOpen(false);
            }}
            width={258}
            minHeight={339}
            bgSpriteKey={SKILL_DIALOG_BG}
            rootClassName="skill-dialog-root"
        >
            {titleOverlay && (
                <div
                    className="olympia-dialog-title-overlay"
                    style={{ backgroundImage: `url(${titleOverlay})` }}
                    aria-hidden
                />
            )}
            <div className="olympia-dialog-title-bar skill-dialog-title hb-nemesis-dialog-title">Skill</div>
            <div className="skill-dialog-body">
                <div className="skill-dialog-train-row" role="group" aria-label="Training shortcuts">
                    <button
                        type="button"
                        className={`skill-dialog-train-btn${view === 'pvp' ? ' skill-dialog-train-btn-active' : ''}`}
                        onClick={() => setView((v) => (v === 'pvp' ? 'skills' : 'pvp'))}
                    >
                        PVP Skills
                    </button>
                    <button
                        type="button"
                        className="skill-dialog-train-btn"
                        onClick={() => {
                            setSkillDialogOpen(false);
                            setTrainingDialogOpen(true, 'arena');
                        }}
                    >
                        Arena
                    </button>
                    <button
                        type="button"
                        className="skill-dialog-train-btn"
                        onClick={() => {
                            setSkillDialogOpen(false);
                            setTrainingDialogOpen(true, 'challenge');
                        }}
                    >
                        CC Skills
                    </button>
                </div>

                {view === 'pvp' ? (
                    <div className="skill-dialog-pvp">
                        <p className="skill-dialog-pvp-hint">
                            <strong>PvP Learning:</strong> Guards in waves (1→2→2→2→3). Practice sequences — not
                            Elo. Full Academy (Challenge Easy→Elite) on Shift+F10 → Academy.
                        </p>
                        <p className="skill-dialog-pvp-status">
                            {pvpActive
                                ? `Mode ${challenge.mode} · ${challenge.targetsCompleted}/${challenge.targetsTotal}` +
                                  (challenge.waveIndex > 0
                                      ? ` · wave ${challenge.waveIndex}/${challenge.waveCount || 5}`
                                      : '') +
                                  ` · ${formatElapsed(liveElapsed)}`
                                : challenge.lastFinishMessage || 'Pick a challenge to start.'}
                        </p>
                        {challenge.message ? (
                            <p className="skill-dialog-pvp-msg">{challenge.message}</p>
                        ) : null}

                        <button
                            type="button"
                            className="olympia-text-btn skill-dialog-pvp-action"
                            disabled={challenge.active && challenge.mode !== 2}
                            onClick={() => startChallenge(2)}
                        >
                            Learning · 10 Guards (waves)
                        </button>
                        <p className="skill-dialog-pvp-sub">
                            Real Guard HP. Teach spacing / Chill-Para-DS. Clear wave → next.
                        </p>

                        <button
                            type="button"
                            className="olympia-text-btn skill-dialog-pvp-action"
                            disabled={challenge.active && challenge.mode !== 3}
                            onClick={() => startChallenge(3)}
                        >
                            2 · 10 Dark Elves
                        </button>
                        <p className="skill-dialog-pvp-sub">
                            Drink Invisibility Potion → step aside → cast PFA → then kill waves.
                        </p>

                        {challenge.active ? (
                            <button
                                type="button"
                                className="olympia-text-btn skill-dialog-pvp-action"
                                onClick={abortChallenge}
                            >
                                Abort challenge
                            </button>
                        ) : null}

                        <button
                            type="button"
                            className="skill-dialog-pvp-back"
                            onClick={() => setView('skills')}
                        >
                            ← Skills list
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="skill-dialog-list-wrap">
                            <div
                                className="skill-dialog-list"
                                onWheel={onListWheel}
                                role="listbox"
                                aria-label="Skills"
                            >
                        {visibleSkills.map((skill) => {
                            const level = levelsById[skill.id] ?? skill.level;
                            const active = skill.usable && level > 0;
                            const selected = skill.id === selectedSkillId;
                            return (
                                <button
                                    key={skill.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    className={`skill-dialog-row${active ? ' skill-dialog-row-active' : ''}${selected ? ' skill-dialog-row-selected' : ''}`}
                                    onClick={() => setSelectedSkillId(skill.id)}
                                >
                                    <span className="skill-dialog-name">{skillDisplayName(skill.name)}</span>
                                    <span className="skill-dialog-level">
                                        {String(level).padStart(3, ' ')}%
                                    </span>
                                </button>
                            );
                        })}
                            </div>
                            {showScrollbar && (
                                <div className="skill-dialog-scroll" aria-hidden={false}>
                                    <button
                                        type="button"
                                        className="skill-dialog-scroll-btn"
                                        disabled={clampedScroll <= 0}
                                        aria-label="Scroll skills up"
                                        onClick={() => setSkillScrollOffset(clampedScroll - 1)}
                                    >
                                        ▲
                                    </button>
                                    <div className="skill-dialog-scroll-track">
                                        {scrollThumb ? (
                                            <img
                                                src={scrollThumb}
                                                alt=""
                                                className="skill-dialog-scroll-thumb"
                                                draggable={false}
                                                style={{ top: `${thumbTopPct}%` }}
                                            />
                                        ) : (
                                            <div
                                                className="skill-dialog-scroll-thumb-fallback"
                                                style={{ top: `${thumbTopPct}%` }}
                                            />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        className="skill-dialog-scroll-btn"
                                        disabled={clampedScroll >= maxScroll}
                                        aria-label="Scroll skills down"
                                        onClick={() => setSkillScrollOffset(clampedScroll + 1)}
                                    >
                                        ▼
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="skill-dialog-detail">
                            {!selectedSkill ? (
                                <p className="skill-dialog-detail-hint">Select a skill to view progress.</p>
                            ) : (
                                <>
                                    <div className="skill-dialog-detail-name">
                                        {skillDisplayName(selectedSkill.name)}
                                    </div>
                                    <div className="skill-dialog-detail-progress-row">
                                        <span className="skill-dialog-detail-label">Progress</span>
                                        <span className="skill-dialog-detail-pct">
                                            {progressPct}% / {SKILL_MAX_LEVEL}%
                                        </span>
                                    </div>
                                    <div
                                        className="skill-dialog-progress-bar"
                                        role="progressbar"
                                        aria-valuenow={progressPct}
                                        aria-valuemin={0}
                                        aria-valuemax={SKILL_MAX_LEVEL}
                                    >
                                        <div
                                            className="skill-dialog-progress-fill"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </div>
                                    {atMax ? (
                                        <p className="skill-dialog-detail-desc">{selectedSkill.description}</p>
                                    ) : (
                                        <p className="skill-dialog-detail-hint">
                                            Reach {SKILL_MAX_LEVEL}% to unlock what this skill does.
                                        </p>
                                    )}
                                    {(selectedSkill.id === 0 || selectedSkill.id === 1) && (
                                        <button
                                            type="button"
                                            className="skill-dialog-train-btn"
                                            style={{ marginTop: 8 }}
                                            onClick={() => {
                                                const nm = getNetwork();
                                                if (!nm) {
                                                    toast.error('Not connected.');
                                                    return;
                                                }
                                                nm.requestSkillGather(selectedSkill.id);
                                            }}
                                        >
                                            {selectedSkill.id === 0
                                                ? 'Mine (stand by node)'
                                                : 'Fish (rod + water)'}
                                        </button>
                                    )}
                                    {atMax && (
                                        <p className="skill-dialog-detail-hint" style={{ marginTop: 6 }}>
                                            100% → rare gather unlocks. Skill cNFT trade: post-test (market
                                            prices Long Sword cheap · Mining mid · Manufacture expensive).
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </OlympiaDialogShell>
    );
}
