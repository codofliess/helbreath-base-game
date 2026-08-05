import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-game-viewport-out');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => {
    if (m.type() === 'error') {
        console.log('ERR', m.text());
    }
});

await page.goto('http://localhost:8081/?v=viewport-fit-20260711g', {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
});
await page.waitForSelector('.login-hub', { timeout: 120_000 });
await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
await page.waitForTimeout(500);
await page.evaluate(() => window.__helbreathDevConnectAs('TTTrrraaav'));
await page.waitForFunction(() => document.body.classList.contains('game-world-active'), {
    timeout: 45_000,
});
console.log('entered world');

for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    const s = await page.evaluate(() => {
        const c = document.querySelector('#game-container canvas');
        const r = c?.getBoundingClientRect();
        const hud = document.querySelector('.hotkey-bar-root');
        const hr = hud?.getBoundingClientRect();
        return {
            body: document.body.className,
            hud: !!hud,
            canvas: r
                ? {
                      w: r.width,
                      h: r.height,
                      x: r.x,
                      y: r.y,
                      cls: c.className,
                      sw: c.style.width,
                      sh: c.style.height,
                  }
                : null,
            hudRect: hr ? { x: hr.x, y: hr.y, w: hr.width, h: hr.height } : null,
            vars: {
                left: document.documentElement.style.getPropertyValue('--hb-canvas-left'),
                width: document.documentElement.style.getPropertyValue('--hb-canvas-width'),
                bottom: document.documentElement.style.getPropertyValue('--hb-canvas-inset-bottom'),
            },
        };
    });
    console.log(`t=${i * 2}s`, JSON.stringify(s));
    if (!s.body.includes('game-world-active')) {
        console.log('left world');
        await page.screenshot({ path: path.join(OUT, '07-left-world.png'), fullPage: false });
        break;
    }
    if (s.hud) {
        await page.screenshot({ path: path.join(OUT, '06-ingame-with-hud.png'), fullPage: false });
        console.log('HUD screenshot saved', s.hudRect, s.vars);
        break;
    }
    if (i === 4 || i === 12) {
        await page.screenshot({ path: path.join(OUT, `poll-${i}.png`), fullPage: false });
    }
}

await browser.close();
