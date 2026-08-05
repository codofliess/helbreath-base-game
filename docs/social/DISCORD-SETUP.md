# Chain Lords — Discord oficial (condensado + automatizado)

> Estilo **Olympia** (info / community / help / arena / voice) pero **más chico**.  
> Automatización: `social-bot/setup-server.mjs` crea roles, canales, pins e invite permanente.

Complementa: [`OPS-DESK.md`](./OPS-DESK.md) · [`FREEZE-COPY.md`](./FREEZE-COPY.md)

**Mail del proyecto:** `ops@chainlords.net` / `hello@chainlords.net` → `chainlords.net@gmail.com` (CF Email Routing ✅)

---

## Layout final (condensado)

```
INFO
  #welcome          reglas + anti-scam
  #announcements    solo staff (parches, test, arena)
  #status           online / maintenance
  #links            site + arena pages + mail

COMMUNITY
  #general          chat EN/ES
  #lfg              party world
  #guilds           reclutar / buscar guild
  #media            screens / EK clips

PLAYTEST
  #how-to-play      Phantom + play link (staff write)
  #bug-reports      template pineado
  #support          FAQ + mods (+ bot después)

ARENA
  #arena-news       Sunday 1v1/3v3 (staff write)
  #arena-lfg        teams / sparring

VOICE
  Lobby · World · Arena

STAFF (privado)
  #ops  #ops-content  #ops-bot-log  #ops-infra
```

**Roles:** Staff · Mod · Bot · Tester  

Menos canales = menos moderación y más automatizable.

---

## Setup en 15 minutos (vos + script)

### A. Crear server vacío
1. Discord → **+** → Create My Own → Community  
2. Nombre: **Chain Lords**  
3. Ideal: cuenta / mail ligado a **chainlords.net@gmail.com**

### B. Bot de setup (+ luego FAQ)
1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → `Chain Lords Bot`  
2. **Bot** → Add Bot → Reset Token → copiar  
3. Privileged Gateway Intents: **Message Content Intent** ON (para el FAQ bot)  
4. **OAuth2 → URL Generator**  
   - Scopes: `bot`, `applications.commands`  
   - Permissions: **Administrator** (solo primer setup; después se puede bajar)  
5. Abrí la URL e invitá el bot al server **Chain Lords**

### C. IDs
- Discord → User Settings → Advanced → **Developer Mode** ON  
- Right-click server → **Copy Server ID**

### D. Correr bootstrap

```powershell
cd C:\Users\54116\helbreath-base-game\social-bot
npm install
# crear .env:
# DISCORD_BOT_TOKEN=...
# DISCORD_GUILD_ID=...
node setup-server.mjs
```

El script:
- Crea roles y categorías  
- Canales con permisos (announcements solo staff, STAFF privado)  
- Pinea welcome / links / how-to-play / bug template  
- Imprime **invite permanente** `https://discord.gg/...`

### E. Después del script
1. Asignarte rol **Staff** (Members)  
2. Pegar invite en landing (reemplazar `discord.gg/P4tBdGRC3q`) + deploy  
3. (Opcional) FAQ bot: `XAI_API_KEY` + `npm start` (ver `social-bot/README.md`)

---

## Automatización “que te haga el trabajo simple”

| Pieza | Qué hace | Cuándo |
|-------|----------|--------|
| `setup-server.mjs` | Estructura completa del server | Una vez |
| `npm start` (social-bot) | FAQ en DM + `#support` con freeze copy | Cuando haya XAI key |
| `#ops-content` | Drafts de anuncios/tweets antes de publicar | Diario 15 min |
| `#status` | Un mensaje manual o webhook cuando cae VPS | Ops |
| Email ops@ / hello@ | Contacto sin Discord | Ya en CF |

**No hace falta** 20 canales tipo Olympia full; con este mapa cubrís test + arena + mods.

---

## Checklist

- [ ] Server Chain Lords creado  
- [ ] Bot invitado + `setup-server.mjs` OK  
- [ ] Invite forever impreso  
- [ ] Landing actualizada  
- [ ] Staff role en tu user  
- [ ] (Opcional) social-bot online  

---

## Nota invite viejo

`discord.gg/P4tBdGRC3q` en landing = comunidad base / placeholder.  
**Reemplazar** por el invite que imprima el script.
