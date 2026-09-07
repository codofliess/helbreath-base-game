import { useState } from 'react';
import { useStore } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_CREATECHAR_CANCEL, OUT_UI_CREATECHAR_CONFIRM } from '../../constants/EventNames';
import { connectDialogStore } from '../store/ConnectDialog.store';

/**
 * React Create Character. Phaser CreateCharDesk stays unloaded until Start.
 */
export function CreateCharReactPanel() {
    const slotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
    const [characterName, setCharacterName] = useState('');

    const confirm = () => {
        const name = characterName.trim();
        if (name.length < 2) {
            return;
        }
        EventBus.emit(OUT_UI_CREATECHAR_CONFIRM, {
            slotIndex,
            characterName: name,
            gender: 'male',
            skinColor: 'light',
            hairStyleIndex: 0,
            underwearColorIndex: 0,
            str: 14,
            vit: 12,
            dex: 12,
            int: 11,
            mag: 11,
            chr: 10,
        });
    };

    return (
        <div className="login-desk-gate" data-dialog-id="createchar-react-panel">
            <div className="login-desk-frame login-desk-frame--fallback">
                <div className="login-desk-brand">
                    <span className="login-desk-brand-kicker">Helbreath</span>
                    <span className="login-desk-brand-title">Create Character</span>
                </div>
                <div className="login-desk-form-slot">
                    <label className="login-gate-field">
                        <span>Name</span>
                        <input
                            className="olympia-input"
                            value={characterName}
                            onChange={(e) => setCharacterName(e.target.value)}
                            maxLength={10}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <div className="login-desk-actions">
                        <button
                            type="button"
                            className="login-gate-primary-btn"
                            disabled={characterName.trim().length < 2}
                            onClick={confirm}
                        >
                            Confirm
                        </button>
                        <button
                            type="button"
                            className="login-gate-secondary-btn"
                            onClick={() => EventBus.emit(OUT_UI_CREATECHAR_CANCEL)}
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
