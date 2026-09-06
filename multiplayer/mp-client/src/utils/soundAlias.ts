/**
 * Catalog sound keys that may not exist as files on older deploys.
 * Prefer committed `public/assets/sounds/magic.mp3`; fall back to shipped C5.
 */
export const SOUND_KEY_ALIASES: Readonly<Record<string, string>> = {
    magic: 'C5',
};

/** Maps a cache key or `*.mp3` name onto a real audio file (optional alias fallback). */
export function resolveSoundAsset(keyOrFile: string): {
    cacheKey: string;
    fileName: string;
    fallbackFileName?: string;
} {
    const raw = keyOrFile.replace(/\.mp3$/i, '');
    const aliased = SOUND_KEY_ALIASES[raw];
    if (aliased && aliased !== raw) {
        return { cacheKey: raw, fileName: `${raw}.mp3`, fallbackFileName: `${aliased}.mp3` };
    }
    return { cacheKey: raw, fileName: `${raw}.mp3` };
}
