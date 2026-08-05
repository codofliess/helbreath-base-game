/**
 * Discord Rich Presence ("Playing Helbreath Chain Lords" under the username).
 *
 * Olympia uses a native client + Discord Game SDK. Our client is a browser game, so we
 * talk to the **local Discord desktop RPC** (ws://127.0.0.1:6463–6472) when Discord is open.
 *
 * Requires:
 * - Discord desktop app running and logged in
 * - Application Client ID (Discord Developer Portal → your app → Application ID)
 *   set as VITE_DISCORD_CLIENT_ID at build time (public value, not a secret)
 *
 * If Discord is closed or the browser blocks localhost RPC, this no-ops silently.
 */

import { characterDialogStore } from '../ui/store/CharacterDialog.store';

/** Public Discord Application ID — override with VITE_DISCORD_CLIENT_ID. */
const DEFAULT_DISCORD_CLIENT_ID = '1528985969838264391';

const RPC_PORTS = [6463, 6464, 6465, 6466, 6467, 6468, 6469, 6470, 6471, 6472];

type ActivityPayload = {
    details?: string;
    state?: string;
    timestamps?: { start?: number };
    assets?: {
        large_image?: string;
        large_text?: string;
        small_image?: string;
        small_text?: string;
    };
    buttons?: Array<{ label: string; url: string }>;
    instance?: boolean;
};

let socket: WebSocket | null = null;
let rpcNonce = 0;
let activityStartedAt = 0;
let connectPromise: Promise<boolean> | null = null;
let cleared = true;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function clientId(): string {
    try {
        const fromEnv = (import.meta.env.VITE_DISCORD_CLIENT_ID ?? '').toString().trim();
        if (fromEnv) {
            return fromEnv;
        }
    } catch {
        // ignore
    }
    return DEFAULT_DISCORD_CLIENT_ID;
}

function nextNonce(): string {
    rpcNonce += 1;
    return `cl-${Date.now()}-${rpcNonce}`;
}

function send(cmd: string, args: Record<string, unknown>, evt?: string): void {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
    }
    const payload: Record<string, unknown> = {
        cmd,
        args,
        nonce: nextNonce(),
    };
    if (evt) {
        payload.evt = evt;
    }
    socket.send(JSON.stringify(payload));
}

function stopHeartbeat(): void {
    if (heartbeatTimer != null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
}

function disconnect(): void {
    stopHeartbeat();
    if (socket) {
        try {
            socket.close();
        } catch {
            // ignore
        }
    }
    socket = null;
    connectPromise = null;
}

function tryPort(port: number, appId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const url = `ws://127.0.0.1:${port}/?v=1&encoding=json&client_id=${encodeURIComponent(appId)}`;
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch (err) {
            reject(err);
            return;
        }
        const timer = window.setTimeout(() => {
            if (settled) {
                return;
            }
            settled = true;
            try {
                ws.close();
            } catch {
                // ignore
            }
            reject(new Error('timeout'));
        }, 1200);

        ws.addEventListener('open', () => {
            // Discord may send READY before or after open; keep socket.
        });

        ws.addEventListener('message', (ev) => {
            try {
                const msg = JSON.parse(String(ev.data)) as { evt?: string; cmd?: string };
                if (msg.evt === 'READY' || msg.cmd === 'DISPATCH') {
                    if (!settled) {
                        settled = true;
                        window.clearTimeout(timer);
                        resolve(ws);
                    }
                }
            } catch {
                // ignore parse errors
            }
        });

        ws.addEventListener('error', () => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            reject(new Error('ws error'));
        });

        ws.addEventListener('close', () => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            reject(new Error('ws closed'));
        });
    });
}

