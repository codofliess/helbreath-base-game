import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { CLOSE_BATCH_SIZE, DEST } from "../constants";
import type { TokenRow } from "../tokenAccounts";

export function closeAccountIxs(
  accounts: TokenRow[],
  destination: PublicKey = DEST
): TransactionInstruction[] {
  return accounts.map((a) =>
    createCloseAccountInstruction(
      a.pubkey,
      destination,
      a.owner,
      [],
      a.programId ?? TOKEN_PROGRAM_ID
    )
  );
}

export function batchAccounts<T>(items: T[], size = CLOSE_BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
