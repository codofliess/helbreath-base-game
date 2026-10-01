/**
 * Scores a finished rules-bot run from the bot's own counters.
 * This module does not read server logs and is safe to call when the run ends.
 * Post-run server-log cross-checks belong in player-bot-eval.ts only.
 */

export type PlayerBotVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface PlayerBotScoreInput {
    slimeKills: number;
    disconnects: number;
}

/**
 * PASS = at least 30 slime kills and 0 disconnects.
 * FAIL = under 10 slime kills (treated as a game/network problem, not the rules).
 * Anything else is inconclusive: the run neither cleared the bar nor fell under the fail line.
 */
export function scorePlayerBotRun(input: PlayerBotScoreInput): PlayerBotVerdict {
    if (input.slimeKills >= 30 && input.disconnects === 0) {
        return 'PASS';
    }
    if (input.slimeKills < 10) {
        return 'FAIL';
    }
    return 'INCONCLUSIVE';
}
