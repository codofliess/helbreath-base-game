import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { playerHoverOverlayStore } from '../store/PlayerHoverOverlay.store';
import { OLYMPIA_UI_FONT } from '../../constants/OlympiaTypography';
import '../rpg-ui.css';

/**
 * Olympia {@code DrawObjectName} hover (Client.cpp ~29216):
 * - Anchor = character feet (sX, sY) — not far below the body
 * - Line 0 @ sY:     white name (+ ", Party Member" / " Berserk" / " Frozen")
 * - Line 1 @ sY+14:  gray guild "(Name Guildmaster|Guildsman)" if any
 * - Line 2 @ sY+14(+14): FOE-colored affiliation (Traveller / Aresden Civilian / … / Criminal)
 * PutString2 is left-aligned from sX (feet X ≈ body center). No panel, no skull row.
 */
export function PlayerHoverOverview() {
    const playerInfo = useStore(playerHoverOverlayStore, (state) => state.playerInfo);
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

    if (!playerInfo || !portalTarget) {
        return null;
    }

    const { r, g, b } = playerInfo.affiliationColor;
    /** Classic PutString2 face ~12px; next line at +14. */
    const lineStyle: CSSProperties = {
        fontFamily: OLYMPIA_UI_FONT,
        fontSize: '12px',
        fontWeight: 'bold',
        textShadow: '1px 1px 0 #000, 0 1px 0 #000, 1px 0 0 #000',
        whiteSpace: 'nowrap',
        lineHeight: '14px',
        height: '14px',
        pointerEvents: 'none',
        display: 'block',
    };

    const dialog = (
        <div
            className="player-hover-object-name"
            style={{
                position: 'fixed',
                left: `${playerInfo.overlayScreenX}px`,
                top: `${playerInfo.overlayScreenY}px`,
                // Classic PutString2 starts at sX (feet X); slight left bias so text sits under body.
                transform: 'translateX(-40%)',
                pointerEvents: 'none',
                zIndex: 20002,
                width: 'fit-content',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0,
                margin: 0,
                padding: 0,
            }}
        >
            <span style={{ ...lineStyle, color: 'rgb(255, 255, 255)' }}>{playerInfo.displayName}</span>
            {playerInfo.guildLine ? (
                <span style={{ ...lineStyle, color: 'rgb(180, 180, 180)' }}>{playerInfo.guildLine}</span>
            ) : null}
            <span style={{ ...lineStyle, color: `rgb(${r}, ${g}, ${b})` }}>{playerInfo.affiliation}</span>
        </div>
    );

    return createPortal(dialog, portalTarget);
}
