/**
 * Isolates Phaser Game construction so a WebGL abort cannot take down React.
 * Chrome (GPU blocklist, remote desktop, `failIfMajorPerformanceCaveat`) throws
 * `Cannot create WebGL context, aborting` from Phaser's WebGLRenderer.
 */

export function startGameWithRendererFallback<T>(
    tryAuto: () => T,
    retryCanvas: () => T,
): T | null {
    try {
        return tryAuto();
    } catch (err) {
        console.warn('[StartGame] Phaser AUTO/WebGL failed, retrying Canvas 2D', err);
        try {
            return retryCanvas();
        } catch (err2) {
            console.error('[StartGame] Phaser Canvas fallback failed — React login hub still available', err2);
            return null;
        }
    }
}
