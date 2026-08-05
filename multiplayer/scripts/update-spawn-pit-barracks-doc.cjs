const fs = require("fs");
const p = "C:/Users/54116/helbreath-base-game/docs/SPAWN-PIT-PARITY.md";
let t = fs.readFileSync(p, "utf8");
const lines = t.split(/\r?\n/);
const idx = lines.findIndex((l) => l.startsWith("5. **Farm Barracks"));
if (idx < 0) {
  console.error("line not found");
  process.exit(1);
}
lines[idx] =
  "5. **Farm Barracks (`arefarm`/`elvfarm`)** — dwellAreas manuales (42/62/63) **no** están en MAPDATA; **re-añadidas** cerca de Drillmaster / Merc Captain en `GameWorlds.json` (`npcs`). El pit sync **conserva** estas filas al re-sync MAPDATA vía merge de `BARRACKS_MONSTER_IDS` en el script.";
fs.writeFileSync(p, lines.join("\n") + (t.endsWith("\n") ? "\n" : ""), "utf8");
console.log("doc updated line", idx + 1);
