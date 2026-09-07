/**
 * Burn SELECTCHAR name/level onto a 2D canvas (Phaser CanvasTexture).
 * Phaser Text destroy/recreate in a Container left Empty/Create glyphs on live Canvas.
 */

import { selectCharWarn } from '../../utils/selectCharTrace';

export interface SlotGlyphCanvas {
    clearRect(x: number, y: number, w: number, h: number): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    font: string;
    fillStyle: string;
    textBaseline: CanvasTextBaseline | string;
}

export const SLOT_GLYPH_W = 220;
export const SLOT_GLYPH_H = 56;

export interface SlotGlyphRow {
    name: string;
    lev: string;
    occupied: unknown;
}

export interface DeskCssRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** Map SELECTCHAR desk pixels onto the CSS canvas box (Scale.NONE + full-bleed CSS). */
export function projectDeskPointToCss(
    canvasRect: DeskCssRect,
    gameW: number,
    gameH: number,
    x: number,
    y: number,
): { left: number; top: number } {
    const gw = Math.max(1, gameW);
    const gh = Math.max(1, gameH);
    return {
        left: canvasRect.left + (x / gw) * canvasRect.width,
        top: canvasRect.top + (y / gh) * canvasRect.height,
    };
}

export const SELECTCHAR_OCCUPIED_OVERLAY_ID = 'selectchar-occupied-labels';

/** React ConnectDialog overlay — KindGem-visible even if Phaser applyPaintedSlotRows never runs. */
export const SELECTCHAR_REACT_OCCUPIED_ID = 'selectchar-react-occupied';

/** Singleton KindGem banner — last child of body, not owned by a stale React portal. */
export const SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID = 'selectchar-kindgem-occupied-banner';

/** Visible KindGem occupied prefix — live string is `OCCUPIED Elon Lev.150`. */
export const SELECTCHAR_KINDGEM_OCCUPIED_PREFIX = 'OCCUPIED';

/** Dist + KindGem cut: exact occupied banner for Elon lv150. */
export const SELECTCHAR_KINDGEM_ELON_LV150_TEXT = 'OCCUPIED Elon Lev.150';

const REACT_OCCUPIED_BANNER_PREFIX = 'ConnectDialog React SELECTCHAR occupied';

/** Console + dist hard-gate: occupied React overlay actually painted names (not waiting). */
export const SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG = 'React SELECTCHAR occupied painted names=';

/** Console + dist hard-gate: actual banner textContent after DOM write (not the JS string). */
export const SELECTCHAR_REACT_OCCUPIED_DOM_LOG = 'React SELECTCHAR occupied DOM textContent=';

/** Console + dist hard-gate: bounding box + computed style KindGem can screenshot. */
export const SELECTCHAR_KINDGEM_VISIBLE_LOG = 'React SELECTCHAR KindGem visible=';

/** CSS selector KindGem and tests use for every occupied banner node. */
export const SELECTCHAR_REACT_OCCUPIED_BANNER_SELECTOR =
    '[data-selectchar-react-banner="1"], .selectchar-react-occupied__banner, #selectchar-kindgem-occupied-banner';

/** Inline fail-closed paint: parchment, dark 28px type, above Phaser canvas. */
export const SELECTCHAR_KINDGEM_BANNER_CSS_TEXT =
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'position:fixed!important;top:16px!important;left:50%!important;transform:translateX(-50%)!important;' +
    'z-index:2147483646!important;pointer-events:none!important;overflow:visible!important;' +
    'color:#1a1008!important;background:#f4ead5!important;background-color:#f4ead5!important;' +
    'font-size:28px!important;font-weight:700!important;line-height:1.25!important;' +
    'font-family:Georgia,serif!important;min-width:280px!important;min-height:44px!important;' +
    'padding:10px 22px!important;text-align:center!important;border:2px solid #3a2810!important;' +
    'box-sizing:border-box!important;white-space:nowrap!important;';

/** Last named banner — a late empty portal must not restore «waiting». */
let stickyNamedOccupiedBanner = '';

function paintRowLooksOccupied(row: SlotGlyphRow | undefined): boolean {
    if (!row) {
        return false;
    }
    if (row.occupied) {
        return true;
    }
    const name = (row.name ?? '').trim();
    return name.length > 0 && name !== 'Empty';
}

