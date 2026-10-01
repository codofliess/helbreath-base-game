import type { ChatMessageEntry } from '../store/ChatDialog.store';

/**
 * On-screen chat stack (left / bottom-left), separate from the F9 Chat Log window.
 * Six lines, five seconds, then gone. Opacity stays full until the last 30% of
 * that window, then fades to clear.
 */
export const SCREEN_CHAT_MAX_LINES = 6;
export const SCREEN_CHAT_TTL_MS = 5_000;
const SCREEN_CHAT_FADE_START_RATIO = 0.7;

/** Opacity for one on-screen chat line. 0 means the line has expired. */
export function screenChatLineOpacity(ageMs: number, ttlMs: number = SCREEN_CHAT_TTL_MS): number {
    if (ageMs <= 0) {
        return 1;
    }
    if (ageMs >= ttlMs) {
        return 0;
    }
    const fadeStart = ttlMs * SCREEN_CHAT_FADE_START_RATIO;
    if (ageMs < fadeStart) {
        return 1;
    }
    const span = ttlMs - fadeStart;
    if (span <= 0) {
        return 0;
    }
    return Math.max(0, 1 - (ageMs - fadeStart) / span);
}

/**
 * Newest lines that are still inside the lifetime, capped at the stack size.
 * Optional channel set is the duel filter (global / nearby / party / misc).
 */
export function selectScreenChatLines(
    messages: readonly ChatMessageEntry[],
    nowMs: number,
    channels?: ReadonlySet<ChatMessageEntry['channel']>,
): ChatMessageEntry[] {
    const eligible = channels ? messages.filter((entry) => channels.has(entry.channel)) : messages;
    const alive = eligible.filter((entry) => nowMs - entry.timestampMs < SCREEN_CHAT_TTL_MS);
    return alive.slice(-SCREEN_CHAT_MAX_LINES);
}
