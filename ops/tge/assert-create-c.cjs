'use strict';
/**
 * PATH C asserts (HELBREATH — planned, not minted).
 * Refuse --execute if leftover==0 or split wrong.
 * Split lock: bonding 40% | farm 30% | airdrop fail 10% | airdrop list 12% | team 8%
 * leftover param = 60%. Tokens stay in the DBC vault until post-migrate withdrawLeftover.
 * A782 does NOT receive leftover at create. There is no day-0 transfer ix in Meteora DBC.
 * leftover==0 is Path A — refuse. Ticker must be HELBREATH.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DIR = __dirname;
const TOTAL = 1_000_000_000;
const LEFTOVER = 600_000_000;
const CURVE = 400_000_000;
const TICKER = 'HELBREATH';
const NAME = 'Chain Lords — Helbreath';
const BUCKETS = {
  bonding: 400_000_000,
  farming: 300_000_000,
  airdropFailedMintBuyers: 100_000_000,
  airdropList1000: 120_000_000,
  team: 80_000_000,
};
const A782 = 'A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g';
const CREATOR = '65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q';
const SENDER = 'BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh';
const SQUADS_A = '2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy';
const FORBIDDEN_MINTS = [
  'A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ',
  '4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq',
];
const POST_CREATE_PRINT = [
  'POST_CREATE_MUST_PRINT vault ≈1B',
  'POST_CREATE_MUST_PRINT A782=0',
  'POST_CREATE_MUST_PRINT leftover reserved in vault',
];
const GROKBOT_MUST = [
  'NEVER leftover=0',
  'NEVER leftover landed in A782 at create',
  'NEVER publish LIVE mint on landing/listing without RPC',
  'NEVER reuse A8fNV2 or 4Sk2 as HELBREATH',
  'NEVER remint ticker HELL',
  'NEVER ExactOut',
  'NEVER invent airdrop',
  'NEVER buy 50% of supply',
  'NEVER treat DexScreener MC=FDV as circulating',
  'MUST run assert-create-c.cjs PASS before any execute',
  'vault ≈1B, A782=0, leftover reserved in vault',
];

const DAY0_TRUTH =
  'A782 will be 0 HELBREATH until post-migrate withdrawLeftover. leftover stays in the DBC vault. No day-0 transfer instruction exists in Meteora DBC initialize/createPool.';

class AssertFail extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertFail';
  }
}

function defaultPlan() {
  return {
    path: 'C',
    status: 'planned-not-created',
    ticker: TICKER,
    symbol: TICKER,
    name: NAME,
    mint: null,
    pool: null,
    totalTokenSupply: TOTAL,
    leftover: LEFTOVER,
    leftoverReceiver: A782,
    feeClaimer: A782,
    poolCreator: CREATOR,
    payer: SQUADS_A,
    sender: SENDER,
    imageUri:
      'https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-metaplex-1024.png',
    exactOut: false,
    inventAirdrop: false,
    buySupplyPct: 0,
    dexscreenerMcIsCirculating: false,
    day0A782Balance: 0,
    leftoverTiming: 'vault-until-post-migrate-withdrawLeftover',
    forbiddenMints: [...FORBIDDEN_MINTS],
    buckets: { ...BUCKETS },
    teamWallets: [],
  };
}

function planPathFromArgv(argv) {
  const i = argv.indexOf('--plan');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];
  if (process.env.CREATE_C_PLAN) return process.env.CREATE_C_PLAN;
  return path.join(DIR, 'create-c.plan.json');
}

function loadPlan(planFile) {
  if (fs.existsSync(planFile)) {
    return JSON.parse(fs.readFileSync(planFile, 'utf8').replace(/^\uFEFF/, ''));
  }
  return defaultPlan();
}

function checkPlan(plan, opts = {}) {
  const execute = Boolean(opts.execute);
  const leftover = Number(plan.leftover);
  const total = Number(plan.totalTokenSupply);
  const ticker = String(plan.ticker || plan.symbol || '');

  if (ticker !== TICKER) {
    const hellRemint = ticker === 'HELL' || plan.symbol === 'HELL';
    throw new AssertFail(
      hellRemint
        ? 'NEVER remint ticker HELL. ticker/symbol must be HELBREATH.'
        : `ticker/symbol must be ${TICKER}, got ${ticker || '(empty)'}`
    );
  }
  if (plan.symbol && plan.symbol !== TICKER) {
    throw new AssertFail(`symbol must be ${TICKER}, got ${plan.symbol}`);
  }
  if (plan.name && plan.name !== NAME) {
    throw new AssertFail(`name must be ${NAME}, got ${plan.name}`);
  }
  const mint = plan.mint || plan.baseMint || null;
  if (mint && FORBIDDEN_MINTS.includes(String(mint))) {
    throw new AssertFail(
      `NEVER reuse ${mint} as HELBREATH (A8fNV2 Path A / 4Sk2 Path B $HELL)`
    );
  }
  if (mint) {
    throw new AssertFail(
      `Path C has no mint yet. Do not put a placeholder mint in the plan (got ${mint}).`
    );
  }

  if (!Number.isFinite(leftover) || leftover === 0) {
    throw new AssertFail(
      'leftover==0 (or invalid). PATH C forbids leftover=0. Refusing --execute.'
    );
  }
  if (execute && leftover === 0) {
    throw new AssertFail('leftover==0. PATH C refuses --execute.');
  }
  if (leftover !== LEFTOVER) throw new AssertFail(`leftover must be ${LEFTOVER} (60%), got ${leftover}`);
  if (total !== TOTAL) throw new AssertFail(`totalTokenSupply must be ${TOTAL}, got ${total}`);
  if (Math.abs(leftover / total - 0.6) > 1e-9) {
    throw new AssertFail(`leftover/total must be 0.60, got ${leftover / total}`);
  }
  if (total - leftover !== CURVE) throw new AssertFail(`curve share must be ${CURVE} (40%)`);
  if (plan.leftoverReceiver !== A782) throw new AssertFail(`leftoverReceiver must be ${A782}`);
  if (plan.feeClaimer !== A782) throw new AssertFail(`feeClaimer must be ${A782}`);
  if (plan.poolCreator !== CREATOR) throw new AssertFail(`poolCreator must be ${CREATOR}`);
  if (plan.payer !== SQUADS_A) throw new AssertFail(`payer must be ${SQUADS_A}`);
  if (plan.sender && plan.sender !== SENDER) throw new AssertFail(`sender must be ${SENDER}`);
  if (plan.exactOut) throw new AssertFail('NEVER ExactOut — ExactOut is forbidden on Path C');
  if (plan.inventAirdrop || plan.airdropNow) {
    throw new AssertFail('NEVER invent airdrop');
  }
  if (Number(plan.buySupplyPct) === 50 || Number(plan.buyPercent) === 50) {
    throw new AssertFail('NEVER buy 50% of supply');
  }
  if (plan.dexscreenerMcIsCirculating) {
    throw new AssertFail('NEVER treat DexScreener MC=FDV as circulating');
  }

  const b = plan.buckets || {};
  for (const [k, v] of Object.entries(BUCKETS)) {
    if (Number(b[k]) !== v) throw new AssertFail(`buckets.${k} must be ${v}, got ${b[k]}`);
  }
  const off =
    Number(b.farming) +
    Number(b.airdropFailedMintBuyers) +
    Number(b.airdropList1000) +
    Number(b.team);
  if (off !== LEFTOVER) throw new AssertFail(`off-curve buckets sum ${off} != leftover ${LEFTOVER}`);
  if (Number(b.bonding) !== CURVE) throw new AssertFail(`buckets.bonding must be ${CURVE}`);

  if (plan.teamWallets && plan.teamWallets.length) {
    const sum = plan.teamWallets.reduce((a, w) => a + Number(w.amount || 0), 0);
    if (sum !== 80_000_000) throw new AssertFail(`teamWallets amounts must sum 80000000, got ${sum}`);
  }

  return {
    path: 'C',
    ticker: TICKER,
    total,
    leftover,
    curve: CURVE,
    leftoverReceiver: A782,
    buckets: b,
    refuseExecuteIfLeftover0: true,
    zeroExactOutAirdrop: true,
    day0A782Balance: 0,
    day0TransferInstruction: null,
    leftoverTiming: 'vault-until-post-migrate-withdrawLeftover',
    day0Truth: DAY0_TRUTH,
    postCreateMustPrint: POST_CREATE_PRINT,
    executeRefusedIfLeftover0: execute ? 'execute-flag-seen-but-leftover-ok' : 'dry-run',
  };
}

const LANDED_CLAIM =
  /leftover landed|600M already in A782|A782 already has 600M|A782 ≈ \*\*600M\*\*|A782 ≈ 600M leftover landed/i;
const LANDED_PROHIBITION =
  /NEVER|do not|don't|DO NOT|forbid|FORBIDDEN|refuse|not landed|is \*\*not\*\* landed|Do not write|do \*\*not\*\*|NOT landed|Forbidden checkbox|do \*\*not\*\* write|create GO|idiot move/i;

function leftoverLandedCreateGoHits(text) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LANDED_CLAIM.test(line)) continue;
    if (LANDED_PROHIBITION.test(line)) continue;
    hits.push({ line: i + 1, text: line });
  }
  return hits;
}

function pathCDocFiles() {
  return [
    path.join(DIR, 'LAUNCH-C-GROKBOT.md'),
    path.join(DIR, 'CREATE-C-CHECKLIST.md'),
    path.join(DIR, 'create-c.plan.json'),
  ];
}

function scanPathCDocs(extraFiles = []) {
  const launch = path.join(DIR, 'LAUNCH-C-GROKBOT.md');
  if (!fs.existsSync(launch)) {
    throw new AssertFail('LAUNCH-C-GROKBOT.md missing — grokbot gate required');
  }
  const launchText = fs.readFileSync(launch, 'utf8');
  for (const phrase of GROKBOT_MUST) {
    if (!launchText.includes(phrase)) {
      throw new AssertFail(`LAUNCH-C-GROKBOT.md missing kill-switch: ${phrase}`);
    }
  }

  const files = [...pathCDocFiles(), ...extraFiles];
  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new AssertFail(`Path C doc missing: ${file}`);
    }
    const hits = leftoverLandedCreateGoHits(fs.readFileSync(file, 'utf8'));
    if (hits.length) {
      throw new AssertFail(
        `leftover landed as a create GO in ${path.basename(file)}:${hits[0].line} — ${hits[0].text.trim()}`
      );
    }
  }
}

function headContentType(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD', timeout: 15000 }, (res) => {
      resolve({ status: res.statusCode, type: String(res.headers['content-type'] || '') });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HEAD timeout'));
    });
    req.end();
  });
}

async function main(argv = process.argv.slice(2)) {
  const execute = argv.includes('--execute');
  const skipImage = argv.includes('--skip-image') || process.env.CREATE_C_SKIP_IMAGE === '1';
  const planFile = planPathFromArgv(argv);
  const plan = loadPlan(planFile);

  let result;
  try {
    result = checkPlan(plan, { execute });
    scanPathCDocs();
  } catch (e) {
    if (e instanceof AssertFail) {
      console.error('ASSERT_FAIL', e.message);
      process.exit(1);
    }
    throw e;
  }

  console.log('ASSERT_OK', `ticker=${result.ticker}`);
  console.log('ASSERT_OK', `leftover=${result.leftover} (60%) curve=${result.curve} (40%)`);
  console.log(
    'ASSERT_OK',
    `buckets farm=${result.buckets.farming} failBuyers=${result.buckets.airdropFailedMintBuyers} list1000=${result.buckets.airdropList1000} team=${result.buckets.team}`
  );
  console.log('ASSERT_OK', DAY0_TRUTH);

  if (!plan.teamWallets || !plan.teamWallets.length) {
    console.warn(
      'ASSERT_WARN teamWallets missing — create may proceed; team 8% (80M) routing blocked until Martín lista'
    );
  } else {
    console.log('ASSERT_OK', `teamWallets ${plan.teamWallets.length} sum=80M`);
  }

  if (!skipImage) {
    const uri = plan.imageUri;
    if (!uri) {
      console.error('ASSERT_FAIL', 'imageUri missing');
      process.exit(1);
    }
    const { status, type } = await headContentType(uri);
    if (status < 200 || status >= 300) {
      console.error('ASSERT_FAIL', `imageUri HTTP ${status}: ${uri}`);
      process.exit(1);
    }
    if (!/image\/(png|jpeg|webp)/.test(type)) {
      console.error('ASSERT_FAIL', `imageUri content-type not image: ${type}`);
      process.exit(1);
    }
    console.log('ASSERT_OK', `imageUri ${status} ${type}`);
  }

  for (const line of POST_CREATE_PRINT) {
    console.log(line);
  }
  console.log(JSON.stringify(result, null, 2));
  console.log('ASSERT_PASS ready for create dry-run. leftover==0 refuses --execute. A782=0 at create.');
}

module.exports = {
  AssertFail,
  A782,
  TICKER,
  NAME,
  LEFTOVER,
  DAY0_TRUTH,
  FORBIDDEN_MINTS,
  POST_CREATE_PRINT,
  GROKBOT_MUST,
  defaultPlan,
  loadPlan,
  checkPlan,
  leftoverLandedCreateGoHits,
  scanPathCDocs,
  planPathFromArgv,
  main,
};

if (require.main === module) {
  main().catch((e) => {
    console.error('ASSERT_FAIL', String(e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
