'use strict';
/**
 * PATH RH asserts. Refuse execute if treasury missing, tax out of range,
 * seed != 40%, or docs claim $50 = 50% / Robinhood listing / leftover at A782.
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const TOTAL = 1_000_000_000;
const TREASURY = 600_000_000;
const SEED = 400_000_000;
const TAX = 500;
const MAX_TAX = 1_000;

function fail(msg) {
  console.error('ASSERT_FAIL', msg);
  process.exit(1);
}
function ok(msg) {
  console.log('ASSERT_OK', msg);
}

function loadPlan() {
  const p = path.join(DIR, 'create-rh.plan.json');
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}

function main() {
  const plan = loadPlan();
  if (plan.path !== 'RH') fail('path must be RH');
  if (plan.chainId !== 4663) fail('chainId must be 4663 (Robinhood Chain mainnet)');
  if (plan.symbol !== 'HELBREATH') fail('symbol must be HELBREATH');
  if (Number(plan.totalTokenSupply) !== TOTAL) fail('total must be 1B');
  if (Number(plan.treasuryShare) !== TREASURY) fail('treasuryShare must be 600M (60%)');
  if (Number(plan.seedShare) !== SEED) fail('seedShare must be 400M (40%)');
  if (Number(plan.transferTaxBps) !== TAX) fail(`transferTaxBps must be ${TAX}`);
  if (Number(plan.maxTaxBps) !== MAX_TAX) fail(`maxTaxBps must be ${MAX_TAX}`);
  if (Number(plan.firstBuyUsd) !== 50) fail('firstBuyUsd must be 50');
  if (plan.firstBuyIsNotPercentOfSupply !== true) fail('first buy is NOT 50% of supply');
  if (Number(plan.treasuryShare) + Number(plan.seedShare) !== TOTAL) fail('60+40 must be 1B');

  if (!plan.never.some((s) => /50% supply/.test(s))) {
    fail('plan.never must forbid "$50 buy = 50% supply"');
  }

  const execute = process.argv.includes('--execute');
  if (execute) {
    fail('--execute refused here. No keys in git. Deploy from a funded RH wallet after treasury is a real EOA.');
  }
  if (!plan.treasury) {
    console.warn('ASSERT_WARN treasury is null — set Martín RH EOA before deploy. Contract will not be created in this PR.');
  }

  const checklist = fs.readFileSync(path.join(DIR, 'CREATE-RH-CHECKLIST.md'), 'utf8');
  if (/leftover landed in A782 at create/i.test(checklist)) fail('checklist claims leftover at A782');
  if (/listed on Robinhood/i.test(checklist) && !/NOT listed on Robinhood/i.test(checklist)) {
    fail('checklist must say NOT listed on Robinhood brokerage');
  }

  ok(`RH HELBREATH 1B · treasury ${TREASURY} · seed ${SEED} · tax ${TAX} bps · firstBuy $${plan.firstBuyUsd}`);
  ok('day-0: treasury holds 100% at mint, then keeps 600M after seeding 400M');
  ok('$50 first swap ≠ allocation. RH Chain ≠ Robinhood listing.');
  console.log(JSON.stringify({ path: 'RH', refuseExecute: true, treasuryDay0: TREASURY, seed: SEED, taxBps: TAX }, null, 2));
  console.log('ASSERT_PASS ready for testnet dry-run only (no --execute)');
}

main();
