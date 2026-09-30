/**
 * Drop the SELECTCHAR occupied banner once the player leaves character select.
 * The banner used to be the last child of document.body, so closing ConnectDialog
 * was the only removal — a late paint frame put it back over the world HUD.
 * This module stays free of the KindGem Elon string so the login entry chunk
 * can dismiss the node without pulling that copy into the hub bundle.
 */

export const SELECTCHAR_SCREEN_HOST_ATTR = 'data-selectchar-screen';
export const SELECTCHAR_SCREEN_HOST_SELECTOR = `[${SELECTCHAR_SCREEN_HOST_ATTR}="1"]`;

const KINDGEM_BANNER_ID = 'selectchar-kindgem-occupied-banner';
const BANNER_SELECTOR =
    '[data-selectchar-react-banner="1"], .selectchar-react-occupied__banner, #selectchar-kindgem-occupied-banner';
const OCCUPIED_ROOT_SELECTOR = '#selectchar-react-occupied, [data-selectchar-react-occupied="1"]';

let occupiedBannerEpoch = 0;

export function selectCharOccupiedBannerEpoch(): number {
    return occupiedBannerEpoch;
}

export function selectCharWorldHudIsActive(doc: Document): boolean {
    const body = doc.body as { classList?: { contains(token: string): boolean }; className?: unknown } | null;
    if (!body) {
        return false;
    }
    if (body.classList && typeof body.classList.contains === 'function') {
        if (body.classList.contains('game-world-active') || body.classList.contains('helbreath-game-active')) {
            return true;
        }
    }
    const name = typeof body.className === 'string' ? body.className : '';
    const tokens = name.split(/\s+/);
    return tokens.includes('game-world-active') || tokens.includes('helbreath-game-active');
}

/**
 * Remove the occupied banner and any body-level overlay that outlived character select.
 * Bumps the paint epoch so a KindGem frame scheduled on the desk cannot reattach it.
 */
export function dismissSelectCharOccupiedBannerForWorld(doc?: Document): void {
    occupiedBannerEpoch += 1;
    const d = doc ?? (typeof document === 'undefined' ? undefined : document);
    if (!d?.body) {
        return;
    }
    d.getElementById(KINDGEM_BANNER_ID)?.remove();
    d.querySelectorAll(BANNER_SELECTOR).forEach((el) => {
        el.remove();
    });
    const screen = d.querySelector(SELECTCHAR_SCREEN_HOST_SELECTOR);
    d.querySelectorAll(OCCUPIED_ROOT_SELECTOR).forEach((el) => {
        if (screen && (el === screen || screen.contains(el))) {
            return;
        }
        el.remove();
    });
    const style = d.documentElement?.style as { removeProperty?: (name: string) => void } | undefined;
    if (style && typeof style.removeProperty === 'function') {
        style.removeProperty('--explorer-title-clearance');
    }
}
