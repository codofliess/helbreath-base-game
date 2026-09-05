'use strict';
const fs = require('fs');
const path = require('path');
const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'pons-create-pack.json'), 'utf8'));
if (!/abaddon-icon\/discord-server-icon\.png/.test(p.logo)) {
  console.error('ASSERT_FAIL logo must be Abaddon PNG');
  process.exit(1);
}
if (!p.socials.twitter.includes('ChainLordsHQ')) process.exit(1);
if (!p.socials.discord.includes('discord.gg')) process.exit(1);
if (!p.socials.website.includes('chainlords.net')) process.exit(1);
if (!p.description.includes('play.chainlords.net')) process.exit(1);
console.log('=== PONS CREATE — paste exactly ===');
console.log(`Name:        ${p.name}`);
console.log(`Symbol:      ${p.symbol}`);
console.log(`Logo:        ${p.logo}`);
console.log(`Website:     ${p.socials.website}`);
console.log(`X:           ${p.socials.twitter}`);
console.log(`Discord:     ${p.socials.discord}`);
console.log(`Play:        ${p.play}`);
console.log(`Description: ${p.description}`);
console.log(`First buy:   $${p.developerBuyUsd} ETH (not 50% supply)`);
if (!/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e/i.test(p.factory)) {
  console.error('ASSERT_FAIL factory must be Pons V2');
  process.exit(1);
}
console.log(`Factory:     ${p.factory}`);
console.log('ASSERT_OK pons metadata pack');
