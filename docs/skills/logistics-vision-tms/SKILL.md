---
name: logistics-vision-tms
description: >
  Warehouse / TMS logistics with cameras, QR, RFID/BLE, drones for high racks, remito
  redesign, and inventory input improvements. Use when the user discusses depósitos,
  stock automático, ingresos/egresos, pallets, drones inventory, beacons, or factory QR.
  Not Chain Lords game code — spin-off product vision.
---

# Logistics / TMS — vision + labels

## Product north star

Hybrid **label + sensor + camera evidence**. Do not promise pure-vision perfect stock.

## Architecture layers

1. **Factory input** — serial + QR on box (or factory stickers as paid service).  
2. **Dock** — portal RFID or QR scan vs digital remito.  
3. **High-value pallets (USD 2k–10k)** — BLE/RFID; film kills pure vision.  
4. **High racks** — 2 drones (redundancy/batteries): QR + photo + morphology if regular layout.  
5. **Exceptions** — human only on mismatch.

## Remito redesign

Per line: text + **family image** + **serial/glyph image** + reception thumb.  
Geometric B/W glyph = offline visual ID (no chain required).  
cNFT/Solana = optional premium anchor, not WMS core.

## MVP order

0. QR + digital remito with images  
1. Reception app scan vs remito  
2. Beacon/RFID on value pallets  
3. One drone aisle pilot  
4. Second drone  
5. Optional on-chain hash for premium batches  

## Anti-patterns

- Drone day-1 without factory QR.  
- Counting loose SKUs with vision only.  
- Putting every box on Solana.  
- Blocking Chain Lords core work without writing this to docs/skills.

## Full write-up

`helbreath-base-game/docs/LOGISTICS-TMS-VISION.md` (until moved to dedicated logistics repo).
