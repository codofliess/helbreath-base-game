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
 * Identifiers such as HELL_MINT stay. The replacement is the noun "rewards"
 * with no article, so a number is not followed by "a reward" and a label is
 * not "a reward:". "rewards is" becomes "rewards are".
 */
export function playerTokenCopy(text: string): string {
    return text.replace(PLAYER_FACING_TOKEN_NAME, 'rewards').replace(/\brewards is\b/gi, (match) => {
        const noun = match[0] === 'R' ? 'Rewards' : 'rewards';
        return `${noun} are`;
    });
}
