export type ToastSeverity = 'info' | 'success' | 'warning' | 'error';

export interface ToastRequestedEvent {
    message: string;
    severity: ToastSeverity;
    /** Duration in ms. When set, toast closes after this delay. Omit for container default (e.g. 3000 ms). */
    autoClose?: number;
    /** When true (logout countdown info toast), App stores the toast id for early dismiss via EventBus. */
    trackForLogoutDismiss?: boolean;
}

type EventHandler = (...args: any[]) => void;

/**
 * Tiny EventEmitter used by React hub and Phaser scenes.
 *
 * Must not import `phaser`. KindGem + Phantom overlay OOM (Chrome Aw Snap 9) if the hub
 * evaluates Phaser/WebGL before the seal. Pinned on `globalThis` so a later game chunk
 * cannot construct a second bus.
 */
class HelbreathEventBus {
    private readonly listeners = new Map<string | symbol, Set<EventHandler>>();

    public on(event: string | symbol, fn: EventHandler): this {
        let set = this.listeners.get(event);
        if (!set) {
            set = new Set();
            this.listeners.set(event, set);
        }
        set.add(fn);
        return this;
    }

    public addListener(event: string | symbol, fn: EventHandler): this {
        return this.on(event, fn);
    }

    public once(event: string | symbol, fn: EventHandler): this {
        const wrap: EventHandler = (...args) => {
            this.off(event, wrap);
            fn(...args);
        };
        return this.on(event, wrap);
    }

    public off(event: string | symbol, fn?: EventHandler): this {
        if (!fn) {
            this.listeners.delete(event);
            return this;
        }
        this.listeners.get(event)?.delete(fn);
        return this;
    }

    public removeListener(event: string | symbol, fn?: EventHandler): this {
        return this.off(event, fn);
    }

    public emit(event: string | symbol, ...args: unknown[]): boolean {
        const set = this.listeners.get(event);
        if (!set || set.size === 0) {
            return false;
        }
        for (const fn of [...set]) {
            fn(...args);
        }
        return true;
    }

    public removeAllListeners(event?: string | symbol): this {
        if (event === undefined) {
            this.listeners.clear();
        } else {
            this.listeners.delete(event);
        }
        return this;
    }
}

type HelbreathEventBusGlobal = typeof globalThis & {
    __helbreathEventBus?: HelbreathEventBus;
};

const eventBusRoot = globalThis as HelbreathEventBusGlobal;
export const EventBus = eventBusRoot.__helbreathEventBus
    ?? (eventBusRoot.__helbreathEventBus = new HelbreathEventBus());
