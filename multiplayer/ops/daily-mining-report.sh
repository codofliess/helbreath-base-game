#!/usr/bin/env bash
# Daily play-mine report: export CSV/JSON from ledger + cross-check traveler files + presence-log.
# NEVER claim "zero activity" without checking travelers/presence sidecar.
set -uo pipefail

CHARS_DIR="${CHARS_DIR:-/opt/chainlords/server/Chars}"
REPORT_DIR="${REPORT_DIR:-${CHARS_DIR}/reports}"
STATE_DIR="${STATE_DIR:-/opt/chainlords/ops/state}"
LOG="${STATE_DIR}/daily-mining-report.log"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
DAY="${1:-}"

mkdir -p "${REPORT_DIR}" "${STATE_DIR}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

if [[ -z "$DAY" ]]; then
  DAY="$(date -u -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d)"
fi

log "daily mining report for ${DAY}"

LEDGER="${CHARS_DIR}/hell-mining.json"
if [[ ! -f "$LEDGER" ]]; then
  log "missing ledger ${LEDGER}"
  exit 1
fi

python3 - <<PY
import json, os, csv, glob
from datetime import datetime, timezone, date
from pathlib import Path

day = "${DAY}"
ledger_path = "${LEDGER}"
chars_dir = Path("${CHARS_DIR}")
report_dir = Path("${REPORT_DIR}")
report_dir.mkdir(parents=True, exist_ok=True)

with open(ledger_path, encoding="utf-8") as f:
    data = json.load(f)

days = data.get("days") or {}
day_obj = days.get(day) or {"utcDay": day, "wallets": {}, "settled": False}
wallets_bal = data.get("wallets") or {}
day_wallets = day_obj.get("wallets") or {}

rows = []
for w, row in day_wallets.items():
    bal = wallets_bal.get(w) or {}
    rows.append({
        "utcDay": day,
        "wallet": w,
        "characterName": row.get("characterName") or "",
        "connectedMinutes": int(row.get("connectedMinutes") or 0),
        "monsterKills": int(row.get("monsterKills") or 0),
        "ekCount": int(row.get("ekCount") or 0),
        "credits": int(row.get("credits") or 0),
        "directTokens": int(row.get("directTokens") or 0),
        "settledShare": int(row.get("settledShare") or 0),
        "pendingHell": int(bal.get("pendingHell") or 0),
        "claimedHell": int(bal.get("claimedHell") or 0),
        "loginCredit": bool(row.get("loginCreditGranted")),
        "monsterCredit": bool(row.get("monsterCreditGranted")),
        "eventParticipated": bool(row.get("eventParticipated")),
        "source": "ledger",
    })

# --- Cross-check: travelers whose save mtime falls on this UTC day ---
try:
    day_date = date.fromisoformat(day)
except ValueError:
    day_date = None

traveler_hits = []
if day_date is not None:
    for p in chars_dir.glob("*.traveler.json"):
        if "bak" in p.name:
            continue
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
        if mtime.date() != day_date:
            continue
        wallet = p.name.replace(".traveler.json", "")
        name = d.get("CharacterName") or "?"
        traveler_hits.append({
            "wallet": wallet,
            "characterName": name,
            "level": d.get("Level"),
            "hoursPlayed": float(d.get("HoursPlayed") or 0),
            "mtimeUtc": mtime.isoformat(),
            "gameWorldId": d.get("GameWorldId"),
        })

ledger_wallets = {r["wallet"] for r in rows}
missing_from_ledger = [t for t in traveler_hits if t["wallet"] not in ledger_wallets]

# --- Presence-log sidecar (append-only) ---
presence_path = chars_dir / "presence-log" / f"presence-{day}.jsonl"
presence_names = set()
if presence_path.is_file():
    for line in presence_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
            if ev.get("name"):
                presence_names.add(ev["name"])
            if ev.get("wallet"):
                presence_names.add(ev["wallet"][:12])
        except Exception:
            pass

warnings = []
if not rows and (traveler_hits or presence_names):
    warnings.append(
        f"LEDGER EMPTY but traveler saves on day={len(traveler_hits)} presenceLogActive={bool(presence_names)} — DO NOT report zero activity"
    )
if missing_from_ledger:
    names = ", ".join(f"{t['characterName']}({t['wallet'][:8]})" for t in missing_from_ledger)
    warnings.append(f"Travelers saved on {day} but missing from mining ledger: {names}")

