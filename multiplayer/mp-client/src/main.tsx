import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import { toggleCharacterDialog } from './ui/store/CharacterDialog.store';
import { toggleInventoryDialog } from './ui/store/InventoryDialog.store';
import { openCastDialogOnCircle, prepareSelectedSpell, castDialogStore } from './ui/store/CastDialog.store';
import { toggleControlsDialog } from './ui/store/ControlsDialog.store';
import { toggleChatDialog } from './ui/store/ChatDialog.store';
import './ui/store/ItemDrops.store';

/** Helbreath Olympia F-key bindings (reference/Client.cpp + Olympia UI). */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!e.key) {
        return;
    }

    if (e.altKey && e.key === 'F11') {
        e.preventDefault();
        document.body.classList.toggle('dialog-transparent');
        return;
    }

    if (e.key.startsWith('F') && e.key.length <= 3) {
        if (e.key === 'F11') {
            e.preventDefault();
            return;
        }

        const active = document.activeElement;
        if (
            active instanceof HTMLInputElement ||
            active instanceof HTMLTextAreaElement ||
            active instanceof HTMLSelectElement ||
            (active instanceof HTMLElement && active.isContentEditable)
        ) {
            return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();

        switch (e.key) {
            case 'F1':
                console.log('[Hotkey] F1 — Shortcut slot 1 (pending)');
                break;
            case 'F2':
                console.log('[Hotkey] F2 — Shortcut slot 2 (pending)');
                break;
            case 'F3':
                console.log('[Hotkey] F3 — Shortcut slot 3 (pending)');
                break;
            case 'F4': {
                const shortcutId = castDialogStore.state.selectedSpellId;
                prepareSelectedSpell();
                console.log(`[Hotkey] F4 — Quick cast spell ${shortcutId}`);
                break;
            }
            case 'F5':
                toggleCharacterDialog();
                break;
            case 'F6':
                toggleInventoryDialog();
                break;
            case 'F7':
                openCastDialogOnCircle(1);
                break;
            case 'F8':
                toggleControlsDialog();
                break;
            case 'F9':
                toggleChatDialog();
                break;
            case 'F10':
                console.log('[Hotkey] F10 — (reserved)');
                break;
            case 'F12':
                toggleControlsDialog();
                break;
            default:
                break;
        }
        return;
    }

    if (e.ctrlKey && !e.altKey && !e.shiftKey) {
        const num = e.key === '0' ? 10 : parseInt(e.key, 10);
        if (num >= 1 && num <= 10) {
            e.preventDefault();
            openCastDialogOnCircle(num);
        }
    }
};

document.addEventListener('keydown', handleGlobalKeyDown, true);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);