# Chile deploy — Elon Magias city escape (Gandalf / Fire Strike)

**Do not deploy from the agent.** PaioPez applies this on the Chile play host.

Live client hash in the report: `index-DmnDzoBn.js`. Ship a **new** client + **this** server together.

## What was wrong

Elon (Elvine mage) was **not** missing Gandalf on city streets. He never reached the city.

Landmarks (Giant Tree / Unicorn / wild grass / rock ridges / hostile “Elvine Civilian” hover names) are **Elvine Garden** (`elvuni`) or the **slime traveler pad** on the Elvine map — not city streets, not Magic Tower.

1. `elvuni` / `areuni` had **empty** `teleportLocs` — AMD blue tiles did nothing. One-way trap.
2. Restart! revived **on the corpse** (`REVIVE_TO_TOWN` default off) → 4 deaths in the same hostile.
3. Login restored last saved world/coords — garden / Hunt Zone / slime pad **(149,131)** again.
4. Traveler east pad and City Hall exit landed on that slime plaza (view never includes Wizard Tower 180,77).
5. Recall / Recall Scroll are sold in the city (Gandalf / shop) — chicken and egg.

Gandalf is still inside **Elvine Wizard Tower** (`elvwzdtwr` / `wzdtwr_1` at 48,33). City door: **(180,77)**. Safe streets pad: **(158,57)**.

## What this branch does

- Restores garden exits from AMD `0x40` tiles: `elvuni` x=176 y=20–28 → `huntzone1` (23,52); `areuni` y=20 x=78–95 → `huntzone2` (115,176).
- Restart! defaults to **city plaza** (Elvine 158,57). Garden / hunt-zone deaths **always** town-revive, even if `REVIVE_TO_TOWN=0`.
- **Login / spawn-on-enter** snaps garden, hunt-zone, farm, city dungeon, traveler leftover, and the slime plaza onto Elvine **(158,57)** / Aresden **(140,49)**. Wizard Tower and other interiors stay.
- Traveler pads and City Hall exits retarget those same street pads (not 149,131 / 149,127). Server also remaps an old GameWorlds.json that still lists the slime pad.
- Garden Warden **Return to city**; Kennedy **Home · Wizard Tower (Gandalf)**.
- Guide-map pin **G** on Elvine at (181,78); garden **E** exit pin; join/death hints.

Does **not** change Magias cast, WASD, or ping.

## PaioPez — server

```bash
# On Chile / Hetzner play host after pulling this branch (or applying the tarball).
# NEVER: rsync --delete …/Config/maps
# Maps already have the blue tiles. Only GameWorlds destinations were empty.

# 1) Copy server binary + Config/GameWorlds.json + rebuilt Helpers (full publish).
#    Keep existing Config/maps/*.amd (elvuni.amd / areuni.amd stay).

# 2) Revive-to-town is the new default when REVIVE_TO_TOWN is unset.
#    Chile: leave unset, or set explicitly:
#      REVIVE_TO_TOWN=1
#    Do NOT set REVIVE_TO_TOWN=0 on Chile (corpse revive in garden is the death loop).

systemctl restart chainlords-game
```

Confirm after restart:

```bash
# Process env must not force REVIVE_TO_TOWN=0
systemctl show chainlords-game -p Environment --no-pager
```

No map file delete. If garden AMD is missing on the host, **copy** `elvuni.amd` / `areuni.amd` from this repo’s `multiplayer/server/Config/maps/` — do not wipe the maps directory.

## PaioPez — client

Build `multiplayer/mp-client` and publish static files (replaces `index-DmnDzoBn.js`). Keep `game-assets/` maps/sprites.

New client is required for: Restart! hint, Warden “Return to city”, Kennedy Wizard Tower row, guide-map **G** pin, join chat hints.

**Server-only** (binary + `GameWorlds.json`) is enough for Elon to **log in on city streets** and for Restart! / traveler / City Hall to land on (158,57). New client still needed for pins / Warden / Kennedy / death hint.

## Smoke (Elon / Maggy HOLD until this works)

1. Log in Elon (city-only / Magias). Must load **Elvine streets** at **(158,57)** — buildings, not Giant Tree / Unicorn / rock ridges / wild grass. Zero garden monsters.
2. If dead in Garden / HZ: **Restart!** → same Elvine plaza (158,57).
3. If still somehow in Garden near the HZ landing (173,24): walk **east** onto x=176 blue tiles → Hunt Zone 1 (23,52). South blue row (y=179) → Elvine (223,23), then walk to plaza / tower.
4. From plaza (158,57): walk or guide-map **G** to Wizard Tower door **(180,77)** → talk **Gandalf** → buy **Fire Strike**.
5. Optional: Kennedy → **Home · Wizard Tower (Gandalf)** lands next to Gandalf (46,34).
6. Confirm Magias / WASD / ping still work (untouched).

If Elon cannot reach the Warden (38,26), he must use Restart! or the east wall — do not send him through the Unicorn / Giant Tree center.