rows.sort(key=lambda r: (-r["settledShare"], -r["credits"], -r["connectedMinutes"], r["wallet"]))

report = {
    "utcDay": day,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "settled": bool(day_obj.get("settled")),
    "totalCredits": int(day_obj.get("totalCredits") or 0),
    "directSpent": int(day_obj.get("directSpent") or 0),
    "creditPoolDistributed": int(day_obj.get("creditPoolDistributed") or 0),
    "remainingPool": int(data.get("remainingPool") or 0),
    "dailyTokenCap": 500000,
    "activeWallets": len(rows),
    "wallets": rows,
    "travelerSavesOnDay": traveler_hits,
    "travelersMissingFromLedger": missing_from_ledger,
    "presenceLogPath": str(presence_path) if presence_path.is_file() else None,
    "warnings": warnings,
    "integrity": "ok" if not warnings else "GAPS — see warnings",
}

json_path = report_dir / f"mining-{day}.json"
csv_path = report_dir / f"mining-{day}.csv"
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

fields = [
    "utcDay","wallet","characterName","connectedMinutes","monsterKills","ekCount",
    "credits","directTokens","settledShare","pendingHell","claimedHell",
    "loginCredit","monsterCredit","eventParticipated","source"
]
with open(csv_path, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)

print(json_path)
print(f"ACTIVE={len(rows)} CREDITS={report['totalCredits']} SHARE={report['creditPoolDistributed']} SETTLED={report['settled']} WARNINGS={len(warnings)}")
for wmsg in warnings:
    print("WARN:", wmsg)
PY

# Build human mail body with integrity checks
MAIL_BODY="$(python3 - <<PY
import json
from pathlib import Path
day = "${DAY}"
p = Path("${REPORT_DIR}") / f"mining-{day}.json"
if not p.is_file():
    print(f"No report for {day}")
    raise SystemExit(0)
r = json.loads(p.read_text(encoding="utf-8"))
lines = []
lines.append(f"Chain Lords mining report — {day} (UTC)")
lines.append(f"Generated: {r.get('generatedAt')}")
lines.append(f"Integrity: {r.get('integrity', 'ok')}")
lines.append("")
lines.append("=== Mining Summary ===")
lines.append(f"Active wallets (ledger): {r.get('activeWallets')}")
lines.append(f"Total credits: {r.get('totalCredits')}")
lines.append(f"Credit pool distributed: {r.get('creditPoolDistributed')}")
lines.append(f"Remaining pool: {r.get('remainingPool')}")
lines.append(f"Settled: {r.get('settled')}")
lines.append("")
if r.get("warnings"):
    lines.append("=== ⚠ INTEGRITY WARNINGS (do not ignore) ===")
    for w in r["warnings"]:
        lines.append(f"⚠ {w}")
    lines.append("")
if r.get("travelersMissingFromLedger"):
    lines.append("=== Travelers saved this day but NOT in mining ledger ===")
    for t in r["travelersMissingFromLedger"]:
        lines.append(f"- {t.get('characterName')} L{t.get('level')} wallet={t.get('wallet')[:16]}… mtime={t.get('mtimeUtc')} hoursPlayed={t.get('hoursPlayed')}")
    lines.append("(These people WERE online — ledger gap. Investigate presence-log / redeploy wipe.)")
    lines.append("")
lines.append("=== Ledger wallets ===")
if not r.get("wallets"):
    lines.append("(none in hell-mining day row)")
else:
    for i, w in enumerate(r["wallets"], 1):
        lines.append(
            f"{i}) {w.get('characterName') or '?'} ({(w.get('wallet') or '')[:8]}…)"
            f" mins={w.get('connectedMinutes')} kills={w.get('monsterKills')} ek={w.get('ekCount')}"
            f" credits={w.get('credits')} share={w.get('settledShare')}"
        )
print("\n".join(lines))
PY
)"

log "report body ready (${#MAIL_BODY} chars)"
echo "$MAIL_BODY" | tee -a "$LOG"

# Optional Discord
if [[ -n "${DISCORD_WEBHOOK_URL}" ]]; then
  python3 - <<PY
import json, os, urllib.request
body = """${MAIL_BODY}"""
url = os.environ.get("DISCORD_WEBHOOK_URL") or "${DISCORD_WEBHOOK_URL}"
payload = json.dumps({"content": body[:1900]}).encode()
req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(req, timeout=15)
    print("discord ok")
except Exception as e:
    print("discord fail", e)
PY
fi

log "done ${DAY}"
