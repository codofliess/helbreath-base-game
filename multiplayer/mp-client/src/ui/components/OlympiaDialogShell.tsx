import { type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import { useStore } from '@tanstack/react-store';
import { DialogDragHandle, HeadlessDraggableDialog } from '../dialogs/HeadlessDraggableDialog';
import { appStore } from '../store/App.store';
import { olympiaScaledPx } from '../../constants/OlympiaUiScale';

interface OlympiaDialogShellProps {
    id: string;
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onContextMenu?: (e: MouseEvent) => void;
    disableDrag?: boolean;
    /** Native window drag — writes position to App state (bypasses dnd-kit). */
    onPositionChange?: (position: { x: number; y: number }) => void;
    /** Classic Olympia base width in px; scaled by OLYMPIA_UI_SCALE when numeric. */
    width?: number | string;
    /** Classic Olympia base min-height in px; scaled by OLYMPIA_UI_SCALE when numeric. */
    minHeight?: number | string;
    bgSpriteKey?: string;
    dragHandleClassName?: string;
    rootClassName?: string;
    /** Extra styles on the dialog root (e.g. --bag-scale CSS var). */
    rootStyle?: CSSProperties;
    children: ReactNode;
}

/**
 * Olympia dialog frame with Nemesis chrome (`.hb-nemesis-dialog`).
 * Sprite BG is still attached for layout sizing; CSS suppresses the parchment art.
 * Drag handle covers the full panel (CSS inset:0, low z-index). Empty chrome / bag floor
 * starts window drag; items and buttons sit above and call stopOlympiaPointer.
 */
export function OlympiaDialogShell({
    id,
    position,
    zIndex,
    onBringToFront,
    onContextMenu,
    disableDrag,
    onPositionChange,
    width,
    minHeight,
    bgSpriteKey,
    dragHandleClassName = 'olympia-dialog-drag-handle',
    rootClassName = '',
    rootStyle,
    children,
}: OlympiaDialogShellProps) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const dialogBg = bgSpriteKey ? spriteFrameMap.get(bgSpriteKey) : undefined;

    const scaledWidth = typeof width === 'number' ? olympiaScaledPx(width) : width;
    const scaledMinHeight = typeof minHeight === 'number' ? olympiaScaledPx(minHeight) : minHeight;
    const bgSize =
        typeof width === 'number' && typeof minHeight === 'number'
            ? `${olympiaScaledPx(width)}px ${olympiaScaledPx(minHeight)}px`
            : '100% 100%';

    return (
        <HeadlessDraggableDialog
            position={position}
            id={id}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={onContextMenu}
            disableDrag={disableDrag}
            onPositionChange={onPositionChange}
        >
            <div
                className={`olympia-dialog-root hb-nemesis-dialog ${dialogBg ? '' : 'olympia-dialog-fallback'} ${rootClassName}`.trim()}
                style={{
                    width: scaledWidth,
                    minHeight: scaledMinHeight,
                    ...rootStyle,
                    ...(dialogBg
                        ? {
                              backgroundImage: `url(${dialogBg})`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'left top',
                              /* Stretch classic frame to OLYMPIA_UI_SCALE panel size */
                              backgroundSize: bgSize,
                          }
                        : undefined),
                }}
            >
                {!disableDrag && (
                    <DialogDragHandle className={dragHandleClassName} title="Drag window" />
                )}
                {children}
            </div>
        </HeadlessDraggableDialog>
    );
}

export function stopOlympiaPointer(e: PointerEvent) {
    e.stopPropagation();
}
