import {
  Connection,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  type SimulateTransactionConfig,
  type TransactionInstruction,
} from "@solana/web3.js";
import { withRetry } from "./rpc";

export const MAX_TX_BYTES = 1232;

export async function freshBlockhash(connection: Connection): Promise<string> {
  const { blockhash } = await withRetry(() => connection.getLatestBlockhash("confirmed"));
  return blockhash;
}

export function ixsFromTx(tx: Transaction): TransactionInstruction[] {
  return [...tx.instructions];
}

export function compileV0(opts: {
  payer: PublicKey;
  blockhash: string;
  ixs: TransactionInstruction[];
}): VersionedTransaction {
  const msg = new TransactionMessage({
    payerKey: opts.payer,
    recentBlockhash: opts.blockhash,
    instructions: opts.ixs,
  }).compileToV0Message();
  return new VersionedTransaction(msg);
}

export function txByteSize(vtx: VersionedTransaction): number {
  return vtx.serialize().length;
}

export type SimResult = {
  ok: boolean;
  err: string | null;
  logs: string[];
  units: number | null;
  accounts: Array<{ pubkey: string; lamports: number | null }>;
};

export async function simulateV0(
  connection: Connection,
  vtx: VersionedTransaction,
  extraAccounts: PublicKey[] = []
): Promise<SimResult> {
  const cfg: SimulateTransactionConfig = {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    innerInstructions: true,
    accounts: extraAccounts.length
      ? { encoding: "base64", addresses: extraAccounts.map((p) => p.toBase58()) }
      : undefined,
  };
  const res = await withRetry(() => connection.simulateTransaction(vtx, cfg));
  const err = res.value.err ? JSON.stringify(res.value.err) : null;
  return {
    ok: !res.value.err,
    err,
    logs: res.value.logs ?? [],
    units: res.value.unitsConsumed ?? null,
    accounts: (res.value.accounts ?? []).map((a, i) => ({
      pubkey: extraAccounts[i]?.toBase58() ?? String(i),
      lamports: a?.lamports ?? null,
    })),
  };
}

export function expectedDelta(
  before: number,
  after: number | null | undefined
): string | null {
  if (after == null) return null;
  const d = after - before;
  const sign = d >= 0 ? "+" : "";
  return `${sign}${(d / 1e9).toFixed(6)} SOL`;
}
