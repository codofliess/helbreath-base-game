# Chile deploy — Elon Magias city escape (Gandalf / Fire Strike)

**Do not deploy from the agent.** PaioPez applies this on the Chile play host.

Live client hash in the report: `index-DmnDzoBn.js`. Ship a **new** client + **this** server together.

## What was wrong

Elon (Elvine mage) was **not** missing Gandalf on city streets. He never reached the city.

Landmarks (Giant Tree / Unicorn / wild grass / rock ridges) are **Elvine Garden** (`elvuni`), entered from Hunt Zone 1 or Kennedy’s free “Home · Garden” teleport.

1. `elvuni` / `areuni` had **empty** `teleportLocs` — AMD blue tiles did nothing. One-way trap.
2. Restart! revived **on the corpse** (`REVIVE_TO_TOWN` default off) → 4 deaths in the same hostile.
3. Recall / Recall Scroll are sold in the city (Gandalf / shop) — chicken and egg.

Gandalf is still inside **Elvine Wizard Tower** (`elvwzdtwr` / `wzdtwr_1` at 48,33). City door: **(180,77)**.

## What this branch does

- Restores garden exits from AMD `0x40` tiles: `elvuni` x=176 y=20–28 → `huntzone1` (23,52); `areuni` y=20 x=78–95 → `huntzone2` (115,176).
- Restart! defaults to **city plaza** (Elvine 158,57). Garden / hunt-zone deaths **always** town-revive, even if `REVIVE_TO_TOWN=0`.
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

**Server-only** is enough for Elon if he clicks **Restart!** (town plaza) or walks onto the east blue wall once GameWorlds is live.

## Smoke (Elon / Maggy HOLD until this works)

1. If dead in Garden / HZ: **Restart!** → Elvine plaza (158,57), city streets, not Giant Tree.
2. If alive in Garden near the HZ landing (173,24): walk **east** onto x=176 blue tiles → Hunt Zone 1 (23,52). South blue row (y=179) → Elvine (223,23).
3. In Elvine: guide-map **G** or walk to Wizard Tower door **(180,77)** → talk **Gandalf** → buy **Fire Strike**.
4. Optional: Kennedy → **Home · Wizard Tower (Gandalf)** lands next to Gandalf (46,34).
5. Confirm Magias / WASD / ping still work (untouched).

If Elon cannot reach the Warden (38,26), he must use Restart! or the east wall — do not send him through the Unicorn / Giant Tree center.
