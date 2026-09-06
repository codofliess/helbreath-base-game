/** Known `spriteFrameMap` prefixes — longest first so interface2 wins over interface. */
export const SPRITE_FRAME_PREFIXES = [
    'sprite-item-pack',
    'sprite-item-ground',
    'sprite-gamedialog2',
    'sprite-dialogtext',
    'sprite-interface2',
    'sprite-interface',
] as const;

export interface ParsedSpriteFrameKey {
    assetKey: string;
    sheetIndex: number;
    frameIndex: number;
    textureKey: string;
    tintHex?: string;
}

/** Parse `sprite-{pack}-{sheet}-{frame}[-{rrggbb}]`. */
export function parseSpriteFrameKey(key: string): ParsedSpriteFrameKey | undefined {
    for (const prefix of SPRITE_FRAME_PREFIXES) {
        if (!key.startsWith(`${prefix}-`)) {
            continue;
        }
        const rest = key.slice(prefix.length + 1);
        const parts = rest.split('-');
        if (parts.length < 2) {
            continue;
        }
        const sheetIndex = Number(parts[0]);
        const frameIndex = Number(parts[1]);
        if (!Number.isInteger(sheetIndex) || !Number.isInteger(frameIndex) || sheetIndex < 0 || frameIndex < 0) {
            continue;
        }
        let tintHex: string | undefined;
        if (parts.length >= 3) {
            const hex = parts[2].toLowerCase();
            if (!/^[0-9a-f]{6}$/.test(hex)) {
                continue;
            }
            tintHex = hex;
        }
        return {
            assetKey: prefix,
            sheetIndex,
            frameIndex,
            textureKey: `${prefix}-${sheetIndex}`,
            tintHex,
        };
    }
    return undefined;
}

export function uniqueSheetIndicesForAsset(keys: readonly string[], assetKey: string): number[] {
    const set = new Set<number>();
    for (const key of keys) {
        const parsed = parseSpriteFrameKey(key);
        if (parsed?.assetKey === assetKey) {
            set.add(parsed.sheetIndex);
        }
    }
    return [...set].sort((a, b) => a - b);
}

export function uniqueAssetKeys(keys: readonly string[]): string[] {
    const set = new Set<string>();
    for (const key of keys) {
        const parsed = parseSpriteFrameKey(key);
        if (parsed) {
            set.add(parsed.assetKey);
        }
    }
    return [...set];
}
