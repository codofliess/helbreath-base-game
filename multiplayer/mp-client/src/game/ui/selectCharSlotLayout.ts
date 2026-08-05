/**
 * SELECTCHAR geometry — locked to classic Helbreath Client.cpp
 * `UpdateScreen_OnSelectCharacter(sX,sY,...)` with **sY forced to 10**.
 *
 * Source: reference/Client.cpp ~25688–25737
 *
 * Olympia 18.2 visual target (live capture olympia-charlist-ONLY.png):
 * - No top Log Out tab (classic draws ND_BUTTON frame 50; Olympia omits it)
 * - Card fields: Name / Lev. / Talents (not classic NAME / LEV / Exp bake alone)
 * - Help well = default START/DELETE copy only
 * - Email/wallet row under lower panel + Reveal
 *
 * Feet for DrawObject_OnMove_ForMenu:
 *   (157 + i*109, 10+138) = (157+i*109, 148)
 *
 * Focus frames (DialogText sheet 1):
 *   PutSpriteFast(110 + i*109 - 7, 63 - 9, frame 61|62)
 *
 * Hitboxes (mouse rects): Client.cpp ~19983–19992
 */

export const SELECTCHAR_SLOT_PITCH = 109;

/** Left edge of card field labels (Olympia "Name" / "Lev." / "Talents"). */
export const SELECTCHAR_SLOT_LABEL_X = 112;

/** Value column under / beside labels (classic PutString X for lev/exp). */
export const SELECTCHAR_SLOT_VALUE_X = 138;

/** PutString X for character name (classic). */
export const SELECTCHAR_SLOT_NAME_X = 112;

/**
 * Olympia card field lines (top-left origin). Slightly tighter than classic
 * NAME/LEV/Exp so labels + values fit the parchment bands.
 */
export const SELECTCHAR_LINE_NAME_Y = 168;
export const SELECTCHAR_LINE_LEV_Y = 184;
export const SELECTCHAR_LINE_TALENTS_Y = 200;
export const SELECTCHAR_LINE_TALENT1_Y = 214;
export const SELECTCHAR_LINE_TALENT2_Y = 226;

/** @deprecated classic exp line — kept for Arena desk compat */
export const SELECTCHAR_LINE_EXP_Y = SELECTCHAR_LINE_TALENTS_Y;

/** Face size — classic PutString ~ system sans ~11–12px on 800×600. */
export const SELECTCHAR_SLOT_FONT_SIZE = '11px';

export const SELECTCHAR_NAME_MAX_WIDTH = 96;

/**
 * Help well — PutAlignedString(98, 357, y, …) centers between 98 and 357.
 * Default block (1–3 chars) starts ~ y = 290 (275+15).
 */
export const SELECTCHAR_STATUS_X = 227; // (98+357)/2
export const SELECTCHAR_STATUS_Y = 290;
export const SELECTCHAR_STATUS_WRAP = 250;

/**
 * Wallet / email row under lower panel (Olympia: Email + **** + Reveal).
 * Desk-space coords inside 800×600 buffer.
 */
export const SELECTCHAR_WALLET_X = 100;
export const SELECTCHAR_WALLET_Y = 458;
export const SELECTCHAR_WALLET_REVEAL_X = 360;

/** Focus frame draw position (classic). */
export const SELECTCHAR_FOCUS_X = (i: number) => 110 + i * SELECTCHAR_SLOT_PITCH - 7;
export const SELECTCHAR_FOCUS_Y = 63 - 9; // 54

/** Menu character feet (classic sY=10). */
export const SELECTCHAR_PREVIEW_X = (i: number) => 157 + i * SELECTCHAR_SLOT_PITCH;
export const SELECTCHAR_PREVIEW_Y = 148;

/**
 * Classic Log Out tab region baked into / drawn over ND_SELECTCHAR top-left.
 * Cover must sample stone from the desk — never solid black.
 * Measured from crop-topleft-ours.png + live traveler captures (retry 2026-07-16).
 */
export const SELECTCHAR_LOGOUT_TAB_X = 0;
export const SELECTCHAR_LOGOUT_TAB_Y = 0;
/**
 * Classic Log Out tab only — must NOT clip the "Character List" leather title
 * (banner left edge ~x=250). Text of "Log Out" ends ~x=175–190.
 */
export const SELECTCHAR_LOGOUT_TAB_W = 198;
export const SELECTCHAR_LOGOUT_TAB_H = 30;
/**
 * Clean top-edge stone right of the title banner (same y band as tab).
 */
export const SELECTCHAR_LOGOUT_TAB_SRC_X = 580;
export const SELECTCHAR_LOGOUT_TAB_SRC_Y = 2;
