'use strict';
/**
 * PATH B asserts. Refuse execute if leftover==0 or split wrong.
 * Split lock: bonding 40% | farm 30% | airdrop fail 10% | airdrop list 12% | team 8%
 * leftover = 60% → A782
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DIR = __dirname;
const TOTAL = 1_000_000_000;
const LEFTOVER = 600_000_000;
const CURVE = 400_000_000;
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

function fail(msg) {
  console.error('ASSERT_FAIL', msg);
  process.exit(1);
}
function ok(msg) {
  console.log('ASSERT_OK', msg);
}

function loadPlan() {
  const p = path.join(DIR, 'create-b.plan.json');
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  }
  return {
    totalTokenSupply: TOTAL,
    leftover: LEFTOVER,
    leftoverReceiver: A782,
    feeClaimer: A782,
    poolCreator: CREATOR,
    payer: SQUADS_A,
    sender: SENDER,
    buckets: BUCKETS,
    imageUri:
      'https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-metaplex-1024.png',
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

async function main() {
  const plan = loadPlan();
  const leftover = Number(plan.leftover);
  const total = Number(plan.totalTokenSupply);

  if (!Number.isFinite(leftover) || leftover === 0) {
    fail('leftover==0 (or invalid). PATH B forbids leftover=0. Refusing --execute.');
  }
  if (leftover !== LEFTOVER) fail(`leftover must be ${LEFTOVER} (60%), got ${leftover}`);
  if (total !== TOTAL) fail(`totalTokenSupply must be ${TOTAL}, got ${total}`);
  if (Math.abs(leftover / total - 0.6) > 1e-9) fail(`leftover/total must be 0.60, got ${leftover / total}`);
  if (total - leftover !== CURVE) fail(`curve share must be ${CURVE} (40%)`);
  if (plan.leftoverReceiver !== A782) fail(`leftoverReceiver must be ${A782}`);
  if (plan.feeClaimer !== A782) fail(`feeClaimer must be ${A782}`);
  if (plan.poolCreator !== CREATOR) fail(`poolCreator must be ${CREATOR}`);
  if (plan.payer !== SQUADS_A) fail(`payer must be ${SQUADS_A}`);
  if (plan.sender && plan.sender !== SENDER) fail(`sender must be ${SENDER}`);

  const b = plan.buckets || {};
  for (const [k, v] of Object.entries(BUCKETS)) {
    if (Number(b[k]) !== v) fail(`buckets.${k} must be ${v}, got ${b[k]}`);
  }
  const off =
    Number(b.farming) +
    Number(b.airdropFailedMintBuyers) +
    Number(b.airdropList1000) +
    Number(b.team);
  if (off !== LEFTOVER) fail(`off-curve buckets sum ${off} != leftover ${LEFTOVER}`);
  if (Number(b.bonding) !== CURVE) fail(`buckets.bonding must be ${CURVE}`);

  ok(`leftover=${leftover} (60%) curve=${CURVE} (40%)`);
  ok(
    `buckets farm=${b.farming} failBuyers=${b.airdropFailedMintBuyers} list1000=${b.airdropList1000} team=${b.team}`
  );

  const uri = plan.imageUri;
  if (!uri) fail('imageUri missing');
  const { status, type } = await headContentType(uri);
  if (status < 200 || status >= 300) fail(`imageUri HTTP ${status}: ${uri}`);
  if (!/image\/(png|jpeg|webp)/.test(type)) fail(`imageUri content-type not image: ${type}`);
  ok(`imageUri ${status} ${type}`);

  if (!plan.teamWallets || !plan.teamWallets.length) {
    console.warn(
      'ASSERT_WARN teamWallets missing — create may proceed; team 8% (80M) routing blocked until Martín lista'
    );
  } else {
    const sum = plan.teamWallets.reduce((a, w) => a + Number(w.amount || 0), 0);
    if (sum !== 80_000_000) fail(`teamWallets amounts must sum 80000000, got ${sum}`);
    ok(`teamWallets ${plan.teamWallets.length} sum=80M`);
  }

  console.log(
    JSON.stringify(
      {
        path: 'B',
        total,
        leftover,
        curve: CURVE,
        buckets: b,
        refuseExecuteIfLeftover0: true,
        zeroExactOutAirdrop: true,
      },
      null,
      2
    )
  );
  console.log('ASSERT_PASS ready for create dry-run / --execute gate');
}

main().catch((e) => fail(String(e && e.stack ? e.stack : e)));
