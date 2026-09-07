import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startGameWithRendererFallback } from '../src/game/startGameWithRendererFallback';
import {
    buildSelectCharReactOccupiedBanner,
    clearSelectCharReactOccupiedBannerSticky,
    SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID,
    selectCharKindGemBannerRectOnScreen,
    syncSelectCharReactOccupiedBannerDom,
} from '../src/game/ui/selectCharSlotGlyphs';
import { paintSelectCharSlotRows } from '../src/game/ui/selectCharDeskSync';
import type { CharacterSlotSummary } from '../src/utils/characterListApi';
import {
    bootstrapWalletDeepLinkAtBoot,
    consumePreferredAuthChain,
    consumeWalletDeepLink,
    getStoredWalletPubkey,
    getStoredWalletToken,
} from '../src/utils/walletAuth';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function installMinimalBrowser() {
    const mem = new Map<string, string>();
    const storage = {
        getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
        setItem: (k: string, v: string) => {
            mem.set(String(k), String(v));
        },
        removeItem: (k: string) => {
            mem.delete(String(k));
        },
    };
    const windowLike = {
        location: {
            search: '',
            pathname: '/',
            hash: '',
            hostname: 'play.chainlords.net',
        },
        history: { replaceState() {} },
        localStorage: storage,
        sessionStorage: storage,
    };
    (globalThis as { window?: typeof windowLike }).window = windowLike;
    (globalThis as { localStorage?: typeof storage }).localStorage = storage;
    (globalThis as { sessionStorage?: typeof storage }).sessionStorage = storage;
}

describe('startGameWithRendererFallback', () => {
    it('returns the primary renderer when it succeeds', () => {
        const game = startGameWithRendererFallback(
            () => ({ renderer: 'canvas' }),
            () => {
                throw new Error('secondary should not run');
            },
        );
        assert.deepEqual(game, { renderer: 'canvas' });
    });

    it('retries secondary when WebGL abort is thrown', () => {
        const game = startGameWithRendererFallback(
            () => {
                throw new Error('Cannot create WebGL context, aborting.');
            },
            () => ({ renderer: 'canvas' }),
        );
        assert.deepEqual(game, { renderer: 'canvas' });
    });

    it('returns null instead of throwing when both renderers fail', () => {
        const game = startGameWithRendererFallback(
            () => {
                throw new Error('Cannot create WebGL context, aborting.');
            },
            () => {
                throw new Error('Cannot create Canvas 2d context');
            },
        );
        assert.equal(game, null);
    });
});

