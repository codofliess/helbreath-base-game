import { Events } from 'phaser';

export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ToastRequestedEvent {
    message: string;
    severity: ToastSeverity;
    /** Duration in ms. When set, toast closes after this delay. Omit for container default (e.g. 3000 ms). */
    autoClose?: number;
    /** When true (logout countdown info toast), App stores the toast id for early dismiss via EventBus. */
    trackForLogoutDismiss?: boolean;
}

type HelbreathEventBusGlobal = typeof globalThis & {
    __helbreathEventBus?: Events.EventEmitter;
};

/**
 * Phaser EventEmitter for cross-component communication.
 * Used to emit events between React UI, Phaser scenes, and game objects.
 *
 * Pinned on `globalThis` so a Rollup/circular-import second evaluation cannot
 * construct a separate bus (live index-CxnG158Y.js still emitted two
 * `new Events.EventEmitter` expressions; only one binding was used).
 */
const eventBusRoot = globalThis as HelbreathEventBusGlobal;
export const EventBus = eventBusRoot.__helbreathEventBus
    ?? (eventBusRoot.__helbreathEventBus = new Events.EventEmitter());
