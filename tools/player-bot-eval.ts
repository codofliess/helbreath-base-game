/**
 * Post-run scorer. Run this only after the bot has stopped.
 * It may read a local server log to cross-check the JSONL. That cross-check is printed
 * and then discarded. It is not an input to player-bot rules and this file must not be
 * imported by client-simulator.ts or player-bot-rules.ts.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { scorePlayerBotRun, type PlayerBotVerdict } from './player-bot-score.ts';

interface SummaryLine {
    slimeKills: number;
    deaths: number;
    disconnects: number;
    potionsUsed: number;
    casts: number;
    durationMs: number;
    verdict: PlayerBotVerdict;
}

function argValue(argv: readonly string[], key: string): string | undefined {
    const prefix = `--${key}=`;
    for (let index = 0; index < argv.length; index++) {
        const token = argv[index];
        if (token === `--${key}`) {
            return argv[index + 1];
        }
        if (token.startsWith(prefix)) {
            return token.slice(prefix.length);
        }
    }
    return undefined;
}

function assertLocalServerLog(rawPath: string): string {
    const lowered = rawPath.trim().toLowerCase();
    if (lowered.includes('://') || lowered.startsWith('ws:') || lowered.startsWith('wss:')) {
        throw new Error('Refusing server log: URLs are not a local file.');
    }
    if (lowered.includes('chainlords.net') || lowered.includes('64.176.23.40')) {
        throw new Error('Refusing server log: production host paths are not readable from this scorer.');
    }
    const fullPath = resolve(rawPath);
    const stat = statSync(fullPath);
    if (!stat.isFile()) {
        throw new Error(`Server log is not a file: ${fullPath}`);
    }
    return fullPath;
}

function readSummary(logPath: string): SummaryLine {
    const text = readFileSync(logPath, 'utf8');
    const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    for (let index = lines.length - 1; index >= 0; index--) {
        const parsed = JSON.parse(lines[index]) as Partial<SummaryLine> & { kind?: string };
        if (parsed.kind === 'summary') {
            return {
                slimeKills: Number(parsed.slimeKills ?? 0),
                deaths: Number(parsed.deaths ?? 0),
                disconnects: Number(parsed.disconnects ?? 0),
                potionsUsed: Number(parsed.potionsUsed ?? 0),
                casts: Number(parsed.casts ?? 0),
                durationMs: Number(parsed.durationMs ?? 0),
                verdict: scorePlayerBotRun({
                    slimeKills: Number(parsed.slimeKills ?? 0),
                    disconnects: Number(parsed.disconnects ?? 0),
                }),
            };
        }
    }
    throw new Error(`No summary line in ${logPath}.`);
}

function countSlimeMentions(serverLogPath: string): number {
    const text = readFileSync(serverLogPath, 'utf8');
    let count = 0;
    for (const line of text.split('\n')) {
        if (/slime/i.test(line)) {
            count += 1;
        }
    }
    return count;
}

function main(): void {
    const argv = process.argv.slice(2);
    if (argv.some((token) => token.startsWith('--feed-bot') || token.startsWith('--server-state'))) {
        throw new Error('This scorer cannot feed the bot. Remove --feed-bot / --server-state.');
    }
    const logArg = argValue(argv, 'log');
    if (!logArg) {
        throw new Error('Usage: tsx player-bot-eval.ts --log <jsonl> [--server-log <local file>]');
    }
    const summary = readSummary(resolve(logArg));
    let serverLogNote = 'server-log cross-check: not requested';
    const serverLogArg = argValue(argv, 'server-log');
    if (serverLogArg) {
        const serverLogPath = assertLocalServerLog(serverLogArg);
        const mentions = countSlimeMentions(serverLogPath);
        serverLogNote =
            `server-log cross-check: ${mentions} slime mention(s) in ${serverLogPath} ` +
            '(post-run only, not an input to the bot)';
    }
    console.log(
        `verdict=${summary.verdict} slimeKills=${summary.slimeKills} deaths=${summary.deaths} ` +
        `disconnects=${summary.disconnects} potionsUsed=${summary.potionsUsed} casts=${summary.casts} ` +
        `durationMs=${summary.durationMs}`,
    );
    console.log(serverLogNote);
    if (summary.verdict !== 'PASS') {
        process.exitCode = 1;
    }
}

main();
