/**
 * All addresses resolved from the uploaded audit artifacts
 * (wallets.mjs / wallets.json / sq.mjs / dbc.mjs / damm.mjs / RECOVERY_AUDIT.md).
 * Never guess or truncate.
 */
import { PublicKey } from "@solana/web3.js";

export const DEST = new PublicKey("2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy");
export const OWNER = DEST;

export const VAULT = new PublicKey("A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g");
export const MULTISIG = new PublicKey("GNaYSwoA4TuGJVgdD8Tq5Xae7Tn6tztB5QFuojFnQ6vy");

export const MEMBER_2A4B = DEST;
export const MEMBER_62TB = new PublicKey("62TB1RLxWeSYicULGAboYT97aEiuMfrAWhK3a8dwUUHk");
export const MEMBER_6SHB = new PublicKey("6shBsBCuUZP7k7Xs81F8qHvidnGApG9KHvqwzGGHtYbA");

export const CREATOR = new PublicKey("65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q");
export const BTVN = new PublicKey("BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh");
export const WALLET_97LY = new PublicKey("97Lyu9zYzxRiivnv67BEJL7wwXATeYQqcbRgk62CXVpH");
export const WALLET_EW4O = new PublicKey("EW4oLpoTaWzujDbA3JiJLzAs7xd3LHtdSVRUoq1MWjYo");

export const RENT_OWNERS: { label: string; pubkey: PublicKey }[] = [
  { label: "2a4b", pubkey: OWNER },
  { label: "6shB", pubkey: MEMBER_6SHB },
  { label: "97Ly", pubkey: WALLET_97LY },
  { label: "EW4o", pubkey: WALLET_EW4O },
];

/** DBC pools from RECOVERY_AUDIT.md */
export const DBC_POOLS = [
  {
    label: "A8fN",
    mint: new PublicKey("A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ"),
    pool: new PublicKey("4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q"),
  },
  {
    label: "4Sk2",
    mint: new PublicKey("4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq"),
    pool: new PublicKey("ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx"),
  },
  {
    label: "3gZV",
    mint: new PublicKey("3gZVXSneTzrWLQ9E93NWBYdvEStx8Tm9jHwyD6MgYQmP"),
    pool: new PublicKey("7jeKLhW7VEgCjnrR97XmXBEovMygCf8dZ1jb2RncM1dj"),
  },
] as const;

export const DAMM_POSITION = new PublicKey("8LZ7mXtTkQEJLWdD8e5iyyK2U7Fyj4GgjjKEnE6CrSH9");
export const DAMM_POSITION_NFT = new PublicKey("8YUznLmJ8dHmhGbJ9TdYSYCg51pP4Rbwm5r2kDNXdVx2");
/** Token-2022 ATA of the position NFT, owned by vault A782 (wallets.json). */
export const DAMM_POSITION_NFT_ACCOUNT = new PublicKey(
  "CKtnF2Pz7mUnezZmAXvwgNP7ytMyfhF8gkPMze7yUJc9"
);
export const DAMM_PROGRAM = new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG");

/** Squads tx accounts from RECOVERY_AUDIT.md */
export const SQUADS_TX1 = new PublicKey("5uDyEurbpTqMrT4Q5XLkkhnNmMsoR5HdDWeGiZnhMNG3");
export const SQUADS_TX2 = new PublicKey("F3Wqw8cBc9TmMYMBoBrktGwgeaStRimbTh6XkV2djJu6");
export const SQUADS_TX_INDICES_TO_CLOSE = [1n, 2n] as const;

export const BTVN_A8FN_ATA = new PublicKey("eGWSfKZQLsbcEVfCv6PmTdiLfNQp4z7ZE8VoBMQ2A3j");
export const A8FN_MINT = DBC_POOLS[0].mint;
export const A8FN_POOL = DBC_POOLS[0].pool;
export const BTVN_A8FN_RAW = "198318988032010";

export const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
export const VAULT_INDEX = 0;
export const CLOSE_BATCH_SIZE = 8;
export const SLIPPAGE_BPS_DEFAULT = 150;
export const FUND_CREATOR_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_U64 = "18446744073709551615";

export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");

export function short(pk: PublicKey | string): string {
  const s = typeof pk === "string" ? pk : pk.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function eq(a: PublicKey | string | null | undefined, b: PublicKey | string): boolean {
  if (!a) return false;
  const as = typeof a === "string" ? a : a.toBase58();
  const bs = typeof b === "string" ? b : b.toBase58();
  return as === bs;
}
