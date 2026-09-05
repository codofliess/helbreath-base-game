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
    day0A782Balance: 0,
    leftoverTiming: 'vault-until-post-migrate-withdrawLeftover',
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
    throw new AssertFail(`ticker/symbol must be ${TICKER}, got ${ticker || '(empty)'}`);
  }
  if (plan.symbol && plan.symbol !== TICKER) {
    throw new AssertFail(`symbol must be ${TICKER}, got ${plan.symbol}`);
  }
  if (plan.name && plan.name !== NAME) {
    throw new AssertFail(`name must be ${NAME}, got ${plan.name}`);
  }
  if (plan.mint) {
    throw new AssertFail(
      `Path C has no mint yet. Do not put a placeholder mint in the plan (got ${plan.mint}).`
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
  if (plan.exactOut) throw new AssertFail('ExactOut is forbidden on Path C');

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
    executeRefusedIfLeftover0: execute ? 'execute-flag-seen-but-leftover-ok' : 'dry-run',
  };
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
  defaultPlan,
  loadPlan,
  checkPlan,
  planPathFromArgv,
  main,
};

if (require.main === module) {
  main().catch((e) => {
    console.error('ASSERT_FAIL', String(e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
