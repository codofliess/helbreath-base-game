import { Connection, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { CpAmm, getTokenProgram } from "@meteora-ag/cp-amm-sdk";
import { DAMM_POSITION, DAMM_POSITION_NFT_ACCOUNT, DEST, VAULT } from "../constants";
import type { DammLive } from "../live";
import { ixsFromTx } from "../tx";

export async function dammClaimIxs(
  connection: Connection,
  live: DammLive,
  opts: { owner: PublicKey; receiver: PublicKey; feePayer: PublicKey }
): Promise<TransactionInstruction[]> {
  const amm = new CpAmm(connection);
  const tx = await amm.claimPositionFee2({
    owner: opts.owner,
    receiver: opts.receiver,
    feePayer: opts.feePayer,
    pool: live.pool,
    position: DAMM_POSITION,
    positionNftAccount: live.positionNftAccount.equals(live.tokenAMint)
      ? DAMM_POSITION_NFT_ACCOUNT
      : live.positionNftAccount,
    tokenAMint: live.tokenAMint,
    tokenBMint: live.tokenBMint,
    tokenAVault: live.tokenAVault,
    tokenBVault: live.tokenBVault,
    tokenAProgram: getTokenProgram(live.tokenAFlag),
    tokenBProgram: getTokenProgram(live.tokenBFlag),
  });
  return ixsFromTx(tx);
}

export function vaultClaimDefaults() {
  return { owner: VAULT, receiver: DEST, feePayer: VAULT };
}
