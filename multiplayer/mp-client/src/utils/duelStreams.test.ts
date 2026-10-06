import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectPlatform, httpOriginFromPage, parseStreamUrl } from './duelStreams';

describe('detectPlatform', () => {
    it('reads x.com and twitter.com live links as X, without matching hosts that merely contain an x', () => {
        assert.equal(detectPlatform('https://x.com/i/broadcasts/1ynJOqLgbgQJR'), 'x');
        assert.equal(detectPlatform('https://twitter.com/pepe/status/1234567890'), 'x');
        assert.equal(detectPlatform('https://box.com/live'), 'other');
        assert.equal(detectPlatform('https://www.twitch.tv/pepe'), 'twitch');
        assert.equal(parseStreamUrl('https://x.com/i/broadcasts/1ynJOqLgbgQJR')?.label, 'X Live');
    });
});

describe('httpOriginFromPage', () => {
    it('includes the colon after https (nginx /api/streams must not be /https//host)', () => {
        assert.equal(httpOriginFromPage('https:', 'play.chainlords.net'), 'https://play.chainlords.net');
        assert.equal(httpOriginFromPage('https', 'play.chainlords.net'), 'https://play.chainlords.net');
        assert.equal(httpOriginFromPage('http:', 'localhost:8080'), 'http://localhost:8080');
    });
});
