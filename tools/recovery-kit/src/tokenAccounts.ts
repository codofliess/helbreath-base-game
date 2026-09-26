import { PublicKey } from "@solana/web3.js";

export type TokenRow = {
  pubkey: PublicKey;
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
  uiAmount: string;
  state: string;
  lamports: number;
  programId: PublicKey;
};

export function isCloseableEmpty(row: TokenRow): boolean {
  return row.amount === 0n && row.state !== "frozen";
}

export function isFrozen(row: TokenRow): boolean {
  return row.state === "frozen";
}
