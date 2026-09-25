import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COPY } from '../web/public/copy';
import { parseOnchainFlag } from '../src/shared/publish-policy';

describe('player-facing copy (Maggy 2026-09-25)', () => {
  it('uses the off-chain title, subtitle, footer, search, and ranking strings', () => {
    expect(COPY.title).toBe('ChainLords Kill Ledger');
    expect(COPY.subtitle).toBe("Every enemy kill, sealed by the realm's server.");
    expect(COPY.footer).toBe("Kills are recorded by the realm's server. The same two heroes count at most 2 kills a day and 10 a week.");
    expect(COPY.search).toBe('Search a hero…');
    expect(COPY.rankingsTitle).toBe('City rankings · Top 30');
    expect(COPY.rankingsWindow).toBe('Last 30 days');
    expect(COPY.explainer).toBe('Slay a Top 10 hero of the rival city and the kill counts ×3. Top 30 counts ×2. Everyone else counts ×1. Ranks come from kills in the last 30 days, and a hero\'s rank is locked the moment they fall.');
    expect(COPY.unranked).toBe('Unranked · last 30 days');
    expect(COPY.rank(4)).toBe('Rank #4 · last 30 days');
    expect(COPY.statKills).toBe('Kills');
    expect(COPY.statKillScore).toBe('Kill score');
    expect(COPY.statDeaths).toBe('Deaths');
    expect(COPY.statZemLooted).toBe('Zem looted');
    expect(COPY.noKillsYet).toBe('No kills yet.');
    expect(COPY.neverFallen).toBe('Never fallen.');
    expect(COPY.noLoot).toBe('No loot');
    expect(COPY.bound).toBe('Bound');
    expect(COPY.colWorth).toBe('Worth if slain');
    expect(COPY.delayLine('{delay}')).toBe('Kills appear {delay} after they happen. Times are rounded.');
    expect(COPY.lootDelayLine('{delay}')).toBe('Loot is revealed {delay} after the kill.');
  });
  it('maps statuses to Counted / Limit reached / Voided / Level gap with the Maggy tooltips', () => {
    expect(COPY.statuses.credited).toEqual({ label: 'Counted', hint: 'This kill counts.' });
    expect(COPY.statuses.pair_limit_reached).toEqual({ label: 'Limit reached', hint: "These two heroes fought too often. This kill doesn't count." });
    expect(COPY.statuses.rejected_level_gap).toEqual({ label: 'Level gap', hint: "The level difference was too wide. This kill doesn't count." });
    expect(COPY.statuses.kill_burned).toEqual({ label: 'Voided', hint: "The realm voided this kill. It doesn't count." });
  });
  it('keeps on-chain subtitle/footer behind the deploy flag (default off)', () => {
    expect(parseOnchainFlag(undefined)).toBe(false);
    expect(parseOnchainFlag('false')).toBe(false);
    expect(parseOnchainFlag('true')).toBe(true);
    expect(COPY.subtitleOnchain).toBe("Every enemy kill, sealed by the realm's server and inscribed on-chain.");
    expect(COPY.footerOnchain).toBe("Kills are recorded by the realm's server and sealed on-chain. The same two heroes count at most 2 kills a day and 10 a week.");
  });
  it('public UI source does not show ledger jargon as player-facing labels', () => {
    const ui = ['web/public/App.tsx', 'web/public/components.tsx', 'web/public/copy.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(ui).not.toMatch(/CREDITED|PAIR LIMIT|KillCredited|PairLimitReached|KillBurned|KillRejected|rules ek-v1|Gold looted/);
  });
});
