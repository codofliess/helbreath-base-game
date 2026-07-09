import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

import { togglePlayerDialog } from './ui/store/PlayerDialog.store';
import { toggleInventoryDialog } from './ui/store/InventoryDialog.store';
import { openCastDialogOnCircle, prepareSelectedSpell, castDialogStore } from './ui/store/CastDialog.store';
import { toggleControlsDialog } from './ui/store/ControlsDialog.store';
import './ui/store/ItemDrops.store';

/** Helbreath Olympia F-key bindings (reference/Client.cpp + Olympia UI). */
const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!e.key) {
        return;
    }

    // Alt+F11 — dialog transparency (F11 itself is reserved for in-game use)
    if (e.altKey && e.key === 'F11') {
        e.preventDefault();
        document.body.classList.toggle('dialog-transparent');
        console.log('[Hotkey] Alt+F11 — Dialog transparency toggle');
        return;
    }

    if (e.key.startsWith('F') && e.key.length <= 3) {
        // F11: block browser fullscreen/minimize, let Phaser handle the key
        if (e.key === 'F11') {
            e.preventDefault();
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
                togglePlayerDialog();
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
                console.log('[Hotkey] F9 — Chat history (pending)');
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