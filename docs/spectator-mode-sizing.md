# Spectator mode — research / sizing (no implementation)

**Status:** research only. Draft PR against `consolidacion`. Does not implement Go Live, relay, landing watch, merge, or deploy.

**Product intent:** player opts in; landing spectators watch that POV with a **60s delay**, rendered from **game-state packets** (not video). Game server emits **one** per-live-player feed to a **read-only relay**; spectators never connect to the game process.

Existing “Go Live” in cartelera (`StreamBroadcastRequest`, Twitch/YouTube URLs) is a **different** product (`multiplayer/docs/MASTERPLAN-PVP-STREAM-CARTELERA.md`). In-engine observer seats are explicitly deferred there.

---

## 1. How the server sends state today

**Transport:** one binary WebSocket per player. `ServerMessage` protobuf `oneof` (`multiplayer/proto/network.proto` ~1011–1142). Encode + `SendAsync` is one WS frame per message (`multiplayer/server/Server.cs` 1738–1799).

**Edge:** `PlayerSession.SendMessage` = `EnqueueOutgoingMessage` (`Server.cs` 835), dual High/Normal channels (`Server.cs` 412–451; classify in `NetworkPriority.cs` 18–89). Gameplay calls `GameWorldPlayer.Send` → that enqueue (`GameWorldPlayer.cs` 2203–2209). Chat uses the **same** socket via `GlobalWorld` (`GlobalPacketRouting.cs` 11–13).

**Not a snapshot tick.** World worker ticks every **50 ms** (`Settings.json` `gameWorld.tickInterval`: 42; `WorldWorker` + `GameWorld.Update` 675–681) for AI/scheduler. Outbound is **event fan-out** inside view radius **18×11 cells** (`Settings.json` `radius.viewRadiusX/Y`: 19–20).

| Cadence | What |
|--------|------|
| On cell step | `PlayerMoved` to **neighbors only** (`Movement.cs` 102–122). Mover does **not** get their own `PlayerMoved`. |
| Monster step | `MonsterMoved` to viewers who still see it (`MonsterVisibility.cs` 360–398). Catalog steps often **700–900 ms** (`Monsters.json`). |
| Combat / casts | Nearby (sometimes excluding caster): e.g. `SpellCastStarted` skips self (`Casting.cs` 116–119); attack VFX skips attacker (`Combat.cs` 870–873). Caster **does** get `CastAoeSpell` / cancel. |
| Vitals | `HpUpdated` **self only** (`NetworkManager.cs` 1373–1379). MP/SP ride `InitialState` / `ProgressionUpdated` (`network.proto` 1733–1748). |
| Ping | Client interval **1000 ms** (`Settings.json` 35–36); `PingResponse` High. |
| Join | Fat `InitialState` (spells, **full item directory**, **bag + equipped**) then `InitialGameWorldState` including **all map teleport locs** (`Spawn.cs` 147–211; `NetworkManager.cs` 261–507). |

**Bytes (estimate, not measured).** No bot/load client in-repo; inbound cap is 4 KiB (`Server.cs` 20) but outbound is unbounded per message. Proto3 sizes (omit zeros) + ~6 B WS header:

| Packet | Typical payload |
|--------|-----------------|
| `PingResponse` | ~15 B |
| `HpUpdated` | ~8–12 B |
| `PlayerMoved` / `MonsterMoved` | ~20–28 B |
| `MonsterTakeDamage` / `PlayerReceiveDamage` | ~20–40 B |
| One `MonstersEnteredRange` row | ~60–90 B (strings) |

**Assumed hunt (12 monsters in view, ~900 ms step, light combat, 1 ping/s):**  
~13 `MonsterMoved`/s × 28 B ≈ 0.4 KB/s; + damage/swings/AOE ~0.4–1.2 KB/s; + ping/vitals/enter-leave bursts. **Steady ~1–3 KB/s; busy dens/PvP ~5–15 KB/s** on the **player socket**. City idle ≪ 1 KB/s. **Not verified with a live bot.**

---

## 2. Tap point (minimal game-server change)

**Reuse the live player’s outbound `ServerMessage` objects**, do **not** re-simulate the world.

1. **Primary:** `EnqueueOutgoingMessage` (`Server.cs` 436) — already the single socket drain. If opted-in, copy **allowlisted** payloads to one game→relay stream (multiplex by player id). That is **~one extra client** of serialize+send on the game box (same cost as +1 WebSocket), independent of spectator count.
2. **Must add** packets the local client **predicts** and therefore never receives: own `PlayerMoved`, own `SpellCastStarted`, own attack VFX (`Movement.cs` 102–122; `Casting.cs` 116–119; `Combat.cs` 870–873). Inject those into the mirror when the live player is the actor (objects already built for neighbors).
3. Filter **before** the relay copy (see §3). Do not put spectators on `PlayersSpatialGrid`.

CPU/bandwidth on the **game** server per live player ≈ **one extra encoded feed** (filtered subset + self-injects), not N× spectators.

---

## 3. Filter (private / extra-viewport leaks)

Allowlist High combat/presence from `NetworkPriority.cs` 31–80 **minus** the rows below. Drop (or strip) at the tap; do not trust the client.

