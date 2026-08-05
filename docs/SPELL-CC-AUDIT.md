# Auditoría CC / hechizos vs referencia clásica (Helbreath Olympia)

> Nota de marca: el producto es **Helbreath Chain Lord**. “Olympia” en esta auditoría = servidor/referencia de balance, no branding de producto.

Fecha: 2026-07-11 (actualizado). Referencia: `reference/Magic.cfg`, `reference/Server.cpp`.

## Paralyze / Hold / Chill — verificación

| Hechizo | Estado | Notas |
|---------|--------|-------|
| **Paralyze** (35→27) | **OK** | HOLDOBJECT val 2, 50s; bloquea move; monstruo freeze AI |
| **Hold Person** (25→28) | **OK** | HOLDOBJECT val 1, 30s; VFX `hold-twist` |
| Chill Wind / Mass / Ice Strike / Mass Ice / Ice Storm / Blizzard / Mass Blizzard | **OK** | Chill −50% move/attack/cast, 10s (Magic.cfg ICE ~4–10s) |

## Tabla de estado — hechizos combatientes / utilidad

| Hechizo (Olympia id) | Server id | Olympia | Nuestro | Estado |
|----------------------|-----------|---------|---------|--------|
| Heal (1) | 29 | `iDice(2,6)+10` HP | Igual | **Fixed** |
| Great Heal (21) | 30 | `iDice(4,10)+20` HP | Igual | **Fixed** |
| Create Food (2) | 31 | Meat/Baguette en piso | Ids 99/98 | **Fixed** |
| Defense Shield (13) | 32 | PROTECT val 3, 60s; +40 defense ratio | Flag+VFX; miss físico melee `(hit/def)*50` con base 100 | **Fixed** |
| Great Defense Shield (44) | 33 | PROTECT val 4, 40s; +100 defense ratio | Igual | **Fixed** |
| Protection From Arrow (24) | 34 | PROTECT val 1, 60s | Bloquea daño ranged físico | **Fixed** |
| Protection From Magic (33) | 35 | PROTECT val 2, 60s | Bloquea magia (Armor Break perfora) | **Fixed** |
| Absolute Magic Protect (65) | 36 | PROTECT val 5, 60s | Bloquea toda magia | **Fixed** |
| Poison (27) | 37 | level 15 DoT, tick ~12s | `iDice(1,15)` cada 12s, floor HP=1, máx 180s | **Fixed** |
| Cure (36) | 38 | Quita poison | Quita temp Poison | **Fixed** |
| Mass Poison (53) | 39 | level 40 (1×1 en Magic.cfg) | Igual single-target level 40 | **Fixed** |
| Confuse Language (42) | 40 | CONFUSE val 1, 120s | Temp + toast + chat garble (~2/3) | **Fixed** |
| Confusion (62) | 41 | CONFUSE val 2, 20s, AoE 2 | Temp + toast + hover allegiance spoof | **Fixed** |
| Mass Confusion (71) | 42 | CONFUSE val 2, 60s, AoE 2 | Igual | **Fixed** |
| Illusion (80) | 43 | CONFUSE val 3, 20s, AoE 2 | Temp + toast + hover name spoof | **Fixed** |
| Mass Illusion (90) | 44 | CONFUSE val 3, 60s, AoE 3 | Igual | **Fixed** |
| Cancellation (76) | 45 | Quita buffs/debuffs | `ClearAllTemporaryEffects` | **Fixed** |
| Inhibition Casting (83) | 46 | Bloquea cast; Last=0 en cfg | 20s (effect456 mid=20); bloquea cast server+client | **Fixed*** |
| Summon Creature (31) | 47 | Magery→mob follower | Level≈Magery; tiers Slime→Cyclops; Friendly | **Fixed**** |
| Illusion Movement (77) | 48 | Type **21** damage en este Magic.cfg | Rectangle AoE damage | **Fixed** (dmg) |
| Mass Illusion Movement (95) | 49 | Type **21** damage | Rectangle AoE damage | **Fixed** (dmg) |
| Armor Break (66) | 15 | Damage + ArmorLifeDecrement(15) | Damage + shred armor/hauberk/leggings/helmet LifeSpan | **Fixed** |
| Earthworm Strike (64) | 14 | Damage + armor life (value10=0 en este cfg) | Damage only (cfg value10=0) | **OK** |
| Invisibility / Berserk / Possession | 24–26 | Status / pickup | OK | **OK** |
| Energy/Fire/Lightning/fields/storms | 0–23 | Damage / ground | OK rough | **OK** |

\* Inhibition: `Magic.cfg` tiene `Last=0` (release inmediato en Server.cpp). Usamos **20s** del valor medio de `effect456` (8 **20** 30) de la misma fila — documentado, no inventado fuera del cfg.

\*\* Summon: sin skill Magery ni follow-mode Olympia; Level del caster sustituye Magery para el dado de tier. Un spawn Friendly por cast.

## Proto `TemporaryEffectType` (nuevos)

| Valor | Nombre |
|-------|--------|
| 4 | Poison |
| 5 | ConfuseLanguage |
| 6 | Confusion |
| 7 | Illusion |
| 8 | IllusionMovement |
| 9 | Inhibition |
| 10–14 | ProtectFromArrow / Magic / DefenseShield / GreatDefenseShield / AbsoluteMagicProtect |

Grupos (no stackean entre sí): Chill=1, Berserk=2, Paralyze=3, Poison=4, Confuse*=5, Inhibition=6, Protect*=7.

## Gaps restantes

| Tema | Motivo |
|------|--------|
| Hit-ratio melee completo | Solo Defense/Great Shield modelan miss; resto de combate sigue always-hit |
| Summon follower AI / master link / Magery skill | Sin vínculo caster↔mob ni órdenes Hold/Free/Attack |
| Illusion Movement controles invertidos | Toast UX sí; input reverse no |
| Stamina Drain / Recovery / Haste / Scan / Resurrection | Fuera de este pase (o no combat-crítico) |
| Poison resist skill clear-on-tick | Olympia puede curar por skill 23; nosotros duración fija 180s + Cure |

## VerifyFix

1. Reiniciar **server** C# (Spells.json `armorLifeDecrement`, TemporaryEffects, Combat).
2. Hard-refresh **cliente** (confuse toasts / chat garble / hover spoof).
3. Armor Break vs jugador con armadura durable: `curLifeSpan` baja 15; a 0 unequip.
4. Defense / Great Defense Shield: melee físico falla a veces; flechas no usan ese bonus (PFA aparte).
5. Summon Creature: mob Friendly por nivel (no solo Slime).
6. Confuse Language: toast + chat ilegible a veces; Confusion/Illusion: toast + hover spoof.
7. Heal / Poison / PFM / Inhibition / Paralyze: sin regresión.
