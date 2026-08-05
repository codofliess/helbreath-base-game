import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = path.join(__dirname, '..', 'Config', 'Items.json');
const pub = path.join(__dirname, '..', 'publish-linux', 'Config', 'Items.json');
const clientGen = path.join(__dirname, '..', '..', 'mp-client', 'src', 'constants', 'OlympiaItems.generated.ts');

const EXTRA_IDS = [970, 1112, 950, 951, 952, 953];

const d = JSON.parse(fs.readFileSync(cfg, 'utf8'));
const ids = new Set(d.map((x) => x.id));
const pubItems = JSON.parse(fs.readFileSync(pub, 'utf8'));
let added = 0;
for (const e of pubItems) {
    if (EXTRA_IDS.includes(e.id) && !ids.has(e.id)) {
        d.push(e);
        ids.add(e.id);
        added++;
    }
}
d.sort((a, b) => a.id - b.id);
fs.writeFileSync(cfg, `${JSON.stringify(d, null, 2)}\n`);
console.log('server Items.json', d.length, 'added', added);

// Client CritCandy 970
let ts = fs.readFileSync(clientGen, 'utf8');
if (!/id:\s*970,/.test(ts)) {
    ts = ts.replace(
        /\n\];\s*$/,
        `,
    {
        id: 970,
        name: "Crit Candy",
        itemType: "misc",
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 0,
        itemSpriteIndexFemale: 0,
        stackable: true,
        consumable: true,
    },
    {
        id: 1112,
        name: "Stone of Integrity",
        itemType: "misc",
        itemSheetIndexMale: 5,
        itemSheetIndexFemale: 5,
        itemSpriteIndexMale: 1,
        itemSpriteIndexFemale: 1,
        stackable: true,
        consumable: true,
    }
];
`,
    );
    fs.writeFileSync(clientGen, ts);
    console.log('client gen: added 970 + 1112');
} else {
    console.log('client already has 970');
}