| `ServerMessage` case | Why |
|----------------------|-----|
| `InitialState` bag/`equippedItems`, `ItemAddedToBag` / `Removed` / `MovedInBag`, `Warehouse*`, `AuctionBoard*`, `SellBagItemResult`, `BuyShopItemResult`, `BuyCashShopItemResult`, `ItemBindResult`, `Enchant*`, `CicItemMergeResult`, `SiphonGemUpgradeResult`, `MajesticUpgradeResult`, `StoneItemUpgradeResult`, `SkillGatherResult`, `RepairItemResult` | Inventory / economy |
| `ChatMessageReceived` if `channel` is Whisper / Guild / Party (`network.proto` 84–94, 2309–2317) | Private chat. **Today** `GlobalWorld` fans non-whisper chat to **every** online player (`GlobalWorld.cs` 224–233) — guild/party are **not** actually scoped; spectator must still drop them. Keep Global / Nearby / system only. |
| `PartyState` | Party roster + join **code** (`Party.cs`) |
| `PlayersEnteredRange` / `PlayerMoved` / effects for **other** entities with `TEMPORARY_EFFECT_TYPE_INVISIBILITY` | Server still sends invis players; client only hides sprites (`Player.ts` 2275–2338). Feed would leak cell + name. Live player’s own invis is OK (they see 50% opacity). |
| `InitialGameWorldState.teleport_locs` | Full-map portal graph (`network.proto` 2445–2456) |
| `AntiBotToolsState`, `HellMining*`, `CharacterListResponse`, `EnemyKillAwarded`, `LevelUpSettingsApplied`, `ArenaPact*` internals, `BeginnerPathState` | Ops / wallet / prize / unrelated HUD |
| Fat `ProgressionState.monster_kills` / milestones | Not needed to paint POV; optional thin HUD: hp/mp/sp/level only |

`PingResponse.players_in_map` is a map-wide count — strip or omit.

Static `.amd` map files already ship in the web client (`mapViewportStream.ts`); spectators will have geometry. “No full-map info” means **no live entities / teleports outside the live player’s AOI**, not hiding tilesets.

---

## 4. Relay sizing (from §1)

**Assumptions:** filtered hunt feed ≈ **2–8 KB/s** per spectator (same order as one player socket; self-injects add little). 60 s buffer RAM ≈ `8 KB/s × 60` ≈ **0.5 MB per live player** (tiny). Fan-out is **relay CPU + NIC**, not game.

| Spectators on one feed | At 8 KB/s | Notes |
|------------------------|-----------|--------|
| 100 | ~0.8 MB/s (~6 Mbps) | Comfortable on a small VM |
| 500 | ~4 MB/s (~32 Mbps) | Still one instance if NIC not shared heavily |
| ~1.5k–2k | ~12–16 MB/s (~100–130 Mbps) | **Scale-out trigger** for a “small” 1 Gbps-class box once you count TLS, WS headers, bursts, several concurrent live players |

**Also scale by connections** (event-loop / fd limits), not only bits: plan another instance around **a few thousand** concurrent spectator sockets, even if Mbps is fine.

N live players: game→relay ≈ N × player-feed; relay→public ≈ Σ(spectators_i × feed_i).

---

## 5. Can the web client render a relayed stream?

**Mostly yes for the world canvas, not as a drop-in.** `NetworkManager.handleMessage` already decodes every `ServerMessage` and drives Phaser (`NetworkManager.ts` 1818+). `GameWorld` hydrates from `INITIAL_GAME_WORLD_STATE_RECEIVED`.

**Missing for read-only watch:**

- Boot path is **wallet auth + `AuthenticateRequest` + `InitialState` bag** (`LoginScreen.ts`, `NetworkManager.connect`). Need a **spectator socket** (relay URL), stripped join snapshot (map name, followed `player_id`, AOI entities, vitals), no `AuthenticateRequest` to the game server.
- **Local prediction:** movement/cast/attack for “me” will not exist; camera must **follow `player_id` as a remote** using injected self-packets (§2).
- No `readOnly` in `InputManager`; F-keys still consume pots (`main.tsx` 332+). Must ignore input and hide bag/F5/auction/SysMenu economy (`SysMenuDialog.tsx`). ESC today **cancels cast**, not SysMenu (`main.tsx` 300–312); put “Go Live” on **F12 SysMenu** (or remap ESC).
- Landing TV is **iframe streams**, not Phaser (`landing/main.js` cartelera). Phase-1 watch = embed play client in spectator mode or a slim canvas host talking only to the relay.
- 60 s delay lives in the **relay**, not the game client.

---

## 6. Risks and phase-1 scope

**Risks:** naive socket mirror **omits the live avatar’s motion/casts**; invis packets leak positions; `InitialState` + teleports + chat are oversized/private; map change / death / reconnect must reset the 60 s buffer; 60 s delay is anti-cheat for live raiding but bad for “call the play”; current cartelera Go Live must not be confused with this feed; delayed state can desync if packets are dropped (need periodic AOI resync snapshots).

**Phase-1 (recommended):** one opt-in hunter; game→relay allowlist + self-injects; 60 s buffer; landing **one** Phaser POV (HP/MP, nearby/global chat, no bag); no guild/whisper; strip invis others and teleport lists; cap spectators per instance using §4; no video, no extra game-server sockets per viewer.
