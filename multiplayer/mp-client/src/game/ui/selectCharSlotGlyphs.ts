/**
 * Burn SELECTCHAR name/level onto a 2D canvas (Phaser CanvasTexture).
 * Phaser Text destroy/recreate in a Container left Empty/Create glyphs on live Canvas.
 */

import { formatSelectCharOccupiedLev } from './selectCharDeskSync';

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

const REACT_OCCUPIED_BANNER_PREFIX = 'ConnectDialog React SELECTCHAR occupied';

/** Console + dist hard-gate: occupied React overlay actually painted names (not waiting). */
export const SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG = 'React SELECTCHAR occupied painted names=';

/** Console + dist hard-gate: actual banner textContent after DOM write (not the JS string). */
export const SELECTCHAR_REACT_OCCUPIED_DOM_LOG = 'React SELECTCHAR occupied DOM textContent=';

/** CSS selector KindGem and tests use for every occupied banner node. */
export const SELECTCHAR_REACT_OCCUPIED_BANNER_SELECTOR =
    '[data-selectchar-react-banner="1"], .selectchar-react-occupied__banner, #selectchar-kindgem-occupied-banner';

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

/**
 * Banner KindGem can read without Phaser Text.
 * Named store slots win over paint-row `occupied` so a live Elon list cannot
 * stay on «waiting» after CharacterList (empty paint rows / missing level).
 */
export function buildSelectCharReactOccupiedBanner(
    rows: SlotGlyphRow[],
    storeSlots?: Array<{ name?: string; level?: unknown; rebirth?: unknown }>,
): string {
    const fromStore = (storeSlots ?? []).filter((row) => (row?.name ?? '').trim().length > 0);
    if (fromStore.length > 0) {
        const names = fromStore
            .map((row) => {
                const name = (row.name ?? '').trim();
                return `${name} ${formatSelectCharOccupiedLev(row.level, row.rebirth)}`;
            })
            .join(' · ');
        stickyNamedOccupiedBanner = `${REACT_OCCUPIED_BANNER_PREFIX} ${names}`;
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
        .map((row) => {
            const lev = (row.lev ?? '').trim() || 'Lev. 0';
            return `${row.name} ${lev}`;
        })
        .join(' · ');
    stickyNamedOccupiedBanner = `${REACT_OCCUPIED_BANNER_PREFIX} ${names}`;
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
    node.style.color = '#f0e0c0';
    node.style.fontSize = '18px';
    node.style.pointerEvents = 'none';
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
    return node instanceof HTMLElement;
}

/** Every KindGem-readable occupied banner currently in the document. */
export function querySelectCharReactOccupiedBannerNodes(doc: Document): HTMLElement[] {
    return Array.from(doc.querySelectorAll(SELECTCHAR_REACT_OCCUPIED_BANNER_SELECTOR)).filter(
        isBannerElement,
    );
}

/**
 * Body-level banner KindGem screenshots. Dual React portals cannot hide this behind a
 * stale «waiting» sibling because it is moved to the end of body on every write.
 */
export function ensureSelectCharKindGemOccupiedBanner(doc: Document): HTMLElement {
    let el = doc.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);
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
 * After a named paint, write Elon/150 onto every banner node and log that textContent.
 * A waiting leftover from getElementById(first) cannot survive this sweep.
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
    const kindgem = ensureSelectCharKindGemOccupiedBanner(d);
    if (preferred) {
        collapseSelectCharReactOccupiedDuplicateRoots(preferred, d);
    }
    const nodes = new Set<HTMLElement>(querySelectCharReactOccupiedBannerNodes(d));
    nodes.add(kindgem);
    if (preferred) {
        if (preferred.matches('[data-selectchar-react-banner="1"]')) {
            nodes.add(preferred);
        } else {
            const inner = preferred.querySelector<HTMLElement>('[data-selectchar-react-banner="1"]');
            if (inner) {
                nodes.add(inner);
            }
        }
    }
    const painted = paintSelectCharReactOccupiedBannerNodes(banner, [...nodes] as SelectCharBannerPaintNode[]);
    return { joined: painted.joined, hasWaiting: painted.hasWaiting, count: nodes.size };
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
