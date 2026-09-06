# Sketch — multi-chain auth adapter (Sol / RH / Base)

**Status:** implemented in middleware-node (`sol` ed25519, `rh`+`base` EIP-191 `personal_sign`). Login verify is offline — **no chain RPC required** for challenge/verify.  
**Normative product lock:** [`ADR-001-MULTICHAIN-AUTH.md`](./ADR-001-MULTICHAIN-AUTH.md).

Live env + deploy: [`LIVE-MULTIWALLET-AUTH.md`](./LIVE-MULTIWALLET-AUTH.md).

**Mining rewards mechanism: OPEN** (ADR Consequences / Out of scope). This adapter does not issue play-mine claims, ExactOut buybacks, or a `$HELL` mining-vault settle. Token registry stays in the ADR: RH `$HELBREATH` = stake/consumibles; Sol `$HELL` = listing/liquidity secondary.

---

## Types

```ts
type ChainId = 'sol' | 'rh' | 'base';

type ActorKind = 'human' | 'bot';

/** Proven control of one address on one chain. Never includes actorKind. */
interface WalletBinding {
  playerId: string;
  chainId: ChainId;
  address: string; // sol: base58; rh/base: EIP-55 0x…
  boundAt: string; // ISO-8601
}

interface AuthChallenge {
  challengeId: string;
  chainId: ChainId;
  address: string;
  /** Exact bytes/utf-8 the wallet must sign. MUST include chainId + challengeId + expiry. */
  message: string;
  expiresAt: number; // unix ms
}

interface Session {
  playerId: string;
  actorKind: ActorKind;
  boundChains: ChainId[];
  /** Bound addresses in this session snapshot (optional; SoT is DB). */
  wallets?: Pick<WalletBinding, 'chainId' | 'address'>[];
  token: string; // JWT or HMAC cookie/header; keyed by WALLET_AUTH_SECRET
  expiresAt: number;
}
```

Invariants:

- `UNIQUE (chainId, address)` globally. Same `0x` on `rh` and `base` = **two** binds (intentional).
- `actorKind` lives on the **player** row, not on `WalletBinding`.
- Challenge is single-use; consume on successful verify.
- `message` MUST contain `chainId`, `challengeId`, and expiry (anti-replay cross-protocol).

---

## Cruchi notes (before middleware PR)

Fail-closed GO. Implement these in the next code PR; do not weaken them.

1. **Signed message composition.** `AuthChallenge.message` MUST explicitly include `chainId` + `challengeId` + expiry. Verifier checks the recovered signature against that exact string. A Sol signature must not satisfy an RH challenge (and vice versa); a reused `challengeId` after expiry or consume is deny.
2. **EVM address per chain.** The same `0x` address on `rh` and `base` is two separate `WalletBinding` rows. `UNIQUE` is `(chainId, address)`, not `address` alone. Binding RH does not imply Base.
3. **Actor enrollment.** Public register defaults to `human`. Bot enrollment is a **gated + rate-limited** route (admin or dedicated enroll), not a flag the client can set on verify. Signature alone cannot flip `actorKind` or attach to another `playerId`.

---

## Ports

Middleware (SoT) owns these ports. Game server validates the issued session; it does not re-verify chain signatures on every packet.

```ts
interface ChallengeIssuer {
  /** Login issue is offline (no RPC). Fail-closed on address/chainId shape only. */
  issue(chainId: ChainId, address: string): Promise<AuthChallenge>;
}

interface SignatureVerifier {
  chainId: ChainId;
  /**
   * Returns the canonical address if the signature matches the challenge message.
   * Must not accept a signature from chain A as proof for chain B.
   */
  verify(input: {
    address: string;
    challenge: AuthChallenge;
    signature: string;
  }): Promise<{ ok: true; address: string } | { ok: false; reason: string }>;
}

interface WalletBinder {
  /**
   * Bind address to playerId or reject.
   * - If address unbound: attach to playerId (login session or new registration).
   * - If address already bound to playerId: idempotent OK.
   * - If bound to another playerId: deny (no impersonation, no steal).
   * Transactional vs concurrent binds (unique constraint / lease).
   */
  bindOrReject(playerId: string, chainId: ChainId, address: string): Promise<WalletBinding>;
}

interface PlayerSoT {
  getById(playerId: string): Promise<{ playerId: string; actorKind: ActorKind } | null>;
  getByWallet(chainId: ChainId, address: string): Promise<{ playerId: string; actorKind: ActorKind } | null>;
  /**
   * Public path: always persist actorKind=`human`.
   * Bot enrollment is a separate gated + rate-limited route (next code PR).
   * Signature verifiers must never pass client-supplied actorKind.
   */
  register(actorKind: ActorKind): Promise<{ playerId: string; actorKind: ActorKind }>;
  listBindings(playerId: string): Promise<WalletBinding[]>;
}
```

Per-chain `SignatureVerifier` instances:

| Chain | Verifier | Status |
|-------|----------|--------|
| `sol` | ed25519 over Phantom login message | **live** |
| `rh` | EVM (personal_sign / EIP-191) over challenge message | **live** |
| `base` | same EVM interface as RH (`chainId=base` in the signed message) | **live** |

---

## Sequence

