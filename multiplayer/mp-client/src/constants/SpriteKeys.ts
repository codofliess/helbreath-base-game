/** Interface sheet texture keys for pointer / grab / combat cursors. */
export const CURSOR_POINTER = 'sprite-interface-0-0';
export const CURSOR_GRAB_1 = 'sprite-interface-0-1';
export const CURSOR_GRAB_2 = 'sprite-interface-0-2';
export const CURSOR_ATTACK = 'sprite-interface-0-3';
export const CURSOR_CASTING = 'sprite-interface-0-4';
export const CURSOR_CAST_READY = 'sprite-interface-0-5';

/** GameDialog2 sheet 6 — bottom icon panel (Helbreath Client.cpp DrawDialogBox_IconPannel) */
export const HUD_ICON_PANEL_BG = 'sprite-gamedialog2-6-14';
export const HUD_ICON_CHARACTER = 'sprite-gamedialog2-6-6';
export const HUD_ICON_INVENTORY = 'sprite-gamedialog2-6-7';
export const HUD_ICON_MAGIC = 'sprite-gamedialog2-6-8';
export const HUD_ICON_SKILLS = 'sprite-gamedialog2-6-9';
export const HUD_ICON_CHAT = 'sprite-gamedialog2-6-10';
export const HUD_ICON_SYSTEM = 'sprite-gamedialog2-6-11';
/** Olympia Crusade seal (IconPannel2 frame 2) — left of combat-mode recess while crusade is active. */
export const HUD_ICON_CRUSADE = 'sprite-gamedialog2-6-2';
/** F10 Tournament — cubic dock label (no dedicated retail F10 sprite; crusade uses frame 2). */
export const HUD_ICON_TOURNAMENT = HUD_ICON_CRUSADE;
/** Olympia Safe Attack overlay (IconPannel2 frame 4). */
export const HUD_ICON_SAFE_ATTACK = 'sprite-gamedialog2-6-4';
/** Olympia Attack/Combat overlay (IconPannel2 frame 5). */
export const HUD_ICON_COMBAT_MODE = 'sprite-gamedialog2-6-5';
/** Mob Specialty tiers: F5 → Statistics (plain F11 = Olympia dialog/minimap transparency). */
export const HUD_ICON_MOB_KILLS = 'sprite-gamedialog2-6-5';
/** Empty HP/MP gauge overlay (DrawDialogBox_GaugePannel frame 12). */
export const HUD_GAUGE_HP_MP = 'sprite-gamedialog2-6-12';
/** Empty SP gauge overlay (DrawDialogBox_GaugePannel frame 13). */
export const HUD_GAUGE_SP = 'sprite-gamedialog2-6-13';
/** Experience bar fill (DrawDialogBox_GaugePannel frame 18). */
export const HUD_GAUGE_EXP = 'sprite-gamedialog2-6-18';

/**
 * Character dialog (F5) — DialogText sheet 0 frame 0
 * (Client.cpp DrawDialogBox_Character → DEF_SPRID_INTERFACE_ND_TEXT; m_stDialogBoxInfo[1] = 270×376)
 */
export const CHARACTER_DIALOG_BG = 'sprite-dialogtext-0-0';

/**
 * Bag / inventory (F6) — GameDialog sheet 7 (= gamedialog2-7)
 * (Client.cpp DrawDialogBox_Inventory → DEF_SPRID_INTERFACE_ND_INVENTORY; m_stDialogBoxInfo[2] = 225×185)
 */
export const BAG_DIALOG_BG = 'sprite-gamedialog2-7-0';
export const BAG_TAB_LEFT = 'sprite-gamedialog2-7-1';
export const BAG_TAB_RIGHT = 'sprite-gamedialog2-7-2';
/** Config gear on bag corner — falls back to CSS icon if sprite missing */
export const BAG_CONFIG_ICON = 'sprite-gamedialog2-6-11';

