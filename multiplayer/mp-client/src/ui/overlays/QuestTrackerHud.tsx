import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { beginnerPathStore } from '../store/BeginnerPath.store';
import { progressionStore } from '../store/Progression.store';
import { timedChallengeStore } from '../store/TimedChallenge.store';
import { appendSystemLog } from '../store/SystemLog.store';
import {
    OLYMPIA_QUEST_TRACKER_COLORS,
    OLYMPIA_UI_FONT,
} from '../../constants/OlympiaTypography';
import '../rpg-ui.css';

/** Gold flash while “Completed!” shows, then row fades out of the right column. */
const COMPLETION_FLASH_MS = 2500;
/** After flash, fade + remove from HUD so green text does not stick forever. */
const COMPLETION_FADE_MS = 1200;
const COMPLETION_TOTAL_MS = COMPLETION_FLASH_MS + COMPLETION_FADE_MS;

interface TrackerRow {
    id: string;
    title: string;
    detail: string;
    completed: boolean;
}

/**
 * Olympia-style right-column hunt/quest tracker (Parity P1.1).
 * Binds Beginner Path, kill milestones, and Timed Challenge progress.
 */
export function QuestTrackerHud() {
    const beginner = useStore(beginnerPathStore);
    const milestones = useStore(progressionStore, (s) => s.milestones);
    const challenge = useStore(timedChallengeStore);
    const [flashIds, setFlashIds] = useState<Record<string, number>>({});
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const prevCompletedRef = useRef<Set<string>>(new Set());
    const completionPrimedRef = useRef(false);

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement instanceof HTMLElement) {
                setPortalTarget(fullscreenElement);
            } else {
                setPortalTarget(document.body);
            }
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    const rows = useMemo(() => {
        const list: TrackerRow[] = [];

        if (beginner.enrolled && !beginner.abandoned && beginner.activeQuestId) {
            const done = beginner.required > 0 && beginner.progress >= beginner.required;
            const counterLabel =
                beginner.objectiveKind === 'mob_kills'
                    ? 'Kills'
                    : beginner.objectiveKind === 'talk_npc'
                      ? 'Talk'
                      : beginner.objectiveKind.replace(/_/g, ' ') || 'Progress';
            list.push({
                id: `bp:${beginner.activeQuestId}`,
                title: beginner.activeQuestTitle || 'Beginner Path',
                detail: done
                    ? 'Completed!'
                    : beginner.required > 0
                      ? `${counterLabel}: ${beginner.progress}/${beginner.required}`
                      : beginner.activeQuestHint || 'In progress',
                completed: done,
            });
        } else if (beginner.enrolled && !beginner.abandoned && beginner.nextStubTitle) {
            list.push({
                id: 'bp:stub',
                title: beginner.nextStubTitle,
                detail: 'Coming soon',
                completed: false,
            });
        }

        for (const m of milestones) {
            if (m.claimed) {
                continue;
            }
            if (m.kind !== 0 && m.kind !== 1) {
                continue;
            }
            const name =
                m.kind === 1 ? 'Rebirth' : m.monsterName?.trim() || m.milestoneId || 'Hunt';
            const done = m.required > 0 && m.progress >= m.required;
            list.push({
                id: `ms:${m.milestoneId}`,
                title: m.kind === 1 ? 'Rebirth Milestone' : `${name} Hunt`,
                detail: done ? 'Completed!' : `${name}: ${m.progress}/${m.required}`,
                completed: done,
            });
        }

        if (challenge.active) {
            const wave =
                challenge.waveCount > 0
                    ? challenge.mode === 4
                        ? ` · Survival ${challenge.waveIndex || 1}/${challenge.waveCount || 14}`
                        : ` · Wave ${challenge.waveIndex || 1}/${challenge.waveCount}`
                    : '';
            const done =
                challenge.targetsTotal > 0 && challenge.targetsCompleted >= challenge.targetsTotal;
            list.push({
                id: `tc:mode${challenge.mode}`,
                title: challenge.message?.trim() || `Challenge Mode ${challenge.mode}`,
                detail: done
                    ? 'Completed!'
                    : `Targets: ${challenge.targetsCompleted}/${challenge.targetsTotal}${wave}`,
                completed: done,
            });
        } else if (challenge.lastFinishMessage) {
            list.push({
                id: `tc:last`,
                title: 'Challenge',
                detail: challenge.lastFinishMessage.includes('fail') ? challenge.lastFinishMessage : 'Completed!',
                completed: !challenge.lastFinishMessage.toLowerCase().includes('fail'),
            });
        }

        return list;
    }, [beginner, milestones, challenge]);

    useEffect(() => {
        const now = Date.now();
        const prev = prevCompletedRef.current;
        const next = new Set<string>();
        const newlyCompleted: string[] = [];

        for (const row of rows) {
            if (row.completed) {
                next.add(row.id);
                if (completionPrimedRef.current && !prev.has(row.id)) {
                    newlyCompleted.push(row.id);
                }
            }
        }

        completionPrimedRef.current = true;

        if (newlyCompleted.length > 0) {
            setFlashIds((s) => {
                const copy = { ...s };
                for (const id of newlyCompleted) {
                    // until = full lifecycle end (flash + fade)
                    copy[id] = now + COMPLETION_TOTAL_MS;
                    const row = rows.find((r) => r.id === id);
                    if (row) {
                        appendSystemLog(`${row.title} Completed!`, 'event');
                    }
                }
                return copy;
            });
        }

        prevCompletedRef.current = next;
    }, [rows]);

    useEffect(() => {
        const ids = Object.keys(flashIds);
        if (ids.length === 0) {
            return;
        }
        const timer = window.setInterval(() => {
            const now = Date.now();
            setFlashIds((s) => {
                let changed = false;
                const next: Record<string, number> = {};
                for (const [id, until] of Object.entries(s)) {
                    if (until > now) {
                        next[id] = until;
                    } else {
                        changed = true;
                    }
                }
                return changed ? next : s;
            });
        }, 200);
        return () => window.clearInterval(timer);
    }, [flashIds]);

    if (!portalTarget || rows.length === 0) {
        return null;
    }

    const now = Date.now();
    // Completed rows only stay while flashing/fading; then leave the right column.
    const visibleRows = rows.filter((row) => {
        if (!row.completed) {
            return true;
        }
        const until = flashIds[row.id] ?? 0;
        return until > now;
    });

    if (visibleRows.length === 0) {
        return null;
    }

    const dialog = (
        <div className="quest-tracker-hud" aria-label="Quest and hunt tracker">
            {visibleRows.map((row) => {
                const until = flashIds[row.id] ?? 0;
                const remaining = until - now;
                const flashing = remaining > COMPLETION_FADE_MS;
                const fading = row.completed && remaining > 0 && remaining <= COMPLETION_FADE_MS;
                const showCompleted = row.completed;
                return (
                    <div
                        key={row.id}
                        className={`quest-tracker-hud-entry${flashing ? ' quest-tracker-hud-entry--flash' : ''}${fading ? ' quest-tracker-hud-entry--fading' : ''}`}
                    >
                        <div
                            className="quest-tracker-hud-title"
                            style={{
                                color: flashing || fading
                                    ? OLYMPIA_QUEST_TRACKER_COLORS.completedGold
                                    : OLYMPIA_QUEST_TRACKER_COLORS.title,
                                fontFamily: OLYMPIA_UI_FONT,
                            }}
                        >
                            {row.title}
                        </div>
                        <div
                            className="quest-tracker-hud-detail"
                            style={{
                                color: showCompleted
                                    ? OLYMPIA_QUEST_TRACKER_COLORS.completed
                                    : OLYMPIA_QUEST_TRACKER_COLORS.progress,
                                fontFamily: OLYMPIA_UI_FONT,
                            }}
                        >
                            {showCompleted ? 'Completed!' : row.detail}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return createPortal(dialog, portalTarget);
}
