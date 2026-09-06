/**
 * Phaser-free map id helpers. Server sends `elvine`; catalog files are `elvine.amd`;
 * the scene registry key is `map-elvine`.
 */

export function catalogAmdFileName(filename: string): string {
    const file = filename.replace(/^.*[/\\]/, '');
    return file.toLowerCase().endsWith('.amd') ? file : `${file}.amd`;
}

export function findMapByServerId<T extends { mapFile: string }>(
    filename: string,
    maps: readonly T[],
): T | undefined {
    const withAmd = catalogAmdFileName(filename);
    return maps.find((map) => map.mapFile.toLowerCase() === withAmd.toLowerCase());
}

export function registryMapKey(mapName: string): string {
    const base = mapName.replace(/^.*[/\\]/, '').replace(/\.amd$/i, '');
    return base.startsWith('map-') ? base : `map-${base}`;
}
