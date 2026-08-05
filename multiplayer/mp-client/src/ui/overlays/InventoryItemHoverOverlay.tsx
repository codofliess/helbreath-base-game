import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { inventoryItemHoverOverlayStore } from '../store/InventoryItemHoverOverlay.store';

/**
 * Classic Olympia-style item hover: bare stacked text at the cursor
 * (name + magic stats + Item.cfg characteristics), matching Client PutString.
 */
export function InventoryItemHoverOverlay() {
    const hoverInfo = useStore(inventoryItemHoverOverlayStore, (state) => state.hoverInfo);
    const suppressOverlay = useStore(inventoryItemHoverOverlayStore, (state) => state.suppressOverlay);
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
        return () => {
            document.removeEventListener('fullscreenchange', updatePortalTarget);
        };
    }, []);

    if (!hoverInfo || !portalTarget || suppressOverlay) {
        return null;
    }

    const nameColor = hoverInfo.itemNameColor ?? '#FFFFFF';
    const opacity = hoverInfo.source === 'ground' ? 0.9 : 1;
    const detailLines = hoverInfo.detailLines?.length
        ? hoverInfo.detailLines
        : [hoverInfo.magicStatLine1, hoverInfo.magicStatLine2].filter((line): line is string => !!line);

    const overlay = (
        <div
            className="olympia-item-hover-tooltip"
            style={{
                left: `${hoverInfo.mouseX + 15}px`,
                top: `${hoverInfo.mouseY + 25}px`,
                opacity,
            }}
        >
            <div className="olympia-item-hover-name" style={{ color: nameColor }}>
                {hoverInfo.itemName}
            </div>
            {detailLines.map((line, index) => {
                const isMagicAttr =
                    line === hoverInfo.magicStatLine1
                    || line === hoverInfo.magicStatLine2
                    || (index < 2 && /(?:Damage|Resistance|Probability|Recovery|Absorption|Converting|Experience|Gold|Speed)[+-]/.test(line));
                return (
                    <div
                        key={`${index}-${line}`}
                        className={`olympia-item-hover-stat${isMagicAttr ? ' olympia-item-hover-stat--magic' : ''}`}
                    >
                        {line}
                    </div>
                );
            })}
            {hoverInfo.stackable && (hoverInfo.quantity ?? 1) > 1 ? (
                <div className="olympia-item-hover-stat">x{hoverInfo.quantity}</div>
            ) : null}
        </div>
    );

    return createPortal(overlay, portalTarget);
}