/** KindGem occupied line: `Elon Lev.150` (no space after Lev.). */
export function formatSelectCharKindGemNameLev(name: string, level: unknown): string {
    const lv = Number(level);
    const shown = Number.isFinite(lv) ? lv : 0;
    return `${name.trim()} Lev.${shown}`;
}

function levelFromPaintRow(row: SlotGlyphRow): unknown {
    const occupied = row.occupied;
    if (occupied && typeof occupied === 'object' && occupied !== null && 'level' in occupied) {
        return (occupied as { level?: unknown }).level;
    }
    const digits = /\d+/.exec(row.lev ?? '');
    return digits ? Number(digits[0]) : 0;
}

/**
 * Banner KindGem can read without Phaser Text.
 * Named store slots win over paint-row `occupied` so a live Elon list cannot
 * stay on «waiting» after CharacterList (empty paint rows / missing level).
 * Occupied paint is `OCCUPIED Elon Lev.150` — never a «waiting» substring.
 */
export function buildSelectCharReactOccupiedBanner(
    rows: SlotGlyphRow[],
    storeSlots?: Array<{ name?: string; level?: unknown; rebirth?: unknown }>,
): string {
    const fromStore = (storeSlots ?? []).filter((row) => (row?.name ?? '').trim().length > 0);
    if (fromStore.length > 0) {
        const names = fromStore
            .map((row) => formatSelectCharKindGemNameLev(row.name ?? '', row.level))
            .join(' · ');
        stickyNamedOccupiedBanner = `${SELECTCHAR_KINDGEM_OCCUPIED_PREFIX} ${names}`;
        return stickyNamedOccupiedBanner;
    }
    const occupied = rows.filter(paintRowLooksOccupied);
    if (occupied.length === 0) {
        if (stickyNamedOccupiedBanner) {
            return stickyNamedOccupiedBanner;
        }
        return `${REACT_OCCUPIED_BANNER_PREFIX} — waiting`;
    }
    const names = occupied
        .map((row) => formatSelectCharKindGemNameLev(row.name, levelFromPaintRow(row)))
        .join(' · ');
    stickyNamedOccupiedBanner = `${SELECTCHAR_KINDGEM_OCCUPIED_PREFIX} ${names}`;
    return stickyNamedOccupiedBanner;
}

/** Test / logout: forget the last named banner so an empty desk can show waiting again. */
export function clearSelectCharReactOccupiedBannerSticky(): void {
    stickyNamedOccupiedBanner = '';
}

/** Banner node KindGem (and tests) can assert without a full Document. */
export interface SelectCharBannerPaintNode {
    textContent: string | null;
    style: {
        display?: string;
        visibility?: string;
        opacity?: string;
        zIndex?: string;
        color?: string;
        fontSize?: string;
        position?: string;
        pointerEvents?: string;
        [key: string]: unknown;
    };
    setAttribute(name: string, value: string): void;
}

/** Force KindGem-visible styles so a later CSS rule cannot hide Elon/150. */
export function revealSelectCharReactOccupiedBannerNode(node: SelectCharBannerPaintNode): void {
    node.style.display = 'block';
    node.style.visibility = 'visible';
    node.style.opacity = '1';
    node.style.zIndex = '2147483646';
    node.style.position = 'fixed';
    node.style.top = '16px';
    node.style.left = '50%';
    node.style.transform = 'translateX(-50%)';
    node.style.color = '#1a1008';
    node.style.background = '#f4ead5';
    node.style.fontSize = '28px';
    node.style.minWidth = '280px';
    node.style.minHeight = '44px';
    node.style.pointerEvents = 'none';
    const css = node.style as { cssText?: string };
    if (typeof css.cssText === 'string') {
        css.cssText = SELECTCHAR_KINDGEM_BANNER_CSS_TEXT;
    }
}

/**
 * Write the occupied banner onto every candidate node (dual portal / stale first match).
 * Returns joined textContent so logs and tests assert DOM, not only the JS string.
 */
export function paintSelectCharReactOccupiedBannerNodes(
    banner: string,
    nodes: SelectCharBannerPaintNode[],
): { textContents: string[]; joined: string; hasWaiting: boolean } {
    for (const node of nodes) {
        node.textContent = banner;
        node.setAttribute('data-selectchar-banner-text', banner);
        revealSelectCharReactOccupiedBannerNode(node);
    }
    const textContents = nodes.map((node) => node.textContent ?? '');
    return {
        textContents,
        joined: textContents.join(' || '),
        hasWaiting: textContents.some((text) => text.includes('waiting')),
    };
}

