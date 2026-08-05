import {
    CSSProperties,
    createContext,
    useEffect,
    useState,
    useRef,
    useCallback,
    useContext,
    useMemo,
    type ReactNode,
    type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useFullscreenPortalTarget } from '../hooks/utils';

/** Bindings for a dialog title-bar drag handle (dnd-kit listeners or native pointer drag). */
export type DialogDragHandleBindings = Record<string, unknown> & {
    style?: CSSProperties;
};

interface DialogDragHandleContextValue {
    bindings: DialogDragHandleBindings;
    isDragging: boolean;
}

const DialogDragHandleContext = createContext<DialogDragHandleContextValue | null>(null);

/**
 * Invisible drag surface for window move.
 * F5/F6 use full-panel CSS (inset:0, low z-index). Empty parchment/bag floor hits this;
 * items, tabs, and buttons sit above and stopPropagation so they keep item DnD / clicks.
 *
 * VerifyFix path: pointerdown lands here → document pointermove calls onPositionChange →
 * BaseDraggableDialog wrapper style.left/top update.
 */
export function DialogDragHandle({
    className = 'olympia-dialog-drag-handle',
    title = 'Drag window',
}: {
    className?: string;
    title?: string;
}) {
    const ctx = useContext(DialogDragHandleContext);
    if (!ctx) {
        return null;
    }
    const { style: bindingStyle, ...rest } = ctx.bindings;
    return (
        <div
            className={className}
            title={title}
            data-olympia-drag-handle="true"
            {...rest}
            style={{
                cursor: ctx.isDragging ? 'grabbing' : 'grab',
                ...bindingStyle,
            }}
        />
    );
}

export interface BaseDraggableDialogProps {
    children: ReactNode;
    position: { x: number; y: number };
    id?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
    disableDrag?: boolean;
    zIndex?: number;
    onBringToFront?: () => void;
    className?: string;
    cursor?: string;
    /**
     * When set, window drag uses native document pointer listeners on the handle and writes
     * position here directly (bypasses dnd-kit). Required for Olympia bag/F-key
     * dialogs so title-bar drag does not fight bag-item mouse DnD.
     */
    onPositionChange?: (position: { x: number; y: number }) => void;
    /** Legacy dnd-kit header slot (Controls etc.). Prefer DialogDragHandle + onPositionChange for Olympia. */
    renderHeader?: (listeners: any, attributes: any, isDragging: boolean) => ReactNode;
}

