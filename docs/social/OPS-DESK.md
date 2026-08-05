# Chain Lord — Social Ops Desk

> Cómo coordinar **X + Discord** en la salida de test.  
> Complementa MASTERPLAN § 1.7.4 y freeze C5 (no-shill).

---

## 1. Qué puede hacer Grok (esta sesión) vs un bot 24/7

| Modo | Quién | Qué hace | Limitación |
|------|--------|----------|------------|
| **Ops en chat** | Grok 4.5 (vos acá) | Borradores de tweets, anuncios Discord, calendarios, crisis copy, review de freeze | Solo cuando hay sesión; **no** vive en tus cuentas |
| **Bot staff** | Proceso Node en tu VPS/PC | Responde DMs Discord / FAQs con **Grok barato** (API) | Necesita tokens Discord + `XAI_API_KEY`; no es “gratis infinito” |
| **Bot en X** | API de X (paga) | DMs / replies automatizados | API X **cara y restrictiva**; fase 2 |

**No es posible** que “Grok Build / este chat” posteé solo en X/Discord 24/7 sin un **proceso tuyo** desplegado (bot) + secretos.  
**Sí es posible**:

1. Yo te armo el bot + prompts + freeze.  
2. Vos lo corrés con tu permiso (tokens).  
3. En sesión, yo redacto y vos publicás (o pegás en el bot `#ops-approve`).

---

## 2. Stack recomendado (barato y suficiente)

| Pieza | Elección | Notas |
|-------|----------|--------|
| Discord bot | `social-bot/` (Node + discord.js) | DMs + canal `#support` / `#faq` |
| Modelo LLM | **`grok-4-1-fast-non-reasoning`** o **`grok-3-mini`** vía [api.x.ai](https://x.ai/api) | ~10–30× más barato que Grok 4.5; ideal FAQ |
| Credits | Consola xAI (data sharing / prepaid) | Verificar free credits actuales en console.x.ai |
| X | Manual + drafts en `#ops-content` | Auto-DM X = fase 2 (Basic/Pro API) |
| Desk humano | Discord privado `#ops` + este doc | 15 min/día |

---

## 3. Roles de canal

### Discord público (servidor Chain Lord)

| Canal | Quién escribe |
|-------|----------------|
| `#announcements` | Solo staff (o webhook aprobado) |
| `#patch-notes` | Staff |
| `#status` | Staff / bot status |
| `#bug-reports` | Testers (template) |
| `#general` | Todos |
| `#support` | Bot + mods (bot responde FAQ; escalar a humano) |
| `#looking-for-guild` | Comunidad |

### Discord privado (staff)

| Canal | Uso |
|-------|-----|
| `#ops` | Standup, incidentes |
| `#ops-content` | Drafts X/Discord para aprobar |
| `#ops-bot-log` | Log del bot (qué respondió) |
| `#ops-freeze` | Alertas si el bot se negó por freeze |

---

## 4. Ritual diario (15 min)

1. Server up? → `#status`  
2. ¿Hay draft en `#ops-content`? Aprobar → postear  
3. Top 3 bugs de testers  
4. Una respuesta humana a un DM/thread caliente  

---

## 5. Escalación bot → humano

El bot **debe** decir “un humano del team te responde” si:

- Pide precios de token / ROI / “cuánto va a valer $HELL”  
- Reporta exploit / RCE / duper  
- Pide refund / ban appeal / doxx  
- No está en la FAQ y no es trivial  

---

## 6. Orden de puesta en marcha

1. [x] Crear servidor Discord + roles base  
2. [x] App bot Discord + FAQ (`social-bot/`)  
3. [ ] **Cuenta X oficial** (manual) + pin Testing Week — ver [`X-GUILD-ROLES-AIRDROP.md`](./X-GUILD-ROLES-AIRDROP.md)  
4. [ ] Rellenar `DISCORD_WEBHOOK_URL` en VPS (hoy vacío)  
5. [ ] Roles Discord: Guild Master / Captain / Veteran / Guildsman + tags `G · Name`  
6. [ ] Claim-time: follow X como elegibilidad airdrop (utility)  
7. [ ] Guild categories cuando haya stake $HELL (o whitelist legacy)  
8. [ ] Bot X / auto-post = fase 2 (API paga + approve)

Detalle guild rooms + airdrop gates: **[`X-GUILD-ROLES-AIRDROP.md`](./X-GUILD-ROLES-AIRDROP.md)**.

---

## 7. Qué no automatizar (aún)

- Announcements de tokenomics / supply  
- “Airdrop garantizado” / ROI / “stake = money”  
- Trading advice  
- Bans / moderación de raids (eso es Dyno/Carl + mods)  
- Postear en X sin aprobación humana  
- Crear 50 canales de guild vacíos sin umbral de stake  

---

## 8. Contacto de verdad

Links oficiales (rellenar):

| | URL |
|--|-----|
| Play | https://play.chainlords.net |
| Site | https://chainlords.net |
| Discord invite | https://discord.gg/F4NwwbfKtj |
| X | https://x.com/ChainLordsHQ |
| Support email | ops@ / hello@ → chainlords.net@gmail.com |
