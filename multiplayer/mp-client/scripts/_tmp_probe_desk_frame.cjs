const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://127.0.0.1:8081/?v=probe-desk', {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
    });
    await page.waitForSelector('.login-hub', { timeout: 120_000 });
    await page.waitForFunction(() => typeof window.__helbreathDevEnterPlayWorld === 'function');
    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(2500);

    const info = await page.evaluate(() => {
        // Phaser 3 game is usually on window via game config parent
        const phaserGames = window.Phaser?.GAMES || [];
        const game = phaserGames[0] || window.__helbreathGame;
        if (!game) {
            return { err: 'no game', keys: Object.keys(window).filter((k) => /phaser|game|helbreath/i.test(k)) };
        }
        const tex = game.textures?.get('sprite-gamedialog2-8');
        if (!tex) {
            return { err: 'no texture', textureKeys: game.textures?.getTextureKeys?.()?.slice(0, 40) };
        }
        const frame = tex.get('0') || tex.get(0) || tex.frames?.['0'];
        const src = tex.source?.[0];
        return {
            frameW: frame?.width,
            frameH: frame?.height,
            frameCutX: frame?.cutX,
            frameCutY: frame?.cutY,
            frameCutW: frame?.cutWidth,
            frameCutH: frame?.cutHeight,
            sourceW: src?.width,
            sourceH: src?.height,
            frameNames: Object.keys(tex.frames || {}).slice(0, 20),
        };
    });
    console.log(JSON.stringify(info, null, 2));

    const canvas = await page.$('#game-container canvas');
    const box = await canvas.boundingBox();
    await page.screenshot({
        path: path.join(__dirname, 'verify-selectchar-out', 'olympia-retry-topstrip.png'),
        clip: {
            x: box.x,
            y: box.y,
            width: box.width * 0.5,
            height: box.height * 0.14,
        },
    });
    await browser.close();
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
