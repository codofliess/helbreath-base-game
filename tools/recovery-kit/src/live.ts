import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { CpAmm, getUnClaimLpFee } from "@meteora-ag/cp-amm-sdk";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import {
  BTVN,
  BTVN_A8FN_ATA,
  DAMM_POSITION,
  DBC_POOLS,
  DEST,
  MULTISIG,
  RENT_OWNERS,
  SQUADS_TX1,
  SQUADS_TX2,
  VAULT,
} from "./constants";
import { withRetry } from "./rpc";
import type { TokenRow } from "./tokenAccounts";
import { isCloseableEmpty, isFrozen } from "./tokenAccounts";

export function unwrapVirtualPool(p: unknown): {
  config: PublicKey;
  creator: PublicKey;
  [k: string]: unknown;
} {
  const o = p as { poolState?: Record<string, unknown>; config?: PublicKey; creator?: PublicKey };
  const inner = (o.poolState ?? o) as { config: PublicKey; creator: PublicKey };
  return inner;
}

export type DbcFeeRow = {
  label: string;
  pool: PublicKey;
  config: PublicKey;
  feeClaimer: PublicKey;
  leftoverReceiver: PublicKey;
  creator: PublicKey;
  partnerQuote: bigint;
  partnerBase: bigint;
  creatorQuote: bigint;
  creatorBase: bigint;
};

export type DammLive = {
  pool: PublicKey;
  positionNftAccount: PublicKey;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAFlag: number;
  tokenBFlag: number;
  feeA: bigint;
  feeB: bigint;
  collectFeeMode: number;
};

export type SquadsLive = {
  threshold: number;
  txIndex: bigint;
  staleIndex: bigint;
  rentCollector: PublicKey | null;
  configAuthority: PublicKey;
  members: PublicKey[];
  tx1Lamports: number;
  tx2Lamports: number;
  vaultLamports: number;
};

export type LiveSnapshot = {
  dbc: DbcFeeRow[];
  damm: DammLive | null;
  squads: SquadsLive;
  destLamports: number;
  vaultLamports: number;
  creatorLamports: number;
  btvnLamports: number;
  btvnA8fnRaw: bigint;
  rentByOwner: Record<
    string,
    { lamports: number; empty: TokenRow[]; skippedFrozen: TokenRow[]; skippedBalanced: TokenRow[] }
  >;
  rentExemptMin: number;
};

async function parsedTokenAccounts(connection: Connection, owner: PublicKey): Promise<TokenRow[]> {
  const rows: TokenRow[] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const res = await withRetry(() =>
      connection.getParsedTokenAccountsByOwner(owner, { programId })
    );
    for (const t of res.value) {
      const info = t.account.data.parsed.info;
      rows.push({
        pubkey: t.pubkey,
        mint: new PublicKey(info.mint),
        owner: new PublicKey(info.owner),
        amount: BigInt(info.tokenAmount.amount),
        decimals: Number(info.tokenAmount.decimals),
        uiAmount: info.tokenAmount.uiAmountString ?? "0",
        state: info.state,
        lamports: t.account.lamports,
        programId,
      });
    }
  }
  return rows;
}

