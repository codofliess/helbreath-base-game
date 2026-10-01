import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { scorePlayerBotRun, type PlayerBotVerdict } from './player-bot-score.ts';

export interface PlayerBotRunTotals {
    slimeKills: number;
    deaths: number;
    disconnects: number;
    potionsUsed: number;
    casts: number;
    durationMs: number;
}

/**
 * JSONL run log. Every line is one event. The last line is the summary.
 * The log is written by the bot from its own actions and from packets it received.
 */
export class PlayerBotLog {
    constructor(private readonly filePath: string) {
        mkdirSync(dirname(filePath), { recursive: true });
    }

    public get path(): string {
        return this.filePath;
    }

    public event(kind: string, fields: Record<string, unknown> = {}): void {
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            kind,
            ...fields,
        });
        appendFileSync(this.filePath, `${line}\n`, 'utf8');
    }

    public summary(totals: PlayerBotRunTotals): PlayerBotVerdict {
        const verdict = scorePlayerBotRun({
            slimeKills: totals.slimeKills,
            disconnects: totals.disconnects,
        });
        this.event('summary', {
            slimeKills: totals.slimeKills,
            deaths: totals.deaths,
            disconnects: totals.disconnects,
            potionsUsed: totals.potionsUsed,
            casts: totals.casts,
            durationMs: totals.durationMs,
            verdict,
        });
        return verdict;
    }
}