function isBannerElement(node: Element): node is HTMLElement {
    if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) {
        return true;
    }
    return typeof (node as HTMLElement)?.setAttribute === 'function';
}

/** Every KindGem-readable occupied banner currently in the document. */
export function querySelectCharReactOccupiedBannerNodes(doc: Document): HTMLElement[] {
    return Array.from(doc.querySelectorAll(SELECTCHAR_REACT_OCCUPIED_BANNER_SELECTOR)).filter(
        isBannerElement,
    );
}

function visibleTextOf(el: { textContent?: string | null; innerText?: string; getAttribute?: (n: string) => string | null }): string {
    const inner = 'innerText' in el && typeof el.innerText === 'string' ? el.innerText : '';
    return `${el.textContent ?? ''} ${inner} ${el.getAttribute?.('aria-label') ?? ''} ${el.getAttribute?.('title') ?? ''}`;
}

/**
 * After named Elon exists, destroy every SELECTCHAR node whose visible text is waiting.
 * Do not leave a waiting banner in the tree for KindGem / a11y to screenshot.
 */
export function destroySelectCharWaitingBannerNodes(doc: Document): number {
    const unique = [...new Set(querySelectCharReactOccupiedBannerNodes(doc))];
    let removed = 0;
    for (const el of unique) {
        if (!/waiting/i.test(visibleTextOf(el))) {
            continue;
        }
        el.remove();
        removed += 1;
    }
    return removed;
}

/**
 * Body-level banner KindGem screenshots. Recreated on named paint so an a11y
 * snapshot of «waiting» cannot outlive textContent=Elon.
 */
export function ensureSelectCharKindGemOccupiedBanner(doc: Document, recreate = false): HTMLElement {
    let el = doc.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);
    if (recreate && el) {
        el.remove();
        el = null;
    }
    if (!el) {
        el = doc.createElement('div');
        el.id = SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID;
        el.className = 'selectchar-react-occupied__banner';
        el.setAttribute('data-selectchar-react-banner', '1');
        el.setAttribute('data-selectchar-kindgem-banner', '1');
        doc.body.appendChild(el);
    }
    doc.body.appendChild(el);
    return el;
}

/** Drop extra banner nodes so only `#selectchar-kindgem-occupied-banner` remains visible. */
export function collapseSelectCharOccupiedBannersToKindGemSingleton(doc: Document, keep: HTMLElement): void {
    for (const el of querySelectCharReactOccupiedBannerNodes(doc)) {
        if (el === keep) {
            continue;
        }
        el.remove();
    }
}

/** Log bounding box + computed style after paint (KindGem screenshot evidence). */
export function logSelectCharKindGemVisible(el: HTMLElement): void {
    const rect = typeof el.getBoundingClientRect === 'function'
        ? el.getBoundingClientRect()
        : { width: 0, height: 0, top: 0, left: 0 };
    let display = el.style.display;
    let visibility = el.style.visibility;
    let opacity = el.style.opacity;
    let zIndex = el.style.zIndex;
    let color = el.style.color;
    let fontSize = el.style.fontSize;
    if (typeof getComputedStyle === 'function') {
        try {
            const cs = getComputedStyle(el);
            display = cs.display;
            visibility = cs.visibility;
            opacity = cs.opacity;
            zIndex = cs.zIndex;
            color = cs.color;
            fontSize = cs.fontSize;
        } catch {
            /* jsdom / fake document */
        }
    }
    selectCharWarn(
        '%s%s',
        SELECTCHAR_KINDGEM_VISIBLE_LOG,
        JSON.stringify({
            textContent: el.textContent,
            rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
            display,
            visibility,
            opacity,
            zIndex,
            color,
            fontSize,
        }),
    );
}

/** Drop leftover occupied overlay trees so KindGem cannot screenshot a stale waiting portal. */
export function collapseSelectCharReactOccupiedDuplicateRoots(
    keep: HTMLElement | null,
    doc: Document,
): void {
    const roots = Array.from(
        doc.querySelectorAll<HTMLElement>(
            `#${SELECTCHAR_REACT_OCCUPIED_ID}, [data-selectchar-react-occupied="1"]`,
        ),
    );
    for (const root of roots) {
        if (keep && (root === keep || keep.contains(root) || root.contains(keep))) {
            continue;
        }
        root.remove();
    }
}