/**
 * Dialog buttons — DialogText sheet 1 (DEF_SPRID_INTERFACE_ND_BUTTON).
 * Character footer frames: Quest 4/5, Party 44/45, LevelSet 10/11 (DrawDialogBox_Character ~33350).
 */
export const DIALOG_BTN_QUEST = 'sprite-dialogtext-1-4';
export const DIALOG_BTN_QUEST_HOVER = 'sprite-dialogtext-1-5';
export const DIALOG_BTN_PARTY = 'sprite-dialogtext-1-44';
export const DIALOG_BTN_PARTY_HOVER = 'sprite-dialogtext-1-45';
export const DIALOG_BTN_LEVELSET = 'sprite-dialogtext-1-10';
export const DIALOG_BTN_LEVELSET_HOVER = 'sprite-dialogtext-1-11';
export const DIALOG_BTN_YES = 'sprite-dialogtext-1-18';
export const DIALOG_BTN_YES_HOVER = 'sprite-dialogtext-1-19';
export const DIALOG_BTN_NO = 'sprite-dialogtext-1-2';
export const DIALOG_BTN_NO_HOVER = 'sprite-dialogtext-1-3';
export const DIALOG_BTN_OK = 'sprite-dialogtext-1-0';
export const DIALOG_BTN_OK_HOVER = 'sprite-dialogtext-1-1';

/** Death / resurrect dialog (Client.cpp DrawDialogBox_Resurect — 270×105) */
export const DEATH_DIALOG_BG = 'sprite-gamedialog2-0-2';

/** Magic book (F7 — ND_GAME1 frame 1 + ND_TEXT frame 7; m_stDialogBoxInfo[3] = 258×328) */
export const MAGIC_DIALOG_BG = 'sprite-gamedialog2-0-1';
export const MAGIC_DIALOG_TITLE = 'sprite-dialogtext-0-7';

/** Chat (F9 — Client.cpp DrawDialogBox_Chat — 364×162) */
export const CHAT_DIALOG_BG = 'sprite-gamedialog2-1-4';

/** Guild menu (ND_GAME2 frame 2 + ND_TEXT frame 19; m_stDialogBoxInfo[7] = 258×339) */
export const GUILD_DIALOG_BG = 'sprite-gamedialog2-1-2';
export const GUILD_DIALOG_TITLE = 'sprite-dialogtext-0-19';

/** Quest (ND_GAME2 frame 2 + ND_TEXT frame 4; m_stDialogBoxInfo[28] = 258×339) */
export const QUEST_DIALOG_BG = 'sprite-gamedialog2-1-2';
export const QUEST_DIALOG_TITLE = 'sprite-dialogtext-0-4';

/** Party (ND_GAME2 frame 0 + ND_TEXT frame 3; m_stDialogBoxInfo[32] = 258×339) */
export const PARTY_DIALOG_BG = 'sprite-gamedialog2-1-0';
export const PARTY_DIALOG_TITLE = 'sprite-dialogtext-0-3';

/** Level Set (ND_GAME2 frame 0 + ND_TEXT frame 2; m_stDialogBoxInfo[12] = 258×339) */
export const LEVELSET_DIALOG_BG = 'sprite-gamedialog2-1-0';
export const LEVELSET_DIALOG_TITLE = 'sprite-dialogtext-0-2';

/** Classic OK (ND_BUTTON frames 0/1 — Quest/LevelSet/Guild close) */
export const DIALOG_BTN_OK_CLASSIC = 'sprite-dialogtext-1-0';
export const DIALOG_BTN_OK_CLASSIC_HOVER = 'sprite-dialogtext-1-1';

/** Stats / Achievements subpanels — dedicated ND_TEXT titles (not Quest frame 4). */
export const STATISTICS_DIALOG_BG = 'sprite-gamedialog2-1-0';
export const STATISTICS_DIALOG_TITLE = 'sprite-dialogtext-0-8';
export const ACHIEVEMENTS_DIALOG_BG = 'sprite-gamedialog2-1-2';
export const ACHIEVEMENTS_DIALOG_TITLE = 'sprite-dialogtext-0-16';

