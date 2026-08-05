# Mob Mastery + personal $HELL stake stacking

**Fecha:** 2026-07-25  
**Estado:** diseño de producto (PO) — **no implementado**  
**Relaciona:** MASTERPLAN § 1.6–1.7 (stake utility, no yield) · F11 Monster Kills · `Progression` kill counters  
**Ticker:** $HELL (utility / play-mine). Stake **no emite** tokens (C1).

---

## 1. Intent

Cada jugador tiene un **nivel de maestría por especie de monstruo** (catalog monster id). Ese nivel da bonos **solo contra ese bicho**:

| Bonus | Dirección |
|-------|-----------|
| Daño infligido al monstruo | ↑ |
| Daño recibido de ese monstruo | ↓ |
| Drop rate (loot de ese monstruo) | ↑ |
| Hit probability (melee/magia) vs ese monstruo | ↑ |
| (Opcional futuro) exp vs ese monstruo | ↑ |

El nivel efectivo se compone de:

1. **Base por kills** — lo que ganaste matando ese bicho (grind real).  
2. **Boost por stake personal** — $HELL staked en la **wallet** del jugador (1 wallet = 1 stake; todos los chars de la wallet **comparten** el boost).

Stake **no reemplaza** el grind: multiplica / suma encima del nivel base por kills. Sin kills, el boost de stake sobre nivel 0 sigue siendo “nivel stake-only” (ver § 3.3).

---

## 2. Fórmulas canónicas (cerradas por PO 2026-07-25)

### 2.1 Stake → niveles extra (global a todos los bichos)

```
stakeBonusLevels = floor(stakedHell / 100_000)   // 100k = +1; 5M = +50
```

| Staked $HELL | Bonus levels (todos los mobs) |
|-------------:|------------------------------:|
| 0 – 99_999   | 0 |
| 100_000      | +10 |
| 200_000      | +20 |
| 500_000      | +50 |
| 1_000_000    | +100 |

**Ejemplo PO:** base kill level 7 + 500k staked → `7 + 50 = 57` efectivo.

### 2.2 Nivel efectivo

```
effectiveMobLevel(monsterId) =
  killBaseLevel(monsterId) + stakeBonusLevels
```

- `killBaseLevel` ≥ 0, entera.  
- `stakeBonusLevels` ≥ 0, **igual para todos** los `monsterId` del jugador.  
- No se stackea por character: el stake es de **wallet**; kills son de **character** (o de wallet — open § 6).

### 2.3 Nivel base por kills — **Olympia Specialty (UI #315)**

Detalle completo: [`OLYMPIA-MOB-SPECIALTY-LADDER.md`](./OLYMPIA-MOB-SPECIALTY-LADDER.md).

```
// max L such that kills >= 150 * L²  (Orc/Snake/Ant pattern)
threshold(L) = 150 * L * L
specialtyLevel = max { L ≥ 1 : kills >= threshold(L) } or 0
```

| Level | Kills | Bonus Olympia (Orc tooltip) |
|------:|------:|-----------------------------|
| 1 | 150 | **+1 Damage** vs that mob |
| 2 | 600 | **−1 Damage Received** from that mob |
| 3 | 1350 | **+2.00% Drop Rate** |
| 4 | 2400 | **+1.96% Drop** |
| 5–8 | 3750…9600 | drop % −0.04 pp por nivel (1.92…1.81) |

**Stake:** `effectiveLevel = specialtyLevel + floor(staked/100_000)*10`  
Bonuses = **suma de los steps 1..effectiveLevel** de la misma escalera Olympia (no inventar % lineales aparte).

Ejemplo: Orc 359 kills → specialty **L1** (+1 dmg). Stake 500k → +50 → **effective L51**.

Algunos mobs UI muestran 50/100 kills/bar — posible `base * L²` por especie; default CL **base=150**.

---

## 3. Curva de bonos = escalera Olympia (no % flat inventado)

**No usar** solo “+0.5% dmg × L”. Usar el **mismo camino** que Olympia:

| Al alcanzar nivel | Bono (stackea) |
|------------------:|----------------|
| 1 | +1 flat damage dealt to that mob |
| 2 | −1 flat damage taken from that mob |
| 3+ | +drop% diminishing (~2.00 − 0.04×(L−3) each step) |

