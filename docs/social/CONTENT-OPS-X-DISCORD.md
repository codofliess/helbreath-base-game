# Content ops — X (@ChainLordsHQ) + Discord

> Cómo trabajamos **juntos** contenido y procesos sin romper freeze ni colapsar ops.

**X:** https://x.com/ChainLordsHQ  
**Discord:** https://discord.gg/F4NwwbfKtj  
**Play:** https://play.chainlords.net  

---

## 1. Modelo de trabajo (quién hace qué)

| Rol | Qué hace |
|-----|----------|
| **Vos (PO/staff)** | Aprobás, posteás en X (o API después), decidís tono/crisis |
| **Grok (esta sesión)** | Borradores, calendarios, crisis copy, review freeze, pack semanal |
| **Bot Discord (`social-bot`)** | FAQ 24/7 + cola de drafts staff (`/content`) + post a Discord cuando aprobás |
| **X API** | Opcional fase 2 — post automático (cuenta de pago / developer app) |

**Hoy (fase 1, recomendada):**  
Grok/bot → draft en Discord `#ops-content` → **vos copiás y publicás en X** (o reaccionás ✅ y alguien con acceso postea).  
El bot **sí** puede postear en Discord (announcements) con permiso staff.

---

## 2. Flujo diario (10–15 min)

```
1. Grok o staff genera drafts (pack o /content draft)
2. En Discord #ops-content: revisión freeze (no ROI / no guaranteed $)
3. Publicar:
   - X: copiar texto del draft (o Typefully/Buffer)
   - Discord: /content post-discord id:<n>  (canal announcements)
4. Log en #ops-bot-log (automático si configurado)
```

---

## 3. Comandos del bot (`/content`)

Staff/Mod only:

| Comando | Uso |
|---------|-----|
| `/content draft` | Guarda draft (platform: x / discord / both) |
| `/content list` | Últimos drafts |
| `/content show` | Ver un id + versión recortada para X (≤280) |
| `/content post-discord` | Publica body en canal de announcements (config) |
| `/content pack-load` | Carga pack semana 1 al queue (si no está) |

Env:

```
OFFICIAL_X_URL=https://x.com/ChainLordsHQ
DISCORD_ANNOUNCE_CHANNEL_ID=   # #announcements
DISCORD_OPS_CONTENT_CHANNEL_ID=  # #ops-content (opcional)
```

---

## 4. Pack semana 1

Archivo: `social-bot/data/week1-content-pack.json`

1. **PIN X** — testing open + credits  
2. **Discord announce** — play + follow X for eligibility  
3. How to join  
4. Credits rules short  
5. Follow for claim (utility)  
6. Guild roles teaser  
7. Anti-scam  

Cargá con `/content pack-load` o pedile a Grok “publicá el pin de X”.

---

## 5. Automatización X (API cableada)

Setup paso a paso: **[`X-API-SETUP.md`](./X-API-SETUP.md)**

| Comando | Efecto |
|---------|--------|
| `/content x-status` | Keys OK? + pricing tip |
| `/content post-x id:N confirm:true` | Publica en @ChainLordsHQ (OAuth 1.0a → POST /2/tweets) |
| `/content post-both id:N confirm:true` | X + Discord announcements |

**Costo:** ~$0.015 texto · **$0.20 con URL**. Preferí posts sin `https://`.  
**Créditos:** comprar en [console.x.com](https://console.x.com) + spending limit.

---

## 6. Airdrop eligibility (mensaje único)

- **Jugar:** no requiere follow.  
- **Claim:** planned → follow `@ChainLordsHQ` + créditos play-mine.  
- Discord/guild roles: capas siguientes (ver [`X-GUILD-ROLES-AIRDROP.md`](./X-GUILD-ROLES-AIRDROP.md)).

Nunca: “guaranteed airdrop value”.

---

## 7. Checklist setup ahora

1. [x] Cuenta X `@ChainLordsHQ`  
2. [ ] Bio + pin (usar pack `pin`)  
3. [ ] Links en Discord `#links` (X + play + site)  
4. [ ] `OFFICIAL_X_URL=https://x.com/ChainLordsHQ` en `social-bot/.env`  
5. [ ] `DISCORD_ANNOUNCE_CHANNEL_ID` del canal announcements  
6. [ ] Reiniciar bot → `/content pack-load`  
7. [ ] Post pin en X + announce en Discord  
8. [ ] (Opcional) Typefully conectado a @ChainLordsHQ  

---

## 8. Cómo pedirle a Grok en sesión

Ejemplos:

- “Draft 3 tweets for tomorrow about credits, freeze-safe”  
- “Reply thread for this bug complaint”  
- “Weekly calendar for Testing Week day 3–7”  
- “Translate this Discord announce to EN”  

Grok **no** tiene la sesión de X abierta: genera texto; **publicás vos** o el bot en Discord.
