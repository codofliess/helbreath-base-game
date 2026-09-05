# Sketch — multi-chain auth adapter (Sol / RH / Base)

**Status:** interfaces + sequence only. **No implementation in this PR.**  
**Normative product lock:** [`ADR-001-MULTICHAIN-AUTH.md`](./ADR-001-MULTICHAIN-AUTH.md).

**Next PR (middleware-only, small):** implement challenge + bind for **Sol + RH** first; **Base stub** (same EVM types, verifier returns “not implemented”). Do not change landing HTML or secrets/`.env` in that PR either unless ops explicitly adds keys.

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
  message: string; // exact bytes/utf-8 the wallet must sign
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

- `UNIQUE (chainId, address)` globally.
- `actorKind` lives on the **player** row, not on `WalletBinding`.
- Challenge is single-use; consume on successful verify.

---

## Ports

Middleware (SoT) owns these ports. Game server validates the issued session; it does not re-verify chain signatures on every packet.

```ts
interface ChallengeIssuer {
  /** Fail-closed if chain RPC/config required for this chain is missing. */
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
   * Registration or admin only. Signature verifiers must never call this
   * with client-supplied actorKind.
   */
  register(actorKind: ActorKind): Promise<{ playerId: string; actorKind: ActorKind }>;
  listBindings(playerId: string): Promise<WalletBinding[]>;
}
```

Per-chain `SignatureVerifier` instances:

| Chain | Verifier | First impl PR |
|-------|----------|----------------|
| `sol` | ed25519 over Phantom login message | **implement** |
| `rh` | EVM (personal_sign / EIP-191) over challenge message | **implement** |
| `base` | same EVM interface | **stub** (`501` / deny) |

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
4. **Register:** no session + wallet unbound → `PlayerSoT.register(actorKind)` where `actorKind` comes from the **registration/admin** API (explicit field on a gated route), then bind. Default for the public wallet-only path: `human` unless the admin/bot-enroll route is used. Signature alone cannot select `bot` to masquerade, and cannot select another player’s id.
5. **Issue session** as JWT or HMAC cookie/header (`WALLET_AUTH_SECRET`), claims: `playerId`, `actorKind`, `boundChains` (and expiry). Game server fail-closed if secret missing.

No double-mint / ownership races: persist bind with `INSERT … UNIQUE (chain_id, address)` (or equivalent lease). Conflict → 409, do not create a second player.

---

## RH-specific notes

- Treat addresses as **EVM**. Canonical form for `$HELBREATH` and player wallets: **EIP-55 checksum**. Primary CA:

  `0xb603D6b2e5472beb338CE079a63FEb8663171529`

  Store checksummed; compare case-insensitive only after hex decode, then re-emit checksum. Do not accept a different casing as a second binding.
- Verifier: standard EVM message sign for the challenge `message` (EIP-191 `personal_sign` or the project’s chosen equivalent). **Not** Solana ed25519. **Not** a shared HMAC the user signs.
- **~1% creator tax** on `$HELBREATH` is an **on-chain economy fact** (stake/consumibles). Auth adapters must not encode tax, slippage, or Pons URLs into challenges or sessions.
- Copy: **RH Chain / Pons**. Never “listed on Robinhood.”

---

## Sol notes

- Verifier: **ed25519** as today (Phantom `signMessage`). Message shape stays challenge-bound, e.g. `Helbreath login: ${challenge}` plus the wallet-standard envelope (`Solana Signed Message:\n`) already used in middleware-node.
- Address = base58 pubkey; bind key `(sol, address)`.
- Secondary token rail `$HELL` mint `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`, pool `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx` — economy, not auth.
- Do not reference old mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` in challenge copy or examples.

---

## Fail-closed matrix

| Condition | Prod (`NODE_ENV=production` or public host) | Local dev |
|-----------|-----------------------------------------------|-----------|
| `WALLET_AUTH_SECRET` missing | **Deny** (no tokens, no verify success). Never `ALLOW_INSECURE_AUTH=1`. | Deny unless explicitly local-only exception already documented in prelaunch hardening — **not** for RH/Base public traffic. |
| `MARKET_SYNC_SECRET` missing | **Deny** market sync / side door. | Same fail-closed if those routes are hit. |
| Sol RPC key/url missing when Sol verify needs RPC | **Deny** `sol` challenge/verify (do not skip signature check). | Deny that chain. |
| RH RPC key/url missing when RH verify needs RPC | **Deny** `rh` challenge/verify. | Deny that chain. |
| Base stub | **Deny** `base` verify (`not implemented`). | Deny. |
| Challenge expired / reused | **Deny**. | Deny. |
| Signature valid but `actorKind` in body | **Ignore body**; use SoT. Attempt to change kind → **Deny** unless admin route. | Same. |
| Signature valid, client sends another `playerId` | **Deny** (no impersonation). | Deny. |
| Bind `(chainId, address)` already owned by other player | **Deny**. | Deny. |
| `ALLOW_INSECURE_AUTH=1` | **Forbidden.** Treat as misconfig; do not honor in prod. | Not a substitute for missing prod secrets. |

---

## Explicit next PR

**Middleware-only, small:**

1. Generalize challenge issue to `(chainId, address)` without a shared signing secret across chains.
2. Keep Sol ed25519 verifier; add RH EVM verifier.
3. Player SoT + bind: `playerId`, `actorKind`, unique wallet bindings; session JWT/cookie with `playerId + actorKind + boundChains`.
4. **Base:** types + route stub that fail-closes.
5. No landing HTML. No secrets/`.env` in git. No arenas / US migrate / ExactOut.
