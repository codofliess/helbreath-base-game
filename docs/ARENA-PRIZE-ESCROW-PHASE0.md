# Arena Prize Escrow — Fase 0 (contrato de producto)

> **Estado:** contrato firmado por PO (2026-08-05). No es implementación.  
> **Producto:** Chain Lords — duelos por botín (bolsas aportadas + escrow + settle).  
> **Fuente de verdad del combate y del settle:** solo el **game server**.  
> Relacionado: [`ArenaPact.cs`](../multiplayer/server/Helpers/ArenaPact.cs) (FSM actual; stakes “solo anotados”),  
> [`CRYPTO-LOOT-AND-NFT-SWAPS.md`](./CRYPTO-LOOT-AND-NFT-SWAPS.md),  
> [`MASTERPLAN-PVP-STREAM-CARTELERA.md`](../multiplayer/docs/MASTERPLAN-PVP-STREAM-CARTELERA.md).

---

## 1. Objetivo

Permitir duelos (1v1 y N v N) donde el **premio** es una **bolsa de recompensa** armada por los **capitanes** (y opcionalmente sponsor de la casa), en **custodia (escrow)** hasta que el game server declare un ganador.

El cliente C++ (fase posterior) y la wallet **no** deciden el resultado: solo firman pledges y muestran estado.

---

## 2. Decisiones de producto (Fase 0)

### 2.1 Qué se puede apostar

| Clase | Ejemplos | Regla |
|-------|----------|--------|
| **cNFT / NFT** | drops mintables, gear on-chain | Solo assets **whitelist** por smart contract / config firmada por nosotros |
| **SPL / tokens** | **$HELL**, USDT, USDC, SOL | Whitelist + denominación de origen |

**Fuera de alcance (PO 2026-08-05):** BTC y ETH — suman complejidad de bridge/custody; no se apuestan.

**Principios:**

1. **Whitelist cerrada** controlada por nosotros (program config / admin table + on-chain allowlist).
2. Cada asset tiene **origen y denominación** explícitos (`chain`, `mint_or_asset_id`, `decimals`, `kind`).
3. Nada entra a la bolsa si no pasa el gate de whitelist **antes** del lock.
4. Items in-game “solo servidor” (sin mint) pueden ser fase 1 off-chain; on-chain/wallet assets usan el mismo modelo de bolsa.

### 2.2 Quién aporta a la bolsa

| Formato | Quién pledges |
|--------|----------------|
| **1v1** | Ambos rivales (cada uno es “capitán” de su lado) |
| **N v N** | **Solo los capitanes** de cada equipo conforman la bolsa |
| **Sponsor casa** (opcional) | Chain Lords puede agregar p.ej. **10 000 $HELL** por duel por un tiempo, revisable |

El resto del roster pelea; **no** mete assets a la bolsa salvo decisión futura explícita.

**Victoria N v N (PO 2026-08-05):** el resultado es **por equipo**. Si muere el capitán **no** decide el duelo; sigue el combate hasta wipe / eliminación del equipo contrario.

### 2.3 Cuándo se lockea

1. **Lock inicial** al **aceptar el duelo** (ambos lados / capitanes en estado de conformidad).
2. **Edición opcional de bolsa** si alguien olvidó un asset:
   - Al editar → la bolsa pasa a `editing` / `pending_reconfirm`.
   - **Ambos capitanes** deben volver a dar **OK de conformidad**.
   - Sin doble OK, el duelo **no** entra a ready/countdown/live con la nueva bolsa.
3. Una vez en **live**, la bolsa está **cerrada** (no más edits).

### 2.4 Resultado del combate — sin empates

- **No existe empate.** El duelo termina cuando un lado es eliminado (muerte / wipe de equipo según reglas N v N).
- Ganador declarado **solo por game server**.

### 2.5 Disconnect / apagón (forced DC)

