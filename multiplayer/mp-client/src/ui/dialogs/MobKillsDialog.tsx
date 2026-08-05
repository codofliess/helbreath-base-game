import { useMemo, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { MOB_KILLS_DIALOG_BG } from '../../constants/SpriteKeys';
import { IN_UI_CLAIM_KILL_MILESTONE } from '../../constants/EventNames';
import { ITEMS } from '../../constants/Items';
import { EventBus } from '../../game/EventBus';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { setMobKillsDialogOpen, mobKillsDialogStore } from '../store/MobKillsDialog.store';
import {
    progressionStore,
    setClaimingMilestone,
    type MilestoneRow,
    type MonsterKillRow,
} from '../store/Progression.store';

interface MobKillsDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
}

function milestoneLabel(milestone: MilestoneRow): string {
    if (milestone.kind === 1) {
        return `Rebirth ${milestone.required}`;
    }
    return `${milestone.required.toLocaleString()} × ${milestone.monsterName ?? `Monster #${milestone.monsterId}`}`;
}

function MilestoneRewards({ milestone, claiming }: { milestone: MilestoneRow; claiming: boolean }) {
    const completed = milestone.progress >= milestone.required;
    return (
        <div className="mob-kills-milestone-rewards">
            {milestone.rewardItemIds.map((itemId) => {
                const itemName = ITEMS.find((i) => i.id === itemId)?.name ?? `Item #${itemId}`;
                return (
                    <button
                        key={itemId}
                        type="button"
                        className="mob-kills-claim-btn"
                        disabled={!completed || milestone.claimed || claiming}
                        onClick={() => {
                            setClaimingMilestone(milestone.milestoneId);
                            EventBus.emit(IN_UI_CLAIM_KILL_MILESTONE, {
                                milestoneId: milestone.milestoneId,
                                chosenItemId: itemId,
                            });
                        }}
                    >
                        {itemName}
                    </button>
                );
            })}
        </div>
    );
}

/** Olympia-style progress: current kills / next real-tier threshold. */
function ProgressToNext({ row }: { row: MonsterKillRow }) {
    const kills = row.kills;
    const next = Number(row.nextKills ?? 0);
    if (next <= 0) {
        return <span className="mob-kills-progress-label">Max real ladder</span>;
    }
    const pct = Math.min(100, Math.floor((kills / next) * 100));
    return (
        <div className="mob-kills-progress-wrap" title={`${kills.toLocaleString()} / ${next.toLocaleString()} kills → next real tier`}>
            <div className="mob-kills-progress-bar">
                <div className="mob-kills-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="mob-kills-progress-label">
                {kills.toLocaleString()} / {next.toLocaleString()}
            </span>
        </div>
    );
}

function SelectedMobDetail({ row }: { row: MonsterKillRow | null }) {
    if (!row) {
        return (
            <div className="mob-kills-detail">
                <p className="mob-kills-hint">Select a species (Olympia: Statistics → Mobs).</p>
            </div>
        );
    }
    const real = row.specialtyLevel;
    const final = row.effectiveLevel;
    const stake = row.stakeBonusLevels;
    return (
        <div className="mob-kills-detail">
            <div className="mob-kills-detail-title">
                {row.monsterName} Specialty Level {final}
            </div>
            <div className="mob-kills-detail-meta">
                Real (kills only): <strong>L{real}</strong>
                {stake > 0 ? (
                    <>
                        {' · '}
                        Stake: <strong>+{stake}</strong>
                        {' · '}
                        Final: <strong>L{final}</strong>
                    </>
                ) : (
                    <>
                        {' · '}
                        Final: <strong>L{final}</strong>
                    </>
                )}
            </div>
            <ProgressToNext row={row} />
            <div className="mob-kills-detail-bonuses">
                {row.bonusSummary && row.bonusSummary !== '—'
                    ? row.bonusSummary
                    : real <= 0
                      ? 'No specialty bonuses yet — keep farming this species.'
                      : 'Bonuses active (see tooltip ladder).'}
            </div>
        </div>
    );
}