export async function fetchLive(connection: Connection): Promise<LiveSnapshot> {
  const dbc = DynamicBondingCurveClient.create(connection, "confirmed");
  const amm = new CpAmm(connection);

  const dbcRows: DbcFeeRow[] = [];
  for (const p of DBC_POOLS) {
    const metrics = await withRetry(() => dbc.state.getPoolFeeMetrics(p.pool));
    const poolRaw = await withRetry(() => dbc.state.getPool(p.pool));
    if (!poolRaw) throw new Error(`DBC pool missing: ${p.pool.toBase58()}`);
    const pool = unwrapVirtualPool(poolRaw);
    const cfgPk = pool.config;
    const cfg = await withRetry(() => dbc.state.getPoolConfig(cfgPk));
    if (!cfg) throw new Error(`DBC config missing for ${p.label}`);
    dbcRows.push({
      label: p.label,
      pool: p.pool,
      config: cfgPk,
      feeClaimer: cfg.feeClaimer,
      leftoverReceiver: cfg.leftoverReceiver,
      creator: pool.creator,
      partnerQuote: BigInt(metrics.current.partnerQuoteFee.toString()),
      partnerBase: BigInt(metrics.current.partnerBaseFee.toString()),
      creatorQuote: BigInt(metrics.current.creatorQuoteFee.toString()),
      creatorBase: BigInt(metrics.current.creatorBaseFee.toString()),
    });
    await new Promise((r) => setTimeout(r, 250));
  }

  let damm: DammLive | null = null;
  try {
    const pos = await withRetry(() => amm.fetchPositionState(DAMM_POSITION));
    const pool = await withRetry(() => amm.fetchPoolState(pos.pool));
    const unclaimed = getUnClaimLpFee(pool, pos);
    const nftAccounts = await withRetry(() =>
      connection.getParsedTokenAccountsByOwner(VAULT, { programId: TOKEN_2022_PROGRAM_ID })
    );
    const nftMintStr =
      (pos as { nftMint?: PublicKey }).nftMint?.toBase58?.() ??
      "8YUznLmJ8dHmhGbJ9TdYSYCg51pP4Rbwm5r2kDNXdVx2";
    const nftAcct = nftAccounts.value.find((t) => t.account.data.parsed.info.mint === nftMintStr);
    damm = {
      pool: pos.pool,
      positionNftAccount: nftAcct
        ? nftAcct.pubkey
        : new PublicKey("CKtnF2Pz7mUnezZmAXvwgNP7ytMyfhF8gkPMze7yUJc9"),
      tokenAMint: pool.tokenAMint,
      tokenBMint: pool.tokenBMint,
      tokenAVault: pool.tokenAVault,
      tokenBVault: pool.tokenBVault,
      tokenAFlag: Number(pool.tokenAFlag ?? 0),
      tokenBFlag: Number(pool.tokenBFlag ?? 0),
      feeA: BigInt((unclaimed?.feeTokenA ?? new BN(0)).toString()),
      feeB: BigInt((unclaimed?.feeTokenB ?? new BN(0)).toString()),
      collectFeeMode: Number(pool.collectFeeMode ?? 0),
    };
  } catch (e) {
    console.warn("DAMM live fetch failed", e);
  }

  const ms = await withRetry(() =>
    multisig.accounts.Multisig.fromAccountAddress(connection, MULTISIG)
  );
  const [tx1, tx2, vaultAi, destAi, creatorAi, btvnAi, rentExemptMin] = await Promise.all([
    withRetry(() => connection.getAccountInfo(SQUADS_TX1)),
    withRetry(() => connection.getAccountInfo(SQUADS_TX2)),
    withRetry(() => connection.getAccountInfo(VAULT)),
    withRetry(() => connection.getAccountInfo(DEST)),
    withRetry(() => connection.getAccountInfo(new PublicKey("65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q"))),
    withRetry(() => connection.getAccountInfo(BTVN)),
    withRetry(() => connection.getMinimumBalanceForRentExemption(0)),
  ]);

  const rentByOwner: LiveSnapshot["rentByOwner"] = {};
  for (const o of RENT_OWNERS) {
    const tokens = await parsedTokenAccounts(connection, o.pubkey);
    const ai = await withRetry(() => connection.getAccountInfo(o.pubkey));
    rentByOwner[o.label] = {
      lamports: ai?.lamports ?? 0,
      empty: tokens.filter(isCloseableEmpty),
      skippedFrozen: tokens.filter(isFrozen),
      skippedBalanced: tokens.filter((t) => t.amount > 0n && !isFrozen(t)),
    };
    await new Promise((r) => setTimeout(r, 200));
  }

  let btvnA8fnRaw = 0n;
  try {
    const bal = await withRetry(() => connection.getTokenAccountBalance(BTVN_A8FN_ATA));
    btvnA8fnRaw = BigInt(bal.value.amount);
  } catch {
    btvnA8fnRaw = 0n;
  }

  return {
    dbc: dbcRows,
    damm,
    squads: {
      threshold: ms.threshold,
      txIndex: BigInt(ms.transactionIndex.toString()),
      staleIndex: BigInt(ms.staleTransactionIndex.toString()),
      rentCollector: ms.rentCollector ?? null,
      configAuthority: ms.configAuthority,
      members: ms.members.map((m) => m.key),
      tx1Lamports: tx1?.lamports ?? 0,
      tx2Lamports: tx2?.lamports ?? 0,
      vaultLamports: vaultAi?.lamports ?? 0,
    },
    destLamports: destAi?.lamports ?? 0,
    vaultLamports: vaultAi?.lamports ?? 0,
    creatorLamports: creatorAi?.lamports ?? 0,
    btvnLamports: btvnAi?.lamports ?? 0,
    btvnA8fnRaw,
    rentByOwner,
    rentExemptMin,
  };
}

export function solFromLamports(n: bigint | number): number {
  return Number(n) / LAMPORTS_PER_SOL;
}