```
Client                         ChallengeIssuer          SignatureVerifier        WalletBinder / PlayerSoT
  |                                  |                         |                         |
  |-- POST challenge(chain, addr) -->|                         |                         |
  |<- AuthChallenge -----------------|                         |                         |
  |  (wallet signs message)          |                         |                         |
  |-- POST verify(chain, addr,       |                         |                         |
  |       challengeId, signature) -->|------- verify --------->|                         |
  |                                  |<-- { ok, address } -----|                         |
  |                                  |-- lookup wallet ------->|------------------------>|
  |                                  |                         |   unbound?              |
  |                                  |                         |   - existing Session.playerId → bind
  |                                  |                         |   - else register(actorKind from
  |                                  |                         |     registration/admin path only)
  |                                  |                         |   bound to other player? DENY
  |<- Session (JWT/cookie) ----------|                         |                         |
       playerId + actorKind + boundChains
```

Bind-or-login rules:

1. **Verify first.** No SoT write until the chain verifier returns `ok`.
2. **Login:** wallet already bound → load that `playerId` + `actorKind` from SoT. Ignore any `playerId` / `actorKind` in the client body.
3. **Bind:** authenticated session present + wallet unbound → `WalletBinder.bindOrReject(session.playerId, …)`.
4. **Register:** no session + wallet unbound → public path `PlayerSoT.register('human')`, then bind. **Bot enrollment** is a gated + rate-limited route (implement in next code PR). Signature alone cannot select `bot` or another player’s id.
5. **Issue session** as JWT or HMAC cookie/header (`WALLET_AUTH_SECRET`), claims: `playerId`, `actorKind`, `boundChains` (and expiry). Game server fail-closed if secret missing.

No double-mint / ownership races: persist bind with `INSERT … UNIQUE (chain_id, address)` (or equivalent lease). Conflict → 409, do not create a second player. Same `0x` on `rh` vs `base` does **not** conflict.

---

## RH-specific notes

- Treat addresses as **EVM**. Canonical form for `$HELBREATH` and player wallets: **EIP-55 checksum**. Primary CA:

  `0xb603D6b2e5472beb338CE079a63FEb8663171529`

  Store checksummed; compare case-insensitive only after hex decode, then re-emit checksum. Do not accept a different casing as a second binding.
- Verifier: standard EVM message sign for the challenge `message` (EIP-191 `personal_sign` or the project’s chosen equivalent). **Not** Solana ed25519. **Not** a shared HMAC the user signs. `message` includes `chainId=rh` (or `base`), `challengeId`, and expiry.
- Copy: **RH Chain / Pons**. Never “listed on Robinhood.”
- Auth adapters must not encode slippage or Pons URLs into challenges or sessions.

---

## Sol notes

- Verifier: **ed25519** as today (Phantom `signMessage`). Message **MUST** include `chainId` (`sol`) + `challengeId` + expiry (not challenge hex alone). Keep the wallet-standard envelope (`Solana Signed Message:\n`) already used in middleware-node.
- Address = base58 pubkey; bind key `(sol, address)`.
- Secondary token rail `$HELL` mint `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`, pool `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx` — economy, not auth.
- Do not reference old mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` in challenge copy or examples.

---

## Fail-closed matrix

| Condition | Prod (`NODE_ENV=production` or public host) | Local dev |
|-----------|-----------------------------------------------|-----------|
| `WALLET_AUTH_SECRET` missing | **Deny** (no tokens, no verify success). Never `ALLOW_INSECURE_AUTH=1`. | Deny unless explicitly local-only exception already documented in prelaunch hardening — **not** for RH/Base public traffic. |
| `MARKET_SYNC_SECRET` missing | **Deny** market sync / side door. | Same fail-closed if those routes are hit. |
| Sol RPC key/url missing | **Not required for SIWS login** (offline ed25519). Required for mint/drops only. | Same. |
| RH / Base RPC | **Not required for login** (offline EIP-191 `personal_sign`). | Same. |
| Base verify | Same EIP-191 path as RH; fail-closed on bad/expired challenge. | Same. |
| Challenge `message` missing `chainId` / `challengeId` / expiry | **Deny** verify (do not accept legacy challenge-only strings in prod). | Deny. |
| Challenge expired / reused | **Deny**. | Deny. |
| Signature valid but `actorKind` in body | **Ignore body**; use SoT. Attempt to change kind → **Deny** unless gated bot-enroll. | Same. |
| Public register requesting `bot` | **Deny** (default `human` only). | Deny unless gated enroll. |
| Bind `(chainId, address)` already owned by other player | **Deny**. | Deny. |
| Same `0x` rebound as the other of `rh`/`base` | **Allow** as a **second** bind (different `chainId`). | Allow. |
| `ALLOW_INSECURE_AUTH=1` | **Forbidden.** Treat as misconfig; do not honor in prod. | Not a substitute for missing prod secrets. |

---

## Implementation status

Shipped in middleware-node + traveler hub + landing Play Now:

1. Challenge issue is `(chainId, address)` with no shared signing secret across chains. **`message` includes `chainId` + `challengeId` + expiry.**
2. Sol ed25519 + RH/Base EIP-191 `personal_sign` (offline; no RPC).
3. Player SoT + bind: `playerId`, `actorKind`, unique `(chainId, address)` bindings (rh vs base `0x` are separate); HMAC session v2 with `playerId + actorKind + boundChains`. Public register = `human`; **bot enroll gated + rate-limited**.
4. Landing/client: Phantom (`sol`), injected EVM for `rh` and `base`.
5. No arenas / US migrate / ExactOut buyback. **Mining rewards mechanism: OPEN.**
