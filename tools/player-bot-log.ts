import { closeSync, fsyncSync, mkdirSync, openSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';

import { scorePlayerBotRun, type PlayerBotVerdict } from './player-bot-score.ts';

export interface PlayerBotRunTotals {
    slimeKills: number;
    deaths: number;
    disconnects: number;
    potionsUsed: number;
    casts: number;
    durationMs: number;
    worldId?: string;
    spellTable?: readonly SpellTableRow[];
}

export interface SpellCastRecord {
    spellId: number;
    spellName: string;
    result: 'accepted' | 'rejected' | 'fizzled';
    reason: string;
}

export interface SpellTableRow {
    spellId: number;
    spellName: string;
    attempts: number;
    accepted: number;
    rejected: number;
    fizzled: number;
    reasons: Record<string, number>;
}

/** Per-spell attempts from the bot's own cast lines. A spell with no lines is absent, not zeroed. */
export function summarizeSpellCasts(records: readonly SpellCastRecord[]): SpellTableRow[] {
    const rows = new Map<number, SpellTableRow>();
    for (const record of records) {
        let row = rows.get(record.spellId);
        if (!row) {
            row = {
                spellId: record.spellId,
                spellName: record.spellName,
                attempts: 0,
                accepted: 0,
                rejected: 0,
                fizzled: 0,
                reasons: {},
            };
            rows.set(record.spellId, row);
        }
        if (record.spellName) {
            row.spellName = record.spellName;
        }
        row.attempts += 1;
        if (record.result === 'accepted') {
            row.accepted += 1;
        } else if (record.result === 'fizzled') {
            row.fizzled += 1;
        } else {
            row.rejected += 1;
        }
        const reason = record.reason.trim() || 'unknown';
        row.reasons[reason] = (row.reasons[reason] ?? 0) + 1;
    }
    return [...rows.values()].sort((left, right) => left.spellId - right.spellId);
}

export function formatSpellTable(rows: readonly SpellTableRow[]): string {
    if (rows.length === 0) {
        return 'spell-table: (no casts)';
    }
    const lines = ['spellId name attempts accepted rejected fizzled reasons'];
    for (const row of rows) {
        const reasons = Object.entries(row.reasons)
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([reason, count]) => `${reason}=${count}`)
            .join(',');
        lines.push(
            `${row.spellId} ${row.spellName} ${row.attempts} ${row.accepted} ${row.rejected} ${row.fizzled} ${reasons}`,
        );
    }
    return lines.join('\n');
}

function isTransientFsError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EAGAIN' || code === 'EBUSY' || code === 'EINTR';
}

function pauseMs(ms: number): void {
    const until = Date.now() + ms;
    while (Date.now() < until) {
        // The log filesystem can return EAGAIN if every line opens the file again.
    }
}

/**
 * JSONL run log. Every line is one event. The last line is the summary.
 * The log is written by the bot from its own actions and from packets it received.
 * The file stays open so a burst of casts does not reopen it on every line.
 */
export class PlayerBotLog {
    private fd: number;

    constructor(private readonly filePath: string) {
        mkdirSync(dirname(filePath), { recursive: true });
        this.fd = this.openAppend();
    }

    public get path(): string {
        return this.filePath;
    }

    public close(): void {
        if (this.fd < 0) {
            return;
        }
        try {
            fsyncSync(this.fd);
        } catch {
            // The summary line is already written. A failed sync must not hide the verdict.
        }
        closeSync(this.fd);
        this.fd = -1;
    }

    public event(kind: string, fields: Record<string, unknown> = {}): void {
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            kind,
            ...fields,
        });
        this.writeLine(`${line}\n`);
    }

    private openAppend(): number {
        let last: unknown;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                return openSync(this.filePath, 'a');
            } catch (error) {
                last = error;
                if (!isTransientFsError(error) || attempt === 7) {
                    throw error;
                }
                pauseMs(20 * (attempt + 1));
            }
        }
        throw last;
    }

    private writeLine(text: string): void {
        const buf = Buffer.from(text);
        let offset = 0;
        let attempt = 0;
        while (offset < buf.length) {
            try {
                offset += writeSync(this.fd, buf, offset);
                attempt = 0;
            } catch (error) {
                if (!isTransientFsError(error) || attempt >= 8) {
                    throw error;
                }
                attempt += 1;
                pauseMs(20 * attempt);
            }
        }
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
            worldId: totals.worldId ?? '',
            spellTable: totals.spellTable ?? [],
            verdict,
        });
        return verdict;
    }
}
