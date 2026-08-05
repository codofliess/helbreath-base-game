/**
 * P2 hub DOM verify: F5 / F6 / death UI without world or map load.
 * Opens dialogs via store dynamic import using the same Vite ?t= URL as App
 * (bare /src/... paths create a duplicate store module under HMR).
 * Run: node scripts/verify-p2-hub-dom.mjs
 * Requires: vite traveler on :8081
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-p2-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.VERIFY_URL || 'http://localhost:8081/';
const TIMEOUT_MS = 90_000;

const created = [];
const checks = [];
const blockers = [];

function log(msg, extra) {
    if (extra !== undefined) {
        console.log(msg, extra);
    } else {
        console.log(msg);
    }
}

function addCheck(id, ok, detail) {
    checks.push({ id, ok: !!ok, detail: detail || '' });
    log(ok ? `CHECK ok: ${id}` : `CHECK fail: ${id}`, detail || '');
    if (!ok) {
        blockers.push(`${id}: ${detail || 'failed'}`);
    }
}

async function shot(page, fileName) {
    const full = path.join(OUT, fileName);
    await page.screenshot({ path: full, fullPage: true });
    created.push(fileName);
    log('screenshot', fileName);
}

/**
 * Vite serves stores as `/src/.../X.store.ts?t=<hmr>` — importing without `?t=`
 * yields a second module instance that App does not subscribe to.
 */
async function resolveStoreUrl(page, pathSuffix) {
    const url = await page.evaluate((suffix) => {
        const hit = performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .find((n) => n.includes(suffix));
        if (hit) {
            const u = new URL(hit);
            return u.pathname + u.search;
        }
        // Fallback: scan modulepreload / script-ish links
        for (const el of document.querySelectorAll('link[href], script[src]')) {
            const href = el.getAttribute('href') || el.getAttribute('src') || '';
            if (href.includes(suffix)) {
                const u = new URL(href, location.origin);
                return u.pathname + u.search;
            }
        }
        return suffix.startsWith('/') ? suffix : `/${suffix}`;
    }, pathSuffix);
    log('resolveStore', `${pathSuffix} -> ${url}`);
    return url;
}

/** Dismiss Server Message / connecting overlays that block hub interaction. */
async function dismissOverlays(page) {
    for (let i = 0; i < 6; i++) {
        const dismissed = await page.evaluate(() => {
            const roots = [...document.querySelectorAll('[data-dialog-id]')];
            for (const root of roots) {
                const title = (root.textContent || '').slice(0, 200);
                const id = root.getAttribute('data-dialog-id') || '';
                const isServerMsg = /Server Message/i.test(title) || id === 'server-message-dialog';
                const isConnecting = /connecting/i.test(title) || id === 'connecting-dialog';
                if (!isServerMsg && !isConnecting) {
                    continue;
                }
                const btn = [...root.querySelectorAll('button')].find((b) =>
                    /^OK$/i.test((b.textContent || '').trim()),
                );
                if (btn) {
                    btn.click();
                    return id || 'unknown';
                }
            }
            return null;
        });
        if (!dismissed) {
            break;
        }
        log('dismissed overlay', dismissed);
        await page.waitForTimeout(250);
    }
}

async function waitForReactApp(page) {
    await page.waitForFunction(
        () => {
            const root = document.getElementById('root');
            return !!document.body && !!root && root.childElementCount > 0;
        },
        { timeout: TIMEOUT_MS },
    );
    await page
        .waitForSelector('.login-hub, .login-hub-world, #game-container, #app', { timeout: TIMEOUT_MS })
        .catch(() => {});
}

