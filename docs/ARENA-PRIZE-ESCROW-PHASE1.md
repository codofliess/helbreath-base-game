# Arena Prize Escrow — Fase 1 (implementación server)

> **Estado:** en código (2026-08-05). Ledger off-chain; on-chain / UI client después.  
> Contrato: [`ARENA-PRIZE-ESCROW-PHASE0.md`](./ARENA-PRIZE-ESCROW-PHASE0.md).

## Entregado

### Config
- `multiplayer/server/Config/ArenaPrizeWhitelist.json`  
  - Assets: **HELL, USDC, USDT, SOL, CNFT_DROP** (sin BTC/ETH)  
  - House sponsor toggle (default off, 10k HELL template)  
  - `dcGraceMinutes: 120`, `maxBagEdits: 5`

### Server
| Pieza | Rol |
|-------|-----|
| `ArenaPrizeEscrow.cs` | FSM bolsa, whitelist, settle/refund, combat snapshot, tick log |
| `ArenaPact.cs` | Wire: lock on accept, freeze on live, **dc_grace**, resume, forfeit 120m, sign loss, pledge/confirm |
| Buffs | `ActiveTemporaryEffectSlot` guarda duration + appliedAt → remaining al DC |
| `ForceCombatPools` | Restore HP/MP/SP desde snapshot |
| Proto | `ArenaPactPrizePledgeRequest` (104), `Confirm` (105), `SignLoss` (106); state fields 28–33 |

### DC rules (código)
1. Disconnect en `live`/`countdown` → **no void** del match.  
2. Snapshot: HP/MP/SP, gear durability, pots, **buffs good+bad**.  
3. Status `dc_grace`, bolsa `dc_grace`, timer 120 min.  
4. Reconnect mismo character → resume `live`, restore pools + buffs.  
5. Timeout → settle prize al otro equipo (`forfeit_dc_timeout`).  
6. `ArenaPactSignLossRequest` → settle inmediato (`signed_loss`).

### Victoria N v N
- Documentado: **equipo** gana; muerte de cap no settle.  
- Settle por eliminación de equipo: **pendiente** hook en combat death (Fase 1.1).

## Pendiente próximo

1. **UI client** (ArenaPactDialog): pledge / confirm / sign loss / mostrar bag state  
2. `pnpm proto:generate` en mp-client  
3. Hook combate: wipe de team → `TrySettle`  
4. Custodia real de tokens (middleware + Solana)  
5. Persist bag + combat snapshot a DB (hoy in-memory)

## Mensajes client (wire)

```
ArenaPactPrizePledgeRequest { match_id, asset_id, amount, instance_id? }
ArenaPactPrizeConfirmRequest { match_id }
ArenaPactSignLossRequest { match_id }

ArenaPactState + prize_bag_state, prize_lines[], prize_pending_confirm[],
  prize_summary, dc_character_name, dc_grace_ends_at_ms
```
