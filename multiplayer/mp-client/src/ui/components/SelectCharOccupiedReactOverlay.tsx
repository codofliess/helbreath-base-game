import { useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { selectCharWarn } from '../../utils/selectCharTrace';
import {
    namedOccupiedCharacterSlots,
    paintSelectCharSlotRows,
    resolveSelectCharSlotsForPaint,
} from '../../game/ui/selectCharDeskSync';
import {
    SELECTCHAR_LINE_NAME_Y,
    SELECTCHAR_SLOT_NAME_X,
    SELECTCHAR_SLOT_PITCH,
} from '../../game/ui/selectCharSlotLayout';
import {
    SELECTCHAR_REACT_OCCUPIED_ID,
    SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG,
    buildSelectCharReactOccupiedBanner,
    projectDeskPointToCss,
} from '../../game/ui/selectCharSlotGlyphs';
import { peekCachedOccupiedCharacterList, type CharacterSlotSummary } from '../../utils/characterListApi';
import { connectDialogStore } from '../store/ConnectDialog.store';

interface SelectCharOccupiedReactOverlayProps {
    zIndex: number;
    characterSlots: CharacterSlotSummary[];
    characterListLoading: boolean;
}

/**
 * KindGem-visible occupied SELECTCHAR labels from the live React store.
 * Subscribes to characterSlots itself so a late CharacterList cannot leave
 * the portal on «waiting» after ConnectDialog's first empty play-world paint.
 */
export function SelectCharOccupiedReactOverlay({
    zIndex,
    characterSlots,
    characterListLoading,
}: SelectCharOccupiedReactOverlayProps) {
    const storeSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const storeLoading = useStore(connectDialogStore, (s) => s.characterListLoading);
    const wallet = useStore(
        connectDialogStore,
        (s) => s.walletSession?.wallet?.trim() || '',
    );

    const liveSlots = useMemo(() => {
        const cached = wallet ? peekCachedOccupiedCharacterList(wallet)?.slots ?? [] : [];
        const storeNamed = namedOccupiedCharacterSlots(storeSlots);
        return namedOccupiedCharacterSlots(
            resolveSelectCharSlotsForPaint(
                storeNamed.length > 0 ? storeNamed : undefined,
                characterSlots,
                cached,
            ),
        );
    }, [characterSlots, storeSlots, wallet]);

    const loading = storeLoading || characterListLoading;
    const rows = paintSelectCharSlotRows(liveSlots);
    const banner = buildSelectCharReactOccupiedBanner(rows, liveSlots);
    const occupied = rows
        .map((row, slotIndex) => ({ row, slotIndex }))
        .filter((entry) => entry.row.occupied || (entry.row.name !== 'Empty' && entry.row.name.trim()));

    const occupiedNames = occupied.map((entry) => entry.row.name).join(',');

    useLayoutEffect(() => {
        selectCharWarn(
            'ConnectDialog React SELECTCHAR occupied names=%s loading=%s',
            occupiedNames || '(none)',
            loading,
        );
        selectCharWarn('%s%s', SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG, occupiedNames || '(none)');
        const root = document.getElementById(SELECTCHAR_REACT_OCCUPIED_ID);
        const bannerNode = root?.querySelector<HTMLElement>('[data-selectchar-react-banner="1"]');
        if (bannerNode) {
            bannerNode.textContent = banner;
        }
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
    }, [banner, loading, occupiedNames]);

    return createPortal(
        <div
            id={SELECTCHAR_REACT_OCCUPIED_ID}
            className="selectchar-react-occupied"
            data-selectchar-react-occupied="1"
            data-occupied-count={occupied.length}
            data-occupied-names={occupiedNames}
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
