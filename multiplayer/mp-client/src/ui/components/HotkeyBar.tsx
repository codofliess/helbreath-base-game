import { useEffect, useState, type RefObject } from 'react';
import { useStore } from '@tanstack/react-store';
import { characterDialogStore } from '../store/CharacterDialog.store';
import { progressionStore } from '../store/Progression.store';
import { cameraDialogStore } from '../store/CameraDialog.store';
import { controlsDialogStore } from '../store/ControlsDialog.store';
import { olympiaIconPanelHeightCss } from '../../constants/OlympiaUiScale';
import { toggleCharacterDialog } from '../store/CharacterDialog.store';
import { toggleInventoryDialog } from '../store/InventoryDialog.store';
import { toggleCastDialogOnCircle } from '../store/CastDialog.store';
import { toggleSkillDialog } from '../store/SkillDialog.store';
import { toggleSysMenuDialog } from '../store/SysMenuDialog.store';
import { openCashShopRemote } from '../store/CashShopDialog.store';
import { toggleChatDialog } from '../store/ChatDialog.store';
import { setTrainingDialogOpen } from '../store/TrainingDialog.store';
import {
    cycleCombatStance,
    getCombatModeLabel,
    playerDialogStore,
} from '../store/PlayerDialog.store';
import { crusadeHudStore, onCrusadeHudClick } from '../store/CrusadeHud.store';
import { shortCutStore, useShortCut, type ShortCutBinding } from '../store/ShortCut.store';
import { ITEMS } from '../../constants/Items';
import { getSpellById } from '../../constants/Spells';
import { formatOlympiaCompactAmount } from '../../utils/olympiaFormat';
import { toggleGameFullscreen } from '../../utils/fullscreenUtils';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SET_SUPER_ATTACK_ARMED, TOAST_REQUESTED } from '../../constants/EventNames';
import type { IRefPhaserGame } from '../../PhaserGame';
import { setQuickPotionGame, useQuickPotion } from '../../utils/potionHotkeys';

/** Map / Required Exp cartridge flip interval. */
const LOCATION_CARTRIDGE_INTERVAL_MS = 4_000;

type DockFKey = {
    id: string;
    keyLabel: string;
    title: string;
    shortLabel: string;
    onClick: () => void;
};

/**
 * Chain Lord dock F-keys (new skin only — no classic IconPannel seals).
 * F5–F9 classic dialogs; F10 = Academy / Training & Challenges (new).
 */
const DOCK_FKEYS: DockFKey[] = [
    {
        id: 'f5',
        keyLabel: 'F5',
        shortLabel: 'Char',
        title: 'Character (F5)',
        onClick: toggleCharacterDialog,
    },
    {
        id: 'f6',
        keyLabel: 'F6',
        shortLabel: 'Bag',
        title: 'Bag / Inventory (F6)',
        onClick: toggleInventoryDialog,
    },
    {
        id: 'f7',
        keyLabel: 'F7',
        shortLabel: 'Magic',
        title: 'Magic Book (F7)',
        onClick: () => toggleCastDialogOnCircle(1),
    },
    {
        id: 'f8',
        keyLabel: 'F8',
        shortLabel: 'Skill',
        title: 'Skills (F8)',
        onClick: toggleSkillDialog,
    },
    {
        id: 'f9',
        keyLabel: 'F9',
        shortLabel: 'Chat',
        title: 'Chat (F9)',
        onClick: toggleChatDialog,
    },
    {
        id: 'f10',
        keyLabel: 'F10',
        shortLabel: 'Academy',
        title: 'Academy — Training & Challenges (F10)',
        onClick: () => setTrainingDialogOpen(true, 'challenge'),
    },
];

const F_KEY_STRIP: Array<{ key: string; label: string; slot: 1 | 2 | 3 }> = [
    { key: 'F1', label: 'F1', slot: 1 },
    { key: 'F2', label: 'F2', slot: 2 },
    { key: 'F3', label: 'F3', slot: 3 },
];

function shortCutTitle(binding: ShortCutBinding | undefined, key: string): string {
    if (!binding) {
        return `${key}: empty — select spell/item, then Ctrl+${key}`;
    }
    if (binding.kind === 'spell') {
        const spell = getSpellById(binding.spellId);
        return `${key}: ${spell?.name.replace(/-/g, ' ') ?? `Spell ${binding.spellId}`} (Ctrl+${key} to rebind)`;
    }
    const item = ITEMS.find((i) => i.id === binding.itemId);
    return `${key}: ${item?.name ?? `Item ${binding.itemId}`} (Ctrl+${key} to rebind)`;
}

