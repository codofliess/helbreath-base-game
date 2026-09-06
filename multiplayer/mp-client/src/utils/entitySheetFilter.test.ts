import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    ENTITY_DEAD_SHEET_BASE,
    entitySheetsForState,
    entityTextureKeysToEvict,
    idleEntitySheetIndices,
} from './entitySheetFilter';

describe('entitySheetFilter', () => {
    it('idle is 8 sheets and excludes combat/death', () => {
        const idle = idleEntitySheetIndices();
        assert.equal(idle.size, 8);
        assert.ok(idle.has(0));
        assert.ok(idle.has(7));
        assert.equal(idle.has(8), false);
        assert.equal(idle.has(ENTITY_DEAD_SHEET_BASE), false);
        assert.deepEqual(entitySheetsForState('attack'), [16, 17, 18, 19, 20, 21, 22, 23]);
    });

    it('evicts combat sheets while keeping idle for a slime still in view', () => {
        const keys = [
            'sprite-slime-0',
            'sprite-slime-7',
            'sprite-slime-16',
            'sprite-slime-32',
            'sprite-item-pack-0',
            'map-tile-12',
        ];
        const evict = entityTextureKeysToEvict(keys, 'sprite-slime', idleEntitySheetIndices());
        assert.deepEqual(evict.sort(), ['sprite-slime-16', 'sprite-slime-32']);
    });
});
