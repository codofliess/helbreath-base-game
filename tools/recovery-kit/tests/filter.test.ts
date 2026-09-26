import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { isCloseableEmpty, isFrozen, type TokenRow } from "../src/tokenAccounts";
import { batchAccounts } from "../src/builders/rent";
import { DEST, MEMBER_6SHB, short } from "../src/constants";

function row(partial: Partial<TokenRow> & { amount: bigint; state: string }): TokenRow {
  return {
    pubkey: new PublicKey("C9gjpdRUzfo1fGFMMTGZq65TW25XQAvqH9gb2jvajKX3"),
    mint: new PublicKey("4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq"),
    owner: DEST,
    decimals: 9,
    uiAmount: "0",
    lamports: 1_488_440,
    programId: TOKEN_PROGRAM_ID,
    ...partial,
  };
}

describe("empty token account filter", () => {
  it("closes only 0-balance non-frozen accounts", () => {
    const empty = row({ amount: 0n, state: "initialized" });
    const frozen = row({
      amount: 1n,
      state: "frozen",
      pubkey: new PublicKey("CxF2admxMusQvJ8w9MF7wYGMg2hi2LgYtVYwQ6Co4AC1"),
    });
    const dust = row({ amount: 2n, state: "initialized" });
    expect(isCloseableEmpty(empty)).toBe(true);
    expect(isCloseableEmpty(frozen)).toBe(false);
    expect(isFrozen(frozen)).toBe(true);
    expect(isCloseableEmpty(dust)).toBe(false);
  });

  it("batches closes", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    expect(batchAccounts(items, 8)).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7],
      [8, 9],
    ]);
  });

  it("never truncates destination", () => {
    expect(DEST.toBase58()).toBe("2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy");
    expect(MEMBER_6SHB.toBase58()).toBe("6shBsBCuUZP7k7Xs81F8qHvidnGApG9KHvqwzGGHtYbA");
    expect(short(DEST)).toBe("2a4b…djyy");
  });
});
