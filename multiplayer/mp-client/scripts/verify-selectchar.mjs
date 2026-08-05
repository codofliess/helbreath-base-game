/**
 * VerifyFix: traveler SELECTCHAR stays visible after play-world; Create Char stays.
 * Run: node scripts/verify-selectchar.mjs
 * Requires: vite traveler on :8081
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-selectchar-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.VERIFY_URL || 'http://localhost:8081/';

function fail(msg, extra) {
    console.error('FAIL:', msg, extra ?? '');
    process.exitCode = 1;
}

async function waitForHub(page) {
    await page.waitForSelector('.login-hub', { timeout: 120_000 });
    await page.waitForSelector('.login-hub-world button', { timeout: 30_000 });
}

async function deskProbe(page) {
    return page.evaluate(() => {
        const canvas = document.querySelector('#game-container canvas');
        const snap =
            typeof window.__helbreathDevConnectSnapshot === 'function'
                ? window.__helbreathDevConnectSnapshot()
                : null;
        const style = canvas
            ? {
                  width: canvas.style.width,
                  height: canvas.style.height,
                  transform: canvas.style.transform,
                  position: canvas.style.position,
                  margin: canvas.style.margin,
                  left: canvas.style.left,
                  top: canvas.style.top,
                  className: canvas.className,
                  rect: (() => {
                      const r = canvas.getBoundingClientRect();
                      return { x: r.x, y: r.y, w: r.width, h: r.height };
                  })(),
              }
            : null;
        return {
            snap,
            chrome: !!document.querySelector('.login-selectchar-chrome'),
            hub: !!document.querySelector('.login-hub'),
            bodyClass: document.body.className,
            canvas: style,
        };
    });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        console.log('[console.error]', msg.text());
    }
});

try {
    console.log('Navigating', BASE);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await waitForHub(page);
    await page.screenshot({ path: path.join(OUT, '01-hub.png'), fullPage: true });
    console.log('Hub OK');

    const hooksReady = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === 'function');
    if (!hooksReady) {
        fail('DEV hooks missing — hard-refresh / ensure DEV build');
        await browser.close();
        process.exit(1);
    }

    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(250);

    let probe = await deskProbe(page);
    console.log('t+250ms', JSON.stringify(probe, null, 2));
    await page.screenshot({ path: path.join(OUT, '02-play-world-250ms.png'), fullPage: true });

    // Stay and re-check — the old bug vanished within ~1 frame after refresh
    await page.waitForTimeout(1500);
    probe = await deskProbe(page);
    console.log('t+1750ms', JSON.stringify(probe, null, 2));
    await page.screenshot({ path: path.join(OUT, '03-play-world-1750ms.png'), fullPage: true });

    // Phaser desk must still be the interactive UI (not wallpaper): sample a non-black pixel region
    const deskPixels = await page.evaluate(() => {
        const canvas = document.querySelector('#game-container canvas');
        if (!(canvas instanceof HTMLCanvasElement)) {
            return null;
        }
        // WebGL canvas often tainted for 2d getImageData — use CSS presence + size as primary;
        // also count Phaser scene children via registry if exposed.
        return {
            cssOk: canvas.classList.contains('login-selectchar-canvas'),
            w: canvas.width,
            h: canvas.height,
        };
    });
    console.log('deskPixels', deskPixels);

    const rect = probe.canvas?.rect;
    const onScreen =
        rect &&
        rect.w > 200 &&
        rect.h > 200 &&
        rect.x + rect.w > 50 &&
        rect.y + rect.h > 50 &&
        rect.x < 1440 &&
        rect.y < 900;
    const hasDeskCss =
        probe.bodyClass.includes('login-selectchar-active') &&
        !!probe.canvas?.transform?.includes('scale') &&
        probe.canvas?.className?.includes('login-selectchar-canvas');
    const phaseOk = probe.snap?.phase === 'play-world' && probe.snap?.isOpen === true && !probe.hub;
    // Wallet chrome over desks was removed (hub-only seal); Phaser desk is the UI.

    if (!phaseOk) {
        fail('play-world phase/chrome not stable', probe.snap);
    }
    if (!hasDeskCss) {
        fail('desk canvas CSS missing after settle', probe.canvas);
    }
    if (!onScreen) {
        fail('canvas off-screen or tiny after settle', rect);
    }

    if (phaseOk && hasDeskCss && onScreen) {
        console.log('PASS: SELECTCHAR presentation stable on play-world');
    }

    // Empty slot → Create via the same EventBus path as Phaser Start/Create buttons
    await page.evaluate(async () => {
        const { EventBus } = await import('/src/game/EventBus.ts');
        const { OUT_UI_SELECTCHAR_ACTION } = await import('/src/constants/EventNames.ts');
        EventBus.emit(OUT_UI_SELECTCHAR_ACTION, { kind: 'create', slotIndex: 0 });
    });
    await page.waitForTimeout(1500);
    const viaAction = await deskProbe(page);
    await page.screenshot({ path: path.join(OUT, '03b-create-via-action.png'), fullPage: true });
    if (viaAction.snap?.phase !== 'create-char') {
        fail('OUT_UI_SELECTCHAR_ACTION create did not open create-char', viaAction.snap);
    } else {
        console.log('PASS: empty-slot Create action → create-char');
    }

    // Create Character (explicit phase hook)
    await page.evaluate(() => window.__helbreathDevEnterCreateChar(0));
    await page.waitForTimeout(250);
    let createProbe = await deskProbe(page);
    console.log('create t+250ms', JSON.stringify(createProbe.snap, null, 2));
    await page.waitForTimeout(1500);
    createProbe = await deskProbe(page);
    console.log('create t+1750ms', JSON.stringify(createProbe, null, 2));
    await page.screenshot({ path: path.join(OUT, '04-create-char-1750ms.png'), fullPage: true });

    const createOk =
        createProbe.snap?.phase === 'create-char' &&
        createProbe.snap?.isOpen === true &&
        createProbe.bodyClass.includes('login-selectchar-active') &&
        createProbe.canvas?.rect &&
        createProbe.canvas.rect.w > 200 &&
        createProbe.canvas.rect.h > 200;

    if (!createOk) {
        fail('create-char desk not stable', createProbe);
    } else {
        console.log('PASS: Create Character presentation stable');
    }

    // Back to select via phase
    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(1500);
    const back = await deskProbe(page);
    await page.screenshot({ path: path.join(OUT, '05-back-play-world.png'), fullPage: true });
    if (back.snap?.phase !== 'play-world' || !back.bodyClass.includes('login-selectchar-active')) {
        fail('return to play-world failed', back.snap);
    } else {
        console.log('PASS: return to SELECTCHAR');
    }
} catch (e) {
    fail(String(e));
    try {
        await page.screenshot({ path: path.join(OUT, 'error.png'), fullPage: true });
    } catch {
        // ignore
    }
} finally {
    await browser.close();
}

if (process.exitCode) {
    console.error('VerifyFix FAILED — see', OUT);
} else {
    console.log('VerifyFix PASSED — screenshots in', OUT);
}
