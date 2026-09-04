/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PLAYER_MODE?: string;
    /** Isolated playtest door. Must never be '1' on the live traveler build. */
    readonly VITE_PLAYTEST?: string;
    readonly VITE_MIDDLEWARE_URL?: string;
    /** Optional game-server host for World flow (default localhost). */
    readonly VITE_GAME_HOST?: string;
    /** Optional game-server port for World flow (default 1337). */
    readonly VITE_GAME_PORT?: string;
    /**
     * Optional LibreTranslate-compatible translate URL (POST { q, source, target, format }).
     * When unset, the client uses an offline demo phrase table.
     * Example (middleware proxy): http://localhost:3001/chat/translate
     */
    readonly VITE_CHAT_TRANSLATE_URL?: string;
    /**
     * Discord Application ID (public) for Rich Presence via local Discord desktop RPC.
     * Discord Developer Portal → Application → Application ID.
     */
    readonly VITE_DISCORD_CLIENT_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
