# Referencia — Helbreath Argentina (Instagram / comunidad)

> Notas de diseño/producto para **Helbreath Chain Lord**, a partir de posts públicos de Helbreath Argentina.  
> Fecha de captura: **2026-07-11**.  
> Regla: lo marcado **[recuperado]** salió del fetch; lo **[inferido]** es lectura de producto sin frames de video/imagen; no inventar captions.

---

## Fuentes

| # | URL | Tipo | Cuenta | Fecha en post (UI IG) | Estado del fetch |
|---|-----|------|--------|------------------------|------------------|
| 1 | https://www.instagram.com/reel/DXfwW7rDcjr/ | Reel | `gino.games` (Verified) | April 23 (~11w al capturar) | Caption + comentarios + métricas vía WebFetch. **Sin frames de video** (IG no entregó media). |
| 2 | https://www.instagram.com/p/DYYaFD-DJr0/ | Post (editado) | `helbreathargentina` | May 15 (~7w al capturar) | Caption completa tipo changelog. **Sin imágenes/carrusel** (IG no entregó media). |

**Herramientas usadas:** WebFetch (éxito en captions), WebSearch (espejo YouTube + guías oficiales). Firecrawl CLI no produjo output usable en este entorno.

**Espejo relacionado (no es el post IG, pero cubre el mismo update):**  
[YouTube — ACTUALIZACIÓN MASIVA en Helbreath Argentina](https://www.youtube.com/watch?v=WCkMKEyeh5g) — walkthrough de Guild panel, Hero upgrades, Enchanting, drops AbbyMap.

**Sitio oficial citado en captions:** https://www.helbreathargentina.com/  
Guías linkeadas: `?c=Guias&g=GuildSystem`, `?c=Guias&g=Enchanting` (fetch de la guía Guild devolvió solo selector de idioma; contenido gated/JS).

---

## Post 1 — Reel `gino.games` (promo / trayectoria)

### Qué muestra **[recuperado: caption]**

Promo de comunidad, no un changelog técnico. Mensajes explícitos:

- Server con **16 años** de trayectoria; “recién empieza” + pipeline de contenido.
- Roadmap anunciado: nuevos ítems/armas, magias/wands únicas, drops mejorados, quests nuevas, **Trade Eks**, **Trade Coins**, más sistemas de farmeo.
- Crédito a **Lalo Ramos** (programador + figura del proyecto).
- CTA multi-canal: web, Discord, IG oficial `@helbreathargentina`, Facebook, TikTok, WhatsApp + launcher/auto-updater.

### Engagement **[recuperado]**

- ~120 likes / ~40 comments (números en la página pública).
- Comentarios típicos de nostalgia/hype (“como en los viejos tiempos”, “Aguante Helbreath”).

### Visual / UI **[no recuperado]**

El reel es video; **no hay thumbnail ni frames** en el scrape. No afirmar layout de cliente, HUD, ni branding on-screen sin captura manual.

### Takeaways para Chain Lord

| Área | Idea accionable |
|------|-----------------|
| **Branding / hub** | Tratar “años de trayectoria / legado” como señal de confianza en landing y hub (World desk), no solo en docs de guilds legacy. |
| **Comunidad** | CTA stack del reel = checklist de presencia: web + Discord + IG + (opcional) TikTok/WhatsApp. Chain Lord ya apunta Discord en landing; alinear copy “sumate / viví” con tono argentino sin copiar marca HB Arg. |
| **Producto** | Trade EK / Trade Coins aparecen como **pilares de retención** en el pitch. Cruza con [`EK-LEDGER.md`](./EK-LEDGER.md) (ledger público) y economía futura: un “EK Trade” on-chain o custodial es demanda cultural del público HB Arg, no invento nuestro. |
| **Arenas** | Este post no habla de torneos; es retention PvE/economía. No forzar lectura de Coliseum aquí. |

---

## Post 2 — `helbreathargentina` Actualización **16.55**

### Qué muestra **[recuperado: caption]**

Post oficial tipo **patch notes** (editado). Bloques:

| Sistema | Detalle en caption |
|---------|-------------------|
| **Guild System** | Nuevo panel + jerarquías; **Guild Raid / Hunt** con progresión y bonus. Guía: web `GuildSystem`. |
| **Hero System** | **Master Hero +5** con EKs; **Power Hero +4** con Tickets. |
| **AbbyMap** | Drops especiales: KlonessBlade, GiantBattleHammer, BlackBattleHammer, The Devastator, BerserkWand(MS.30), etc. |
| **Rates** | Suben First Drop y Rare Drop. |
| **Enchanting** | Habilitado; hotkey **CTRL + G**; guía web. |
| **Caps** | Pa/Ma **36%**; Mr/Dr/Hit **84%**; Reputation **7.000**. |
| **VipCoins** | Coins→VipCoins **5:1**; promo **2x1** (100k → 200k); VipCoin Trade (ítems nuevos, precios más bajos). |
| **Item Quest** | Quests nuevas; menos mobs requeridos. |
| **Eventos** | Team vs Team **automático**; TvT auto → **EK ×10**; TvT GM → **EK ×5**; más Quest ×2. |
| **Próximamente** | EK Trade por **EK Totales**; “Reforma Internacional No Delay” (host USA sin delay global). |

Engagement bajo en la página pública (~5 likes, sin comments visibles).

### Visual / UI **[parcialmente inferido]**

- **[no recuperado]** Layout del post (imagen única vs carrusel vs clip).
- **[inferido desde espejo YouTube + caption]** El Guild System se vende con **panel in-game** (líder + hasta ~3 commanders, roles rider/hunter, donaciones/contribuciones) — útil como referencia de densidad de UI de guild, no como spec a clonar.
- **[inferido]** Enchanting se comunica con hotkey + guía web (patrón: feature profunda → deep-link a docs).

### Takeaways para Chain Lord

| Área | Idea accionable |
|------|-----------------|
| **Hub / World desk** | Patch notes estilo 16.55 funcionan como **una sola tarjeta scrolleable** (emoji + bullets + links). Para desk/landing: bloque “Novedades” con 5–8 bullets + link a doc, no banner genérico. |
| **Guilds (Fase H)** | Priorizar en diseño: panel con **jerarquías** + actividad Raid/Hunt con **bonus medibles**. Alinear con [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md): poder de GM + roles visibles > solo chat de guild. |
| **Hero / torneos** | HB Arg separa **Master Hero (EK grind)** vs **Power Hero (tickets)**. Chain Lord: equal-footing arena ya da hero set; el unbind/mercado ([`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md)) es el análogo “pago/ticket” — mantener esa dualidad grind vs paid en copy. |
| **EKs / Arenas** | Eventos TvT con **multiplicador EK** (×5 / ×10) = precedente de “modo evento que acelera ladder”. Para Arenas/Coliseum: considerar eventos de temporada con mult de rating o de EK open-world, documentados en config (no hardcode). |
| **Drops / NFT** | Lista AbbyMap solapa whitelist Chain Lord (`Devastator`, `BerserkWand`, hammers, Kloness). Usar como **validación de fantasía endgame** del público Latam, no como rates a copiar. |
| **Enchanting** | Feature cultural fuerte (CTRL+G + caps %). Fuera de alcance inmediato del MASTERPLAN; si se retoma, hotkey + guía web como en HB Arg. |
| **Branding** | Tono: fuego/emoji + lista densa + “Staff Helbreath Argentina” al pie. Chain Lord puede ser más sobrio en hub, pero el **formato changelog** es el que la comunidad ya lee. |
| **Infra** | “No Delay / host USA” = dolor de latencia Latam→NA. Para browser/Solana: comunicar región/latency en World desk si hay multi-region. |

---

## Síntesis visual/UX (honesta)

| Recuperado | No recuperado (requiere captura manual) |
|------------|----------------------------------------|
| Captions completas de ambos posts | Frames del reel (UI in-game, overlays, música/texto on-screen) |
| Links oficiales y guías | Imágenes/carrusel del post 16.55 |
| Métricas públicas aproximadas | Paleta exacta, tipografía, mockups de paneles |
| Espejo YouTube del update | Screenshots de Guild panel / Enchanting UI en cliente HB Arg |

**No inventar** look & feel del cliente HB Arg a partir de estos dos links solos.

---

## Ideas accionables (checklist producto)

1. **Novedades en hub/World:** componente “patch notes” (bullets + deep links) inspirado en el post 16.55.
2. **Guild MVP (Fase H):** panel con roles (líder/comandantes) + al menos una actividad con bonus (Raid/Hunt lite).
3. **EK economy:** diseñar `EK Trade` / sinks en [`EK-LEDGER.md`](./EK-LEDGER.md) sabiendo que HB Arg lo anuncia como “próximamente” — timing competitivo de narrativa.
4. **Event multipliers:** TvT/auto events con mult EK → plantilla config para eventos Chain Lord (Arenas o open-world).
5. **Hero dual path:** copy World = grind/milestones; Arenas/unbind = path “ticket/pago” sin mezclar en el mismo CTA del hub.
6. **Legacy trust:** 16 años + nombre de staff en promo → en Chain Lord, créditos/legacy airdrop ya contemplan HB Arg; usar en landing una línea de “comunidad histórica” sin apropiar assets.
7. **Captura manual** (abajo) antes de cualquier imitación visual.

---

## Checklist — captura manual (si abrís los links)

Guardar en `docs/reference/` (crear carpeta si no existe):

| Archivo sugerido | Qué capturar |
|------------------|--------------|
| `docs/reference/hb-arg-reel-DXfwW7rDcjr-*.png` | 3–5 frames del reel: HUD, mapa, ítems, texto on-screen, branding |
| `docs/reference/hb-arg-post-DYYaFD-DJr0-*.png` | Todas las slides del post 16.55 (UI guild, hero, drops, eventos) |
| `docs/reference/hb-arg-guild-panel.png` | Panel Guild in-game (o del video YT) |
| `docs/reference/hb-arg-enchanting.png` | UI Enchanting (CTRL+G) |
| `docs/reference/hb-arg-web-guild-guide.md` | Export/markdown de la guía GuildSystem cuando cargue |

Anotar al pegar: fecha, resolución, y si es cliente vs web vs thumbnail IG.

---

## Relación con docs Chain Lord

| Doc | Cruce |
|-----|--------|
| [`MASTERPLAN.md`](./MASTERPLAN.md) | Hub World/Arenas, EKs, guilds, hero set |
| [`EK-LEDGER.md`](./EK-LEDGER.md) | Trade EK, mult eventos, ladder |
| [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) | Guild panel / Raid-Hunt / HB Arg como guild legacy |
| [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md) | Dualidad Master(EK) vs Power(tickets) |
| [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) | Arenas; no confundir con TvT open-world de HB Arg |
| [`landing/README.md`](../landing/README.md) | CTAs comunidad + novedades |

---

*Última actualización: 2026-07-11 — captions vía WebFetch; media IG no disponible en scrape.*
