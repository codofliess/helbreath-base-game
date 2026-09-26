import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as multisig from "@sqds/multisig";
import {
  DEST,
  MEMBER_2A4B,
  MULTISIG,
  SQUADS_TX_INDICES_TO_CLOSE,
  SYSTEM_PROGRAM,
  VAULT,
  VAULT_INDEX,
} from "../constants";
import type { DammLive } from "../live";
import { compileV0, freshBlockhash, MAX_TX_BYTES, txByteSize } from "../tx";
import { dbcPartnerClaimIxs } from "./dbc";
import { dammClaimIxs } from "./damm";

export type VaultBundle = {
  index: bigint;
  memo: string;
  innerIxs: TransactionInstruction[];
  createIxs: TransactionInstruction[];
  proposeIxs: TransactionInstruction[];
  splitReason?: string;
};

export async function nextTxIndex(connection: Connection): Promise<bigint> {
  const m = await multisig.accounts.Multisig.fromAccountAddress(connection, MULTISIG);
  return BigInt(m.transactionIndex.toString()) + 1n;
}

export function vaultCreateIx(opts: {
  index: bigint;
  creator: PublicKey;
  innerIxs: TransactionInstruction[];
  memo: string;
  blockhash: string;
}): TransactionInstruction {
  const inner = new TransactionMessage({
    payerKey: VAULT,
    recentBlockhash: opts.blockhash,
    instructions: opts.innerIxs,
  });
  return multisig.instructions.vaultTransactionCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
    vaultIndex: VAULT_INDEX,
    ephemeralSigners: 0,
    transactionMessage: inner,
    memo: opts.memo,
  });
}

export function proposeIx(opts: { index: bigint; creator: PublicKey }): TransactionInstruction {
  return multisig.instructions.proposalCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
  });
}

export function createAndProposeIxs(opts: {
  index: bigint;
  creator: PublicKey;
  innerIxs: TransactionInstruction[];
  memo: string;
  blockhash: string;
}): TransactionInstruction[] {
  return [
    vaultCreateIx(opts),
    proposeIx({ index: opts.index, creator: opts.creator }),
  ];
}

function createTxBytes(
  creator: PublicKey,
  blockhash: string,
  innerIxs: TransactionInstruction[],
  index: bigint,
  memo: string
): number {
  try {
    const ixs = [vaultCreateIx({ index, creator, innerIxs, memo, blockhash })];
    const vtx = compileV0({ payer: creator, blockhash, ixs });
    return txByteSize(vtx);
  } catch {
    return MAX_TX_BYTES + 1;
  }
}

function fitsCreateTx(
  creator: PublicKey,
  blockhash: string,
  innerIxs: TransactionInstruction[],
  index: bigint,
  memo: string
): boolean {
  return createTxBytes(creator, blockhash, innerIxs, index, memo) <= MAX_TX_BYTES;
}

export async function buildVaultInnerGroups(
  connection: Connection,
  damm: DammLive | null,
  vaultLamports: number,
  rentExemptMin: number
): Promise<{ label: string; ixs: TransactionInstruction[] }[]> {
  const groups: { label: string; ixs: TransactionInstruction[] }[] = [];
  const partner = await dbcPartnerClaimIxs(connection, {
    feeClaimer: VAULT,
    payer: VAULT,
    receiver: DEST,
  });
  for (const g of partner) {
    groups.push({ label: `DBC partner ${g.label}`, ixs: g.ixs });
  }
  if (damm) {
    const dammIxs = await dammClaimIxs(connection, damm, {
      owner: VAULT,
      receiver: DEST,
      feePayer: VAULT,
    });
    groups.push({ label: "DAMM v2 claim_position_fee", ixs: dammIxs });
  }
  const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, VAULT, true, TOKEN_PROGRAM_ID);
  const wsolInfo = await connection.getAccountInfo(wsolAta);
  const wrapIxs: TransactionInstruction[] = [];
  if (wsolInfo) {
    wrapIxs.push(createCloseAccountInstruction(wsolAta, DEST, VAULT, [], TOKEN_PROGRAM_ID));
  }
  const buffer = 5_000_000;
  const send = Math.max(0, vaultLamports - rentExemptMin - buffer);
  if (send > 0) {
    wrapIxs.push(
      SystemProgram.transfer({ fromPubkey: VAULT, toPubkey: DEST, lamports: send })
    );
  }
  if (wrapIxs.length) {
    groups.push({ label: "unwrap WSOL + transfer vault SOL", ixs: wrapIxs });
  }
  return groups;
}

