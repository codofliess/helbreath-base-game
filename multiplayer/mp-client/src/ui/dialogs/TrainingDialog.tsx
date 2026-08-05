import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { toast } from 'react-hot-toast';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { TOURNAMENT_DIALOG_BG } from '../../constants/SpriteKeys';
import {
    FARM_BARRACKS_PRESETS,
    TRAINING_PRESETS,
    TRAINING_WORLD_ID,
    getTrainingPreset,
    type TrainingPresetId,
} from '../../constants/TrainingPresets';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';
import { EventBus } from '../../game/EventBus';
import { SYSTEM_LOG_APPEND } from '../../constants/EventNames';
import {
    setTrainingDialogOpen,
    setTrainingPresetId,
    trainingDialogStore,
} from '../store/TrainingDialog.store';
import { timedChallengeStore } from '../store/TimedChallenge.store';

interface TrainingDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

type Panel = 'arena' | 'farm' | 'academy';

function formatElapsed(ms: number): string {
    if (!ms || ms < 0) {
        return '0:00';
    }
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatDummies(id: TrainingPresetId): string {
    const p = getTrainingPreset(id);
    if (!p) {
        return '';
    }
    const war = p.dummies.filter((d) => d.kind === 'war').length;
    const mage = p.dummies.filter((d) => d.kind === 'mage').length;
    return `${war}W / ${mage}M`;
}

/**
 * Training panel: Arena / Farm dummies + PvP Academy (Learning Guards + Challenge tiers).
 * Challenge Easy–Elite scaffold uses Guard waves until hero-set GM NPCs + AI ship.
 */
export function TrainingDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: TrainingDialogProps) {
    const isOpen = useStore(trainingDialogStore, (s) => s.isOpen);
    const presetId = useStore(trainingDialogStore, (s) => s.presetId);
    const challenge = useStore(timedChallengeStore);
    const [panel, setPanel] = useState<Panel>('academy');
    const [nowMs, setNowMs] = useState(() => Date.now());

    const presets = panel === 'farm' ? FARM_BARRACKS_PRESETS : TRAINING_PRESETS;
    const preset = getTrainingPreset(presetId) ?? presets[0];

    useEffect(() => {
        if (!isOpen || !challenge.active) {
            return;
        }
        const id = window.setInterval(() => setNowMs(Date.now()), 250);
        return () => window.clearInterval(id);
    }, [isOpen, challenge.active]);

    useEffect(() => {
        if (!isOpen || panel !== 'academy') {
            return;
        }
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        networkManager?.requestTimedChallengeLeaderboard(1);
    }, [isOpen, panel, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const startMode = (mode: number) => {
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager) {
            toast.error('Not connected — join a world first.');
            return;
        }
        networkManager.requestStartTimedChallenge(mode);
    };

    const abortChallenge = () => {
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        networkManager?.requestAbortTimedChallenge();
    };

    const handleApply = () => {
        const game = phaserRef?.current?.game;
        const networkManager = game ? getNetworkManager(game) : undefined;
        if (!networkManager) {
            toast.error('Not connected — join a world first.');
            return;
        }
        if (panel === 'farm') {
            toast('Farm Barracks: walk to dummy/merc pads on arefarm / elvfarm (tip sheet only).');
            for (const tip of preset.tips.slice(0, 4)) {
                EventBus.emit(SYSTEM_LOG_APPEND, { message: `Tip: ${tip}`, kind: 'tip' });
            }
            return;
        }
        networkManager.requestApplyTrainingPreset(preset.id);
        for (const tip of preset.tips.slice(0, 4)) {
            EventBus.emit(SYSTEM_LOG_APPEND, { message: `Tip: ${tip}`, kind: 'tip' });
        }
    };

    const liveElapsed =
        challenge.active && challenge.startedAtMs > 0
            ? Math.max(0, nowMs - challenge.startedAtMs)
            : challenge.lastElapsedMs;

    const academyActive =
        challenge.active &&
        (challenge.mode === 2 ||
            challenge.mode === 3 ||
            challenge.mode === 4 ||
            challenge.mode >= 10);

    return (
        <OlympiaDialogShell
            id="training-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setTrainingDialogOpen(false);
            }}
            width={300}
            minHeight={400}
            bgSpriteKey={TOURNAMENT_DIALOG_BG}
            rootClassName="training-dialog-root"
        >
            <div className="olympia-dialog-title-bar training-dialog-title hb-nemesis-dialog-title">
                Training &amp; Academy
            </div>
            <div className="training-body">
                <div className="training-group-tabs">
                    <button
                        type="button"
                        className={`training-group-tab${panel === 'academy' ? ' training-group-tab-active' : ''}`}
                        onClick={() => setPanel('academy')}
                    >
                        Academy
                    </button>
                    <button
                        type="button"
                        className={`training-group-tab${panel === 'arena' ? ' training-group-tab-active' : ''}`}
                        onClick={() => {
                            setPanel('arena');
                            setTrainingPresetId(TRAINING_PRESETS[0].id);
                        }}
                    >
                        Arena
                    </button>
                    <button
                        type="button"
                        className={`training-group-tab${panel === 'farm' ? ' training-group-tab-active' : ''}`}
                        onClick={() => {
                            setPanel('farm');
                            setTrainingPresetId(FARM_BARRACKS_PRESETS[0].id);
                        }}
                    >
                        Farm
                    </button>
                </div>

                {panel === 'academy' ? (
                    <>
                        <p className="training-hint">
                            <strong>Learning:</strong> Guards (and Dark Elves) in waves — practice real PvP
                            sequences. No Elo.
                        </p>
                        <p className="training-hint">
                            <strong>Challenge:</strong> Easy→Elite will be GM-signature hero-set NPCs (war/mage
                            AI). Scaffold = Guard waves + tier labels until that AI ships.
                        </p>

                        <div className="training-section-title">Status</div>
                        <p className="training-summary">
                            {challenge.active
                                ? `Mode ${challenge.mode} · ${challenge.targetsCompleted}/${challenge.targetsTotal}` +
                                  (challenge.waveIndex
                                      ? ` · wave ${challenge.waveIndex}/${challenge.waveCount || 5}`
                                      : '') +
                                  ` · ${formatElapsed(liveElapsed)}`
                                : challenge.lastFinishMessage || 'Pick Learning or Challenge below.'}
                        </p>
                        {challenge.message ? <p className="training-hint">{challenge.message}</p> : null}

                        <div className="training-section-title">Learning</div>
                        <div className="training-challenge-actions">
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 2}
                                onClick={() => startMode(2)}
                            >
                                Guards waves (1→2→2→2→3)
                            </button>
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 3}
                                onClick={() => startMode(3)}
                            >
                                Dark Elves (invi + PFA setup)
                            </button>
                        </div>
                        <p className="training-hint">
                            Tips: position → Chill/Para/DS → reset/pot → priority targets. DE: invi pot → PFA
                            first.
                        </p>

                        <div className="training-section-title">Challenge (by level)</div>
                        <div className="training-challenge-actions">
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 10}
                                onClick={() => startMode(10)}
                            >
                                Easy — predictable
                            </button>
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 11}
                                onClick={() => startMode(11)}
                            >
                                Intermediate — self buffs TBD
                            </button>
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 12}
                                onClick={() => startMode(12)}
                            >
                                Hard — CC on you TBD
                            </button>
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 13}
                                onClick={() => startMode(13)}
                            >
                                Elite — full kit TBD
                            </button>
                        </div>

                        <div className="training-section-title">Optional pressure</div>
                        <div className="training-challenge-actions">
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 4}
                                onClick={() => startMode(4)}
                            >
                                Ettins only (endurance)
                            </button>
                            <button
                                type="button"
                                className="olympia-text-btn training-apply-btn"
                                disabled={challenge.active && challenge.mode !== 1}
                                onClick={() => startMode(1)}
                            >
                                Skills CC (Mode 1)
                            </button>
                        </div>

                        {academyActive || challenge.active ? (
                            <div className="training-challenge-actions">
                                <button
                                    type="button"
                                    className="olympia-text-btn training-apply-btn"
                                    onClick={abortChallenge}
                                >
                                    Abort
                                </button>
                            </div>
                        ) : null}

                        <p className="training-hint">
                            Also on F8 → PVP Skills for Guards / Dark Elves. Full design: docs/PVP-ACADEMY.md
                        </p>
                    </>
                ) : (
                    <>
                        <p className="training-hint">
                            {panel === 'farm'
                                ? 'Dummy + Merc barracks on arefarm / elvfarm. Mercs chase + XP. Protocol: Chill → Para → PFA/DS.'
                                : `Practice map ${TRAINING_WORLD_ID}. Apply chase presets (War/Mage dummies).`}
                        </p>

                        <div className="training-section-title">Preset</div>
                        <div className="training-preset-list">
                            {presets.map((row) => (
                                <button
                                    key={row.id}
                                    type="button"
                                    className={`training-preset-btn${row.id === preset.id ? ' training-preset-active' : ''}`}
                                    onClick={() => setTrainingPresetId(row.id)}
                                >
                                    <span className="training-preset-label">{row.label}</span>
                                    <span className="training-preset-comp">{formatDummies(row.id)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="training-section-title">Tip protocol</div>
                        <p className="training-summary">{preset.summary}</p>
                        <ol className="training-tips">
                            {preset.tips.map((tip) => (
                                <li key={tip}>{tip}</li>
                            ))}
                        </ol>
                        <button
                            type="button"
                            className="olympia-text-btn training-apply-btn"
                            onClick={handleApply}
                        >
                            {panel === 'farm' ? 'Show tips' : 'Apply preset'}
                        </button>
                    </>
                )}
            </div>
        </OlympiaDialogShell>
    );
}
