/**
 * Builds and simulates every recovery transaction against mainnet.
 * sigVerify=false. Never sends. Never reads keys or .env.
 *
 *   npm run dry-run
 */
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import {
  BTVN,
  CREATOR,
  DEFAULT_RPC,
  DEST,
  FUND_CREATOR_LAMPORTS,
  MEMBER_2A4B,
  VAULT,
} from "../src/constants";
import { createConnection, lamportsToSol, withRetry } from "../src/rpc";
import { fetchLive } from "../src/live";
import { compileV0, freshBlockhash, simulateV0, expectedDelta, txByteSize } from "../src/tx";
import {
  buildVaultInnerGroups,
  packVaultBundles,
  approveIx,
  executeIxs,
  configSetRentCollectorIxs,
  configExecuteIx,
  cancelProposalIx,
  rejectProposalIx,
  closeLegacyTxIxs,
  nextTxIndex,
  type VaultBundle,
} from "../src/builders/squads";
import { dbcCreatorClaimIxs } from "../src/builders/dbc";
import { batchAccounts, closeAccountIxs } from "../src/builders/rent";
import { btvnSellIxs } from "../src/builders/swap";

const lines: string[] = [];
function log(s: string) {
  console.log(s);
  lines.push(s);
}

async function simNamed(
  connection: Connection,
  name: string,
  feePayer: PublicKey,
  ixs: Parameters<typeof compileV0>[0]["ixs"],
  extra: PublicKey[]
) {
  const blockhash = await freshBlockhash(connection);
  const vtx = compileV0({ payer: feePayer, blockhash, ixs });
  const size = txByteSize(vtx);
  log(`\n=== ${name} ===`);
  log(`feePayer=${feePayer.toBase58()} ixs=${ixs.length} bytes=${size}`);
  if (size > 1232) log("WARN: serialized tx exceeds 1232 bytes");
  const destAi = await withRetry(() => connection.getAccountInfo(DEST));
  const destBefore = destAi?.lamports ?? 0;
  const sim = await simulateV0(connection, vtx, extra);
  log(`ok=${sim.ok} units=${sim.units} err=${sim.err ?? "null"}`);
  const destAfter = sim.accounts.find((a) => a.pubkey === DEST.toBase58())?.lamports ?? null;
  log(`dest SOL delta: ${expectedDelta(destBefore, destAfter) ?? "n/a"}`);
  if (!sim.ok) {
    log("logs tail:");
    for (const l of sim.logs.slice(-15)) log("  " + l);
  }
  return sim;
}

