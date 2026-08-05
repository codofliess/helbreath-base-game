# Hero Set — premium pixel look (referencia futura)

> **No implementar en el mes de test.** Copia interna de diseño para trabajo posterior.  
> Fuente original: `OneDrive\Desktop\CHAIN LORDS\` (PO · 2026-07-17).  
> Ver [`MASTERPLAN.md`](../../MASTERPLAN.md) § 1.8 + Fase F (arte).

## Archivos

| Archivo | Ciudad | Qué muestra |
|---------|--------|-------------|
| [`ares-hero-set-ref.jpeg`](./ares-hero-set-ref.jpeg) | Aresden | Hero set robe rojo/dorado + corona + capa negra, idle en city |
| [`elv-hero-set-ref.jpeg`](./elv-hero-set-ref.jpeg) | Elvine | Mismo set en paleta azul/dorado |

## Lectura de diseño (para cuando se implemente)

- Sigue siendo **pixel art isométrico Helbreath**, no avatar HD/3D.
- Nitidez = bordes limpios, pliegues y metal más legibles, **misma silueta/altura** que stock.
- Solo **capas de gear** (cape / hat / robe-armor / legs); body base clásico debajo.
- Encaja sobre mapa clásico (empedrado/casas) sin contraste agresivo.

## Alcance futuro (no bloquea launch de test)

1. Sheets `.spr` (o pipeline PNG→spr) por pieza M/W × Ares/Elv.  
2. Pivotes 8 dirs; mínimo idle+walk; combat anims después.  
3. Wire items `Items.json` 400–428 + torneo loadout.  
4. Render: NEAREST in-world (no LINEAR en GameWorld).

## Relación con otros docs

- Catálogo / unbind: [`HERO-SET-UNBIND-MARKET.md`](../../HERO-SET-UNBIND-MARKET.md)  
- Torneo equal-footing usa subset de ids hero set (stats, no este art).  
- Mes de test: **stock art** — este look = post-test / polish.
