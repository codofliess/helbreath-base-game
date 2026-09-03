const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shouldProxy, PROXY_ROUTES } = require('../server.js');

describe('landing API proxy routes', () => {
  it('proxies /health to middleware', () => {
    const route = shouldProxy('/health');
    assert.ok(route);
    assert.match(route.targetBase, /middleware/i);
  });

  it('proxies /leaderboard to middleware', () => {
    const route = shouldProxy('/leaderboard');
    assert.ok(route);
    assert.match(route.targetBase, /middleware/i);
  });

  it('proxies /api/arena/bleeding-online to play host', () => {
    const route = shouldProxy('/api/arena/bleeding-online');
    assert.ok(route);
    assert.match(route.targetBase, /play\.chainlords\.net/);
  });

  it('does not proxy static marketing paths', () => {
    assert.equal(shouldProxy('/'), null);
    assert.equal(shouldProxy('/market.html'), null);
    assert.equal(shouldProxy('/arena-1v1.html'), null);
  });

  it('declares at least three proxy route groups', () => {
    assert.ok(PROXY_ROUTES.length >= 3);
  });
});
