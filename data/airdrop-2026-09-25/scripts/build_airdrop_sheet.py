#!/usr/bin/env python3
"""Build the ChainLords HELL airdrop research sheet (data only; no sends).

Re-run with another total:
  python3 build_airdrop_sheet.py --total 120000000
  python3 build_airdrop_sheet.py --total 50000000 --seed hell-airdrop-2026-09-25
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill
    from openpyxl.utils import get_column_letter
except ImportError as exc:  # pragma: no cover
    raise SystemExit("openpyxl is required: pip install openpyxl") from exc

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "sources"
DEFAULT_TOTAL = 120_000_000
DEFAULT_SEED = "hell-airdrop-2026-09-25"
TARGET_ROWS = 1500
QUOTAS = {"pumpfun": 500, "fomo": 300, "stonkfun": 100, "moby": 100}
TEAM_PREFIXES = ("4R7F",)  # Elon test char; exclude if present
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

# Well-known Solana programs / sysvars / common infra (not end-user wallets).
DENY_EXACT = {
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbuo7Wxtgok8Z2hAY67JEpW6vCDcGmvW1",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "ComputeBudget111111111111111111111111111111",
    "Vote111111111111111111111111111111111111111",
    "Stake11111111111111111111111111111111111111",
    "Config1111111111111111111111111111111111111",
    "SysvarRent111111111111111111111111111111111",
    "SysvarC1ock11111111111111111111111111111111",
    "SysvarRecentB1ockHashes11111111111111111111",
    "SysvarS1otHashes111111111111111111111111111",
    "SysvarS1otHistory11111111111111111111111111",
    "SysvarEpochSchedu1e111111111111111111111111",
    "SysvarFees111111111111111111111111111111111",
    "SysvarInstructions1111111111111111111111111",
    "SysvarStakeHistory1111111111111111111111111",
    "BPFLoaderUpgradeab1e11111111111111111111111",
    "BPFLoader2111111111111111111111111111111111",
    "NativeLoader1111111111111111111111111111111",
    "KeccakSecp256k11111111111111111111111111111",
    "Ed25519SigVerify111111111111111111111111111",
    "AddressLookupTab1eAccount111111111111111111",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",  # Pump.fun program
    "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",  # PumpSwap
    "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",  # Raydium LaunchLab
    "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "ComputeBudget111111111111111111111111111111",
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",  # Binance (dropped in ronda2)
    "Cfq1ts1iFr1eUWWBm8eFxUzm5R3YA3UvMZznwiShbgZt",
    "8UhbNoBXmGoxJr2TeWW8wmSMoWmjS2rTT2tVJxzuTogC",
}


def b58decode(s: str) -> bytes:
    n = 0
    for ch in s:
        n = n * 58 + B58.index(ch)
    # reconstruct bytes with leading zeros
    pad = 0
    for ch in s:
        if ch == "1":
            pad += 1
        else:
            break
    h = n.to_bytes((n.bit_length() + 7) // 8 or 1, "big")
    return b"\x00" * pad + h


def is_valid_pubkey(addr: str) -> bool:
    if not addr or not isinstance(addr, str):
        return False
    addr = addr.strip()
    if not (32 <= len(addr) <= 44):
        return False
    if any(c not in B58 for c in addr):
        return False
    try:
        raw = b58decode(addr)
    except Exception:
        return False
    return len(raw) == 32


def is_excluded_infra(addr: str) -> bool:
    if addr in DENY_EXACT:
        return True
    if any(addr.startswith(p) for p in TEAM_PREFIXES):
        return True
    return False


def load_json(path: Path):
    return json.loads(path.read_text())


def load_existing_wallets() -> tuple[set[str], list[dict], dict]:
    """All wallets from prior list files, plus parsed send.ready rows."""
    known: set[str] = set()
    send_rows: list[dict] = []
    with (SOURCES / "ronda2.send.ready.csv").open(newline="") as f:
        for row in csv.DictReader(f):
            w = (row.get("wallet") or "").strip()
            if w:
                known.add(w)
            send_rows.append(row)
    with (SOURCES / "airdrop-v1.wallets.csv").open(newline="") as f:
        for row in csv.DictReader(f):
            w = (row.get("wallet") or "").strip()
            if w:
                known.add(w)
    with (SOURCES / "ronda2.onchain.wallets.csv").open(newline="") as f:
        for row in csv.DictReader(f):
            w = (row.get("wallet") or "").strip()
            if w:
                known.add(w)
    summary = load_json(SOURCES / "ronda2.send.summary.json")
    return known, send_rows, summary


def collect_pumpfun(sol_usd: float, known_existing: set[str]) -> tuple[list[dict], dict]:
    """Positive realized-PnL wallets attributed to Pump.fun / Pump app.

    Ranking: highest realized USD first. Cross-source duplicates keep the
    source where the wallet ranks higher (better realized, then better source
    priority). Existing-list wallets are skipped (TASK 1 dedupe).
    """
    stats = {
        "raw_by_source": {},
        "positive_realized_by_source": {},
        "dropped_existing": 0,
        "dropped_invalid": 0,
        "dropped_infra": 0,
        "dropped_nonpositive": 0,
        "cross_source_dupes_kept_higher": 0,
    }
    # wallet -> candidate
    best: dict[str, dict] = {}
    source_priority = {
        "pumpfun_pnl_leaderboard": 0,
        "pumpfun_mayhem": 1,
        "kolscan_pump_app": 2,
        "gmgn_launchpad_smart": 3,
    }

    def consider(row: dict) -> None:
        w = row["wallet"]
        if not is_valid_pubkey(w):
            stats["dropped_invalid"] += 1
            return
        if is_excluded_infra(w):
            stats["dropped_infra"] += 1
            return
        if w in known_existing:
            stats["dropped_existing"] += 1
            return
        pnl = row["pnl_usd"]
        if pnl is None or pnl <= 0:
            stats["dropped_nonpositive"] += 1
            return
        prev = best.get(w)
        if prev is None:
            best[w] = row
            return
        # keep in platform/source where it ranks highest (realized, then source)
        prev_key = (prev["pnl_usd"], -source_priority[prev["source_tag"]])
        new_key = (pnl, -source_priority[row["source_tag"]])
        stats["cross_source_dupes_kept_higher"] += 1
        if new_key > prev_key:
            best[w] = row

    # Official pump.fun app PnL board (live). Ranked on-site by net PnL;
    # we re-rank by realizedPnlUsd and only keep realized > 0.
    for period in ("monthly", "weekly", "daily"):
        payload = load_json(SOURCES / f"pumpfun-pnl-leaderboard-{period}.json")
        entries = payload.get("entries") or []
        stats["raw_by_source"][f"pnl_{period}"] = len(entries)
        pos = 0
        for e in entries:
            realized = float(e.get("realizedPnlUsd") or 0)
            if realized > 0:
                pos += 1
            consider(
                {
                    "wallet": e["walletAddress"],
                    "pnl_usd": realized,
                    "rank_on_source": int(e["rank"]),
                    "source_platform": "pumpfun",
                    "source_tag": "pumpfun_pnl_leaderboard",
                    "source_url": (
                        f"https://frontend-api-v3.pump.fun/pnl-leaderboard?period={period}"
                    ),
                    "note": (
                        f"pump.fun public PnL leaderboard {payload.get('periodLabel')} "
                        f"(on-site rank {e['rank']} is by net pnlUsd="
                        f"{e.get('pnlUsd')}; stored value is realizedPnlUsd). "
                        f"username={e.get('username') or ''}"
                    ),
                }
            )
        stats["positive_realized_by_source"][f"pnl_{period}"] = pos

    for window in ("7d", "24h"):
        payload = load_json(SOURCES / f"pumpfun-mayhem-top-traders-{window}.json")
        items = payload.get("items") or []
        stats["raw_by_source"][f"mayhem_{window}"] = len(items)
        pos = 0
        for e in items:
            realized = float(e.get("realisedPnlUsd") or 0)
            if realized > 0:
                pos += 1
            consider(
                {
                    "wallet": e["address"],
                    "pnl_usd": realized,
                    "rank_on_source": int(e["rank"]),
                    "source_platform": "pumpfun",
                    "source_tag": "pumpfun_mayhem",
                    "source_url": (
                        "https://frontend-api-v3.pump.fun/mayhem/top-traders"
                        f"?window={window}"
                    ),
                    "note": (
                        f"pump.fun Mayhem top traders {window} by realisedPnlUsd; "
                        f"winRate={e.get('winRate')} volumeUsd={e.get('volumeUsd')}"
                    ),
                }
            )
        stats["positive_realized_by_source"][f"mayhem_{window}"] = pos

    kol = load_json(SOURCES / "kolscan-leaderboard.nirholas-kol-quest.json")
    stats["raw_by_source"]["kolscan_rows"] = len(kol)
    by_wallet: dict[str, list] = {}
    for row in kol:
        by_wallet.setdefault(row["wallet_address"], []).append(row)
    pos = 0
    for w, rows in by_wallet.items():
        # Prefer 30d profit; else best positive across windows.
        r30 = [r for r in rows if r.get("timeframe") == 30]
        pick = None
        if r30 and r30[0]["profit"] > 0:
            pick = r30[0]
        else:
            pos_rows = [r for r in rows if r["profit"] > 0]
            if pos_rows:
                pick = max(pos_rows, key=lambda r: (r["profit"], r["timeframe"]))
        if not pick:
            continue
        pos += 1
        pnl_usd = float(pick["profit"]) * sol_usd
        consider(
            {
                "wallet": w,
                "pnl_usd": pnl_usd,
                "rank_on_source": None,
                "source_platform": "pumpfun",
                "source_tag": "kolscan_pump_app",
                "source_url": (
                    "https://github.com/nirholas/kol-quest/blob/main/site/data/"
                    "kolscan-leaderboard.json"
                ),
                "note": (
                    f"Kolscan Pump-app KOL snapshot (committed 2026-04-09); "
                    f"timeframe={pick['timeframe']}d profit_sol={pick['profit']} "
                    f"converted at sol_usd={sol_usd:.6f}; name={pick.get('name')}"
                ),
            }
        )
    stats["positive_realized_by_source"]["kolscan_unique_positive"] = pos

    gmgn = load_json(SOURCES / "gmgn-launchpad-smart.nirholas-kol-quest.json")
    wallets = gmgn.get("wallets") or []
    stats["raw_by_source"]["gmgn_launchpad_smart"] = len(wallets)
    pos = 0
    for e in wallets:
        realized = float(e.get("realized_profit_30d") or 0)
        if realized > 0:
            pos += 1
        consider(
            {
                "wallet": e.get("wallet_address") or e.get("address"),
                "pnl_usd": realized,
                "rank_on_source": None,
                "source_platform": "pumpfun",
                "source_tag": "gmgn_launchpad_smart",
                "source_url": (
                    "https://github.com/nirholas/kol-quest/blob/main/site/data/"
                    "solwallets.json"
                ),
                "note": (
                    "GMGN Solana launchpad_smart snapshot captured 2026-03-09 "
                    f"(kol-quest interceptor); realized_profit_30d USD; "
                    f"txs_30d={e.get('txs_30d')}"
                ),
            }
        )
    stats["positive_realized_by_source"]["gmgn_launchpad_positive"] = pos

    ranked = sorted(best.values(), key=lambda r: r["pnl_usd"], reverse=True)
    for i, row in enumerate(ranked, start=1):
        row["rank"] = i
    stats["unique_positive_after_dedupe"] = len(ranked)
    return ranked, stats


def take_quota(ranked: list[dict], n: int) -> list[dict]:
    return ranked[:n]


def assemble_existing(
    send_rows: list[dict], taken: set[str], need_holders: int
) -> tuple[list[dict], dict]:
    stats = {
        "players_with_wallet": 0,
        "nft_gamer": 0,
        "pump_person": 0,
        "skipped_need_wallet": 0,
        "skipped_team": 0,
        "skipped_invalid": 0,
        "skipped_already_taken": 0,
        "skipped_not_in": 0,
    }
    out: list[dict] = []

    def add(row: dict, source_platform: str, metric, rank, note: str, url: str) -> bool:
        w = (row.get("wallet") or "").strip()
        if not w:
            stats["skipped_need_wallet"] += 1
            return False
        if not is_valid_pubkey(w):
            stats["skipped_invalid"] += 1
            return False
        if is_excluded_infra(w):
            stats["skipped_team"] += 1
            return False
        if w in taken:
            stats["skipped_already_taken"] += 1
            return False
        taken.add(w)
        pump_ui = row.get("pump_ui") or ""
        try:
            pump_val = float(pump_ui) if pump_ui != "" else None
        except ValueError:
            pump_val = None
        out.append(
            {
                "bucket": row["bucket"],
                "source_platform": source_platform,
                "rank": rank,
                "wallet": w,
                "pnl_usd_or_pump_ui": pump_val if row["bucket"] == "pump_person" else None,
                "amount_hell": None,
                "source_url": url,
                "note": note,
            }
        )
        return True

    players = [
        r
        for r in send_rows
        if r["bucket"] == "player_ronda1" and (r.get("status") or "") == "in"
    ]
    players.sort(key=lambda r: float(r.get("amount_hell") or 0), reverse=True)
    for i, r in enumerate(players, start=1):
        if add(
            r,
            "chainlords_player_ronda1",
            None,
            i,
            f"player_ronda1 name={r.get('name')}; {r.get('note')}",
            "sources/ronda2.send.ready.csv",
        ):
            stats["players_with_wallet"] += 1

    nfts = [r for r in send_rows if r["bucket"] == "nft_gamer" and (r.get("status") or "") == "in"]
    nfts.sort(key=lambda r: int(r.get("nft_listings") or 0), reverse=True)
    for i, r in enumerate(nfts, start=1):
        if add(
            r,
            "chainlords_nft_gamer",
            None,
            i,
            f"nft_gamer listings={r.get('nft_listings')}; {r.get('note')}",
            "sources/ronda2.send.ready.csv",
        ):
            stats["nft_gamer"] += 1

    holders = [
        r
        for r in send_rows
        if r["bucket"] == "pump_person" and (r.get("status") or "") == "in"
    ]
    holders.sort(key=lambda r: float(r.get("pump_ui") or 0), reverse=True)
    rank = 0
    for r in holders:
        if stats["pump_person"] >= need_holders:
            break
        if (r.get("status") or "") != "in":
            stats["skipped_not_in"] += 1
            continue
        rank += 1
        if add(
            r,
            "chainlords_pump_holder",
            r.get("pump_ui"),
            rank,
            f"PUMP holder pump_ui={r.get('pump_ui')}; {r.get('note')}",
            "sources/ronda2.send.ready.csv",
        ):
            stats["pump_person"] += 1
        else:
            # rank should only count accepted holders
            rank -= 1
    return out, stats


def allocate_amounts(wallets: list[str], total: int, seed: str) -> list[int]:
    """Unique non-round-looking ints within ~±10% of base, exact sum=total."""
    n = len(wallets)
    if n == 0:
        return []
    base = total / n
    lo = int(math.floor(base * 0.9))
    hi = int(math.ceil(base * 1.1))
    if hi - lo + 1 < n:
        raise SystemExit(f"range [{lo},{hi}] too small for {n} unique amounts")

    used: set[int] = set()
    amounts: list[int] = []
    for i, w in enumerate(wallets):
        digest = hashlib.sha256(f"{seed}|{w}|{i}".encode()).digest()
        span = hi - lo + 1
        x = lo + (int.from_bytes(digest[:8], "big") % span)
        # Odd-ish jitter so values are not round thousands when possible.
        if x % 1000 == 0:
            x = lo + ((x - lo + 17) % span)
        step = 1 + (int.from_bytes(digest[8:12], "big") % (span - 1))
        guard = 0
        while x in used or x % 1000 == 0:
            x = lo + ((x - lo + step) % span)
            guard += 1
            if guard > span + 5:
                break
        while x in used:
            x = lo + ((x - lo + 1) % span)
        used.add(x)
        amounts.append(x)

    diff = total - sum(amounts)
    # Walk a deterministic order, bumping unused in-range ints.
    order = sorted(
        range(n),
        key=lambda i: hashlib.sha256(f"{seed}|adj|{wallets[i]}".encode()).digest(),
    )
    idx = 0
    guard = 0
    while diff != 0 and guard < n * 50:
        i = order[idx % n]
        step = 1 if diff > 0 else -1
        cand = amounts[i] + step
        if lo <= cand <= hi and cand not in used and cand % 1000 != 0:
            used.remove(amounts[i])
            amounts[i] = cand
            used.add(cand)
            diff -= step
        idx += 1
        guard += 1
    if diff != 0:
        raise SystemExit(f"could not reconcile amount sum, remaining diff={diff}")
    if len(set(amounts)) != n:
        raise SystemExit("amount uniqueness broken")
    return amounts


def write_xlsx(path: Path, rows: list[dict], summary: list[dict], meta: dict) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "airdrop_1500"
    headers = [
        "bucket",
        "source_platform",
        "rank",
        "wallet",
        "pnl_usd_or_pump_ui",
        "amount_hell",
        "source_url",
        "note",
    ]
    ws.append(headers)
    header_fill = PatternFill("solid", fgColor="1a1a1a")
    header_font = Font(bold=True, color="FFFFFF")
    for col, h in enumerate(headers, 1):
        cell = ws.cell(1, col, h)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    for r in rows:
        ws.append([r[h] for h in headers])
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{len(rows)+1}"
    ws.freeze_panes = "A2"
    widths = [22, 28, 10, 48, 22, 14, 60, 80]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    ws2 = wb.create_sheet("bucket_summary")
    sh = ["bucket", "count", "sum_amount_hell", "min_amount_hell", "max_amount_hell"]
    ws2.append(sh)
    for r in summary:
        ws2.append([r[k] for k in sh])

    ws3 = wb.create_sheet("research_notes")
    ws3.append(["key", "value"])
    for k, v in meta.items():
        ws3.append([k, json.dumps(v) if isinstance(v, (dict, list)) else v])
    wb.save(path)


def bucket_summary(rows: list[dict]) -> list[dict]:
    buckets: dict[str, list[int]] = {}
    for r in rows:
        buckets.setdefault(r["bucket"], []).append(int(r["amount_hell"]))
    out = []
    for b, amts in sorted(buckets.items()):
        out.append(
            {
                "bucket": b,
                "count": len(amts),
                "sum_amount_hell": sum(amts),
                "min_amount_hell": min(amts),
                "max_amount_hell": max(amts),
            }
        )
    out.append(
        {
            "bucket": "ALL",
            "count": len(rows),
            "sum_amount_hell": sum(int(r["amount_hell"]) for r in rows),
            "min_amount_hell": min(int(r["amount_hell"]) for r in rows),
            "max_amount_hell": max(int(r["amount_hell"]) for r in rows),
        }
    )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--total", type=int, default=DEFAULT_TOTAL)
    ap.add_argument("--seed", default=DEFAULT_SEED)
    ap.add_argument("--rows", type=int, default=TARGET_ROWS)
    args = ap.parse_args()

    sol = load_json(SOURCES / "pumpfun-sol-price.json")
    sol_usd = float(sol["solPrice"])
    known, send_rows, send_summary = load_existing_wallets()

    pump_ranked, pump_stats = collect_pumpfun(sol_usd, known)
    pump_taken = take_quota(pump_ranked, QUOTAS["pumpfun"])

    traders: list[dict] = []
    for r in pump_taken:
        traders.append(
            {
                "bucket": "trader_pumpfun",
                "source_platform": "pumpfun",
                "rank": r["rank"],
                "wallet": r["wallet"],
                "pnl_usd_or_pump_ui": r["pnl_usd"],
                "amount_hell": None,
                "source_url": r["source_url"],
                "note": r["note"],
            }
        )

    # FOMO / Stonkfun / Moby: no public wallet+PnL feed reached. Do not fabricate.
    shortfalls = {
        "pumpfun": {
            "quota": QUOTAS["pumpfun"],
            "achieved": len(pump_taken),
            "available_positive_realized": len(pump_ranked),
            "reason": (
                "Official pump.fun PnL API only publishes 100 wallets per window "
                "(daily/weekly/monthly). Union + Mayhem + Kolscan (positive profit) "
                "+ GMGN launchpad_smart snapshot still under 500 after existing-list "
                "dedupe and invalid/infra filters. Stopped at real positive realized PnL."
            ),
            "backfill": (
                "Dune query 4032586 (Top Pump Fun Wallet by profit) with a Dune API key; "
                "or Solana Tracker PnL V2 /v2/pnl/leaderboard/top?platform= (paid)."
            ),
        },
        "fomo": {
            "quota": QUOTAS["fomo"],
            "achieved": 0,
            "reason": (
                "fomo.family prod-api.fomo.family returns 430 unauthorized without a "
                "Privy session. Independent api.fomoapi.io /v2/leaderboard/{window} "
                "returns 401 API key required. No public wallet list with PnL was reachable."
            ),
            "backfill": (
                "Register a free key at https://fomoapi.io/dashboard and pull "
                "GET https://api.fomoapi.io/v2/leaderboard/30d (documented as realized "
                "on-chain PnL with wallets.solana). Then re-run this script after adding "
                "sources/fomo-leaderboard-30d.json."
            ),
        },
        "stonkfun": {
            "quota": QUOTAS["stonkfun"],
            "achieved": 0,
            "reason": (
                "stonk.fun DNS does not resolve. stonkfun.xyz public API exposes tokens/"
                "launches/creators (Raydium LaunchLab) but no trader PnL leaderboard. "
                "Bitquery StonkFun docs only show per-token volume aggregations (API key)."
            ),
            "backfill": (
                "Aggregate realized PnL from Raydium LaunchLab program "
                "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj filtered to StonkFun platform "
                "configs 6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt (reward) and "
                "4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7 (standard) via Bitquery or Dune."
            ),
        },
        "moby": {
            "quota": QUOTAS["moby"],
            "achieved": 0,
            "reason": (
                "Moby (moby.win / AssetDash) hourly leaderboard publishes rank and 24h PnL "
                "only; docs state wallets stay private. No public program-id trader board."
            ),
            "backfill": (
                "If Moby later exposes wallets, ingest that feed. Until then do not treat "
                "screener 'smart money' aliases as Moby user wallets. Alternate: none that "
                "are actually Moby traders."
            ),
        },
    }

    taken = {r["wallet"] for r in traders}
    need_total = args.rows
    holders_needed = need_total - len(traders) - 11 - 80
    # 11 players + 80 nft are required; remaining slots are top PUMP holders
    if holders_needed < 0:
        holders_needed = 0
    existing_rows, exist_stats = assemble_existing(send_rows, taken, holders_needed)

    sheet = traders + existing_rows
    if len(sheet) < need_total:
            holders = [
                r
                for r in send_rows
                if r["bucket"] == "pump_person" and (r.get("status") or "") == "in"
            ]
            holders.sort(key=lambda r: float(r.get("pump_ui") or 0), reverse=True)
            rank = exist_stats["pump_person"]
            for r in holders:
                if len(sheet) >= need_total:
                    break
                w = (r.get("wallet") or "").strip()
                if not w or w in taken or not is_valid_pubkey(w) or is_excluded_infra(w):
                    continue
                taken.add(w)
                rank += 1
                try:
                    pump_val = float(r.get("pump_ui") or 0)
                except ValueError:
                    pump_val = None
                sheet.append(
                    {
                        "bucket": "pump_person",
                        "source_platform": "chainlords_pump_holder",
                        "rank": rank,
                        "wallet": w,
                        "pnl_usd_or_pump_ui": pump_val,
                        "amount_hell": None,
                        "source_url": "sources/ronda2.send.ready.csv",
                        "note": f"PUMP holder backfill pump_ui={r.get('pump_ui')}; {r.get('note')}",
                    }
                )
                exist_stats["pump_person"] += 1

    if len(sheet) != need_total:
        raise SystemExit(f"assembled {len(sheet)} rows, want {need_total}")

    wallets = [r["wallet"] for r in sheet]
    if len(set(wallets)) != len(wallets):
        raise SystemExit("duplicate wallets in final sheet")
    amounts = allocate_amounts(wallets, args.total, args.seed)
    for r, a in zip(sheet, amounts):
        r["amount_hell"] = a

    summary = bucket_summary(sheet)
    built_at = datetime.now(timezone.utc).isoformat()
    mix = {}
    for r in sheet:
        mix[r["bucket"]] = mix.get(r["bucket"], 0) + 1

    provenance = {
        "built_at": built_at,
        "mint": "4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq",
        "token": "HELL",
        "total_amount_hell": args.total,
        "seed": args.seed,
        "base_amount": args.total / len(sheet),
        "row_count": len(sheet),
        "sol_usd": sol_usd,
        "sol_price_source": "https://frontend-api-v3.pump.fun/sol-price",
        "quotas": QUOTAS,
        "shortfalls": shortfalls,
        "pumpfun_collection_stats": pump_stats,
        "existing_list_stats": exist_stats,
        "final_mix": mix,
        "prior_send_summary_excerpt": {
            "playersWithWallet": send_summary.get("playersWithWallet"),
            "keptPump": send_summary.get("keptPump"),
            "keptNft": send_summary.get("keptNft"),
        },
        "no_onchain_sends": True,
    }

    csv_path = ROOT / "airdrop_1500.csv"
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "bucket",
                "source_platform",
                "rank",
                "wallet",
                "pnl_usd_or_pump_ui",
                "amount_hell",
                "source_url",
                "note",
            ],
        )
        w.writeheader()
        w.writerows(sheet)

    sum_path = ROOT / "bucket_summary.csv"
    with sum_path.open("w", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "bucket",
                "count",
                "sum_amount_hell",
                "min_amount_hell",
                "max_amount_hell",
            ],
        )
        w.writeheader()
        w.writerows(summary)

    xlsx_path = ROOT / "airdrop_1500.xlsx"
    write_xlsx(xlsx_path, sheet, summary, provenance)
    (ROOT / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")

    traders_path = ROOT / "traders_collected.csv"
    with traders_path.open("w", newline="") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "source_platform",
                "source_tag",
                "rank",
                "wallet",
                "pnl_usd",
                "source_url",
                "note",
            ],
        )
        w.writeheader()
        for r in pump_ranked:
            w.writerow(
                {
                    "source_platform": r["source_platform"],
                    "source_tag": r["source_tag"],
                    "rank": r["rank"],
                    "wallet": r["wallet"],
                    "pnl_usd": r["pnl_usd"],
                    "source_url": r["source_url"],
                    "note": r["note"],
                }
            )

    print(json.dumps({"rows": len(sheet), "sum": sum(amounts), "mix": mix, "shortfalls": {
        k: {"quota": v["quota"], "achieved": v["achieved"]} for k, v in shortfalls.items()
    }}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
