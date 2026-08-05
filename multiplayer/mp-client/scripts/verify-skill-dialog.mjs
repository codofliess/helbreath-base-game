/**
 * Focused F8 Skill dialog verify: scroll + click→detail.
 * Run: node scripts/verify-skill-dialog.mjs
 * Requires: vite traveler on :8081 (+ game server for world entry when possible).
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-skill-dialog-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.TRAVELER_URL || 'http://localhost:8081/?v=skill-dialog-f8';
const DESK_W = 800;
const DESK_H = 600;
const START_HITBOX = { x: 360, y: 283, w: 185, h: 32 };

async function shot(page, name) {
    const full = path.join(OUT, name);
    await page.screenshot({ path: full, fullPage: true });
    console.log('shot', name);
}

async function deskClick(page, deskX, deskY) {
    const pt = await page.evaluate(
        ({ deskX, deskY, deskW, deskH }) => {
            const canvas = document.querySelector('#game-container canvas');
            if (!(canvas instanceof HTMLCanvasElement)) {
                return null;
            }
            const r = canvas.getBoundingClientRect();
            return {
                x: r.x + (deskX / deskW) * r.width,
                y: r.y + (deskY / deskH) * r.height,
            };
        },
        { deskX, deskY, deskW: DESK_W, deskH: DESK_H },
    );
    if (!pt) {
        return false;
    }
    await page.mouse.click(pt.x, pt.y);
    return true;
}

/** Open via main.tsx F8 handler (same store instance as App). */
async function openSkillViaF8(page) {
    await page.evaluate(() => {
        document.body.classList.add('helbreath-game-active');
        document.body.tabIndex = -1;
        document.body.focus();
        if (typeof window.__helbreathDevOpenSkillDialog === 'function') {
            window.__helbreathDevOpenSkillDialog();
            return;
        }
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'F8',
                code: 'F8',
                bubbles: true,
                cancelable: true,
            }),
        );
    });
    await page.waitForTimeout(400);
}

async function seedSkillLevelsAndSelect(page) {
    await page.evaluate(() => {
        window.__helbreathDevSetSkillLevels?.({ 0: 100, 1: 42 });
    });
}

async function tryEnterWorld(page) {
    const hasEnter = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === 'function');
    if (!hasEnter) {
        return false;
    }
    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await page.waitForTimeout(1500);
    const onSelect = await page.evaluate(() => document.body.classList.contains('login-selectchar-active'));
    if (onSelect) {
        const start = { x: START_HITBOX.x + START_HITBOX.w / 2, y: START_HITBOX.y + START_HITBOX.h / 2 };
        await deskClick(page, start.x, start.y);
        await page.waitForTimeout(2500);
        if (await page.evaluate(() => document.body.classList.contains('login-selectchar-active'))) {
            await page.evaluate(() => window.__helbreathDevStartSelectedChar?.());
            await page.waitForTimeout(3000);
        }
    }
    return page.evaluate(() => document.body.classList.contains('helbreath-game-active'));
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (err) => console.log('pageerror', String(err)));

    const report = { ok: false, blockers: [], checks: [] };

    try {
        const url = `${BASE}${BASE.includes('?') ? '&' : '?'}cb=${Date.now()}`;
        console.log('goto', url);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await page.waitForSelector('#root', { timeout: 30_000 });
        await page.waitForTimeout(2500);

        const inWorld = await tryEnterWorld(page);
        console.log('inWorld', inWorld);
        if (!inWorld) {
            report.blockers.push('world entry failed — forcing helbreath-game-active for F8');
        }

        await openSkillViaF8(page);
        await seedSkillLevelsAndSelect(page);

        const dialog = page.locator('[data-dialog-id="skill-dialog"]');
        let visible = await dialog.isVisible().catch(() => false);
        if (!visible) {
            await openSkillViaF8(page);
            await page.waitForTimeout(500);
            visible = await dialog.isVisible().catch(() => false);
        }
        report.checks.push({ name: 'skill-dialog-visible', pass: visible });
        if (!visible) {
            const probe = await page.evaluate(() => ({
                bodyClass: document.body.className,
                ids: [...document.querySelectorAll('[data-dialog-id]')].map((el) => el.getAttribute('data-dialog-id')),
            }));
            console.log('dom-probe', JSON.stringify(probe));
            report.blockers.push('skill-dialog not visible after F8');
            await shot(page, '00-fail-no-dialog.png');
            fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
            return;
        }

        // Click Mining so detail refreshes after seeded levels.
        const miningRow = dialog.locator('.skill-dialog-row', { hasText: 'Mining' });
        if (await miningRow.count()) {
            await miningRow.click();
        }
        await page.waitForTimeout(300);
        await shot(page, '01-skill-open-mining-max.png');

        const detailText = await dialog.locator('.skill-dialog-detail').innerText();
        const hasDesc = /Gather ore|minerals/i.test(detailText);
        const hasProgress = /100%\s*\/\s*100%/.test(detailText);
        report.checks.push({ name: 'max-shows-description', pass: hasDesc, detail: detailText.slice(0, 220) });
        report.checks.push({ name: 'max-shows-progress', pass: hasProgress });

        await dialog.locator('.skill-dialog-row', { hasText: 'Fishing' }).click();
        await page.waitForTimeout(300);
        const fishingDetail = await dialog.locator('.skill-dialog-detail').innerText();
        report.checks.push({
            name: 'click-fishing-progress',
            pass: /42%\s*\/\s*100%/.test(fishingDetail),
            detail: fishingDetail.slice(0, 220),
        });
        report.checks.push({
            name: 'non-max-hides-description',
            pass: /Reach 100%|unlock/i.test(fishingDetail) && !/Catch fish/i.test(fishingDetail),
        });
        await shot(page, '02-skill-fishing-partial.png');

        await dialog.locator('.skill-dialog-list').hover();
        for (let i = 0; i < 8; i++) {
            await page.mouse.wheel(0, 120);
            await page.waitForTimeout(80);
        }
        const poisonVisible = await dialog
            .locator('.skill-dialog-row', { hasText: 'Poison Resistance' })
            .isVisible()
            .catch(() => false);
        report.checks.push({ name: 'wheel-reaches-last-skills', pass: poisonVisible });
        await shot(page, '03-skill-scrolled-end.png');

        const scrollCount = await dialog.locator('.skill-dialog-scroll-btn').count();
        report.checks.push({ name: 'scrollbar-buttons', pass: scrollCount >= 2, count: scrollCount });

        report.ok = report.checks.every((c) => c.pass);
        console.log(JSON.stringify(report, null, 2));
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    } finally {
        await browser.close();
    }

    if (!report.ok) {
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
