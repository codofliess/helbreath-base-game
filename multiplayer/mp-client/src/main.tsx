import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import { toggleCharacterDialog, setCharacterDialogOpen, characterDialogStore } from './ui/store/CharacterDialog.store';
import { toggleInventoryDialog } from './ui/store/InventoryDialog.store';
import { isArenaSlimMode, wireArenaSlimModeListeners } from './ui/store/ArenaSlimMode.store';
import { openCastDialogOnCircle, toggleCastDialogOnCircle, prepareSelectedSpell, castDialogStore } from './ui/store/CastDialog.store';
import { installSkillDialogDevHooks, toggleSkillDialog } from './ui/store/SkillDialog.store';
import { toggleEnchantBagDialog } from './ui/store/EnchantBagDialog.store';
import {
    toggleSysMenuDialog,
    setGuideMapEnabled,
    toggleTransparencyEnabled,
    toggleSoundEnabled,
    toggleMusicEnabled,
    toggleRainSoundsEnabled,
    toggleWhisperEnabled,
    toggleShoutEnabled,
    cycleDetailLevel,
} from './ui/store/SysMenuDialog.store';
import { toggleTournamentDialog } from './ui/store/TournamentDialog.store';
import { setTrainingDialogOpen, toggleTrainingDialog, trainingDialogStore } from './ui/store/TrainingDialog.store';
import { toggleControlsDialog } from './ui/store/ControlsDialog.store';
import {
    toggleChatDialog,
    openChatCompose,
    closeChatCompose,
    chatDialogStore,
} from './ui/store/ChatDialog.store';
import { minimapDialogStore, toggleMinimapDialog } from './ui/store/MinimapDialog.store';
import { mapDialogStore, setDisplayGrid } from './ui/store/MapDialog.store';
import { bindShortCut, useShortCut, setRecentShortCut } from './ui/store/ShortCut.store';
import { toggleCombatMode, getCombatModeLabel } from './ui/store/PlayerDialog.store';
import {
    chatTranslationStore,
    setShowSpeakerLanguageTag,
} from './ui/store/ChatTranslation.store';
import { isTravelerPlayerMode } from './utils/playerMode';
import { installConnectDialogDevHooks } from './ui/store/ConnectDialog.store';
import { captureReferralFromUrl } from './utils/referral';
import { EventBus } from './game/EventBus';

// First-touch ?ref=CODE → localStorage for AuthenticateRequest.referral_code
captureReferralFromUrl();
// Arena slim: URL ?arena=1 + world-id detection (colosseum / fightzone*)
wireArenaSlimModeListeners();
import { IN_UI_FORCE_CANCEL_CAST, IN_UI_TAKE_SCREENSHOT, TOAST_REQUESTED } from './constants/EventNames';
import { getQuickPotionGame, useQuickPotion } from './utils/potionHotkeys';
import { bootstrapWalletDeepLinkAtBoot } from './utils/walletAuth';
import { getNetworkManager } from './utils/RegistryUtils';

import './ui/store/ItemDrops.store';
import './ui/store/BeginnerPath.store';
import './ui/store/Party.store';
import './ui/store/Progression.store';
import './ui/store/SystemLog.store';
import './ui/store/MinimapEntities.store';
import './utils/bagDropRouting';

// Landing Play Now: capture ?wallet=&token=&mode=world before any scene boots.
bootstrapWalletDeepLinkAtBoot();

installConnectDialogDevHooks();
installSkillDialogDevHooks();

const FUNCTION_KEY = /^F([1-9]|1[0-2])$/;

function isFunctionKeyEvent(e: KeyboardEvent): boolean {
    return FUNCTION_KEY.test(e.key) || /^F\d+$/.test(e.code);
}

function isGameActive(): boolean {
    return document.body.classList.contains('helbreath-game-active');
}

function isTypingTarget(active: Element | null): boolean {
    return (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
    );
}

function blockFunctionKey(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
}

function toastOption(message: string): void {
    EventBus.emit(TOAST_REQUESTED, {
        message,
        severity: 'info',
        autoClose: 1200,
    });
}

function isLetterCode(e: KeyboardEvent, code: string, letter: string): boolean {
    return e.code === code || e.key === letter || e.key === letter.toLowerCase() || e.key === letter.toUpperCase();
}

/**
 * SysMenu option shortcuts (shown left of On/Off in F12).
 * Only Ctrl + letter (no Alt) — e.g. Ctrl+D detail, Ctrl+M guide map.
 */
