/**
 * Focused P2 Olympia parity checks: F5 character, F6 bag, death Restart.
 * Run: node scripts/verify-p2-death-f5-f6.mjs
 * Requires: vite traveler on :8081, game server on :1337 for world entry.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'verify-p2-out');
fs.mkdirSync(OUT, { recursive: true });

const DESK_W = 800;
const DESK_H = 600;
const START_HITBOX = { x: 360, y: 283, w: 185, h: 32 };
const SLOT0_HITBOX = { x: 100, y: 50, w: 110, h: 200 };

const created = [];
const blockers = [];
const checks = [];
let inWorld = false;

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
}

async function shot(page, fileName) {
    const full = path.join(OUT, fileName);
    await page.screenshot({ path: full, fullPage: true });
    created.push(fileName);
    log('screenshot', fileName);
}

function hitboxCenter(box) {
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
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
        throw new Error('desk canvas missing for click');
    }
    await page.mouse.click(pt.x, pt.y);
}

async function waitForSelectChar(page, timeout = 60_000) {
    await page.waitForFunction(
        () => document.body.classList.contains('login-selectchar-active'),
        { timeout },
    );
}

async function waitForCharacterListSettled(page, timeout = 90_000) {
    await page.waitForFunction(
        () => {
            const snap =
                typeof window.__helbreathDevConnectSnapshot === 'function'
                    ? window.__helbreathDevConnectSnapshot()
                    : null;
            return !!snap && !snap.characterListLoading;
        },
        { timeout },
    ).catch((e) => {
        blockers.push(`character list settle: ${e}`);
    });
}

async function waitForInWorld(page, timeout = 180_000) {
    await page.waitForFunction(
        () =>
            document.body.classList.contains('helbreath-game-active') &&
            !document.body.classList.contains('login-selectchar-active') &&
            !!document.querySelector('.hotkey-bar-root'),
        { timeout },
    );
}

async function dismissCitySelect(page) {
    const city = page.locator('[data-dialog-id="city-select-dialog"]');
    if ((await city.count()) === 0) {
        return;
    }
    const visible = await city.isVisible().catch(() => false);
    if (!visible) {
        return;
    }
    log('City select visible - picking first city');
    const okBtn = city.locator('button').first();
    if ((await okBtn.count()) > 0) {
        await okBtn.click({ timeout: 10_000 }).catch(() => {});
        await page.waitForTimeout(1500);
    }
}

async function ensureGameFocus(page) {
    await page.locator('#game-container').click({ position: { x: 400, y: 300 }, force: true }).catch(() => {});
    await page.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
    });
}

async function dispatchFKey(page, key, shift) {
    await page.evaluate(
        ({ key, shift }) => {
            const ev = new KeyboardEvent('keydown', {
                key,
                code: key,
                shiftKey: !!shift,
                bubbles: true,
                cancelable: true,
            });
            document.dispatchEvent(ev);
        },
        { key, shift },
    );
}

async function storeToggleFKey(page, key, shift) {
    await page.evaluate(
        async ({ key, shift }) => {
            if (key === 'F5') {
                const { toggleCharacterDialog } = await import('/src/ui/store/CharacterDialog.store.ts');
                toggleCharacterDialog();
            } else if (key === 'F6') {
                const { toggleInventoryDialog } = await import('/src/ui/store/InventoryDialog.store.ts');
                toggleInventoryDialog();
            }
        },
        { key, shift },
    );
}

async function pressF(page, key, { shift = false } = {}) {
    await ensureGameFocus(page);
    const combo = shift ? `Shift+${key}` : key;
    await page.keyboard.press(combo).catch(() => {});
    await page.waitForTimeout(350);
    await dispatchFKey(page, key, shift);
    await page.waitForTimeout(500);
}

async function openFDialog(page, key, dialogSel, opts = {}) {
    const shift = !!opts.shift;
    await pressF(page, key, opts);
    if (dialogSel) {
        const visible = await page.locator(dialogSel).isVisible().catch(() => false);
        if (!visible) {
            await storeToggleFKey(page, key, shift);
            await page.waitForTimeout(600);
            const visible2 = await page.locator(dialogSel).isVisible().catch(() => false);
            if (!visible2) {
                blockers.push(`${key}: could not open ${dialogSel}`);
            }
        }
    }
}

async function closeFDialog(page, key, dialogSel, opts = {}) {
    if (dialogSel) {
        const visible = await page.locator(dialogSel).isVisible().catch(() => false);
        if (!visible) {
            return;
        }
    }
    await pressF(page, key, opts);
    if (dialogSel) {
        const still = await page.locator(dialogSel).isVisible().catch(() => false);
        if (still) {
            await storeToggleFKey(page, key, !!opts.shift);
            await page.waitForTimeout(400);
        }
    }
}

async function openUrl(page, baseUrl) {
    const url = baseUrl.includes('?') ? `${baseUrl}&cb=${Date.now()}` : `${baseUrl}?cb=${Date.now()}`;
    log('Navigating', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
}

async function logConnectSnapshot(page, label) {
    const snap = await page.evaluate(() =>
        typeof window.__helbreathDevConnectSnapshot === 'function'
            ? window.__helbreathDevConnectSnapshot()
            : null,
    );
    log(label, JSON.stringify(snap));
    return snap;
}

async function devConnectFromSlots(page) {
    await page.evaluate(async () => {
        const { connectDialogStore } = await import('/src/ui/store/ConnectDialog.store.ts');
        const { EventBus } = await import('/src/game/EventBus.ts');
        const { OUT_UI_SELECTCHAR_ACTION, IN_UI_CONNECT_TO_SERVER } = await import('/src/constants/EventNames.ts');
        const { getDefaultGameHost, getDefaultGamePort } = await import('/src/utils/serverDefaults.ts');
        const { getPreferredInitialWorldId } = await import('/src/utils/playerMode.ts');
        const s = connectDialogStore.state;
        const occupied = s.characterSlots.find((x) => x?.name) ?? s.characterSlots[0];
        if (occupied?.name) {
            EventBus.emit(OUT_UI_SELECTCHAR_ACTION, { kind: 'start', slotIndex: occupied.slotIndex });
            return;
        }
        let name = 'DevTraveler';
        try {
            const raw = localStorage.getItem('gameState');
            if (raw) {
                const gs = JSON.parse(raw);
                if (typeof gs.characterName === 'string' && gs.characterName.trim()) {
                    name = gs.characterName.trim();
                }
            }
        } catch {
            // ignore
        }
        EventBus.emit(IN_UI_CONNECT_TO_SERVER, {
            host: getDefaultGameHost(),
            port: getDefaultGamePort(),
            characterName: name,
            slotIndex: s.selectedSlotIndex ?? 0,
            preferredInitialWorldId: getPreferredInitialWorldId(),
            walletSession: s.walletSession ?? undefined,
        });
    });
}

async function tryEnterWorld(page) {
    await page.evaluate(() => window.__helbreathDevEnterPlayWorld());
    await logConnectSnapshot(page, 'after play-world');
    await page.waitForTimeout(400);
    await waitForSelectChar(page).catch((e) => {
        blockers.push(`SELECTCHAR wait: ${e}`);
    });
    await waitForCharacterListSettled(page);
    await logConnectSnapshot(page, 'list settled');
    await page.waitForTimeout(500);

    const snap = await logConnectSnapshot(page, 'before enter');
    if (!snap || snap.slotCount === 0) {
        log('No occupied slots on desk - direct connect');
        await devConnectFromSlots(page);
        await page.waitForTimeout(4000);
    }

    const start = hitboxCenter(START_HITBOX);
    await deskClick(page, start.x, start.y).catch((e) => blockers.push(`Start click: ${e}`));
    await page.waitForTimeout(2500);

    const stillSelect = await page.evaluate(() => document.body.classList.contains('login-selectchar-active'));
    if (stillSelect) {
        log('Start click did not leave SELECTCHAR - second-click slot 0');
        const slot = hitboxCenter(SLOT0_HITBOX);
        await deskClick(page, slot.x, slot.y);
        await page.waitForTimeout(300);
        await deskClick(page, slot.x, slot.y);
        await page.waitForTimeout(2500);
    }

    const stillSelect2 = await page.evaluate(() => document.body.classList.contains('login-selectchar-active'));
    if (stillSelect2) {
        log('Trying EventBus start action');
        await page.evaluate(async () => {
            const { EventBus } = await import('/src/game/EventBus.ts');
            const { OUT_UI_SELECTCHAR_ACTION } = await import('/src/constants/EventNames.ts');
            const snap = window.__helbreathDevConnectSnapshot?.();
            const slotIndex = snap?.selectedSlotIndex ?? 0;
            EventBus.emit(OUT_UI_SELECTCHAR_ACTION, { kind: 'start', slotIndex });
        });
        await page.waitForTimeout(3000);
    }

    const stillSelect3 = await page.evaluate(() => document.body.classList.contains('login-selectchar-active'));
    if (stillSelect3) {
        log('devConnectFromSlots fallback');
        await devConnectFromSlots(page);
        await page.waitForTimeout(5000);
    }
}

async function bodyTextHas(page, needle) {
    const text = await page.evaluate(() => document.body?.innerText || '');
    return text.includes(needle);
}

async function verifyF5(page) {
    await openFDialog(page, 'F5', '.character-dialog-root');
    const open = await page.locator('.character-dialog-root').isVisible().catch(() => false);
    addCheck('f5-open', open, open ? 'character dialog visible' : 'character dialog not visible');
    await shot(page, '01-f5.png');

    const needles = ['Talents', 'Majestics', 'Hunger', 'Contribution', 'Title'];
    const found = await page.evaluate((needles) => {
        const text = document.body?.innerText || '';
        const out = {};
        for (const n of needles) {
            out[n] = text.includes(n) || text.includes(`${n}:`);
        }
        // Title: — (em dash) or Title: - variants
        out['TitleOrDash'] =
            /Title\s*:?\s*[—\-–]/.test(text) || text.includes('Title:') || text.includes('Title');
        return { textSnippet: text.slice(0, 4000), out };
    }, needles);

    for (const n of needles) {
        const ok = !!found.out[n] || (n === 'Title' && found.out.TitleOrDash);
        addCheck(`f5-text-${n}`, ok, ok ? `found "${n}"` : `missing "${n}"`);
        if (!ok) {
            blockers.push(`F5 missing text: ${n}`);
        }
    }

    await closeFDialog(page, 'F5', '.character-dialog-root');
}

async function verifyF6(page) {
    await openFDialog(page, 'F6', '[data-dialog-id="inventory-dialog"]');
    const open = await page.locator('[data-dialog-id="inventory-dialog"]').isVisible().catch(() => false);
    addCheck('f6-open', open, open ? 'inventory dialog visible' : 'inventory dialog not visible');
    await shot(page, '02-f6-bag.png');

    const foot = await page.evaluate(() => {
        const weight = document.querySelector('.bag-footer-weight');
        const gold = document.querySelector('.bag-footer-gold');
        const sortBtn = Array.from(document.querySelectorAll('button, .bag-footer-sort-btn')).find(
            (el) => /Sort/i.test(el.textContent || '') || el.classList.contains('bag-footer-sort-btn'),
        );
        const body = document.body?.innerText || '';
        const drops = /Drops\s*\(/.test(body);
        return {
            weight: !!weight,
            weightText: weight?.textContent?.trim() || '',
            gold: !!gold,
            goldText: gold?.textContent?.trim() || '',
            sort: !!sortBtn,
            sortText: sortBtn?.textContent?.trim() || '',
            drops,
        };
    });

    addCheck('f6-bag-footer-weight', foot.weight, foot.weightText || 'missing .bag-footer-weight');
    addCheck('f6-bag-footer-gold', foot.gold, foot.goldText || 'missing .bag-footer-gold');
    addCheck('f6-sort-button', foot.sort, foot.sortText || 'missing Sort button');
    addCheck('f6-drops-paren', foot.drops, foot.drops ? 'found Drops (' : 'missing Drops (');

    for (const [id, ok] of [
        ['bag-footer-weight', foot.weight],
        ['bag-footer-gold', foot.gold],
        ['Sort button', foot.sort],
        ['Drops (', foot.drops],
    ]) {
        if (!ok) {
            blockers.push(`F6 missing: ${id}`);
        }
    }

    await closeFDialog(page, 'F6', '[data-dialog-id="inventory-dialog"]');
}

async function verifyDeath(page) {
    await page.evaluate(async () => {
        const { setDeathDialogOpen } = await import('/src/ui/store/DeathDialog.store.ts');
        setDeathDialogOpen(true, 'P2VerifyKiller');
    });
    await page.waitForTimeout(600);

    const overlay = await page.locator('.death-restart-overlay').isVisible().catch(() => false);
    addCheck('death-open', overlay, overlay ? 'death overlay visible' : 'death overlay not visible');
    await shot(page, '03-death-restart.png');

    const restart = await page.evaluate(() => {
        const btn = document.querySelector('.death-restart-btn');
        const text = (btn?.textContent || '').trim();
        return { exists: !!btn, text, ok: !!btn && text.includes('Restart!') };
    });
    addCheck('death-restart-btn', restart.ok, restart.exists ? `text="${restart.text}"` : 'missing .death-restart-btn');
    if (!restart.ok) {
        blockers.push('Death UI missing .death-restart-btn with Restart!');
    }

    await page.evaluate(async () => {
        const { setDeathDialogOpen } = await import('/src/ui/store/DeathDialog.store.ts');
        setDeathDialogOpen(false);
    }).catch(() => {});
}

function writeReport() {
    const criticalFail = !inWorld || checks.some((c) => !c.ok);
    const report = {
        ok: !criticalFail && blockers.length === 0,
        inWorld,
        screenshots: created.slice(),
        checks,
        blockers: blockers.slice(),
    };
    const reportPath = path.join(OUT, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    log('--- report.json ---');
    console.log(JSON.stringify(report, null, 2));
    return report;
}

async function main() {
    const candidates = [process.env.CRITIQUE_URL || 'http://localhost:8081/', 'http://localhost:8080/'];
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(180_000);
    page.on('console', (msg) => {
        if (msg.type() === 'error') {
            log('[console.error]', msg.text());
        }
    });

    let opened = false;
    for (const base of candidates) {
        try {
            await openUrl(page, base);
            const hooks = await page.evaluate(() => typeof window.__helbreathDevEnterPlayWorld === 'function');
            if (!hooks) {
                blockers.push(`${base}: DEV hooks missing`);
                continue;
            }
            await page.waitForSelector('.login-hub, .login-hub-world', { timeout: 30_000 }).catch(() => {});
            opened = true;
            log('Using base', base);
            break;
        } catch (e) {
            blockers.push(`${base}: ${e}`);
        }
    }

    if (!opened) {
        log('FAIL: could not open traveler client');
        await browser.close();
        const report = writeReport();
        process.exit(1);
    }

    try {
        await tryEnterWorld(page);
        await waitForInWorld(page);
        inWorld = true;
        log('In world');
        await dismissCitySelect(page);
        await page.waitForTimeout(2500);
        await page.waitForFunction(() => document.body.classList.contains('helbreath-game-active'), { timeout: 60_000 }).catch(() => {
            blockers.push('helbreath-game-active missing after city select');
        });

        await verifyF5(page);
        await verifyF6(page);
        await verifyDeath(page);
    } catch (e) {
        blockers.push(`run: ${e}`);
        try {
            await shot(page, '99-error-state.png');
        } catch {
            // ignore
        }
    } finally {
        await browser.close();
    }

    const report = writeReport();
    process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
