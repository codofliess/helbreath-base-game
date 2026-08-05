import { getStoredWalletToken } from './walletAuth';

const DEFAULT_MIDDLEWARE_URL = 'http://localhost:3001';

export type LeaderboardMode = 'solo' | 'team';

export interface LeaderboardEntry {
    wallet: string;
    display_name: string;
    rating: number;
    raw_rating: number;
    peak_rating: number;
    matches: number;
    wins: number;
    losses: number;
    last_match_at: string | null;
}

export interface TournamentRow {
    id: string;
    name: string;
    format: string;
    team_size: number;
    status: string;
    max_entries: number;
    starts_at: string | null;
    prizes_json: Array<{ asset: string; amount: number }>;
    created_at: string;
}

export interface TournamentParticipant {
    id: string;
    tournament_id: string;
    wallet: string;
    character_name: string;
    team_name: string | null;
    seed: number | null;
    placement: number | null;
}

export interface TournamentMatch {
    id: string;
    tournament_id: string;
    round: number;
    position: number;
    entry_a: string | null;
    entry_b: string | null;
    winner: string | null;
    status: string;
    arena_world_id: string | null;
}

export interface HallOfFameEntry {
    id: string;
    tournament_id: string | null;
    entry: string;
    display_name: string;
    title: string;
    awarded_at: string;
}

export interface TournamentPrize {
    id: string;
    tournament_id: string;
    wallet: string;
    asset: string;
    amount: string | number;
    placement: number;
    status: string;
    tx_signature: string | null;
    paid_at: string | null;
}

function getMiddlewareUrl(): string {
    const fromEnv = (import.meta.env.VITE_MIDDLEWARE_URL ?? '').toString().trim();
    if (fromEnv.length > 0) {
        return fromEnv.replace(/\/$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
        const h = window.location.hostname.toLowerCase();
        if (h === 'play.chainlords.net' || h.endsWith('.chainlords.net')) {
            return 'https://chainlords-middleware-production.up.railway.app';
        }
    }
    return DEFAULT_MIDDLEWARE_URL;
}

function walletAuthHeaders(): Record<string, string> {
    const token = getStoredWalletToken();
    if (!token) {
        return {};
    }

    return { 'X-Wallet-Token': token };
}

async function readJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json() as { error?: string };
            detail = body.error ? `: ${body.error}` : '';
        } catch {
            // ignore parse errors
        }
        throw new Error(`Request failed (${res.status})${detail}`);
    }

    return res.json() as Promise<T>;
}

/** Fetches the world PvP leaderboard with lazy inactivity decay already applied. */
export async function fetchLeaderboard(mode: LeaderboardMode = 'solo'): Promise<LeaderboardEntry[]> {
    const res = await fetch(`${getMiddlewareUrl()}/leaderboard?mode=${encodeURIComponent(mode)}`);
    const body = await readJson<{ success: boolean; entries: LeaderboardEntry[] }>(res);
    return body.entries ?? [];
}

export async function fetchTournaments(): Promise<TournamentRow[]> {
    const res = await fetch(`${getMiddlewareUrl()}/tournaments`);
    const body = await readJson<{ success: boolean; tournaments: TournamentRow[] }>(res);
    return body.tournaments ?? [];
}

export async function fetchTournamentDetail(tournamentId: string): Promise<{
    tournament: TournamentRow;
    participants: TournamentParticipant[];
    matches: TournamentMatch[];
}> {
    const res = await fetch(`${getMiddlewareUrl()}/tournaments/${encodeURIComponent(tournamentId)}`);
    return readJson(res);
}

export async function registerForTournament(
    tournamentId: string,
    wallet: string,
    characterName: string,
    teamName?: string,
): Promise<TournamentParticipant> {
    const res = await fetch(`${getMiddlewareUrl()}/tournaments/${encodeURIComponent(tournamentId)}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...walletAuthHeaders(),
        },
        body: JSON.stringify({
            wallet,
            character_name: characterName,
            team_name: teamName,
        }),
    });
    const body = await readJson<{ success: boolean; participant: TournamentParticipant }>(res);
    return body.participant;
}

export async function fetchHallOfFame(): Promise<HallOfFameEntry[]> {
    const res = await fetch(`${getMiddlewareUrl()}/hall-of-fame`);
    const body = await readJson<{ success: boolean; entries: HallOfFameEntry[] }>(res);
    return body.entries ?? [];
}

export async function fetchPrizes(wallet: string): Promise<TournamentPrize[]> {
    const res = await fetch(`${getMiddlewareUrl()}/prizes?wallet=${encodeURIComponent(wallet)}`);
    const body = await readJson<{ success: boolean; prizes: TournamentPrize[] }>(res);
    return body.prizes ?? [];
}