async function ensureConnected(): Promise<boolean> {
    if (socket && socket.readyState === WebSocket.OPEN) {
        return true;
    }
    if (connectPromise) {
        return connectPromise;
    }
    const appId = clientId();
    if (!appId) {
        return false;
    }

    connectPromise = (async () => {
        for (const port of RPC_PORTS) {
            try {
                const ws = await tryPort(port, appId);
                socket = ws;
                ws.addEventListener('close', () => {
                    if (socket === ws) {
                        socket = null;
                        connectPromise = null;
                        stopHeartbeat();
                    }
                });
                // Keep activity alive while tab is open.
                stopHeartbeat();
                heartbeatTimer = setInterval(() => {
                    if (!cleared) {
                        void refreshActivity();
                    }
                }, 45_000);
                return true;
            } catch {
                // try next port
            }
        }
        connectPromise = null;
        return false;
    })();

    return connectPromise;
}

function buildActivity(extra?: { details?: string; state?: string }): ActivityPayload {
    const name = characterDialogStore.state.stats.playerName?.trim() || '';
    const level = characterDialogStore.state.stats.level || 0;
    const details = extra?.details ?? (name ? `${name}${level > 0 ? ` · Lv ${level}` : ''}` : 'In the realm');
    const state = extra?.state ?? 'Helbreath Chain Lords';

    if (!activityStartedAt) {
        activityStartedAt = Math.floor(Date.now() / 1000);
    }

    // Omit custom assets until uploaded in Discord Dev Portal (Art Assets → Rich Presence).
    // Buttons require a verified app for some clients — keep Play only.
    return {
        details: details.slice(0, 128),
        state: state.slice(0, 128),
        timestamps: { start: activityStartedAt },
        buttons: [{ label: 'Play Chain Lords', url: 'https://play.chainlords.net' }],
        instance: false,
    };
}

function setActivity(activity: ActivityPayload | null): void {
    send('SET_ACTIVITY', {
        pid: 0,
        activity,
    });
}

async function refreshActivity(extra?: { details?: string; state?: string }): Promise<void> {
    const ok = await ensureConnected();
    if (!ok) {
        return;
    }
    setActivity(buildActivity(extra));
}

/**
 * Call when the player enters the game world (map loaded).
 */
export async function discordPresenceEnterWorld(opts?: {
    mapName?: string;
    characterName?: string;
    level?: number;
}): Promise<void> {
    cleared = false;
    activityStartedAt = Math.floor(Date.now() / 1000);
    const char =
        opts?.characterName?.trim() ||
        characterDialogStore.state.stats.playerName?.trim() ||
        'Adventurer';
    const level = opts?.level ?? characterDialogStore.state.stats.level ?? 0;
    const map = opts?.mapName?.trim();
    await refreshActivity({
        details: level > 0 ? `${char} · Lv ${level}` : char,
        state: map ? `Exploring ${map}` : 'In the realm',
    });
}

/**
 * Update presence (e.g. map change) without resetting the start timestamp.
 */
export async function discordPresenceUpdate(opts?: {
    mapName?: string;
    characterName?: string;
    level?: number;
}): Promise<void> {
    if (cleared) {
        return;
    }
    const char =
        opts?.characterName?.trim() ||
        characterDialogStore.state.stats.playerName?.trim() ||
        'Adventurer';
    const level = opts?.level ?? characterDialogStore.state.stats.level ?? 0;
    const map = opts?.mapName?.trim();
    await refreshActivity({
        details: level > 0 ? `${char} · Lv ${level}` : char,
        state: map ? `Exploring ${map}` : 'In the realm',
    });
}

/**
 * Clear presence (logout, hub, tab close).
 */
export function discordPresenceClear(): void {
    cleared = true;
    activityStartedAt = 0;
    if (socket && socket.readyState === WebSocket.OPEN) {
        setActivity(null);
    }
    // Brief delay so Discord receives clear, then drop socket.
    window.setTimeout(() => disconnect(), 200);
}

/** Wire page lifecycle so status does not stick after leave. */
export function installDiscordPresenceLifecycle(): void {
    window.addEventListener('beforeunload', () => {
        discordPresenceClear();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !cleared) {
            void refreshActivity();
        }
    });
}
