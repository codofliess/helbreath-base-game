# Arena C++ Client — Option B (producción)

> **Decisión PO 2026-08-05:** fork del motor C++ estilo Olympia **solo Arena**;  
> client **web** = open world; si C++ + blockchain rinde → migrar el resto después.  
> **No** reutilizar protocolo legacy del server C++ de Helbreath.  
> **Sí** wire a nuestro server **.NET + protobuf + WebSocket** (mismo que el web).

Relacionados:  
[`ARENA-PRIZE-ESCROW-PHASE0.md`](./ARENA-PRIZE-ESCROW-PHASE0.md) ·  
[`ARENA-PRIZE-ESCROW-PHASE1.md`](./ARENA-PRIZE-ESCROW-PHASE1.md) ·  
código scaffold: [`clients/arena-cpp/`](../clients/arena-cpp/)

---

## 1. Visión dual-client

```
┌─────────────────────┐         ┌──────────────────────┐
│  Web client (hoy)   │         │  Arena C++ (nuevo)   │
│  world / farm / UI  │         │  solo fightzones     │
│  Phaser + our VFX   │         │  motor C++ feel PvP  │
└─────────┬───────────┘         └──────────┬───────────┘
          │  WS + protobuf                 │  WS + protobuf
          └────────────┬───────────────────┘
                       ▼
              ┌─────────────────┐
              │  Game Server    │  ArenaPact + PrizeEscrow + combat SoT
              │  .NET           │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │  Middleware     │  wallet auth · escrow on-chain (fase posterior)
              │  Solana         │
              └─────────────────┘
```

| Superficie | Client | Notas |
|------------|--------|--------|
| Open world, farm, bag, F-keys | **Web** | Sigue siendo el producto diario |
| Duelos por botín / feel PvP | **C++ Arena** | 5–8 mapas `fightzone*` |
| Auth wallet | Ambos | Mismo middleware challenge/sign |
| SoT combate / bolsa | Server | Nunca el client |

---

## 2. Qué se fork / qué es nuestro

### Del client Olympia / HB (motor)
- Loop de juego, input, timing de cast/melee  
- Carga de `.amd` / sprites de personaje en arena  
- Predicción local de movimiento (adaptada a nuestro wire)

### Nuestro (no se tira)
- **Arte** Chain Lords (sprites, UI, branding)  
- **VFX de magias** del stack actual (portar frames/sheets o reimplementar sobre el motor C++ con los mismos assets)  
- **Reglas de producto**: prize bag, DC grace, team wipe, whitelist HELL/USDC/USDT/SOL/cNFT  
- **Server** .NET existente  

### Explicitamente NO
- Protocolo legacy Helbreath (MSGID_*)  
- Server C++ clásico como backend de arena  
- Cargar Aresden/Elvine/ML en el exe Arena  
- BTC/ETH en bolsas  

---

## 3. Mapas allowlist (solo arena)

| World id | Map asset | Uso |
|----------|-----------|-----|
| `colosseum` | `fightzone1` | default medium |
| `arena-duel-s` | `fightzone4` | small |
| `arena-duel-m` | `fightzone1` | medium |
| `arena-duel-l` | `fightzone5` | large |
| `arena-tourney` | `fightzone8` | tourney |
| `arena-btfield` | (btfield) | xlarge opcional |

Cualquier otro `preferred_initial_world_id` se **rechaza** en el client C++.

---

## 4. Wire (producción)

1. **TLS WebSocket** → mismo host que el web (`wss://play…` / local).  
2. **Frames:** length-prefix + protobuf `ClientMessage` / `ServerMessage` (igual que `mp-client`).  
3. **Login:** wallet challenge (HTTP middleware) → `AuthenticateRequest` con token.  
4. **Arena entry:** `preferred_initial_world_id` = `colosseum` | `arena-duel-*` + `arena_kit_json`.  
5. **Pact:** create / invite / respond / ready / tech / prize pledge / confirm / sign loss.  
6. **Combat:** mismos mensajes de move / cast / attack que el web (subset).

Generación C++: `protoc --cpp_out` desde `multiplayer/proto/network.proto`  
(script: `clients/arena-cpp/scripts/gen-proto.ps1`).

---

## 5. Roadmap de producción

| Milestone | Entrega | Criterio de done |
|-----------|---------|------------------|
| **M0** | Scaffold + docs + allowlist | ✅ `docs/ARENA-CPP-CLIENT-FORK.md` + `clients/arena-cpp` (2026-08-05) |
| **M1** | WS + Authenticate + InitialState | Entra a `colosseum` como spectator/fighter stub |
| **M2** | Move + render 1 mapa + 2 players | Feel básico de walk en fightzone1 |
| **M3** | Cast/melee subset + **our VFX** | 3–5 spells con VFX Chain Lords |
| **M4** | ArenaPact full UI (ready/tech) | Duelo honor end-to-end vs web opponent |
| **M5** | Prize bag UI + escrow messages | Pledge/confirm/sign loss vivo |
| **M6** | Wallet deep-link + on-chain settle | Bolsa real (post off-chain stable) |
| **M7** | Go/no-go migrate world | Si PvP feel + bolsa OK → plan world port |

---

## 6. Import del árbol Olympia

El repo solo tiene extractos en `reference/Client.cpp`.  
Para M1–M2 se necesita el **client completo** (sources + assets) en:

```
clients/arena-cpp/vendor/olympia-client/   # git submodule o drop local (no commitear assets enormes si LFS no está)
```

Checklist import:
- [ ] Compila en VS 2022 x64  
- [ ] Carga `fightzone1` offline  
- [ ] Strip de mapas no-arena  
- [ ] Branch `cl-arena` sin tocar web  

---

## 7. Política de assets / VFX

| Asset | Source of truth |
|-------|-----------------|
| Character / gear pixels | Packs Chain Lords del web client (export o share folder) |
| Magic VFX | Sheets/anim del `mp-client` (BloodyShockWave, EnergyStrike, …) portados a C++ |
| UI Arena | Nueva (skin CL), no DialogBox Olympia cruda |
| Maps | Solo fightzones listados |

---

## 8. Criterio de éxito del experimento

- Feel de cast/hit **mejor** que web (subjetivo PO + testers PvP)  
- Duelo con **bolsa locked** y settle server-only  
- Cero dependencia del server C++ legacy  
- Web world **no roto**  

Si falla: se tira el client C++, se mantiene escrow en web.  
Si gana: se planifica port del world (no big-bang el día 1).

---

## Changelog

| Fecha | Nota |
|-------|------|
| 2026-08-05 | Option B producción: dual-client, wire nuestro, mapas arena only, scaffold `clients/arena-cpp`. |