function makeBundle(
  index: bigint,
  creator: PublicKey,
  blockhash: string,
  memo: string,
  inner: TransactionInstruction[],
  splitReason?: string
): VaultBundle {
  return {
    index,
    memo,
    innerIxs: inner,
    createIxs: [vaultCreateIx({ index, creator, innerIxs: inner, memo, blockhash })],
    proposeIxs: [proposeIx({ index, creator })],
    splitReason,
  };
}

export async function packVaultBundles(
  connection: Connection,
  creator: PublicKey,
  groups: { label: string; ixs: TransactionInstruction[] }[]
): Promise<VaultBundle[]> {
  const start = await nextTxIndex(connection);
  const blockhash = await freshBlockhash(connection);
  const bundles: VaultBundle[] = [];
  let cursor = 0;
  let index = start;
  while (cursor < groups.length) {
    let packed = false;
    for (let end = groups.length; end > cursor; end--) {
      const slice = groups.slice(cursor, end);
      const inner = slice.flatMap((g) => g.ixs);
      const memo = slice.map((g) => g.label).join(" | ").slice(0, 80);
      if (fitsCreateTx(creator, blockhash, inner, index, memo)) {
        bundles.push(makeBundle(index, creator, blockhash, memo, inner));
        index += 1n;
        cursor = end;
        packed = true;
        break;
      }
    }
    if (packed) continue;
    const g = groups[cursor];
    if (!g) break;
    bundles.push(
      makeBundle(
        index,
        creator,
        blockhash,
        g.label.slice(0, 80),
        g.ixs,
        `El grupo "${g.label}" no cabe en vaultTransactionCreate (límite ${MAX_TX_BYTES} B). Proposal va en otra tx.`
      )
    );
    index += 1n;
    cursor += 1;
  }
  if (bundles.length > 1) {
    const reason = `No cabe en UNA vault tx al crear (límite ${MAX_TX_BYTES} B). Mínimo ${bundles.length} vault txs; proposalCreate es un paso aparte.`;
    bundles[0].splitReason = (bundles[0].splitReason ? bundles[0].splitReason + " " : "") + reason;
  }
  return bundles;
}

export function approveIx(index: bigint, member: PublicKey): TransactionInstruction {
  return multisig.instructions.proposalApprove({
    multisigPda: MULTISIG,
    transactionIndex: index,
    member,
  });
}

export async function executeIxs(
  connection: Connection,
  index: bigint,
  member: PublicKey
): Promise<TransactionInstruction[]> {
  const { instruction } = await multisig.instructions.vaultTransactionExecute({
    connection,
    multisigPda: MULTISIG,
    transactionIndex: index,
    member,
  });
  return [instruction];
}

export function configSetRentCollectorIxs(opts: {
  index: bigint;
  creator: PublicKey;
  newCollector: PublicKey;
}): TransactionInstruction[] {
  const create = multisig.instructions.configTransactionCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
    actions: [{ __kind: "SetRentCollector", newRentCollector: opts.newCollector }],
    memo: "set rentCollector -> 2a4b",
  });
  const propose = multisig.instructions.proposalCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
  });
  return [create, propose];
}

export function configExecuteIx(index: bigint, member: PublicKey): TransactionInstruction {
  return multisig.instructions.configTransactionExecute({
    multisigPda: MULTISIG,
    transactionIndex: index,
    member,
  });
}

export function cancelProposalIx(index: bigint, member: PublicKey): TransactionInstruction {
  return multisig.instructions.proposalCancel({
    multisigPda: MULTISIG,
    transactionIndex: index,
    member,
  });
}

export function rejectProposalIx(index: bigint, member: PublicKey): TransactionInstruction {
  return multisig.instructions.proposalReject({
    multisigPda: MULTISIG,
    transactionIndex: index,
    member,
  });
}

export function closeVaultTxAccountsIx(index: bigint, rentCollector: PublicKey): TransactionInstruction {
  return multisig.instructions.vaultTransactionAccountsClose({
    multisigPda: MULTISIG,
    rentCollector,
    transactionIndex: index,
  });
}

export function closeConfigTxAccountsIx(index: bigint, rentCollector: PublicKey): TransactionInstruction {
  return multisig.instructions.configTransactionAccountsClose({
    multisigPda: MULTISIG,
    rentCollector,
    transactionIndex: index,
  });
}

export function closeLegacyTxIxs(rentCollector: PublicKey): TransactionInstruction[] {
  return SQUADS_TX_INDICES_TO_CLOSE.map((i) => closeVaultTxAccountsIx(i, rentCollector));
}

export function isAutonomous(configAuthority: PublicKey): boolean {
  return configAuthority.equals(SYSTEM_PROGRAM) || configAuthority.equals(PublicKey.default);
}

export { MEMBER_2A4B };
