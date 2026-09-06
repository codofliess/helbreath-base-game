import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    catalogAmdFileName,
    findMapByServerId,
    registryMapKey,
} from '../utils/mapCatalogLookup';

const CATALOG = [
    { mapName: 'Elvine', mapFile: 'elvine.amd' },
    { mapName: 'Aresden', mapFile: 'aresden.amd' },
];

describe('map catalog lookup (server id → .amd → registry)', () => {
    it('matches server elvine / aresden without requiring .amd', () => {
        assert.equal(catalogAmdFileName('elvine'), 'elvine.amd');
        assert.equal(findMapByServerId('elvine', CATALOG)?.mapFile, 'elvine.amd');
        assert.equal(findMapByServerId('elvine.amd', CATALOG)?.mapFile, 'elvine.amd');
        assert.equal(findMapByServerId('aresden', CATALOG)?.mapFile, 'aresden.amd');
    });

    it('uses one registry key for elvine, elvine.amd, and map-elvine', () => {
        assert.equal(registryMapKey('elvine'), 'map-elvine');
        assert.equal(registryMapKey('elvine.amd'), 'map-elvine');
        assert.equal(registryMapKey('map-elvine'), 'map-elvine');
    });
});
