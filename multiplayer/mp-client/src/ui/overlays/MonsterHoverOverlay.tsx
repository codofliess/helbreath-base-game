import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { monsterHoverOverlayStore } from '../store/MonsterHoverOverlay.store';
import { MONSTER_OVERLAY_TRANSPARENCY } from '../../Config';
import { MonsterAllegiance } from '../../Types';
import { OLYMPIA_UI_FONT } from '../../constants/OlympiaTypography';
import '../rpg-ui.css';

/** Classic PartyStatus HP strip width (~75px in DrawNpcName). */
const TARGET_HP_BAR_WIDTH = 75;
const TARGET_HP_BAR_HEIGHT = 6;

/** Hostile targets use Olympia red name; others stay white like DrawNpcName. */
const NAME_COLOR_BY_ALLEGIANCE: Record<MonsterAllegiance, string> = {
    [MonsterAllegiance.Hostile]: 'rgb(255, 0, 0)',
    [MonsterAllegiance.Neutral]: 'rgb(255, 255, 255)',
    [MonsterAllegiance.Friendly]: 'rgb(255, 255, 255)',
};

/**
 * Olympia target / hover mob chrome: red name, optional `(Berserked)`, thin red HP bar.
 * No brown card — matches SAVE screenshots #53 / #70 (DrawNpcName + Centuu HP strip).
 */
export function MonsterHoverOverlay() {
    const monsterInfo = useStore(monsterHoverOverlayStore, (state) => state.monsterInfo);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement instanceof HTMLElement) {
                setPortalTarget(fullscreenElement);
            } else {
                setPortalTarget(document.body);
            }
        };

        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    if (!monsterInfo || !portalTarget) {
        return null;
    }

    const hpPercent = Math.max(0, Math.min(1, monsterInfo.maxHp > 0 ? monsterInfo.hp / monsterInfo.maxHp : 0));
    const displayName = monsterInfo.berserked ? `${monsterInfo.name} (Berserked)` : monsterInfo.name;

    const nameStyle: CSSProperties = {
        fontFamily: OLYMPIA_UI_FONT,
        fontSize: '12px',
        fontWeight: 'bold',
        color: NAME_COLOR_BY_ALLEGIANCE[monsterInfo.allegiance],
        textShadow: '1px 1px 0 rgba(0,0,0,0.9)',
        whiteSpace: 'nowrap',
        lineHeight: '14px',
        pointerEvents: 'none',
    };

    const dialog = (
        <div
            className="monster-target-overlay"
            style={{
                position: 'fixed',
                left: `${monsterInfo.overlayScreenX}px`,
                top: `${monsterInfo.overlayScreenY}px`,
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                zIndex: 20001,
                width: 'fit-content',
                minWidth: TARGET_HP_BAR_WIDTH,
                opacity: MONSTER_OVERLAY_TRANSPARENCY,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
            }}
        >
            <span style={nameStyle}>{displayName}</span>
            <div
                className="monster-target-hp-track"
                style={{
                    width: TARGET_HP_BAR_WIDTH,
                    height: TARGET_HP_BAR_HEIGHT,
                    background: 'rgba(40, 10, 10, 0.95)',
                    border: '1px solid rgba(80, 0, 0, 0.9)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                }}
            >
                <div
                    className="monster-target-hp-fill"
                    style={{
                        width: `${hpPercent * 100}%`,
                        height: '100%',
                        background: 'linear-gradient(180deg, #e02020 0%, #8b1010 100%)',
                        transition: 'width 0.12s ease-out',
                    }}
                />
            </div>
        </div>
    );

    return createPortal(dialog, portalTarget);
}
