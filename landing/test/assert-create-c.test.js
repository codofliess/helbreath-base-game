const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  AssertFail,
  TICKER,
  NAME,
  A782,
  LEFTOVER,
  DAY0_TRUTH,
  FORBIDDEN_MINTS,
  POST_CREATE_PRINT,
  defaultPlan,
  checkPlan,
  leftoverLandedCreateGoHits,
  scanPathCDocs,
} = require('../../ops/tge/assert-create-c.cjs');

const script = path.join(__dirname, '..', '..', 'ops', 'tge', 'assert-create-c.cjs');
const listingPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'LISTING-CG-CMC.md');
const checklistPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'CREATE-C-CHECKLIST.md');
const planPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'create-c.plan.json');
const indexPath = path.join(__dirname, '..', 'index.html');
const PATH_B_MINT = '4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq';
const PATH_A_MINT = 'A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ';

function runAssert(plan, extraArgs = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-c-'));
  const file = path.join(dir, 'plan.json');
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));
  const r = spawnSync(process.execPath, [script, '--plan', file, '--skip-image', ...extraArgs], {
    encoding: 'utf8',
  });
  return r;
}

describe('assert-create-c leftover==0 refuse + HELBREATH ticker', () => {
  it('committed plan is HELBREATH leftover 600M and has no mint', () => {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(plan.ticker, 'HELBREATH');
    assert.equal(plan.symbol, 'HELBREATH');
    assert.equal(plan.name, NAME);
    assert.equal(plan.leftover, 600_000_000);
    assert.equal(plan.leftoverReceiver, A782);
    assert.equal(plan.mint, null);
    assert.equal(plan.status, 'planned-not-created');
    assert.equal(plan.leftoverTiming, 'vault-until-post-migrate-withdrawLeftover');
    assert.equal(plan.day0A782Balance, 0);
  });

  it('good plan passes and prints A782=0 until withdrawLeftover', () => {
    const result = checkPlan(defaultPlan());
    assert.equal(result.ticker, TICKER);
    assert.equal(result.leftover, LEFTOVER);
    assert.equal(result.leftoverReceiver, A782);
    assert.equal(result.day0A782Balance, 0);
    assert.equal(result.day0TransferInstruction, null);
    assert.match(result.day0Truth, /A782 will be 0/);
    assert.match(result.day0Truth, /withdrawLeftover/);

    const r = runAssert(defaultPlan());
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /HELBREATH/);
    assert.match(r.stdout, /ASSERT_PASS/);
    assert.match(r.stdout, /A782 will be 0/);
    assert.equal(r.stdout.includes(DAY0_TRUTH), true);
  });

  it('leftover==0 refuses --execute', () => {
    const bad = defaultPlan();
    bad.leftover = 0;
    assert.throws(() => checkPlan(bad, { execute: true }), (err) => {
      assert.ok(err instanceof AssertFail);
      assert.match(err.message, /leftover==0/);
      assert.match(err.message, /Refusing --execute/);
      return true;
    });

    const r = runAssert(bad, ['--execute']);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ASSERT_FAIL/);
    assert.match(r.stderr, /leftover==0/);
    assert.match(r.stderr, /Refusing --execute/);
    assert.equal(r.stdout.includes('ASSERT_PASS'), false);
  });

  it('wrong ticker is refused', () => {
    const bad = defaultPlan();
    bad.ticker = 'HELL';
    bad.symbol = 'HELL';
    assert.throws(() => checkPlan(bad), /ticker\/symbol must be HELBREATH/);

    const r = runAssert(bad);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /HELBREATH/);
  });

  it('placeholder mint in the plan is refused', () => {
    const bad = defaultPlan();
    bad.mint = 'So11111111111111111111111111111111111111112';
    assert.throws(() => checkPlan(bad), /no mint yet/);
  });
});