async function main() {
  const rpcArg = process.argv.find((a) => a.startsWith("--rpc="))?.slice(6);
  const rpc = rpcArg || DEFAULT_RPC;
  log(`RPC ${rpc}`);
  const connection = createConnection(rpc);
  log("Fetching live snapshot…");
  const live = await fetchLive(connection);
  log(`vault ${lamportsToSol(live.vaultLamports)} dest ${lamportsToSol(live.destLamports)}`);
  log(`squads txIndex=${live.squads.txIndex} threshold=${live.squads.threshold} rentCollector=${live.squads.rentCollector?.toBase58() ?? "null"}`);
  log(`configAuthority=${live.squads.configAuthority.toBase58()}`);
  for (const r of live.dbc) {
    log(
      `DBC ${r.label} pool=${r.pool.toBase58()} config=${r.config.toBase58()} feeClaimer=${r.feeClaimer.toBase58()} creator=${r.creator.toBase58()} partnerQuote=${r.partnerQuote} creatorQuote=${r.creatorQuote}`
    );
  }
  if (live.damm) {
    log(
      `DAMM pool=${live.damm.pool.toBase58()} nftAta=${live.damm.positionNftAccount.toBase58()} feeA=${live.damm.feeA} feeB=${live.damm.feeB}`
    );
  } else {
    log("DAMM: could not fetch position/pool");
  }

  const groups = await buildVaultInnerGroups(connection, live.damm, live.vaultLamports, live.rentExemptMin);
  for (const g of groups) log(`inner group: ${g.label} (${g.ixs.length} ixs)`);
  let bundles: VaultBundle[] = [];
  try {
    bundles = await packVaultBundles(connection, MEMBER_2A4B, groups);
    log(`vault bundles: ${bundles.length}${bundles[0]?.splitReason ? " — " + bundles[0].splitReason : ""}`);
  } catch (e) {
    log(`vault pack failed: ${e instanceof Error ? e.message : e}`);
    bundles = [];
    for (const g of groups) {
      log(` simulating inner only: ${g.label}`);
      await simNamed(connection, `inner ${g.label}`, VAULT, g.ixs, [DEST, VAULT]);
    }
  }
  for (const b of bundles) {
    log(` bundle index ${b.index} memo=${b.memo} innerIxs=${b.innerIxs.length}`);
    await simNamed(connection, `squads vaultTransactionCreate ${b.index}`, MEMBER_2A4B, b.createIxs, [DEST, VAULT, MEMBER_2A4B]);
    await simNamed(connection, `squads proposalCreate ${b.index}`, MEMBER_2A4B, b.proposeIxs, [MEMBER_2A4B]);
    await simNamed(connection, `inner vault message ${b.index} (sigVerify=false, payer=vault)`, VAULT, b.innerIxs, [
      DEST,
      VAULT,
    ]);
    await simNamed(connection, `approve ${b.index}`, MEMBER_2A4B, [approveIx(b.index, MEMBER_2A4B)], [MEMBER_2A4B]);
    try {
      const ex = await executeIxs(connection, b.index, MEMBER_2A4B);
      await simNamed(connection, `execute ${b.index} (likely fail until approved on-chain)`, MEMBER_2A4B, ex, [
        MEMBER_2A4B,
        VAULT,
        DEST,
      ]);
    } catch (e) {
      log(`execute build failed (expected if tx account does not exist yet): ${e instanceof Error ? e.message : e}`);
    }
  }

  const cfgIdx = await nextTxIndex(connection);
  await simNamed(
    connection,
    "config set rentCollector (next index; conflicts on-chain until vault txs land)",
    MEMBER_2A4B,
    configSetRentCollectorIxs({ index: cfgIdx, creator: MEMBER_2A4B, newCollector: DEST }),
    [MEMBER_2A4B, DEST]
  );
  await simNamed(connection, "cancel proposal 1", MEMBER_2A4B, [cancelProposalIx(1n, MEMBER_2A4B)], [MEMBER_2A4B]);
  await simNamed(connection, "reject proposal 1", MEMBER_2A4B, [rejectProposalIx(1n, MEMBER_2A4B)], [MEMBER_2A4B]);
  await simNamed(connection, "close vault tx 1+2 (needs rentCollector)", MEMBER_2A4B, closeLegacyTxIxs(DEST), [
    MEMBER_2A4B,
    DEST,
  ]);
  await simNamed(connection, "config execute (needs approved config tx)", MEMBER_2A4B, [configExecuteIx(cfgIdx, MEMBER_2A4B)], [
    MEMBER_2A4B,
  ]);

  const creatorGroups = await dbcCreatorClaimIxs(connection, {
    creator: CREATOR,
    payer: DEST,
    receiver: DEST,
  });
  await simNamed(connection, "fund 0.001 to 65Gh", DEST, [
    SystemProgram.transfer({ fromPubkey: DEST, toPubkey: CREATOR, lamports: FUND_CREATOR_LAMPORTS }),
  ], [DEST, CREATOR]);
  await simNamed(
    connection,
    "creator claims (feePayer 2a4b, signer 65Gh)",
    DEST,
    creatorGroups.flatMap((g) => g.ixs),
    [DEST, CREATOR]
  );

  for (const [label, row] of Object.entries(live.rentByOwner)) {
    log(`rent ${label}: empty=${row.empty.length} frozen=${row.skippedFrozen.length} nonzero=${row.skippedBalanced.length}`);
    const batches = batchAccounts(row.empty);
    let i = 0;
    for (const batch of batches) {
      const owner = row.empty[0]?.owner;
      if (!owner) continue;
      const feePayer = row.lamports > 50_000 ? owner : DEST;
      await simNamed(connection, `close ${label} batch ${++i}`, feePayer, closeAccountIxs(batch), [feePayer, DEST, owner]);
    }
  }

  if (live.btvnA8fnRaw > 0n) {
    try {
      const built = await btvnSellIxs(connection, {
        owner: BTVN,
        payer: DEST,
        amountIn: new BN(live.btvnA8fnRaw.toString()),
        slippageBps: 150,
      });
      log(`BTvN quote expectedOut=${built.expectedOut.toString()} minOut=${built.minOut.toString()}`);
      await simNamed(connection, "optional BTvN DBC sell + close (feePayer 2a4b)", DEST, built.ixs, [
        BTVN,
        DEST,
      ]);
    } catch (e) {
      log(`BTvN swap build failed: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    log("BTvN A8fN balance 0 — skip swap");
  }

  log("\nDry-run finished. No transactions were sent.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
