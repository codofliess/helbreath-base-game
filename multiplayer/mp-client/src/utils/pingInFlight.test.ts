import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    nextPingSequenceUint32,
    pingInFlightTimedOut,
    pingResponseMatchesPending,
    shouldSendClientPing,
} from './pingInFlight';

describe('pingInFlight', () => {
    it('sends when the socket is open and nothing is in flight', () => {
        assert.equal(shouldSendClientPing(true, undefined, 1000, 1000), true);
        assert.equal(shouldSendClientPing(false, undefined, 1000, 1000), false);
    });

    it('blocks a new ping while a recent sample is still in flight', () => {
        assert.equal(shouldSendClientPing(true, 1000, 1500, 1000), false);
        assert.equal(pingInFlightTimedOut(1000, 1500, 1000), false);
    });

    it('retries after the in-flight timeout so a lost response cannot stall the loop', () => {
        assert.equal(shouldSendClientPing(true, 1000, 2000, 1000), true);
        assert.equal(pingInFlightTimedOut(1000, 2000, 1000), true);
        assert.equal(pingInFlightTimedOut(undefined, 2000, 1000), false);
    });

    it('accepts only the pending sequence and treats mismatch as abandon-in-flight', () => {
        assert.equal(pingResponseMatchesPending(10, 3, 3), true);
        assert.equal(pingResponseMatchesPending(10, 3, 4), false);
        assert.equal(pingResponseMatchesPending(undefined, 3, 3), false);
        assert.equal(pingResponseMatchesPending(10, undefined, 3), false);
    });

    it('wraps protobuf uint32 sequence so wire values cannot permanently mismatch', () => {
        assert.deepEqual(nextPingSequenceUint32(1), { sequence: 1, next: 2 });
        assert.deepEqual(nextPingSequenceUint32(0xffffffff), { sequence: 0xffffffff, next: 1 });
        assert.deepEqual(nextPingSequenceUint32(0), { sequence: 1, next: 2 });
    });
});