**Hit probability / more +dmg at high L:** no aparecen en el tooltip #315 hasta L8 — **open** (extraer más capturas o Client.cpp). Mientras tanto:

- Implementar L1–L8 exactos.  
- L9+ extrapolar solo drop% con la misma pendiente hasta cap.  
- Hit%: pendiente de data (no inventar sin evidencia).

Notas:

- Bonos son **solo vs catalog id** del monstruo (no “todos los slimes del mapa” genéricos si hay ids distintos; 1 id = 1 track).  
- No se aplican en **torneo equal-footing** / Academy loadout (lista negra combate de torneo se mantiene).  
- Stake sigue **sin yield** ni fee-share; esto es **utilidad de grind** (C2.a), no ingreso pasivo.

### 3.1 Interacción con hit-ratio global

Hoy el combate es nearly always-hit (gap P0). Cuando exista hit/miss real:

```
finalHitChance = clamp(baseHit + masteryHitBonus(L) + otherMods, minHit, maxHit)
```

Hasta entonces, se puede:

- **Opción A:** solo aplicar dmg/drop/taken (no hit), o  
- **Opción B:** stub hit bonus en log + UI “+X% hit when rolls land”.

Recomendación: **A** hasta ship del hit system.

### 3.2 Drop

Multiplicar solo en el path de loot de **ese** monstruo (`MonsterLoot`), no drop global de stake § 1.7 (ese queda aparte o se unifica — open § 6).

### 3.3 Nivel 0 + solo stake

Con 500k stake y 0 kills de Ettin: `effective = 50`.  
Producto: ¿permitido?  

| Opción | Efecto |
|--------|--------|
| **Permitir** (default) | Stake da poder inmediato vs todos los mobs a nivel 0 base — fuerte P2W grind |
| **Requiere base ≥ 1** | `effective = base + stake` solo si `base ≥ 1` (al menos 100 kills) |
| **Stake half-rate si base 0** | `stakeBonus *= 0.5` hasta first level |

**Recomendación:** **requiere base ≥ 1** para aplicar stake a ese bicho (anti “wallet rica sin matar”). Open PO.

---

## 4. Stacking personal — modelo de capas

```
┌─────────────────────────────────────────────────────────┐
│ Wallet                                                  │
│  stakedHell  ──► stakeBonusLevels (100k → +10)          │
│  (chars A/B/C comparten el mismo bonus)                 │
└─────────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
      Char A          Char B          Char C
   kills[slime]=700  kills[...]=…   kills[...]=…
   base=7            base=…          base=…
   eff = base+stake  eff=…           eff=…
```

| Capa | Scope | Persistencia |
|------|--------|--------------|
| Stake amount | Wallet | On-chain / off-chain stake ledger (TBD implement) |
| Kill counts | Character (hoy) | `GameWorldPlayer.monsterKills` + char save |
| Effective level | Runtime | No se guarda; se deriva |
| Claimed kill milestones | Character | Ya existe (`Progression` milestones) — **independiente** de mastery level |

Milestones F11 (Frost 500, Unicorn, RB…) **no se reescriben**: siguen siendo one-shot rewards. Mastery level es **continuo** y distinto.

---

## 5. UI / UX

### F11 Monster Kills (extender)

Por fila de monstruo:

```
Slime          kills  712
  Mastery      base 7  + stake 50  =  Lv 57
  Bonuses      +28.5% dmg · −20% taken · +22.8% drop · +14.3% hit
```

Header wallet:

```
Staked: 500,000 $HELL  →  +50 mastery levels (all species)
Next tier: 100k more → +10
```

### F5 / SysMenu stake panel (futuro)

- Mostrar `stakedHell`, `stakeBonusLevels`, unstake cooldown (7–14d, MASTERPLAN).  
- Copy freeze: **utility, not yield**.

---

## 6. Opens / decisiones pendientes

