# Playtest door (PLAYTEST=1)

Loopback sandbox on the consolidacion client and server. Not live Chile, not a public host. Off unless `PLAYTEST=1` **and** the game binds `127.0.0.1`. Unset `PLAYTEST` → zero behavior change (no auth bypass).

| | |
|---|---|
| Traveler | http://127.0.0.1:8081/ |
| GM (edit kit / stats) | http://127.0.0.1:8080/ |
| Game | `127.0.0.1:31337` (not `:1337`) |

`?seat=` picks the character. First enter creates it, kits it, and seeds guild membership. Later enters load `multiplayer/server/CharsPlaytest/`. No party is pre-formed — form A+B in game.

| Seat | `?seat=` aliases | Character | Account id | Guild |
|---|---|---|---|---|
| A | `a`, `elon` | ElonQa | `playtest-a` | QA Guild One (master) |
| B | `b`, `maggy` | MaggyQa | `playtest-b` | QA Guild Two (master) |
| C | `c`, `pist` | PistQa | `playtest-c` | QA Guild One (member) |

Traveler: http://127.0.0.1:8081/?seat=a · http://127.0.0.1:8081/?seat=b · http://127.0.0.1:8081/?seat=c  
GM: http://127.0.0.1:8080/?seat=a (same seat query).

Auth token (client and server, door-on only): `playtest-bypass-token`.

## Up / down

```bash
chmod +x ops/run-playtest-door.sh
./ops/run-playtest-door.sh
```

Ctrl+C stops the game, traveler, and GM. The script unsets `DATABASE_URL`, `WALLET_AUTH_SECRET`, `HELL_MINT`, `MARKET_MIDDLEWARE_URL`, and `SOLANA_RPC_URL`. The server refuses to start if any of those are set, or if the host environment is production, while `PLAYTEST=1`. It binds `127.0.0.1` only and rejects non-loopback WebSockets. Opening the client on any host other than loopback turns the playtest UI off.

To playtest guild/party chat scoping together with this door, merge or rebase the chat-scope branch (`cursor/guild-party-chat-scope-844e`) onto this playtest checkout locally. This PR does not include that work.

## Kit

A fresh seat is combat-ready (session HP, melee damage 1000, range 2, attack 400 ms, move 160 ms, cast 700 ms). Equipped: Aresden hero warrior set + Barbarian Battle Hammer. Bag: hero mage pieces, Merien Shield, Big Red Potion ×5.
