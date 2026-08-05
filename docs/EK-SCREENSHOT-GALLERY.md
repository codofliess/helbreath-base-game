# EK auto-screenshot + galería landing

> Investigación Olympia + arquitectura MVP (2026-07-13).
> Relacionado: [`EK-LEDGER.md`](./EK-LEDGER.md) (elegibilidad / ladder), Fase G en [`MASTERPLAN.md`](./MASTERPLAN.md).

**Estado:** MVP captura cliente + stub upload/galería. Ladder de killers por ciudad y rareza real = **TBD**.

---

## 1. Cómo lo hace Olympia (evidencia)

Fuente primaria: `%AppData%\Roaming\Helbreath Olympia\olympia_log.txt` + carpeta `SAVE\eks\`.

### Flujo observado (cada EK)

1. **Award EK** — log: `Enemy Kill: {victim} (N -> N+1, +Exp)`.
2. **Schedule** inmediato — `Scheduled EK screenshot for {victim} ({tick})`.
3. **Delay ~650 ms** — delta de tick y timestamps de reloj ≈ **650–657 ms** de forma estable (dejar que la muerte/cuerpo entre en frame).
4. **Capture** — `Taking Enemy Kill screenshot...` → JPEG backbuffer.
5. **Path** — `...\Helbreath Olympia\SAVE\eks\{VictimName}_{NNN}.jpg`
   - `{NNN}` = contador **por nombre de víctima** (`_000`, `_001`, …).
   - Caracteres especiales en el nombre se preservan (`thc!`, `!Okabe`).

### Distinción vs screenshot manual

| Tipo | Path | Naming |
|------|------|--------|
| **EK auto** | `SAVE\eks\` | `{Victim}_{NNN}.jpg` |
| **Manual (PrintScreen-ish)** | `SAVE\` | `Helbreath Olympia #{n}.jpg` |

El `CreateScreenShot()` del reference `Client.cpp` (HelShot + CxImage BMP→JPG) es el path **manual** genérico; el path **EK** es un add-on Olympia (schedule + carpeta `eks`), no presente en nuestro `sp-client/reference/Client.cpp`.

### Artefactos en disco (carpeta PO)

### Tamanos observados (inspeccion 2026-07-13)

- **46** JPEG en `SAVE\\eks\` en esta maquina.
- Magic `FF D8 FF E0` (JFIF).
- Resolucion tipica **800x600** (SOF0).
- Peso ~**272–354 KB** (avg ~317 KB).
- Contador por victima verificado: `Tanito_000.jpg` / `Tanito_001.jpg`, `ViolentKaz_000.jpg` / `ViolentKaz_001.jpg`.
- Sin sidecar JSON/XML junto a los JPG.


- Solo **JPEG** (magic `FF D8`); **sin** sidecars JSON/XML en `eks\`.
- Metadato = **nombre de archivo** + mtime del FS; el log guarda el path absoluto al capturar.
- En esta máquina la carpeta puede estar vacía hoy; el log documenta decenas de capturas históricas con el patrón anterior.

### Config

`launcher.ini` no expone toggle de EK screenshot (gore/windowed/etc.). La captura EK parece **siempre on** cuando hay Enemy Kill.

---

## 2. Reglas de rareza galería (locked PO · 2026-07-13)

Ranking = posición de la **víctima** en el ladder de **killers de la ciudad opuesta** (no Elo torneo).

| Rareza | Rank víctima (killers ciudad opuesta) |
|--------|----------------------------------------|
| **Legendary** | Top **1–10** |
| **Rare** | Top **11–50** |
| **Common** | Top **51–200** |
| *(sin badge galería)* | Fuera del top 200 / sin rank |

Notas:

- Snapshot de rank **al momento del kill** (igual filosofía que mults en `EK-LEDGER.md`).
- Elegibilidad EK (nivel ±10, no arena, etc.) sigue en `EK-LEDGER.md`; la rareza es **capa de galería**, no reemplaza `ek_value`.
- Ladder por ciudad + sync a middleware = **TBD** (MVP envía `rarity`/`rank` opcionales; hoy suelen ir vacíos).

---

## 3. Arquitectura propuesta (nuestra)

```
Server (elegible EK)
  → EnemyKillAwarded (self → killer)  // proto
Client
  → schedule +650ms
  → Phaser canvas.toBlob('image/jpeg')
  → download local `{victim}_{nnn}.jpg`  // paridad naming Olympia
  → POST stub middleware /ek-screenshots
Landing
  → GET /ek-screenshots + filtros rareza (scaffold)
```

| Pieza | Rol MVP | Post-MVP |
|-------|---------|----------|
| `EnemyKillAwarded` | Señal autoritativa "fue EK" + campos opcionales rank/rarity | Incluir `ek_value`, season id |
| Capture client | JPEG + download + upload best-effort | Native/Electron → `SAVE/eks`; watermark fecha/mapa |
| Middleware | Store en memoria / disco local stub | S3/R2 + ledger join + moderación |
| Landing gallery | Sección + mock + fetch API | Muro infinito, filtros ciudad/killer/victim |
| City killer ladder | Diseño only | Persistencia + API rank snapshot |

**Por qué no disparar solo con `PlayerDied`:** el victim packet lo ven espectadores; el killer necesita un **self-only** "te dieron EK" (como Olympia). Además evita capturar kills no elegibles / arena.

---

## 4. MVP implementado vs TBD

### Hecho

- Proto `EnemyKillAwarded` + emit server en PvP open-world con regla nivel ±10.
- Cliente: delay 650 ms, JPEG del canvas, download local, POST stub.
- Middleware: `POST/GET /ek-screenshots` (memoria).
- Landing: sección **EK Gallery** (filtros rareza + placeholders + fetch).
- Este doc + punteros BITACORA / MASTERPLAN.

### TBD

- Ladder real "top killers por ciudad opuesta".
- Rellenar `victim_city_killer_rank` / `rarity` en el kill path.
- Persistencia DB de imágenes + CDN.
- Contador CharacterDialog = EKs reales; ledger público completo (Fase G).
- Watermark in-frame (fecha/mapa) estilo Olympia/manual HelShot.
- Opt-out setting; retención / ToS de galería pública.
- Native path `AppData/.../SAVE/eks` si hay shell desktop.

---

## 5. Referencias de código

| Área | Path |
|------|------|
| Proto | `multiplayer/proto/network.proto` → `EnemyKillAwarded` |
| Server emit | `GameWorld.HandlePlayerDeath` + `NetworkManager.CreateEnemyKillAwarded` |
| Client capture | `mp-client/src/game/systems/EkScreenshotCapture.ts` |
| Middleware | `middleware-node/ekScreenshots.js` |
| Landing | `landing/index.html` `#ek-gallery` |
