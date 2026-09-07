/**
 * SELECTCHAR traces use `console.warn` so Chrome Default DevTools levels show them.
 * `console.info` is often hidden, which made live smoke look like Occupied/desk-sync
 * never ran even when those strings were in index-*.js.
 */
export function selectCharWarn(message: string, ...args: unknown[]): void {
    console.warn(`[SELECTCHAR] ${message}`, ...args);
}

/** Drop any leftover SW (none is registered by this client; HTML fallback /sw.js is not a worker). */
export function unregisterStaleServiceWorkers(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
    }
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (registrations.length === 0) {
            selectCharWarn('no service worker registrations');
            return;
        }
        for (const registration of registrations) {
            selectCharWarn('unregistering service worker %s', registration.scope);
            void registration.unregister();
        }
    });
}

/** Log which hashed entry the document actually loaded. */
export function announcePlayClientEntry(): void {
    const src =
        document.querySelector('script[src*="assets/index-"]')?.getAttribute('src') ??
        '(no index- script tag)';
    selectCharWarn('boot entry %s href=%s', src, window.location.href);
}