| Situación | Comportamiento |
|-----------|----------------|
| DC de un jugador/capitán en live | **No** se reinicia el duelo desde cero |
| Estado guardado | Snapshot de combate: **HP, pots, durabilidad de armaduras, buffs buenos y malos** (y lo necesario para retomar) al instante en que el server perdió input confiable |
| Buffs al re-login | El que se desloguea y vuelve **mantiene los buffs** que tenía al DC (beneficios y perjuicios), con remaining time del snapshot |
| Bolsa | Sigue **armada y locked** |
| Resume | Se retoma **desde el último contexto** (no round 1 clean) |
| Ventana de reaparición | Si el que hizo DC **no** vuelve en **120 minutos** → la bolsa se la lleva el rival (forfeit por abandono) |
| Rendición firmada | El que hizo DC puede **firmar la pérdida** antes de los 120 min → settle inmediato al rival |
| Logs | Ideal: **trace por segundo** (o tick de combate) mientras el duelo está vivo / en grace DC |
| Post-settle | Comprimir a **historial mínimo**; retener raw solo si hay disputa o hasta TTL de ops |

### 2.6 Fuente de verdad

| Dominio | Autoridad |
|---------|-----------|
| Combate, HP, pots, endurance, muerte, forfeit | **Game server** |
| Whitelist de assets | Config / program (nosotros) |
| Custodia de assets on-chain | Programa escrow + authority de settle del server/oracle |
| Firma de “acepto bolsa” / “firmo pérdida” | Wallet del capitán (cliente solo transporta) |
| Quién ganó | **Nunca el cliente** |

---

## 3. Máquina de estados (bolsa + match)

```
                  ┌──────────────┐
                  │  drafting    │  capitanes arman pledges
                  └──────┬───────┘
                         │ accept + both OK
                         ▼
                  ┌──────────────┐
           ┌──────│   locked     │◄──── both re-OK after edit
           │      └──────┬───────┘
           │ edit        │ ready → countdown → live
           ▼             ▼
    ┌────────────┐  ┌──────────────┐
    │  editing   │  │    live      │  bolsa cerrada
    └─────┬──────┘  └──────┬───────┘
          │                │ death / wipe
          │                ├──────────────► settled_winner
          │                │
          │                │ DC
          │                ▼
          │         ┌──────────────┐
          │         │  dc_grace    │  120 min, bolsa locked
          │         │  (resume OK) │
          │         └──────┬───────┘
          │                ├ resume ──► live (mismo contexto)
          │                ├ sign_loss ──► settled_winner
          │                └ timeout 120m ──► settled_forfeit
          │
          └── cancel pre-live (reglas de refund) ──► refunded
```

**Estados de bolsa (sugeridos):**

| Estado | Significado |
|--------|-------------|
| `drafting` | Pledges propuestos, no custodiados aún o en hold suave |
| `locked` | Custodia plena; ambos OK |
| `editing` | Uno pidió cambio; requiere re-confirm de ambos |
| `live_frozen` | Duelo en curso; no edits |
| `dc_grace` | Un lado en DC; bolsa intacta; clock 120m |
| `settled` | Premios transferidos al ganador |
| `refunded` | Cancel pre-live o invalidación admin |

---

## 4. Roles

| Rol | Puede |
|-----|--------|
| **Capitán** | Pledge, editar (con re-OK), firmar loss, aceptar bolsa |
| **Miembro de equipo** | Pelear; no arma la bolsa |
| **Sponsor (casa)** | Inyectar $HELL (u otro asset whitelist) con tope/campaña |
| **Game server** | Tick combate, snapshot DC, resume, declare winner, emitir settle |
| **Middleware / program** | Auth wallet, transfer/escrow on-chain según instrucción firmada del server |

---

## 5. Snapshot de combate (resume DC)

### 5.1 Mínimo para “retomar como quedó”

Por fighter (y por equipo si aplica):

- HP / MP / SP actuales y máximos
- Inventario de **pots consumibles** relevantes al PvP (counts + uids si stack)
- **Durabilidad** de gear equipado (`curLifeSpan` / `maxLifeSpan`)
- Posición en mapa arena, facing, team
- Buffs/debuffs con remaining ms (si el PvP arena los usa)
- Timestamp server del último input confiable
- MatchId + phase (`live` / `dc_grace`)

### 5.2 Trace por segundo (o por tick)

Mientras `live` o `dc_grace`:

- Append-only log: `t, fighterId, hp, mp, sp, x, y, event?`
- Eventos discretos: cast, hit, pot use, equip break, death, dc, reconnect

**Post-settle:**

