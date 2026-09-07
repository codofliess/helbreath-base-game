import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import {
    applyStoreToSelectCharDesk,
    formatSelectCharOccupiedLev,
    explorerOccupiedFingerprint,
    highestLevelOccupiedSlot,
    nextOccupiedExplorerIndex,
    paintExplorerSelectCharRows,
    paintSelectCharSlotRows,
    resolveSelectCharSelectedIndex,
    resolveSelectCharSlotsForPaint,
    selectCharDeskIsMissingOccupiedSlots,
    type SelectCharDeskPaintTarget,
} from './selectCharDeskSync';
import {
    SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID,
    SELECTCHAR_KINDGEM_OCCUPIED_PREFIX,
    buildSelectCharReactOccupiedBanner,
    clearSelectCharReactOccupiedBannerSticky,
    occupiedSlotOverlayInnerHtml,
    paintSelectCharReactOccupiedBannerNodes,
    paintSlotGlyphCanvas,
    projectDeskPointToCss,
    selectCharKindGemBannerRectOnScreen,
    selectCharOccupiedNamesRequireVisibleBanner,
    syncSelectCharReactOccupiedBannerDom,
} from './selectCharSlotGlyphs';

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

class FakeDesk implements SelectCharDeskPaintTarget {
    slots: CharacterSlotSummary[] = [];
    visible = false;
    selected = 0;
    loading = false;
    calls: string[] = [];
    /** Slots captured when setVisible(true) schedules a deferred rebuild (old LoginScreen order). */
    deferredRebuildSlots: CharacterSlotSummary[] | undefined;

    setCharacterSlots(slots: CharacterSlotSummary[]): void {
        this.slots = slots.slice();
        this.calls.push(`slots:${slots.map((s) => s.name).join(',') || 'empty'}`);
    }

    setVisible(visible: boolean): void {
        if (visible && !this.visible) {
            this.deferredRebuildSlots = this.slots.slice();
        }
        this.visible = visible;
        this.calls.push(`visible:${visible}`);
    }

    setSelectedSlotIndex(index: number): void {
        this.selected = index;
        this.calls.push(`select:${index}`);
    }

    setLoading(loading: boolean): void {
        this.loading = loading;
        this.calls.push(`loading:${loading}`);
    }

    getCharacterSlots(): CharacterSlotSummary[] {
        return this.slots.slice();
    }

    forceRebuild(): void {
        this.calls.push('rebuild');
    }

    applyPaintedSlotRows(rows: { name: string }[]): void {
        this.calls.push(`glyphs:${rows.map((r) => r.name).join('|')}`);
    }

    flushDeferredRebuild(): void {
        if (this.deferredRebuildSlots) {
            this.slots = this.deferredRebuildSlots.slice();
            this.deferredRebuildSlots = undefined;
        }
    }
}

describe('applyStoreToSelectCharDesk', () => {
    it('pushes Elon before visibility so a deferred rebuild cannot paint empty shells', () => {
        const desk = new FakeDesk();
        applyStoreToSelectCharDesk(desk, {
            characterSlots: [elon],
            selectedSlotIndex: 0,
            characterListLoading: false,
        });

        assert.equal(desk.calls[0], 'slots:Elon');
        assert.equal(desk.calls[1], 'visible:true');
        assert.equal(desk.deferredRebuildSlots?.[0]?.name, 'Elon');
        desk.flushDeferredRebuild();
        assert.equal(desk.slots[0]?.name, 'Elon');
        assert.equal(desk.slots[0]?.level, 150);
        assert.equal(desk.calls.includes('slots:Elon'), true);
        assert.ok(desk.calls.filter((c) => c === 'slots:Elon').length >= 2);
        assert.equal(desk.calls.includes('rebuild'), true);
        assert.equal(desk.calls.at(-1), 'glyphs:Elon|Empty|Empty|Empty');
    });

    it('re-pushes occupied slots after the desk is already visible (Strict Mode second paint)', () => {
        const desk = new FakeDesk();
        applyStoreToSelectCharDesk(desk, {
            characterSlots: [],
            selectedSlotIndex: 0,
            characterListLoading: true,
        });
        applyStoreToSelectCharDesk(desk, {
            characterSlots: [elon],
            selectedSlotIndex: 0,
            characterListLoading: false,
        });
        assert.equal(desk.slots[0]?.name, 'Elon');
        assert.equal(desk.loading, false);
        assert.equal(desk.selected, 0);
    });
});

