/**
 * Quick capture: SELECTCHAR after Olympia parity pass.
 * Run: node scripts/_tmp_capture_olympia_selectchar.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'verify-selectchar-out');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') console.log('cerr', m.text());
    });

    await page.goto('http://127.0.0.1:8081/?v=selectchar-olympia-20260716', {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
    });
    await page.waitForSelector('.login-hub', { timeout: 120_000 });
    await page.waitForFunction(() => typeof window.__helbreathDevEnterPlayWorld === 'function', {
        timeout: 60_000,
    });

    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(2200);

    const probe = await page.evaluate(() => {
        const c = document.querySelector('#game-container canvas');
        const r = c ? c.getBoundingClientRect() : null;
        return {
            body: document.body.className,
            phase: window.__helbreathDevConnectSnapshot?.()?.phase,
            slots: window.__helbreathDevConnectSnapshot?.()?.characterSlots?.length,
            canvas: c
                ? {
                      cls: c.className,
                      w: c.width,
                      h: c.height,
                      r: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
                  }
                : null,
        };
    });
    console.log(JSON.stringify(probe, null, 2));

    await page.screenshot({
        path: path.join(OUT, 'olympia-retry-full.png'),
        fullPage: false,
    });

    const canvas = await page.$('#game-container canvas');
    if (canvas) {
        await canvas.screenshot({ path: path.join(OUT, 'olympia-retry-canvas.png') });
        const box = await canvas.boundingBox();
        if (box) {
            await page.screenshot({
                path: path.join(OUT, 'olympia-retry-topleft.png'),
                clip: {
                    x: box.x,
                    y: box.y,
                    width: Math.min(280, box.width),
                    height: Math.min(90, box.height),
                },
            });
            // Card field area of first slot
            await page.screenshot({
                path: path.join(OUT, 'olympia-retry-card0.png'),
                clip: {
                    x: box.x + box.width * 0.1,
                    y: box.y + box.height * 0.22,
                    width: Math.min(200, box.width * 0.2),
                    height: Math.min(180, box.height * 0.35),
                },
            });
        }
    }

    console.log('shots written to', OUT);
    await browser.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
