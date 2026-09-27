import { useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { selectCharWarn } from '../../utils/selectCharTrace';
import {
    namedOccupiedCharacterSlots,
    paintSelectCharSlotRows,
    resolveSelectCharSelectedIndex,
    resolveSelectCharSlotsForPaint,
} from '../../game/ui/selectCharDeskSync';
import {
    SELECTCHAR_KINDGEM_OCCUPIED_BANNER_ID,
    SELECTCHAR_KINDGEM_ELON_LV150_TEXT,
    SELECTCHAR_OCCUPIED_SLOT_LABEL,
    SELECTCHAR_REACT_OCCUPIED_DOM_LOG,
    SELECTCHAR_REACT_OCCUPIED_ID,
    SELECTCHAR_REACT_OCCUPIED_PAINTED_LOG,
    buildSelectCharReactOccupiedBanner,
    clearSelectCharReactOccupiedBannerSticky,
    selectCharOccupiedNamesRequireVisibleBanner,
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
 * KindGem-visible occupied SELECTCHAR banner from the live React store.
 * Named paint recreates `#selectchar-kindgem-occupied-banner` as the last
 * child of `document.body` (not under #root / React overflow:hidden) so KindGem
 * can screenshot unclipped `OCCUPIED Elon Lev.150`.
 *
 * Slot cards are not painted here. Absolute chips (`data-react-slot`) stacked
 * on the Explorer roster and on each other. The roster in SelectCharReactDesk
 * is the only card row.
 */
export function SelectCharOccupiedReactOverlay({
    zIndex,
    characterSlots,
    characterListLoading,
}: SelectCharOccupiedReactOverlayProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const storeSlots = useStore(connectDialogStore, (s) => s.characterSlots);
    const selectedSlotIndex = useStore(connectDialogStore, (s) => s.selectedSlotIndex);
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
    const selected = resolveSelectCharSelectedIndex(liveSlots, selectedSlotIndex);
    const banner = buildSelectCharReactOccupiedBanner(rows, liveSlots, selected);
    const occupied = rows
        .map((row, slotIndex) => ({ row, slotIndex }))
        .filter((entry) => entry.row.occupied || (entry.row.name !== 'Empty' && entry.row.name.trim()));
    const selectedEntry = occupied.find((entry) => entry.slotIndex === selected);
    const selectedName = selectedEntry?.row.name ?? '';
    const selectedLev = selectedEntry?.row.lev ?? '';

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
        if (
            selectedName === 'Elon' &&
            selectedLev === 'Lev. 150' &&
            banner !== SELECTCHAR_KINDGEM_ELON_LV150_TEXT
        ) {
            selectCharWarn(
                'ConnectDialog React SELECTCHAR KindGem Elon string mismatch have=%s want=%s',
                banner,
                SELECTCHAR_KINDGEM_ELON_LV150_TEXT,
            );
        }
        if (
            selectedName &&
            selectedName !== '(none)' &&
            !selectCharOccupiedNamesRequireVisibleBanner(selectedName, painted.joined)
        ) {
            selectCharWarn(
                'ConnectDialog React SELECTCHAR banner DOM mismatch names=%s text=%s',
                selectedName,
                painted.joined,
            );
            const retry = syncSelectCharReactOccupiedBannerDom(banner, root);
            selectCharWarn('%s%s', SELECTCHAR_REACT_OCCUPIED_DOM_LOG, retry.joined || '(empty)');
        }
    }, [banner, loading, occupiedNames, selectedLev, selectedName]);

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
            data-occupied-label={SELECTCHAR_OCCUPIED_SLOT_LABEL}
            style={{ zIndex: Math.max(zIndex + 22, 2147483000) }}
            aria-hidden="true"
        />,
        document.body,
    );
}
