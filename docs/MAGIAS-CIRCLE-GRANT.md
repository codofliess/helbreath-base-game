# Magias / F7 Circle — exact persist fields

F7 Circle One does **not** read Magic skill or a `Gold` scalar. The live traveler HUD (`index-51e24d64.js` and this branch) fills the book from client `learnedSpellIds` (Olympia **Magic.cfg** ids).

Those ids arrive from:

1. Join / reconnect / Gandalf ACK: `CityNpcServiceResult` role `magic-shop` with `cityServicesSummary=gold=<bag90>;learned=<olympiaCsv>`
2. Persist `LearnedOlympiaSpellIds` (server memory → that ACK)

`SkillLevels[4] = 100` only changes **Success Ratio** / cast speed. It does **not** unlock Missile/Heal.

Gandalf spends **bag item 90 Quantity**, not `Gold`.

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

Join sends `learned=` even without clicking Gandalf. F7 Circle One should list Missile / Heal / Create Food when persist has `[0,1,2]`. Heal is server-authoritative (Spells.json 29). Missile has no server catalog id on the live client — Heal is the PVE cast path.

Do **not** deploy Chile from the agent. Paio applies `play-server-<sha>-magiascircle`.