async function waitForStoreResource(page, pathSuffix) {
    await page
        .waitForFunction(
            (suffix) =>
                performance.getEntriesByType('resource').some((r) => r.name.includes(suffix)),
            pathSuffix,
            { timeout: TIMEOUT_MS },
        )
        .catch(() => {});
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(TIMEOUT_MS);
    page.on('pageerror', (err) => log('pageerror', String(err)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            log('[console.error]', msg.text());
        }
    });

    const url = `${BASE}${BASE.includes('?') ? '&' : '?'}cb=${Date.now()}&hub=p2`;
    log('goto', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await waitForReactApp(page);
    await page.waitForTimeout(1000);
    await dismissOverlays(page);

    await waitForStoreResource(page, '/src/ui/store/CharacterDialog.store.ts');
    const charUrl = await resolveStoreUrl(page, '/src/ui/store/CharacterDialog.store.ts');
    const invUrl = await resolveStoreUrl(page, '/src/ui/store/InventoryDialog.store.ts');
    const deathUrl = await resolveStoreUrl(page, '/src/ui/store/DeathDialog.store.ts');

    // --- F5 Character ---
    await page.evaluate(async (modUrl) => {
        const { setCharacterDialogOpen } = await import(modUrl);
        setCharacterDialogOpen(true);
    }, charUrl);
    await page.waitForTimeout(400);
    await shot(page, 'hub-01-f5.png');

    const f5 = await page.evaluate(() => {
        const root = document.querySelector('.character-dialog-root');
        const doc = document.documentElement?.outerHTML || '';
        const text = document.body?.innerText || '';
        const needles = ['Talents', 'Majestics', 'Hunger', 'Contribution', 'Title'];
        const found = {};
        for (const n of needles) {
            // Olympia labels live in data-label / class names; Contribution/Title are visible text.
            found[n] =
                text.includes(n) ||
                doc.includes(n) ||
                !!document.querySelector(`[data-label*="${n}"]`) ||
                !!document.querySelector(`.character-olympia-${n.toLowerCase()}`);
        }
        return {
            root: !!root,
            visible: !!(root && root.getClientRects().length > 0),
            found,
        };
    });
    addCheck(
        'f5-root',
        f5.root && f5.visible,
        f5.root ? (f5.visible ? 'visible' : 'in DOM but not visible') : 'missing .character-dialog-root',
    );
    for (const n of ['Talents', 'Majestics', 'Hunger', 'Contribution', 'Title']) {
        addCheck(`f5-text-${n}`, !!f5.found[n], f5.found[n] ? `found "${n}"` : `missing "${n}"`);
    }

    await page.evaluate(async (modUrl) => {
        const { setCharacterDialogOpen } = await import(modUrl);
        setCharacterDialogOpen(false);
    }, charUrl);
    await page.waitForTimeout(200);

    // --- F6 Inventory ---
    await page.evaluate(async (modUrl) => {
        const { setInventoryDialogOpen } = await import(modUrl);
        setInventoryDialogOpen(true);
    }, invUrl);
    await page.waitForTimeout(400);
    await shot(page, 'hub-02-f6.png');

    const f6 = await page.evaluate(() => {
        const weight = document.querySelector('.bag-footer-weight');
        const gold = document.querySelector('.bag-footer-gold');
        const body = document.body?.innerText || '';
        const sort = [...document.querySelectorAll('button, .bag-footer-sort-btn')].some(
            (el) => /Sort/i.test(el.textContent || '') || el.classList.contains('bag-footer-sort-btn'),
        );
        const drops = /Drops\s*\(/.test(body);
        const dialog = document.querySelector('[data-dialog-id="inventory-dialog"]');
        return {
            dialog: !!dialog,
            weight: !!weight,
            weightText: weight?.textContent?.trim() || '',
            gold: !!gold,
            goldText: gold?.textContent?.trim() || '',
            sort,
            drops,
        };
    });
    addCheck('f6-open', f6.dialog, f6.dialog ? 'inventory dialog present' : 'missing inventory dialog');
    addCheck('f6-bag-footer-weight', f6.weight, f6.weightText || 'missing .bag-footer-weight');
    addCheck('f6-bag-footer-gold', f6.gold, f6.goldText || 'missing .bag-footer-gold');
    addCheck('f6-sort', f6.sort, f6.sort ? 'found Sort' : 'missing Sort');
    addCheck('f6-drops-paren', f6.drops, f6.drops ? 'found Drops (' : 'missing Drops (');

    await page.evaluate(async (modUrl) => {
        const { setInventoryDialogOpen } = await import(modUrl);
        setInventoryDialogOpen(false);
    }, invUrl);
    await page.waitForTimeout(200);

    // --- Death ---
    await page.evaluate(async (modUrl) => {
        const { setDeathDialogOpen } = await import(modUrl);
        setDeathDialogOpen(true, 'TestKiller');
    }, deathUrl);
    await page.waitForTimeout(400);
    await shot(page, 'hub-03-death.png');

    const death = await page.evaluate(() => {
        const btn = document.querySelector('.death-restart-btn');
        const killer = document.querySelector('.death-restart-killer');
        const btnText = (btn?.textContent || '').trim();
        const killerText = (killer?.textContent || '').trim();
        return {
            btn: !!btn,
            btnText,
            restartOk: !!btn && btnText.includes('Restart!'),
            killer: !!killer,
            killerText,
            killerOk: !!killer && killerText.includes('TestKiller'),
        };
    });
    addCheck(
        'death-restart-btn',
        death.restartOk,
        death.btn ? `text="${death.btnText}"` : 'missing .death-restart-btn',
    );
    addCheck(
        'death-restart-killer',
        death.killerOk,
        death.killer ? `text="${death.killerText}"` : 'missing .death-restart-killer',
    );

    await page
        .evaluate(async (modUrl) => {
            const { setDeathDialogOpen } = await import(modUrl);
            setDeathDialogOpen(false);
        }, deathUrl)
        .catch(() => {});

    const report = {
        ok: checks.every((c) => c.ok) && blockers.length === 0,
        mode: 'hub-dom-no-world',
        url,
        storeUrls: { charUrl, invUrl, deathUrl },
        screenshots: created.slice(),
        checks,
        blockers: blockers.slice(),
    };
    const reportPath = path.join(OUT, 'hub-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    log('--- hub-report.json ---');
    console.log(JSON.stringify(report, null, 2));
    log('PASSED', report.ok);

    await browser.close();
    process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
    console.error('FATAL', err);
    const report = {
        ok: false,
        mode: 'hub-dom-no-world',
        screenshots: created.slice(),
        checks,
        blockers: [...blockers, String(err)],
        fatal: String(err),
    };
    fs.writeFileSync(path.join(OUT, 'hub-report.json'), JSON.stringify(report, null, 2), 'utf8');
    process.exit(1);
});