describe('Path C listing + checklist honesty (not live)', () => {
  it('listing Path C section is planned, keeps Path B as live HELL, invents no mint', () => {
    const listing = fs.readFileSync(listingPath, 'utf8');
    assert.match(listing, /Path C — HELBREATH \(planned \/ not created\)/);
    assert.match(listing, /Not live/);
    assert.match(listing, /Chain Lords — Helbreath/);
    assert.match(listing, /Mint \| \*\*none\*\*/);
    assert.match(listing, /Path B `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`/);
    assert.match(listing, /A782 = \*\*0\*\* until post-migrate/);
    assert.equal(listing.includes('A782 ≈ 600M HELBREATH at create'), false);
    assert.equal(listing.includes('leftover (off-curve at create → `A782…`)'), false);
    const pathC = listing.slice(listing.indexOf('## Path C — HELBREATH'));
    assert.equal(pathC.includes(PATH_A_MINT), false);
    assert.match(pathC, /do not invent one/i);
  });

  it('checklist refuses leftover=0 and has no A782-at-create checkbox', () => {
    const checklist = fs.readFileSync(checklistPath, 'utf8');
    assert.match(checklist, /HELBREATH/);
    assert.match(checklist, /LEFTOVER DOES NOT LAND IN A782 AT CREATE/);
    assert.match(checklist, /refuse `--execute` if leftover==0/);
    assert.match(checklist, /A782 HELBREATH ATA = \*\*0\*\* at create/);
    assert.equal(checklist.includes('A782 ≈ **600M** HELL (leftover landed)'), false);
    assert.equal(/- \[[ x]\].*A782 ≈/.test(checklist), false);
    assert.equal(/- \[[ x]\].*leftover landed/.test(checklist), false);
    assert.match(checklist, /NOT FOUND/);
    assert.match(checklist, /This repo change does not create a mint/);
  });

  it('landing hero stays on Path B and does not advertise a fake HELBREATH mint', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const hellStart = html.indexOf('id="hell"');
    const hellEnd = html.indexOf('id="cl-tv"', hellStart);
    const hell = html.slice(hellStart, hellEnd);
    assert.match(hell, new RegExp(PATH_B_MINT));
    assert.equal(hell.includes('HELBREATH'), false);
    assert.equal(hell.includes(PATH_A_MINT), false);
    assert.equal(html.includes(PATH_B_MINT), true);
  });
});

describe('grokbot leftover=0 fixture + leftover-landed GO', () => {
  const leftover0Fixture = path.join(
    __dirname,
    '..',
    '..',
    'ops',
    'tge',
    'fixtures',
    'create-c-leftover-0.plan.json'
  );
  const grokbotPath = path.join(__dirname, '..', '..', 'ops', 'tge', 'LAUNCH-C-GROKBOT.md');

  it('leftover=0 fixture makes assert-create-c.cjs fail', () => {
    const fixture = JSON.parse(fs.readFileSync(leftover0Fixture, 'utf8'));
    assert.equal(fixture.leftover, 0);
    assert.throws(() => checkPlan(fixture), (err) => {
      assert.ok(err instanceof AssertFail);
      assert.match(err.message, /leftover==0/);
      return true;
    });

    const r = spawnSync(process.execPath, [script, '--plan', leftover0Fixture, '--skip-image'], {
      encoding: 'utf8',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ASSERT_FAIL/);
    assert.match(r.stderr, /leftover==0/);
    assert.equal(r.stdout.includes('ASSERT_PASS'), false);
  });

  it('leftover-landed create GO text fails the scanner; NEVER lines pass', () => {
    const hits = leftoverLandedCreateGoHits('- [ ] A782 ≈ **600M** leftover landed');
    assert.ok(hits.length > 0);
    const ok = leftoverLandedCreateGoHits('NEVER leftover landed in A782 at create');
    assert.equal(ok.length, 0);
    assert.doesNotThrow(() => scanPathCDocs());
  });

  it('reusing Path A or Path B mint as HELBREATH is refused', () => {
    for (const mint of FORBIDDEN_MINTS) {
      const bad = defaultPlan();
      bad.mint = mint;
      assert.throws(() => checkPlan(bad), /NEVER reuse/);
    }
  });

  it('PASS prints vault ≈1B / A782=0 / leftover reserved in vault', () => {
    const r = runAssert(defaultPlan());
    assert.equal(r.status, 0, r.stderr || r.stdout);
    for (const line of POST_CREATE_PRINT) {
      assert.equal(r.stdout.includes(line), true, `missing ${line}`);
    }
  });

  it('LAUNCH-C-GROKBOT.md exists and listing points at it', () => {
    const grok = fs.readFileSync(grokbotPath, 'utf8');
    assert.match(grok, /NEVER leftover=0/);
    assert.match(grok, /NEVER leftover landed in A782 at create/);
    assert.match(grok, /NEVER reuse A8fNV2 or 4Sk2 as HELBREATH/);
    assert.match(grok, /MUST run assert-create-c.cjs PASS before any execute/);
    const listing = fs.readFileSync(listingPath, 'utf8');
    assert.match(listing, /LAUNCH-C-GROKBOT\.md/);
  });
});
