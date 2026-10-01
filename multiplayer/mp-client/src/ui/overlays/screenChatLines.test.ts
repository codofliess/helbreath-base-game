import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatMessageEntry } from '../store/ChatDialog.store';
import {
    SCREEN_CHAT_MAX_LINES,
    SCREEN_CHAT_TTL_MS,
    screenChatLineOpacity,
    selectScreenChatLines,
} from './screenChatLines';

function line(
    id: string,
    ageMs: number,
    channel: ChatMessageEntry['channel'] = 'nearby',
    nowMs = 10_000,
): ChatMessageEntry {
    return {
        id,
        senderCharacterName: 'Co2',
        timestampMs: nowMs - ageMs,
        message: 'hola',
        displayMessage: 'hola',
        channel,
    };
}

describe('screen chat overlay', () => {
    it('keeps a local nearby line with the sender name while the chat window is a separate surface', () => {
        const nowMs = 10_000;
        const visible = selectScreenChatLines(
            [line('a', 100, 'nearby', nowMs)],
            nowMs,
        );
        assert.equal(visible.length, 1);
        assert.equal(visible[0]?.senderCharacterName, 'Co2');
        assert.equal(visible[0]?.displayMessage, 'hola');
        assert.equal(visible[0]?.channel, 'nearby');
        assert.equal(screenChatLineOpacity(100), 1);
    });

    it('caps the stack at six lines and drops anything older than five seconds', () => {
        const nowMs = 20_000;
        const messages = Array.from({ length: 8 }, (_, index) =>
            line(`id-${index}`, (8 - index) * 100, 'global', nowMs),
        );
        messages.push(line('stale', SCREEN_CHAT_TTL_MS, 'nearby', nowMs));
        const visible = selectScreenChatLines(messages, nowMs);
        assert.equal(SCREEN_CHAT_MAX_LINES, 6);
        assert.equal(SCREEN_CHAT_TTL_MS, 5_000);
        assert.equal(visible.length, 6);
        assert.equal(visible[0]?.id, 'id-2');
        assert.equal(visible[5]?.id, 'id-7');
        assert.equal(screenChatLineOpacity(SCREEN_CHAT_TTL_MS), 0);
    });

    it('fades only in the last 30% of the lifetime', () => {
        const fadeStart = SCREEN_CHAT_TTL_MS * 0.7;
        assert.equal(screenChatLineOpacity(fadeStart - 1), 1);
        const midFade = screenChatLineOpacity(fadeStart + (SCREEN_CHAT_TTL_MS - fadeStart) / 2);
        assert.ok(midFade > 0.4 && midFade < 0.6, `expected ~0.5, got ${midFade}`);
        assert.equal(screenChatLineOpacity(SCREEN_CHAT_TTL_MS - 1) < 0.05, true);
    });

    it('duel filter keeps nearby and drops trade', () => {
        const nowMs = 10_000;
        const duel = new Set<ChatMessageEntry['channel']>(['global', 'nearby', 'party', 'misc']);
        const visible = selectScreenChatLines(
            [line('n', 10, 'nearby', nowMs), line('t', 10, 'trade', nowMs)],
            nowMs,
            duel,
        );
        assert.deepEqual(visible.map((entry) => entry.channel), ['nearby']);
    });
});