function shortCutLabel(binding: ShortCutBinding | undefined, fallback: string): string {
    if (!binding) {
        return fallback;
    }
    if (binding.kind === 'spell') {
        const spell = getSpellById(binding.spellId);
        const name = spell?.name.replace(/-/g, ' ') ?? 'Spell';
        return name.length > 9 ? `${name.slice(0, 8)}…` : name;
    }
    const item = ITEMS.find((i) => i.id === binding.itemId);
    const name = item?.name ?? 'Item';
    return name.length > 9 ? `${name.slice(0, 8)}…` : name;
}

function gaugeEmptyRatio(current: number, max: number): number {
    if (max <= 0) {
        return 1;
    }
    const filled = Math.max(0, Math.min(1, current / max));
    return 1 - filled;
}

function expProgressRatio(exp: number, expForCurrentLevel: number, expForNextLevel: number): number {
    const span = expForNextLevel - expForCurrentLevel;
    if (span <= 0) {
        return expForNextLevel > 0 ? Math.max(0, Math.min(1, exp / expForNextLevel)) : 0;
    }
    return Math.max(0, Math.min(1, (exp - expForCurrentLevel) / span));
}

function formatCompactExp(n: number): string {
    return formatOlympiaCompactAmount(n);
}

function resolveMapDisplayName(selectedMap: string, gameWorlds: Array<{ id: string; name: string }>): string {
    const world = gameWorlds.find((w) => w.id === selectedMap);
    if (world?.name?.trim()) {
        return world.name.trim();
    }
    if (!selectedMap) {
        return 'Unknown';
    }
    return selectedMap.replace(/\.amd$/i, '');
}

