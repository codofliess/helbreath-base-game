/**
 * Verify in-game canvas fills / centers the viewport (not tiny bottom-right).
 * Run: node scripts/verify-game-viewport.mjs
 * Requires: vite traveler on :8081 + game server :1337
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-game-viewport-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.VERIFY_URL || 'http://localhost:8081/?v=viewport-cover-20260715';
const VIEW_W = 1440;
const VIEW_H = 900;

function fail(msg, extra) {
    console.error('FAIL:', msg, extra ?? '');
    process.exitCode = 1;
}

async function canvasProbe(page) {
    return page.evaluate(() => {
        const canvas = document.querySelector('#game-container canvas');
        if (!canvas) {
            return null;
        }
        const r = canvas.getBoundingClientRect();
        return {
            bodyClass: document.body.className,
            className: canvas.className,
            style: {
                width: canvas.style.width,
                height: canvas.style.height,
                transform: canvas.style.transform,
                position: canvas.style.position,
                left: canvas.style.left,
                top: canvas.style.top,
                margin: canvas.style.margin,
            },
            rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            cssVars: {
                left: document.documentElement.style.getPropertyValue('--hb-canvas-left'),
                width: document.documentElement.style.getPropertyValue('--hb-canvas-width'),
                insetBottom: document.documentElement.style.getPropertyValue('--hb-canvas-inset-bottom'),
            },
            vw: window.innerWidth,
            vh: window.innerHeight,
        };
    });
}

function assertLargeCentered(probe, label) {
    if (!probe?.rect) {
        fail(`${label}: no canvas`);
        return false;
    }
    const { x, y, w, h } = probe.rect;
    const vw = probe.vw || VIEW_W;
    const vh = probe.vh || VIEW_H;
    const minW = vw * 0.85;
    const minH = vh * 0.85;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    console.log(label, {
        rect: probe.rect,
        style: probe.style,
        bodyClass: probe.bodyClass,
        cssVars: probe.cssVars,
    });

    let ok = true;
    if (w < minW || h < minH) {
        fail(`${label}: canvas too small`, { w, h, minW, minH });
        ok = false;
    }
    if (Math.abs(centerX - vw / 2) > 80) {
        fail(`${label}: canvas not horizontally centered`, { centerX, vw });
        ok = false;
    }
    if (Math.abs(centerY - vh / 2) > 120) {
        fail(`${label}: canvas not vertically centered`, { centerY, vh });
        ok = false;
    }
    if (x > vw * 0.45 && y > vh * 0.45 && w < vw * 0.5) {
        fail(`${label}: looks bottom-right mini`, probe.rect);
        ok = false;
    }
    return ok;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: VIEW_W, height: VIEW_H } });
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        console.log('[console.error]', msg.text());
    }
});

try {
    console.log('Navigating', BASE);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForSelector('.login-hub', { timeout: 120_000 });
    await page.screenshot({ path: path.join(OUT, '01-hub.png'), fullPage: false });

    const hooksReady = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === 'function');
    if (!hooksReady) {
        fail('DEV hooks missing');
        await browser.close();
        process.exit(1);
    }

    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(900);
    let probe = await canvasProbe(page);
    await page.screenshot({ path: path.join(OUT, '02-selectchar.png'), fullPage: false });
    assertLargeCentered(probe, 'SELECTCHAR');

    // Enter real GameWorld (needs server :1337). Prefer occupied slot Start; else direct connect.
    let started = await page.evaluate(() => {
        if (typeof window.__helbreathDevStartSelectedChar === 'function' && window.__helbreathDevStartSelectedChar()) {
            return 'started-slot';
        }
        if (typeof window.__helbreathDevConnectAs === 'function' && window.__helbreathDevConnectAs('TTTrrraaav')) {
            return 'started-direct';
        }
        return 'no-hook';
    });
    console.log('Start world:', started);

    if (started === 'started-slot' || started === 'started-direct') {
        try {
            await page.waitForFunction(
                () => document.body.classList.contains('game-world-active'),
                { timeout: 45_000 },
            );
        } catch {
            fail('Timed out waiting for game-world-active (is server :1337 up?)');
        }
        await page.waitForTimeout(2000);
        probe = await canvasProbe(page);
        await page.screenshot({ path: path.join(OUT, '03-ingame-viewport.png'), fullPage: false });
        assertLargeCentered(probe, 'IN-GAME');

        if (!probe?.bodyClass?.includes('game-world-active')) {
            fail('IN-GAME: missing game-world-active', probe?.bodyClass);
        }
        if (!probe?.className?.includes('game-world-canvas') && !probe?.style?.width) {
            fail('IN-GAME: missing game-world canvas presentation', probe);
        }

        // Wait for HUD if map loaded
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(OUT, '04-ingame-hud.png'), fullPage: false });
        const hud = await page.evaluate(() => {
            const el = document.querySelector('.hotkey-bar-root');
            const canvas = document.querySelector('#game-container canvas');
            if (!el || !canvas) {
                return { present: !!el };
            }
            const hr = el.getBoundingClientRect();
            const cr = canvas.getBoundingClientRect();
            return {
                present: true,
                hud: { x: hr.x, y: hr.y, w: hr.width, h: hr.height },
                canvas: { x: cr.x, y: cr.y, w: cr.width, h: cr.height },
            };
        });
        console.log('HUD', hud);
        if (hud.present && hud.hud && hud.canvas) {
            if (Math.abs(hud.hud.x - hud.canvas.x) > 40) {
                fail('HUD left not aligned to canvas', hud);
            }
            if (Math.abs(hud.hud.w - hud.canvas.w) > 40) {
                fail('HUD width not matched to canvas', hud);
            }
        }
    } else {
        fail(`Could not start character: ${started}`);
    }

    console.log('Done. Screenshots in', OUT);
} catch (err) {
    console.error(err);
    process.exitCode = 1;
} finally {
    await browser.close();
}
