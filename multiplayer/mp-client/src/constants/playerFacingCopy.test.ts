import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
    CASH_SHOP_SKUS,
    REWARD_MARKET_ANNOUNCED,
    SHOW_TOKEN_PRICE,
    shouldShowRewardMarketTab,
} from './CashShopCatalog';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '../..');
const distRoot = path.join(clientRoot, 'dist');

/** Phrases the blind "a reward" replace left in prices and labels. */
const BROKEN_PLAYER_COPY: readonly { name: string; pattern: RegExp }[] = [
    { name: 'number before a reward', pattern: /\d[\d,\s]*k?\s+a reward/i },
    { name: 'a reward before a colon', pattern: /a reward\s*:/i },
    { name: 'does not accept a reward', pattern: /does not accept a reward/i },
    { name: 'pending a reward', pattern: /pending a reward/i },
    { name: 'staked a reward', pattern: /staked a reward/i },
];

const APPROVED_REFERRAL = /You earn a\s+reward when they hit 150/;

function walkFiles(dir: string, ext: RegExp, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) {
        return out;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(full, ext, out);
        } else if (ext.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

function snippet(text: string, index: number): string {
    const start = Math.max(0, index - 48);
    const end = Math.min(text.length, index + 48);
    return text.slice(start, end).replace(/\s+/g, ' ');
}

describe('player-facing copy', () => {
    it('keeps the reward market hidden while no row is buyable without a token price', () => {
        assert.equal(REWARD_MARKET_ANNOUNCED, false);
        assert.equal(SHOW_TOKEN_PRICE, false);
        assert.equal(shouldShowRewardMarketTab(), false);
        assert.equal(shouldShowRewardMarketTab(CASH_SHOP_SKUS, true), false);
        assert.ok(CASH_SHOP_SKUS.some((sku) => sku.priceHell > 0));
    });

    it(
        'ships no broken "a reward" phrase, and the hub CSS hides the occupied chips',
        { timeout: 240_000 },
        () => {
            execFileSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite/config.prod.mjs'], {
                cwd: clientRoot,
                stdio: 'inherit',
                timeout: 220_000,
                env: process.env,
            });

            const built = walkFiles(distRoot, /\.(?:js|css|html)$/);
            assert.ok(built.length > 0, 'production build wrote no js, css, or html');

            const bundle = built
                .map((file) => fs.readFileSync(file, 'utf8'))
                .join('\n');
            for (const broken of BROKEN_PLAYER_COPY) {
                const found = broken.pattern.exec(bundle);
                assert.equal(
                    found,
                    null,
                    `${broken.name} in the built client: ${found ? snippet(bundle, found.index) : ''}`,
                );
            }
            assert.match(bundle, APPROVED_REFERRAL);

            const indexHtml = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');
            const linkedCss = [...indexHtml.matchAll(/<link\b[^>]*>/gi)]
                .map((match) => match[0])
                .filter((tag) => /stylesheet/i.test(tag))
                .map((tag) => tag.match(/href=["']([^"']+)["']/i)?.[1] ?? '')
                .filter((href) => href.length > 0 && !href.startsWith('http'));
            assert.ok(linkedCss.length > 0, 'dist/index.html links no stylesheet');

            const assetCss = linkedCss.filter((href) => href.includes('assets/'));
            assert.ok(
                assetCss.length > 0,
                `dist/index.html does not link a built assets stylesheet (linked: ${linkedCss.join(', ')})`,
            );

            const hiding = assetCss.filter((href) => {
                const file = path.join(distRoot, href.replace(/^\.\//, ''));
                const css = fs.readFileSync(file, 'utf8');
                return /login-selectchar-active\s+\.selectchar-react-occupied__slot\s*\{[^}]*display\s*:\s*none/i.test(
                    css,
                );
            });
            assert.ok(
                hiding.length > 0,
                `built CSS linked from index.html is missing the login-selectchar-active hide rule (${assetCss.join(', ')})`,
            );
        },
    );
});
