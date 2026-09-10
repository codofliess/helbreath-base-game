import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getCityLandmarksForMap } from '../constants/CityLandmarks';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const gameWorldsPath = path.join(repoRoot, 'multiplayer/server/Config/GameWorlds.json');
const mapsDir = path.join(repoRoot, 'sp-client/public/assets/maps');
const mapTeleportPath = path.join(repoRoot, 'sp-client/src/constants/MapTeleportLocs.ts');
const revivePolicyPath = path.join(repoRoot, 'multiplayer/server/Helpers/RevivePolicy.cs');
const cityNpcPath = path.join(repoRoot, 'multiplayer/server/Helpers/CityNpcServices.cs');
const gardenQuestsPath = path.join(repoRoot, 'multiplayer/server/Helpers/GardenQuests.cs');
const cityEscapePath = path.join(repoRoot, 'multiplayer/server/Helpers/CityEscape.cs');
const serverCsPath = path.join(repoRoot, 'multiplayer/server/Server.cs');
const gameWorldCsPath = path.join(repoRoot, 'multiplayer/server/World/Game/GameWorld.cs');

type World = {
    id: string;
    teleportLocs?: Array<{
        locs: Array<{ x: number; y: number }>;
        target: { worldId: string; loc: { x: number; y: number } };
    }>;
    npcs?: Array<{ npcId: number }>;
};

function loadAmd(filePath: string) {
    const buf = fs.readFileSync(filePath);
    const headerText = new TextDecoder('ascii').decode(buf.subarray(0, 256)).replace(/\0/g, ' ');
    const tokens = headerText.split(/\s+/).filter((t) => t.length > 0);
    let sizeX = 0;
    let sizeY = 0;
    let tileSize = 0;
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i] === 'MAPSIZEX' && i + 2 < tokens.length) sizeX = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'MAPSIZEY' && i + 2 < tokens.length) sizeY = parseInt(tokens[i + 2], 10);
        if (tokens[i] === 'TILESIZE' && i + 2 < tokens.length) tileSize = parseInt(tokens[i + 2], 10);
    }
    return { buf, sizeX, sizeY, tileSize, offset: 256 };
}

function tileFlags(amd: ReturnType<typeof loadAmd>, x: number, y: number) {
    const tileOffset = amd.offset + (y * amd.sizeX + x) * amd.tileSize;
    const sprite = amd.buf.readInt16LE(tileOffset);
    const flags = amd.buf[tileOffset + 8];
    const wet = sprite === 18 || sprite === 19;
    return {
        walk: (flags & 0x80) === 0 && !wet,
        tele: (flags & 0x40) !== 0,
        wet,
    };
}