function LocationCartridge() {
    const playerPosition = useStore(cameraDialogStore, (s) => s.playerPosition);
    const selectedMap = useStore(controlsDialogStore, (s) => s.selectedMap);
    const gameWorlds = useStore(controlsDialogStore, (s) => s.gameWorlds);
    const progression = useStore(progressionStore, (s) => s);
    const [showRequiredExp, setShowRequiredExp] = useState(false);

    useEffect(() => {
        const id = window.setInterval(() => {
            setShowRequiredExp((prev) => !prev);
        }, LOCATION_CARTRIDGE_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, []);

    const mapName = resolveMapDisplayName(selectedMap, gameWorlds);
    const x = playerPosition.worldX;
    const y = playerPosition.worldY;
    const mapLabel =
        x !== undefined && y !== undefined ? `${mapName}(${x},${y})` : mapName;

    const remaining = Math.max(0, progression.expForNextLevel - progression.exp);
    const span = Math.max(0, progression.expForNextLevel - progression.expForCurrentLevel);
    const pctIntoLevel =
        span > 0
            ? Math.max(0, Math.min(100, ((progression.exp - progression.expForCurrentLevel) / span) * 100))
            : 0;
    const requiredLabel = `Required Exp: ${remaining} (${pctIntoLevel.toFixed(2)}%)`;
    const text = showRequiredExp ? requiredLabel : mapLabel;

    return (
        <div className="cl-dock-location" title={text} aria-label={text}>
            <span className="cl-dock-location-text">{text}</span>
        </div>
    );
}

/**
 * Vertical hunger bar (0–100). Server-driven Olympia hunger (food / Create Food meats).
 */
function HungerBar() {
    const hunger = useStore(characterDialogStore, (s) => s.stats.hunger);
    const hungerIsStub = useStore(characterDialogStore, (s) => s.stats.hungerIsStub);
    const pct = Math.max(0, Math.min(100, hunger));
    const title = hungerIsStub
        ? `Hunger ${pct}% (waiting for server…)`
        : `Hunger ${pct}%`;

    return (
        <div
            className={`cl-dock-hunger${hungerIsStub ? ' is-stub' : ''}${pct <= 20 ? ' is-low' : ''}`}
            title={title}
            aria-label={title}
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
        >
            <div className="cl-dock-hunger-track">
                <div className="cl-dock-hunger-fill" style={{ height: `${pct}%` }} />
            </div>
            <span className="cl-dock-hunger-tag">H</span>
        </div>
    );
}

/** HP / MP / SP / EXP + vertical hunger — CSS-only Chain Lord gauges. */
function StatusGauges() {
    const stats = useStore(characterDialogStore, (s) => s.stats);
    const progression = useStore(progressionStore, (s) => s);

    const hpFilled = 1 - gaugeEmptyRatio(stats.hp, stats.maxHp);
    const mpFilled = 1 - gaugeEmptyRatio(stats.mp, stats.maxMp);
    const spFilled = 1 - gaugeEmptyRatio(stats.sp, stats.maxSp);
    const expFilled = expProgressRatio(
        progression.exp,
        progression.expForCurrentLevel,
        progression.expForNextLevel,
    );
    const expIntoLevel = Math.max(0, progression.exp - progression.expForCurrentLevel);
    const expSpan = Math.max(0, progression.expForNextLevel - progression.expForCurrentLevel);
    const expPctLabel = `${Math.floor(expFilled * 100)}%`;
    const expTitle =
        expSpan > 0
            ? `EXP ${formatCompactExp(expIntoLevel)} / ${formatCompactExp(expSpan)} (${expPctLabel}) · Lv ${progression.level}`
            : `EXP ${formatCompactExp(progression.exp)} / ${formatCompactExp(progression.expForNextLevel)} · Lv ${progression.level}`;
    const hpLabel = stats.isPoisoned ? 'Poisoned' : `${stats.hp}/${stats.maxHp}`;

    return (
        <div
            className="cl-dock-gauges"
            data-tutorial-id="gauges"
            aria-label="Hunger, life, mana, stamina, and experience"
        >
            <HungerBar />
            <div className="cl-dock-gauges-main">
                <div className="cl-dock-gauge cl-dock-gauge--exp" title={expTitle}>
                    <div className="cl-dock-gauge-track">
                        <div className="cl-dock-gauge-fill cl-dock-gauge-fill--exp" style={{ width: `${expFilled * 100}%` }} />
                        <span className="cl-dock-gauge-value">{expPctLabel}</span>
                    </div>
                </div>
                <div className="cl-dock-gauge-stack">
                    <button
                        type="button"
                        className="cl-dock-gauge cl-dock-gauge--hp cl-dock-gauge--clickable"
                        title={
                            stats.isPoisoned
                                ? `Poisoned · HP ${stats.hp}/${stats.maxHp} — click: red pot`
                                : `HP ${stats.hp}/${stats.maxHp} — click: use 1 red pot`
                        }
                        onPointerDown={(e) => {
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useQuickPotion('red');
                        }}
                    >
                        <span className="cl-dock-gauge-tag">HP</span>
                        <div className="cl-dock-gauge-track">
                            <div className="cl-dock-gauge-fill cl-dock-gauge-fill--hp" style={{ width: `${hpFilled * 100}%` }} />
                            <span className={`cl-dock-gauge-value${stats.isPoisoned ? ' is-poisoned' : ''}`}>{hpLabel}</span>
                        </div>
                    </button>
                    <button
                        type="button"
                        className="cl-dock-gauge cl-dock-gauge--mp cl-dock-gauge--clickable"
                        title={`MP ${stats.mp}/${stats.maxMp} — click: use 1 blue pot`}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useQuickPotion('blue');
                        }}
                    >
                        <span className="cl-dock-gauge-tag">MP</span>
                        <div className="cl-dock-gauge-track">
                            <div className="cl-dock-gauge-fill cl-dock-gauge-fill--mp" style={{ width: `${mpFilled * 100}%` }} />
                            <span className="cl-dock-gauge-value">
                                {stats.mp}/{stats.maxMp}
                            </span>
                        </div>
                    </button>
                    <button
                        type="button"
                        className="cl-dock-gauge cl-dock-gauge--sp cl-dock-gauge--clickable"
                        title={`SP ${stats.sp}/${stats.maxSp} — click: use 1 green pot`}
                        onPointerDown={(e) => {
                            e.stopPropagation();
                        }}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            useQuickPotion('green');
                        }}
                    >
                        <span className="cl-dock-gauge-tag">SP</span>
                        <div className="cl-dock-gauge-track">
                            <div className="cl-dock-gauge-fill cl-dock-gauge-fill--sp" style={{ width: `${spFilled * 100}%` }} />
                            <span className="cl-dock-gauge-value">
                                {stats.sp}/{stats.maxSp}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

