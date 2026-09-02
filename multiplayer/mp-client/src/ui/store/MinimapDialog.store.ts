import { EventBus } from '../../game/EventBus';
import { createDialogStore } from './utils';
import { CachedMinimap } from '../../Types';
import { Minimap } from '../../constants/Assets';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { OUT_MAP_LOADED, OUT_UI_MINIMAP_CAPTURED, OUT_UI_MINIMAP_LOADING } from '../../constants/EventNames';

export interface MinimapLoadingPayload {
    minimap: Minimap;
    mapName: string;
    mapSizeX?: number;
    mapSizeY?: number;
}

interface PreGeneratedMinimapCache {
    minimapImage: string;
    minimapScale: number;
    minimapOriginalSize: number;
}

/** Cache for pre-generated minimaps by map base name (e.g. 'aresden') */
const preGeneratedMinimapCache = new Map<string, PreGeneratedMinimapCache>();

/** Max edge for decoded minimap bitmaps — full-res JPGs are a (hunch) second OOM during map load. */
const MINIMAP_DECODE_MAX_EDGE = 512;

let pendingPreGenerated: MinimapLoadingPayload | undefined;

interface MinimapDialogState {
    /** User's preference: whether they want the minimap open (persists across map changes) */
    isOpen: boolean;
    /** Whether the current map supports minimap (false when Minimap.NONE) */
    minimapAvailable: boolean;
    minimapImage: string | undefined;
    minimapScale: number;
    minimapOriginalSize: number;
}

const initialState: MinimapDialogState = {
    isOpen: true,
    minimapAvailable: true,
    minimapImage: undefined,
    minimapScale: 0,
    minimapOriginalSize: 0,
};

const { store: minimapDialogStore, setOpen: setMinimapDialogOpen } = createDialogStore(initialState);

export { minimapDialogStore, setMinimapDialogOpen };

export const toggleMinimapDialog = () => {
    minimapDialogStore.setState((state) => {
        if (!state.minimapAvailable) {
            return state;
        }
        return { ...state, isOpen: !state.isOpen };
    });
};

const clearImageData = (state: MinimapDialogState) => ({
    ...state,
    minimapImage: undefined,
    minimapScale: 0,
    minimapOriginalSize: 0,
});

async function decodeDownscaledMinimap(blob: Blob, mapSizeX: number): Promise<PreGeneratedMinimapCache> {
    const bitmap = await createImageBitmap(blob, {
        resizeWidth: MINIMAP_DECODE_MAX_EDGE,
        resizeHeight: MINIMAP_DECODE_MAX_EDGE,
        resizeQuality: 'low',
    });
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('no 2d context');
        }
        ctx.drawImage(bitmap, 0, 0);
        const objectUrl = canvas.toDataURL('image/jpeg', 0.7);
        const mapWidthPx = convertWorldPosToPixelPos(mapSizeX);
        const scale = mapWidthPx > 0 ? canvas.width / mapWidthPx : 1;
        return {
            minimapImage: objectUrl,
            minimapScale: scale,
            minimapOriginalSize: canvas.width,
        };
    } finally {
        bitmap.close();
    }
}

function applyPreGenerated(mapBaseName: string, payload: MinimapLoadingPayload): void {
    const cached = preGeneratedMinimapCache.get(mapBaseName);
    if (cached) {
        minimapDialogStore.setState((state) => ({
            ...state,
            minimapImage: cached.minimapImage,
            minimapScale: cached.minimapScale,
            minimapOriginalSize: cached.minimapOriginalSize,
        }));
        return;
    }
    if (payload.mapSizeX == null || payload.mapSizeY == null) {
        return;
    }
    const imageUrl = `./assets/images/minimaps/${mapBaseName}.jpg`;
    fetch(imageUrl)
        .then((res) => {
            if (!res.ok) {
                throw new Error(`Failed to fetch minimap: ${res.status}`);
            }
            return res.blob();
        })
        .then((blob) => decodeDownscaledMinimap(blob, payload.mapSizeX!))
        .then((cacheEntry) => {
            preGeneratedMinimapCache.set(mapBaseName, cacheEntry);
            minimapDialogStore.setState((state) => ({
                ...state,
                minimapImage: cacheEntry.minimapImage,
                minimapScale: cacheEntry.minimapScale,
                minimapOriginalSize: cacheEntry.minimapOriginalSize,
            }));
        })
        .catch((err) => {
            console.warn('[MinimapDialog] Failed to load pre-generated minimap:', err);
        });
}

EventBus.on(OUT_UI_MINIMAP_LOADING, (payload: MinimapLoadingPayload) => {
    pendingPreGenerated = undefined;
    if (payload.minimap === Minimap.NONE) {
        minimapDialogStore.setState((state) => ({
            ...clearImageData(state),
            minimapAvailable: false,
        }));
        return;
    }

    minimapDialogStore.setState((state) => ({ ...clearImageData(state), minimapAvailable: true }));

    if (payload.minimap === Minimap.PRE_GENERATED) {
        pendingPreGenerated = payload;
    }
});

EventBus.on(OUT_MAP_LOADED, () => {
    const payload = pendingPreGenerated;
    pendingPreGenerated = undefined;
    if (!payload || payload.minimap !== Minimap.PRE_GENERATED) {
        return;
    }
    applyPreGenerated(payload.mapName.replace('.amd', ''), payload);
});

EventBus.on(OUT_UI_MINIMAP_CAPTURED, (data: CachedMinimap) => {
    minimapDialogStore.setState((state) => ({
        ...state,
        minimapImage: data.dataUrl,
        minimapScale: data.scale,
        minimapOriginalSize: data.originalSize,
    }));
});