- Comprimir a resumen: participantes, bolsa hash, winner, reason (`kill` / `forfeit_dc` / `signed_loss`), duración, scores
- Borrar o archivar cold storage el raw tras TTL (ej. 7–30 días) salvo dispute flag

---

## 6. Flujo de settle (alto nivel)

```
Game server: WinnerDeclared(matchId, winnerCaptainId, reason)
    → Escrow service: verify match state + authority
    → Transfer prize bag → winner wallet / character bind
    → Emit PrizeSettled
    → Compress combat log
```

Razones de settle:

| Reason | Quién gana |
|--------|------------|
| `elimination` | Lado que queda vivo |
| `forfeit_dc_timeout` | Rival del que no volvió en 120m |
| `signed_loss` | Rival del que firmó pérdida |
| `admin_void` | Refund o resolución manual (ops) |

---

## 7. Whitelist de assets (contrato conceptual)

```text
AssetPolicy {
  assetId          // stable id interno
  kind             // cnft | nft | spl | native_sol | wrapped
  chain            // solana | ...
  mintOrProgramId  // pubkeys
  originLabel      // "HELL", "USDC", "cNFT drop v1"
  decimals
  minPledge
  maxPledge
  enabled
}
```

- Actualización solo por **ops / governance** (no por jugadores).
- Cliente solo lista assets `enabled=true`.

### 7.1 Sponsor casa (ejemplo)

```text
HouseSponsorCampaign {
  assetId: HELL
  amountPerDuel: 10_000
  startsAt / endsAt
  maxTotalBudget
  enabled
}
```

Se suma a la bolsa en `locked` (o en drafting visible) y se paga al winner en settle.

---

## 8. Relación con el stack actual (sin romper)

| Hoy | Fase 0 implica |
|-----|----------------|
| `ArenaPact` stakes “anotados” | Sustituir/ampliar por **PrizeBag + Escrow FSM** |
| Auction escrow (items server) | Reusar patrón de custodia para assets in-game |
| Wallet auth middleware | Firmas de pledge / signed_loss / re-OK |
| Client web ArenaPactDialog | UI de bolsa (antes de C++) |
| Client C++ arena (futuro) | Misma API; mejor feel de combate |

**Orden seguro de build (recordatorio):**

1. Escrow off-chain + whitelist config + settle server-only  
2. DC grace + snapshot resume + 120m forfeit + signed loss  
3. Combat second-log + compress  
4. On-chain custody para SPL/cNFT  
5. Cliente C++ arena  

---

## 9. Riesgos abiertos (a cerrar en Fase 1 diseño técnico)

| Riesgo | Nota |
|--------|------|
| **N v N wipe rules** | ¿muere el capitán = forfeit equipo, o wipe total? |
| **Pots / bag mid-duel** | Qué cuenta como “pot state” para resume |
| **Anti-cheat del signed loss** | Firma wallet + matchId + nonce anti-replay |
| **Server crash mid-duel** | Mismos snapshots en DB; resume multi-node |
| **Double spend de cNFT** | Lock on-chain antes de `live` |
| **Edits de bolsa abusan time** | Cap de edits / deadline antes de ready_window |
| **Honor duels** | Siguen existiendo sin bolsa (`honor` path actual) |
| ~~BTC/ETH~~ | **Descartados** por PO |

---

## 10. Criterios de aceptación (Fase 0 cerrada)

- [x] Assets: whitelist + origin denomination definidos  
- [x] Aportan: capitanes (1v1 = ambos; NvN = solo caps) + sponsor opcional  
- [x] Lock al accept; edit con re-OK dual  
- [x] Sin empate; DC → snapshot resume; 120m forfeit; signed loss  
- [x] Logs densos pre-settle; compress post-settle  
- [x] Solo game server declara winner  

**Siguiente doc (Fase 1 técnica):** mensajes proto, tablas DB, API escrow, y wire en `ArenaPact` sin C++ todavía.

---

## 11. Changelog

| Fecha | Cambio |
|-------|--------|
| 2026-08-05 | Fase 0 capturada desde decisiones PO (wallet whitelist, capitanes, lock/edit, DC 120m, logs, GS SoT). |
| 2026-08-05 | N v N = victoria de **equipo** (muerte de cap no decide). Sin BTC/ETH. DC restore **buffs good+bad**. |
