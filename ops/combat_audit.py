#!/usr/bin/env python3
"""
Combat / specialty / drop GROSS-ERROR audit (no feel/timing).

Mirrors server formulas from:
  PlayerDerivedStats.RollMagicDamage / ApplyPhysicalMitigation / ApplyMagicMitigation
  CombatHit hit chances (deterministic mid-point)
  MobSpecialty.AggregateBonuses + ApplyOutgoing/Incoming/DropMult

Usage (Windows or VPS):
  python ops/combat_audit.py
  python ops/combat_audit.py --config-dir multiplayer/server/Config --out docs/qa/combat-audit-latest.md

Exit code 1 if any FAIL (gross errors).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


# ─── specialty (port of MobSpecialty.cs) ─────────────────────────────────────

def specialty_level_from_kills(kills: int, base_kills: int, max_level: int = 200) -> int:
    if kills <= 0 or base_kills <= 0:
        return 0
    level = 0
    for l in range(1, max_level + 1):
        if kills >= base_kills * l * l:
            level = l
        else:
            break
    return level


def aggregate_bonuses(bonuses: list[str], effective_level: int):
    flat_dmg = flat_red = 0
    dmg_pct = red_pct = drop_pct = hit_pct = 0.0
    drop_steps = 0
    if effective_level <= 0 or not bonuses:
        return flat_dmg, flat_red, dmg_pct, red_pct, drop_pct, hit_pct
    for level in range(1, effective_level + 1):
        if level - 1 < len(bonuses):
            b = bonuses[level - 1]
        else:
            b = "drop_rate"
        if b == "damage":
            flat_dmg += 1
        elif b == "damage_reduction":
            flat_red += 1
        elif b == "damage_pct":
            dmg_pct += 2.0
        elif b == "damage_reduction_pct":
            red_pct += 2.0
        elif b in ("hit_ratio", "hit_ratio_pct"):
            hit_pct += 2.0
        else:
            drop_pct += max(0.5, 2.0 - 0.04 * drop_steps)
            drop_steps += 1
    return flat_dmg, flat_red, dmg_pct, red_pct, drop_pct, hit_pct


def apply_outgoing(base: int, flat: int, pct: float) -> int:
    if base <= 0:
        return base
    dmg = base + flat
    if pct > 0:
        dmg = int(round(dmg * (1.0 + pct / 100.0)))
    return max(1, dmg)


def apply_incoming(base: int, flat_red: int, red_pct: float) -> int:
    if base <= 0:
        return base
    dmg = max(0, base - flat_red)
    if red_pct > 0 and dmg > 0:
        dmg = int(round(dmg * (1.0 - min(90.0, red_pct) / 100.0)))
    return max(0, dmg)


def drop_mult(drop_pct: float) -> float:
    if drop_pct <= 0:
        return 1.0
    return 1.0 + min(200.0, drop_pct) / 100.0


# ─── magic / physical (expected values, port of PlayerDerivedStats) ──────────

def expected_magic_damage(mag: int, dice_count: int, dice_sides: int, dice_bonus: int, mult: float = 1.0) -> float:
    """E[dice] + Mag/3.3% (no gear/hero/berserk)."""
    avg_dice = dice_count * (dice_sides + 1) / 2.0 + dice_bonus
    mag_pct = mag / 3.3
    scaled = avg_dice + avg_dice * (mag_pct / 100.0)
    if mult and abs(mult - 1.0) > 1e-6:
        scaled *= mult
    return max(1.0, scaled)


def apply_pa(damage: int, pa_percent: int) -> int:
    if damage <= 0:
        return 0
    pa = min(80, max(0, pa_percent))
    if pa <= 0:
        return damage
    absorbed = damage * pa // 100
    return max(1, damage - absorbed)


def apply_ma(damage: int, ma_percent: int) -> int:
    if damage <= 0:
        return 0
    ma = min(80, max(0, ma_percent))
    if ma <= 0:
        return damage
    absorbed = damage * ma // 100
    return max(1, damage - absorbed)


def melee_hit_chance_vs_monster(dex: int, gen: int, specialty_hit: int = 0) -> int:
    chance = 72 + dex // 4 - gen * 3 + specialty_hit
    return max(18, min(97, chance))


def magic_hit_chance_vs_monster(mag: int, gen: int, mhr: int = 0, specialty_hit: int = 0) -> int:
    chance = 78 + mag // 5
    if mhr > 0:
        chance -= min(60, max(0, mhr)) // 2
    else:
        chance -= gen * 2
    chance += specialty_hit
    return max(18, min(97, chance))


@dataclass
class Finding:
    severity: str  # FAIL | WARN | INFO
    area: str
    message: str


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)

    def add(self, severity: str, area: str, message: str):
        self.findings.append(Finding(severity, area, message))

    @property
    def fails(self) -> list[Finding]:
        return [f for f in self.findings if f.severity == "FAIL"]


def run_audit(config_dir: Path) -> Report:
    r = Report()
    monsters = load_json(config_dir / "Monsters.json")
    spells = load_json(config_dir / "Spells.json")
    items = load_json(config_dir / "Items.json")
    specs_raw = load_json(config_dir / "MobSpecialties.json")

    items_by_id = {int(i["id"]): i for i in items if "id" in i}
    monsters_by_id = {int(m["id"]): m for m in monsters if "id" in m}
    specs = {}
    for row in specs_raw:
        if "id" not in row:
            continue
        specs[int(row["id"])] = {
            "base": int(row.get("base_kills") or 125),
            "bonuses": list(row.get("bonuses") or ["damage", "damage_reduction", "drop_rate"]),
            "segment": row.get("segment", ""),
            "name": row.get("name", ""),
        }

    # ── 1) Catalog integrity ──────────────────────────────────────────────
    weapons = [i for i in items if str(i.get("itemType", "")).lower() == "weapon"]
    r.add("INFO", "catalog", f"Weapons={len(weapons)} Monsters={len(monsters)} Spells={len(spells)} SpecialtyDefs={len(specs)}")

    # ID collisions / known gross bugs
    for wid, expected_sub in [(1314, "Inhibition"), (1315, "Cancellation"), (1316, "MIM")]:
        it = items_by_id.get(wid)
        if not it:
            r.add("FAIL", "ms22", f"Item {wid} missing from Items.json")
        else:
            name = it.get("name") or ""
            if "MS22" not in name and expected_sub not in name:
                r.add("FAIL", "ms22", f"Item {wid} name={name!r} — expected MS22 charge wand ({expected_sub})")
            if str(it.get("itemType", "")).lower() != "weapon":
                r.add("FAIL", "ms22", f"Item {wid} type={it.get('itemType')!r} — must be weapon")

    for tid, tname in [(1317, "Reputation"), (1318, "Sex Change"), (1305, "Stat Change")]:
        it = items_by_id.get(tid)
        if not it:
            r.add("WARN", "cash", f"Ticket id {tid} ({tname}) missing from Items.json")

    debow = items_by_id.get(618)
    if not debow or "Dark Elf" not in (debow.get("name") or ""):
        r.add("FAIL", "debow", "Dark Elf Bow id 618 missing or misnamed")

    # ── 2) Loot emptiness + DE bow presence on dragons ────────────────────
    dragon_ids = [5, 43, 44, 45, 110, 111, 112, 113, 114]
    # Only fail empty loot for open-world farmables (have genLevel). Towers/guards/academy = WARN.
    empty_farm = []
    empty_npc = []
    for mid, m in monsters_by_id.items():
        loot = m.get("loot") or []
        if loot:
            continue
        label = f"{m.get('name')}({mid})"
        if m.get("genLevel") is not None:
            empty_farm.append(label)
        else:
            empty_npc.append(label)
    if empty_farm:
        r.add("FAIL", "loot", f"{len(empty_farm)} farmable monsters (genLevel set) with EMPTY loot: {', '.join(empty_farm[:20])}")
    if empty_npc:
        r.add("WARN", "loot", f"{len(empty_npc)} non-gen NPC/tower/dummy empty loot (ok if intentional): {', '.join(empty_npc[:12])}…")

    for did in dragon_ids:
        m = monsters_by_id.get(did)
        if not m:
            r.add("WARN", "loot", f"Dragon id {did} missing")
            continue
        loot = m.get("loot") or []
        has_debow = any(int(e.get("itemId") or 0) == 618 for e in loot)
        if not has_debow:
            r.add("FAIL", "debow", f"{m.get('name')}({did}) loot has no Dark Elf Bow (618)")
        # wrong Merien Shield 620 is fine as shield drop; just note if ONLY 620 without 618
        if any(int(e.get("itemId") or 0) == 620 for e in loot) and not has_debow:
            r.add("FAIL", "debow", f"{m.get('name')}: has item 620 (Merien Shield) but not 618 Debow — classic confusion")

    # ── 3) Specialty L0 → L25 invariants (all specialty defs) ─────────────
    base_dmg = 100
    base_taken = 100
    for mid, defn in specs.items():
        b0 = aggregate_bonuses(defn["bonuses"], 0)
        b25 = aggregate_bonuses(defn["bonuses"], 25)
        out0 = apply_outgoing(base_dmg, b0[0], b0[2])
        out25 = apply_outgoing(base_dmg, b25[0], b25[2])
        in0 = apply_incoming(base_taken, b0[1], b0[3])
        in25 = apply_incoming(base_taken, b25[1], b25[3])
        dm0 = drop_mult(b0[4])
        dm25 = drop_mult(b25[4])

        name = defn.get("name") or monsters_by_id.get(mid, {}).get("name") or str(mid)
        if out25 < out0:
            r.add("FAIL", "specialty-out", f"{name}({mid}): outgoing dmg L25 {out25} < L0 {out0}")
        if in25 > in0:
            r.add("FAIL", "specialty-in", f"{name}({mid}): incoming dmg L25 {in25} > L0 {in0} (should reduce taken)")
        if dm25 + 1e-9 < dm0:
            r.add("FAIL", "specialty-drop", f"{name}({mid}): dropMult L25 {dm25:.3f} < L0 {dm0:.3f}")
        # At least some bonus at L25 for any ladder that starts with combat/drop
        if b25[0] == 0 and b25[2] == 0 and b25[4] == 0 and b25[1] == 0:
            r.add("FAIL", "specialty-empty", f"{name}({mid}): L25 produces zero bonuses")

    # Sample table for report
    sample_mids = [40, 18, 20, 33, 55, 110, 21]  # orc demon frost hc tw earth-dragon gargoyle
    r.add("INFO", "specialty-sample", "L0→L25 sample (base hit 100):")
    for mid in sample_mids:
        defn = specs.get(mid) or {
            "base": 125,
            "bonuses": ["damage", "damage_reduction", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate", "drop_rate"],
            "name": monsters_by_id.get(mid, {}).get("name", str(mid)),
        }
        b0 = aggregate_bonuses(defn["bonuses"], 0)
        b25 = aggregate_bonuses(defn["bonuses"], 25)
        out0, out25 = apply_outgoing(100, b0[0], b0[2]), apply_outgoing(100, b25[0], b25[2])
        in0, in25 = apply_incoming(100, b0[1], b0[3]), apply_incoming(100, b25[1], b25[3])
        r.add(
            "INFO",
            "specialty-sample",
            f"  {defn.get('name')}({mid}): out {out0}→{out25} | taken {in0}→{in25} | "
            f"drop× {drop_mult(b0[4]):.2f}→{drop_mult(b25[4]):.2f} | hit+{b25[5]:.0f} | "
            f"base_kills={defn.get('base')}",
        )

    # ── 4) Magic expected damage scales with Mag ──────────────────────────
    # Energy Bolt id 0: 2d4+1
    sp0 = next((s for s in spells if int(s.get("id", -1)) == 0), None)
    if sp0:
        e_low = expected_magic_damage(10, sp0.get("damageDiceCount") or 2, sp0.get("damageDiceSides") or 4, sp0.get("damageDiceBonus") or 1)
        e_hi = expected_magic_damage(200, sp0.get("damageDiceCount") or 2, sp0.get("damageDiceSides") or 4, sp0.get("damageDiceBonus") or 1)
        if e_hi <= e_low:
            r.add("FAIL", "magic", f"Energy Bolt EV Mag200 {e_hi:.1f} <= Mag10 {e_low:.1f}")
        else:
            r.add("INFO", "magic", f"Energy Bolt EV Mag10={e_low:.1f} Mag200={e_hi:.1f} (ok scales)")
    else:
        r.add("FAIL", "magic", "Spell id 0 Energy Bolt missing")

    blizz = next((s for s in spells if "blizzard" in str(s.get("name", "")).lower() and "mass" not in str(s.get("name", "")).lower()), None)
    if blizz:
        e_b = expected_magic_damage(
            150,
            blizz.get("damageDiceCount") or 2,
            blizz.get("damageDiceSides") or 6,
            blizz.get("damageDiceBonus") or 0,
            float(blizz.get("damageMultiplier") or 1.0),
        )
        r.add("INFO", "magic", f"Blizzard EV Mag150≈{e_b:.1f} (dice={blizz.get('damageDiceCount')}d{blizz.get('damageDiceSides')}+{blizz.get('damageDiceBonus')})")
        if e_b < 2:
            r.add("FAIL", "magic", f"Blizzard expected damage absurdly low: {e_b}")
    else:
        r.add("FAIL", "magic", "Blizzard spell not found in Spells.json")

    # ── 5) PA / MA mitigation monotonic ───────────────────────────────────
    for pct in (0, 20, 50, 80):
        d = apply_pa(100, pct)
        if d > 100 or (pct > 0 and d >= 100):
            r.add("FAIL", "pa", f"PA{pct}% on 100 dmg → {d} (should reduce)")
        d2 = apply_ma(100, pct)
        if d2 > 100 or (pct > 0 and d2 >= 100):
            r.add("FAIL", "ma", f"MA{pct}% on 100 dmg → {d2} (should reduce)")
    r.add("INFO", "mitigation", f"PA samples: 0%→{apply_pa(100,0)} 20%→{apply_pa(100,20)} 50%→{apply_pa(100,50)} 80%→{apply_pa(100,80)}")
    r.add("INFO", "mitigation", f"MA samples: 0%→{apply_ma(100,0)} 20%→{apply_ma(100,20)} 50%→{apply_ma(100,50)} 80%→{apply_ma(100,80)}")

    # ── 6) Hit chance bounds + specialty hit improves ─────────────────────
    h0 = melee_hit_chance_vs_monster(dex=50, gen=5, specialty_hit=0)
    h25 = melee_hit_chance_vs_monster(dex=50, gen=5, specialty_hit=10)
    if not (18 <= h0 <= 97 and 18 <= h25 <= 97):
        r.add("FAIL", "hit", f"Melee hit out of bounds h0={h0} h25={h25}")
    if h25 < h0:
        r.add("FAIL", "hit", f"Specialty hit bonus decreased chance {h0}→{h25}")
    else:
        r.add("INFO", "hit", f"Melee hit gen5 dex50: {h0}% → +10spec {h25}%")

    # ── 7) Drop chance * mult never exceeds 1.0 when clamped (server Min) ─
    # Server: Math.Min(1.0, chance * dropMult) — at high specialty multi-drop can saturate.
    # Gross error: dropMult <= 1 at L25 for ladders with drop_rate steps
    for mid in (40, 18, 33, 110):
        defn = specs.get(mid)
        if not defn:
            continue
        _, _, _, _, drop, _ = aggregate_bonuses(defn["bonuses"], 25)
        if drop <= 0:
            r.add("WARN", "specialty-drop", f"{defn.get('name')}({mid}): L25 drop_pct={drop} (no drop steps yet)")

    # ── 8) Cash shop free stat ticket ─────────────────────────────────────
    cash_path = config_dir / "CashShop.json"
    if cash_path.is_file():
        cash = load_json(cash_path)
        skus = cash.get("skus") or cash.get("Skus") or []
        found = False
        for s in skus:
            if s.get("skuId") == "ticket-stat-change" or s.get("itemId") == 1305:
                found = True
                ps = int(s.get("priceStableUsdCents") or 0)
                ph = int(s.get("priceHell") or 0)
                if ps != 0 or ph != 0:
                    r.add("FAIL", "cash", f"Stat Change Ticket not free: stable={ps} hell={ph}")
                else:
                    r.add("INFO", "cash", "Stat Change Ticket is free (0/0) — ok")
        if not found:
            r.add("FAIL", "cash", "ticket-stat-change SKU missing from CashShop.json")

    return r


def format_report(report: Report) -> str:
    lines = [
        "# Combat audit report (gross errors)",
        "",
        f"- FAILs: **{len(report.fails)}**",
        f"- Total findings: {len(report.findings)}",
        "",
        "## FAIL",
        "",
    ]
    fails = report.fails
    if not fails:
        lines.append("_None — catalog/specialty/magic/PA-MA basic invariants OK._")
    else:
        for f in fails:
            lines.append(f"- **[{f.area}]** {f.message}")
    lines += ["", "## WARN / INFO", ""]
    for f in report.findings:
        if f.severity == "FAIL":
            continue
        lines.append(f"- `{f.severity}` **[{f.area}]** {f.message}")
    lines.append("")
    lines.append("## How this maps to play")
    lines.append("")
    lines.append("| Theory (this script) | Practice (Playwright / human) |")
    lines.append("|----------------------|-------------------------------|")
    lines.append("| Specialty out/in/drop L0→L25 | Kill same mob L0 vs L25 char; compare float dmg + loot |")
    lines.append("| Magic EV scales with Mag | Cast EB Mag10 vs Mag200 dummy |")
    lines.append("| PA/MA reduce damage | Equip PA/MA gear; compare taken |")
    lines.append("| Debow/MS22 in tables | Live drop farm or GM loot inject |")
    lines.append("| Free stat ticket | Cash shop buy → consume → stats 10 |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--config-dir",
        type=Path,
        default=None,
        help="Path to multiplayer/server/Config",
    )
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    config_dir = args.config_dir or (root / "multiplayer" / "server" / "Config")
    if not config_dir.is_dir():
        print(f"Config dir missing: {config_dir}", file=sys.stderr)
        return 2

    report = run_audit(config_dir)
    text = format_report(report)
    out = args.out or (root / "docs" / "qa" / "combat-audit-latest.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(text)
    print(f"\nWrote {out}")
    return 1 if report.fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
