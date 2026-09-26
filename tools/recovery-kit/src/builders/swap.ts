import { Connection, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import {
  createCloseAccountInstruction,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";
import { A8FN_POOL, BTVN, BTVN_A8FN_ATA, DEST, SLIPPAGE_BPS_DEFAULT } from "../constants";
import { unwrapVirtualPool } from "../live";
import { ixsFromTx } from "../tx";
import { withRetry } from "../rpc";

export async function btvnSellIxs(
  connection: Connection,
  opts: { owner: PublicKey; payer: PublicKey; amountIn: BN; slippageBps?: number }
): Promise<{ ixs: TransactionInstruction[]; minOut: BN; expectedOut: BN }> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const poolPk = A8FN_POOL;
  const poolRaw = await withRetry(() => client.state.getPool(poolPk));
  if (!poolRaw) throw new Error("A8fN DBC pool missing");
  const pool = unwrapVirtualPool(poolRaw);
  const cfg = await withRetry(() => client.state.getPoolConfig(pool.config));
  if (!cfg) throw new Error("A8fN DBC config missing");
  const slot = await withRetry(() => connection.getSlot("confirmed"));
  const quote = client.pool.swapQuote({
    virtualPool: poolRaw as never,
    config: cfg,
    swapBaseForQuote: true,
    amountIn: opts.amountIn,
    slippageBps: opts.slippageBps ?? SLIPPAGE_BPS_DEFAULT,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint: new BN(slot),
  });
  const minOut = quote.minimumAmountOut ?? quote.outputAmount;
  const tx = await client.pool.swap({
    owner: opts.owner,
    payer: opts.payer,
    pool: poolPk,
    amountIn: opts.amountIn,
    minimumAmountOut: minOut,
    swapBaseForQuote: true,
    referralTokenAccount: null,
  });
  const ixs = ixsFromTx(tx);
  ixs.push(
    createCloseAccountInstruction(BTVN_A8FN_ATA, DEST, BTVN, [], TOKEN_PROGRAM_ID)
  );
  return {
    ixs,
    minOut,
    expectedOut: quote.outputAmount ?? minOut,
  };
}

export { NATIVE_MINT };
