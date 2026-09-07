import { getDefaultGameHost, getDefaultGamePort } from './serverDefaults';
import {
    clientMentorFallback,
    type MentorClientContext,
    type MentorFallbackKind,
} from './mentorHeuristics';

export interface MentorChatPayload extends MentorClientContext {
    message: string;
}

export interface MentorChatResult {
    reply: string;
    source: 'local' | 'grok' | 'client';
    kind: MentorFallbackKind;
}

function mentorChatUrls(): string[] {
    const host = getDefaultGameHost();
    const port = getDefaultGamePort();
    return [
        'https://play.chainlords.net/api/mentor/chat',
        `http://${host}:${port}/api/mentor/chat`,
    ];
}

function asResult(raw: unknown): MentorChatResult | undefined {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const reply = (raw as { reply?: unknown }).reply;
    if (typeof reply !== 'string' || reply.trim().length === 0) {
        return undefined;
    }
    const sourceRaw = (raw as { source?: unknown }).source;
    const kindRaw = (raw as { kind?: unknown }).kind;
    const source =
        sourceRaw === 'grok' || sourceRaw === 'local' || sourceRaw === 'client' ? sourceRaw : 'local';
    const kind: MentorFallbackKind =
        kindRaw === 'price' || kindRaw === 'guide' || kindRaw === 'chat' ? kindRaw : 'chat';
    return { reply: reply.trim(), source, kind };
}

/**
 * POST mentor chat: play.chainlords.net first, then local game HTTP
 * (same host/port pattern as BleedingOnlineStrip).
 */
export async function postMentorChat(payload: MentorChatPayload): Promise<MentorChatResult> {
    const body = JSON.stringify({
        message: payload.message,
        playerName: payload.playerName,
        level: payload.level,
        worldId: payload.worldId,
        enrolled: payload.enrolled,
        activeTitle: payload.activeTitle,
        activeHint: payload.activeHint,
    });

    for (const url of mentorChatUrls()) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                cache: 'no-store',
            });
            if (!res.ok && res.status !== 429) {
                continue;
            }
            const parsed = asResult(await res.json());
            if (parsed) {
                return parsed;
            }
        } catch {
            // try next URL
        }
    }

    return clientMentorFallback(payload.message, payload);
}
