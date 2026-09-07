import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import {
    applyStoreToSelectCharDesk,
    resolveSelectCharSlotsForPaint,
    selectCharDeskIsMissingOccupiedSlots,
    type SelectCharDeskPaintTarget,
} from './selectCharDeskSync';

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
        assert.equal(desk.calls.filter((c) => c === 'slots:Elon').length, 2);
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
