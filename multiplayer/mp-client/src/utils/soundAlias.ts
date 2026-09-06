/**
 * Catalog sound keys that are not shipped as files.
 * `consumptionSound: "magic"` used to fetch `/assets/sounds/magic.mp3` (404) during LoadingScreen.
 */
export const SOUND_KEY_ALIASES: Readonly<Record<string, string>> = {
    magic: 'C5',
};

/** Maps a cache key or `*.mp3` name onto a real audio file (aliases first). */
export function resolveSoundAsset(keyOrFile: string): { cacheKey: string; fileName: string } {
    const raw = keyOrFile.replace(/\.mp3$/i, '');
    const aliased = SOUND_KEY_ALIASES[raw];
    const cacheKey = aliased ?? raw;
    return { cacheKey, fileName: `${cacheKey}.mp3` };
}
