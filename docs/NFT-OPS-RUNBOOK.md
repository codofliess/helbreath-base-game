# NFT Ops Runbook — mint / claim (parcial)

> **Alcance:** operaciones de producción parciales para el pipeline cNFT (claim → mint Bubblegum).  
> **No es** un security audit completo (`[fable]` sigue pendiente en MASTERPLAN Fase A).  
> **No pegar secrets** en este doc ni en git: solo placeholders / `.env.example`.

**Relacionado:** [`MASTERPLAN.md`](./MASTERPLAN.md) § Fase A · `middleware-node/` · `multiplayer/server/Persistence/schema.sql`

---

## 1. Resumen del flujo

```
Game server (C#)                Postgres                    Middleware (Node)              Solana
─────────────────               ────────                    ─────────────────             ──────
Pickup rare/super_rare
  → NftDropEvaluator
  → INSERT drop_ledger
    (is_nft_candidate, nft_tier)
                                    │
Client Phantom + SIWS ──────────────┼──► GET /drops?wallet=
                                    │    POST /drops/:id/claim
                                    │         │
                                    │         ├─ checks (wallet, unclaimed, candidate)
                                    │         ├─ DB lease (nft_claim_lease_until)  ← BEFORE mint
                                    │         ├─ mint cNFT (simulate | onchain)
                                    │         └─ UPDATE nft_claimed_at + nft_mint_address
                                    │              WHERE nft_claimed_at IS NULL
                                    │              (+ clear lease)
```

| Pieza | Path |
|-------|------|
| Tier eval | `multiplayer/server/Helpers/NftDropEvaluator.cs` |
| Ledger insert | `multiplayer/server/Helpers/NftDropLedger.cs` |
| Schema | `drop_ledger` en `schema.sql` |
| Claim / mint | `middleware-node/drops.js`, `mint.js`, `persistence.js` |
| UI | `NftClaims.store` + Item Drops (F6) |
| Health / métricas | `GET /health`, `GET /metrics` |

**Tiers:** producto dice Rare / Legendary; código/DB usa `rare` / `super_rare`. Colecciones y merkle trees separados por env.

---

## 2. Variables de entorno

Usar solo `.env.example` como plantilla. **Nunca** commitear `.env`, `.game-authority.json` ni JSON de collection con keys.

### Middleware (`middleware-node/.env.example`)

| Variable | Rol | Prod |
|----------|-----|------|
| `DATABASE_URL` | Mismo Postgres que el game server | Obligatorio |
| `WALLET_AUTH_SECRET` | HMAC de tokens SIWS (`X-Wallet-Token`) | Obligatorio; **mismo valor** que el server C# |
| `ADMIN_API_KEY` | Torneos admin (no mint) | Recomendado |
| `GAME_AUTHORITY_SECRET` | Keypair mint authority (bs58 secret) | Obligatorio en prod; no depender del archivo local |
| `HELBREATH_COLLECTION_MINT` / `HELBREATH_MERKLE_TREE` | Colección Rare | Obligatorio si `onchain` |
| `HELBREATH_LEGENDARY_COLLECTION_MINT` / `HELBREATH_LEGENDARY_MERKLE_TREE` | Colección Legendary (`super_rare`) | Obligatorio si `onchain` |
| `HELBREATH_MINT_MODE` | `onchain` \| `simulate` | `onchain` en prod real; `simulate` apaga txs |
| `SOLANA_RPC_URL` | RPC (mainnet-beta / dedicado) | Obligatorio; preferir RPC pago |
| `MIDDLEWARE_PUBLIC_URL` | Base URL pública de metadata | Obligatorio (HTTPS estable) |
| `PORT` | Default `3001` | Según deploy |

**Dev-only (no prod):** si falta `GAME_AUTHORITY_SECRET`, el middleware puede generar/leer `middleware-node/.game-authority.json` (gitignored). En prod cargar secret desde vault/secret manager.

### Game server (`multiplayer/server/.env.example`)

