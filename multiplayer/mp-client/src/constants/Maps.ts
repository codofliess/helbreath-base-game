import { getMapAssets, Minimap } from './Assets';

/** Display name, `.amd` filename, and minimap policy for one map. */
export interface MapData {
    mapName: string;
    mapFile: string;
    minimap?: Minimap;
}

/** Builds map list from `ASSETS` map rows. */
export function getMapNames(): MapData[] {
    return getMapAssets().map(asset => ({
        mapName: asset.mapName || asset.fileName.replace('.amd', ''),
        mapFile: asset.fileName,
        minimap: asset.minimap ?? Minimap.ON_DEMAND_GENERATED,
    }));
}

/** Looks up `MapData` by map id or `.amd` filename (server sends `elvine`, catalog is `elvine.amd`). */
export function getMapData(filename: string): MapData | undefined {
    const file = filename.replace(/^.*[/\\]/, '');
    const withAmd = file.toLowerCase().endsWith('.amd') ? file : `${file}.amd`;
    return getMapNames().find((map) => map.mapFile.toLowerCase() === withAmd.toLowerCase());
}

/** Map picker options: sorted by display label. */
export function getAllMapOptions(): Array<{ label: string; value: string }> {
    return getMapNames()
        .map(map => ({ label: map.mapName, value: map.mapFile }))
        .sort((a, b) => a.label.localeCompare(b.label));
}
