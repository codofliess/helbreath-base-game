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
  splitReason?: string;
};

export async function nextTxIndex(connection: Connection): Promise<bigint> {
  const m = await multisig.accounts.Multisig.fromAccountAddress(connection, MULTISIG);
  return BigInt(m.transactionIndex.toString()) + 1n;
}

export function createAndProposeIxs(opts: {
  index: bigint;
  creator: PublicKey;
  innerIxs: TransactionInstruction[];
  memo: string;
  blockhash: string;
}): TransactionInstruction[] {
  const inner = new TransactionMessage({
    payerKey: VAULT,
    recentBlockhash: opts.blockhash,
    instructions: opts.innerIxs,
  });
  const createIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
    vaultIndex: VAULT_INDEX,
    ephemeralSigners: 0,
    transactionMessage: inner,
    memo: opts.memo,
  });
  const proposeIx = multisig.instructions.proposalCreate({
    multisigPda: MULTISIG,
    transactionIndex: opts.index,
    creator: opts.creator,
  });
  return [createIx, proposeIx];
}

function fitsCreateTx(
  creator: PublicKey,
  blockhash: string,
  innerIxs: TransactionInstruction[],
  index: bigint,
  memo: string
): boolean {
  const ixs = createAndProposeIxs({ index, creator, innerIxs, memo, blockhash });
  const vtx = compileV0({ payer: creator, blockhash, ixs });
  return txByteSize(vtx) <= MAX_TX_BYTES;
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
    let end = groups.length;
    while (end > cursor) {
      const slice = groups.slice(cursor, end);
      const inner = slice.flatMap((g) => g.ixs);
      const memo = slice.map((g) => g.label).join(" | ").slice(0, 80);
      if (fitsCreateTx(creator, blockhash, inner, index, memo)) {
        bundles.push({
          index,
          memo,
          innerIxs: inner,
          createIxs: createAndProposeIxs({ index, creator, innerIxs: inner, memo, blockhash }),
        });
        index += 1n;
        cursor = end;
        break;
      }
      end -= 1;
    }
    if (end <= cursor) {
      const g = groups[cursor];
      const memo = g.label.slice(0, 80);
      bundles.push({
        index,
        memo,
        innerIxs: g.ixs,
        createIxs: createAndProposeIxs({
          index,
          creator,
          innerIxs: g.ixs,
          memo,
          blockhash,
        }),
        splitReason: `El grupo "${g.label}" no cabe en una tx de creación de 1232 bytes; se envía solo.`,
      });
      index += 1n;
      cursor += 1;
    }
  }
  if (bundles.length > 1) {
    const reason = `No cabe en una sola vault tx (límite ${MAX_TX_BYTES} B al crear). Mínimo ${bundles.length} vault txs.`;
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
