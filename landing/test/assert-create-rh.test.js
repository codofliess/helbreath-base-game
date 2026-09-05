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

  it('landing hero is still Path B $HELL, not a fake RH address', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.match(html, /4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq/);
    assert.equal(/0x[a-fA-F0-9]{40}/.test(html.slice(html.indexOf('id="hell"'), html.indexOf('id="cl-tv"'))), false);
  });

  it('X Pons draft has no Solana mint and a blank CA line', () => {
    const md = fs.readFileSync(path.join(root, 'X-PONS-POST.md'), 'utf8');
    const tweet = md.split('```')[1] || '';
    assert.match(md, /CA goes here after TokenLaunched/);
    assert.match(tweet, /HELBREATH on Pons/);
    assert.match(tweet, /play\.chainlords\.net/);
    assert.match(tweet, /discord\.gg\/F4NwwbfKtj/);
    assert.match(tweet, /@ChainLordsHQ/);
    assert.match(tweet, /chainlords\.net/);
    assert.match(tweet, /ponsfamily\.com/);
    assert.equal(tweet.includes('4Sk2'), false);
    assert.equal(tweet.includes('solscan'), false);
    assert.equal(tweet.includes('dexscreener.com/solana'), false);
    assert.equal(/0x[a-fA-F0-9]{40}/.test(tweet), false);
  });
});
