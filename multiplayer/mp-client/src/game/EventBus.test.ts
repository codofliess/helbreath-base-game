import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EventBus } from './EventBus';

describe('EventBus', () => {
    it('isolates listener throws so equip cannot remount the hub', () => {
        const topic = Symbol('equip-isolation-test');
        const seen: number[] = [];
        EventBus.on(topic, () => {
            throw new Error('equip paint failed');
        });
        EventBus.on(topic, () => {
            seen.push(1);
        });
        assert.doesNotThrow(() => {
            EventBus.emit(topic);
        });
        assert.deepEqual(seen, [1]);
        EventBus.removeAllListeners(topic);
    });
});