function handleSysMenuOptionShortcuts(e: KeyboardEvent): boolean {
    if (!isGameActive() || isTypingTarget(document.activeElement)) {
        return false;
    }
    // Pure Ctrl+key (no Alt / Shift / Meta)
    if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
        return false;
    }

    // Guide Map / minimap — Ctrl+M
    if (isLetterCode(e, 'KeyM', 'm')) {
        e.preventDefault();
        e.stopPropagation();
        toggleMinimapDialog();
        setGuideMapEnabled(minimapDialogStore.state.isOpen);
        return true;
    }

    // Transparency — Ctrl+W (also F11)
    if (isLetterCode(e, 'KeyW', 'w')) {
        e.preventDefault();
        e.stopPropagation();
        toggleTransparencyEnabled();
        toastOption('Transparency toggled');
        return true;
    }

    // Detail Level cycle — Ctrl+D
    if (isLetterCode(e, 'KeyD', 'd')) {
        e.preventDefault();
        e.stopPropagation();
        const level = cycleDetailLevel();
        const names = ['Low', 'Normal', 'High'] as const;
        toastOption(`Detail: ${names[level]}`);
        return true;
    }

    // Sound — Ctrl+S (screenshot remains Ctrl+Shift+S)
    if (isLetterCode(e, 'KeyS', 's')) {
        e.preventDefault();
        e.stopPropagation();
        const on = toggleSoundEnabled();
        toastOption(on ? 'Sound On' : 'Sound Off');
        return true;
    }

    // Music — Ctrl+U
    if (isLetterCode(e, 'KeyU', 'u')) {
        e.preventDefault();
        e.stopPropagation();
        const on = toggleMusicEnabled();
        toastOption(on ? 'Music On' : 'Music Off');
        return true;
    }

    // Rain sounds — Ctrl+R
    if (isLetterCode(e, 'KeyR', 'r')) {
        e.preventDefault();
        e.stopPropagation();
        const on = toggleRainSoundsEnabled();
        toastOption(on ? 'Rain sounds On' : 'Rain sounds Off');
        return true;
    }

    // Whisper — Ctrl+Q
    if (isLetterCode(e, 'KeyQ', 'q')) {
        e.preventDefault();
        e.stopPropagation();
        const on = toggleWhisperEnabled();
        toastOption(on ? 'Whisper On' : 'Whisper Off');
        return true;
    }

    // Shout — Ctrl+H
    if (isLetterCode(e, 'KeyH', 'h')) {
        e.preventDefault();
        e.stopPropagation();
        const on = toggleShoutEnabled();
        toastOption(on ? 'Shout On' : 'Shout Off');
        return true;
    }

    // Lang Tag — Ctrl+L
    if (isLetterCode(e, 'KeyL', 'l')) {
        e.preventDefault();
        e.stopPropagation();
        const next = !chatTranslationStore.state.showSpeakerLanguageTag;
        setShowSpeakerLanguageTag(next);
        toastOption(next ? 'Lang Tag On' : 'Lang Tag Off');
        return true;
    }

    // Show Grid — Ctrl+G (Olympia tile grid)
    if (isLetterCode(e, 'KeyG', 'g')) {
        e.preventDefault();
        e.stopPropagation();
        const next = !mapDialogStore.state.displayGrid;
        setDisplayGrid(next);
        toastOption(next ? 'Show Grid On' : 'Show Grid Off');
        return true;
    }

    // Enchanting Bag (shards / fragments) — Ctrl+E (Olympia parity)
    if (isLetterCode(e, 'KeyE', 'e')) {
        e.preventDefault();
        e.stopPropagation();
        toggleEnchantBagDialog();
        return true;
    }

    return false;
}