| Variable | Rol | Prod |
|----------|-----|------|
| `DATABASE_URL` | Mismo string que middleware | Obligatorio |
| `WALLET_AUTH_SECRET` | Validación de sesión wallet en connect | Obligatorio; **igual** al middleware |

### Checklist pre-deploy mint

- [ ] `WALLET_AUTH_SECRET` idéntico en server + middleware (no el default de dev)
- [ ] `GAME_AUTHORITY_SECRET` en vault; pubkey conocida y fondeada (SOL para fees)
- [ ] Colecciones Rare + Legendary + merkle trees seteados
- [ ] `HELBREATH_MINT_MODE=onchain` solo cuando RPC + metadata URL sean alcanzables on-chain
- [ ] `MIDDLEWARE_PUBLIC_URL` sirve `GET /metadata/:dropId` sin auth de red interna rota
- [ ] Backup Postgres reciente (ver § 3)
- [ ] Schema aplicado incluye `nft_claim_lease_until` (middleware `ensureSchema` o `psql -f schema.sql`)

---

## 3. Backups Postgres

`drop_ledger`, `accounts` y `characters` viven en el mismo DB. Un mint sin fila de ledger o un claim sin backup previo es irrecuperable de forma limpia.

### Local (Docker Compose)

```powershell
# Contenedor: helbreath-postgres (ver multiplayer/docker-compose.yml)
docker exec helbreath-postgres pg_isready -U helbreath -d helbreath

# Dump lógico (ejemplo; ajustar path de salida)
docker exec helbreath-postgres pg_dump -U helbreath -d helbreath -Fc -f /tmp/helbreath.dump
docker cp helbreath-postgres:/tmp/helbreath.dump .\backups\helbreath-$(Get-Date -Format 'yyyyMMdd-HHmm').dump
```

### Prod (mínimo aceptable)

1. **Diario** `pg_dump` (custom `-Fc` o plain) a object storage con retención ≥ 14 días.
2. Antes de migraciones / cambio de authority / rotación de collection: dump ad-hoc + tag git.
3. Probar restore en staging al menos una vez por release que toque schema.
4. No confiar solo en el volumen Docker `helbreath_pg_data` sin snapshots del host.

### Restore de emergencia (outline)

```text
1. Parar game server + middleware (evitar writes durante restore).
2. Restaurar dump a una DB nueva o replace controlado.
3. Verificar: SELECT count(*) FROM drop_ledger; muestras de nft_claimed_at / nft_mint_address.
4. Arrancar middleware → GET /health (postgres: true).
5. Smoke: login wallet → listar /drops → no re-claim de filas ya claimed.
```

---

## 4. Flujo de claim (ops)

1. Jugador conecta Phantom → SIWS → token (`WALLET_AUTH_SECRET`).
2. UI llama `GET /drops?wallet=` (header `X-Wallet-Token`).
3. Claim: `POST /drops/:dropId/claim` con `{ wallet }` + token.
4. Middleware:
   - Drop existe, `account_wallet` coincide, `is_nft_candidate`, `nft_claimed_at IS NULL`.
   - Lock in-process por `dropId` (doble click / misma instancia).
   - **Lease DB** `UPDATE … SET nft_claim_lease_until = NOW()+120s WHERE unclaimed AND (lease NULL OR expired)` — falla → 409 in progress (otra réplica).
   - `mintDropCompressedNft` (`simulate` o Bubblegum `mintToCollectionV1`).
   - `UPDATE … SET nft_claimed_at, nft_mint_address, nft_claim_lease_until=NULL WHERE id AND nft_claimed_at IS NULL`.
   - Si mint falla: `releaseClaimLease` para que otro intento pueda adquirir.
5. Respuesta: `mintAddress`, `signature`, `explorerUrl` (devnet helper), `mintMode`.

**Endpoint legacy:** `POST /drops/:id/claimed` marca claimed sin mintear (reconciliación / clients viejos). Requiere token + ownership. Preferir no usarlo en UI nueva salvo recover.

**Kill switch rápido:** `HELBREATH_MINT_MODE=simulate` (sin txs) o quitar claim en UI / bajar middleware. No borra filas ya claimed.

---

