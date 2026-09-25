import { useEffect, useRef, useState } from 'react';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import { composeSelectCharAvatar } from '../../game/ui/selectCharAvatarCompose';
import { selectCharAvatarLookFromSlot } from '../../game/ui/selectCharAvatarLook';
import { formatSelectCharTown } from '../../game/ui/selectCharSelection';

interface SelectCharSlotAvatarProps {
    slot: CharacterSlotSummary;
}

/**
 * Idle-south in-game appearance for one SELECTCHAR card.
 * Uses the same .spr body/hair/gear sheets as F5 / menu preview.
 */
export function SelectCharSlotAvatar({ slot }: SelectCharSlotAvatarProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);
    const lookKey = `${slot.name}:${slot.gender}:${slot.skinColor}:${slot.hairStyleIndex}:${slot.underwearColorIndex}:${(slot.equipped ?? [])
        .map((e) => `${e.slot}:${e.itemId}`)
        .join(',')}`;

    useEffect(() => {
        let cancelled = false;
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        setReady(false);
        const look = selectCharAvatarLookFromSlot(slot);
        void composeSelectCharAvatar(canvas, look).then((ok) => {
            if (!cancelled) {
                setReady(ok);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [lookKey, slot]);

    const town = formatSelectCharTown(slot.citizenshipSide).toLowerCase();

    return (
        <div
            className={`login-desk-slot-avatar login-desk-slot-avatar--${town}${ready ? ' is-ready' : ''}`}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} width={96} height={128} className="login-desk-slot-avatar-canvas" />
            {!ready ? <span className="login-desk-slot-avatar-stand" /> : null}
        </div>
    );
}