export function BaseDraggableDialog({
    children,
    position,
    id = 'draggable-dialog',
    onContextMenu,
    disableDrag = false,
    zIndex = 10000,
    onBringToFront,
    className = 'draggable-dialog',
    cursor: customCursor,
    onPositionChange,
    renderHeader,
}: BaseDraggableDialogProps) {
    const portalTarget = useFullscreenPortalTarget();
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
    const [nativeDragging, setNativeDragging] = useState(false);
    const positionRef = useRef(position);
    positionRef.current = position;
    const onPositionChangeRef = useRef(onPositionChange);
    onPositionChangeRef.current = onPositionChange;
    const nativeDragCleanupRef = useRef<(() => void) | null>(null);

    const useNativeDrag = Boolean(onPositionChange) && !disableDrag;

    const { attributes, listeners, setNodeRef, transform, isDragging: dndDragging } = useDraggable({
        id,
        disabled: disableDrag || useNativeDrag,
    });

    const isDragging = useNativeDrag ? nativeDragging : dndDragging;

    const setRefs = useCallback(
        (node: HTMLDivElement | null) => {
            dialogRef.current = node;
            setNodeRef(node);
        },
        [setNodeRef],
    );

    useEffect(() => {
        const calculateMaxHeight = () => {
            const viewportHeight = window.innerHeight;
            const currentTop = transform ? position.y + transform.y : position.y;
            const padding = 20;
            const calculatedMaxHeight = viewportHeight - currentTop - padding;
            setMaxHeight(Math.max(200, calculatedMaxHeight));
        };

        calculateMaxHeight();
        window.addEventListener('resize', calculateMaxHeight);
        return () => {
            window.removeEventListener('resize', calculateMaxHeight);
        };
    }, [position.y, transform]);

    useEffect(() => {
        return () => {
            nativeDragCleanupRef.current?.();
            nativeDragCleanupRef.current = null;
        };
    }, []);

    const clampPosition = useCallback((x: number, y: number, snap: boolean) => {
        const el = dialogRef.current;
        const dialogWidth = el?.offsetWidth || 200;
        const dialogHeight = el?.offsetHeight || 150;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        let newX = x;
        let newY = y;
        if (snap) {
            const GRID_SIZE = 10;
            newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
            newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
        }
        newX = Math.max(0, Math.min(newX, viewportWidth - dialogWidth));
        newY = Math.max(0, Math.min(newY, viewportHeight - dialogHeight));
        return { x: newX, y: newY };
    }, []);

    /**
     * Title-bar pointerdown → document pointermove/up (sync, not useEffect).
     * Writes App position state; wrapper applies style.left/top (position:fixed).
     */
    const onNativeHandlePointerDown = useCallback(
        (e: ReactPointerEvent<HTMLDivElement>) => {
            if (!useNativeDrag || e.button !== 0) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            onBringToFront?.();

            nativeDragCleanupRef.current?.();

            const startX = e.clientX;
            const startY = e.clientY;
            const origX = positionRef.current.x;
            const origY = positionRef.current.y;
            const pointerId = e.pointerId;
            setNativeDragging(true);

            try {
                e.currentTarget.setPointerCapture(pointerId);
            } catch {
                /* capture optional — document listeners are the source of truth */
            }

            const onMove = (ev: PointerEvent) => {
                if (ev.pointerId !== pointerId) {
                    return;
                }
                const emit = onPositionChangeRef.current;
                if (!emit) {
                    return;
                }
                const rawX = origX + (ev.clientX - startX);
                const rawY = origY + (ev.clientY - startY);
                emit(clampPosition(rawX, rawY, false));
            };

            const onUp = (ev: PointerEvent) => {
                if (ev.pointerId !== pointerId) {
                    return;
                }
                document.removeEventListener('pointermove', onMove, true);
                document.removeEventListener('pointerup', onUp, true);
                document.removeEventListener('pointercancel', onUp, true);
                nativeDragCleanupRef.current = null;
                setNativeDragging(false);
                const emit = onPositionChangeRef.current;
                if (emit) {
                    const rawX = origX + (ev.clientX - startX);
                    const rawY = origY + (ev.clientY - startY);
                    emit(clampPosition(rawX, rawY, true));
                }
            };

            document.addEventListener('pointermove', onMove, true);
            document.addEventListener('pointerup', onUp, true);
            document.addEventListener('pointercancel', onUp, true);
            nativeDragCleanupRef.current = () => {
                document.removeEventListener('pointermove', onMove, true);
                document.removeEventListener('pointerup', onUp, true);
                document.removeEventListener('pointercancel', onUp, true);
            };
        },
        [useNativeDrag, onBringToFront, clampPosition],
    );

    const nativeHandleBindings: DialogDragHandleBindings = useMemo(
        () =>
            useNativeDrag
                ? {
                      onPointerDown: onNativeHandlePointerDown,
                      style: { touchAction: 'none' },
                  }
                : {},
        [useNativeDrag, onNativeHandlePointerDown],
    );

    const dragHandleContextValue = useMemo<DialogDragHandleContextValue>(
        () => ({
            bindings: useNativeDrag
                ? nativeHandleBindings
                : { ...listeners, ...attributes },
            isDragging,
        }),
        [useNativeDrag, nativeHandleBindings, listeners, attributes, isDragging],
    );

    const defaultCursor = isDragging ? 'grabbing' : disableDrag ? 'default' : 'grab';
    const cursor = customCursor ?? defaultCursor;

    const style: CSSProperties = {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: !useNativeDrag && transform ? CSS.Translate.toString(transform) : undefined,
        zIndex: zIndex,
        cursor: cursor,
        // Fixed-size Olympia dialogs (renderHeader / native handle) must not get viewport maxHeight —
        // it clips the panel and breaks free drag across the screen.
        ...(renderHeader || useNativeDrag ? {} : { maxHeight: maxHeight ? `${maxHeight}px` : undefined }),
        display: 'flex',
        flexDirection: 'column',
    };

    // dnd-kit path: listeners on main div only when there is no dedicated header/handle.
    const shouldApplyDragToMainDiv = !renderHeader && !disableDrag && !useNativeDrag;
    const dragListeners = shouldApplyDragToMainDiv ? listeners : {};
    const dragAttributes = shouldApplyDragToMainDiv ? attributes : {};

    const headerNode =
        renderHeader &&
        renderHeader(
            useNativeDrag ? nativeHandleBindings : listeners,
            useNativeDrag ? {} : attributes,
            isDragging,
        );

    const dialog = (
        <DialogDragHandleContext.Provider value={dragHandleContextValue}>
            <div
                ref={setRefs}
                style={style}
                className={className}
                data-dialog-id={id}
                data-dialog-width={dialogRef.current?.offsetWidth}
                data-dialog-height={dialogRef.current?.offsetHeight}
                onContextMenu={onContextMenu}
                onMouseDown={onBringToFront}
                {...dragListeners}
                {...dragAttributes}
            >
                {headerNode}
                <div className="draggable-dialog-content">{children}</div>
            </div>
        </DialogDragHandleContext.Provider>
    );

    return portalTarget ? createPortal(dialog, portalTarget) : null;
}

interface HeadlessDraggableDialogProps {
    children: ReactNode;
    position: { x: number; y: number };
    id?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
    disableDrag?: boolean;
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    renderHeader?: BaseDraggableDialogProps['renderHeader'];
}

export function HeadlessDraggableDialog(props: HeadlessDraggableDialogProps) {
    return (
        <BaseDraggableDialog
            {...props}
            id={props.id ?? 'headless-draggable-dialog'}
            className="draggable-dialog headless-draggable-dialog"
        />
    );
}
