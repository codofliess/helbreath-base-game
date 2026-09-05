const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const MINT = '4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq';
const POOL = 'ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx';
const OLD_MINT = 'A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ';
const SOLSCAN = `https://solscan.io/token/${MINT}`;
const DEX = `https://dexscreener.com/solana/${MINT}`;

const indexPath = path.join(__dirname, '..', 'index.html');
const listingPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'LISTING-CG-CMC.md');
const checklistPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'CREATE-B-CHECKLIST.md');
const claimPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'POST-MIGRATE-CLAIM.md');

describe('Path B $HELL mint on landing + listing pack', () => {
  const html = fs.readFileSync(indexPath, 'utf8');
  const listing = fs.readFileSync(listingPath, 'utf8');

  it('hero uses Path B mint, pool, Solscan, and DexScreener', () => {
    const hellStart = html.indexOf('id="hell"');
    const hellEnd = html.indexOf('id="cl-tv"', hellStart);
    assert.ok(hellStart > 0 && hellEnd > hellStart);
    const hell = html.slice(hellStart, hellEnd);
    assert.match(hell, new RegExp(MINT));
    assert.match(hell, new RegExp(POOL));
    assert.match(hell, /Hell is what you leave still/);
    assert.match(hell, /\$HELL · Meteora/);
    assert.match(hell, new RegExp(SOLSCAN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(hell, new RegExp(DEX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(hell, /branding\/abaddon-icon\/discord-server-icon\.png/);
    assert.equal(hell.includes('Helbreath'), false);
    assert.equal(hell.includes(OLD_MINT), false);
  });

  it('news post points at Pons, not the Solana mint / DexScreener', () => {
    const newsStart = html.indexOf('id="news"');
    const newsEnd = html.indexOf('id="features"', newsStart);
    assert.ok(newsStart > 0 && newsEnd > newsStart);
    const news = html.slice(newsStart, newsEnd);
    assert.equal(news.includes(MINT), false);
    assert.equal(news.includes('solscan.io'), false);
    assert.equal(news.includes('dexscreener.com/solana'), false);
    assert.match(news, /HELBREATH · Pons/);
    assert.match(news, /ponsfamily\.com/);
    assert.match(news, /x\.com\/ChainLordsHQ/);
    assert.match(news, /discord\.gg\/F4NwwbfKtj/);
    assert.match(news, /play\.chainlords\.net/);
    assert.match(news, /TokenLaunched/);
  });

  it('does not advertise the failed Path A mint anywhere on the landing', () => {
    assert.equal(html.includes(OLD_MINT), false);
    assert.equal(html.includes(MINT), true);
  });

  it('listing pack uses Path B mint and does not claim leftover already in A782', () => {
    assert.match(listing, new RegExp(MINT));
    assert.match(listing, new RegExp(POOL));
    assert.match(listing, /Do not write “600M already in A782”/);
    assert.match(listing, /DBC base vault/);
    assert.match(listing, /Post-migrate leftover note/);
    assert.match(listing, /Mint \| `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`/);
    assert.match(listing, /Do not list.*A8fNV2/);
    assert.equal(listing.includes('leftover (off-curve at create → `A782…`)'), false);
  });

  it('checklist and claim path do not say leftover already landed at A782', () => {
    const checklist = fs.readFileSync(checklistPath, 'utf8');
    const claim = fs.readFileSync(claimPath, 'utf8');
    assert.equal(checklist.includes('A782 ≈ **600M** HELL (leftover landed)'), false);
    assert.match(checklist, /A782 HELL ATA = \*\*0\*\* at create/);
    assert.match(checklist, /Reserved in DBC vault/);
    assert.match(claim, /4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq/);
    assert.match(claim, /withdrawLeftover/);
    assert.match(claim, /A782 = 0/);
    assert.equal(claim.includes('Do not call `withdrawLeftover`. **leftover = 0** at create'), false);
  });
});