## 5. Controles anti double-mint

| Control | Dónde | Qué cubre | Qué **no** cubre |
|---------|-------|-----------|------------------|
| `UNIQUE (account_wallet, item_uid)` | `idx_drop_ledger_wallet_item_uid` | Dos inserts del mismo item_uid/wallet | Cross-wallet clones; bugs de uid |
| Check `nft_claimed_at` pre-mint | `drops.js` claim | Request obvio ya claimed | Race entre dos requests concurrentes |
| **DB claim lease** (`nft_claim_lease_until`) | `persistence.tryAcquireClaimLease` | Multi-réplica: solo un worker minta por `drop_id` mientras el lease vive | Proceso que muere **después** del mint on-chain y **antes** del UPDATE final (huérfano; lease expira → riesgo de re-mint) |
| `UPDATE … WHERE nft_claimed_at IS NULL` | `persistence.markDropClaimed` | Solo un writer gana el claim permanente | — |
| Lock in-process `claimingDrops` | `drops.js` | Doble click / paralelismo en 1 proceso Node | Varias réplicas (cubierto por lease) |
| Auth wallet en `/claim` y `/claimed` | `requireWalletToken` | Mark/claim sin sesión | Voucher sin auth (gap conocido) |
| Métricas `mint_orphan_db_race` / `claim_lease_rejected` | `/metrics` | Visibilidad | — |

**Mejora 2026-07-11:** lease **antes** del mint (no theater). El gap residual es crash entre mint OK y `markDropClaimed` — ver § 6B. Mitigación futura: pending-mint row + reconcile, o cola single-writer.

---

## 6. Recuperación ante fallos de mint

### A) Mint falló (RPC / SOL / collection)

- Síntoma: `500` en claim; log `[drops] claim failed` / `[mint]`.
- Ledger: `nft_claimed_at` sigue `NULL`; lease liberado en el catch → el jugador puede reintentar.
- Acciones: fondear authority, chequear RPC, verificar env de collection/tree, `GET /health`.

### B) Mint OK, UPDATE falló o perdió la carrera (huérfano)

- Síntoma: log **`[drops] CRITICAL mint succeeded but ledger claim lost`** + contador `mint_orphan_db_race` en `/metrics`.
- On-chain: existe asset (`signature` / `assetId` en logs).
- DB: otra fila ya tiene `nft_claimed_at` **o** el UPDATE no aplicó (p.ej. legacy `/claimed`).

**Reconciliar (manual, ops):**

```sql
-- Inspeccionar
SELECT id, account_wallet, item_uid, nft_tier, nft_claimed_at, nft_mint_address, nft_claim_lease_until
FROM drop_ledger
WHERE id = '<drop_uuid>';

-- Si sigue unclaimed y el mint huérfano es el canónico:
UPDATE drop_ledger
SET nft_claimed_at = NOW(), nft_mint_address = '<assetId>', nft_claim_lease_until = NULL
WHERE id = '<drop_uuid>' AND nft_claimed_at IS NULL;
```

Si **ya** está claimed con **otro** `nft_mint_address`: documentar el asset extra (no re-claim). No borrar el NFT on-chain desde ops sin policy de producto. Escalar a review `[fable]` / custody.

### C) Claim 409 "already claimed" / "Claim already in progress"

- Already claimed: normal si el usuario reintenta. Verificar `nft_mint_address` y explorer.
- In progress: otra réplica (o el mismo proceso) tiene lease vivo; esperar ~2 min o chequear `nft_claim_lease_until`.
- Si el jugador no ve el NFT: chequear wallet destino = `account_wallet`, RPC indexer cNFT, `mintMode` no era `simulate`.

### D) Metadata rota en wallet

- `MIDDLEWARE_PUBLIC_URL` debe ser HTTPS público estable.
- `GET /metadata/:dropId` y `/metadata/collection` deben responder 200.

### E) Authority comprometida o rotación

1. `HELBREATH_MINT_MODE=simulate` o detener middleware mint.
2. No reusar la key filtrada.
3. Nueva authority + (si aplica) nueva collection/tree — proceso `[human]` + decisión en MASTERPLAN.
4. Filas ya claimed conservan `nft_mint_address` histórico.

