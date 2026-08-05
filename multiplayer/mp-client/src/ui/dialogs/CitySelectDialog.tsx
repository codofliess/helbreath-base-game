import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { OlympiaSpriteButton } from '../components/OlympiaSpriteButton';
import {
    DIALOG_BTN_OK,
    DIALOG_BTN_OK_HOVER,
    LEVELSET_DIALOG_BG,
} from '../../constants/SpriteKeys';
import {
    citySelectDialogStore,
    markCityChosen,
    type CityFaction,
} from '../store/CitySelectDialog.store';
import { setCharacterStats } from '../store/CharacterDialog.store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CHANGE_MAP } from '../../constants/EventNames';
import type { IRefPhaserGame } from '../../PhaserGame';

interface CitySelectDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    phaserRef: React.RefObject<IRefPhaserGame | null>;
}

/**
 * Pre-citizenship city pick shown in traveler mode while standing in the Traveler Zone.
 * Warps via {@link IN_UI_CHANGE_MAP} so GameWorld restarts onto the city `.amd`
 * (raw WorldChangeRequest alone leaves traveler `default` rendered at city coords — water at (149,127)).
 */
export function CitySelectDialog({
    position,
    zIndex,
    onBringToFront,
}: CitySelectDialogProps) {
    const isOpen = useStore(citySelectDialogStore, (s) => s.isOpen);

    if (!isOpen) {
        return null;
    }

    const pickCity = (city: CityFaction) => {
        markCityChosen(city);
        setCharacterStats({ faction: city === 'aresden' ? 'Aresden' : 'Elvine' });
        EventBus.emit(IN_UI_CHANGE_MAP, city);
    };

    return (
        <OlympiaDialogShell
            id="city-select-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(ev) => ev.preventDefault()}
            width={280}
            minHeight={200}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="city-select-dialog-root"
        >
            <div className="city-select-dialog-content">
                <div className="olympia-dialog-title-bar city-select-dialog-title">Choose Your City</div>
                <p className="city-select-dialog-body">
                    You are a Traveller. Pick a city to become a citizen of Aresden or Elvine.
                </p>
                <div className="city-select-dialog-actions">
                    <div className="city-select-dialog-choice">
                        <span className="city-select-dialog-choice-label city-select-dialog-choice-label--aresden">
                            Aresden
                        </span>
                        <OlympiaSpriteButton
                            normalKey={DIALOG_BTN_OK}
                            hoverKey={DIALOG_BTN_OK_HOVER}
                            title="Join Aresden"
                            fallbackLabel="OK"
                            onClick={() => pickCity('aresden')}
                            className="city-select-dialog-btn"
                        />
                    </div>
                    <div className="city-select-dialog-choice">
                        <span className="city-select-dialog-choice-label city-select-dialog-choice-label--elvine">
                            Elvine
                        </span>
                        <OlympiaSpriteButton
                            normalKey={DIALOG_BTN_OK}
                            hoverKey={DIALOG_BTN_OK_HOVER}
                            title="Join Elvine"
                            fallbackLabel="OK"
                            onClick={() => pickCity('elvine')}
                            className="city-select-dialog-btn"
                        />
                    </div>
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
