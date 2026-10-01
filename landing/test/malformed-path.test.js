const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { server } = require('../server.js');

function rawGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: requestPath,
        method: 'GET',
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks),
            headers: res.headers,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('malformed and private landing paths', () => {
  let listening;

  async function listen() {
    if (listening) return listening;
    listening = await new Promise((resolve) => {
      const s = server.listen(0, '127.0.0.1', () => resolve(s));
    });
    return listening;
  }

  it('rejects malformed percent-encoding with 400 and keeps serving', async () => {
    const s = await listen();
    const { port } = s.address();
    const bad = await rawGet(port, '/%E0%A4%A');
    assert.equal(bad.status, 400);
    const home = await rawGet(port, '/');
    assert.equal(home.status, 200);
    assert.match(home.body.toString('utf8'), /<html/i);
  });

  it('rejects null-byte paths with 400', async () => {
    const s = await listen();
    const { port } = s.address();
    const res = await rawGet(port, '/.env.local%00');
    assert.equal(res.status, 400);
  });

  it('does not serve server.js or dotfiles', async () => {
    const s = await listen();
    const { port } = s.address();
    const serverJs = await rawGet(port, '/server.js');
    assert.equal(serverJs.status, 404);
    assert.equal(serverJs.body.includes(Buffer.from('CHAINLORDS_MIDDLEWARE_URL')), false);
    const env = await rawGet(port, '/.env');
    assert.equal(env.status, 404);
  });

  it('GET / returns 200 HTML', async () => {
    const s = await listen();
    const { port } = s.address();
    const res = await rawGet(port, '/');
    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type']), /text\/html/i);
    assert.match(res.body.toString('utf8'), /<html/i);
  });

  after(
    () =>
      new Promise((resolve) => {
        if (!listening) {
          resolve();
          return;
        }
        listening.close(() => resolve());
      }),
  );
});
