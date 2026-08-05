# Helbreath War — Live observation notes (Ditizar stream)

**Source:** Discord · Cheseline Games · channel **Helbreath HUNT** · streamer **Ditizar** · “Pantalla de Ditizar”  
**Date of session:** 2026-07-30  
**Server:** **Helbreath War** (not Olympia) — user report: **100+ players online constant**  
**Capture method:** Frame bursts via Discord window screenshot (not continuous video). Typical interval ~0.4–0.7s during PvP, ~0.6s during hunt.  
**Local frame dumps:** `tmp-hunt-frames/`, `tmp-pvp-frames*`, `tmp-kill-frames/`, `tmp-war-frames/`, `tmp-invi-pvp/`, `tmp-war-*.png`

---

## 1. Context correction

| Wrong assumption (early) | Correct |
|--------------------------|---------|
| Olympia client / meta | **Helbreath War** private server |
| Quiet farm dens | High-CCU dens PvP (ToH) with constant multiplayer contact |

Discord VC: multiple people (codofliess, Feche, Nawi, etc.) watching/commenting while Ditizar streams.

---

## 2. Map / activity loop observed

### Primary map
- **Tower of Hell 3** (coords seen: ~105–234, ~167–274)
- Mini-map top-left with red blobs (mob density)
- Lava/stone classic ToH layout

### Player loop (dens + PK)
```
Farm / scout (often invi)
  → Contact enemy
  → Buff race (AMP, Defense Shield)
  → Cancellation
  → Paralyze / fields / Blizzard / ESW (burst)
  → Kill
  → Drops window on corpse
  → Loot + re-pot MP
  → Keep roaming same floor for next target
```

Mixed **quest grind** (ToH demons / Frosts dailies) **never leaves the HUD** during PvP.

---

## 3. Combat sequences

### 3.1 User-reported opener (confirmed as meta)
1. Arrive on target  
2. **Cancellation** (strip AMP/PFM)  
3. Opponent **Paralyze**  
4. Burst / “reventar”

### 3.2 Frames: multi-player dens PvP (invi swarm → fight)
Seen together on screen:
- Multiple humanoids (mage robes purple/pink, melee, cape)
- **Defense-Shield!** (red float)
- **Absolute-Magic-Protect!** (green float)
- **Blizzard!** + ice crystal ground VFX
- **Earth-Shock-Wave!**
- **Spike-Field!** (earlier burst)
- Chat: **Converted to attack mode** / **peace mode**
- Chat: **Canceled** · **MP decreased by 52 / 88 / 501**
- HP stack damage: −33, −10, −41, −45, −9 (HP 500 → 362 in one sequence)
- Enemy-looking nameplate style (e.g. `II-II-II-II` / similar)

### 3.3 Post-kill evidence
- **`Drops (16/s)`** or **`Drops (1/6)`** panel: player gear  
  - Shields (round + kite), white armor pieces, cape, colored wands  
  - Durability-style tags e.g. `(43/50)`, `6/10`
- Chat: **Absolute Magic Protection has been vanished**
- **MP increased by 38 / 46** (pot / regen after fight)

### 3.4 Invi scouting (pre-PvP)
- Many players “not fully visible” / popping for buffs  
- Magic menu hover: **Invisibility** — *Hides or reveals invisible targets* · Mana **16** · Required Int **30**  
- Circle spells include **Detect Invisibility**  
- Chat earlier: *You are now invisible…* · **Safe attack mode activated**

### 3.5 Cancel economics (War-specific note)
- **MP decreased by 501** on Cancel path — very expensive Cancel on this server (may differ from classic/Olympia tables).  
- Also saw Cancel with MP −52 (different spell or partial cast / different ability).

---

## 4. UI / typography notes (product parity)

### 4.1 Quest overlay (right side, no panel chrome)
```
ToH3 Demons
  demon: 113/200
Frosts Daily
  frost: 0/250
Frosts
  frost: 0/600
ToH3 Demons Daily
  demon: 0/80
```

| Property | Observation |
|----------|-------------|
| Color | Gold / amber (`~#C9A84C`), not pure white |
| Font | Classic Helbreath **serif** (Times-like), not modern sans |
| Weight | Regular / medium — not heavy bold |
| Layout | Title + indented `key: cur/max` |
| Container | **None** — text floats on map |
| Daily vs total | Same style; only name differs (`… Daily`) |
| Shadow | Minimal / none |

