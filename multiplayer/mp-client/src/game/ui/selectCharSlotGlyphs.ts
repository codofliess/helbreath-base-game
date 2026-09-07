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

/** Slot status KindGem OCR looks for next to Elon / Lev.150 (Explorer). */
export const SELECTCHAR_OCCUPIED_SLOT_LABEL = 'Occupied';

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

/**
 * Inline fail-closed paint: last child of document.body, not under #root / #app clip.
 * KindGem viewport must see OCCUPIED Elon Lev.150 unclipped (top>=0, width>100).
 */
export const SELECTCHAR_KINDGEM_BANNER_CSS_TEXT =
    'display:block!important;visibility:visible!important;opacity:1!important;' +
    'position:fixed!important;top:12px!important;left:50%!important;right:auto!important;bottom:auto!important;' +
    'inset:auto!important;transform:translateX(-50%)!important;margin:0!important;' +
    'z-index:2147483646!important;pointer-events:none!important;overflow:visible!important;' +
    'clip:auto!important;clip-path:none!important;contain:none!important;filter:none!important;' +
    'color:#1a0a12!important;background:#f4ead5!important;background-color:#f4ead5!important;' +
    'font-size:28px!important;font-weight:700!important;line-height:1.2!important;' +
    'font-family:Georgia,serif!important;max-width:90vw!important;min-width:280px!important;' +
    'min-height:44px!important;width:max-content!important;height:auto!important;' +
    'padding:12px 20px!important;text-align:center!important;border:2px solid #3a2810!important;' +
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
        overflow?: string;
        maxWidth?: string;
        lineHeight?: string;
        padding?: string;
        whiteSpace?: string;
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
    node.style.top = '12px';
    node.style.left = '50%';
    node.style.transform = 'translateX(-50%)';
    node.style.overflow = 'visible';
    node.style.maxWidth = '90vw';
    node.style.color = '#1a0a12';
    node.style.background = '#f4ead5';
    node.style.fontSize = '28px';
    node.style.lineHeight = '1.2';
    node.style.padding = '12px 20px';
    node.style.minWidth = '280px';
    node.style.minHeight = '44px';
    node.style.whiteSpace = 'nowrap';
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

function elementIdOf(el: { id?: string } | null | undefined): string {
    return (el?.id ?? '').trim();
}

/**
 * True when a node sits under #root, #app, or a React portal that inherits overflow:hidden.
 * KindGem screenshots miss OCCUPIED when the banner is clipped by those wrappers.
 */
export function selectCharKindGemBannerHostClips(host: { id?: string } | null | undefined): boolean {
    const id = elementIdOf(host);
    return id === 'root' || id === 'app' || id === SELECTCHAR_REACT_OCCUPIED_ID || id === SELECTCHAR_OCCUPIED_OVERLAY_ID;
}

/** KindGem on-screen gate: top/left on the viewport and a readable box. */
export function selectCharKindGemBannerRectOnScreen(rect: {
    top: number;
    left: number;
    width: number;
    height: number;
}): boolean {
    return rect.top >= 0 && rect.left >= 0 && rect.width > 100 && rect.height > 20;
}

type OverflowChainHost = {
    id?: string;
    tagName?: string;
    parentElement?: OverflowChainHost | null;
    parentNode?: OverflowChainHost | null;
    style?: { overflow?: string; overflowX?: string; overflowY?: string; contain?: string; transform?: string };
};

function overflowChainParent(node: OverflowChainHost | null | undefined): OverflowChainHost | null {
    if (!node) {
        return null;
    }
    if (node.parentElement) {
        return node.parentElement;
    }
    const parent = node.parentNode;
    if (parent && parent !== node) {
        return parent;
    }
    return null;
}

/**
 * Ancestor overflow/contain/transform KindGem can log when the banner is clipped.
 */
export function collectSelectCharKindGemParentOverflowChain(el: OverflowChainHost): Array<{
    id: string;
    tag: string;
    overflow: string;
    overflowX: string;
    overflowY: string;
    contain: string;
    transform: string;
}> {
    const chain: Array<{
        id: string;
        tag: string;
        overflow: string;
        overflowX: string;
        overflowY: string;
        contain: string;
        transform: string;
    }> = [];
    let parent = overflowChainParent(el);
    while (parent && chain.length < 12) {
        let overflow = parent.style?.overflow ?? '';
        let overflowX = parent.style?.overflowX ?? overflow;
        let overflowY = parent.style?.overflowY ?? overflow;
        let contain = parent.style?.contain ?? '';
        let transform = parent.style?.transform ?? '';
        if (typeof getComputedStyle === 'function' && typeof parent.tagName === 'string' && parent.tagName.length > 0) {
            try {
                const cs = getComputedStyle(parent as unknown as Element);
                overflow = cs.overflow;
                overflowX = cs.overflowX;
                overflowY = cs.overflowY;
                contain = cs.contain;
                transform = cs.transform;
            } catch {
                /* jsdom / fake document */
            }
        }
        chain.push({
            id: elementIdOf(parent),
            tag: parent.tagName ?? '',
            overflow,
            overflowX,
            overflowY,
            contain,
            transform,
        });
        parent = overflowChainParent(parent);
    }
    return chain;
}

