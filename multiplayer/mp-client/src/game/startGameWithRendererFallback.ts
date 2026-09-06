/**
 * Isolates Phaser Game construction so a renderer abort cannot take down React.
 * Phaser throws `Cannot create WebGL context, aborting` when type is WEBGL and
 * `Features.webGL` is false — call Canvas first so login never takes that path.
 */
export function startGameWithRendererFallback<T>(
    tryPrimary: () => T,
    retrySecondary: () => T,
): T | null {
    try {
        return tryPrimary();
    } catch (err) {
        console.warn('[StartGame] Primary renderer failed, retrying fallback', err);
        try {
            return retrySecondary();
        } catch (err2) {
            console.error('[StartGame] All Phaser renderers failed — React login hub still available', err2);
            return null;
        }
    }
}
