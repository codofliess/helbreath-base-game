/**
 * Add Olympia Magic.cfg center-spot dice (effect4/5/6, or effect7/8/9 when center is 0)
 * onto multiplayer Spells.json as damageDiceCount/Sides/Bonus.
 */
import fs from 'fs';

const path = 'C:/Users/54116/helbreath-base-game/multiplayer/server/Config/Spells.json';
const spells = JSON.parse(fs.readFileSync(path, 'utf8'));

/** server spell id → [count, sides, bonus] from Magic.cfg */
const DICE = {
  0: [2, 4, 1],   // Energy Bolt
  1: [2, 6, 2],   // Fire Ball
  2: [2, 8, 3],   // Fire Strike
  3: [2, 8, 3],   // Chill Wind
  4: [0, 15, 0],  // Poison Cloud (ground tick uses 1d15-style via sides)
  5: [2, 4, 2],   // Triple Energy Bolt (center)
  6: [4, 5, 18],  // Lightning Bolt
  7: [2, 8, 0],   // Spike Field
  8: [2, 8, 0],   // Fire Field
  9: [4, 4, 0],   // Ice Storm (cfg 4/0/0 → treat as 4d4)
  10: [5, 6, 12], // Ice Strike
  11: [7, 6, 17], // Energy Strike (type 21 AREA_NOSPOT → area dice 7d6+17)
  12: [7, 10, 18], // Mass Fire Strike (type 3 AREA → area dice 7d10+18; stronger than center 5d6+12)
  13: [3, 8, 6],  // Mass Chill Wind
  14: [7, 6, 17], // Earthworm Strike
  15: [7, 6, 17], // Armor Break
  16: [5, 8, 20], // Bloody Shock Wave
  17: [7, 8, 25], // Mass Ice Strike
  18: [7, 7, 20], // Lightning Strike
  19: [6, 8, 12], // Meteor Strike
  20: [7, 7, 20], // Mass Lightning Strike (proxy Mass Magic Missile tier)
  21: [5, 1, 20], // Blizzard
  22: [5, 1, 20], // Earth Shock Wave
  23: [7, 8, 16], // Mass Blizzard (area dice)
};

let n = 0;
for (const s of spells) {
  const d = DICE[s.id];
  if (!d) continue;
  // Poison Cloud: 0 count means 1d(sides)+bonus for tick
  s.damageDiceCount = d[0] > 0 ? d[0] : 1;
  s.damageDiceSides = Math.max(1, d[1]);
  s.damageDiceBonus = d[2];
  n++;
}

fs.writeFileSync(path, JSON.stringify(spells, null, 2) + '\n');
console.log(`Patched damage dice on ${n} spells`);