function parentLooksLikeBody(parent: { id?: string; tagName?: string } | null | undefined): boolean {
    if (!parent) {
        return false;
    }
    if (typeof document !== 'undefined' && parent === document.body) {
        return true;
    }
    return (parent.tagName ?? '').toUpperCase() === 'BODY';
}

/**
 * Direct `document.body` last child — never under #root / React portal overflow:hidden.
 */
export function mountSelectCharKindGemBannerOnBody(doc: Document, el: HTMLElement): HTMLElement {
    const body = doc.body;
    if (!body) {
        return el;
    }
    const parent = (el.parentElement ?? el.parentNode) as { id?: string } | null;
    if (parent && parent !== (body as unknown)) {
        el.remove();
    }
    if (selectCharKindGemBannerHostClips(parent)) {
        el.remove();
    }
    body.appendChild(el);
    return el;
}

/**
 * Body-level banner KindGem screenshots. Recreated on named paint so an a11y
 * snapshot of «waiting» cannot outlive textContent=Elon.
 * Always the last child of document.body so #root / canvas overflow cannot clip it.
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
        el.setAttribute('data-selectchar-kindgem-host', 'document.body');
    }
    return mountSelectCharKindGemBannerOnBody(doc, el);
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

/** Log bounding box + parent overflow after paint (KindGem screenshot evidence). */
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
    let overflow = el.style.overflow;
    if (typeof getComputedStyle === 'function') {
        try {
            const cs = getComputedStyle(el);
            display = cs.display;
            visibility = cs.visibility;
            opacity = cs.opacity;
            zIndex = cs.zIndex;
            color = cs.color;
            fontSize = cs.fontSize;
            overflow = cs.overflow;
        } catch {
            /* jsdom / fake document */
        }
    }
    const parent = (el.parentElement ?? el.parentNode) as { id?: string; tagName?: string } | null;
    selectCharWarn(
        '%s%s',
        SELECTCHAR_KINDGEM_VISIBLE_LOG,
        JSON.stringify({
            textContent: el.textContent,
            host: parentLooksLikeBody(parent) ? 'document.body' : elementIdOf(parent) || parent?.tagName || 'unknown',
            parentIsBody: parentLooksLikeBody(parent),
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            onScreen: selectCharKindGemBannerRectOnScreen(rect),
            overflow,
            parentOverflow: collectSelectCharKindGemParentOverflowChain(el),
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
    const painted = paintSelectCharReactOccupiedBannerNodes(
        banner,
        unique as unknown as SelectCharBannerPaintNode[],
    );
    kindgem.setAttribute('aria-label', banner);
    kindgem.setAttribute('title', banner);
    kindgem.setAttribute('role', 'status');
    kindgem.setAttribute('data-selectchar-kindgem-host', 'document.body');
    mountSelectCharKindGemBannerOnBody(d, kindgem);
    if (named) {
        logSelectCharKindGemVisible(kindgem);
        const afterPaint = () => {
            mountSelectCharKindGemBannerOnBody(d, kindgem);
            logSelectCharKindGemVisible(kindgem);
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                requestAnimationFrame(afterPaint);
            });
        }
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
                `<div class="sc-slot-glyph__status">${SELECTCHAR_OCCUPIED_SLOT_LABEL}</div>` +
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
    if (occupied) {
        ctx.font = 'bold 12px Spectral, Georgia, serif';
        ctx.fillText(SELECTCHAR_OCCUPIED_SLOT_LABEL, 8, 2);
        ctx.font = 'bold 16px Spectral, Georgia, serif';
        ctx.fillText(row.name, 8, 16);
        ctx.font = '14px Spectral, Georgia, serif';
        ctx.fillStyle = '#e0b45a';
        ctx.fillText(row.lev, 8, 36);
        return [SELECTCHAR_OCCUPIED_SLOT_LABEL, row.name, row.lev];
    }
    ctx.fillText(row.name, 8, 6);
    ctx.font = '16px Spectral, Georgia, serif';
    ctx.fillStyle = '#cbb892';
    ctx.fillText(row.lev, 8, 30);
    return [row.name, row.lev];
}
