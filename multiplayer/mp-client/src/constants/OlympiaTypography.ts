/**
 * Olympia / Helbreath classic typography — GDI PutString / PutAlignedString stand-in.
 *
 * Reference (`sp-client/reference/Client.cpp`):
 * - Dialog & SELECTCHAR dynamic text use `m_DDraw.TextOut` / `DrawText` (system sans),
 *   not web serifs. Sprite fonts live in `sprfonts.pak` (HUD nums / special titles).
 * - PutAlignedString line box is 15px tall → ~12px face.
 * - Dialog ink: RGB(45,25,25) / name RGB(45,20,20).
 * - SELECTCHAR slot stats: RGB(51,0,51).
 * - PutString2 chat / world overlays: black 3-direction outline + color.
 *
 * Hub marketing (Cinzel / Spectral) stays separate — see `.login-hub` in rpg-ui.css.
 */
export const OLYMPIA_UI_FONT =
    "Tahoma, 'MS Sans Serif', 'Segoe UI', sans-serif";

/** Phaser Text style string (same stack, no CSS quotes). */
export const OLYMPIA_PHASER_FONT = 'Tahoma, MS Sans Serif, Segoe UI, sans-serif';

/**
 * Dialog face size (pre `--olympia-ui-scale`).
 * Classic PutAlignedString was 12px / 15px line; traveler bumps two steps for 1080p+ F-dialogs.
 */
export const OLYMPIA_UI_FONT_SIZE_PX = 14;

/** Dialog line box height (classic PutAlignedString was iY .. iY+15). */
export const OLYMPIA_UI_LINE_HEIGHT_PX = 18;

/** Chat scroll rows use 13px vertical pitch (`sY + 127 - i*13`). */
export const OLYMPIA_CHAT_LINE_PITCH_PX = 13;

/** DrawDialogBox_Character PutAlignedString ink. */
export const OLYMPIA_INK = '#2d1919'; // RGB(45,25,25)
export const OLYMPIA_INK_NAME = '#2d1414'; // RGB(45,20,20)

/** SELECTCHAR slot name / level / exp (UpdateScreen_OnSelectCharacter). */
export const OLYMPIA_SELECTCHAR_INK = '#330033'; // RGB(51,0,51)

/** Item hover name / default bright overlay (PutString white). */
export const OLYMPIA_OVERLAY_WHITE = '#ffffff';
/** Item hover secondary lines RGB(150,150,150). */
export const OLYMPIA_OVERLAY_GRAY = '#969696';

/**
 * Chat channel colors — world map log (F9 closed) + F9 box.
 * User map: global orange, town blue, nearby white, guild green, whisper dark gray.
 */
export const OLYMPIA_CHAT_COLORS = {
    normal: '#ffffff', // nearby / local
    guild: '#40e040',
    party: '#ff82a0',
    whisper: '#5a5a5a', // dark gray (map log)
    yell: '#e6e682',
    trade: '#e6c040',
    town: '#5ab0ff', // own city
    nearby: '#ffffff',
    global: '#ff9a2e', // general orange
    systemBright: '#90ff90',
    systemMuted: '#9696aa',
} as const;

/**
 * World floating combat / spell announce palette (Olympia SAVE #20/#48/#107).
 * Yellow = damage you dealt; red = damage taken; green heal; spell colors by role.
 */
export const OLYMPIA_FLOATING_TEXT_COLORS = {
    damageDealt: '#ffe040',
    damageTaken: '#ff4040',
    heal: '#40ff40',
    spellOffensive: '#ff6868',
    spellBuff: '#68ff68',
    spellProtect: '#ff82c8',
    spellUtility: '#a0e0ff',
    castFailed: '#df5d2c',
} as const;

/**
 * Bottom-left system/combat log palette (Olympia SAVE screenshots #0/#3/#20).
 * Red damage, green heal, cyan tips, white events; gold for SP-style status.
 */
export const OLYMPIA_SYSTEM_LOG_COLORS = {
    damage: '#ff2020',
    heal: '#40ff40',
    tip: '#40e8ff',
    event: '#ffffff',
    warning: '#ff4040',
    statusGold: '#e6d4a0',
} as const;

/** Right-column quest/hunt tracker (Olympia #0/#3/#20). */
export const OLYMPIA_QUEST_TRACKER_COLORS = {
    title: '#ffb428',
    progress: '#40e8ff',
    completed: '#60ff40',
    completedGold: '#ffd700',
} as const;

/** Minimal Phaser Text style bag (avoids pulling Phaser types into constants). */
export type OlympiaPhaserTextStyle = {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    fontStyle?: string;
    stroke?: string;
    strokeThickness?: number;
    align?: string;
    wordWrap?: { width: number };
    lineSpacing?: number;
};

/** Phaser canvas text defaults matching PutString (no outline). */
export function olympiaPhaserTextStyle(
    overrides: OlympiaPhaserTextStyle = {},
): OlympiaPhaserTextStyle {
    return {
        fontFamily: OLYMPIA_PHASER_FONT,
        fontSize: `${OLYMPIA_UI_FONT_SIZE_PX}px`,
        color: OLYMPIA_INK,
        ...overrides,
    };
}

/** PutString2-style black outline for world/chat overlays. */
export function olympiaPhaserOutlinedTextStyle(
    color: string,
    overrides: OlympiaPhaserTextStyle = {},
): OlympiaPhaserTextStyle {
    return olympiaPhaserTextStyle({
        color,
        stroke: '#000000',
        strokeThickness: 2,
        ...overrides,
    });
}