### F) Lease pegado (crash pre-mint)

```sql
-- Liberar leases expirados no es necesario (acquire ya los ignora si lease < NOW()).
-- Forzar release de un drop atascado (solo si seguro que no hay mint en vuelo):
UPDATE drop_ledger SET nft_claim_lease_until = NULL
WHERE id = '<drop_uuid>' AND nft_claimed_at IS NULL;
```

---

## 7. Monitoreo (checklist)

### Cada deploy / diario

- [ ] `GET /health` → `ok`, `postgres: true`, `mintMode` esperado, `collectionMint` / `merkleTree` no null en prod onchain
- [ ] `GET /metrics` → `claims_ok` crece con actividad; `mint_orphan_db_race` ≈ 0; `claim_lease_rejected` puede subir con doble-click (OK)
- [ ] Logs sin spam de `claim failed` / airdrop (mainnet no debe pedir airdrop)
- [ ] Balance SOL de game authority por encima del umbral operativo
- [ ] Postgres: espacio disco + último backup exitoso

### Queries útiles

```sql
-- Unclaimed candidatos
SELECT count(*) FROM drop_ledger
WHERE is_nft_candidate AND nft_claimed_at IS NULL;

-- Leases activos
SELECT id, account_wallet, nft_claim_lease_until
FROM drop_ledger
WHERE nft_claimed_at IS NULL AND nft_claim_lease_until > NOW();

-- Claims últimas 24h
SELECT count(*) FROM drop_ledger
WHERE nft_claimed_at > NOW() - INTERVAL '24 hours';

-- Claimed sin mint address (anomalía)
SELECT id, account_wallet, item_uid, nft_claimed_at
FROM drop_ledger
WHERE nft_claimed_at IS NOT NULL AND (nft_mint_address IS NULL OR nft_mint_address = '');
```

### Alertas sugeridas (cuando haya stack de alertas)

| Señal | Severidad |
|-------|-----------|
| `/health` down o `postgres: false` | P1 |
| `mint_orphan_db_race` incrementa | P1 |
| Error rate claim 5xx > umbral | P2 |
| Authority SOL bajo | P2 |
| Backup job fallido | P1 |

---

## 8. Métricas / logging (middleware)

Contadores in-memory (reset al reiniciar el proceso):

| Key | Significado |
|-----|-------------|
| `claims_attempt` | Entradas a `/claim` |
| `claims_ok` | Mint + ledger OK |
| `claims_rejected` | 4xx de negocio (ownership, already claimed, lease, etc.) |
| `claims_error` | 5xx / excepciones |
| `claim_lease_rejected` | No se pudo adquirir lease (otra réplica / in-process) |
| `mint_orphan_db_race` | Mint on-chain OK pero `markDropClaimed` no actualizó fila |

Logs estructurados con prefijo `[drops]` / `[mint]` / `[metrics]`. El caso huérfano usa nivel CRITICAL en consola.

---

## 9. Fuera de este runbook (deuda `[fable]` / `[human]`)

- Crash window mint→finalize: pending-mint + reconcile job (lease cubre multi-réplica concurrente, no kill mid-flight).
- Auth en `/voucher` y deprecación segura de endpoints legacy.
- Rotación multisig (Squads) de mint authority / treasury.
- Threat model completo: wash, sybil wallets, metadata spoofing.
- Unbind / marketplace reconcile — ver `HERO-SET-UNBIND-MARKET.md` (Fase F).

---

## 10. Referencias rápidas

| Qué | Dónde |
|-----|--------|
| Env middleware | `middleware-node/.env.example` |
| Env server | `multiplayer/server/.env.example` |
| Schema ledger | `multiplayer/server/Persistence/schema.sql` |
| Compose Postgres | `multiplayer/docker-compose.yml` |
| Init collection devnet | `middleware-node/scripts/init-devnet-collection.js` |
| Rollback mint | MASTERPLAN § 7 (`HELBREATH_MINT_MODE`, authority offline) |
