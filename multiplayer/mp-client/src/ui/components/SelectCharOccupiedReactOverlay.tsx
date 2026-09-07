import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { selectCharWarn } from '../../utils/selectCharTrace';
import { paintSelectCharSlotRows } from '../../game/ui/selectCharDeskSync';
import {
    SELECTCHAR_LINE_NAME_Y,
    SELECTCHAR_SLOT_NAME_X,
    SELECTCHAR_SLOT_PITCH,
} from '../../game/ui/selectCharSlotLayout';
import {
    SELECTCHAR_REACT_OCCUPIED_ID,
    buildSelectCharReactOccupiedBanner,
    projectDeskPointToCss,
} from '../../game/ui/selectCharSlotGlyphs';
import type { CharacterSlotSummary } from '../../utils/characterListApi';

interface SelectCharOccupiedReactOverlayProps {
    zIndex: number;
    characterSlots: CharacterSlotSummary[];
    characterListLoading: boolean;
}

/**
 * KindGem-visible occupied SELECTCHAR labels from the React store.
 * Mounts whenever ConnectDialog is in play-world — cannot silently no-op if Elon is in store.
 */
export function SelectCharOccupiedReactOverlay({
    zIndex,
    characterSlots,
    characterListLoading,
}: SelectCharOccupiedReactOverlayProps) {
    const rows = paintSelectCharSlotRows(characterSlots);
    const banner = buildSelectCharReactOccupiedBanner(rows);
    const occupied = rows
        .map((row, slotIndex) => ({ row, slotIndex }))
        .filter((entry) => entry.row.occupied);

    const occupiedNames = occupied.map((entry) => entry.row.name).join(',');

    useLayoutEffect(() => {
        selectCharWarn(
            'ConnectDialog React SELECTCHAR occupied names=%s loading=%s',
            occupiedNames || '(none)',
            characterListLoading,
        );
        const root = document.getElementById(SELECTCHAR_REACT_OCCUPIED_ID);
        const canvas = document.querySelector('#game-container canvas') as HTMLCanvasElement | null;
        const rect = canvas?.getBoundingClientRect();
        if (!root || !rect || rect.width < 2 || rect.height < 2) {
            return;
        }
        const gameW = 800;
        const gameH = 600;
        root.querySelectorAll<HTMLElement>('[data-react-slot]').forEach((node) => {
            const index = Number(node.dataset.reactSlot);
            const pos = projectDeskPointToCss(
                { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                gameW,
                gameH,
                SELECTCHAR_SLOT_NAME_X + index * SELECTCHAR_SLOT_PITCH,
                SELECTCHAR_LINE_NAME_Y,
            );
            node.style.left = `${Math.round(pos.left)}px`;
            node.style.top = `${Math.round(pos.top)}px`;
        });
    }, [banner, characterListLoading, occupiedNames]);

    return createPortal(
        <div
            id={SELECTCHAR_REACT_OCCUPIED_ID}
            className="selectchar-react-occupied"
            data-selectchar-react-occupied="1"
            data-occupied-count={occupied.length}
            style={{ zIndex: Math.max(zIndex + 22, 10040) }}
            aria-live="polite"
        >
            <div className="selectchar-react-occupied__banner" data-selectchar-react-banner="1">
                {banner}
            </div>
            {occupied.map(({ row, slotIndex }) => (
                <div
                    key={`${slotIndex}-${row.name}`}
                    className="selectchar-react-occupied__slot"
                    data-react-slot={slotIndex}
                    data-occupied="1"
                >
                    <div className="selectchar-react-occupied__name">{row.name}</div>
                    <div className="selectchar-react-occupied__lev">{row.lev}</div>
                </div>
            ))}
        </div>,
        document.body,
    );
}
