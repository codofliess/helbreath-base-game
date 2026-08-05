/**
 * Fill missing equippedSpriteMale/Female on body gear in OlympiaItems.generated.ts
 * using the opposite gender sibling or known Hero sprite pairs.
 */
import fs from 'fs';

const path = new URL('../src/constants/OlympiaItems.generated.ts', import.meta.url);
const file = fs.readFileSync(path, 'utf8');

/** Known Olympia body sheet basenames for hero pieces missing on female rows. */
const FORCED = {
    416: { equippedSpriteMale: 'mhrobe2', equippedSpriteFemale: 'whrobe2' }, // a Hero Robe(W)
    420: { equippedSpriteMale: 'mhhauberk2', equippedSpriteFemale: 'whhauberk1' }, // a Hero Hauberk(W)
};

// Parse items as loose objects by id
const items = new Map();
const re = /\{\s*\n([\s\S]*?)\n\s*\},/g;
let m;
while ((m = re.exec(file)) !== null) {
    const body = m[1];
    const idM = body.match(/id:\s*(\d+)/);
    if (!idM) continue;
    const id = Number(idM[1]);
    const name = (body.match(/name:\s*"([^"]+)"/) || [])[1];
    const itemType = (body.match(/itemType:\s*"([^"]+)"/) || [])[1];
    const em = (body.match(/equippedSpriteMale:\s*"([^"]+)"/) || [])[1];
    const ef = (body.match(/equippedSpriteFemale:\s*"([^"]+)"/) || [])[1];
    items.set(id, { id, name, itemType, em, ef, body, full: m[0] });
}

const BODY = new Set(['armor', 'hauberk', 'leggings', 'helmet', 'boots', 'cape']);
let patched = 0;
let out = file;

for (const [id, it] of items) {
    if (!BODY.has(it.itemType)) continue;
    let em = it.em;
    let ef = it.ef;
    if (FORCED[id]) {
        em = FORCED[id].equippedSpriteMale;
        ef = FORCED[id].equippedSpriteFemale;
    } else if (!em || !ef) {
        // Try sibling id: male/female pairs often consecutive
        for (const delta of [-1, 1, -2, 2]) {
            const sib = items.get(id + delta);
            if (!sib || sib.itemType !== it.itemType) continue;
            if (!em && sib.em) em = sib.em;
            if (!ef && sib.ef) ef = sib.ef;
            if (em && ef) break;
        }
    }
    if (!em || !ef) continue;
    if (it.em === em && it.ef === ef) continue;

    // Rebuild object fields: inject sprites before closing of this item
    let body = it.body;
    if (/equippedSpriteMale:/.test(body)) {
        body = body.replace(/equippedSpriteMale:\s*"[^"]*"/, `equippedSpriteMale: "${em}"`);
    } else {
        body = body.replace(/(\n)(\s*gender:)/, `\n        equippedSpriteMale: "${em}",$1$2`);
        if (!/equippedSpriteMale:/.test(body)) {
            body = body + `,\n        equippedSpriteMale: "${em}"`;
        }
    }
    if (/equippedSpriteFemale:/.test(body)) {
        body = body.replace(/equippedSpriteFemale:\s*"[^"]*"/, `equippedSpriteFemale: "${ef}"`);
    } else {
        body = body.replace(
            /equippedSpriteMale:\s*"[^"]*",?/,
            (s) => `${s.endsWith(',') ? s : s + ','}\n        equippedSpriteFemale: "${ef}",`,
        );
        if (!/equippedSpriteFemale:/.test(body)) {
            body = body + `,\n        equippedSpriteFemale: "${ef}"`;
        }
    }
    // clean double commas
    body = body.replace(/,\s*,/g, ',');
    const nextFull = `{\n${body}\n    },`;
    if (nextFull !== it.full) {
        out = out.replace(it.full, nextFull);
        patched++;
        console.log(`patched ${id} ${it.name} -> ${em}/${ef}`);
    }
}

fs.writeFileSync(path, out);
console.log(`done, patched=${patched}`);
