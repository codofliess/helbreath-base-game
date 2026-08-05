# VPS Hetzner — CX52 / CX53 · soft test

**Estado (2026-07-21):** PO **mañana** sube el **game stack** a Hetzner (**CX53** según PO; doc histórico decía **CX52** — **confirmar SKU al pagar/provisionar**).

**Soft test:** ~**10 amigos** (closed), no launch marketing.

## Spec (referencia)

| Plan | CPU / RAM / Disk | Rol |
|------|------------------|------|
| **CX52** (doc 07-18) | 16 vCPU · 32 GB · 320 GB · ~€32/mes | 1er mes holgado |
| **CX53** (PO 07-21) | Confirmar en Hetzner Cloud al crear | Mismo rol |

Ambos alcanzan para soft test 10 + head.

## Qué va en el VPS

- Game server (C# / WebSocket)
- Postgres (chars / progression)
- nginx/Caddy: `play.chainlords.net` (traveler static + proxy WS)
- **social-bot** (Discord FAQ Grok 4.1) vía `pm2` o systemd
- Opcional: middleware Node local  
  — **hoy** middleware market/auth ya está en Railway:  
  `https://chainlords-middleware-production.up.railway.app`

## Qué se queda fuera del VPS (por ahora)

- Landing `chainlords.net` → **Railway**
- Middleware market (puede quedarse Railway)

## Env game (mínimo soft test)

```
MARKET_MIDDLEWARE_URL=https://chainlords-middleware-production.up.railway.app
MARKET_SYNC_SECRET=<mismo que Railway chainlords-middleware>
# + DATABASE_URL, WALLET_AUTH_SECRET, etc.
```

## Env social-bot en VPS

```
DISCORD_BOT_TOKEN=...
XAI_API_KEY=...
XAI_MODEL=grok-4-1-fast-non-reasoning
MARKET_API_URL=https://chainlords-middleware-production.up.railway.app
DISCORD_GUILD_ID=1528992494920925305
DISCORD_SUPPORT_CHANNEL_IDS=...
```

## Cuando el PO avise “ya pagué / tengo IP”

1. SSH root + key  
2. Docker compose: game + postgres + caddy  
3. TLS `play.chainlords.net`  
4. Wire landing `__CHAINLORDS_PLAY_URL__`  
5. Arrancar bot + 10 invites Discord  
6. Smoke 2–3 wallets externas  

Detalle orden: [`BITACORA.md`](./BITACORA.md) 2026-07-21 (tarde) · MASTERPLAN § **1.7.4** soft test.

## No day-0 de los 10

- pump.fun / moon  
- `MARKET_PAY_MODE=live` sin treasury  
- promesa airdrop $  
- open public sin cupo  
