# Session handoff — 2026-08-05 (pre PC-reset)

**Objetivo de este doc:** que tras resetear la PC no se pierda el contexto de Arena + ops.  
Repo canónico: `C:\Users\54116\helbreath-base-game`  
Branch git: **`consolidacion`** · remote: `https://github.com/codofliess/helbreath-base-game.git`  
Docs vivos: [`MASTERPLAN.md`](./MASTERPLAN.md) · [`BITACORA.md`](./BITACORA.md)

---

## Qué va a dónde (política backup)

| Qué | Dónde | Notas |
|-----|--------|--------|
| Código fuente (client/server/middleware/docs) | **GitHub** `consolidacion` | Sin secrets, sin publish bins |
| Docs densos + handoff + bitácora | **GitHub** + **Google Drive** | Drive = espejo legible offline |
| `publish-*-sc/`, `dist/`, `tmp-*`, logs, `.tgz`, screenshots PO | **Google Drive** (pesado) | **No** commitear |
| `.env`, keys SSH, tokens social-bot | **Solo local / password manager** | Nunca git |

Drive cuenta: `martin.fliess@grupofliess.com.ar`  
Carpeta esperada: `ChainLords-Arena-Session-2026-08-05` (My Drive).

---

## Live stack (no cambia con reset local)

| Pieza | Valor |
|-------|--------|
| VPS | Hetzner CX53 · IP **`46.224.129.38`** |
| Game | `systemctl` `chainlords-game` · `/opt/chainlords/server` · WS **:1337** |
| Client | nginx `play.chainlords.net` → `/opt/chainlords/client` |
| Postgres | docker en VPS · `127.0.0.1:5432` |
| SSH (local post-reset) | re-crear key o restaurar `~/.ssh/hetzner_chainlords` → `root@46.224.129.38` |
| Dominio | Cloudflare → misma IP (DNS no toca) |

Deploy client: preferir script atómico (`ops/deploy-client-atomic.ps1` si existe) — HTML+JS+CSS juntos.  
Server publish: **self-contained linux-x64** → `/opt/chainlords/server` (no framework-dependent en host viejo).

---

## Trabajo Arena shipped esta sesión (resumen)

### 1) Landing desk

- Phaser: `multiplayer/mp-client/src/game/ui/ArenaSelectCharDesk.ts` (+ related SelectChar desk).
- React: `BleedingOnlineStrip.tsx`, `DeskModeJumpTab.tsx`, CSS `rpg-ui.css`.
- Regla: Phaser character UI **above** React chrome; strip BI + footer spacing fixed.

### 2) $HELL incentives

| Acción | $HELL |
|--------|------:|
| AFK BI ≥ 2h | 5 000 |
| Duel (pact) | 10 000 |
| Stream/announce bonus | 20 000 |

- Server: `Helpers/ArenaIncentives.cs`, `HellMining.cs`, `HellMiningStore.cs`, `ArenaPact*.cs`, `AntiBotTools` (BI anti-AFK off).
- Social: X + Discord announce (social-bot / pact Discord).

### 3) Kit catalog free vs credits

- Config: `Config/ArenaKitCatalog.json` + client `constants/ArenaKitCatalog.ts` + `utils/arenaKits.ts`.
- Server apply: `Helpers/ArenaLoadout.cs`.
- UI: `ArenaKitBuilderDialog.tsx` + store.
- Free: path-filtered war/mage; HP/MP free sets; **no** plain Cape 400.
- Credits: DR/MR + MCon capes (dual DR pieces).
- Heroes mage: Cap/Robe/Hauberk visible — `OlympiaItems.generated` sprites **416/420** + `PlayerAppearanceManager` gender fallback.
- STR: Blood Rapier **39**, Merien Shield **40** — `Utils/ItemEquipCatalog.cs`.
- Sanitize unknown SKUs (legacy `set-hp50-war`) client+server so Complete no se bloquea.

### 4) Cast / mana / credit spells

- `PlayerDerivedStats.cs`: full cast **~1200 ms** (Magic 100% o Mag≥50); slow **~1800**.
- `MagicManaCatalog.cs` + reference `Magic.cfg` costs.
- Credit-gated arena: spell ids **45 Inhib, 46 Cancel, 52 Sleep** (`IsArenaCreditGatedSpell`).
- INT gates use Angel INT.
- **TBD:** Mass Blizzard credit-only.

---

## Archivos “no perder” (checklist git)

Prioridad alta (código de esta ola Arena):

```
docs/BITACORA.md
docs/MASTERPLAN.md
docs/SESSION-HANDOFF-2026-08-05.md
docs/** (resto)
multiplayer/server/Helpers/Arena*.cs
multiplayer/server/Helpers/HellMining*.cs
multiplayer/server/Helpers/PlayerDerivedStats.cs
multiplayer/server/Helpers/ChargeWand.cs
multiplayer/server/Helpers/Casting.cs
multiplayer/server/Helpers/AntiBotTools.cs
multiplayer/server/Utils/MagicManaCatalog.cs
multiplayer/server/Utils/ItemEquipCatalog.cs
multiplayer/server/Config/ArenaKitCatalog.json
multiplayer/server/Config/AntiBotTools.json
multiplayer/mp-client/src/game/ui/ArenaSelectCharDesk.ts
multiplayer/mp-client/src/constants/ArenaKitCatalog.ts
multiplayer/mp-client/src/utils/arenaKits.ts
multiplayer/mp-client/src/ui/components/BleedingOnlineStrip.tsx
multiplayer/mp-client/src/ui/components/DeskModeJumpTab.tsx
multiplayer/mp-client/src/ui/dialogs/ArenaKitBuilderDialog.tsx
multiplayer/mp-client/src/ui/store/ArenaKitBuilder.store.ts
multiplayer/mp-client/src/utils/PlayerAppearanceManager.ts
multiplayer/mp-client/src/constants/OlympiaItems.generated.ts
multiplayer/mp-client/src/ui/rpg-ui.css
```

**Excluir siempre:**

```
multiplayer/server/publish-*/
multiplayer/server/**/*.log
multiplayer/server/_deploy_*.tgz
multiplayer/mp-client/dist/
multiplayer/mp-client/_deploy_client.tgz
tmp-*/
tmp_*
**/node_modules/
**/.env
```

---

## Post-reset: primeros pasos

1. Instalar Git, Node/pnpm, .NET SDK, OpenSSH, Cursor/Grok.
2. `git clone https://github.com/codofliess/helbreath-base-game.git` → `git checkout consolidacion` → `git pull`.
3. Restaurar `.env` middleware / social-bot / server desde backup cifrado (no están en git).
4. Restaurar SSH key Hetzner.
5. `pnpm install` en `multiplayer/mp-client`; `dotnet restore` en server.
6. Hard refresh play + smoke: Complete kit, mage hero look, cast timing, claim BI hell.
7. Si hace falta rebuild pesado offline: bajar `publish-*-sc` desde Drive (no del git).

---

## Pendiente producto (no bloquea backup)

1. Mass Blizzard credit gate (PO).
2. Re-verify free sets path-filter + DR cape only on credits shop.
3. Capa C PvP feel (videos Tola) — ver BITACORA 2026-07-30.
4. Review `[fable]` mint fee / antibot airdrop docs preexistentes.

---

## Contact / cuentas

- Google Workspace (Drive docs): `martin.fliess@grupofliess.com.ar`
- GitHub org/user: `codofliess/helbreath-base-game`
- Play: `https://play.chainlords.net` (confirmar DNS post cualquier cambio CF)

*Fin handoff 2026-08-05.*
