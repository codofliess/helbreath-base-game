# Session handoff — 2026-07-26 (madrugada)

Continuar mañana desde aquí. Repo: `C:\Users\54116\helbreath-base-game`.

## Live stack

| Pieza | Estado |
|-------|--------|
| VPS **en producción (único)** | **CX53** `chainlords-cx53-fsn1` · **16 vCPU / 32 GB / 320 GB** · IP **`46.224.129.38`** (misma IP pública de play; reasignada) |
| Game (live) | `systemctl chainlords-game` · `/opt/chainlords/server` · WS `:1337` |
| Client (live) | nginx `play.chainlords.net` → **46.224.129.38** `/opt/chainlords/client` |
| Postgres | docker `helbreath-postgres` · volume `helbreath_pg_data` · `127.0.0.1:5432` |
| SSH | `~/.ssh/hetzner_chainlords` → `root@46.224.129.38` |

**Mudanza 2026-07-26:** stack copiado CX43→CX53 (rsync + pg_dump), IP `46.224.129.38` movida al CX53, **CX43 y cpx32 borrados**. DNS Cloudflare **sin cambio** (misma IP).  
Scripts: `ops/migrate-to-cx53.sh`, `ops/ip-swap-to-cx53.sh`.

**Crédito Hetzner:** API no da saldo. Ahora solo se factura **~€34.99/mo** del CX53 (antes ~CX43+CX53+cpx32). Ver console Billing.

## Deploy atómico cliente

- Script: `ops/deploy-client-atomic.ps1` (HTML + JS + CSS juntos + verify).
- **Incidente:** deploy parcial subió JS sin CSS (`index-CY6Hz5qk.css` 404) → hub roto (sin columnas) y dock sin estilos.
- **Fix:** CSS restaurado + nginx `@assets_missing` no-store para no cachear 404 en CF.
- Siempre verificar: `index.html` refs existen en disco y HTTP 200.

## Peso / carry (fix + deploy esta sesión)

**Bug:** gold (item id **90**) se pesaba `weight × qty` sin el **/20** de Olympia (`iGetItemWeight`).

| Ejemplo | Sin fix | Con fix |
|---------|---------|---------|
| 37.6k gold | ~376 piedras | ~19 piedras |

**Capacidad (OK):** `(STR + Level) × 5` piedras · raw = ×100.

**Archivos:**

- `multiplayer/server/Utils/ItemWeightCatalog.cs` — `GetStackWeight` (+ gold /20)
- `multiplayer/server/Helpers/PlayerDerivedStats.cs` — usa stack weight
- `multiplayer/mp-client/src/utils/CarryWeight.ts` — mismo en UI bag

**Server publish:** self-contained linux-x64 → `/opt/chainlords/server` (no usar `--self-contained false` o rompe el host).

## Mobs bajo “alfombra” / flicker

- `ENTITY_DEPTH_BIAS = 50` en `Config.ts` (antes +20).
- `GameObject.ts` + `PlayerAppearanceManager.ts` usan el bias.
- Map objects siguen en `y * DEPTH_MULTIPLIER`. Si un objeto **alto** en fila Y+1 tapa, hay que tratar floors vs walls (pendiente).

## UI hub / dock (sesión previa)

- Hub login **no** muestra barra inferior (diseño: dock solo in-world con `showWorldHud` + `game-world-active`).
- CSS bundle debe existir o el hub se ve como arte + texto crudo.

## Pendiente mañana (prioridad)

1. Confirmar peso in-game tras hard refresh (bag footer no ~516 solo por gold).
2. Confirmar mobs en pads / carpets.
3. Minimap thumbs de pits (siguen letter-only a veces; bulk extract desactivado).
4. Farm gray pad warp 117,158 r=1 + recall (verificar live).
5. Specialty UI bajo F5 Statistics (no Shift+F11).
6. **CX53 / crédito Hetzner** — ver estado al reabrir (API no da balance de crédito de Cloud Console; mirar panel Hetzner o facturación).
7. Soft test ~10 amigos post-upgrade si hay SKU.

## Comandos útiles

```powershell
# Client atomic
pwsh -File ops/deploy-client-atomic.ps1

# Server self-contained
cd multiplayer/server
dotnet publish -c Release -r linux-x64 --self-contained true -o .\publish-linux-sc
# tar + scp a /opt/chainlords/server ; systemctl restart chainlords-game

# Live check
ssh -i $env:USERPROFILE\.ssh\hetzner_chainlords root@46.224.129.38 "systemctl is-active chainlords-game nginx; hostname; free -h | head -2"
```

## No afirmar “fixed” hasta

Usuario confirma con captura: hub 3 columnas, dock in-world, peso razonable, mobs sin carpet flicker crítico.
