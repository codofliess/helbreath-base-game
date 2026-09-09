#!/usr/bin/env python3
"""Contract tests for Magias Circle grant + magic-shop learned= summary."""

from __future__ import annotations

import unittest
from pathlib import Path

import importlib.util

_GRANT_PATH = Path(__file__).resolve().parent / "grant-mago-magias.py"
_SPEC = importlib.util.spec_from_file_location("grant_mago_magias", _GRANT_PATH)
grant_mod = importlib.util.module_from_spec(_SPEC)
assert _SPEC is not None and _SPEC.loader is not None
_SPEC.loader.exec_module(grant_mod)
CIRCLE_ONE_OLYMPIA_IDS = grant_mod.CIRCLE_ONE_OLYMPIA_IDS
GOLD_ITEM_ID = grant_mod.GOLD_ITEM_ID
MAGIC_SKILL_INDEX = grant_mod.MAGIC_SKILL_INDEX
apply_magias_grant = grant_mod.apply_magias_grant


def format_city_services_summary(gold: int, learned: list[int]) -> str:
    ids = sorted({i for i in learned if i >= 0})
    csv = ",".join(str(i) for i in ids)
    return f"gold={max(0, gold)};learned={csv}"


def parse_magic_tower_summary(summary: str) -> tuple[int, list[int]]:
    gold = -1
    learned: list[int] = []
    for part in summary.split(";"):
        eq = part.find("=")
        if eq < 0:
            continue
        k, v = part[:eq].strip(), part[eq + 1 :].strip()
        if k == "gold" and v:
            gold = int(v)
        elif k == "learned" and v:
            for item in v.split(","):
                learned.append(int(item.strip()))
    return gold, learned


class MagiasBookSyncTests(unittest.TestCase):
    def test_summary_roundtrip_circle_one(self) -> None:
        raw = format_city_services_summary(1700, [2, 0, 1])
        self.assertEqual(raw, "gold=1700;learned=0,1,2")
        gold, learned = parse_magic_tower_summary(raw)
        self.assertEqual(gold, 1700)
        self.assertEqual(learned, CIRCLE_ONE_OLYMPIA_IDS)

    def test_grant_writes_circle_fields_not_skill_only(self) -> None:
        state = apply_magias_grant({"SkillLevels": [20] * 5, "BagItems": []})
        self.assertEqual(state["LearnedOlympiaSpellIds"], [0, 1, 2])
        self.assertEqual(state["SkillLevels"][MAGIC_SKILL_INDEX], 100)
        gold = [r for r in state["BagItems"] if r["ItemId"] == GOLD_ITEM_ID]
        self.assertEqual(gold[0]["Quantity"], 1700)
        self.assertEqual(state["Gold"], 0)

    def test_grant_doc_exists(self) -> None:
        root = Path(__file__).resolve().parents[1]
        text = (root / "docs" / "MAGIAS-CIRCLE-GRANT.md").read_text(encoding="utf-8")
        self.assertIn("LearnedOlympiaSpellIds", text)
        self.assertIn("item 90", text.lower())
        self.assertTrue(hasattr(grant_mod, "apply_magias_grant"))


if __name__ == "__main__":
    unittest.main()
