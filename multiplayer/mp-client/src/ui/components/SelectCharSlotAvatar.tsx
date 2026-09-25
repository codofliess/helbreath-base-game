import { useEffect, useRef, useState } from 'react';
import type { CharacterSlotSummary } from '../../utils/characterListApi';
import { composeSelectCharAvatar } from '../../game/ui/selectCharAvatarCompose';
import { selectCharAvatarLookFromSlot } from '../../game/ui/selectCharAvatarLook';
import { formatSelectCharTown } from '../../game/ui/selectCharSelection';
import { normalizeCitizenshipSide } from '../../utils/characterListApi';

interface SelectCharSlotAvatarProps {
    slot: CharacterSlotSummary;
    animate?: boolean;
}

/**
 * In-game appearance for one SELECTCHAR card.
 * Selected cards cycle south walk frames (classic menu idle motion).
 */
export function SelectCharSlotAvatar({ slot, animate = false }: SelectCharSlotAvatarProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);
    const [walkFrame, setWalkFrame] = useState(0);
    const lookKey = `${slot.name}:${slot.gender}:${slot.skinColor}:${slot.hairStyleIndex}:${slot.underwearColorIndex}:${(slot.equipped ?? [])
        .map((e) => `${e.slot}:${e.itemId}`)
        .join(',')}`;
    const side = normalizeCitizenshipSide(slot.citizenshipSide);
    const townClass = formatSelectCharTown(slot.citizenshipSide).toLowerCase().replace(/\s+/g, '-');

    useEffect(() => {
        if (!animate) {
            setWalkFrame(0);
            return;
        }
        const id = window.setInterval(() => {
            setWalkFrame((frame) => (frame + 1) % 8);
        }, 100);
        return () => window.clearInterval(id);
    }, [animate]);

    useEffect(() => {
        let cancelled = false;
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const look = selectCharAvatarLookFromSlot(slot, animate ? { walkFrame } : undefined);
        void composeSelectCharAvatar(canvas, look).then((ok) => {
            if (!cancelled) {
                setReady(ok);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [lookKey, slot, animate, walkFrame]);

    return (
        <div
            className={`login-desk-slot-avatar login-desk-slot-avatar--${townClass}${ready ? ' is-ready' : ''}`}
            data-side={side}
            aria-hidden="true"
        >
            <span className="login-desk-slot-plinth" data-side={side}>
                <span className="login-desk-slot-rune" />
            </span>
            <canvas ref={canvasRef} width={96} height={128} className="login-desk-slot-avatar-canvas" />
            {!ready ? <span className="login-desk-slot-avatar-stand" /> : null}
        </div>
    );
}
