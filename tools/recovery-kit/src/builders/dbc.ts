import { Connection, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import BN from "bn.js";
import { DBC_POOLS, DEST, MAX_U64 } from "../constants";
import { ixsFromTx } from "../tx";

export async function dbcPartnerClaimIxs(
  connection: Connection,
  opts: { feeClaimer: PublicKey; payer: PublicKey; receiver?: PublicKey }
): Promise<{ label: string; pool: PublicKey; ixs: TransactionInstruction[] }[]> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const max = new BN(MAX_U64);
  const out = [];
  for (const p of DBC_POOLS) {
    const tx = await client.partner.claimPartnerTradingFeeToReceiver({
      feeClaimer: opts.feeClaimer,
      payer: opts.payer,
      pool: p.pool,
      maxBaseAmount: max,
      maxQuoteAmount: max,
      receiver: opts.receiver ?? DEST,
    });
    out.push({ label: p.label, pool: p.pool, ixs: ixsFromTx(tx) });
  }
  return out;
}

export async function dbcCreatorClaimIxs(
  connection: Connection,
  opts: { creator: PublicKey; payer: PublicKey; receiver?: PublicKey }
): Promise<{ label: string; pool: PublicKey; ixs: TransactionInstruction[] }[]> {
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const max = new BN(MAX_U64);
  const out = [];
  for (const p of DBC_POOLS) {
    const tx = await client.creator.claimCreatorTradingFeeToReceiver({
      creator: opts.creator,
      payer: opts.payer,
      pool: p.pool,
      maxBaseAmount: max,
      maxQuoteAmount: max,
      receiver: opts.receiver ?? DEST,
    });
    out.push({ label: p.label, pool: p.pool, ixs: ixsFromTx(tx) });
  }
  return out;
}