/** Helbreath Olympia F-key bindings (reference/Client.cpp + Olympia UI). */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!e.key && !e.code) {
        return;
    }

    // Olympia: F11 / Alt+F11 toggles dialog + guide-map translucency (m_bDialogTrans).
    if (e.altKey && (e.key === 'F11' || e.code === 'F11')) {
        e.preventDefault();
        if (isGameActive()) {
            toggleTransparencyEnabled();
        }
        return;
    }

    if (isGameActive() && e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'D' || e.code === 'KeyD')) {
        // GM tooling panel — disabled in traveler / real-player mode.
        if (isTravelerPlayerMode()) {
            return;
        }
        e.preventDefault();
        toggleControlsDialog();
        return;
    }

    // Browsers often swallow PrintScreen; Ctrl+Shift+S is the traveler fallback.
    if (isGameActive() && e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'S' || e.key === 's' || e.code === 'KeyS')) {
        e.preventDefault();
        EventBus.emit(IN_UI_TAKE_SCREENSHOT);
        return;
    }

    // SysMenu option shortcuts (Ctrl+M minimap, Ctrl+Alt+S sound, …) — before early F-key return.
    if (handleSysMenuOptionShortcuts(e)) {
        return;
    }

    if (!isFunctionKeyEvent(e)) {
        if (isGameActive() && e.ctrlKey && !e.altKey && !e.shiftKey) {
            const num = e.key === '0' ? 10 : parseInt(e.key, 10);
            if (num >= 1 && num <= 10) {
                e.preventDefault();
                openCastDialogOnCircle(num);
            }
        }
        if (isGameActive() && !isTypingTarget(document.activeElement) && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Escape: close chat compose, else cancel mid-cast (Olympia-style).
            if (e.key === 'Escape' || e.code === 'Escape') {
                if (chatDialogStore.state.composeOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeChatCompose();
                    return;
                }
                if (characterDialogStore.state.isOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    setCharacterDialogOpen(false);
                    return;
                }
                EventBus.emit(IN_UI_FORCE_CANCEL_CAST);
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (isLetterCode(e, 'KeyI', 'i') && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                toggleCharacterDialog();
                return;
            }
            // Olympia Enter-to-chat: open compose bar just above the bottom dock.
            if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
                e.preventDefault();
                e.stopPropagation();
                openChatCompose();
                return;
            }
            if (e.key === 'Tab' || e.code === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                toggleCombatMode();
                EventBus.emit(TOAST_REQUESTED, {
                    message: getCombatModeLabel(),
                    severity: 'info',
                    autoClose: 1200,
                });
                return;
            }
            // Classic Helbreath pots: Insert=HP, Delete=MP, Home=SP (small → big).
            // Also 1/2/3 for testers without Insert/Delete keys (Insk report).
            if (e.key === 'Insert' || e.code === 'Insert' || e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
                e.preventDefault();
                e.stopPropagation();
                useQuickPotion('red');
                return;
            }
            if (e.key === 'Delete' || e.code === 'Delete' || e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
                e.preventDefault();
                e.stopPropagation();
                useQuickPotion('blue');
                return;
            }
            if (e.key === 'Home' || e.code === 'Home' || e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
                e.preventDefault();
                e.stopPropagation();
                useQuickPotion('green');
                return;
            }
            // Olympia VK_PRIOR (Page Up): activate Merien / Xelima / Ice Sword special ability.
            if (e.key === 'PageUp' || e.code === 'PageUp') {
                e.preventDefault();
                e.stopPropagation();
                const game = getQuickPotionGame();
                if (game) {
                    getNetworkManager(game)?.requestActivateSpecialAbility();
                }
                return;
            }
        }
        return;
    }

    if (!isGameActive()) {
        return;
    }

    blockFunctionKey(e);

    if (isTypingTarget(document.activeElement)) {
        return;
    }

    switch (e.key) {
        case 'F1':
            if (e.ctrlKey) {
                bindShortCut(1);
            } else {
                useShortCut(1);
            }
            break;

        case 'F2':
            if (e.ctrlKey) {
                bindShortCut(2);
            } else {
                useShortCut(2);
            }
            break;

        case 'F3':
            if (e.ctrlKey) {
                bindShortCut(3);
            } else {
                useShortCut(3);
            }
            break;

        case 'F4': {
            const shortcutId = castDialogStore.state.selectedSpellId;
            setRecentShortCut({ kind: 'spell', spellId: shortcutId });
            prepareSelectedSpell();
            break;
        }

        case 'F5':
            // Arena slim: no paperdoll / character panel (saves CPU; bag handles equip).
            if (isArenaSlimMode()) {
                break;
            }
            toggleCharacterDialog();
            break;

        case 'F6':
            // Bag always available — critical for set/weapon swaps mid-duel.
            toggleInventoryDialog();
            break;

        case 'F7':
            // Magic circle still needed in duel.
            toggleCastDialogOnCircle(1);
            break;

        case 'F8':
            if (isArenaSlimMode()) {
                break;
            }
            toggleSkillDialog();
            break;

        case 'F9':
            // Slim: world log strip is enough; F9 full chat log stays available but optional.
            toggleChatDialog();
            break;

        case 'F10':
            if (isArenaSlimMode()) {
                break;
            }
            // Chain Lord: F10 = Academy / Training & Challenges; Shift+F10 = Tournaments.
            if (e.shiftKey) {
                toggleTournamentDialog();
            } else if (trainingDialogStore.state.isOpen) {
                toggleTrainingDialog();
            } else {
                setTrainingDialogOpen(true, 'challenge');
            }
            break;

        case 'F11':
            // Olympia F11: slight transparency for dialogs + minimap (still useful in slim).
            toggleTransparencyEnabled();
            break;

        case 'F12':
            if (isArenaSlimMode()) {
                break;
            }
            toggleSysMenuDialog();
            break;

        case 'PrintScreen':
            EventBus.emit(IN_UI_TAKE_SCREENSHOT);
            break;

        default:
            break;
    }
};

const handleGlobalKeyUp = (e: KeyboardEvent) => {
    if (isGameActive() && isFunctionKeyEvent(e)) {
        blockFunctionKey(e);
    }
};

document.addEventListener('keydown', handleGlobalKeyDown, true);
document.addEventListener('keyup', handleGlobalKeyUp, true);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
