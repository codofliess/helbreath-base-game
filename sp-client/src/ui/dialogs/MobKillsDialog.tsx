import { useStore } from '@tanstack/react-store';
import { HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { appStore } from '../store/App.store';
import { playerDialogStore } from '../store/PlayerDialog.store';
import { setMobKillsDialogOpen } from '../store/MobKillsDialog.store';
import { CHARACTER_DIALOG_BG } from '../../constants/SpriteKeys';

interface MobKillsDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function MobKillsDialog({ position, zIndex, onBringToFront }: MobKillsDialogProps) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const stats = useStore(playerDialogStore, (s) => s.stats);
    const dialogBg = spriteFrameMap.get(CHARACTER_DIALOG_BG);

    return (
        <HeadlessDraggableDialog
            position={position}
            id="mob-kills-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                setMobKillsDialogOpen(false);
            }}
        >
            <div
                className="olympia-dialog-root mob-kills-dialog-root"
                style={dialogBg ? {
                    backgroundImage: `url(${dialogBg})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                } : undefined}
            >
                <div className="olympia-dialog-title-bar">Mob Kills</div>
                <div className="mob-kills-body">
                    <p className="mob-kills-total">Total kills: <strong>{stats.enemyKills}</strong></p>
                    <div className="mob-kills-list">
                        <div className="mob-kills-row mob-kills-header">
                            <span>Monster</span>
                            <span>Count</span>
                            <span>Lv</span>
                        </div>
                        <p className="mob-kills-hint">El detalle por monstruo se actualizará al matar enemigos.</p>
                    </div>
                </div>
            </div>
        </HeadlessDraggableDialog>
    );
}