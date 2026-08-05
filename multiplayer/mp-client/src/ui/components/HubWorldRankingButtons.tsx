import { useEffect, useState } from 'react';
import {
    fetchLeaderboard,
    type LeaderboardEntry,
    type LeaderboardMode,
} from '../../utils/tournamentApi';
import { openTournamentLeaderboard } from '../store/TournamentDialog.store';

function medal(i: number): string {
    return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
}

function RankingPreviewButton({
    mode,
    label,
    subtitle,
}: {
    mode: LeaderboardMode;
    label: string;
    subtitle: string;
}) {
    const [top, setTop] = useState<LeaderboardEntry[]>([]);
    const [err, setErr] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void fetchLeaderboard(mode)
            .then((entries) => {
                if (!cancelled) {
                    setTop((entries ?? []).slice(0, 10));
                    setErr(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTop([]);
                    setErr(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [mode]);

    return (
        <button
            type="button"
            className="hub-rank-btn hub-rank-btn--top10"
            onClick={() => openTournamentLeaderboard(mode)}
            title={`Open full ${label}`}
        >
            <span className="hub-rank-btn-label">{label}</span>
            <span className="hub-rank-btn-sub">{subtitle}</span>
            <ol className="hub-rank-preview">
                {top.length === 0 ? (
                    <li className="hub-rank-preview-empty">
                        {err ? 'Ladder offline' : 'No ranks yet'}
                    </li>
                ) : (
                    top.map((e, i) => (
                        <li key={`${mode}-${e.wallet}-${i}`}>
                            <span className="hub-rank-medal">{medal(i)}</span>
                            <span className="hub-rank-name">
                                {(e.display_name || e.wallet?.slice(0, 8) || '?').slice(0, 14)}
                            </span>
                            <span className="hub-rank-score">{Math.round(e.rating)}</span>
                        </li>
                    ))
                )}
            </ol>
        </button>
    );
}

/**
 * Under Arena portal: (1) TEAMs · (2) Solo — top-10 preview each.
 */
export function HubWorldRankingButtons() {
    return (
        <div className="hub-rank-row hub-rank-row--side" aria-label="World rankings">
            <RankingPreviewButton
                mode="team"
                label="1 · TEAMs"
                subtitle="Top 10 · squad"
            />
            <RankingPreviewButton
                mode="solo"
                label="2 · Solo"
                subtitle="Top 10 · individual"
            />
        </div>
    );
}
