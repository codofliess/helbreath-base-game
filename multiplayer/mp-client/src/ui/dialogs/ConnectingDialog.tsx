import { OlympiaDialogShell } from '../components/OlympiaDialogShell';
import { CONNECT_DIALOG_BG } from '../../constants/SpriteKeys';

interface ConnectingDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function ConnectingDialog({
    position,
    zIndex,
    onBringToFront,
}: ConnectingDialogProps) {
    return (
        <OlympiaDialogShell
            id="connecting-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => e.preventDefault()}
            disableDrag
            width={280}
            minHeight={120}
            bgSpriteKey={CONNECT_DIALOG_BG}
            rootClassName="connect-dialog-root connecting-dialog-root"
        >
            <div className="connecting-dialog-body">
                <p className="connecting-dialog-text">Connecting to server...</p>
            </div>
        </OlympiaDialogShell>
    );
}
