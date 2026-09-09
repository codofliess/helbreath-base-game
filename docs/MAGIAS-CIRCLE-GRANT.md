# Magias / F7 Circle — exact persist fields

F7 Circle One does **not** read Magic skill (`SkillLevels[4]`) or a persist `Gold` scalar. The traveler HUD fills the book from client `learnedSpellIds` (Olympia **Magic.cfg** ids 0/1/2 = Missile/Heal/Create Food).

Those ids arrive from:

1. Join / reconnect / Gandalf ACK: `CityNpcServiceResult` role `magic-shop` with `cityServicesSummary=gold=<bag90>;learned=<olympiaCsv>`
2. Persist `LearnedOlympiaSpellIds` (server memory → that ACK)
3. InitialState **adds** mapped combat ids (Heal 29 → Olympia 1). It must **not replace** the book — catalog id 0 is Energy Bolt, not Missile.

`SkillLevels[4] = 100` only changes **Success Ratio** / cast speed. It does **not** unlock Missile/Heal.

Gandalf spends **bag item 90 Quantity**, not `Gold`. The Learn button does not client-abort when the bag snapshot looks empty; the server counts item 90.

## Grant (offline — player must relog)

Write **both** dual-write stores or the higher-XP snapshot wins and used to drop the grant. This branch **unions** `LearnedOlympiaSpellIds`, bag gold stacks, `Gold` scalar, and per-index max `SkillLevels` from Postgres + `Chars/<wallet>.traveler.json`.

```json
{
  "LearnedOlympiaSpellIds": [0, 1, 2],
  "SkillLevels": [20, 20, 20, 20, 100],
  "Gold": 0,
  "BagItems": [
    {
      "ItemId": 90,
      "ItemUid": 90001,
      "BagX": 0,
      "BagY": 0,
      "Quantity": 1700,
      "BagZIndex": 0
    }
  ]
}
```

| Field | What Circle / Gandalf actually use |
|-------|-------------------------------------|
| `LearnedOlympiaSpellIds` | **Yes** — Olympia ids. `0` Missile, `1` Heal, `2` Create Food |
| `BagItems[].ItemId=90` + `Quantity` | **Yes** — only gold form Gandalf counts |
| `Gold` | Fallback only if bag gold is 0 (then server creates item 90) |
| `SkillLevels[4]` | Cast success only (index 4 = Magic) |
| Mag / Int | Cast math only |

Traveler file: `Chars/<wallet>.traveler.json` (not the GM `Chars/<wallet>.json` sandbox).

If the character is **online**, editing disk/Postgres is overwritten by the next save. Stop the session or apply after logout.

## After this server is live

Join sends `learned=` even without clicking Gandalf (Elon can be in `huntzone1`). F7 Circle One should list Missile / Heal / Create Food when persist has `[0,1,2]`. A later Energy-Bolt-only InitialState no longer wipes those Olympia ids.

Heal is server-authoritative (Spells.json 29). Missile has no server catalog id — Heal is the PVE cast path.

Do **not** deploy Chile from the agent. Paio applies the `play-server-*-magiascircle` tarball and a client build that includes the F7 book merge (this branch). Live `index-51e24d64.js` still **replaces** the book from the catalog — deploy the new client with the server, or Circle One can empty again after a map transfer.
