import { Connection, type Commitment } from "@solana/web3.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /429|403|Access forbidden|rate.?limit|Too Many|fetch failed|ECONNRESET|ETIMEDOUT|503|502/i.test(msg);
      if (!retryable || i === tries - 1) throw e;
      await sleep(1500 * (i + 1) * (i + 1));
    }
  }
  throw last;
}

export function createConnection(rpcUrl: string, commitment: Commitment = "confirmed"): Connection {
  return new Connection(rpcUrl, {
    commitment,
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false,
  });
}

export function lamportsToSol(lamports: number | bigint | string): string {
  const n = typeof lamports === "bigint" ? Number(lamports) : Number(lamports);
  return (n / 1e9).toFixed(9).replace(/\.?0+$/, "") + " SOL";
}

export function uiSol(lamports: number | bigint): string {
  return (Number(lamports) / 1e9).toFixed(6);
}
