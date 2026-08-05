/**
 * Read-only completeness audit: Chain Lords client/server vs Olympia-ish references.
 * node ops/audit-olympia-gaps.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const mp = path.join(root, 'multiplayer');

function read(p) {
    return fs.readFileSync(p, 'utf8');
}
function exists(p) {
    return fs.existsSync(p);
}
function listSprBasenames() {
    const dir = path.join(mp, 'mp-client', 'public', 'assets', 'sprites');
    if (!exists(dir)) return new Set();
    return new Set(
        fs.readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith('.spr'))
            .map((f) => f.replace(/\.spr$/i, '').toLowerCase()),
    );
}

function parseGeneratedItems(src) {
    const items = [];
    const re = /\{\s*\n\s*id:\s*(\d+),\s*\n\s*name:\s*"([^"]*)",\s*\n\s*itemType:\s*"([^"]*)",([\s\S]*?)\n\s*\}/g;
    let m;
    while ((m = re.exec(src))) {
        const body = m[4];
        items.push({
            id: Number(m[1]),
            name: m[2],
            itemType: m[3],
            equippedSpriteMale: (body.match(/equippedSpriteMale:\s*"([^"]+)"/) || [])[1],
            equippedSpriteFemale: (body.match(/equippedSpriteFemale:\s*"([^"]+)"/) || [])[1],
            startSpriteSheetIndex: (body.match(/startSpriteSheetIndex:\s*(\d+)/) || [])[1],
            gender: (body.match(/gender:\s*(\d+)/) || [])[1],
            body,
        });
    }
    return items;
}

function parseCfgItems() {
    const files = ['Item.cfg', 'Item2.cfg', 'Item3.cfg'].map((f) => path.join(root, 'reference', f));
    const byId = new Map();
    for (const file of files) {
        if (!exists(file)) continue;
        for (const line of read(file).split(/\r?\n/)) {
            const match = line.trim().match(/^Item\s*=\s*(.+)$/);
            if (!match) continue;
            const tokens = match[1].trim().split(/\s+/);
            if (tokens.length < 26) continue;
            const id = Number(tokens[0]);
            if (byId.has(id)) continue;
            const nums = tokens.slice(2).map((t) => Number.parseInt(t, 10));
            byId.set(id, {
                id,
                name: tokens[1],
                itemType: nums[0],
                equipPos: nums[1],
                appr: nums[15],
                genderLimit: nums[18],
                price: nums[13],
                maxLife: nums[9],
            });
        }
    }
    return byId;
}

const BODY = new Set(['armor', 'hauberk', 'leggings', 'boots', 'helmet', 'cape', 'weapon', 'shield']);
const APPEAR_SLOTS = new Set(['armor', 'hauberk', 'leggings', 'boots', 'helmet', 'cape']);

const genPath = path.join(mp, 'mp-client', 'src', 'constants', 'OlympiaItems.generated.ts');
const items = parseGeneratedItems(read(genPath));
const cfg = parseCfgItems();
const spr = listSprBasenames();

const report = { generated: new Date().toISOString(), counts: {}, gaps: [] };

report.counts.clientItems = items.length;
report.counts.cfgItems = cfg.size;
report.counts.sprFiles = spr.size;

// Missing equipped sprites
const missingEquip = [];
const missingSprFile = [];
for (const it of items) {
    if (!BODY.has(it.itemType)) continue;
    const needM = it.gender !== '1';
    const needF = it.gender !== '0';
    if (needM && !it.equippedSpriteMale) missingEquip.push({ id: it.id, name: it.name, type: it.itemType, side: 'male' });
    if (needF && !it.equippedSpriteFemale) missingEquip.push({ id: it.id, name: it.name, type: it.itemType, side: 'female' });
    for (const side of ['equippedSpriteMale', 'equippedSpriteFemale']) {
        const n = it[side];
        if (n && !spr.has(n.toLowerCase())) {
            missingSprFile.push({ id: it.id, name: it.name, sprite: n });
        }
    }
}
report.counts.missingEquippedSpriteFields = missingEquip.length;
report.counts.equippedSpriteMissingFile = [...new Map(missingSprFile.map((x) => [x.sprite, x])).values()].length;
report.gaps.push({
    area: 'Appearance equipped sprites',
    severity: missingEquip.length > 0 ? 'P1' : 'OK',
    detail: `${missingEquip.length} missing equippedSprite fields on body/weapon/shield; ${report.counts.equippedSpriteMissingFile} sprite basenames referenced but .spr file missing`,
    samples: missingEquip.slice(0, 15).concat(missingSprFile.slice(0, 10)),
});

// CFG ids not in client
const clientIds = new Set(items.map((i) => i.id));
const cfgOnly = [...cfg.keys()].filter((id) => !clientIds.has(id));
const clientOnly = items.filter((i) => !cfg.has(i.id));
report.counts.cfgIdsNotInClient = cfgOnly.length;
report.counts.clientIdsNotInCfg = clientOnly.length;
report.gaps.push({
    area: 'Item catalog id parity',
    severity: cfgOnly.length > 50 ? 'P1' : cfgOnly.length > 0 ? 'P2' : 'OK',
    detail: `${cfgOnly.length} Olympia cfg ids missing from client catalog; ${clientOnly.length} client ids not in cfg`,
    samples: cfgOnly.slice(0, 20).map((id) => `${id} ${cfg.get(id)?.name}`),
});

// Server Items.json
const serverItems = JSON.parse(read(path.join(mp, 'server', 'Config', 'Items.json')));
report.counts.serverItems = serverItems.length;
const serverById = new Map(serverItems.map((i) => [i.id, i]));
let noPrice = 0, noLife = 0, noOlympiaFx = 0;
for (const it of serverItems) {
    if (it.price == null) noPrice++;
    if (it.maxLifeSpan == null) noLife++;
    if (it.olympiaEffectType == null && BODY.has(it.itemType)) noOlympiaFx++;
}
report.gaps.push({
    area: 'Server Items.json fields',
    severity: 'P2',
    detail: `server items=${serverItems.length}; missing price=${noPrice}; missing maxLifeSpan=${noLife}; body gear missing olympiaEffectType=${noOlympiaFx}`,
});

// Monsters
const monsters = JSON.parse(read(path.join(mp, 'server', 'Config', 'Monsters.json')));
let lootRows = 0, lootUnknown = 0, noLoot = 0;
const unknownLootIds = new Map();
for (const mon of monsters) {
    const loot = mon.loot || [];
    if (loot.length === 0) noLoot++;
    for (const row of loot) {
        lootRows++;
        if (!serverById.has(row.itemId) && !clientIds.has(row.itemId)) {
            lootUnknown++;
            unknownLootIds.set(row.itemId, (unknownLootIds.get(row.itemId) || 0) + 1);
        }
    }
}
report.counts.monsters = monsters.length;
report.counts.lootRows = lootRows;
report.gaps.push({
    area: 'Monster loot table integrity',
    severity: lootUnknown > 0 ? 'P1' : noLoot > monsters.length * 0.3 ? 'P2' : 'P3',
    detail: `monsters=${monsters.length}; noLoot=${noLoot}; lootRows=${lootRows}; unknownItemIdsInLoot=${lootUnknown}`,
    samples: [...unknownLootIds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id, n]) => `itemId=${id} x${n}`),
});

// Spells
const spells = JSON.parse(read(path.join(mp, 'server', 'Config', 'Spells.json')));
report.counts.spells = spells.length;
const clientSpellsPath = path.join(mp, 'mp-client', 'src', 'constants');
// rough: client spell handling
const casting = exists(path.join(mp, 'server', 'Helpers', 'Casting.cs')) ? read(path.join(mp, 'server', 'Helpers', 'Casting.cs')) : '';
const spellNames = spells.map((s) => s.name || s.id);
report.gaps.push({
    area: 'Spells catalog size',
    severity: spells.length < 80 ? 'P1' : 'P2',
    detail: `Spells.json count=${spells.length}. Sample: ${spellNames.slice(0, 12).join(', ')}`,
});

// Grep TODOs / stubs
const todoHits = [];
function walk(dir, re, max = 80) {
    if (!exists(dir) || todoHits.length >= max) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (todoHits.length >= max) return;
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === 'publish-linux' || ent.name.startsWith('.')) continue;
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(p, re, max);
        else if (/\.(cs|ts|tsx|md)$/.test(ent.name)) {
            const text = read(p);
            const lines = text.split(/\n/);
            lines.forEach((line, i) => {
                if (todoHits.length >= max) return;
                if (re.test(line) && !/node_modules/.test(p)) {
                    todoHits.push(`${path.relative(root, p)}:${i + 1}: ${line.trim().slice(0, 120)}`);
                }
            });
        }
    }
}
walk(path.join(mp, 'server', 'Helpers'), /TODO|TBD|stub|not wired|not implemented|NYI|FIXME|Olympia parity/i, 100);
walk(path.join(mp, 'mp-client', 'src'), /TODO|TBD|stub|not wired|not implemented|NYI|FIXME/i, 80);
report.gaps.push({
    area: 'Explicit TODOs / stubs in code',
    severity: 'P2',
    detail: `${todoHits.length} sample hits (capped)`,
    samples: todoHits.slice(0, 40),
});

// Masterplan incomplete checkboxes
const master = exists(path.join(root, 'docs', 'MASTERPLAN.md')) ? read(path.join(root, 'docs', 'MASTERPLAN.md')) : '';
const openBoxes = (master.match(/- \[ \]/g) || []).length;
const doneBoxes = (master.match(/- \[x\]/gi) || []).length;
report.gaps.push({
    area: 'MASTERPLAN open checkboxes',
    severity: openBoxes > 20 ? 'P2' : 'P3',
    detail: `open=[ ] ${openBoxes}, done=[x] ${doneBoxes}`,
});

// Dialog inventory features
const dialogs = fs.readdirSync(path.join(mp, 'mp-client', 'src', 'ui', 'dialogs')).filter((f) => f.endsWith('.tsx'));
report.counts.clientDialogs = dialogs.length;
report.gaps.push({
    area: 'Client dialog surface',
    severity: 'P3',
    detail: `dialogs=${dialogs.length}: ${dialogs.map((d) => d.replace('.tsx', '')).join(', ')}`,
});

// Skills fishing mining
const skillsCs = exists(path.join(mp, 'server', 'Helpers', 'Skills.cs')) ? read(path.join(mp, 'server', 'Helpers', 'Skills.cs')) : '';
const gathering = exists(path.join(mp, 'server', 'Helpers', 'Gathering.cs')) ? read(path.join(mp, 'server', 'Helpers', 'Gathering.cs')) : '';
report.gaps.push({
    area: 'Fishing/Mining/Gathering',
    severity: 'P1',
    detail: `Skills.cs bytes=${skillsCs.length}; Gathering.cs bytes=${gathering.length}; look for half-implementations in code review`,
    samples: [
        skillsCs.includes('Fishing') || skillsCs.includes('fishing') ? 'Skills mentions fishing' : 'no fishing keyword in Skills.cs',
        gathering.includes('Mining') || gathering.includes('mining') ? 'Gathering mentions mining' : 'no mining keyword',
        gathering.includes('100') ? 'has 100 skill references' : 'no 100 skill refs',
    ],
});

// Blacksmith / repair / stones
const stone = exists(path.join(mp, 'server', 'Helpers', 'ItemStoneUpgrade.cs')) ? read(path.join(mp, 'server', 'Helpers', 'ItemStoneUpgrade.cs')) : '';
const shop = exists(path.join(mp, 'server', 'Helpers', 'Shop.cs')) ? read(path.join(mp, 'server', 'Helpers', 'Shop.cs')) : '';
report.gaps.push({
    area: 'Blacksmith / stones / shop',
    severity: 'P2',
    detail: `ItemStoneUpgrade present=${stone.length > 0}; Shop present=${shop.length > 0}; recycle stub? ${/recycle/i.test(shop) || /Reciclar|recycle/i.test(read(path.join(mp, 'mp-client', 'src', 'ui', 'dialogs', 'InventoryDialog.tsx')).slice(0, 50000))}`,
});

// Hell mining / token
const hell = exists(path.join(mp, 'server', 'Helpers', 'HellMiningStore.cs')) ? read(path.join(mp, 'server', 'Helpers', 'HellMiningStore.cs')) : '';
report.gaps.push({
    area: 'HELL mining / claim',
    severity: 'P2',
    detail: `HellMiningStore present; claim gated by HELL_MINT env typically; testing week rules active until Jul 31 default`,
});

// Nft / cNFT
const nft = exists(path.join(mp, 'server', 'Helpers', 'NftDropLedger.cs')) ? read(path.join(mp, 'server', 'Helpers', 'NftDropLedger.cs')) : '';
report.gaps.push({
    area: 'NFT / cNFT mint',
    severity: 'P2',
    detail: `NftDropLedger present=${nft.length > 0}; client mint UI often disabled post-test`,
});

// PA shields
const combat = exists(path.join(mp, 'server', 'Helpers', 'Combat.cs')) ? read(path.join(mp, 'server', 'Helpers', 'Combat.cs')) : '';
report.gaps.push({
    area: 'Combat PA / shield rules',
    severity: 'P2',
    detail: `Combat.cs size=${combat.length}; search defense-shield / PA in recent work — verify shield PA still disabled if intended`,
});

// Appearance default ghost gear
const pam = read(path.join(mp, 'mp-client', 'src', 'utils', 'PlayerAppearanceManager.ts'));
const ghostDefaults = /defaultHauberk|defaultLeggings|defaultArmor|defaultBoots|defaultHelm/.test(pam);
report.gaps.push({
    area: 'Default clothing ghost layers',
    severity: ghostDefaults ? 'P1' : 'OK',
    detail: ghostDefaults
        ? 'PlayerAppearanceManager still falls back to first catalog armor/hauberk/leggings/boots/helm when unequipped — can draw ghost gear'
        : 'no default clothing fallbacks found',
});

// Weapons without equipped sprite
const weaponsNo = items.filter((i) => i.itemType === 'weapon' && !i.equippedSpriteMale && !i.equippedSpriteFemale);
report.gaps.push({
    area: 'Weapons without equippedSprite',
    severity: weaponsNo.length > 30 ? 'P1' : weaponsNo.length > 0 ? 'P2' : 'OK',
    detail: `${weaponsNo.length} weapons lack both equipped sprites (share msw? or invisible)`,
    samples: weaponsNo.slice(0, 25).map((w) => `${w.id} ${w.name}`),
});

// Shields without startSpriteSheetIndex
const shieldsNoSheet = items.filter((i) => i.itemType === 'shield' && i.startSpriteSheetIndex == null && (i.equippedSpriteMale || i.equippedSpriteFemale));
report.gaps.push({
    area: 'Shields sheet index',
    severity: shieldsNoSheet.length > 5 ? 'P2' : 'P3',
    detail: `${shieldsNoSheet.length} shields missing startSpriteSheetIndex`,
    samples: shieldsNoSheet.slice(0, 10).map((s) => `${s.id} ${s.name}`),
});

// Paperdoll composite
const paper = read(path.join(mp, 'mp-client', 'src', 'utils', 'paperDollCapture.ts'));
report.gaps.push({
    area: 'F5 paperdoll',
    severity: paper.includes('PAPERDOLL_COMPOSITE_KEY') ? 'P3' : 'P1',
    detail: paper.includes('PAPERDOLL_COMPOSITE_KEY')
        ? 'Composite paperdoll recently added; polish vs Olympia (animation, colors, scale) still TBD'
        : 'paperdoll not composite',
});

// Output
const outPath = path.join(root, 'ops', 'olympia-gap-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nWrote', outPath);
