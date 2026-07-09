import { Scene } from 'phaser';
import { drawAppTitle, drawVersionNumber } from '../../utils/SpriteUtils';
import { createGameStateManager, getInventoryManager, getLoginScreenBgKey } from '../../utils/RegistryUtils';

/**
 * Login screen with real username/password fields.
 */
export class LoginScreen extends Scene {
    private backgroundImage!: Phaser.GameObjects.Image;

    constructor() {
        super('LoginScreen');
    }

    public init() {
        this.cameras.main.setBackgroundColor(0x000000);

        const width = this.scale.width;
        const height = this.scale.height;

        const loginBgKey = getLoginScreenBgKey(this);

        if (loginBgKey && this.textures.exists(loginBgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, loginBgKey);
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.backgroundImage.setScale(scale);
            this.backgroundImage.setDepth(0);
        }

        createGameStateManager(this.game);
    }

    public create() {
        const width = this.scale.width;
        const height = this.scale.height;

        drawAppTitle(this);
        drawVersionNumber(this);

        // === HTML OVERLAY PARA LOGIN (más fácil y funcional) ===
        const loginHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.85); padding: 30px; border-radius: 12px; border: 3px solid #8b5a2b; text-align: center; width: 380px; box-shadow: 0 0 30px #000;">
                <h2 style="color:#f4e4c1; margin-bottom:20px;">Helbreath</h2>
                <input id="username" type="text" placeholder="Usuario" style="width:100%; padding:12px; margin:8px 0; border-radius:6px; border:none; font-size:16px;">
                <input id="password" type="password" placeholder="Contraseña" style="width:100%; padding:12px; margin:8px 0; border-radius:6px; border:none; font-size:16px;">
                <button id="loginBtn" style="width:100%; padding:14px; margin-top:15px; background:#8b5a2b; color:white; border:none; border-radius:8px; font-size:18px; font-weight:bold; cursor:pointer;">Log in</button>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = loginHTML;
        document.getElementById('app')!.appendChild(div);

        // Click handler
        const btn = div.querySelector('#loginBtn') as HTMLButtonElement;
        btn.onclick = () => {
            const username = (div.querySelector('#username') as HTMLInputElement).value;
            const password = (div.querySelector('#password') as HTMLInputElement).value;

            if (username && password) {
                // Por ahora simulamos login exitoso
                console.log(`🔑 Login intentado con usuario: ${username}`);
                // Unlock Web Audio after user gesture (required by browser autoplay policy)
                this.sound.unlock();
                div.remove(); // quitamos el formulario HTML
                getInventoryManager(this.game);
                this.scene.start('GameWorld');
            } else {
                alert('Por favor ingresa usuario y contraseña');
            }
        };
    }
}