describe('resolveSelectCharSlotsForPaint', () => {
    it('prefers EventBus payload, then store, then CharacterList cache', () => {
        const cached = [{ ...elon, name: 'Cached' }];
        const store = [{ ...elon, name: 'Store' }];
        const event = [{ ...elon, name: 'Event' }];
        assert.equal(resolveSelectCharSlotsForPaint(event, store, cached)[0]?.name, 'Event');
        assert.equal(resolveSelectCharSlotsForPaint([], store, cached)[0]?.name, 'Store');
        assert.equal(resolveSelectCharSlotsForPaint(undefined, [], cached)[0]?.name, 'Cached');
        assert.equal(resolveSelectCharSlotsForPaint(undefined, [], []).length, 0);
    });

    it('paints cache Elon when the store is still empty (late LoginScreen)', () => {
        const desk = new FakeDesk();
        const slots = resolveSelectCharSlotsForPaint(undefined, [], [elon]);
        applyStoreToSelectCharDesk(desk, {
            characterSlots: slots,
            selectedSlotIndex: 0,
            characterListLoading: false,
        });
        assert.equal(desk.slots[0]?.name, 'Elon');
        assert.equal(desk.visible, true);
    });
});

describe('selectCharDeskIsMissingOccupiedSlots', () => {
    it('detects store Elon vs empty Phaser desk', () => {
        assert.equal(selectCharDeskIsMissingOccupiedSlots([elon], []), true);
        assert.equal(selectCharDeskIsMissingOccupiedSlots([elon], [elon]), false);
        assert.equal(selectCharDeskIsMissingOccupiedSlots([], []), false);
    });
});

describe('paintExplorerSelectCharRows', () => {
    it('puts the highest-level traveler on the left and keeps server slotIndex', () => {
        const beba: CharacterSlotSummary = { ...elon, slotIndex: 0, name: 'BebaMaster', level: 1 };
        const co2: CharacterSlotSummary = { ...elon, slotIndex: 1, name: 'Co2', level: 150 };
        const rows = paintExplorerSelectCharRows([beba, co2]);
        assert.equal(rows[0]?.name, 'Co2');
        assert.equal(rows[0]?.occupied?.slotIndex, 1);
        assert.equal(rows[1]?.name, 'BebaMaster');
        assert.equal(rows[1]?.occupied?.slotIndex, 0);
        assert.equal(rows[2]?.name, 'Empty');
        assert.equal(highestLevelOccupiedSlot([beba, co2])?.name, 'Co2');
        assert.equal(explorerOccupiedFingerprint([beba, co2]), '1:Co2:150|0:BebaMaster:1');
        assert.equal(nextOccupiedExplorerIndex(rows, 0, 1), 1);
        assert.equal(nextOccupiedExplorerIndex(rows, 1, 1), 1);
        assert.equal(nextOccupiedExplorerIndex(rows, 1, -1), 0);
        assert.equal(nextOccupiedExplorerIndex(rows, 2, 1), 1);
    });
});

