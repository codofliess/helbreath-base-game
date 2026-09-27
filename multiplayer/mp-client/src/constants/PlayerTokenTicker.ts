/**
 * Player-facing token ticker (HUD / landing / toasts).
 * On-chain mint / Path B / Solscan symbols may still be HELL — do not use this for contract ids.
 */
export const PLAYER_TOKEN_TICKER = 'helbreath';

/** Canonical player-visible ticker, including the $ prefix. */
export const PLAYER_TOKEN_DISPLAY = `$${PLAYER_TOKEN_TICKER}`;

const PLAYER_FACING_TOKEN_NAME =
    /(?:\ba\s+|\bthe\s+)?helbreath token|\$helbreath\b|\$HELL\b|\$hell\b|\$Hell\b/gi;

/**
 * Strips a token name from copy that reaches the player (server notes, toasts).
 * Identifiers such as HELL_MINT stay. The replacement is the words "a reward".
 */
export function playerTokenCopy(text: string): string {
    return text.replace(PLAYER_FACING_TOKEN_NAME, 'a reward');
}
