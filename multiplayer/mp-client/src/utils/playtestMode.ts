import { isPublicPlayHost } from './playerMode';

/** Display name for the isolated playtest character (not a live traveler). */
export const PLAYTEST_CHARACTER_NAME = 'ElonQa';

/** Isolated account id — not a Solana pubkey; must match server PlaytestMode.AccountId. */
export const PLAYTEST_ACCOUNT_ID = 'playtest-elonqa';

/** Token accepted only by a PLAYTEST=1 game server. */
export const PLAYTEST_AUTH_TOKEN = 'playtest-bypass-token';

/**
 * True only for a dedicated playtest Vite/build with VITE_PLAYTEST=1.
 * Always false on play.chainlords.net / *.chainlords.net / live VPS IPs
 * even if a playtest bundle is accidentally deployed there.
 */
export function isPlaytestClient(): boolean {
    if (isPublicPlayHost()) {
        return false;
    }
    const raw = (import.meta.env.VITE_PLAYTEST ?? '').toString().trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Fake wallet session for the playtest door (never a Phantom SIWS token). */
export function createPlaytestWalletSession(): { wallet: string; token: string; expiresAt: number } {
    return {
        wallet: PLAYTEST_ACCOUNT_ID,
        token: PLAYTEST_AUTH_TOKEN,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };
}
