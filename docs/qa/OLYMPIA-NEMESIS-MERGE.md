# Olympia + Nemesis + Chain Lords — merge philosophy

**Feel target:** *almost Olympia* (including dragons / specialty / drops) + a **thin** Nemesis layer + a few CL product rules (HELL mining, arena kits, cash tickets, stake specialty).

## Priority when rules conflict

1. **Olympia** — combat tables, item identity, specialty ladders, boss multi-drop, hero set bonuses  
2. **Nemesis** — only where we explicitly adopted a QoL/PvP convention (document in MASTERPLAN)  
3. **Chain Lords new** — diminutive: economy, wallets, mining, escrow later, priority queue, region probe  

If a change makes dens feel “not Olympia”, it needs an explicit PO flag — not a silent default.

## What “diminuto” means

- New systems **wrap** Olympia (loadouts, tickets, specialty stake offset)  
- They should **not** rewrite hit/dmg formulas unless fixing a known bug  
- Dragons stay multi-drop Olympia-style; Debow/MS22 are catalog fixes, not new combat math  

## Agent checklist

- Pull `docs/qa/olympia-ingest/` before parity work  
- Run `combat_audit.py` + `combat_matrix_audit.py`  
- Prefer theory FAILs over friend WhatsApp for basics  
