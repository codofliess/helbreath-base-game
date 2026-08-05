import { useState, type PointerEvent, type ReactNode } from 'react';
import { useStore } from '@tanstack/react-store';
import { appStore } from '../store/App.store';

function stopDialogPointer(e: PointerEvent) {
    e.stopPropagation();
}

interface OlympiaSpriteButtonProps {
    normalKey: string;
    hoverKey: string;
    title: string;
    onClick: () => void;
    className?: string;
    disabled?: boolean;
    fallbackLabel?: ReactNode;
}

/** Helbreath gamedialog2 sprite button with text fallback when frames are missing. */
export function OlympiaSpriteButton({
    normalKey,
    hoverKey,
    title,
    onClick,
    className,
    disabled = false,
    fallbackLabel,
}: OlympiaSpriteButtonProps) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const [hovered, setHovered] = useState(false);
    const [imgFailed, setImgFailed] = useState(false);
    const src = spriteFrameMap.get(hovered ? hoverKey : normalKey) ?? spriteFrameMap.get(normalKey);

    if (src && !imgFailed) {
        return (
            <button
                type="button"
                title={title}
                onClick={onClick}
                disabled={disabled}
                onPointerDown={stopDialogPointer}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className={className ?? 'olympia-sprite-btn'}
            >
                <img
                    src={src}
                    alt={title}
                    className="olympia-sprite-btn-img"
                    draggable={false}
                    onError={() => setImgFailed(true)}
                />
            </button>
        );
    }

    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            onPointerDown={stopDialogPointer}
            className={className ? `${className} olympia-text-btn` : 'olympia-text-btn'}
        >
            {fallbackLabel ?? title}
        </button>
    );
}