describe('paintSelectCharSlotRows', () => {
    it('paints Elon Lv150 on card 0 and Empty/Create on the other shells', () => {
        const rows = paintSelectCharSlotRows([elon]);
        assert.equal(rows[0]?.name, 'Elon');
        assert.equal(rows[0]?.lev, 'Lev. 150');
        assert.equal(rows[0]?.occupied?.name, 'Elon');
        assert.equal(rows[1]?.name, 'Empty');
        assert.equal(rows[1]?.lev, 'Create Character');
        assert.equal(rows[2]?.name, 'Empty');
        assert.equal(rows[3]?.name, 'Empty');
    });

    it('claims an out-of-range slotIndex onto a visible card so Elon is not Empty', () => {
        const rows = paintSelectCharSlotRows([{ ...elon, slotIndex: 99 }]);
        assert.equal(rows.some((r) => r.name === 'Elon' && r.lev === 'Lev. 150'), true);
        assert.equal(rows[0]?.name, 'Elon');
    });
});

describe('formatSelectCharOccupiedLev', () => {
    it('renders Lev. 150 when store level is 150', () => {
        assert.equal(formatSelectCharOccupiedLev(150, 0), 'Lev. 150');
        assert.equal(formatSelectCharOccupiedLev(undefined, 0), 'Lev. 0');
    });
});

describe('resolveSelectCharSelectedIndex', () => {
    it('moves selection onto occupied Elon when store still points at an empty card', () => {
        const occupied = { ...elon, slotIndex: 1 };
        assert.equal(resolveSelectCharSelectedIndex([occupied], 0), 1);
        assert.equal(resolveSelectCharSelectedIndex([elon], 0), 0);
    });
});

describe('applyStoreToSelectCharDesk occupied selection', () => {
    it('selects Elon on slot 1 instead of leaving the hero on Empty card 0', () => {
        const desk = new FakeDesk();
        applyStoreToSelectCharDesk(desk, {
            characterSlots: [{ ...elon, slotIndex: 1 }],
            selectedSlotIndex: 0,
            characterListLoading: false,
        });
        assert.equal(desk.slots[0]?.name, 'Elon');
        assert.equal(desk.slots[0]?.slotIndex, 1);
        assert.equal(desk.selected, 1);
        assert.equal(desk.visible, true);
        assert.equal(desk.calls.includes('rebuild'), true);
        assert.equal(desk.calls.at(-1), 'glyphs:Empty|Elon|Empty|Empty');
    });
});

describe('paintSlotGlyphCanvas', () => {
    it('burns Elon Lev. 150 onto the canvas, not Empty/Create', () => {
        const texts: string[] = [];
        const ctx = {
            clearRect() {},
            fillRect() {},
            fillText(text: string) {
                texts.push(text);
            },
            font: '',
            fillStyle: '',
            textBaseline: 'top' as const,
        };
        const written = paintSlotGlyphCanvas(ctx, {
            name: 'Elon',
            lev: 'Lev. 150',
            occupied: elon,
        });
        assert.deepEqual(written, ['Occupied', 'Elon', 'Lev. 150']);
        assert.deepEqual(texts, ['Occupied', 'Elon', 'Lev. 150']);
        assert.equal(texts.includes('Empty'), false);
    });
});

describe('buildSelectCharReactOccupiedBanner', () => {
    it('puts Elon Lev.150 in a KindGem-visible OCCUPIED banner', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const rows = paintSelectCharSlotRows([elon]);
        const banner = buildSelectCharReactOccupiedBanner(rows, [elon]);
        assert.equal(banner, 'OCCUPIED Elon Lev.150');
        assert.match(banner, new RegExp(SELECTCHAR_KINDGEM_OCCUPIED_PREFIX));
        assert.match(banner, /Elon/);
        assert.match(banner, /Lev\.150/);
        assert.equal(banner.includes('waiting'), false);
    });

    it('uses store Elon Lv150 even when paint rows are still Empty/waiting', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const emptyRows = paintSelectCharSlotRows([]);
        const banner = buildSelectCharReactOccupiedBanner(emptyRows, [elon]);
        assert.equal(banner, 'OCCUPIED Elon Lev.150');
        assert.equal(banner.includes('waiting'), false);
    });

    it('still mounts the React paint path when the store has no occupied rows', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const banner = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([]), []);
        assert.match(banner, /ConnectDialog React SELECTCHAR occupied/);
        assert.match(banner, /waiting/);
    });

    it('never returns waiting after named Elon rows, even on a later empty paint', () => {
        clearSelectCharReactOccupiedBannerSticky();
        buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([elon]), [elon]);
        const later = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([]), []);
        assert.equal(later, 'OCCUPIED Elon Lev.150');
        assert.equal(later.includes('waiting'), false);
    });
});

