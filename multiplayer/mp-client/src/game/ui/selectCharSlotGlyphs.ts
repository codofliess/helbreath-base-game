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

const REACT_OCCUPIED_BANNER_PREFIX = 'ConnectDialog React SELECTCHAR occupied';

/** Console + dist hard-gate: occupied React overlay actually painted names (not waiting). */
export const SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG = 'React SELECTCHAR occupied painted names=';

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
        return `${REACT_OCCUPIED_BANNER_PREFIX} ${names}`;
    }
    const occupied = rows.filter(paintRowLooksOccupied);
    if (occupied.length === 0) {
        return `${REACT_OCCUPIED_BANNER_PREFIX} — waiting`;
    }
    const names = occupied
        .map((row) => {
            const lev = (row.lev ?? '').trim() || 'Lev. 0';
            return `${row.name} ${lev}`;
        })
        .join(' · ');
    return `${REACT_OCCUPIED_BANNER_PREFIX} ${names}`;
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
