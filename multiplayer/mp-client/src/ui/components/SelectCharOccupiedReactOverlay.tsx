import { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { selectCharWarn } from '../../utils/selectCharTrace';
import {
    namedOccupiedCharacterSlots,
    paintSelectCharSlotRows,
    resolveSelectCharSlotsForPaint,
} from '../../game/ui/selectCharDeskSync';
import {
    SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID,
    SELECTCHAR_KINDGEM_ELON_LV150_TEXT,
    SELECTCHAR_REACT_OCCUPIED_DOM_LOG,
    SELECTCHAR_REACT_OCCUPIED_ID,
    SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG,
    buildSelectCharReactOccupiedBanner,
    clearSelectCharReactOccupiedBannerSticky,
    syncSelectCharReactOccupiedBannerDom,
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
 * Named Elon paint recreates `#selectchar-kindgem-occupied-banner` as the last
 * child of `document.body` (not under #root / React overflow:hidden) so KindGem
 * can screenshot unclipped `OCCUPIED Elon Lev.150`.
 */
export function SelectCharOccupiedReactOverlay({
    zIndex,
    characterSlots,
    characterListLoading,
}: SelectCharOccupiedReactOverlayProps) {
    const rootRef = useRef<HTMLDivElement>(null);
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
        const root = rootRef.current;
        if (root) {
            document.body.appendChild(root);
        }
        const painted = syncSelectCharReactOccupiedBannerDom(banner, root);
        const kindgem = document.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID);
        if (kindgem) {
            document.body.appendChild(kindgem);
        }
        selectCharWarn('%s%s', SELECTCHAR_REACT_OCCUPIED_DOM_LOG, painted.joined || '(empty)');
        if (occupiedNames.includes('Elon') && banner !== SELECTCHAR_KINDGEM_ELON_LV150_TEXT) {
            selectCharWarn(
                'ConnectDialog React SELECTCHAR KindGem Elon string mismatch have=%s want=%s',
                banner,
                SELECTCHAR_KINDGEM_ELON_LV150_TEXT,
            );
        }
    }, [banner, loading, occupiedNames]);

    useLayoutEffect(() => {
        return () => {
            requestAnimationFrame(() => {
                if (document.querySelector('[data-selectchar-react-occupied="1"]')) {
                    return;
                }
                clearSelectCharReactOccupiedBannerSticky();
                document.getElementById(SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID)?.remove();
            });
        };
    }, []);

    return createPortal(
        <div
            ref={rootRef}
            id={SELECTCHAR_REACT_OCCUPIED_ID}
            className="selectchar-react-occupied"
            data-selectchar-react-occupied="1"
            data-occupied-count={occupied.length}
            data-occupied-names={occupiedNames}
            style={{ zIndex: Math.max(zIndex + 22, 2147483000) }}
            aria-hidden="true"
        >
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