describe('paintSelectCharReactOccupiedBannerNodes — DOM not console', () => {
    it('overwrites a stale waiting portal so KindGem textContent has Elon and 150', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const banner = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([elon]), [elon]);
        const attrs = new Map<string, string>();
        const stale = {
            textContent: 'ConnectDialog React SELECTCHAR occupied — waiting',
            style: {},
            setAttribute(name: string, value: string) {
                attrs.set(name, value);
            },
        };
        const live = {
            textContent: 'ConnectDialog React SELECTCHAR occupied — waiting',
            style: {},
            setAttribute() {},
        };
        const painted = paintSelectCharReactOccupiedBannerNodes(banner, [stale, live]);
        assert.equal(painted.hasWaiting, false);
        for (const text of painted.textContents) {
            assert.match(text, /Elon/);
            assert.match(text, /150/);
            assert.equal(text.includes('waiting'), false);
        }
        assert.equal(selectCharOccupiedNamesRequireVisibleBanner('Elon', painted.joined), true);
        assert.equal(stale.style.visibility, 'visible');
        assert.equal(stale.style.opacity, '1');
        assert.equal(stale.style.fontSize, '28px');
        assert.equal(stale.style.color, '#1a0a12');
        assert.equal(attrs.get('data-selectchar-banner-text'), banner);
    });

    it('fails the KindGem gate when painted names=Elon but DOM still says waiting', () => {
        assert.equal(
            selectCharOccupiedNamesRequireVisibleBanner(
                'Elon',
                'ConnectDialog React SELECTCHAR occupied — waiting',
            ),
            false,
        );
    });
});

