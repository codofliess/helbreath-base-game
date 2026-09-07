import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import {
    applyStoreToSelectCharDesk,
    paintSelectCharSlotRows,
    resolveSelectCharSelectedIndex,
    resolveSelectCharSlotsForPaint,
    selectCharDeskIsMissingOccupiedSlots,
    type SelectCharDeskPaintTarget,
} from './selectCharDeskSync';
import {
    occupiedSlotOverlayInnerHtml,
    paintSlotGlyphCanvas,
    projectDeskPointToCss,
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
        assert.deepEqual(written, ['Elon', 'Lev. 150']);
        assert.deepEqual(texts, ['Elon', 'Lev. 150']);
        assert.equal(texts.includes('Empty'), false);
    });
});

describe('occupiedSlotOverlayInnerHtml', () => {
    it('emits a KindGem Elon Lv150 node and skips Empty shells', () => {
        const rows = paintSelectCharSlotRows([elon]);
        const html = occupiedSlotOverlayInnerHtml(rows);
        assert.match(html, /data-occupied="1"/);
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
