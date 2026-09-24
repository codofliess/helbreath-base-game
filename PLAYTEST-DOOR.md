# Playtest door (PLAYTEST=1)

Loopback sandbox on this repo’s master client and server. Not live Chile, not a public host.

| | |
|---|---|
| Traveler | http://127.0.0.1:8081/ |
| GM (edit kit / stats) | http://127.0.0.1:8080/ |
| Game | `127.0.0.1:31337` (not `:1337`) |

`?seat=` picks the character. First enter creates it and kits it. Later enters load `multiplayer/server/CharsPlaytest/`. GM edits persist until the bag and paperdoll are both empty.

| Agent | seat | Character | Account id |
|---|---|---|---|
| Elon | `elon` | ElonQa | `playtest-elonqa` |
| Maggy | `maggy` | MaggyQa | `playtest-maggy` |
| PIST | `pist` | PistQa | `playtest-pist` |
| Stalk Bot | `stalk` | StalkQa | `playtest-stalk` |
| Pulpo | `pulpo` | PulpoQa | `playtest-pulpo` |
| Projects Manager | `proj` | ProjQa | `playtest-proj` |
| PaioPez | `paio` | PaioQa | `playtest-paio` |

Auth token (client and server): `playtest-bypass-token`.

Traveler: http://127.0.0.1:8081/?seat=elon (swap the seat key). GM: http://127.0.0.1:8080/?seat=elon.

## Up / down

```bash
chmod +x ops/run-playtest-door.sh
./ops/run-playtest-door.sh
```

Ctrl+C stops the game, traveler, and GM. If Vite hits `EMFILE`, the playtest configs already poll instead of using native watchers. You can also `ulimit -n 65536` before the script.

The script unsets `DATABASE_URL`, `WALLET_AUTH_SECRET`, `HELL_MINT`, `MARKET_MIDDLEWARE_URL`, and `SOLANA_RPC_URL`. The server refuses to start if any of those are set while `PLAYTEST=1`. It binds `127.0.0.1` only and rejects non-loopback WebSockets. Opening the client on any host other than loopback turns the playtest UI off.

## Kit (master catalog)

This server has no level. A fresh seat is combat-ready at the session HP cap (1000) and master melee damage cap (1000), attack range 2, attack speed 400 ms, move 160 ms, cast 700 ms.

Equipped:

| Id | Name | Slot |
|---|---|---|
| 15 | Aresden Hero Helmet | helmet |
| 8 | Aresden Hero Armor | armor |
| 10 | Aresden Hero Hauberk | hauberk |
| 13 | Aresden Hero Leggings | leggings |
| 26 | Long Boots (White) | boots |
| 1 | Barbarian Battle Hammer | weapon (blocks shield; Giant Battle Hammer equivalent) |

In the bag: 17 Aresden Hero Robe, 20 Aresden Hero Cap, 22 Aresden Hero Cape, 39 Merien Shield, and Big Red Potion (164) ×5.

## Check that React mounted

After `./ops/run-playtest-door.sh`, open http://127.0.0.1:8081/?seat=maggy and confirm `#root` has children (the connect/game UI), not an empty node. The page should enter as MaggyQa without a wallet prompt.
