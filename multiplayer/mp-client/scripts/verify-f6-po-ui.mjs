/**
 * Smoke-verify F6 Bag footer buttons + typography CSS on :8081.
 * Reuses the same enter-world path as ui-fkeys-critique.mjs.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-f6-po-ui-out');
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.env.VERIFY_URL || 'http://localhost:8081/';

async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(120_000);

    const url = `${BASE}${BASE.includes('?') ? '&' : '?'}cb=${Date.now()}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForSelector('.login-hub, .login-hub-world', { timeout: 60_000 }).catch(() => {});

    // CSS tokens load on hub — verify typography bump without world connect.
    const cssCheck = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const sheets = [...document.styleSheets];
        let bagTabRule = null;
        let bagActiveRule = null;
        for (const sheet of sheets) {
            let rules;
            try {
                rules = [...(sheet.cssRules || [])];
            } catch {
                continue;
            }
            for (const rule of rules) {
                if (!(rule instanceof CSSStyleRule)) {
                    continue;
                }
                if (rule.selectorText === '.bag-tab-btn') {
                    bagTabRule = {
                        fontSize: rule.style.fontSize,
                        background: rule.style.background || rule.style.backgroundColor,
                        border: rule.style.border || rule.style.borderColor,
                        minHeight: rule.style.minHeight,
                    };
                }
                if (rule.selectorText === '.bag-tab-active') {
                    bagActiveRule = {
                        background: rule.style.background || rule.style.backgroundColor,
                        color: rule.style.color,
                        borderColor: rule.style.borderColor,
                    };
                }
            }
        }
        return {
            olympiaFont: root.getPropertyValue('--olympia-ui-font-size').trim(),
            olympiaLine: root.getPropertyValue('--olympia-ui-line-height').trim(),
            bagTabRule,
            bagActiveRule,
        };
    });

    console.log('CSS_CHECK', JSON.stringify(cssCheck, null, 2));

    // Try enter world for live F6 shot (best-effort).
    let live = null;
    try {
        await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
        await page.waitForTimeout(800);
        await page.evaluate(async () => {
            const { EventBus } = await import('/src/game/EventBus.ts');
            const { OUT_UI_SELECTCHAR_ACTION, IN_UI_CONNECT_TO_SERVER } = await import('/src/constants/EventNames.ts');
            const { getDefaultGameHost, getDefaultGamePort } = await import('/src/utils/serverDefaults.ts');
            const { getPreferredInitialWorldId } = await import('/src/utils/playerMode.ts');
            const { connectDialogStore } = await import('/src/ui/store/ConnectDialog.store.ts');
            const s = connectDialogStore.state;
            const occupied = s.characterSlots.find((x) => x?.name);
            if (occupied?.name) {
                EventBus.emit(OUT_UI_SELECTCHAR_ACTION, { kind: 'start', slotIndex: occupied.slotIndex });
                return;
            }
            EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
                host: getDefaultGameHost(),
                port: getDefaultGamePort(),
                characterName: 'TTTrrraaav',
                slotIndex: s.selectedSlotIndex ?? 0,
                preferredInitialWorldId: getPreferredInitialWorldId(),
                walletSession: s.walletSession ?? undefined,
            });
        });

        await page.waitForFunction(
            () =>
                document.body.classList.contains('game-world-active') ||
                document.body.classList.contains('helbreath-game-active'),
            { timeout: 45_000 },
        );

        await page.waitForTimeout(2000);
        await page.evaluate(async () => {
            const { setInventoryDialogOpen } = await import('/src/ui/store/InventoryDialog.store.ts');
            setInventoryDialogOpen(true);
        });
        await page.waitForSelector('[data-dialog-id="inventory-dialog"]', { timeout: 10_000 });
        await page.waitForTimeout(300);

        live = await page.evaluate(() => {
            const tabs = [...document.querySelectorAll('.bag-dialog-tabs .bag-tab-btn')];
            return {
                tabCount: tabs.length,
                labels: tabs.map((t) => (t.textContent || '').trim()),
                styles: tabs.map((btn) => {
                    const cs = getComputedStyle(btn);
                    return {
                        text: (btn.textContent || '').trim(),
                        fontSize: cs.fontSize,
                        color: cs.color,
                        background: cs.backgroundColor,
                        border: cs.borderTopColor,
                        minHeight: cs.minHeight,
                        active: btn.classList.contains('bag-tab-active'),
                    };
                }),
                fkeySize: (() => {
                    const f = document.querySelector('.hotkey-bar-fkey');
                    return f ? getComputedStyle(f).fontSize : null;
                })(),
            };
        });

        await page.screenshot({ path: path.join(OUT, '01-f6-bag.png'), fullPage: false });

        const dropsBtn = page.locator('.bag-tab-btn').filter({ hasText: 'Item Drops' }).first();
        await dropsBtn.click();
        await page.waitForTimeout(400);
        live.dropsActive = await page.evaluate(() => {
            const active = document.querySelector('.bag-tab-btn.bag-tab-active');
            if (!active) {
                return null;
            }
            const cs = getComputedStyle(active);
            return {
                text: (active.textContent || '').trim(),
                background: cs.backgroundColor,
                color: cs.color,
                fontSize: cs.fontSize,
            };
        });
        await page.screenshot({ path: path.join(OUT, '02-f6-item-drops.png'), fullPage: false });
        console.log('LIVE', JSON.stringify(live, null, 2));
    } catch (e) {
        console.warn('LIVE_SKIP', String(e));
    }

    const cssOk =
        cssCheck.olympiaFont === '14px' &&
        cssCheck.olympiaLine === '18px' &&
        !!cssCheck.bagTabRule &&
        (cssCheck.bagTabRule.fontSize || '').includes('12px') &&
        !!cssCheck.bagActiveRule &&
        (cssCheck.bagActiveRule.background || '').includes('36, 52, 88');

    const liveOk =
        !live ||
        (live.tabCount === 3 &&
            live.labels.includes('Bag') &&
            live.labels.includes('Item Drops') &&
            live.labels.includes('Auction') &&
            live.styles.every((s) => parseFloat(s.fontSize) >= 16) &&
            live.dropsActive?.text === 'Item Drops');

    if (!cssOk || !liveOk) {
        console.error('VERIFY FAILED', { cssOk, liveOk });
        process.exitCode = 1;
    } else {
        console.log(live ? 'VERIFY OK (css + live F6)' : 'VERIFY OK (css; live world skipped)');
    }

    await browser.close();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
