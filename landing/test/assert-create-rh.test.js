const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'ops', 'tge');

describe('Path RH assert + launch copy', () => {
  it('assert-create-rh.cjs PASSes without --execute', () => {
    const r = spawnSync(process.execPath, [path.join(root, 'assert-create-rh.cjs')], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /ASSERT_PASS/);
  });

  it('refuses --execute', () => {
    const r = spawnSync(process.execPath, [path.join(root, 'assert-create-rh.cjs'), '--execute'], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr || r.stdout, /ASSERT_FAIL/);
  });

  it('checklist is honest about $50 and RH brokerage', () => {
    const md = fs.readFileSync(path.join(root, 'CREATE-RH-CHECKLIST.md'), 'utf8');
    assert.match(md, /NOT listed on Robinhood/);
    assert.match(md, /Not 50% of supply/);
    assert.match(md, /600M/);
    assert.match(md, /tax 5%/i);
    assert.equal(md.includes('leftover landed in A782 at create'), false);
  });

  it('landing hero shows live Pons HELBREATH CA, not Path B 4Sk2', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    const hell = html.slice(html.indexOf('id="hell"'), html.indexOf('id="cl-tv"'));
    const news = html.slice(html.indexOf('id="news"'), html.indexOf('id="features"'));
    assert.match(hell, /0xb603D6b2e5472beb338CE079a63FEb8663171529/);
    assert.match(hell, /HELBREATH · Pons · Robinhood Chain/);
    assert.equal(hell.includes('4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq'), false);
    assert.equal(news.includes('4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq'), false);
    assert.equal(html.includes('A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ'), false);
    assert.equal(hell.includes('solscan.io'), false);
    assert.equal(hell.includes('dexscreener.com/solana'), false);
    assert.equal(/listed on Robinhood/i.test(hell), false);
  });

  it('X Pons draft has the live RH CA and no Solana mint', () => {
    const md = fs.readFileSync(path.join(root, 'X-PONS-POST.md'), 'utf8');
    const tweet = md.split('```')[1] || '';
    const alt = md.split('```')[3] || '';
    assert.match(tweet, /Now live on Robinhood Chain/);
    assert.match(tweet, /\$HELBREATH/);
    assert.match(tweet, /play\.chainlords\.net/);
    assert.match(tweet, /Not a Robinhood brokerage listing/);
    assert.match(tweet, /0xb603D6b2e5472beb338CE079a63FEb8663171529/);
    assert.match(
      tweet,
      /ponsfamily\.com\/launchpad\/0xb603D6b2e5472beb338CE079a63FEb8663171529/,
    );
    assert.equal(tweet.includes('4Sk2'), false);
    assert.equal(tweet.includes('solscan'), false);
    assert.equal(tweet.includes('dexscreener.com/solana'), false);
    assert.equal(tweet.includes('A782'), false);
    assert.match(alt, /HELBREATH on Pons/);
    assert.match(alt, /discord\.gg\/F4NwwbfKtj/);
    assert.match(alt, /@ChainLordsHQ/);
  });
});
