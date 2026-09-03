const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '..', 'nginx', 'chainlords-play.conf.template');

describe('play.chainlords.net nginx template', () => {
  const text = fs.readFileSync(templatePath, 'utf8');

  it('proxies all /api/ paths to game server', () => {
    assert.match(text, /location \/api\//);
    assert.match(text, /proxy_pass http:\/\/127\.0\.0\.1:1337/);
  });

  it('proxies /ws for WebSocket', () => {
    assert.match(text, /location \/ws/);
    assert.match(text, /Upgrade \$http_upgrade/);
  });

  it('uses /api/ catch-all instead of per-route location blocks', () => {
    assert.doesNotMatch(text, /location\s+\/api\/arena\/bleeding-online/);
    assert.match(text, /location \/api\//);
  });
});