/** Reserved crusade slot — empty until crusade is active (no classic seal art). */
function CrusadeSlot() {
    const isActive = useStore(crusadeHudStore, (s) => s.isActive);
    const statusLabel = useStore(crusadeHudStore, (s) => s.statusLabel);
    const title = statusLabel ? `Crusade — ${statusLabel}` : 'Crusade (inactive)';

    return (
        <div className="cl-dock-crusade-slot" aria-hidden={!isActive} title={title}>
            {isActive ? (
                <button
                    type="button"
                    className="cl-dock-btn cl-dock-btn--crusade"
                    aria-label={title}
                    onClick={onCrusadeHudClick}
                >
                    <span className="cl-dock-btn-icon" aria-hidden>
                        ✠
                    </span>
                    <span className="cl-dock-btn-key">CR</span>
                </button>
            ) : (
                <div className="cl-dock-crusade-empty" aria-label="Crusade slot (empty)" />
            )}
        </div>
    );
}

/**
 * Peace / Attack / Safe — custom Chain Lord button (no classic IconPannel sprites).
 * Click cycles Peace → Attack → Safe → Peace. Tab toggles Peace/Attack.
 * Home is reserved for green (SP) potions (classic Helbreath).
 */
function CombatModeButton() {
    const attackMode = useStore(playerDialogStore, (s) => s.attackMode);
    const safeAttackMode = useStore(playerDialogStore, (s) => s.safeAttackMode);
    const saLeft = useStore(characterDialogStore, (s) => s.stats.superAttackLeft ?? 0);
    const saMax = useStore(characterDialogStore, (s) => Math.max(1, s.stats.maxSuperAttack ?? 1));
    const saArmed = useStore(characterDialogStore, (s) => s.stats.superAttackArmed ?? false);
    const mode: 'peace' | 'attack' | 'safe' = !attackMode
        ? 'peace'
        : safeAttackMode
          ? 'safe'
          : 'attack';
    const shortLabel = !attackMode ? 'Peace' : safeAttackMode ? 'Safe' : 'Attack';
    const fullLabel = !attackMode ? 'Peace Mode' : safeAttackMode ? 'Safe Mode' : 'Attack Mode';
    const glyph = mode === 'peace' ? '☮' : mode === 'safe' ? '🛡' : '⚔';

    const handleClick = () => {
        cycleCombatStance();
        EventBus.emit(TOAST_REQUESTED, {
            message: getCombatModeLabel(),
            severity: 'info',
            autoClose: 1200,
        });
    };

    /** Right-click / Shift+click: arm Super Attack (crit) without cycling stance. */
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (saLeft <= 0) {
            EventBus.emit(TOAST_REQUESTED, {
                message: 'No Super Attack charges yet.',
                severity: 'warning',
                autoClose: 1500,
            });
            return;
        }
        EventBus.emit(IN_UI_SET_SUPER_ATTACK_ARMED, { armed: !saArmed });
    };

    return (
        <button
            type="button"
            data-tutorial-id="combat-mode"
            className={`cl-dock-btn cl-dock-btn--mode cl-dock-btn--mode-${mode}${saArmed ? ' cl-dock-btn--sa-armed' : ''}`}
            title={`${fullLabel} — click: cycle · Right-click: Super Attack (crit) arm · Tab: Peace/Attack`}
            aria-label={`Combat mode: ${fullLabel}. Super Attack ${saLeft}/${saMax}${saArmed ? ' armed' : ''}`}
            onClick={(e) => {
                if (e.shiftKey) {
                    e.preventDefault();
                    handleContextMenu(e);
                    return;
                }
                handleClick();
            }}
            onContextMenu={handleContextMenu}
        >
            <span className="cl-dock-btn-icon cl-dock-btn-mode-icon" aria-hidden>
                {glyph}
            </span>
            <span className="cl-dock-btn-mode-text">
                <span className="cl-dock-btn-mode-title">{shortLabel}</span>
                <span className="cl-dock-btn-mode-sub">
                    {saArmed ? `CRIT ${saLeft}/${saMax}` : `SA ${saLeft}/${saMax}`}
                </span>
            </span>
        </button>
    );
}

