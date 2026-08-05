# Olympia Tutelary Angels (Angelic Pendants)

> Chain Lords parity: claim at Gail / Command Hall, majestics at max level, equip bonuses, bag upgrade to +15.

## Olympia (source)

| Piece | Detail |
|-------|--------|
| **When** | After max level (L150 CL / player max); excess exp → **majestic / gizon** points (`bCheckLevelUp` / `m_iGizonItemUpgradeLeft++`) |
| **Where** | Gail menu → “Receive a Tutelary Angel” (Command Hall UI, dialog 51 mode 4) |
| **Cost** | **5 majestics** per pendant (client requires `m_iGizonItemUpgradeLeft >= 5`) |
| **Kinds** | STR **1108** · DEX **1109** · INT **1110** · MAG **1111** (`AngelicPandent(*)`) |
| **Equip** | Bonus = **upgrade nibble + 1** (bits 28–31). Base claim = nibble 0 → **+1** stat |
| **Upgrade** | Spend majestics on pendant (Skill List / Upgrade Item); Olympia table to +10, **CL extends to +15** |
| **Combat** | Angelic stats stack into HP/MP/SP, hit/weight, cast success INT, magic damage MAG, etc. |

Wiki: *Angel can be bought from Gail at Command Hall for 5 Majestics. Angel can be upgraded for more Majestics.*

## Chain Lords — status

| Layer | Status |
|-------|--------|
| Majestics from max-level / Block Level kill exp | **Done** — `Progression.ApplyMajesticFromExp` |
| Equip angelic STR/DEX/INT/MAG | **Done** — `PlayerDerivedStats.GetAngelicBonuses` (nibble+1) |
| Bag majestic upgrade angels + DK | **Done** — `MajesticUpgrade.cs` |
| Arena free angels +15 | **Done** — `ArenaKitCatalog` / `ArenaLoadout` |
| **Claim angel for 5 maj at Gail/Perry** | **Shipped 2026-07-30** — `CityNpcServices` `claim_angel_*` |
| Client UI angels at Gail / Perry | **Shipped 2026-07-30** — `NpcTalkDialog.tsx` |
| First-majestic chat tip | **Shipped 2026-07-30** — system chat when first majestics earned |

## Player flow (CL)

1. Reach **L150** (or use Block Level earlier if product allows maj farm).
2. Keep killing: exp → **majestics** (F5 shows Maj).
3. Talk to **Gail** (cathedral) or **Perry** (command hall).
4. Claim **Angel STR / DEX / INT / MAG** for **5 maj** each (soulbound).
5. Equip in **accessory** slot → +1 … +15 to that stat.
6. Bag **RMB → Majestic upgrade** to raise the pendant (cost table in `MajesticUpgrade.AngelCosts`).

## Files

| File | Role |
|------|------|
| `Helpers/CityNpcServices.cs` | Claim angel actions |
| `Helpers/Progression.cs` | Majestic accrual + first-maj tip |
| `Helpers/MajesticUpgrade.cs` | Pendant upgrades |
| `Helpers/PlayerDerivedStats.cs` | Equip bonuses |
| `Items.json` 1108–1111 | Catalog |
| `mp-client/.../NpcTalkDialog.tsx` | UI |
| `mp-client/.../InventoryDialog.tsx` | RMB majestic upgrade |

## Not in scope (Olympia extras)

- Heldenian soldiers / flags from same Gail menu
- Visual wing / angel sprite over character (`SetAngelFlag`) — optional polish
