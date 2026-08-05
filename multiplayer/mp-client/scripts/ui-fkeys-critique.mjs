/**
 * Screenshot F5-F12 Olympia dialogs in traveler client for UI critique.
 * Run: node scripts/ui-fkeys-critique.mjs
 * Requires: vite traveler on :8081, game server on :1337 for world entry.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'ui-fkeys-critique-out');
fs.mkdirSync(OUT, { recursive: true });

const DESK_W = 800;
const DESK_H = 600;
const START_HITBOX = { x: 360, y: 283, w: 185, h: 32 };
const SLOT0_HITBOX = { x: 100, y: 50, w: 110, h: 200 };

const created = [];
const blockers = [];
let inWorld = false;

function log(msg, extra) {
    if (extra !== undefined) {
        console.log(msg, extra);
    } else {
        console.log(msg);
    }
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
            } else if (key === 'F7') {
                const { toggleCastDialogOnCircle } = await import('/src/ui/store/CastDialog.store.ts');
                toggleCastDialogOnCircle(1);
            } else if (key === 'F8') {
                const { toggleSkillDialog } = await import('/src/ui/store/SkillDialog.store.ts');
                toggleSkillDialog();
            } else if (key === 'F9') {
                const { toggleChatDialog } = await import('/src/ui/store/ChatDialog.store.ts');
                toggleChatDialog();
            } else if (key === 'F10') {
                if (shift) {
                    const { toggleTrainingDialog } = await import('/src/ui/store/TrainingDialog.store.ts');
                    toggleTrainingDialog();
                } else {
                    const { toggleTournamentDialog } = await import('/src/ui/store/TournamentDialog.store.ts');
                    toggleTournamentDialog();
                }
            } else if (key === 'F11') {
                const { toggleMobKillsDialog } = await import('/src/ui/store/MobKillsDialog.store.ts');
                toggleMobKillsDialog();
            } else if (key === 'F12') {
                const { toggleSysMenuDialog } = await import('/src/ui/store/SysMenuDialog.store.ts');
                toggleSysMenuDialog();
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
    await logConnectSnapshot(page, "after play-world");
    await page.waitForTimeout(400);
    await waitForSelectChar(page).catch((e) => {
        blockers.push(`SELECTCHAR wait: ${e}`);
    });
    await waitForCharacterListSettled(page);
    await logConnectSnapshot(page, "list settled");
    await page.waitForTimeout(500);

    const snap = await logConnectSnapshot(page, "before enter");
    if (!snap || snap.slotCount === 0) {
        log('No occupied slots on desk — direct connect');
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

async function captureF5(page) {
    await openFDialog(page, 'F5', '.character-dialog-root');
    await shot(page, '05-f5-character-main.png');

    const subpanels = [
        { panel: 'quest', file: '05b-f5-quest.png' },
        { panel: 'party', file: '05c-f5-party.png' },
        { panel: 'levelSet', file: '05d-f5-levelset.png' },
        { panel: 'guild', file: '05e-f5-guild.png' },
    ];

    for (const sp of subpanels) {
        await page.evaluate(async (panel) => {
            const { setCharacterSubPanel } = await import('/src/ui/store/CharacterDialog.store.ts');
            setCharacterSubPanel(panel);
        }, sp.panel);
        await page.waitForTimeout(500);
        await shot(page, sp.file);
        await page.evaluate(async () => {
            const { setCharacterSubPanel } = await import('/src/ui/store/CharacterDialog.store.ts');
            setCharacterSubPanel('main');
        });
        await page.waitForTimeout(300);
    }

    await closeFDialog(page, 'F5', '.character-dialog-root');
}

async function captureF6(page) {
    await openFDialog(page, 'F6', '[data-dialog-id="inventory-dialog"]');
    await shot(page, '06-f6-bag.png');

    const dropsTab = page.locator('.bag-tab-btn').filter({ hasText: 'Item Drops' }).first();
    if ((await dropsTab.count()) > 0) {
        await dropsTab.click();
    } else {
        await page.evaluate(async () => {
            const { setBagDialogTab } = await import('/src/ui/store/InventoryDialog.store.ts');
            setBagDialogTab('itemDrops');
        });
    }
    await page.waitForTimeout(600);
    await shot(page, '06b-f6-item-drops.png');
    await closeFDialog(page, 'F6', '[data-dialog-id="inventory-dialog"]');
}

async function captureSimple(page, fKey, dialogSel, fileName, opts = {}) {
    await openFDialog(page, fKey, dialogSel, opts);
    await page.waitForTimeout(400);
    await shot(page, fileName);
    await closeFDialog(page, fKey, dialogSel, opts);
}

async function captureF10(page) {
    await openFDialog(page, 'F10', '.tournament-dialog-root');
    await shot(page, '10-f10-tournament-default.png');

    for (const tab of ['Ranks', 'Events', 'Honor']) {
        const btn = page.locator('.tournament-tab').filter({ hasText: tab }).first();
        if ((await btn.count()) > 0) {
            await btn.click();
            await page.waitForTimeout(800);
            await shot(page, `10b-f10-${tab.toLowerCase()}.png`);
        } else {
            blockers.push(`F10 tab missing: ${tab}`);
        }
    }
    await closeFDialog(page, 'F10', '.tournament-dialog-root');
}

function printReport() {
    log('--- report ---');
    log('inWorld', inWorld);
    log('screenshots', created.length);
    for (const f of created) {
        log('  ', f);
    }
    if (blockers.length) {
        log('blockers');
        for (const b of blockers) {
            log('  ', b);
        }
    }
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
        printReport();
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
        await shot(page, '00-in-world-hud.png');

        await captureF5(page);
        await captureF6(page);
        await captureSimple(page, 'F7', '.cast-dialog-root', '07-f7-magic-book.png');
        await captureSimple(page, 'F8', '.skill-dialog-root', '08-f8-skills.png');
        await captureSimple(page, 'F9', '.chat-dialog-root', '09-f9-chat.png');
        await captureF10(page);
        await captureSimple(page, 'F10', '.training-dialog-root', '11-shift-f10-training.png', { shift: true });
        await captureSimple(page, 'F11', '.mob-kills-dialog-root', '12-f11-mob-kills.png');
        await captureSimple(page, 'F12', '.sys-menu-dialog-root', '13-f12-sys-menu.png');
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

    printReport();
    process.exit(blockers.length && !inWorld ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});


