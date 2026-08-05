# Single WebSocket + priority queue (combat vs meta)

**Status:** shipped 2026-07-31  
**Rollback:** `Settings.json` → `"enableMessagePriorityQueue": false` + restart server; client `window.__CL_PRIORITY_QUEUE__ = false` (or redeploy client with flag off).

---

## What it is

Still **one** WebSocket connection. Two **logical** outbound queues:

| Class | Examples |
|-------|----------|
| **High** | move, cast, damage, vitals, CC, equip, ping |
| **Normal** | chat, auction browse, mining status, warehouse dumps, progression bulk |

**Server:** always flushes High before Normal (Normal limited to 8/cycle so meta is not starved forever).  
**Client:** microtask flush High then Normal; chat/auction/mining status tagged Normal.

Does **not** reduce physical RTT. Helps when **meta traffic** would otherwise delay combat frames on the same TCP stream.

---

## Empirical monitoring (for PO)

### Server files (VPS)

```
/opt/chainlords/server/Chars/reports/net-priority-YYYY-MM-DD.json   # latest snapshot
/opt/chainlords/server/Chars/reports/net-priority-YYYY-MM-DD.log    # every ~5 min
```

Fields:

| Field | Meaning |
|-------|---------|
| `outboundHigh` / `outboundNormal` | Messages classified |
| `highEnqueuedWhileNormalPending` | **Key signal:** combat packet arrived while meta was already waiting — queue would have reordered vs FIFO |
| `flushCycles` | Drain cycles |
| `normalSentAfterHighDrain` | Meta sent after combat in same cycle |

Also journal: `[NetworkPriority] high=… normal=… highWhileNormalPending=…`

### Client (browser console)

```js
window.__CL_PRIORITY_STATS__
// { high, normal, flushes, highWhileNormal }
window.__CL_PRIORITY_QUEUE__ = false  // emergency off this session
```

### What “success” looks like

- During dens + chat/auction open: `highWhileNormalPending` rises (pressure exists) and players report fewer “cast delayed” feels.  
- If `highWhileNormalPending` stays ~0 under real play: **little benefit** → tradeoff complexity not worth it → set `enableMessagePriorityQueue: false`.

### Daily ops note (optional in mining report)

```
scp … net-priority-$(date -u +%F).json
# or journalctl -u chainlords-game | grep NetworkPriority
```

Agent can include a one-liner in the daily mining email when the file exists.

---

## Roadmap (agreed product direction)

| # | Item | Notes |
|---|------|--------|
| 1 | **Priority queue (this doc)** | Done — measure 1–2 weeks |
| 2 | Trade map | **Desestimado** — P2P trades en Bleeding Island como Olympia |
| 3 | **Region probe** | Informar pings + proponer región; opcional si jugadores lo usan |
| 4 | **Latency floor vote** | 50/75/100 opcional caps (1v1 / 3v3) |
| 5 | **Escrow on-chain** | Duel stakes + wallet trades |
| 6 | **Geo IP daily reports** | Zonas de players (sin VPN) → decidir hosts PvP equidistantes ready-to-deploy |

---

## Toggle

```json
// Config/Settings.json
"enableMessagePriorityQueue": true
```
