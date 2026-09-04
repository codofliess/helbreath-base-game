const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { server, isAssetPath } = require('../server.js');

const ICON = path.join(__dirname, '..', 'branding', 'abaddon-icon', 'discord-server-icon.png');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LOCKED_PATH = '/branding/abaddon-icon/discord-server-icon.png';

describe('locked Metaplex PNG path', () => {
  it('keeps a real PNG at landing/branding/abaddon-icon/discord-server-icon.png', () => {
    const buf = fs.readFileSync(ICON);
    assert.ok(buf.length > 1024);
    assert.deepEqual(buf.subarray(0, 8), PNG_MAGIC);
    assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.equal(buf.readUInt32BE(16), 1024);
    assert.equal(buf.readUInt32BE(20), 1024);
  });

  it('does not SPA-fallback the locked uri or other image paths', () => {
    assert.equal(isAssetPath(LOCKED_PATH), true);
    assert.equal(isAssetPath('/missing-token-logo.png'), true);
    assert.equal(isAssetPath('/'), false);
  });
});

describe('landing serves locked PNG as image/png', () => {
  let listening;

  async function listen() {
    if (listening) return listening;
    listening = await new Promise((resolve) => {
      const s = server.listen(0, '127.0.0.1', () => resolve(s));
    });
    return listening;
  }

  it('GET returns PNG bytes, not index.html', async () => {
    const s = await listen();
    const { port } = s.address();
    const res = await fetch(`http://127.0.0.1:${port}${LOCKED_PATH}`);
    assert.equal(res.status, 200);
    assert.match(String(res.headers.get('content-type')), /image\/png/i);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(buf.subarray(0, 8), PNG_MAGIC);
    assert.equal(buf.includes(Buffer.from('<!DOCTYPE', 'utf8')), false);
  });

  it('missing .png returns 404 instead of HTML', async () => {
    const s = await listen();
    const { port } = s.address();
    const res = await fetch(`http://127.0.0.1:${port}/branding/abaddon-icon/does-not-exist.png`);
    assert.equal(res.status, 404);
    const text = await res.text();
    assert.equal(text.includes('<html'), false);
  });

  after(() => new Promise((resolve) => {
    if (!listening) {
      resolve();
      return;
    }
    listening.close(() => resolve());
  }));
});
