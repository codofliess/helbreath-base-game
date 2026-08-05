# X API setup — @ChainLordsHQ

Conectar la API para que el bot Discord publique con `/content post-x`.

**Pricing (oficial, pay-per-use):**  
https://docs.x.com/x-api/getting-started/pricing  

| Acción | Costo aprox. |
|--------|----------------|
| Post texto | **$0.015** |
| Post **con URL** | **$0.20** |
| Leer user | $0.01 |

**Tip:** posts sin `https://` salen ~13× más baratos; poné el link en la bio.

---

## 0. Modelo recomendado: **codofliess** gobierna + **@ChainLordsHQ** es la marca (Opción B)

| Pieza | Dónde vive | Para qué |
|-------|------------|----------|
| **@codofliess** (personal) | SuperGrok Heavy, Premium, día a día | Crear contenido con Grok, gobernar la marca |
| **@ChainLordsHQ** | Cuenta de marca | Lo que ve el público |
| **Delegate / Teams en X** | HQ invita a **@codofliess** como Admin | Postear desde la UI de X **como HQ** sin compartir password de HQ |
| **Developer Console + billing API** | Cuenta **personal / codofliess** | App + créditos pay-per-use |
| **Access Token + Secret** | OAuth PIN **autorizado como HQ** | Bot Discord postea **como HQ** |
| **SuperGrok** | Personal | **No** paga ni reemplaza créditos de la X API |

### 0.1 Ceder permisos de la cuenta X (UI) — Delegate

Hecho **logueado como @ChainLordsHQ** (dueño de la marca):

1. X → **Settings** → **Security and account access** → **Delegate**  
   (a veces: Settings → Account → Delegate / Teams).  
2. **Invite a member** → `@codofliess` (o el handle exacto).  
3. Rol: **Admin** (gobernar + invitar) o **Contributor** (postear/DM sin full admin).  
4. Aceptar el invite **logueado como codofliess**.  
5. En el switcher de cuentas de X / X Pro, elegir **ChainLordsHQ** y publicar.

Así codofliess **gobierna HQ en la app** sin mezclar passwords.

Help: https://help.x.com/en/using-x/postdeck-teams  

### 0.2 API (bot) — app en codofliess, tokens de HQ

1. Developer Console **con codofliess** (personal) → app de la marca.  
2. Consumer Key/Secret → `.env`.  
3. `node scripts/x-oauth-pin.mjs` → browser **@ChainLordsHQ** → PIN → Access Token/Secret de HQ.  
4. Créditos API se compran en la cuenta **developer (codofliess)**.  

**No** uses la Developer Console de HQ para “todo” si el billing/SuperGrok están en codofliess: la app y el pago viven en personal; HQ solo **autoriza**.

### Qué NO se “comparte” solo por SuperGrok

- SuperGrok **≠** tokens de la X API para postear.  
- Si generás “Access Token” logueado como **personal**, los posts salen de **tu user personal**, no de HQ.  
- Bearer Token de la app = app-only (casi solo lectura); **no alcanza** para postear.

### Flujo correcto Opción B

1. Logueado como **personal** → [console.x.com](https://console.x.com) → Project + App `ChainLordsHQ Ops`.  
2. App permissions: **Read and write**.  
3. User authentication settings (si pide callback):  
   - App type: Web App  
   - Callback: `https://localhost` o `oob` / PIN flow  
   - Website: `https://chainlords.net`  
4. Copiá **Consumer Key** + **Consumer Secret** → `X_API_KEY` / `X_API_SECRET`.  
5. Comprá créditos X API con la cuenta personal (billing).  
6. **Autorizar HQ** (elegí una):

#### 6a. PIN flow (script del repo — recomendado)

```powershell
cd C:\Users\54116\helbreath-base-game\social-bot
# .env solo con X_API_KEY + X_API_SECRET de la app (personal)
node scripts/x-oauth-pin.mjs
```

- Abrí la URL **en un browser logueado como @ChainLordsHQ**.  
- Autorizá → pegá el PIN.  
- El script imprime `X_ACCESS_TOKEN` + `X_ACCESS_TOKEN_SECRET` (screen_name debe ser **ChainLordsHQ**).

#### 6b. “Generate” en el portal

Solo funciona si en ese momento la consola está bajo el user que va a postear.  
Si la app es de **personal**, el Generate suele dar tokens de **personal** → **no uses 6b** para HQ; usá el PIN (6a).

7. Pegá las 4 vars en `.env`, reiniciá bot, `/content post-x … confirm:true`.

---

## 1. Opción A (alternativa): todo bajo @ChainLordsHQ

1. Entrá a console.x.com **logueado como @ChainLordsHQ**.  
2. Project + App, Read and write.  
3. Generate Access Token + Secret (serán de HQ).  
4. Créditos de API se facturan a esa cuenta (puede no tener SuperGrok).  

Útil si no querés mezclar billing personal con la marca.

---

## 2. Pegar secrets en el bot (nunca en git)

`social-bot/.env`:

```env
OFFICIAL_X_URL=https://x.com/ChainLordsHQ

X_API_KEY=...              # Consumer Key (app — dueño personal OK)
X_API_SECRET=...           # Consumer Secret
X_ACCESS_TOKEN=...         # Access Token de @ChainLordsHQ (PIN flow)
X_ACCESS_TOKEN_SECRET=...  # Access Secret de HQ
```

Reiniciar:

```powershell
cd C:\Users\54116\helbreath-base-game\social-bot
npm start
```

En Discord (Staff/Mod):

```
/content x-status
/content pack-load
/content show id:1
/content post-x id:1 confirm:true
```

---

## 3. Comandos

| Comando | Qué hace |
|---------|----------|
| `/content x-status` | ¿Keys cargadas? + pricing tip |
| `/content show id:N` | Preview + costo estimado + texto ≤280 |
| `/content post-x id:N confirm:true` | Publica en X (OAuth 1.0a → POST /2/tweets) |
| `/content post-both id:N confirm:true` | X + Discord announcements |

Sin `confirm:true` solo muestra preview (no gasta créditos).

---

## 4. Seguridad

- Tokens = password del HQ. Solo en `.env` / vault.
- Solo roles **Staff / Mod / Admin** pueden postear.
- Logs en `#ops-bot-log` con link del post (sin secrets).
- Si se filtran keys: revocar en console.x.com y regenerar.

---

## 5. Automatización “junto con Grok”

1. En chat: “draft 2 tweets for tomorrow” → Grok escribe.  
2. `/content draft platform:x body:…` en Discord.  
3. Revisás freeze.  
4. `/content post-x id:… confirm:true`.  

O pack semanal: `/content pack-load` → postear uno por día.

---

## 6. Troubleshooting

| Error | Qué mirar |
|-------|-----------|
| 401 Unauthorized | Keys mal copiadas / Access Token no es de @ChainLordsHQ |
| 403 Forbidden | App no es Read+Write; regenerar user tokens |
| 402 / payment | Sin créditos — top-up en console |
| 429 | Rate limit — esperar |
| “Post too long” | `/content show` y acortar a 280 |
| post-x disabled | Falta alguna de las 4 env vars |

---

## 7. Checklist

- [ ] App X con Read and write  
- [ ] Access Token de **@ChainLordsHQ**  
- [ ] Créditos + spending limit  
- [ ] 4 vars en `social-bot/.env`  
- [ ] Bot reiniciado  
- [ ] `/content x-status` → OK  
- [ ] Test post “Chain Lords ops test — delete later”  