describe('createRoot boot path (no wallet)', () => {
    it('Phaser boots Canvas first and never requests WEBGL-only', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/game/main.ts'), 'utf8');
        const canvasIdx = src.indexOf('buildGameConfig(parent, CANVAS');
        const autoIdx = src.indexOf('buildGameConfig(parent, AUTO');
        assert.ok(canvasIdx >= 0, 'Canvas must be the primary renderer');
        assert.ok(autoIdx > canvasIdx, 'AUTO is fallback after Canvas');
        assert.doesNotMatch(src, /type:\s*WEBGL/);
        assert.doesNotMatch(src, /buildGameConfig\(parent, WEBGL/);
        assert.match(src, /failIfMajorPerformanceCaveat:\s*false/);
    });

    it('hub does not evaluate Phaser: EventBus is Phaser-free and StartGame is post-seal', () => {
        const eventBus = fs.readFileSync(path.join(clientRoot, 'src/game/EventBus.ts'), 'utf8');
        assert.doesNotMatch(eventBus, /from ['"]phaser['"]/);
        assert.doesNotMatch(eventBus, /Events\.EventEmitter/);
        const phaserGame = fs.readFileSync(path.join(clientRoot, 'src/PhaserGame.tsx'), 'utf8');
        assert.doesNotMatch(phaserGame, /^import StartGame from '\.\/game\/main';/m);
        assert.match(phaserGame, /import\('\.\/game\/main'\)/);
        assert.match(phaserGame, /shouldConstructPhaserAfterSeal/);
        assert.doesNotMatch(phaserGame, /from ['"]phaser['"]/);
        assert.doesNotMatch(phaserGame, /ToastContainer/);
        const app = fs.readFileSync(path.join(clientRoot, 'src/App.tsx'), 'utf8');
        assert.match(app, /lazy\(async \(\) => \{/);
        assert.match(app, /import\('\.\/PhaserGame'\)/);
        assert.match(app, /mountPhaserAfterSeal/);
        assert.match(app, /ToastContainer/);
        assert.match(app, /from '\.\/game\/phaserHubTypes'/);
        assert.doesNotMatch(app, /from ['"]\.\/PhaserGame['"]/);
        assert.doesNotMatch(app, /from ['"]\.\/ui\/components\/HotkeyBar['"]/);
        assert.doesNotMatch(app, /from ['"]\.\/ui\/dialogs\/ControlsDialog['"]/);
        assert.match(app, /import\('\.\/ui\/components\/HotkeyBar'\)/);
        assert.match(app, /import\('\.\/ui\/dialogs\/ControlsDialog'\)/);
        const registry = fs.readFileSync(path.join(clientRoot, 'src/utils/RegistryUtils.ts'), 'utf8');
        assert.match(registry, /from '\.\.\/game\/phaserHubTypes'/);
        assert.doesNotMatch(registry, /from ['"]phaser['"]/);
        assert.doesNotMatch(registry, /from '\.\.\/game\/assets\/HBMap'/);
        assert.doesNotMatch(registry, /from '\.\/MusicManager'/);
        const coords = fs.readFileSync(path.join(clientRoot, 'src/utils/CoordinateUtils.ts'), 'utf8');
        assert.match(coords, /from '\.\.\/constants\/TileSize'/);
        assert.doesNotMatch(coords, /import \{ TILE_SIZE \} from '\.\.\/game\/assets\/HBMap'/);
        assert.doesNotMatch(coords, /Phaser\.Math/);
        const sprite = fs.readFileSync(path.join(clientRoot, 'src/game/assets/HBSprite.ts'), 'utf8');
        assert.doesNotMatch(sprite, /import \{ CANVAS/);
        const vite = fs.readFileSync(path.join(clientRoot, 'vite/config.prod.mjs'), 'utf8');
        assert.doesNotMatch(vite, /phaser:\s*\[\s*['"]phaser['"]\s*\]/);
        assert.match(vite, /resolveDependencies/);
        assert.match(vite, /isPhaserPreloadId/);
        const mainGame = fs.readFileSync(path.join(clientRoot, 'src/game/main.ts'), 'utf8');
        assert.match(mainGame, /shouldConstructPhaserAfterSeal/);
        assert.match(mainGame, /Refusing Phaser\/WebGL construct before entering-world/);
    });

    it('LoginScreen is connect-only and never constructs Phaser SELECTCHAR desks', () => {
        const login = fs.readFileSync(
            path.join(clientRoot, 'src/game/scenes/LoginScreen.ts'),
            'utf8',
        );
        assert.match(login, /Phaser ready for queued world enter \(no SELECTCHAR desks\)/);
        assert.doesNotMatch(login, /from ['"]\.\.\/ui\/SelectCharDesk['"]/);
        assert.doesNotMatch(login, /from ['"]\.\.\/ui\/CreateCharDesk['"]/);
        assert.doesNotMatch(login, /from ['"]\.\.\/ui\/ArenaSelectCharDesk['"]/);
        assert.doesNotMatch(login, /loadSelectAppearanceSprites/);
        assert.doesNotMatch(login, /ensureDesks/);
        assert.doesNotMatch(login, /syncDesksFromStore/);
        assert.doesNotMatch(login, /alreadyEnteringWorld/);
        const desk = fs.readFileSync(path.join(clientRoot, 'src/game/ui/SelectCharDesk.ts'), 'utf8');
        const sync = fs.readFileSync(
            path.join(clientRoot, 'src/game/ui/selectCharDeskSync.ts'),
            'utf8',
        );
        assert.match(desk, /SelectCharDesk painted slot texts/);
        assert.match(sync, /paintSelectCharSlotRows/);
        assert.match(sync, /forceRebuild/);
        assert.match(sync, /applyPaintedSlotRows/);
        assert.doesNotMatch(desk, /writeSlotCardTexts/);
        assert.match(desk, /writeSlotGlyphImage/);
        assert.match(desk, /painted slot texts names=/);
        assert.match(desk, /syncOccupiedDomOverlay/);
        const glyphs = fs.readFileSync(
            path.join(clientRoot, 'src/game/ui/selectCharSlotGlyphs.ts'),
            'utf8',
        );
        assert.match(glyphs, /occupiedSlotOverlayInnerHtml/);
        assert.match(glyphs, /selectchar-occupied-labels/);
        assert.match(glyphs, /selectchar-react-occupied/);
        assert.match(glyphs, /selectchar-kindgem-occupied-banner/);
        assert.match(glyphs, /ConnectDialog React SELECTCHAR occupied/);
        assert.match(glyphs, /React SELECTCHAR occupied painted names=/);
        assert.match(glyphs, /React SELECTCHAR occupied DOM textContent=/);
        assert.match(glyphs, /React SELECTCHAR KindGem visible=/);
        assert.match(glyphs, /OCCUPIED Elon Lev\.150/);
        assert.match(glyphs, /destroySelectCharWaitingBannerNodes/);
        assert.match(glyphs, /paintSelectCharReactOccupiedBannerNodes/);
        assert.match(glyphs, /syncSelectCharReactOccupiedBannerDom/);
        assert.match(glyphs, /mountSelectCharKindGemBannerOnBody/);
        assert.match(glyphs, /selectCharKindGemBannerRectOnScreen/);
        assert.match(glyphs, /parentOverflow/);
        const overlay = fs.readFileSync(
            path.join(clientRoot, 'src/ui/components/SelectCharOccupiedReactOverlay.tsx'),
            'utf8',
        );
        assert.match(overlay, /ConnectDialog React SELECTCHAR occupied/);
        assert.match(overlay, /SELECTCHAR_REACT_OCCUPIED_ID/);
        assert.match(overlay, /SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG/);
        assert.match(overlay, /SELECTCHAR_REACT_OCCUPIED_DOM_LOG/);
        assert.match(overlay, /SELECTCHAR_KINDGEM_ELON_LV150_TEXT/);
        assert.match(overlay, /syncSelectCharReactOccupiedBannerDom/);
        assert.match(overlay, /SELECTCHAR_OCCUPIED_SLOT_LABEL/);
        assert.match(overlay, /createPortal/);
        const reactDesk = fs.readFileSync(
            path.join(clientRoot, 'src/ui/components/SelectCharReactDesk.tsx'),
            'utf8',
        );
        assert.match(reactDesk, /Explorer/);
        assert.match(reactDesk, /SELECTCHAR_OCCUPIED_SLOT_LABEL/);
        assert.match(reactDesk, /SelectCharReactDesk/);
        const store = fs.readFileSync(
            path.join(clientRoot, 'src/ui/store/ConnectDialog.store.ts'),
            'utf8',
        );
        assert.match(store, /phase === 'entering-world'/);
        assert.match(store, /phaserWorldSession/);
        assert.doesNotMatch(
            store,
            /return state\.phase === 'play-world' \|\| state\.phase === 'create-char' \|\| state\.phase === 'arena-lobby'/,
        );
        const arenaLobby = fs.readFileSync(
            path.join(clientRoot, 'src/ui/components/ArenaReactLobby.tsx'),
            'utf8',
        );
        assert.match(arenaLobby, /ArenaReactLobby/);
        assert.doesNotMatch(arenaLobby, /from ['"]phaser['"]/);
        const connect = fs.readFileSync(
            path.join(clientRoot, 'src/ui/dialogs/ConnectDialog.tsx'),
            'utf8',
        );
        assert.match(connect, /SelectCharOccupiedReactOverlay/);
        assert.match(connect, /SelectCharReactDesk/);
        assert.match(connect, /ArenaReactLobby/);
        assert.match(connect, /import\('\.\.\/components\/SelectCharReactDesk'\)/);
        assert.match(connect, /import\('\.\.\/components\/ArenaReactLobby'\)/);
        assert.doesNotMatch(connect, /from ['"]\.\.\/components\/SelectCharReactDesk['"]/);
        assert.match(connect, /beginEnteringWorld/);
        assert.doesNotMatch(
            connect,
            /phase === 'play-world' \|\| phase === 'create-char' \|\| phase === 'arena-lobby'/,
        );
    });

    it('App mounts PhaserGame only after seal and guards render throws', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/App.tsx'), 'utf8');
        assert.match(src, /PhaserMountGuard/);
        assert.match(src, /<PhaserGame /);
        assert.match(src, /mountPhaserAfterSeal &&/);
        assert.match(src, /rpg-ui\.css/);
    });

    it('main.tsx opens login hub before createRoot', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/main.tsx'), 'utf8');
        const hubIdx = src.indexOf('ensureLoginHubOpenAtBoot');
        const rootIdx = src.indexOf('createRoot');
        assert.ok(hubIdx >= 0, 'ensureLoginHubOpenAtBoot missing');
        assert.ok(rootIdx > hubIdx, 'login hub must open before createRoot');
    });

    it('LoadingScreen defers catalog audio and sprites on the HTTP live path', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/game/scenes/LoadingScreen.ts'), 'utf8');
        assert.match(src, /LOAD_AUDIO_ON_DEMAND/);
        assert.match(src, /LOAD_BOOT_SPRITES_ON_DEMAND/);
        const config = fs.readFileSync(path.join(clientRoot, 'src/Config.ts'), 'utf8');
        assert.match(config, /export const LOAD_AUDIO_ON_DEMAND = true;/);
        assert.match(config, /export const LOAD_BOOT_SPRITES_ON_DEMAND = true;/);
    });

    it('walletAuth boot does not throw without a wallet', () => {
        installMinimalBrowser();
        assert.doesNotThrow(() => bootstrapWalletDeepLinkAtBoot());
        assert.equal(getStoredWalletToken(), undefined);
        assert.equal(getStoredWalletPubkey(), undefined);
        assert.equal(consumeWalletDeepLink(), null);
        assert.equal(consumePreferredAuthChain(), undefined);
    });
});

describe('KindGem occupied overlay mount (Elon lv150)', () => {
    it('paints #selectchar-kindgem-occupied-banner with OCCUPIED Elon Lev.150 and no waiting', () => {
        class FakeStyle {
            display = '';
            visibility = '';
            opacity = '';
            zIndex = '';
            color = '';
            fontSize = '';
            position = '';
            pointerEvents = '';
            background = '';
            top = '';
            left = '';
            transform = '';
            minWidth = '';
            minHeight = '';
            overflow = '';
            overflowX = '';
            overflowY = '';
            contain = '';
            maxWidth = '';
            lineHeight = '';
            padding = '';
            whiteSpace = '';
            cssText = '';
            [key: string]: string;
        }
        class FakeEl {
            id = '';
            className = '';
            tagName = 'DIV';
            textContent = '';
            children: FakeEl[] = [];
            parentNode: FakeEl | null = null;
            style = new FakeStyle();
            attrs = new Map<string, string>();
            get parentElement(): FakeEl | null {
                return this.parentNode;
            }
            get innerText(): string {
                return this.textContent || this.children.map((c) => c.innerText).join(' ');
            }
            setAttribute(name: string, value: string) {
                this.attrs.set(name, value);
            }
            getAttribute(name: string) {
                return this.attrs.get(name) ?? null;
            }
            matchesOne(part: string): boolean {
                const sel = part.trim();
                if (sel.startsWith('#')) {
                    return this.id === sel.slice(1);
                }
                if (sel.startsWith('.')) {
                    return this.className.split(/\s+/).includes(sel.slice(1));
                }
                const eq = sel.match(/^\[([^=\]]+)=["']?([^"'\]]+)["']?\]$/);
                if (eq) {
                    return this.getAttribute(eq[1]) === eq[2];
                }
                return false;
            }
            matches(sel: string): boolean {
                return sel.split(',').some((part) => this.matchesOne(part));
            }
            querySelectorAll(sel: string): FakeEl[] {
                const out: FakeEl[] = [];
                const walk = (n: FakeEl) => {
                    if (n.matches(sel)) {
                        out.push(n);
                    }
                    n.children.forEach(walk);
                };
                this.children.forEach(walk);
                return out;
            }
            querySelector(sel: string): FakeEl | null {
                return this.querySelectorAll(sel)[0] ?? null;
            }
            appendChild(child: FakeEl): FakeEl {
                if (child.parentNode) {
                    child.parentNode.removeChild(child);
                }
                child.parentNode = this;
                this.children.push(child);
                return child;
            }
            removeChild(child: FakeEl): FakeEl {
                this.children = this.children.filter((c) => c !== child);
                child.parentNode = null;
                return child;
            }
            remove() {
                this.parentNode?.removeChild(this);
            }
            contains(other: FakeEl): boolean {
                return other === this || this.children.some((c) => c.contains(other));
            }
            getBoundingClientRect() {
                const hidden =
                    this.style.display === 'none' ||
                    this.style.visibility === 'hidden' ||
                    this.style.opacity === '0';
                const fontPx = parseFloat(this.style.fontSize) || 0;
                const width = hidden ? 0 : Math.max(280, parseFloat(this.style.minWidth) || 280);
                const height = hidden ? 0 : Math.max(44, fontPx > 0 ? fontPx + 16 : 44);
                const top = parseFloat(this.style.top) || 12;
                const left = 120;
                return { width, height, top, left, bottom: top + height, right: left + width };
            }
        }
        class FakeDoc {
            body = new FakeEl();
            createElement() {
                return new FakeEl();
            }
            getElementById(id: string): FakeEl | null {
                const walk = (n: FakeEl): FakeEl | null => {
                    if (n.id === id) {
                        return n;
                    }
                    for (const c of n.children) {
                        const hit = walk(c);
                        if (hit) {
                            return hit;
                        }
                    }
                    return null;
                };
                return walk(this.body);
            }
            querySelector(sel: string) {
                return this.body.querySelector(sel);
            }
            querySelectorAll(sel: string) {
                return this.body.querySelectorAll(sel);
            }
        }

        const elon: CharacterSlotSummary = {
            slotIndex: 0,
            name: 'Elon',
            level: 150,
            exp: 0,
            rebirth: 0,
            hoursPlayed: 0,
            str: 10,
            vit: 10,
            dex: 10,
            intel: 10,
            mag: 10,
            chr: 10,
            gender: 0,
            skinColor: 0,
            hairStyleIndex: 0,
            underwearColorIndex: 0,
            citizenshipSide: 'traveler',
        };
        const doc = new FakeDoc();
        doc.body.tagName = 'BODY';
        const waiting = new FakeEl();
        waiting.className = 'selectchar-react-occupied__banner';
        waiting.textContent = 'ConnectDialog React SELECTCHAR occupied — waiting';
        waiting.setAttribute('data-selectchar-react-banner', '1');
        doc.body.appendChild(waiting);

        clearSelectCharReactOccupiedBannerSticky();
        const banner = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([elon]), [elon]);
        syncSelectCharReactOccupiedBannerDom(banner, null, doc as unknown as Document);

        const painted = doc.querySelector('#selectchar-kindgem-occupied-banner');
        assert.ok(painted);
        assert.match(painted!.textContent, /OCCUPIED/);
        assert.match(painted!.textContent, /Elon/);
        assert.match(painted!.textContent, /150/);
        assert.equal(painted!.id, SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);

        const bannerInner = doc.body
            .querySelectorAll(
                '[data-selectchar-react-banner="1"], .selectchar-react-occupied__banner, #selectchar-kindgem-occupied-banner',
            )
            .map((n) => n.innerText)
            .join('\n');
        assert.equal(bannerInner.toLowerCase().includes('waiting'), false);
        assert.equal(waiting.parentNode, null);

        const box = painted!.getBoundingClientRect();
        assert.equal(selectCharKindGemBannerRectOnScreen(box), true);
        assert.ok(box.top >= 0);
        assert.ok(box.left >= 0);
        assert.ok(box.width > 100);
        assert.ok(box.height > 20);
        assert.notEqual(painted!.style.opacity, '0');
        assert.equal(painted!.parentNode, doc.body);
        assert.equal(doc.body.children[doc.body.children.length - 1], painted);
    });
});

describe('hub Phantom sign path (source)', () => {
    it('ConnectDialog always re-authenticates Phantom Sol and surfaces the extension toast', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/ui/dialogs/ConnectDialog.tsx'), 'utf8');
        assert.match(src, /const mustSign = needsWalletSignForWorldEnter\(chain, session\);/);
        assert.match(src, /Reconnect \/ Sign again/);
        assert.match(src, /PHANTOM_SIGN_PENDING_TOAST/);
        assert.match(src, /getReusableHubWalletSession/);
        assert.doesNotMatch(src, /getStoredWalletToken\(\)/);
    });

    it('walletAuth prefers Phantom signMessage and clears stale Sol tokens', () => {
        const src = fs.readFileSync(path.join(clientRoot, 'src/utils/walletAuth.ts'), 'utf8');
        assert.match(src, /Approve the signature in the Phantom extension/);
        assert.match(src, /phantom\.signMessage\(encoded, 'utf8'\)/);
        assert.match(src, /clearStoredWalletAuth\(\)/);
        assert.match(src, /onlyIfTrusted: false/);
        assert.match(src, /w\.phantom\?\.solana \?\? w\.solana/);
    });
});

describe('production index-*.js (when dist exists)', () => {
    it('keeps Phaser out of the hub entry chunk so KindGem can seal without Error 9', () => {
        const distAssets = path.join(clientRoot, 'dist/assets');
        if (!fs.existsSync(distAssets)) {
            return;
        }
        const files = fs.readdirSync(distAssets);
        const indexFiles = files.filter((f) => /^index-.*\.js$/.test(f));
        assert.equal(indexFiles.length, 1, `expected one index-*.js, got ${indexFiles.join(',')}`);
        const entry = fs.readFileSync(path.join(distAssets, indexFiles[0]), 'utf8');
        assert.doesNotMatch(entry, /Cannot create WebGL context, aborting/);
        assert.doesNotMatch(entry, /buildGameConfig\(parent/);
        assert.doesNotMatch(entry, /from["']\.\/phaser-/);
        assert.doesNotMatch(entry, /gameWorldCanvasPresentation/);
        assert.doesNotMatch(entry, /ConnectDialog React SELECTCHAR occupied/);
        assert.doesNotMatch(entry, /OCCUPIED Elon Lev\.150/);
        const occupiedChunk = files.some((f) => {
            if (!f.endsWith('.js') || /^index-/.test(f)) {
                return false;
            }
            const src = fs.readFileSync(path.join(distAssets, f), 'utf8');
            return src.includes('OCCUPIED Elon Lev.150') && src.includes('ConnectDialog React SELECTCHAR occupied');
        });
        assert.equal(occupiedChunk, true, 'Occupied Elon banner must live in a post-seal lazy chunk, not hub index');
        const html = fs.readFileSync(path.join(clientRoot, 'dist/index.html'), 'utf8');
        assert.doesNotMatch(html, /modulepreload[^>]+(?:phaser-|PhaserGame|gameWorldCanvasPresentation)/i);
    });
});
