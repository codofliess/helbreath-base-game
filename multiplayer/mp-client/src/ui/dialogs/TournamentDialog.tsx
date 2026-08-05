import { useEffect, useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { TOURNAMENT_DIALOG_BG } from '../../constants/SpriteKeys';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import {
    setTournamentDialogOpen,
    setTournamentDialogTab,
    setTournamentLeaderboardMode,
    tournamentDialogStore,
    type TournamentDialogTab,
} from '../store/TournamentDialog.store';
import { getStoredWalletPubkey } from '../../utils/walletAuth';
import {
    fetchHallOfFame,
    fetchLeaderboard,
    fetchTournamentDetail,
    fetchTournaments,
    registerForTournament,
    type HallOfFameEntry,
    type LeaderboardEntry,
    type LeaderboardMode,
    type TournamentMatch,
    type TournamentParticipant,
    type TournamentRow,
} from '../../utils/tournamentApi';

interface TournamentDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
}

function readCharacterName(): string {
    try {
        const raw = localStorage.getItem('gameState');
        if (!raw) {
            return '';
        }
        const state = JSON.parse(raw) as { characterName?: string };
        return state.characterName?.trim() ?? '';
    } catch {
        return '';
    }
}

function TabButton({
    id,
    label,
    active,
    onClick,
}: {
    id: TournamentDialogTab;
    label: string;
    active: boolean;
    onClick: (tab: TournamentDialogTab) => void;
}) {
    return (
        <button
            type="button"
            className={`tournament-tab${active ? ' tournament-tab-active' : ''}`}
            onClick={() => onClick(id)}
        >
            {label}
        </button>
    );
}

function shortEntry(entry: string | null | undefined): string {
    if (!entry) {
        return '—';
    }
    if (entry.length <= 10) {
        return entry;
    }
    return `${entry.slice(0, 4)}…${entry.slice(-4)}`;
}

function formatRoundLabel(round: number, maxRound: number): string {
    if (round === maxRound) {
        return 'Final';
    }
    if (round === maxRound - 1 && maxRound > 1) {
        return 'Semis';
    }
    return `R${round}`;
}

function buildEntryLabels(participants: TournamentParticipant[]): Map<string, string> {
    const labels = new Map<string, string>();
    for (const p of participants) {
        const name = p.character_name?.trim() || shortEntry(p.wallet);
        labels.set(p.wallet, name);
        if (p.team_name) {
            labels.set(p.team_name, p.team_name);
        }
    }
    return labels;
}

