/**
 * Player-facing token ticker (HUD / landing / toasts).
 * On-chain mint / Path B / Solscan symbols may still be HELL — do not use this for contract ids.
 */
export const PLAYER_TOKEN_TICKER = 'helbreath';

/** Canonical player-visible ticker, including the $ prefix. */
export const PLAYER_TOKEN_DISPLAY = `$${PLAYER_TOKEN_TICKER}`;

const LEGACY_PLAYER_TICKER = /\$HELL\b|\$hell\b|\$Hell\b/g;

/** Rewrites leftover $HELL / $hell in copy that reaches the player (server notes, toasts). */
export function playerTokenCopy(text: string): string {
    return text.replace(LEGACY_PLAYER_TICKER, PLAYER_TOKEN_DISPLAY);
}
