import type { PhaserSceneLike } from '../game/phaserHubTypes';
import type { HBMap } from '../game/assets/HBMap';
import { registryMapKey } from './mapCatalogLookup';

/**
 * Phaser-scene map registry. Kept out of RegistryUtils so the React hub never
 * value-imports HBMap (which value-imports Phaser).
 */
export function setMap(scene: PhaserSceneLike, mapKey: string, map: HBMap): void {
    scene.registry.set(registryMapKey(mapKey), map);
}

export function getMap(scene: PhaserSceneLike, mapName: string): HBMap {
    const mapKey = registryMapKey(mapName);
    const map = scene.registry.get(mapKey) as HBMap | undefined;
    if (!map) {
        throw Error(`Map not found in registry: ${mapKey}`);
    }
    return map;
}

export function getMapIfPresent(scene: PhaserSceneLike, mapName: string): HBMap | undefined {
    return scene.registry.get(registryMapKey(mapName)) as HBMap | undefined;
}
