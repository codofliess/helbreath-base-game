/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PLAYTEST?: string;
    readonly VITE_PLAYTEST_CHARACTER_NAME?: string;
    readonly VITE_PLAYTEST_NETWORK_ID?: string;
    readonly VITE_PLAYTEST_WS_HOST?: string;
    readonly VITE_PLAYTEST_WS_PORT?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
