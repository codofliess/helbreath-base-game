import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { httpOriginFromPage } from './duelStreams';

describe('httpOriginFromPage', () => {
    it('includes the colon after https (nginx /api/streams must not be /https//host)', () => {
        assert.equal(httpOriginFromPage('https:', 'play.chainlords.net'), 'https://play.chainlords.net');
        assert.equal(httpOriginFromPage('https', 'play.chainlords.net'), 'https://play.chainlords.net');
        assert.equal(httpOriginFromPage('http:', 'localhost:8080'), 'http://localhost:8080');
    });
});