export function MobKillsDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
}: MobKillsDialogProps) {
    const isOpen = useStore(mobKillsDialogStore, (s) => s.isOpen);
    const progression = useStore(progressionStore);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const killRows = useMemo(
        () => Object.values(progression.killsByMonsterId).sort((a, b) => b.kills - a.kills),
        [progression.killsByMonsterId],
    );

    const selected =
        (selectedId != null ? killRows.find((r) => r.monsterId === selectedId) : null) ??
        killRows[0] ??
        null;

    // 100k $HELL = +1 final tier (server authoritative via stakeBonusLevels).
    const stakeBonus =
        killRows.find((r) => r.stakeBonusLevels > 0)?.stakeBonusLevels ??
        Math.floor(Math.max(0, progression.stakedHell) / 100_000);

    if (!isOpen) {
        return null;
    }

    return (
        <OlympiaDialogShell
            id="mob-kills-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setMobKillsDialogOpen(false);
            }}
            width={340}
            minHeight={380}
            bgSpriteKey={MOB_KILLS_DIALOG_BG}
            rootClassName="mob-kills-dialog-root"
        >
            <div className="olympia-dialog-title-bar hb-nemesis-dialog-title">Mob Specialty</div>
            <div className="mob-kills-body">
                <p className="mob-kills-total">
                    Total kills: <strong>{progression.totalKills.toLocaleString()}</strong>
                    {' · '}
                    Staked $HELL: <strong>{progression.stakedHell.toLocaleString()}</strong>
                    {stakeBonus > 0 ? ` (+${stakeBonus} final all mobs)` : ''}
                </p>

                <SelectedMobDetail row={selected} />

                <div className="mob-kills-list-header mob-kills-list-header-olympia">
                    <span>Species</span>
                    <span title="Total kills of this species">Kills</span>
                    <span title="Specialty from kills only (base×L²)">Real</span>
                    <span title="Real + stake bonus (final combat/drop tier)">Final</span>
                </div>
                <div className="mob-kills-list">
                    {killRows.length === 0 ? (
                        <p className="mob-kills-hint">
                            No specialty yet — kill monsters to unlock tiers. Each species has its own
                            ladder (Slime ≠ Orc).
                        </p>
                    ) : (
                        killRows.map((row) => {
                            const active = selected?.monsterId === row.monsterId;
                            return (
                                <button
                                    key={row.monsterId}
                                    type="button"
                                    className={`mob-kills-row${active ? ' mob-kills-row-selected' : ''}`}
                                    onClick={() => setSelectedId(row.monsterId)}
                                    title={
                                        [
                                            row.bonusSummary || 'No bonuses yet',
                                            row.nextKills > 0
                                                ? `Next real tier at ${Number(row.nextKills).toLocaleString()} kills`
                                                : 'Max real ladder for this base',
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')
                                    }
                                >
                                    <span className="mob-kills-name">{row.monsterName}</span>
                                    <span className="mob-kills-count">{row.kills.toLocaleString()}</span>
                                    <span className="mob-kills-tier-real">{row.specialtyLevel}</span>
                                    <span className="mob-kills-tier-final">{row.effectiveLevel}</span>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="mob-kills-milestones">
                    <div className="mob-kills-section-title">Milestones</div>
                    {progression.milestones.map((milestone) => {
                        const completed = milestone.progress >= milestone.required;
                        return (
                            <div
                                key={milestone.milestoneId}
                                className={`mob-kills-milestone${completed ? ' mob-kills-milestone-complete' : ''}${milestone.claimed ? ' mob-kills-milestone-claimed' : ''}`}
                            >
                                <div className="mob-kills-milestone-header">
                                    <span>{milestoneLabel(milestone)}</span>
                                    <span className="mob-kills-milestone-progress">
                                        {milestone.claimed
                                            ? 'Claimed'
                                            : `${Math.min(milestone.progress, milestone.required).toLocaleString()} / ${milestone.required.toLocaleString()}`}
                                    </span>
                                </div>
                                {!milestone.claimed && (
                                    <MilestoneRewards
                                        milestone={milestone}
                                        claiming={progression.claimingMilestoneId === milestone.milestoneId}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