| # | Pregunta | Default propuesto |
|---|----------|-------------------|
| O1 | `KILLS_PER_LEVEL` / curva log | 100 kills / lvl, cap 100 |
| O2 | Stake sin kills de ese mob | Requiere base ≥ 1 |
| O3 | Kills por **char** vs **wallet** agregadas | Char (como hoy); stake wallet |
| O4 | Cap `effectiveMobLevel` | 200 |
| O5 | ¿Exp bonus? | Off al inicio |
| O6 | ¿Unificar drop stake global §1.7 con mastery drop? | Mantener separados al inicio (global R vs per-mob L) |
| O7 | Torneos / Academy | Mastery **off** (equal footing) |
| O8 | Implementación stake on-chain vs server ledger mock | Mock server `stakedHell` en char/wallet JSON para test; on-chain después |
| O9 | ¿Guild stake suma al personal? | No (guild = features distintas) |

---

## 7. Implementación sugerida (cuando se apruebe)

### Fase 0 — mock (1–2 días)
1. `MobMastery.cs`: `GetKillBaseLevel`, `GetStakeBonusLevels`, `GetEffectiveLevel`.  
2. Config `MobMastery.json` (killsPerLevel, caps, % per level).  
3. Campo mock `StakedHell` en wallet/char save (GM set / env test).  
4. Wire **damage dealt/taken** y **drop mult** en `Combat` / `MonsterLoot` por `catalogMonsterId`.  
5. F11 muestra base + stake + effective.

### Fase 1 — balance
6. Tablas en sim (hoja) con L=0/7/50/100/150.  
7. Caps y O2 (require base≥1).

### Fase 2 — stake real
8. Leer stake on-chain o custody ledger.  
9. Unstake cooldown.  
10. UI stake en SysMenu.

### No hacer en v1
- Yield, fee-share, “stake = salary”.  
- Mastery en torneo.  
- 200 canales Discord por stake (otro doc).

---

## 8. Pseudo-código servidor

```csharp
// Config
const long StakePerTier = 100_000;
const int LevelsPerStakeTier = 10;
const int KillsPerLevel = 100;
const int MaxKillLevel = 100;

int StakeBonusLevels(long stakedHell) =>
    (int)(Math.Min(stakedHell, long.MaxValue) / StakePerTier) * LevelsPerStakeTier;

int KillBaseLevel(long kills) =>
    (int)Math.Min(MaxKillLevel, kills / KillsPerLevel);

int EffectiveMobLevel(GameWorldPlayer p, int catalogMonsterId) {
    var kills = p.GetMonsterKills(catalogMonsterId); // existing dict
    var baseLv = KillBaseLevel(kills);
    var stakeLv = StakeBonusLevels(p.AccountStakedHell); // wallet-scoped
    // O2: if (baseLv < 1) return baseLv; // no stake amplify until first mastery level
    return baseLv + stakeLv;
}

// Damage out
dmg = dmg * (1.0 + 0.005 * EffectiveMobLevel(attacker, monster.CatalogId));

// Damage in
dmg = dmg * (1.0 - Math.Min(0.50, 0.0035 * EffectiveMobLevel(defender, monster.CatalogId)));

// Drop chance multiplier on that monster's loot rolls
chance *= (1.0 + 0.004 * EffectiveMobLevel(killer, monster.CatalogId));
```

---

## 9. Ejemplo narrativo (PO)

> Mataste 700 Slimes → base **Lv 7**.  
> Stakeaste **500 000 $HELL** → +**50** niveles a **todos** los bichos.  
> Vs Slime jugás a **Lv 57**: más daño, menos daño recibido, más drop, mejor hit.  
> Vs Ettin (0 kills) → Lv 0 o Lv 50 según O2; recomendación: **Lv 0** hasta el primer tramo de kills.

---

## 10. Alineación legal / copy

- Stake = **utilidad de progresión PvE** (maestría), no ROI.  
- No marketing “stake and earn $”.  
- Descuentos soulbound (C2.b / C3) siguen en track separado.  
- Play-mine sigue siendo la **única** vía de emisión por jugar (C1).

---

## 11. Checklist de aprobación PO

- [ ] Confirmar fórmula stake: `floor(stake/100k)*10`  
- [ ] Confirmar curva kills → base level (100 kills/lvl?)  
- [ ] O2: ¿stake sin kills aplica?  
- [ ] Caps % dmg/drop/hit  
- [ ] Mock `StakedHell` en test week sí/no  
- [ ] F11 UI en el mismo batch que server wire  

Cuando estén tildados, se puede codear Fase 0 sin redeploy de tokenomics on-chain.
