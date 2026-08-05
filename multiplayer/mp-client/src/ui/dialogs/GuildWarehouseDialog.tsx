import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { LEVELSET_DIALOG_BG } from '../../constants/SpriteKeys';
import { openAuctionBoard } from '../store/AuctionBoardDialog.store';
import {
    guildWarehouseDialogStore,
    setGuildWarehouseDialogOpen,
} from '../store/GuildWarehouseDialog.store';

interface GuildWarehouseDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
}

/**
 * Stub guild warehouse desk (Fase H storage incomplete).
 * Exposes Auction Board access so guild warehouse remains a documented entry point.
 */
export function GuildWarehouseDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
}: GuildWarehouseDialogProps) {
    const isOpen = useStore(guildWarehouseDialogStore, (s) => s.isOpen);

    if (!isOpen) {
        return null;
    }

    return (
        <OlympiaDialogShell
            id="guild-warehouse-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(ev) => {
                ev.preventDefault();
                setGuildWarehouseDialogOpen(false);
            }}
            width={300}
            minHeight={220}
            bgSpriteKey={LEVELSET_DIALOG_BG}
            rootClassName="guild-warehouse-dialog-root"
        >
            <div className="olympia-dialog-title-bar hb-nemesis-dialog-title">Guild Warehouse</div>
            <div className="guild-warehouse-dialog-content">
                <p className="shop-dialog-intro">
                    Guild shared storage is not ready yet (Fase H). Use Auction Board from this desk in the
                    meantime.
                </p>
                <div className="guild-warehouse-dialog-actions">
                    <button
                        type="button"
                        className="olympia-text-btn"
                        onClick={() => {
                            setGuildWarehouseDialogOpen(false);
                            openAuctionBoard();
                        }}
                    >
                        Auction Board
                    </button>
                </div>
                <p className="shop-dialog-hint">Right-click dialog to close.</p>
            </div>
        </OlympiaDialogShell>
    );
}
