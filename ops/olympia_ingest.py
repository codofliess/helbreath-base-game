#!/usr/bin/env python3
"""
Standing Olympia reference ingest — no user permission required each run.

Pulls local dumps (Item.cfg, Magic.cfg, Npc.cfg, docs) into docs/qa/olympia-ingest/
so combat/loot/UI agents always have a fresh machine-readable index.

Optional: --wiki rare-items  (public helbreath.net wiki text only)

  python ops/olympia_ingest.py
  python ops/olympia_ingest.py --repo C:\\Users\\54116\\helbreath-base-game
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def parse_item_cfg(path: Path) -> list[dict]:
    rows = []
    if not path.is_file():
        return rows
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line.lower().startswith("item"):
            continue
        eq = line.find("=")
        if eq < 0:
            continue
        tokens = line[eq + 1 :].strip().split()
        if len(tokens) < 6:
            continue
        try:
            item_id = int(tokens[0])
        except ValueError:
            continue
        # Name may be multi-token until we hit a pure int effect type field — Olympia layout:
        # id Name... type equipPos effectType v1..v6 ...
        # Heuristic: find first token that is a small int for item type after name words.
        # Keep name as tokens[1] joined until token is digit-only and next fields look numeric.
        name_parts = []
        i = 1
        while i < len(tokens):
            t = tokens[i]
            if t.lstrip("-").isdigit() and i > 1:
                break
            # stop if we see known type keywords that are numeric positions later
            name_parts.append(t)
            i += 1
            if i > 8:  # safety
                break
        name = " ".join(name_parts).strip()
        rest = tokens[i:]
        def gi(idx, default=None):
            if idx < len(rest):
                try:
                    return int(rest[idx])
                except ValueError:
                    return default
            return default
        rows.append({
            "id": item_id,
            "name": name,
            "itemType": gi(0),
            "equipPos": gi(1),
            "effectType": gi(2),
            "v1": gi(3),
            "v2": gi(4),
            "v3": gi(5),
            "v4": gi(6),
            "v5": gi(7),
            "v6": gi(8),
            "source": path.name,
        })
    return rows


def parse_magic_cfg(path: Path) -> list[dict]:
    rows = []
    if not path.is_file():
        return rows
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line.lower().startswith("magic"):
            continue
        eq = line.find("=")
        if eq < 0:
            continue
        tokens = line[eq + 1 :].strip().split()
        if len(tokens) < 2:
            continue
        try:
            mid = int(tokens[0])
        except ValueError:
            continue
        # name until numeric fields
        name_parts = []
        for t in tokens[1:]:
            if t.lstrip("-").isdigit() and name_parts:
                break
            name_parts.append(t)
        rows.append({"id": mid, "name": " ".join(name_parts), "source": path.name})
    return rows


def parse_npc_cfg(path: Path) -> list[dict]:
    rows = []
    if not path.is_file():
        return rows
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line.lower().startswith("npc"):
            continue
        eq = line.find("=")
        if eq < 0:
            continue
        tokens = line[eq + 1 :].strip().split()
        if len(tokens) < 2:
            continue
        try:
            nid = int(tokens[0])
        except ValueError:
            continue
        name = tokens[1] if len(tokens) > 1 else ""
        rows.append({"id": nid, "name": name, "source": path.name})
    return rows


def index_docs(docs_dir: Path) -> list[dict]:
    out = []
    if not docs_dir.is_dir():
        return out
    for p in sorted(docs_dir.glob("OLYMPIA*.md")):
        text = p.read_text(encoding="utf-8", errors="replace")
        out.append({
            "file": p.name,
            "path": str(p.as_posix()),
            "bytes": len(text),
            "headings": re.findall(r"^#{1,3}\s+(.+)$", text, re.M)[:30],
        })
    return out


def fetch_wiki(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ChainLords-OlympiaIngest/1.0 (parity research; local game)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_html(html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", type=Path, default=None)
    ap.add_argument("--wiki", action="append", default=[], help="wiki keys: rare-items, main")
    args = ap.parse_args()

    repo = args.repo or Path(__file__).resolve().parents[1]
    ref = repo / "reference"
    docs = repo / "docs"
    out_dir = docs / "qa" / "olympia-ingest"
    out_dir.mkdir(parents=True, exist_ok=True)

    items = []
    for name in ("Item.cfg", "Item2.cfg", "Item3.cfg"):
        items.extend(parse_item_cfg(ref / name))
    magic = parse_magic_cfg(ref / "Magic.cfg")
    npcs = parse_npc_cfg(ref / "Npc.cfg")
    doc_index = index_docs(docs)

    # Weapon dice summary (effectType often 1 for weapons in cfg — keep all with equip weapon-ish)
    weapons = [i for i in items if i.get("effectType") in (1, 13) or "Wand" in (i.get("name") or "") or "Sword" in (i.get("name") or "")]

    # CL catalog cross-check if present
    cl_items_path = repo / "multiplayer" / "server" / "Config" / "Items.json"
    cl_missing_sprites = []
    if cl_items_path.is_file():
        cl_items = json.loads(cl_items_path.read_text(encoding="utf-8-sig"))
        cl_ids = {int(x["id"]) for x in cl_items if "id" in x}
        # flag olympia weapons missing from CL
        for w in weapons:
            if w["id"] not in cl_ids and w["id"] < 900:
                cl_missing_sprites.append({"id": w["id"], "name": w["name"]})

    wiki_blobs = {}
    wiki_map = {
        "rare-items": "https://helbreath.net/wiki/Rare_Items",
        "main": "https://helbreath.net/wiki/Main_Page",
    }
    for key in args.wiki:
        url = wiki_map.get(key)
        if not url:
            print(f"unknown wiki key {key}", file=sys.stderr)
            continue
        try:
            html = fetch_wiki(url)
            text = strip_html(html)[:80000]
            wiki_blobs[key] = {"url": url, "chars": len(text), "text": text}
            (out_dir / f"wiki-{key}.txt").write_text(text, encoding="utf-8")
            print(f"wiki {key}: {len(text)} chars → wiki-{key}.txt")
        except (urllib.error.URLError, TimeoutError, OSError) as ex:
            print(f"wiki {key} failed: {ex}", file=sys.stderr)
            wiki_blobs[key] = {"url": url, "error": str(ex)}

    index = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "repo": str(repo),
        "counts": {
            "itemCfgRows": len(items),
            "magicRows": len(magic),
            "npcRows": len(npcs),
            "olympiaDocs": len(doc_index),
            "weaponishRows": len(weapons),
            "clMissingLowIdWeaponish": len(cl_missing_sprites),
        },
        "docs": doc_index,
        "paths": {
            "itemCfg": [str((ref / n).as_posix()) for n in ("Item.cfg", "Item2.cfg", "Item3.cfg")],
            "magicCfg": str((ref / "Magic.cfg").as_posix()),
            "npcCfg": str((ref / "Npc.cfg").as_posix()),
            "clientCpp": str((ref / "Client.cpp").as_posix()),
            "serverCpp": str((ref / "Server.cpp").as_posix()),
            "dropDoc": "docs/OLYMPIA-DROPS-AND-MAGIC.md",
            "pvpFeelDoc": "docs/OLYMPIA-PVP-FEEL-GAP.md",
            "specialtyDoc": "docs/OLYMPIA-MOB-SPECIALTY-LADDER.md",
            "affixDoc": "docs/OLYMPIA-ITEM-MAGIC-AFFIXES.md",
            "generatedItemsTs": "multiplayer/mp-client/src/constants/OlympiaItems.generated.ts",
        },
        "standingOrders": "AGENTS.md — auto-ingest; no per-turn user permission for these sources",
        "wiki": {k: {kk: vv for kk, vv in v.items() if kk != "text"} for k, v in wiki_blobs.items()},
        "sampleWands": [i for i in items if "Wand" in (i.get("name") or "")][:40],
        "sampleMagic": magic[:40],
        "clMissingLowIdWeaponishSample": cl_missing_sprites[:40],
    }

    (out_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")
    (out_dir / "items-from-cfg.json").write_text(json.dumps(items, indent=2), encoding="utf-8")
    (out_dir / "magic-from-cfg.json").write_text(json.dumps(magic, indent=2), encoding="utf-8")
    (out_dir / "npc-from-cfg.json").write_text(json.dumps(npcs, indent=2), encoding="utf-8")

    md = [
        f"# Olympia ingest snapshot",
        f"",
        f"Generated: `{index['generatedAtUtc']}`",
        f"",
        f"## Counts",
        f"",
        f"| kind | n |",
        f"|------|--:|",
    ]
    for k, v in index["counts"].items():
        md.append(f"| {k} | {v} |")
    md += [
        "",
        "## Docs indexed",
        "",
    ]
    for d in doc_index:
        md.append(f"- `{d['file']}` — {len(d['headings'])} headings")
    md += [
        "",
        "## Agent rule",
        "",
        "See repo root `AGENTS.md`. Re-run this script before combat/loot parity work.",
        "",
        "```bash",
        "python ops/olympia_ingest.py --wiki rare-items",
        "```",
        "",
    ]
    (out_dir / "README.md").write_text("\n".join(md), encoding="utf-8")

    print(json.dumps(index["counts"], indent=2))
    print(f"Wrote {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
