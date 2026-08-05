#!/usr/bin/env python3
"""
Full theoretical combat MATRIX — 100% of catalog monsters.

Outbound (player → mob):
  - Blizzard loadouts (bare / MS20 / MS22+HR / ZW ± Hero Mage) × specialty L0/L50
  - War physical (bare / GiantSword / Hero+NOX+rings+Abaddon+upg) × L0/L50

Inbound (mob → player):
  - Monster attack mid HP dice (attackDamageMin/Max) vs PA sets + Merien proxy
  - Specialty L0 vs L50 damage reduction

Coherence FAILs (gross):
  - specialty L50 worse than L0 (out/in/drop)
  - ZW not beating bare magic
  - Abaddon not stacking
  - higher genLevel / higher atk not generally more threatening
  - extreme outliers (taken/out ratios)

  python ops/combat_matrix_audit.py
  python ops/combat_matrix_audit.py --out docs/qa/combat-matrix-latest.md
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from combat_audit import (  # noqa: E402
    aggregate_bonuses,
    apply_incoming,
    apply_outgoing,
    apply_pa,
    drop_mult,
    expected_magic_damage,
    load_json,
    magic_hit_chance_vs_monster,
    melee_hit_chance_vs_monster,
)


def parse_item_cfg_weapons(ref_dir: Path) -> dict[int, tuple[int, int, int]]:
    out: dict[int, tuple[int, int, int]] = {}
    for name in ("Item.cfg", "Item2.cfg", "Item3.cfg"):
        p = ref_dir / name
        if not p.is_file():
            continue
        for raw in p.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw.strip()
            if not line.lower().startswith("item"):
                continue
            eq = line.find("=")
            if eq < 0:
                continue
            tokens = line[eq + 1 :].strip().split()
            if len(tokens) < 11:
                continue
            try:
                iid = int(tokens[0])
            except ValueError:
                continue
            i = 1
            while i < len(tokens) and not (tokens[i].lstrip("-").isdigit() and i > 1):
                i += 1
            rest = tokens[i:]
            if len(rest) < 8:
                continue
            try:
                effect = int(rest[2])
                sm_t, sm_r, sm_b = int(rest[3]), int(rest[4]), int(rest[5])
            except ValueError:
                continue
            if effect in (1, 13):
                out[iid] = (sm_t, sm_r, sm_b)
    return out


def expected_weapon_sm(throw: int, rng: int, bonus: int) -> float:
    if throw <= 0 or rng <= 0:
        return max(1.0, float(bonus))
    return throw * (rng + 1) / 2.0 + bonus


def melee_ev(str_eff: int, dice_ev: float, upgrade: int = 0, flat_phys: int = 0,
             weapon_magic: int = 0, hero_ap: int = 0) -> float:
    d = dice_ev
    d = d + d * (str_eff / 5.0) / 100.0
    d = d + upgrade + flat_phys + weapon_magic + hero_ap
    return max(1.0, d)


def magic_ev(mag: int, count: int, sides: int, bonus: int, mult: float = 1.0,
             add_mag: int = 0, hero_mage: int = 0, berserk_wand: bool = False) -> float:
    d = expected_magic_damage(mag, count, sides, bonus, mult)
    d += add_mag + hero_mage
    if berserk_wand:
        d = d * 1.25
    return max(1.0, d)


def specialty_bundle(specs: dict, mid: int, level: int):
    defn = specs.get(mid) or {
        "base": 125,
        "bonuses": ["damage", "damage_reduction", "drop_rate"] + ["drop_rate"] * 20,
        "name": str(mid),
    }
    flat, fred, dpct, rpct, drop, hit = aggregate_bonuses(defn["bonuses"], level)
    return defn, flat, fred, dpct, rpct, drop, hit


def load_specs(config_dir: Path) -> dict:
    raw = load_json(config_dir / "MobSpecialties.json")
    specs = {}
    for row in raw:
        if "id" not in row:
            continue
        specs[int(row["id"])] = {
            "base": int(row.get("base_kills") or 125),
            "bonuses": list(row.get("bonuses") or ["damage", "damage_reduction", "drop_rate"]),
            "name": row.get("name") or "",
        }
    return specs


def monster_atk_mid(m: dict) -> float:
    lo = int(m.get("attackDamageMin") or 0)
    hi = int(m.get("attackDamageMax") or lo)
    if hi < lo:
        hi = lo
    if lo <= 0 and hi <= 0:
        # fallback mock by genLevel
        gen = int(m.get("genLevel") or 1)
        return max(5.0, gen * 4.0)
    return (lo + hi) / 2.0


def run_matrix(repo: Path) -> tuple[str, list[str], list[dict]]:
    config_dir = repo / "multiplayer" / "server" / "Config"
    if not (config_dir / "Monsters.json").is_file():
        # VPS layout: Config may live outside repo
        alt = Path("/opt/chainlords/server/Config")
        if alt.is_file() or (alt / "Monsters.json").is_file():
            config_dir = alt
    ref_dir = repo / "reference"
    spells = load_json(config_dir / "Spells.json")
    monsters_list = load_json(config_dir / "Monsters.json")
    monsters = {int(m["id"]): m for m in monsters_list if "id" in m}
    specs = load_specs(config_dir)
    weapons = parse_item_cfg_weapons(ref_dir)

    blizz = next((s for s in spells if s.get("name") == "Blizzard"), None) or {}
    if not blizz:
        blizz = next((s for s in spells if "blizzard" in str(s.get("name", "")).lower()), {})
    bc = int(blizz.get("damageDiceCount") or 7)
    bs = int(blizz.get("damageDiceSides") or 8)
    bb = int(blizz.get("damageDiceBonus") or 16)
    bm = float(blizz.get("damageMultiplier") or 1.0)

    mag = 150
    str_ = 120
    dex = 80

    giant = weapons.get(615, (2, 11, 3))
    ls = weapons.get(19, (1, 9, 2))

    # Defense PA ladders (Merien +N ≈ +N PA% illustrative)
    def_loadouts = [
        ("naked_PA0", 0),
        ("light_PA20", 20),
        ("heavy_PA40", 40),
        ("heavy_Merien5_PA45", 45),
        ("heavy_Merien10_PA50", 50),
        ("stack_PA70", 70),
        ("cap_PA80", 80),
    ]

    # Mage outbound EV base (no specialty) for each loadout
    mage_defs = [
        ("bare", magic_ev(mag, bc, bs, bb, bm, hero_mage=0, berserk_wand=False), 0),
        ("MS20", magic_ev(mag, bc, bs, bb, bm, hero_mage=0, berserk_wand=False), 0),
        ("MS22_HR50", magic_ev(mag, bc, bs, bb, bm, hero_mage=0, berserk_wand=False), 50),
        ("MS22_HR91", magic_ev(mag, bc, bs, bb, bm, hero_mage=0, berserk_wand=False), 91),
        ("ZW20", magic_ev(mag, bc, bs, bb, bm, hero_mage=0, berserk_wand=True), 0),
        ("ZW20_HeroMage", magic_ev(mag, bc, bs, bb, bm, hero_mage=4, berserk_wand=True), 0),
        ("bare_HeroMage", magic_ev(mag, bc, bs, bb, bm, hero_mage=4, berserk_wand=False), 0),
    ]

    war_defs = [
        ("bare_hand", None, 0, 0, 0, 0),
        ("LongSword+2", ls, 0, 0, 0, 0),
        ("GiantSword", giant, 0, 0, 0, 0),
        ("GS_Hero", giant, 1, 0, 0, 0),
        ("GS_Hero_NOX", giant, 1, 100, 0, 0),
        ("GS_Hero_NOX_Xelima7", giant, 1, 100, 7, 0),
        ("GS_Hero_NOX_Abaddon17", giant, 1, 100, 17, 0),
        ("GS_full_upg10", giant, 1, 100, 17, 10),
    ]

    rows: list[dict] = []
    fails: list[str] = []

    for mid, m in sorted(monsters.items()):
        name = str(m.get("name") or mid)
        gen = int(m.get("genLevel") or 0)
        mhr = int(m.get("magicHitRatio") or 0)
        atk = monster_atk_mid(m)
        hp = int(m.get("hp") or 0)

        for spec_lv in (0, 50):
            defn, flat, fred, dpct, rpct, drop, hit = specialty_bundle(specs, mid, spec_lv)
            hit_b = int(round(hit))

            for label, raw_ev, hr in mage_defs:
                after = apply_outgoing(int(round(raw_ev)), flat, dpct)
                hit_ch = magic_hit_chance_vs_monster(mag, gen or 5, mhr, specialty_hit=hit_b + hr // 10)
                rows.append({
                    "mid": mid, "name": name, "gen": gen, "hp": hp, "atk_mid": round(atk, 1),
                    "axis": "out_magic", "loadout": label, "spec": spec_lv,
                    "hit_pct": hit_ch, "raw": round(raw_ev, 1), "after": after,
                    "drop_mult": round(drop_mult(drop), 3),
                    "taken": "",
                })

            for label, wdice, hero_w, nox_hr, ring_phys, upg in war_defs:
                if wdice is None:
                    sides = max(2, str_ // 6)
                    dice_ev = (sides + 1) / 2.0
                else:
                    dice_ev = expected_weapon_sm(*wdice)
                hero_ap = 5 if hero_w else 0
                raw = melee_ev(str_, dice_ev, upgrade=upg, flat_phys=ring_phys, hero_ap=hero_ap)
                after = apply_outgoing(int(round(raw)), flat, dpct)
                hit_ch = melee_hit_chance_vs_monster(
                    dex, gen or 5, specialty_hit=hit_b + (10 if hero_w else 0) + nox_hr // 10
                )
                rows.append({
                    "mid": mid, "name": name, "gen": gen, "hp": hp, "atk_mid": round(atk, 1),
                    "axis": "out_phys", "loadout": label, "spec": spec_lv,
                    "hit_pct": hit_ch, "raw": round(raw, 1), "after": after,
                    "drop_mult": round(drop_mult(drop), 3),
                    "taken": "",
                })

            for dlabel, pa in def_loadouts:
                base_hit = int(round(atk))
                after_spec = apply_incoming(base_hit, fred, rpct)
                after_pa = apply_pa(after_spec, pa)
                rows.append({
                    "mid": mid, "name": name, "gen": gen, "hp": hp, "atk_mid": round(atk, 1),
                    "axis": "in_phys", "loadout": dlabel, "spec": spec_lv,
                    "hit_pct": "", "raw": base_hit, "after": "",
                    "drop_mult": round(drop_mult(drop), 3),
                    "taken": after_pa,
                })

    # ── Coherence FAILs ──────────────────────────────────────────────────
    # Specialty monotonic per mob
    for mid in monsters:
        for axis, loadout in (("out_magic", "ZW20"), ("out_phys", "GiantSword"), ("in_phys", "naked_PA0")):
            a0 = next((r for r in rows if r["mid"] == mid and r["axis"] == axis and r["loadout"] == loadout and r["spec"] == 0), None)
            a50 = next((r for r in rows if r["mid"] == mid and r["axis"] == axis and r["loadout"] == loadout and r["spec"] == 50), None)
            if not a0 or not a50:
                continue
            if axis.startswith("out"):
                if int(a50["after"]) < int(a0["after"]):
                    fails.append(f"out L50 < L0 mid={mid} {loadout}: {a50['after']}<{a0['after']}")
                if float(a50["drop_mult"]) < float(a0["drop_mult"]) - 1e-6:
                    fails.append(f"drop L50 < L0 mid={mid}")
            else:
                if int(a50["taken"]) > int(a0["taken"]):
                    fails.append(f"in L50 taken > L0 mid={mid}: {a50['taken']}>{a0['taken']}")

    bare_m = magic_ev(mag, bc, bs, bb, bm, berserk_wand=False)
    zw_m = magic_ev(mag, bc, bs, bb, bm, berserk_wand=True)
    if zw_m <= bare_m:
        fails.append(f"ZW EV {zw_m:.1f} <= bare {bare_m:.1f}")
    hero_m = magic_ev(mag, bc, bs, bb, bm, hero_mage=4)
    if hero_m < bare_m + 3.5:
        fails.append(f"Hero mage +4 missing bare={bare_m:.1f} hero={hero_m:.1f}")

    base_w = melee_ev(str_, expected_weapon_sm(*giant), flat_phys=0)
    ab_w = melee_ev(str_, expected_weapon_sm(*giant), flat_phys=10)
    if ab_w < base_w + 9.5:
        fails.append("Abaddon +10 not stacking on war EV")

    # Threat ladder: among farmable genLevel>0, higher gen should on average hit harder naked
    farm = [(mid, m) for mid, m in monsters.items() if m.get("genLevel") is not None]
    if len(farm) >= 8:
        # Spearman-ish: compare rank of gen vs rank of naked taken L0
        pairs = []
        for mid, m in farm:
            gen = int(m.get("genLevel") or 0)
            r0 = next((r for r in rows if r["mid"] == mid and r["axis"] == "in_phys" and r["loadout"] == "naked_PA0" and r["spec"] == 0), None)
            if r0:
                pairs.append((gen, int(r0["taken"])))
        pairs.sort(key=lambda x: x[0])
        # count inversions where gen increases but taken decreases a lot
        inversions = 0
        for i in range(len(pairs) - 1):
            if pairs[i + 1][0] > pairs[i][0] and pairs[i + 1][1] + 15 < pairs[i][1]:
                inversions += 1
        if inversions > max(3, len(pairs) // 4):
            fails.append(f"threat ladder chaotic: {inversions} big gen↑/taken↓ inversions among farmables")

    # PA must reduce taken on a mid-tier farmable
    sample_mid = next((mid for mid, m in farm if int(m.get("genLevel") or 0) >= 5), farm[0][0] if farm else None)
    if sample_mid is not None:
        t0 = next(r for r in rows if r["mid"] == sample_mid and r["axis"] == "in_phys" and r["loadout"] == "naked_PA0" and r["spec"] == 0)
        t80 = next(r for r in rows if r["mid"] == sample_mid and r["axis"] == "in_phys" and r["loadout"] == "cap_PA80" and r["spec"] == 0)
        if int(t80["taken"]) >= int(t0["taken"]):
            fails.append(f"PA80 does not reduce taken on mid={sample_mid}")

    # ── Report markdown ──────────────────────────────────────────────────
    n_mobs = len(monsters)
    n_rows = len(rows)
    lines = [
        "# Combat matrix FULL (theory EV) — 100% monsters",
        "",
        f"Philosophy: **Olympia feel first** + thin Nemesis/CL — `docs/qa/OLYMPIA-NEMESIS-MERGE.md`.",
        "",
        f"- Monsters: **{n_mobs}**",
        f"- Matrix rows: **{n_rows}** (magic×7 + phys×8 + defense×7) × (L0+L50)",
        f"- Blizzard dice: {bc}d{bs}+{bb} mult={bm}",
        f"- Caster mock: Mag={mag} Str={str_} Dex={dex}",
        f"- FAILs: **{len(fails)}**",
        "",
        "---",
        "",
        "## Stack reference (independent of mob)",
        "",
        f"| Mage loadout | EV raw |",
        f"|--------------|-------:|",
    ]
    for label, raw_ev, hr in mage_defs:
        lines.append(f"| {label} (HR+{hr}) | {raw_ev:.1f} |")
    lines += ["", "| War loadout | EV raw |", "|-------------|-------:|"]
    for label, wdice, hero_w, nox_hr, ring_phys, upg in war_defs:
        if wdice is None:
            sides = max(2, str_ // 6)
            dice_ev = (sides + 1) / 2.0
        else:
            dice_ev = expected_weapon_sm(*wdice)
        raw = melee_ev(str_, dice_ev, upgrade=upg, flat_phys=ring_phys, hero_ap=5 if hero_w else 0)
        lines.append(f"| {label} | {raw:.1f} |")

    lines += [
        "",
        "Jewelry: NOX=HR100, Ring Xelima=+7 phys, Abaddon=+10 phys. Gold Carp is fishing consumable (not AP).",
        "Merien +N on defense = **PA% proxy** (illustrative; live Merien is upgrade/durability path).",
        "",
        "---",
        "",
        "## Per-monster snapshot (key columns)",
        "",
        "Columns: bare Blizz L0/L50 after | ZW+Hero L50 | GS full jewelry L50 | naked taken L0 | PA50 Merien10 L0 | PA80 L0 | drop× L50",
        "",
        "| ID | Name | Gen | HP | AtkMid | BlizzL0 | BlizzL50 | ZWHeroL50 | GSFullL50 | NakedInL0 | Merien10InL0 | PA80InL0 | Drop×L50 |",
        "|---:|------|----:|---:|-------:|--------:|---------:|----------:|----------:|----------:|-------------:|---------:|---------:|",
    ]

    for mid, m in sorted(monsters.items()):
        name = str(m.get("name") or mid)
        gen = int(m.get("genLevel") or 0) if m.get("genLevel") is not None else -1
        hp = int(m.get("hp") or 0)
        atk = monster_atk_mid(m)

        def pick(axis, loadout, spec, field):
            r = next((x for x in rows if x["mid"] == mid and x["axis"] == axis and x["loadout"] == loadout and x["spec"] == spec), None)
            if not r:
                return "—"
            v = r.get(field)
            return v if v != "" else "—"

        lines.append(
            f"| {mid} | {name} | {gen if gen >= 0 else '—'} | {hp} | {atk:.0f} | "
            f"{pick('out_magic','bare',0,'after')} | {pick('out_magic','bare',50,'after')} | "
            f"{pick('out_magic','ZW20_HeroMage',50,'after')} | {pick('out_phys','GS_full_upg10',50,'after')} | "
            f"{pick('in_phys','naked_PA0',0,'taken')} | {pick('in_phys','heavy_Merien10_PA50',0,'taken')} | "
            f"{pick('in_phys','cap_PA80',0,'taken')} | {pick('out_magic','bare',50,'drop_mult')} |"
        )

    lines += [
        "",
        "---",
        "",
        "## Coherence FAIL checks",
        "",
    ]
    if fails:
        for f in fails:
            lines.append(f"- **FAIL**: {f}")
    else:
        lines.append("_No matrix FAILs — specialty monotonic, ZW/Hero/rings, PA, threat ladder OK._")

    lines += [
        "",
        "---",
        "",
        "## How to read",
        "",
        "- **Outbound after specialty**: higher = better for player (L50 should ≥ L0).",
        "- **Inbound taken**: lower = better for player (armor/PA/Merien/specialty).",
        "- Full row dump: sibling CSV `combat-matrix-full.csv` next to this report.",
        "- Live Playwright: deferred — `docs/qa/PLAYWRIGHT-DEFERRED.md`.",
        "",
    ]
    return "\n".join(lines), fails, rows


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--csv", type=Path, default=None)
    args = ap.parse_args()
    repo = args.repo or Path(__file__).resolve().parents[1]
    text, fails, rows = run_matrix(repo)
    out = args.out or (repo / "docs" / "qa" / "combat-matrix-latest.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    csv_path = args.csv or (out.parent / "combat-matrix-full.csv")
    if rows:
        with csv_path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(text)
    print(f"\nWrote {out} rows={len(rows)} fails={len(fails)} csv={csv_path}")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
