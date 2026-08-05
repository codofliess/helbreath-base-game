/**
 * Optional practical smoke: enter game as dev traveler and dump QA state.
 * Does NOT validate full combat matrix (use ops/combat_audit.py for theory).
 *
 *   node multiplayer/mp-client/scripts/qa-combat-smoke.mjs
 *   QA_URL=https://play.chainlords.net node ...
 *
 * Requires page hooks when available:
 *   window.__helbreathDevEnterPlayWorld / __helbreathDevConnectAs
 *   window.__CL_QA__ (optional bag/stats dump — added when harness expands)
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'qa-combat-smoke-out');
fs.mkdirSync(OUT, { recursive: true });

const URL = process.env.QA_URL || 'http://localhost:8081/';
const CHAR = process.env.QA_CHAR || 'TTTrrraaav';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
});

const result = {
    ok: false,
    url: URL,
    char: CHAR,
    steps: [],
    errors,
};

try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    result.steps.push('goto');

    // Login hub may vary on prod; try dev hooks first.
    const hasDev = await page.evaluate(() => typeof window.__helbreathDevConnectAs === 'function');
    if (hasDev) {
        await page.evaluate(() => window.__helbreathDevEnterPlayWorld?.());
        await page.waitForTimeout(400);
        await page.evaluate((name) => window.__helbreathDevConnectAs(name), CHAR);
        result.steps.push('devConnect');
        try {
            await page.waitForFunction(() => document.body.classList.contains('game-world-active'), {
                timeout: 60_000,
            });
            result.steps.push('inWorld');
        } catch {
            result.steps.push('inWorld-timeout');
        }
    } else {
        result.steps.push('no-dev-hooks');
    }

    await page.screenshot({ path: path.join(OUT, 'smoke.png'), fullPage: true });
    result.steps.push('screenshot');

    const qa = await page.evaluate(() => {
        if (typeof window.__CL_QA__?.getState === 'function') {
            return window.__CL_QA__.getState();
        }
        return {
            bodyClass: document.body.className,
            hasCanvas: !!document.querySelector('#game-container canvas'),
            hasHud: !!document.querySelector('.hotkey-bar-root'),
            priority: window.__CL_PRIORITY_STATS__ || null,
        };
    });
    result.qa = qa;
    result.ok = result.steps.includes('inWorld') || !!qa.hasCanvas;
} catch (e) {
    result.error = String(e);
    try {
        await page.screenshot({ path: path.join(OUT, 'smoke-fail.png'), fullPage: true });
    } catch {
        /* ignore */
    }
} finally {
    await browser.close();
}

const reportPath = path.join(OUT, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log('Wrote', reportPath);
process.exit(result.ok ? 0 : 2);
