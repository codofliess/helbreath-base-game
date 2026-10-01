import type { ChatMessageEntry } from '../store/ChatDialog.store';

/**
 * On-screen chat stack (left / bottom-left), separate from the F9 Chat Log window.
 * Six lines. A line stays fully opaque for five seconds, then is removed.
 */
export const SCREEN_CHAT_MAX_LINES = 6;
export const SCREEN_CHAT_TTL_MS = 5_000;

/**
 * Newest lines still inside the five-second life, capped at the stack size.
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