### 4.2 Spell floats
| Kind | Color | Example |
|------|-------|---------|
| Own / success | Lime green | `Spike-Field!`, `Defense-Shield!`, `Absolute-Magic-Protect!` |
| Hostile / other | Red | `Invisibility!`, `Blizzard!`, `Earth-Shock-Wave!`, `Defense-Shield!` (when on other?) |
| Style | Serif, hyphenated spell names, trailing `!` | |

Color rule may be “caster vs target” or “self vs other” — both green and red Def-Shield seen.

### 4.3 System chat (bottom-left over world)
| Color | Content |
|-------|---------|
| Purple/violet | `MP increased/decreased by N`, `SP increased by N` |
| Green | Buff messages, mode changes (`Converted to attack mode`, invi success, AMP vanished) |
| Red | `HP decreased by N` |

### 4.4 Magic window
- Title **Magic** (green) + gear icon  
- Circle label: **Circle Four** / **Circle Five**  
- Spell names **blue serif**; mana column right-aligned  
- Footer: **Cast Prob.: 100%** · **Hit Ratio: +353 / +358**  
- Circle Four sample: Fire Strike, Summon Creature, Invisibility, Protection From Magic, Detect Invisibility, Paralyze, Cure, Lightning Arrow, Tremor  
- Circle Five sample: Firewall, Fire Field, Confuse Language, Lightning, Great Defense Shield, Chill Wind, Poison Cloud, Triple Energy Bolt, Scan  
- Tooltip box (dark): spell name + description + Mana cost + Required Int  

### 4.5 Drops / corpse
- Modal `Drops (n/s)` semi-transparent dark  
- Grid of equipped items from victim  
- Timer/rate suffix `(16/s)` style  

### 4.6 HUD chrome
- HP red bar + current/max; MP blue bar  
- Center: Exp `717308 (62.1%)` or map name `Tower of Hell 3 (x,y)`  
- Icon row: helmet, star/pentagram, glove, scroll, book, etc.  
- SP green thin bar above exp/map  
- Optional left overlay: FPS / FBS counter  

### 4.7 Nameplates (one frame)
Stacked: character name · title (`HuntMaster`) · line (`Grinding Rewards`) · `Lv.140 (+2)`

---

## 5. Product implications for Chain Lords

| War observation | CL action / question |
|-----------------|----------------------|
| Dens PvP with 100+ feel | Capacity + AOI + ToH multiplayer density |
| Cancel → Para → burst | Validate cast order, cancel strips AMP, para lockout |
| Expensive Cancel (~500 MP) | Check our Cancel MP vs War; may be server-tuned |
| Invi swarm pre-fight | Detect Invi, invi break on action, client partial visibility |
| Quest gold serif float | Client quest HUD typography (not white sans box) |
| Bicolor spell floats + hyphens | Float style parity |
| Drops panel post-PK | Corpse loot UX |
| Attack/peace spam in chat | Mode toggle feedback |
| Safe attack | Enemy-only when safe on |

---

## 6. What was **not** recorded

- Continuous video / audio of VC callouts  
- Exact kill frame (last hit name) for every PK — some kills only evidenced by **Drops** + vitals  
- Full opponent build tooltips  
- Server rates table (official)  

To get continuous recording next time: Discord Go Live local record, or OBS on the Discord stream window, or denser frame grab (e.g. 5–10 fps) to disk during “fight” callouts.

---

## 7. Frame archive index (this session)

| Folder / file | Content |
|---------------|---------|
| `tmp-hunt-frames/h*.png` | Post-kill loot, Cancel, Spike Field, Magic C4 |
| `tmp-pvp-frames*`, `tmp-stream-f*.png` | Early PvP-ready (AMP, Invi, Safe Attack) + ToH roam |
| `tmp-kill-frames/` | Quiet post-fight scout |
| `tmp-war-frames/`, `tmp-war-*.png` | Quest panel crop, magic menu, drops, multi buff |
| `tmp-invi-pvp/i*.png` | Invi swarm → Blizzard/ESW multi-PvP + drops mid-fight |

---

*Notes compiled for Chain Lords parity / UI / PvP feel. Server is Helbreath War, not Olympia.*
