/**
 * Olympia dialog pixel sizes from classic `m_stDialogBoxInfo[*].sSizeX/Y`.
 *
 * Classic client ran at 800×600; 225×185 bag CSS px is illegible on 1080p+.
 * `OLYMPIA_UI_SCALE` upscales ALL Olympia dialogs (and bag pocket/items) for
 * readability while preserving classic aspect ratios.
 *
 * Chosen 1.5 → bag renders at 337.5×277.5 CSS px (225×185 × 1.5).
 * Sprite frames from gamedialog2 are typically native 225×185 (not upscaled
 * in the .spr); we stretch the bg to the scaled panel via background-size.
 *
 * | Index | Dialog | Base size |
 * |-------|--------|-----------|
 * | 1 | Character (F5) | 270×376 |
 * | 2 | Inventory/Bag (F6) | 225×185 |
 * | — | Item Drops (F6 tab) | 283×339 (258 + ~1cm) |
 * | 3 | Magic (F7) | 258×328 |
 * | 15 | Skill (F8) | 258×339 |
 * | 48 | MobKills (F11) | 258×339 |
 * | 19 | SysMenu (F12) | 258×268 |
 *
 * Bag window resize (`BAG_SCALE_LEVELS`) multiplies on top of this scale.
 */
export const OLYMPIA_UI_SCALE = 1.5;

/**
 * ~1cm at 96dpi ≈ 38 CSS px. Converted to classic base px via OLYMPIA_UI_SCALE
 * so Item Drops stays ~1cm wider on screen after scaling.
 */
export const ITEM_DROPS_WIDTH_EXTRA_CSS_PX = 38;

/**
 * ~5cm at 96dpi ≈ 189 CSS px — extra height so Item Drops detail (stats + art +
 * actions) fits without scrolling; only the drop list scrolls when full.
 */
export const ITEM_DROPS_HEIGHT_EXTRA_CSS_PX = Math.round((96 / 25.4) * 50);

/**
 * ~1mm at 96dpi ≈ 3.8 CSS px — F6 Bag / Item Drops tab strip inset from the
 * top edge of the dialog frame (rounded to 4px).
 */
export const BAG_TABS_TOP_INSET_CSS_PX = 4;

export const OLYMPIA_DIALOG_SIZE = {
    /** F12 height; +30% wider than F12 for paper-doll breathing room. */
    character: {
        w: Math.round(258 * 1.2 * 1.3),
        h: Math.round(360 * 1.2),
    },
    bag: { w: 225, h: 185 },
    /** Bag pocket for free-placed items (Client.cpp item draw at +32,+44; drop rand %148 / %55) */
    bagPocket: { w: 148, h: 120, padLeft: 32, padTop: 44 },
    magic: { w: 258, h: 328 },
    skill: { w: 258, h: 339 },
    /**
     * Item Drops (F6 sibling) — skill frame + ~1cm wider + ~5cm taller on screen.
     * Extra CSS px converted to classic base via OLYMPIA_UI_SCALE.
     */
    itemDrops: {
        w: 258 + Math.round(ITEM_DROPS_WIDTH_EXTRA_CSS_PX / OLYMPIA_UI_SCALE),
        h: 339 + Math.round(ITEM_DROPS_HEIGHT_EXTRA_CSS_PX / OLYMPIA_UI_SCALE),
    },
    mobKills: { w: 258, h: 339 },
    /** Classic 258×268 +20% for Chain Lord F12 (see SysMenuDialog). */
    sysMenu: { w: Math.round(258 * 1.2), h: Math.round(268 * 1.2) },
} as const;

/**
 * Bottom IconPannel (dialog 30) — GameDialog2 sheet 6 frame 14 sprite size.
 * Hit-zones use this sprite space so seals stay aligned when stretched full-bleed.
 *
 * Live Olympia (800×600 screenshots + SAVE HUD shots) draws the dock at **800×48**,
 * not the sprite’s 640×53 aspect — the art is slightly squashed vertically.
 * Traveler CSS height tracks that ratio, clamped so ultrawide RESIZE canvases do not
 * grow a towering dock (edge-to-edge monitors can be 2560+ CSS px wide).
 */
export const OLYMPIA_ICON_PANEL = { w: 640, h: 53 } as const;
/** On-screen IconPannel size measured on classic Olympia 800×600. */
export const OLYMPIA_ICON_PANEL_DISPLAY = { w: 800, h: 48 } as const;
/** Soft min/max CSS height for the traveler bottom dock on modern monitors. */
export const OLYMPIA_ICON_PANEL_HEIGHT_CLAMP = { min: 52, max: 80 } as const;

/**
 * Chain Lord dock height above Olympia baseline (96dpi CSS: 1mm ≈ 3.78px).
 * Base extras (+6mm) then ×1.2 for readability pass.
 */
export const CHAIN_LORD_DOCK_HEIGHT_EXTRA_MM = 6;
export const CHAIN_LORD_DOCK_HEIGHT_EXTRA_PX = Math.round((96 / 25.4) * CHAIN_LORD_DOCK_HEIGHT_EXTRA_MM);
/** Extra scale on top of Olympia ratio + mm extras (20% taller dock). */
export const CHAIN_LORD_DOCK_HEIGHT_SCALE = 1.2;

export function olympiaScaledPx(basePx: number): number {
    return Math.round(basePx * OLYMPIA_UI_SCALE);
}

/**
 * CSS height: Olympia 48/800 ratio + mm extras, then ×1.2, clamped for ultrawide.
 */
export function olympiaIconPanelHeightCss(): string {
    const { w, h } = OLYMPIA_ICON_PANEL_DISPLAY;
    const { min, max } = OLYMPIA_ICON_PANEL_HEIGHT_CLAMP;
    const extra = CHAIN_LORD_DOCK_HEIGHT_EXTRA_PX;
    const s = CHAIN_LORD_DOCK_HEIGHT_SCALE;
    const minH = Math.round((min + extra) * s);
    const maxH = Math.round((max + extra) * s);
    return `clamp(${minH}px, calc((var(--hb-canvas-width, ${w}px) * ${h} / ${w} + ${extra}px) * ${s}), ${maxH}px)`;
}