describe('Elvine Magias city escape (garden → Hunt Zone → city / Gandalf)', () => {
    const worlds = JSON.parse(fs.readFileSync(gameWorldsPath, 'utf8')) as World[];
    const byId = new Map(worlds.map((w) => [w.id, w]));

    it('elvuni has AMD east-wall exits to huntzone1 (not an empty trap)', () => {
        const world = byId.get('elvuni');
        assert.ok(world, 'elvuni world missing');
        const set = world.teleportLocs?.[0];
        assert.ok(set, 'elvuni teleportLocs empty — garden is a one-way trap');
        assert.equal(set.target.worldId, 'huntzone1');
        assert.equal(set.target.loc.x, 23);
        assert.equal(set.target.loc.y, 52);
        assert.equal(set.locs.length, 9);
        const amd = loadAmd(path.join(mapsDir, 'elvuni.amd'));
        for (const loc of set.locs) {
            assert.equal(loc.x, 176);
            assert.ok(loc.y >= 20 && loc.y <= 28);
            assert.equal(tileFlags(amd, loc.x, loc.y).tele, true, `elvuni (${loc.x},${loc.y}) must be AMD 0x40`);
        }
        const hz1 = loadAmd(path.join(mapsDir, 'huntzone1.amd'));
        const land = tileFlags(hz1, 23, 52);
        assert.equal(land.walk, true);
        assert.equal(land.tele, false);
        assert.equal(land.wet, false);
    });

    it('areuni has AMD north-edge exits to huntzone2', () => {
        const world = byId.get('areuni');
        assert.ok(world);
        const set = world.teleportLocs?.[0];
        assert.ok(set);
        assert.equal(set.target.worldId, 'huntzone2');
        assert.equal(set.target.loc.x, 115);
        assert.equal(set.target.loc.y, 176);
        assert.equal(set.locs.length, 18);
        const amd = loadAmd(path.join(mapsDir, 'areuni.amd'));
        for (const loc of set.locs) {
            assert.equal(loc.y, 20);
            assert.equal(tileFlags(amd, loc.x, loc.y).tele, true);
        }
    });

    it('Elvine city plaza and Wizard Tower door are walkable; Gandalf pin is on elvine', () => {
        const elvine = loadAmd(path.join(mapsDir, 'elvine.amd'));
        const plaza = tileFlags(elvine, 158, 57);
        assert.equal(plaza.walk, true);
        assert.equal(plaza.tele, false);
        const approach = tileFlags(elvine, 181, 78);
        assert.equal(approach.walk, true);
        const door = tileFlags(elvine, 180, 77);
        assert.equal(door.tele, true, 'Wizard Tower door must stay a city warp');

        const tower = loadAmd(path.join(mapsDir, 'wzdtwr_1.amd'));
        const gandalfStand = tileFlags(tower, 46, 34);
        assert.equal(gandalfStand.walk, true);

        const pins = getCityLandmarksForMap('elvine');
        assert.equal(pins.some((p) => p.id === 'elvine-gandalf' && p.x === 181 && p.y === 78), true);
        const gardenPins = getCityLandmarksForMap('elvuni');
        assert.equal(gardenPins.some((p) => p.id === 'elvuni-exit'), true);
    });

    it('client MapTeleportLocs, RevivePolicy, Kennedy wizard, and Warden return_city stay wired', () => {
        const locs = fs.readFileSync(mapTeleportPath, 'utf8');
        assert.match(locs, /"mapId": "elvuni"/);
        assert.match(locs, /"targetMap": "huntzone1"/);
        assert.match(locs, /"mapId": "areuni"/);
        assert.match(locs, /\[127, 78\][\s\S]*?"targetMap": "elvine"[\s\S]*?"targetX": 158[\s\S]*?"targetY": 57/);
        assert.match(locs, /\[80, 75\][\s\S]*?"targetMap": "aresden"[\s\S]*?"targetX": 140[\s\S]*?"targetY": 49/);
        assert.match(locs, /"elvine": \[\s*"elvine",\s*158,\s*57\s*\]/);

        const revive = fs.readFileSync(revivePolicyPath, 'utf8');
        assert.match(revive, /IsForcedTownReviveWorld/);
        assert.match(revive, /ShouldReviveToTown/);
        assert.match(revive, /REVIVE_TO_TOWN/);

        const city = fs.readFileSync(cityNpcPath, 'utf8');
        assert.match(city, /"wizard"/);
        assert.match(city, /TryTeleportCitizenHome/);
        assert.match(city, /elvwzdtwr/);

        const garden = fs.readFileSync(gardenQuestsPath, 'utf8');
        assert.match(garden, /return_city/);
        assert.match(garden, /TryTeleportCitizenHome/);
    });

    it('login / traveler / City Hall land on Elvine streets (158,57), never garden or slime pad', () => {
        const traveler = byId.get('traveler');
        const toElvine = traveler?.teleportLocs?.find((t) => t.target.worldId === 'elvine');
        assert.ok(toElvine, 'traveler east pad must enter Elvine');
        assert.equal(toElvine.target.loc.x, 158);
        assert.equal(toElvine.target.loc.y, 57);
        const toAresden = traveler?.teleportLocs?.find((t) => t.target.worldId === 'aresden');
        assert.ok(toAresden);
        assert.equal(toAresden.target.loc.x, 140);
        assert.equal(toAresden.target.loc.y, 49);

        const hall = byId.get('elvcityhall');
        const hallExit = hall?.teleportLocs?.[0];
        assert.ok(hallExit);
        assert.equal(hallExit.target.worldId, 'elvine');
        assert.equal(hallExit.target.loc.x, 158);
        assert.equal(hallExit.target.loc.y, 57);

        const areHall = byId.get('arecityhall');
        assert.equal(areHall?.teleportLocs?.[0]?.target.loc.x, 140);
        assert.equal(areHall?.teleportLocs?.[0]?.target.loc.y, 49);

        const escape = fs.readFileSync(cityEscapePath, 'utf8');
        assert.match(escape, /TryResolveCitizenSafeEnter/);
        assert.match(escape, /IsHostileCityHuntPlaza/);
        assert.match(escape, /ShouldForceCitySafeEnter/);
        assert.match(escape, /IsEscapeFieldWorld/);
        assert.match(escape, /TrySnapHostilePlazaToTown/);
        assert.match(escape, /ElvineHostilePlazaX = 149/);
        assert.match(escape, /ElvineHostilePlazaY = 131/);

        const server = fs.readFileSync(serverCsPath, 'utf8');
        assert.match(server, /TryResolveCitizenSafeEnter/);

        const gw = fs.readFileSync(gameWorldCsPath, 'utf8');
        assert.match(gw, /ForceCitizenOffHostilePlaza/);
        assert.match(gw, /TrySnapHostilePlazaToTown/);
    });

    it('smoke path: Restart! or garden east wall → HZ1 → Elvine plaza → Wizard Tower → Gandalf Fire Strike', () => {
        const hz1 = byId.get('huntzone1');
        const toCity = hz1?.teleportLocs?.find((t) => t.target.worldId === 'elvine');
        assert.ok(toCity, 'huntzone1 must still gate south to Elvine');
        assert.equal(toCity.target.loc.x, 223);
        assert.equal(toCity.target.loc.y, 23);

        const tower = byId.get('elvwzdtwr');
        assert.ok(tower?.npcs?.some((n: { npcId: number }) => n.npcId === 1), 'Gandalf catalog 1 in elvwzdtwr');

        const elvine = byId.get('elvine');
        const toTower = elvine?.teleportLocs?.find((t) => t.target.worldId === 'elvwzdtwr');
        assert.ok(toTower, 'elvine city must warp into Wizard Tower');
    });
});
