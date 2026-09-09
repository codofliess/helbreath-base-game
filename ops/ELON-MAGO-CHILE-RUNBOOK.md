# Chile playtest — rewrite **Elon** (Elvine L150) into MAGO

PaioPez SSH recipe. **Do not deploy** a new server binary. **Never delete** `Config/maps`.
Does **not** change Magias/Gandalf, F5 HUD, or client paint. Elvine kit only (PR #62).

Repo: `codofliess/helbreath-base-game` · branch `consolidacion` · script `ops/grant-elon-mago-loadout.py`.

---

## 1. Admin API?

**None.** `Server.cs` only exposes read telemetry (`/api/realm-stats`, duels, streams).
There is no GM grant / set-stats HTTP route. Persistence is dual-write:

| Store | Path / table | Load rule |
|-------|----------------|-----------|
| JSON Chars | `/opt/chainlords/server/Chars/<wallet>.json` and `<wallet>.traveler.json` | Traveler primary; GM fallback |
| PostgreSQL | `characters.state_json` (`Persistence/schema.sql`) | **Non-traveler login prefers PG.** Traveler picks the richer of PG vs JSON (`PreferFresherPersistenceState`). |

Env: `DATABASE_URL` or `POSTGRES_CONNECTION_STRING` (`GamePersistenceService.TryCreateFromEnvironment`).
Production fail-closes without PG (`GamePersistence.InitializeAsync`).

**Must patch JSON + PG** or the next login can ignore the file you edited.

---

## 2. Exact item ids (cite)

From `multiplayer/server/Config/Items.json` + Olympia `reference/Item.cfg` / `Item2.cfg` / `Item3.cfg` + `Helpers/HeroFactionKit.cs` / `Helpers/HeroSetBonus.cs` / `Config/ArenaKitCatalog.json`.

| Slot / role | Id | Exact name | Notes |
|-------------|----:|------------|--------|
| Weapon | **861** | `Berserk Wand(MS.20)` | Catalog MS.20 (`Item3.cfg` v4=20). Pure rare — **attr 0** (`docs/OLYMPIA-ITEM-MAGIC-AFFIXES.md`). Not `Magic Wand(MS20)` (256). |
| Shield | **87** | `Tower Shield` | No separate “Light Tower Shield” row. **Light + DR70** via `ItemAttribute`. Weight 4000 → STR 40 without Light; Light nibble 10 makes STR 30 legal (`ItemEquipCatalog.GetRequiredStr`). |
| Necklace | **648** | `Necklace Of Liche` | ADDEFFECT subtype 2 mana-save **15** (`Item3.cfg`). |
| Ring | **734** | `Ringof Arcmage` | ADDEFFECT subtype 6 magical damage **+4**. |
| Cape | **401** | `Elvine Hero Cape` | **Never** `400` Aresden Hero Cape / `427` +1 Aresden. Optional `428` Elvine Hero Cape+1. |
| Helmet | **409** / **410** | `e Hero Cap(M)` / `(W)` | Mage set. **Never** `407`/`408` `a Hero Cap`. |
| Armor | **417** / **418** | `e Hero Robe(M)` / `(W)` | Mage set. **Never** `415`/`416` `a Hero Robe`. |
| Hauberk | **421** / **422** | `e Hero Hauberk(M)` / `(W)` | |
| Leggings | **425** / **426** | `e Hero Leggings(M)` / `(W)` | Full mage set = Cap+Robe+Hauberk+Legs (`HeroSetBonus` +4 magic dmg). |
| Boots | **451** | `Long Boots` | Arena starter. |
| Gold | **90** | `Gold` | Bag stack. ≥ **2000**. |
| Bag MP clothes | 753/757, 456/476, 454/472, 462/483 | Wizard-Hat / Chain Mail / Hauberk / Plate Leggings | Arena `mage-mp50` (`ArenaKitCatalog.json`). |

### Magic bitfields (`Helpers/Enchanting.Encode`)

```
attr = (upgrade<<28) | (pType<<20) | (pVal<<16) | (sType<<12) | (sVal<<8)
```

| Piece | Primary | Secondary | Encoded `ItemAttribute` |
|-------|---------|-----------|------------------------:|
| Tower Shield Light DR70 | type **6** Light val **10** | type **3** Defense Ratio val **10** (10×7=**70**) | **6961664** (`0x006A3A00`) |
| Hero / bag MP clothes | type **8** Endurance val **1** | type **6** MP regen val **7** (~49%, same as arena MP50) | **8480512** (`0x00816700`) |

`ItemColor` on the Light shield = **2** (Light palette, affix table).

---

## 3. Stats (do not invent totals)

`Helpers/Progression.cs` `GetLuPoints`:

```
LU = Level*3 - ((STR+VIT+DEX+INT+MAG+CHR) - 70) - 3 + Rebirth*6
```

`Progression.json`: `maxLevel` 150, `rebirthLuPoints` 6. Cap per stat: `Progression.MaxStat` = **200**.

Fully spent at L150 RB0: **517** points (also `ArenaKitCatalog.json` `statTotalPoints`).

Locked: **MAG 200 · INT 200 · STR 30 · DEX 50 · CHR 10** (floor; not specified → leftover goes to VIT).

| Level | RB | Budget | VIT |
|------:|---:|-------:|----:|
| 150 | 0 | 517 | **27** |
| 150 | 1 | 523 | 33 |
| 150 | 5 | 547 | 57 |
| 150 | 10 | 577 | 87 |

Script uses **live** `Level`/`Rebirth` on the save (do not force L150 if Chile differs).
If budget cannot fund MAG+INT 200, it aborts.

Derived after login (`CalcMaxHp` / `CalcMaxMp`) at L150 RB0: HP ≈ 396, MP ≈ 800.

Magic skill index **4** is raised to **100** so circle-1 casts are not skill-starved (`Helpers/Skills.cs`).

---

## 4. Persisted fields to set

`PlayerPersistenceState` (`World/Game/GameWorldMessage.cs`):

```
CharacterName        = "Elon"
CitizenshipSide      = "elvine"          // papers lock kit; never aresden
Str/Vit/Dex/Int/Mag/Chr  as above
HungerStatus         = 100
SkillLevels[4]       >= 100
BagItems             gold 90 qty ≥ 2000; optional mage-mp50 clothes; a Hero ids rewritten to e Hero
EquippedItems[]      Slot + Item { ItemId, ItemUid, ItemAttribute, ItemColor, Cur/MaxLifeSpan, … }
```

Do **not** pre-fill `LearnedOlympiaSpellIds` — Elon buys Missile/Heal at Gandalf.

Equipped `Item` omits Quantity/BagZIndex; bag rows include them.

---

## 5. SSH runbook (one session)

Host layout: `/opt/chainlords/server` · unit `chainlords-game`.
Copy the script from this repo (or `git -C /opt/chainlords/repo pull` if that clone exists).

```bash
# 0) Never touch maps
ls /opt/chainlords/server/Config/maps | head
# do NOT rm -rf Config/maps

# 1) Is Elon in memory? If realm-stats ON>0, assume yes unless you can see the name.
curl -sS http://127.0.0.1:1337/api/realm-stats || true
# Prefer stop so an autosave cannot clobber the patch:
systemctl stop chainlords-game
systemctl is-active chainlords-game   # expected: inactive

# 2) Find snapshots (JSON + PG)
python3 - <<'PY'
import json, pathlib
p=pathlib.Path("/opt/chainlords/server/Chars")
for f in sorted(p.glob("*.json")):
    if f.name in ("referrals.json","auction-board.json","hell-mining.json"): continue
    try: d=json.loads(f.read_text())
    except Exception: continue
    n=(d.get("CharacterName") or d.get("characterName") or "")
    if n.lower()=="elon":
        print(f.name, "L", d.get("Level"), "side", d.get("CitizenshipSide"), "gold piles", sum(i.get("Quantity",1) for i in (d.get("BagItems") or []) if i.get("ItemId")==90))
PY
# DATABASE_URL from the unit or ops env (do not paste secrets into chat):
systemctl show chainlords-game -p EnvironmentFiles -p Environment | head
# If DATABASE_URL is set:
# psql "$DATABASE_URL" -c "SELECT account_wallet, name, slot_index, (state_json->>'Level') AS lvl FROM characters WHERE LOWER(name)='elon';"

# 3) Dry-run then apply (Elvine only; backs up JSON under Chars/backups-elon-mago/)
export CHARS_DIR=/opt/chainlords/server/Chars
# export DATABASE_URL=...   # if not already in the shell from the unit
python3 /path/to/ops/grant-elon-mago-loadout.py --park-gandalf
python3 /path/to/ops/grant-elon-mago-loadout.py --park-gandalf --apply

# 4) Start game. Do not rsync a new Server binary unless PO asked.
systemctl start chainlords-game
systemctl --no-pager --lines=40 status chainlords-game
```

`--park-gandalf` sets `GameWorldId=elvwzdtwr` X=45 Y=33 (Gandalf NPC 1 is 48,33; interact range 4).
Omit the flag to keep Elon’s current cell.

Manual JSON/SQL if the script is not on the box yet: take the dry-run `AFTER` object the script prints on a laptop against a copied save, or set the fields in §4 with the ids in §2. SQL shape:

```sql
-- after you have patched_state.json
UPDATE characters
SET state_json = pg_read_file is NOT used (superuser).
-- Prefer: python script dual-write, or
--   UPDATE characters SET state_json = $ELONJSON$ ... $ELONJSON$::jsonb, updated_at=NOW()
--   WHERE LOWER(name)='elon';
```

---

## 6. After login (Elon)

1. Confirm side **Elvine**, stats MAG/INT 200, STR 30, DEX 50, VIT as table, gold ≥ 2000.
2. Equipped: Berserk Wand(MS.20), Light Tower Shield, e Hero Cap/Robe/Hauberk/Legs, Elvine cape, Liche, Ringof Arcmage. **No** `a Hero` names.
3. Walk into Elvine Magic Tower (`elvwzdtwr`) → Gandalf → Learn:
   - **Magic-Missile** Olympia id **0** · 100g · ReqInt 18 (`reference/Magic.cfg`)
   - **Heal** Olympia id **1** · 100g · ReqInt 20 → server spell **29** (`MagicTower.OlympiaToServerSpellId`)
4. Cast **Heal**. It is mapped and must work.
5. **Missile / Energy Bolt caveat (do not change Gandalf code):**
   - Tower will **sell** Missile (id 0) and store it on `LearnedOlympiaSpellIds`.
   - There is **no** `OlympiaToServerSpellId[0]` (Magic-Missile + Energy-Bolt collapse). Traveler allowlist always has server catalog id **0** = **Energy Bolt** (Olympia 10).
   - So: Heal casts. Circle-1 “Missile” does not become a distinct server spell. Learn **Energy Bolt** (id **10**, 200g) for a mapped bolt. 2000g covers 0+1+10.

### Shield vs cast

`EquipCombatRules.PrepareForSpellCast` unequips every shield except Devlin **1320–1322**.
Tower Shield **87** is correct MAGO gear but **will go to bag on first cast**. That is expected. Do not swap in an Aresden shield.

---

## 7. Safety

- Stop `chainlords-game` if Elon might be online (save-on-exit overwrites Chars/PG).
- Backup JSON before write (`Chars/backups-elon-mago/`).
- Do not delete or rsync `--delete` `Config/maps`.
- Do not grant `400/403/404/407/408/411/412/415/416/419/420/423/424/427`.
- Do not merge this recipe into Magias, HUD, or client paint PRs.
