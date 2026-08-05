# Masterplan · PVP cartelera + multi-cam streams

Status: **Phase 1–2 shipped** — multi-stage cartelera (PVP + World + Tournament shells).  
In-game **Observer** seat: **deferred** (see below).

## TV Guide UX (ESPN / Disney-channel style)

Client **CHAIN LORDS TV** (`DuelWatchDialog`, default tab **This week**):

1. **LIVE NOW** — strip with all live PVP + World + Tourney → **▶ WATCH**
2. **ALL SCHEDULED** — flat list of public duels / events
3. **WEEKLY GRID** — 7 days from today; empty days show “open slot”
4. **Watch now** — multi-cam stage (global + POV sides), ON or OFF shell

You supply streamers/testers; product only schedules + routes viewers.

---

## Stages (always deployed, even when empty / “OFF”)

| Stage | Source | Empty behavior |
|-------|--------|----------------|
| **PVP** | `ArenaPact` public duels + POV/global URLs | Stage shell shows waiting cams |
| **World** | `StreamDirectory` Go Live (hunt/raid) | Slot ready until someone broadcasts |
| **Tournament** | Same directory `kind=tournament` (+ future brackets) | Shell ready for events |
| **Global multi-cam** | Watch UI | Always painted: 1 main + side POVs |

Public API for **www.chainlords.net** hero (CORS open):

- `GET /api/streams` — full cartelera snapshot (`stageReady: true`)
- `GET /api/duels/upcoming|live|{id}` — PVP only
- `GET /api/streams/world` — World Go Live list

---

## Product vision

| Layer | Role |
|-------|------|
| **Global cam** | Wide / cast share (optional URL) — main tile, like Discord’s big screen share |
| **POV cams** | Each fighter’s Twitch / YouTube / Discord Go Live — side tiles (semi-minimized) |
| **Cartelera** | Upcoming + live public duels on play + API for www.chainlords.net |
| **Discord** | Webhook embed + optional Guild Scheduled Event |

Fans watch **streams**, not a third in-engine body. That is enough for MVP.

---

## Shipped (this sprint)

### Server
- `ArenaPact` fields: `isPublic`, `title`, host/fighter `streamUrl`, `globalStreamUrl`
- `ArenaPactSetStreamRequest` — update POV or global cam mid-duel
- `StreamDirectory` + `StreamBroadcastRequest` — World / Tournament Go Live
- Public HTTP (CORS open):
  - `GET /api/streams` — **full multi-stage cartelera** (empty shells included)
  - `GET /api/streams/world`
  - `GET /api/duels/upcoming` · `live` · `{id}`
- Discord:
  - PVP create/live: `ArenaPactDiscord`
  - World/Tournament Go Live: webhook embed
  - Env: `DISCORD_PVP_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL`, optional bot Events

### Client
- Create PVP: guided Discord/Twitch/YouTube + publish + title
- **Live Cartelera** dialog: Stage always ON (OFF cams until streams) + tabs PVP / World / Tournaments
- **Go Live · World** / **Tournament** (in-game)
- Hub: “Live Cartelera · PVP · World · Tournaments”
- Deep link: `?watch={matchId}` or `?watch=streams`

### Discord ops (env on Hetzner)
```bash
DISCORD_PVP_WEBHOOK_URL=https://discord.com/api/webhooks/...
# optional Events API:
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
CHAINLORDS_PUBLIC_URL=https://play.chainlords.net
```

---

## Deferred · Observer role (in-game)

**Do not block Watch on this.**

When we need it later:
- Third party joins map as `observer` (no combat, no kit PVP)
- Camera follow A/B
- Seat limits / mute list
- Anti-cheat: no item pickup, no spell

Track as: `MASTERPLAN / Observer seat` — after multi-cam stream product is stable.

---

## Next phases

### Phase 2a · www.chainlords.net hero
- Replace marketing animation with live cartelera fed by `/api/duels/*`
- Same multi-cam Watch page or embed play. iframe
- CORS already allows `*`

### Phase 2b · Discord polish
- Update Scheduled Event when duel goes live / ends
- Channel #eventos pin + role ping optional
- Streamer “claim POV” button via bot modal

### Phase 3 · Observer + polish
- In-engine observer
- Optional VOD archive links
- Tournament brackets on same cartelera

---

## Multi-cam UX notes

- **Global** = production / cast / dual-PC capture if someone runs it
- **POV** = each fighter’s OBS → Twitch/YT (or Discord Go Live link-out; no web embed for Discord)
- Twitch embeds need `parent=` hosts (`play.chainlords.net`, `www.chainlords.net`, localhost)
- YouTube live/watch URLs are embedded via video id

---

## Security

- Public API is read-only listings of **opt-in** `isPublic` duels (direct `matchId` watch also works for share links)
- Stream URLs validated as http(s) only, length-capped
- No secrets in client; Discord tokens only on game server env
