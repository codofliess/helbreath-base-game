import { Scene } from 'phaser';
import { LOADING_BG_KEY, LOGIN_SCREEN_BG_KEY } from '../../constants/RegistryKeys';
import { GROUND_ITEM_DISPLAY_STORAGE_KEY, loadGroundItemDisplaySizeFromStorage } from '../../constants/GroundItemDisplay';
import { setDebugModeEnabled, setGroundItemDisplaySize } from '../../utils/RegistryUtils';
import { ensurePendingPlayerItemAppearanceTexture } from '../../utils/pendingAppearanceTexture';
import { installWorldCanvasPoolGuard } from '../../utils/worldCanvasPoolGuardInstall';

/**
 * Initial Phaser scene. Loads loading/login backgrounds, sets registry flags (debug, displayLargeItems),
 * then starts LoadingScreen.
 */
export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    public preload() {
        this.load.setPath('assets');
        this.load.image('loading-bg', 'images/LoadingBg.jpg');
        this.load.image('login-screen-bg', 'images/LoginScreenBg.jpg');
    }

    public create() {
        installWorldCanvasPoolGuard(this.game);
        setDebugModeEnabled(this, false);
        setGroundItemDisplaySize(this, loadGroundItemDisplaySizeFromStorage(GROUND_ITEM_DISPLAY_STORAGE_KEY));

        // Isolated 1×1 canvas. generateTexture snapshots the game canvas and
        // later equip/F5 blit blanks the world (kick to landing).
        ensurePendingPlayerItemAppearanceTexture(this);

        this.registry.set(LOADING_BG_KEY, 'loading-bg');
        this.registry.set(LOGIN_SCREEN_BG_KEY, 'login-screen-bg');

        this.scene.start('LoadingScreen');
    }
}
