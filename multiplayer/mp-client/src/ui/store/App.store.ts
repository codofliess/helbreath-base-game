import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../../constants/EventNames';
import { CURSOR_POINTER } from '../../constants/SpriteKeys';

interface AppState {
    spriteFrameMap: Map<string, string>;
    cursorSpriteKey: string;
}

const initialState: AppState = {
    spriteFrameMap: new Map(),
    cursorSpriteKey: CURSOR_POINTER,
};

export const appStore = new Store<AppState>(initialState);

export const setSpriteFrame = (key: string, dataUrl: string) => {
    appStore.setState((state) => {
        // Skip no-op updates — minimap thumb retries must not re-render the whole app.
        if (state.spriteFrameMap.get(key) === dataUrl) {
            return state;
        }
        return {
            ...state,
            spriteFrameMap: new Map(state.spriteFrameMap).set(key, dataUrl),
        };
    });
};

export const setCursorSpriteKey = (key: string) => {
    appStore.setState((state) => ({ ...state, cursorSpriteKey: key }));
};

// Listen to sprite frame extraction events from Phaser via EventBus
EventBus.on(OUT_SPRITE_FRAME_EXTRACTED, (key: string, dataUrl: string) => {
    // Empty string = clear layer (e.g. bald paper-doll hair).
    if (!dataUrl) {
        appStore.setState((state) => {
            const next = new Map(state.spriteFrameMap);
            next.delete(key);
            return { ...state, spriteFrameMap: next };
        });
        return;
    }
    setSpriteFrame(key, dataUrl);
});
