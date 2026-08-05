import { OLYMPIA_CHAT_COLORS } from './OlympiaTypography';

/**
 * Olympia chat log channel ids (aligned with proto `ChatChannel`).
 * `all` is display-only (not sent on the wire).
 */
export type ChatChannelId =
    | 'global'
    | 'trade'
    | 'town'
    | 'nearby'
    | 'guild'
    | 'party'
    | 'whisper'
    | 'misc'
    | 'all';

/** Tabs shown in the F9 Chat Log window (Olympia order + All). */
export const CHAT_LOG_TABS: readonly { id: ChatChannelId; label: string }[] = [
    { id: 'global', label: 'Global' },
    { id: 'trade', label: 'Trade' },
    { id: 'town', label: 'Town' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'guild', label: 'Guild' },
    { id: 'party', label: 'Party' },
    { id: 'whisper', label: 'Whisper' },
    { id: 'all', label: 'All' },
] as const;

/** Default send channel when no `/command` prefix is used. */
export const DEFAULT_CHAT_SEND_CHANNEL: Exclude<ChatChannelId, 'all'> = 'nearby';

export type ParsedChatSend = {
    channel: Exclude<ChatChannelId, 'all'>;
    message: string;
    whisperTarget?: string;
};

/**
 * Parses Olympia-style chat command prefixes (`/w Name hi`, `/trade …`, `/g …`).
 * Bare text uses the active tab channel (or Nearby when viewing All).
 */
export function parseChatSendInput(
    raw: string,
    activeTab: ChatChannelId,
): ParsedChatSend | { error: string } {
    const trimmed = raw.trim();
    if (!trimmed) {
        return { error: 'Empty message.' };
    }

    const whisperMatch = trimmed.match(/^\/(?:w|whisper|to)\s+(\S+)\s+(.+)$/i);
    if (whisperMatch) {
        const target = whisperMatch[1]?.trim();
        const message = whisperMatch[2]?.trim();
        if (!target || !message) {
            return { error: 'Usage: /w Name message' };
        }
        return { channel: 'whisper', message, whisperTarget: target };
    }

    const prefixed = trimmed.match(/^\/(global|g|trade|t|town|nearby|n|guild|gu|party|p|misc|m)\s+(.+)$/i);
    if (prefixed) {
        const cmd = prefixed[1]!.toLowerCase();
        const message = prefixed[2]!.trim();
        if (!message) {
            return { error: 'Empty message.' };
        }
        return { channel: commandToChannel(cmd), message };
    }

    if (trimmed.startsWith('/')) {
        return { error: 'Unknown command. Try /w Name msg, /trade, /guild, /party, /nearby…' };
    }

    const channel =
        activeTab === 'all' || activeTab === 'whisper'
            ? DEFAULT_CHAT_SEND_CHANNEL
            : activeTab;
    return { channel, message: trimmed };
}

function commandToChannel(cmd: string): Exclude<ChatChannelId, 'all'> {
    switch (cmd) {
        case 'global':
        case 'g':
            return 'global';
        case 'trade':
        case 't':
            return 'trade';
        case 'town':
            return 'town';
        case 'nearby':
        case 'n':
            return 'nearby';
        case 'guild':
        case 'gu':
            return 'guild';
        case 'party':
        case 'p':
            return 'party';
        case 'misc':
        case 'm':
            return 'misc';
        default:
            return DEFAULT_CHAT_SEND_CHANNEL;
    }
}

/** Maps wire / store channel to CSS line class (world log + F9 log). */
export function chatChannelLineClass(channel: Exclude<ChatChannelId, 'all'>): string {
    switch (channel) {
        case 'guild':
            return 'chat-line-guild';
        case 'party':
            return 'chat-line-party';
        case 'whisper':
            return 'chat-line-whisper';
        case 'trade':
            return 'chat-line-trade';
        case 'town':
            return 'chat-line-town';
        case 'misc':
            return 'chat-line-system';
        case 'global':
            return 'chat-line-global';
        case 'nearby':
            return 'chat-line-normal'; // white local
        default:
            return 'chat-line-normal';
    }
}

/**
 * World chat-overhead fill color.
 * Nearby/global stay warm-red for readability on the map; other tabs match PutString2.
 */
export function chatChannelOverheadColor(channel: Exclude<ChatChannelId, 'all'>): string {
    switch (channel) {
        case 'guild':
            return OLYMPIA_CHAT_COLORS.guild;
        case 'party':
            return OLYMPIA_CHAT_COLORS.party;
        case 'whisper':
            return OLYMPIA_CHAT_COLORS.whisper;
        case 'trade':
            return OLYMPIA_CHAT_COLORS.trade;
        case 'town':
            return OLYMPIA_CHAT_COLORS.town;
        case 'misc':
            return OLYMPIA_CHAT_COLORS.systemBright;
        case 'global':
        case 'nearby':
        default:
            // Classic nearby overhead (P1.3) — higher contrast than dialog ink white.
            return '#ff6a6a';
    }
}

/** Proto `ChatChannel` numeric values (must match network.proto). */
export const CHAT_CHANNEL_PROTO = {
    global: 0,
    trade: 1,
    town: 2,
    nearby: 3,
    guild: 4,
    party: 5,
    whisper: 6,
    misc: 7,
} as const satisfies Record<Exclude<ChatChannelId, 'all'>, number>;

export function chatChannelToProto(channel: Exclude<ChatChannelId, 'all'>): number {
    return CHAT_CHANNEL_PROTO[channel];
}

export function chatChannelFromProto(value: number | undefined): Exclude<ChatChannelId, 'all'> {
    switch (value) {
        case CHAT_CHANNEL_PROTO.trade:
            return 'trade';
        case CHAT_CHANNEL_PROTO.town:
            return 'town';
        case CHAT_CHANNEL_PROTO.nearby:
            return 'nearby';
        case CHAT_CHANNEL_PROTO.guild:
            return 'guild';
        case CHAT_CHANNEL_PROTO.party:
            return 'party';
        case CHAT_CHANNEL_PROTO.whisper:
            return 'whisper';
        case CHAT_CHANNEL_PROTO.misc:
            return 'misc';
        case CHAT_CHANNEL_PROTO.global:
        default:
            return 'global';
    }
}
