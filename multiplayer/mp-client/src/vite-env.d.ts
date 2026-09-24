/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PLAYTEST?: string;
    readonly VITE_PLAYER_MODE?: string;
    readonly VITE_GAME_HOST?: string;
    readonly VITE_GAME_PORT?: string;
    readonly VITE_MIDDLEWARE_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