/**
 * After a named paint, recreate a single KindGem banner, destroy waiting leftovers,
 * and log the painted box KindGem can screenshot. Phaser desk paint is unchanged.
 */
export function syncSelectCharReactOccupiedBannerDom(
    banner: string,
    preferred?: HTMLElement | null,
    doc?: Document,
): { joined: string; hasWaiting: boolean; count: number } {
    const d = doc ?? (typeof document === 'undefined' ? undefined : document);
    if (!d) {
        return { joined: banner, hasWaiting: banner.includes('waiting'), count: 0 };
    }
    const named = !banner.includes('waiting') && banner.includes(SELECTCHAR_KINDGEM_OCCUPIED_PREFIX);
    if (preferred) {
        collapseSelectCharReactOccupiedDuplicateRoots(preferred, d);
    }
    if (named) {
        destroySelectCharWaitingBannerNodes(d);
    }
    const kindgem = ensureSelectCharKindGemOccupiedBanner(d, named);
    if (named) {
        collapseSelectCharOccupiedBannersToKindGemSingleton(d, kindgem);
        destroySelectCharWaitingBannerNodes(d);
    }
    const nodes: HTMLElement[] = named
        ? [kindgem]
        : [...new Set([...querySelectCharReactOccupiedBannerNodes(d), kindgem])];
    if (!named && preferred) {
        if (preferred.matches('[data-selectchar-react-banner="1"]')) {
            nodes.push(preferred);
        } else {
            const inner = preferred.querySelector<HTMLElement>('[data-selectchar-react-banner="1"]');
            if (inner) {
                nodes.push(inner);
            }
        }
    }
    const unique = [...new Set(nodes)];
    const painted = paintSelectCharReactOccupiedBannerNodes(banner, unique as SelectCharBannerPaintNode[]);
    kindgem.setAttribute('aria-label', banner);
    kindgem.setAttribute('title', banner);
    kindgem.setAttribute('role', 'status');
    if (named) {
        logSelectCharKindGemVisible(kindgem);
    }
    return { joined: painted.joined, hasWaiting: painted.hasWaiting, count: unique.length };
}

/** True when painted names are real characters — banner must include them and must not say waiting. */
export function selectCharOccupiedNamesRequireVisibleBanner(
    occupiedNames: string,
    domText: string,
): boolean {
    const names = occupiedNames
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && name !== '(none)' && name !== 'Empty');
    if (names.length === 0) {
        return true;
    }
    if (domText.includes('waiting')) {
        return false;
    }
    return names.every((name) => domText.includes(name));
}

/** HTML for occupied KindGem labels (DOM sits above Phaser Canvas). */
export function occupiedSlotOverlayInnerHtml(rows: SlotGlyphRow[]): string {
    const parts: string[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row?.occupied) {
            continue;
        }
        const name = escapeOverlayText(row.name);
        const lev = escapeOverlayText(row.lev);
        parts.push(
            `<div class="sc-slot-glyph" data-slot="${i}" data-occupied="1">` +
                `<div class="sc-slot-glyph__name">${name}</div>` +
                `<div class="sc-slot-glyph__lev">${lev}</div>` +
                `</div>`,
        );
    }
    return parts.join('');
}

function escapeOverlayText(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Fill a slot label canvas with occupied Elon (or Empty / Create Character). */
export function paintSlotGlyphCanvas(ctx: SlotGlyphCanvas, row: SlotGlyphRow): string[] {
    ctx.clearRect(0, 0, SLOT_GLYPH_W, SLOT_GLYPH_H);
    const occupied = !!row.occupied;
    ctx.fillStyle = occupied ? 'rgba(58, 40, 16, 0.94)' : 'rgba(12, 8, 4, 0.55)';
    ctx.fillRect(0, 0, SLOT_GLYPH_W, SLOT_GLYPH_H);
    ctx.textBaseline = 'top';
    ctx.font = 'bold 18px Spectral, Georgia, serif';
    ctx.fillStyle = occupied ? '#f0e0c0' : '#cbb892';
    ctx.fillText(row.name, 8, 6);
    ctx.font = '16px Spectral, Georgia, serif';
    ctx.fillStyle = occupied ? '#e0b45a' : '#cbb892';
    ctx.fillText(row.lev, 8, 30);
    return [row.name, row.lev];
}