/** Thin far-right strip — enter/exit browser fullscreen. */
function FullscreenDockButton({ phaserRef }: { phaserRef?: RefObject<IRefPhaserGame | null> }) {
    const isFullscreen = useStore(controlsDialogStore, (s) => s.isFullscreen);

    return (
        <button
            type="button"
            data-tutorial-id="fullscreen"
            className={`cl-dock-btn cl-dock-btn--fullscreen${isFullscreen ? ' is-active' : ''}`}
            title={isFullscreen ? 'Exit fullscreen (restore windowed size)' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            onClick={() => toggleGameFullscreen(phaserRef?.current?.game)}
        >
            <span className="cl-dock-btn-fullscreen-icon" aria-hidden>
                {isFullscreen ? '⧉' : '⛶'}
            </span>
        </button>
    );
}

/**
 * Chain Lord bottom dock — CSS-only skin (no classic IconPannel / seal sprites).
 * L→R: gauges · map/coords · crusade · mode · F5–F10 · F12 · fullscreen strip.
 */
export function HotkeyBar({ phaserRef }: { phaserRef?: RefObject<IRefPhaserGame | null> }) {
    const slots = useStore(shortCutStore, (s) => s.slots);
    const panelHeight = olympiaIconPanelHeightCss();

    // Compose bar is portaled to body — publish dock height on :root so bottom offset matches.
    useEffect(() => {
        const root = document.documentElement;
        root.style.setProperty('--hb-dock-height', panelHeight);
        return () => {
            root.style.removeProperty('--hb-dock-height');
        };
    }, [panelHeight]);

    // Live bag for gauge pot-clicks + Insert/Delete/Home (potionHotkeys).
    useEffect(() => {
        setQuickPotionGame(phaserRef?.current?.game ?? null);
        const id = window.setInterval(() => {
            setQuickPotionGame(phaserRef?.current?.game ?? null);
        }, 2000);
        return () => {
            window.clearInterval(id);
            setQuickPotionGame(null);
        };
    }, [phaserRef]);

    return (
        <div className="hotkey-bar-root cl-dock-root">
            <div className="cl-dock-panel" style={{ height: panelHeight }}>
                {/* Left: vitals */}
                <div className="cl-dock-zone cl-dock-zone--gauges">
                    <StatusGauges />
                </div>

                {/* Center: binds + map/coords */}
                <div className="cl-dock-zone cl-dock-zone--info">
                    <div className="cl-dock-binds" data-tutorial-id="binds" aria-label="Quick binds F1–F3">
                        {F_KEY_STRIP.map(({ key, label, slot }) => {
                            const binding = slots[slot];
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={`cl-dock-bind${binding ? ' is-bound' : ''}`}
                                    title={shortCutTitle(binding, key)}
                                    aria-label={shortCutTitle(binding, key)}
                                    onClick={() => useShortCut(slot)}
                                >
                                    <span className="cl-dock-bind-key">{label}</span>
                                    <span className="cl-dock-bind-val">{shortCutLabel(binding, '—')}</span>
                                </button>
                            );
                        })}
                    </div>
                    <LocationCartridge />
                </div>

                {/* Right: crusade · mode · F5–F10 · sys · fullscreen */}
                <div className="cl-dock-zone cl-dock-zone--actions" aria-label="Crusade, combat mode, and menu keys">
                    <CrusadeSlot />
                    <CombatModeButton />
                    <div className="cl-dock-fkeys" aria-label="F5–F10">
                        {DOCK_FKEYS.map((fk) => (
                            <button
                                key={fk.id}
                                type="button"
                                data-tutorial-id={fk.id}
                                className={`cl-dock-btn cl-dock-btn--fkey${fk.id === 'f10' ? ' cl-dock-btn--academy' : ''}`}
                                title={fk.title}
                                aria-label={fk.title}
                                onClick={fk.onClick}
                            >
                                <span className="cl-dock-btn-key">{fk.keyLabel}</span>
                                <span className="cl-dock-btn-label">{fk.shortLabel}</span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        data-tutorial-id="cash-shop"
                        className="cl-dock-btn cl-dock-btn--cash"
                        title="Cash Shop (USDT / $HELL)"
                        aria-label="Cash Shop"
                        onClick={openCashShopRemote}
                    >
                        <span className="cl-dock-btn-key">$</span>
                        <span className="cl-dock-btn-label">Cash</span>
                    </button>
                    <button
                        type="button"
                        data-tutorial-id="f12"
                        className="cl-dock-btn cl-dock-btn--sys"
                        title="System Menu (F12)"
                        aria-label="System Menu (F12)"
                        onClick={toggleSysMenuDialog}
                    >
                        <span className="cl-dock-btn-key">F12</span>
                        <span className="cl-dock-btn-label">Sys</span>
                    </button>
                    <FullscreenDockButton phaserRef={phaserRef} />
                </div>
            </div>
        </div>
    );
}