function BracketPanel({
    matches,
    participants,
}: {
    matches: TournamentMatch[];
    participants: TournamentParticipant[];
}) {
    if (matches.length === 0) {
        return <p className="tournament-hint">Bracket not seeded yet.</p>;
    }

    const labels = buildEntryLabels(participants);
    const maxRound = matches.reduce((max, m) => Math.max(max, m.round), 1);
    const byRound = new Map<number, TournamentMatch[]>();
    for (const match of matches) {
        const list = byRound.get(match.round) ?? [];
        list.push(match);
        byRound.set(match.round, list);
    }

    const rounds = [...byRound.keys()].sort((a, b) => a - b);

    return (
        <div className="tournament-bracket" role="list">
            {rounds.map((round) => {
                const roundMatches = (byRound.get(round) ?? []).slice().sort((a, b) => a.position - b.position);
                return (
                    <div key={round} className="tournament-bracket-round">
                        <div className="tournament-bracket-round-title">{formatRoundLabel(round, maxRound)}</div>
                        {roundMatches.map((match) => {
                            const labelA = match.entry_a
                                ? (labels.get(match.entry_a) ?? shortEntry(match.entry_a))
                                : 'TBD';
                            const labelB = match.entry_b
                                ? (labels.get(match.entry_b) ?? shortEntry(match.entry_b))
                                : match.entry_a && !match.entry_b && match.status === 'done'
                                    ? 'BYE'
                                    : 'TBD';
                            const winnerA = match.winner && match.winner === match.entry_a;
                            const winnerB = match.winner && match.winner === match.entry_b;
                            return (
                                <div
                                    key={match.id}
                                    className={`tournament-bracket-match tournament-bracket-match-${match.status}`}
                                    role="listitem"
                                >
                                    <div className={`tournament-bracket-slot${winnerA ? ' is-winner' : ''}`}>
                                        {labelA}
                                    </div>
                                    <div className={`tournament-bracket-slot${winnerB ? ' is-winner' : ''}`}>
                                        {labelB}
                                    </div>
                                    <span className="tournament-bracket-status">{match.status}</span>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

export function TournamentDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
}: TournamentDialogProps) {
    const isOpen = useStore(tournamentDialogStore, (s) => s.isOpen);
    const tab = useStore(tournamentDialogStore, (s) => s.tab);
    const preferredMode = useStore(tournamentDialogStore, (s) => s.leaderboardMode);
    const [mode, setMode] = useState<LeaderboardMode>('solo');

    useEffect(() => {
        if (isOpen && tab === 'leaderboard') {
            setMode(preferredMode === 'team' ? 'team' : 'solo');
        }
    }, [isOpen, tab, preferredMode]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
    const [hof, setHof] = useState<HallOfFameEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [registeringId, setRegisteringId] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
    const [bracketMatches, setBracketMatches] = useState<TournamentMatch[]>([]);
    const [bracketParticipants, setBracketParticipants] = useState<TournamentParticipant[]>([]);
    const [bracketLoading, setBracketLoading] = useState(false);
    const [bracketError, setBracketError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);
        setStatusMsg(null);

        const load = async () => {
            try {
                if (tab === 'leaderboard') {
                    const entries = await fetchLeaderboard(mode);
                    if (!cancelled) {
                        setLeaderboard(entries);
                    }
                } else if (tab === 'events') {
                    const rows = await fetchTournaments();
                    if (!cancelled) {
                        setTournaments(rows);
                    }
                } else {
                    const entries = await fetchHallOfFame();
                    if (!cancelled) {
                        setHof(entries);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [isOpen, tab, mode]);

    useEffect(() => {
        if (!isOpen || tab !== 'events' || !selectedTournamentId) {
            return;
        }

        let cancelled = false;
        setBracketLoading(true);
        setBracketError(null);

        const loadBracket = async () => {
            try {
                const detail = await fetchTournamentDetail(selectedTournamentId);
                if (!cancelled) {
                    setBracketMatches(detail.matches ?? []);
                    setBracketParticipants(detail.participants ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setBracketError(err instanceof Error ? err.message : 'Failed to load bracket');
                    setBracketMatches([]);
                    setBracketParticipants([]);
                }
            } finally {
                if (!cancelled) {
                    setBracketLoading(false);
                }
            }
        };

        void loadBracket();
        return () => {
            cancelled = true;
        };
    }, [isOpen, tab, selectedTournamentId]);

    if (!isOpen) {
        return null;
    }

    const handleRegister = async (tournament: TournamentRow) => {
        const wallet = getStoredWalletPubkey();
        if (!wallet) {
            setStatusMsg('Connect a wallet to register.');
            return;
        }

        setRegisteringId(tournament.id);
        setStatusMsg(null);
        try {
            await registerForTournament(tournament.id, wallet, readCharacterName());
            setStatusMsg(`Registered for ${tournament.name}.`);
            const rows = await fetchTournaments();
            setTournaments(rows);
            if (selectedTournamentId === tournament.id) {
                const detail = await fetchTournamentDetail(tournament.id);
                setBracketMatches(detail.matches ?? []);
                setBracketParticipants(detail.participants ?? []);
            }
        } catch (err) {
            setStatusMsg(err instanceof Error ? err.message : 'Registration failed');
        } finally {
            setRegisteringId(null);
        }
    };

    const toggleBracket = (tournamentId: string) => {
        setSelectedTournamentId((current) => (current === tournamentId ? null : tournamentId));
    };

    return (
        <OlympiaDialogShell
            id="tournament-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setTournamentDialogOpen(false);
            }}
            width={258}
            minHeight={339}
            bgSpriteKey={TOURNAMENT_DIALOG_BG}
            rootClassName="tournament-dialog-root"
        >
            <div className="olympia-dialog-title-bar tournament-dialog-title hb-nemesis-dialog-title">Tournaments</div>
            <div className="tournament-tabs">
                <TabButton id="leaderboard" label="Ranks" active={tab === 'leaderboard'} onClick={setTournamentDialogTab} />
                <TabButton id="events" label="Events" active={tab === 'events'} onClick={setTournamentDialogTab} />
                <TabButton id="hof" label="Honor" active={tab === 'hof'} onClick={setTournamentDialogTab} />
            </div>

            <div className="tournament-body">
                {tab === 'leaderboard' && (
                    <div className="tournament-mode-row">
                        <button
                            type="button"
                            className={`olympia-text-btn${mode === 'solo' ? ' tournament-mode-active' : ''}`}
                            onClick={() => {
                                setMode('solo');
                                setTournamentLeaderboardMode('solo');
                            }}
                        >
                            Solo
                        </button>
                        <button
                            type="button"
                            className={`olympia-text-btn${mode === 'team' ? ' tournament-mode-active' : ''}`}
                            onClick={() => {
                                setMode('team');
                                setTournamentLeaderboardMode('team');
                            }}
                        >
                            Team
                        </button>
                    </div>
                )}

                {loading && <p className="tournament-hint">Loading…</p>}
                {error && <p className="tournament-error">{error}</p>}
                {statusMsg && <p className="tournament-hint">{statusMsg}</p>}

                {!loading && !error && tab === 'leaderboard' && (
                    <div className="tournament-list">
                        {leaderboard.length === 0 ? (
                            <p className="tournament-hint">No rated fighters yet. Enter the Colosseum.</p>
                        ) : (
                            leaderboard.map((row, index) => (
                                <div key={row.wallet} className="tournament-row">
                                    <span className="tournament-rank">#{index + 1}</span>
                                    <span className="tournament-name" title={row.display_name || row.wallet}>
                                        {row.display_name || shortEntry(row.wallet)}
                                    </span>
                                    <span className="tournament-rating">{row.rating}</span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && !error && tab === 'events' && (
                    <div className="tournament-list">
                        {tournaments.length === 0 ? (
                            <p className="tournament-hint">No tournaments posted yet.</p>
                        ) : (
                            tournaments.map((t) => {
                                const expanded = selectedTournamentId === t.id;
                                return (
                                    <div key={t.id} className={`tournament-event${expanded ? ' is-expanded' : ''}`}>
                                        <button
                                            type="button"
                                            className="tournament-event-header tournament-event-toggle"
                                            onClick={() => toggleBracket(t.id)}
                                            aria-expanded={expanded}
                                        >
                                            <strong>{t.name}</strong>
                                            <span className="tournament-status">{t.status}</span>
                                        </button>
                                        <div className="tournament-event-meta">
                                            {t.format} · max {t.max_entries}
                                            {expanded ? ' · bracket' : ' · tap for bracket'}
                                        </div>
                                        {t.status === 'registration' && (
                                            <button
                                                type="button"
                                                className="olympia-text-btn tournament-register-btn"
                                                disabled={registeringId === t.id}
                                                onClick={() => void handleRegister(t)}
                                            >
                                                {registeringId === t.id ? 'Registering…' : 'Register'}
                                            </button>
                                        )}
                                        {expanded && (
                                            <div className="tournament-bracket-wrap">
                                                {bracketLoading && <p className="tournament-hint">Loading bracket…</p>}
                                                {bracketError && <p className="tournament-error">{bracketError}</p>}
                                                {!bracketLoading && !bracketError && (
                                                    <BracketPanel
                                                        matches={bracketMatches}
                                                        participants={bracketParticipants}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {!loading && !error && tab === 'hof' && (
                    <div className="tournament-list">
                        {hof.length === 0 ? (
                            <p className="tournament-hint">The hall of fame awaits its first champions.</p>
                        ) : (
                            hof.map((entry) => (
                                <div key={entry.id} className="tournament-row">
                                    <span className="tournament-title">{entry.title}</span>
                                    <span className="tournament-name" title={entry.display_name || entry.entry}>
                                        {entry.display_name || shortEntry(entry.entry)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </OlympiaDialogShell>
    );
}
