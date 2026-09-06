# ADR-001 — Multi-chain auth + token rails (ChainLords)

| Field | Value |
|-------|--------|
| **Status** | **Accepted** |
| **Date** | 2026-09-05 |
| **Product** | Helbreath ChainLords (one game world) |
| **Deciders** | Product + Cruchi fail-closed auth |
| **Supersedes** | Solana-only SIWS as the *only* login path (still the Sol verifier) |

Related: [`SECURITY-HARDENING-PRELAUNCH.md`](./SECURITY-HARDENING-PRELAUNCH.md) · [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md) · sketch [`SKETCH-ADAPTER-MULTICHAIN.md`](./SKETCH-ADAPTER-MULTICHAIN.md)

This record **locks** world, wallets, actor flag, and **token rails** (which contract is stake vs listing). It does **not** lock mining, play-mine claims, or reward-budget buys. It does not enumerate rejected alternatives.

---

## Context

ChainLords is **one game world** with **one middleware** as Source of Truth (SoT) for player identity, bound wallets, and `human|bot`. Clients (browser, C# server session) prove control of a chain address; they do not own the player id.

Players already sign in on Solana (Phantom `signMessage` / SIWS-style challenge in middleware-node). Robinhood Chain (RH) `$HELBREATH` is live on Pons. Base is in the wallet set. Auth and economy must share the same player id without:

- a shared signing secret across chains
- double-mint / ownership races when binding a new wallet
- forging `human|bot` from a signature
- impersonation (a bot wallet claiming a human player id by signing alone)

Copy constraint for all product/comms that mention the primary token: say **“RH Chain / Pons”**, never **“listed on Robinhood”**.

---

## Decision

### 1. One world, one middleware SoT

- A single player account (`playerId`) is the identity the game server and economy use.
- Middleware DB is the SoT for: player row, `actorKind`, wallet bindings, session issuance.
- Chain state (balances, NFT ownership) is consulted **after** a bound wallet is authenticated — not as a substitute for SoT.

### 2. Wallets: Solana + Robinhood Chain + Base

| `ChainId` | Role in auth | Address form |
|-----------|----------------|--------------|
| `sol` | Challenge-response, ed25519 (Phantom) | Base58 pubkey |
| `rh` | Challenge-response, EVM personal-sign / equivalent | EIP-55 checksum `0x…` |
| `base` | Same EVM verifier as RH (EIP-191 `personal_sign`, live) | EIP-55 checksum `0x…` |

A player **may bind multiple wallets** (any mix of chains) to **one** `playerId`. Binding is an authenticated SoT write, not “whoever signs this address owns that character.”

The same `0x` address on `rh` and `base` is **two separate binds** (intentional). `UNIQUE` is `(chainId, address)`, not address alone.

### 3. Actor flag `human|bot` on the player account

- Stored on the **player**, not on a wallet and not in the signature payload as authority.
- Set only at **registration** or an **admin** path. **Public register defaults to `human`.** Bot enrollment is a **gated + rate-limited** path (next code PR; see sketch).
- A signature proves control of **that wallet**. It does **not** set or change `actorKind`. It does **not** let a bot wallet attach itself to a different (human) `playerId`.
- Bots are **first-class citizens**, encouraged in-world. They are not “fake humans.”
- Arenas later (out of scope): HvH / BvB / champions H vs B — matchmaking reads `actorKind` from SoT.

This is **not** impersonation of another player. Impersonation is forbidden: fail closed if bind would attach a wallet to a player the signer does not already own, or if the request tries to override `actorKind`.

### 4. Token rails (economy identity; auth does not mint)

**PRIMARY stake / consumibles:** RH Chain `$HELBREATH`

- Contract: `0xb603D6b2e5472beb338CE079a63FEb8663171529` (Pons launchpad).
- Copy: **RH Chain / Pons** only.

**Solana listing (secondary):** `$HELL`

- Mint: `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`
- Pool: `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx`
- **Do not promote** old mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ`.

**NFTs:** same binding logic as wallets — **one collection per chain** (Sol / Base / RH). Claim/mint still keyed to `playerId` + bound wallet on that chain so we do not double-mint across rails.

### 5. Auth design (Cruchi fail-closed)

1. **Per-chain challenge-response.** Challenge is issued for `(chainId, address)`. Verifier is chain-specific. No shared secret across chains; HMAC `WALLET_AUTH_SECRET` only signs **server-issued sessions**, never player keys.
2. **Anti-replay (signed message).** `AuthChallenge.message` **MUST** explicitly include `chainId` + `challengeId` + expiry so a signature cannot be replayed across protocols/chains.
3. **Secrets fail-closed.** Missing `WALLET_AUTH_SECRET` or `MARKET_SYNC_SECRET` → **deny**. Login verify does not require chain RPC. Never `ALLOW_INSECURE_AUTH=1` in production (matches [`SECURITY-HARDENING-PRELAUNCH.md`](./SECURITY-HARDENING-PRELAUNCH.md)).
4. **Bind without races.** Unique `(chainId, address)` → at most one `playerId` **on that chain**. Same `0x` on `rh` vs `base` = two binds. Bind/login is transactional (lease or unique constraint); concurrent bind of the same `(chainId, address)` cannot mint two players or steal an existing one.
5. **`human|bot` not forgeable via signature.** Verifier output is `{ chainId, address }`. SoT applies `actorKind` from the player row (or registration/admin input), never from client-claimed flags. Public register → `human`; bot enroll is gated + rate-limited.
6. **No impersonation.** Login of a bound wallet resumes that `playerId`. Unbound wallet may **create** a new player (with `actorKind` from registration path) or **bind** to the **currently authenticated** session’s `playerId` — not to an arbitrary id supplied in the body.

---

## Consequences

**Positive**

- One character / economy identity across Sol, RH, and Base.
- Bots are explicit and matchable later without polluting human ladders.
- Primary stake / consumibles rail is RH `$HELBREATH` (`0xb603…`) without implying a Robinhood listing.
- Sol `$HELL` remains listing / liquidity **secondary** with a single canonical mint/pool.

**Martín cut — mining / rewards not locked**

- Mining, play-mine **claim**, and buying ~30% supply for rewards are **not** decided here.
- Do **not** treat ExactOut buyback or a fixed `$HELL` mining-vault settle as the product path.
- **Mining rewards mechanism: OPEN** / deferred. Future work: redesign play incentives so rewards encourage play that is **not** token farming — mechanism TBD by Martín later. Auth + rails in this ADR stay valid without that mechanism.

**Operational**

- Production must have `WALLET_AUTH_SECRET` and `MARKET_SYNC_SECRET`. Login verify for Sol/RH/Base is **offline** (ed25519 / EIP-191); **no RH/Base RPC is required** for `personal_sign`. Solana RPC remains for mint/drops, not SIWS. Misconfig = 503/deny, not open auth.
- Session payload must carry `playerId`, `actorKind`, and the set of bound chains so the game server does not trust a raw wallet string as identity.
- NFT and stake features must resolve **player → bound address on that chain**, not “whichever wallet the client sent.”

**Risks / follow-ups**

- Base challenge+verify is live (same EIP-191 path as RH). Same `0x` on `rh` vs `base` remains two binds.
- Cruchi notes: signed `message` includes `chainId` + `challengeId` + expiry; public register `human`, bot enroll gated + rate-limited.
- Existing Sol-only tokens (`X-Wallet-Token` keyed by wallet) must migrate to player-scoped sessions in that PR — not in this docs PR.

---

## Token registry

| Rail | Chain | Asset | Address / id | Notes |
|------|-------|--------|----------------|-------|
| **Primary** stake / consumibles | RH (`rh`) | `$HELBREATH` | `0xb603D6b2e5472beb338CE079a63FEb8663171529` | Pons launchpad. Copy: **RH Chain / Pons**. Never “listed on Robinhood”. |
| **Secondary** listing | Solana (`sol`) | `$HELL` | mint `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` | Pool `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx`. |
| **Do not promote** | Solana | (legacy mint) | `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` | Retired Path mint. Do not use in UI, posts, or auth examples. |
| NFT collection | `sol` | Helbreath collection | (existing Sol collection mints / trees — ops runbook) | Bound via Sol wallet on `playerId`. |
| NFT collection | `rh` | Helbreath collection | (RH collection contract when deployed) | Same player; no double-mint vs Sol/Base. |
| NFT collection | `base` | Helbreath collection | (Base collection contract when deployed) | Bound via Base wallet on `playerId`. |
| **Mining rewards mechanism** | — | — | — | **OPEN** / deferred. Not a rail. Not ExactOut buyback. Not a fixed `$HELL` mining-vault settle. |

Checksum for the RH primary CA is the EIP-55 form `0xb603D6b2e5472beb338CE079a63FEb8663171529` (see sketch). Token **registry** (stake vs listing contracts) is locked; mining-settle is not.

---

## Out of scope

| Item | Why later |
|------|-----------|
| **Arenas PR** — HvH / BvB / champions H vs B | Matchmaking and queue rules; reads `actorKind` already decided here. |
| **US migrate** | Token/rail migration for US players; not auth. |
| **ExactOut airdrop / ExactOut buyback** | Not the product path. Out of this ADR; do not implement as mining settle. |
| **Mining / play-mine claim / ~30% supply buy for rewards** | **OPEN.** Not locked. Do not treat a fixed `$HELL` mining-vault settle as decided. |
| **Play-incentive redesign** (rewards that are not token farming) | TBD by Martín later; deferred from this ADR. |
| Middleware implementation | Challenge+bind for Sol + RH + Base is in middleware-node; this ADR remains the product lock. |
| Landing HTML, secrets, `.env` | Unchanged by this decision record. |