/** Item Drops sibling panel (F6 tab) — ND_GAME2 frame stretched to OLYMPIA_DIALOG_SIZE.itemDrops. */
export const ITEM_DROPS_DIALOG_BG = 'sprite-gamedialog2-1-2';
export const ITEM_DROPS_DIALOG_TITLE = 'sprite-dialogtext-0-5';

/** Connect / character-select desk (GameDialog sheet 8 = ND_SELECTCHAR; full 800×600 frame) */
export const CONNECT_DIALOG_BG = 'sprite-gamedialog2-8-0';
/** Phaser texture key for ND_SELECTCHAR (sheet 8); use frame 0. */
export const SELECTCHAR_DESK_TEXTURE = 'sprite-gamedialog2-8';
export const SELECTCHAR_DESK_FRAME = 0;
/** Phaser texture key for ND_NEWCHAR (sheet 9); use frame 0. */
export const CREATECHAR_DESK_TEXTURE = 'sprite-gamedialog2-9';
export const CREATECHAR_DESK_FRAME = 0;
/** DialogText sheet 1 — SELECTCHAR title / action buttons / slot focus (ND_BUTTON). */
export const SELECTCHAR_BUTTON_TEXTURE = 'sprite-dialogtext-1';
export const SELECTCHAR_TITLE_FRAME = 50;
export const SELECTCHAR_BTN_START = 51;
export const SELECTCHAR_BTN_CREATE = 52;
export const SELECTCHAR_BTN_DELETE = 53;
export const SELECTCHAR_BTN_PASSWORD = 54;
export const SELECTCHAR_BTN_EXIT = 55;
export const SELECTCHAR_BTN_START_HOVER = 56;
export const SELECTCHAR_BTN_CREATE_HOVER = 57;
export const SELECTCHAR_BTN_DELETE_HOVER = 58;
export const SELECTCHAR_BTN_PASSWORD_HOVER = 59;
export const SELECTCHAR_BTN_EXIT_HOVER = 60;
export const SELECTCHAR_SLOT_FOCUS = 61;
export const SELECTCHAR_SLOT_FOCUS_ACTIVE = 62;
/** ND_BUTTON frames used on classic Create Character (Client.cpp _bDraw_OnCreateNewCharacter). */
export const CREATECHAR_BTN_CREATE = 24;
export const CREATECHAR_BTN_CREATE_HOVER = 25;
export const CREATECHAR_BTN_CANCEL = 16;
export const CREATECHAR_BTN_CANCEL_HOVER = 17;

/** Skill menu (F8 — ND_GAME2 frame 0 + ND_TEXT frame 1; m_stDialogBoxInfo[15] = 258×339) */
export const SKILL_DIALOG_BG = 'sprite-gamedialog2-1-0';
export const SKILL_DIALOG_TITLE = 'sprite-dialogtext-0-1';

/** System menu (F12 — ND_GAME1 frame 0 + ND_TEXT frame 6; m_stDialogBoxInfo[19] = 258×268) */
export const SYS_MENU_DIALOG_BG = 'sprite-gamedialog2-0-0';
export const SYS_MENU_DIALOG_TITLE = 'sprite-dialogtext-0-6';

/** Mob kills (F11 — ND_GAME2 frame 2; m_stDialogBoxInfo[48] = 258×339) */
export const MOB_KILLS_DIALOG_BG = 'sprite-gamedialog2-1-2';

/** Tournament / leaderboard dialog background (guild panel frame). */
export const TOURNAMENT_DIALOG_BG = 'sprite-gamedialog2-1-2';

/** Scroll thumb (ND_GAME2 frame 7) / volume knob (ND_GAME4 frame 8) */
export const DIALOG_SCROLL_THUMB = 'sprite-gamedialog2-1-7';
export const DIALOG_VOLUME_SLIDER = 'sprite-gamedialog2-3-8';