function installFakeSelectCharDocument() {
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
            if (this.textContent) {
                return this.textContent;
            }
            return this.children.map((c) => c.innerText).join(' ');
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
            const bare = sel.match(/^\[([^\]]+)\]$/);
            if (bare) {
                return this.attrs.has(bare[1]);
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
            if (other === this) {
                return true;
            }
            return this.children.some((c) => c.contains(other));
        }

        getBoundingClientRect() {
            const hidden =
                this.style.display === 'none' ||
                this.style.visibility === 'hidden' ||
                this.style.opacity === '0';
            const fontPx = parseFloat(this.style.fontSize) || 0;
            const minW = parseFloat(this.style.minWidth) || 0;
            const width = hidden ? 0 : Math.max(280, minW, fontPx > 0 ? 280 : 0);
            const height = hidden ? 0 : Math.max(44, fontPx > 0 ? fontPx + 16 : 0);
            const top = parseFloat(this.style.top) || 12;
            const left = 120;
            return { width, height, top, left, bottom: top + height, right: left + width, x: left, y: top };
        }
    }

    class FakeDoc {
        body = new FakeEl();
        documentElement = new FakeEl();

        createElement(_tag: string) {
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

    const doc = new FakeDoc();
    doc.body.tagName = 'BODY';
    return { doc, FakeEl };
}

describe('syncSelectCharReactOccupiedBannerDom — fail-closed KindGem paint', () => {
    it('destroys waiting banners and paints a visible OCCUPIED Elon Lev.150 singleton', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const { doc, FakeEl } = installFakeSelectCharDocument();
        const waiting = new FakeEl();
        waiting.id = 'stale-waiting-banner';
        waiting.className = 'selectchar-react-occupied__banner';
        waiting.textContent = 'ConnectDialog React SELECTCHAR occupied — waiting';
        waiting.setAttribute('data-selectchar-react-banner', '1');
        doc.body.appendChild(waiting);

        const banner = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([elon]), [elon]);
        const painted = syncSelectCharReactOccupiedBannerDom(banner, null, doc as unknown as Document);

        const kindgem = doc.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);
        assert.ok(kindgem);
        assert.equal(kindgem?.textContent, 'OCCUPIED Elon Lev.150');
        assert.match(kindgem?.textContent ?? '', /OCCUPIED/);
        assert.match(kindgem?.textContent ?? '', /Elon/);
        assert.match(kindgem?.textContent ?? '', /150/);
        assert.equal((kindgem?.textContent ?? '').includes('waiting'), false);
        assert.equal(waiting.parentNode, null);
        assert.equal(painted.hasWaiting, false);

        const bannerText = doc.body
            .querySelectorAll('[data-selectchar-react-banner="1"], .selectchar-react-occupied__banner, #selectchar-kindgem-occupied-banner')
            .map((n) => n.innerText)
            .join(' ');
        assert.equal(bannerText.includes('waiting'), false);

        const rect = kindgem!.getBoundingClientRect();
        assert.equal(selectCharKindGemBannerRectOnScreen(rect), true);
        assert.ok(rect.top >= 0);
        assert.ok(rect.left >= 0);
        assert.ok(rect.width > 100);
        assert.ok(rect.height > 20);
        assert.notEqual(kindgem!.style.opacity, '0');
        assert.equal(kindgem!.style.fontSize, '28px');
        assert.equal(kindgem!.parentNode, doc.body);
        assert.equal(doc.body.children[doc.body.children.length - 1], kindgem);
    });

    it('reparents a #root overflow:hidden banner onto document.body last child', () => {
        clearSelectCharReactOccupiedBannerSticky();
        const { doc, FakeEl } = installFakeSelectCharDocument();
        const root = new FakeEl();
        root.id = 'root';
        root.style.overflow = 'hidden';
        doc.body.appendChild(root);
        const trapped = new FakeEl();
        trapped.id = SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID;
        trapped.className = 'selectchar-react-occupied__banner';
        trapped.setAttribute('data-selectchar-react-banner', '1');
        trapped.textContent = 'OCCUPIED Elon Lev.150';
        root.appendChild(trapped);

        const banner = buildSelectCharReactOccupiedBanner(paintSelectCharSlotRows([elon]), [elon]);
        syncSelectCharReactOccupiedBannerDom(banner, null, doc as unknown as Document);

        const kindgem = doc.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);
        assert.ok(kindgem);
        assert.equal(kindgem?.parentNode, doc.body);
        assert.equal(root.children.includes(kindgem!), false);
        assert.equal(kindgem?.textContent, 'OCCUPIED Elon Lev.150');
        const rect = kindgem!.getBoundingClientRect();
        assert.equal(selectCharKindGemBannerRectOnScreen(rect), true);
        assert.match(kindgem?.textContent ?? '', /OCCUPIED/);
        assert.match(kindgem?.textContent ?? '', /Elon/);
        assert.match(kindgem?.textContent ?? '', /150/);
        assert.equal((kindgem?.textContent ?? '').includes('waiting'), false);
    });
});

describe('occupiedSlotOverlayInnerHtml', () => {
    it('emits a KindGem Elon Lv150 node and skips Empty shells', () => {
        const rows = paintSelectCharSlotRows([elon]);
        const html = occupiedSlotOverlayInnerHtml(rows);
        assert.match(html, /data-occupied="1"/);
        assert.match(html, />Occupied</);
        assert.match(html, />Elon</);
        assert.match(html, />Lev\. 150</);
        assert.equal(html.includes('Empty'), false);
        assert.equal(html.includes('Create Character'), false);
    });
});

describe('projectDeskPointToCss', () => {
    it('maps desk (0,0) to the canvas CSS origin', () => {
        const pos = projectDeskPointToCss(
            { left: 10, top: 20, width: 800, height: 600 },
            800,
            600,
            0,
            0,
        );
        assert.equal(pos.left, 10);
        assert.equal(pos.top, 20);
    });
});
