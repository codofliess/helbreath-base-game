/**
 * Phaser-free map id helpers. Server sends `elvine`; catalog files are `elvine.amd`;
 * the scene registry key is `map-elvine`.
 */

/** Bare map id: strips path, repeated `.amd`, and a `map-` prefix. */
export function mapBaseName(filename: string): string {
    let base = filename.replace(/^.*[/\\]/, '').trim();
    while (/\.amd$/i.test(base)) {
        base = base.slice(0, -4);
    }
    if (/^map-/i.test(base)) {
        base = base.slice(4);
    }
    return base;
}

export function catalogAmdFileName(filename: string): string {
    const base = mapBaseName(filename);
    return base ? `${base}.amd` : filename.replace(/^.*[/\\]/, '');
}

export function findMapByServerId<T extends { mapFile: string }>(
    filename: string,
    maps: readonly T[],
): T | undefined {
    const withAmd = catalogAmdFileName(filename);
    return maps.find((map) => map.mapFile.toLowerCase() === withAmd.toLowerCase());
}

export function registryMapKey(mapName: string): string {
    return `map-${mapBaseName(mapName)}`;
}
