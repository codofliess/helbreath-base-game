import { Scene, GameObjects, type Time } from 'phaser';
import { EventBus } from '../EventBus';
import {
    OUT_UI_CREATECHAR_CANCEL,
    OUT_UI_CREATECHAR_CONFIRM,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import { Gender, SkinColor } from '../../Types';
import {
    applyLoginDeskCanvasPresentation,
    resyncLoginDeskCanvasPresentation,
    restoreLoginDeskCanvasPresentation,
} from './loginDeskPresentation';
import {
    createMenuCharacterPreview,
    MENU_WALK_CYCLES_PER_DIR,
    MENU_WALK_FRAME_MS,
    MENU_WALK_FRAMES,
    type MenuPreviewController,
} from './menuCharacterPreview';
import { Direction } from '../../utils/CoordinateUtils';
import { CHAIN_LORDS_BRAND } from './charUiMode';
import {
    CL,
    CL_GOLD,
    CL_MUTED,
    CL_PARCHMENT,
    clBodyStyle,
    clKickerStyle,
    clTitleStyle,
    drawFullWash,
    drawPortalPanel,
    drawPortraitOval,
    makeClButton,
    makeClChip,
} from './chainLordDeskSkin';
import { connectDialogStore } from '../../ui/store/ConnectDialog.store';
import { getDefaultGameHost, getDefaultGamePort } from '../../utils/serverDefaults';
import { checkCharacterNameAvailable } from '../../utils/characterNameApi';

const MAX_NAME_LEN = 10;
const SKIN_CYCLE: SkinColor[] = [SkinColor.Light, SkinColor.Tanned, SkinColor.Dark];
const STAT_KEYS = ['str', 'vit', 'dex', 'int', 'mag', 'chr'] as const;
type StatKey = (typeof STAT_KEYS)[number];
const STAT_LABELS: Record<StatKey, string> = {
    str: 'Strength',
    vit: 'Vitality',
    dex: 'Dexterity',
    int: 'Intelligence',
    mag: 'Magic',
    chr: 'Charisma',
};
const STAT_BASE = 10;
const STAT_MAX = 14;
const STAT_BUDGET = 70;
const NAME_CHECK_DEBOUNCE_MS = 350;

type NameStatusTone = 'muted' | 'ok' | 'warn' | 'error';

/**
 * Helbreath - Chain Lords Create Character — hub language, walking preview.
 * Name field uses a DOM &lt;input&gt; over the canvas so typing always works.
 */
export class CreateCharDesk {
    private readonly scene: Scene;
    private readonly root: GameObjects.Container;
    private bgImage: GameObjects.Image | undefined;
    private washGfx: GameObjects.Graphics;
    private panelGfx: GameObjects.Graphics;
    private nameFieldGfx: GameObjects.Graphics;
    private nameText: GameObjects.Text;
    private nameStatusText: GameObjects.Text;
    private genderText: GameObjects.Text;
    private skinText: GameObjects.Text;
    private hairText: GameObjects.Text;
    private underwearText: GameObjects.Text;
    private pointsLeftText: GameObjects.Text;
    private statValueTexts: Record<StatKey, GameObjects.Text>;
    private derivedText: GameObjects.Text;
    private lookSummary: GameObjects.Text;
    private preview: MenuPreviewController | undefined;
    private feetX = 0;
    private feetY = 0;
    private slotIndex = 0;
    private characterName = '';
    private gender: Gender = Gender.MALE;
    private skinColor: SkinColor = SkinColor.Light;
    private hairStyleIndex = 0;
    private underwearColorIndex = 0;
    private stats: Record<StatKey, number> = {
        str: STAT_BASE,
        vit: STAT_BASE,
        dex: STAT_BASE,
        int: STAT_BASE,
        mag: STAT_BASE,
        chr: STAT_BASE,
    };
    private pointsLeft = STAT_BUDGET - STAT_BASE * STAT_KEYS.length;
    private visible = false;
    private canvasPresentationActive = false;
    private scaleRefreshFrame: number | undefined;
    private keyHandler: ((event: KeyboardEvent) => void) | undefined;
    private menuFrame = 0;
    private menuDir: Direction = Direction.South;
    private menuDirCnt = 0;
    private menuAnimTimer: Time.TimerEvent | undefined;
    private viewW = 1280;
    private viewH = 720;
    private nameFieldRect = { x: 0, y: 0, w: 280, h: 36 };
    private nameInput: HTMLInputElement | undefined;
    private nameStatusMessage = 'Click the name field and type (2–10 letters/numbers).';
    private nameStatusTone: NameStatusTone = 'muted';
    private nameCheckTimer: number | undefined;
    private nameCheckSeq = 0;
    private nameAvailable = false;
    private nameHitZone: GameObjects.Zone | undefined;

    constructor(scene: Scene) {
        this.scene = scene;
        this.root = scene.add.container(0, 0);
        this.root.setDepth(21);
        this.root.setVisible(false);

        this.washGfx = scene.add.graphics();
        this.panelGfx = scene.add.graphics();
        this.nameFieldGfx = scene.add.graphics();
        this.root.add([this.washGfx, this.panelGfx, this.nameFieldGfx]);

        this.ensureBg();

        // Placeholder texts — positions set in layout
        this.nameText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '18px', fontStyle: 'bold' }));
        this.nameText.setVisible(false); // DOM input shows the value
        this.nameStatusText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '12px', color: CL_MUTED }));
        this.genderText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px' }));
        this.skinText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px' }));
        this.hairText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px' }));
        this.underwearText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px' }));
        this.pointsLeftText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px', color: CL_GOLD }));
        this.derivedText = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px', color: CL_MUTED }));
        this.lookSummary = scene.add.text(0, 0, '', clBodyStyle({ fontSize: '14px', color: CL_MUTED }));
        this.statValueTexts = {} as Record<StatKey, GameObjects.Text>;
        for (const key of STAT_KEYS) {
            this.statValueTexts[key] = scene.add.text(0, 0, String(STAT_BASE), clBodyStyle({
                fontSize: '14px',
                fontStyle: 'bold',
            }));
        }

        this.root.add([
            this.nameText,
            this.nameStatusText,
            this.genderText,
            this.skinText,
            this.hairText,
            this.underwearText,
            this.pointsLeftText,
            this.derivedText,
            this.lookSummary,
            ...STAT_KEYS.map((k) => this.statValueTexts[k]),
        ]);

        scene.scale.on('resize', this.onResize, this);
        window.addEventListener('resize', this.onWindowResize);
    }

    private ensureBg(): void {
        const key = 'cl-site-bg';
        if (!this.scene.textures.exists(key)) {
            this.scene.load.image(key, '/assets/images/SiteBg.jpg');
            this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => this.placeBg());
            this.scene.load.start();
        } else {
            this.placeBg();
        }
    }

    private placeBg(): void {
        const key = 'cl-site-bg';
        if (!this.scene.textures.exists(key)) {
            return;
        }
        if (!this.bgImage) {
            this.bgImage = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.5);
            this.root.addAt(this.bgImage, 0);
        }
        this.layoutBg();
    }

    private layoutBg(): void {
        if (!this.bgImage) {
            return;
        }
        const tw = this.bgImage.width || 1920;
        const th = this.bgImage.height || 1080;
        const scale = Math.max(this.viewW / tw, this.viewH / th) * 1.04;
        this.bgImage.setScale(scale).setPosition(this.viewW / 2, this.viewH / 2);
        this.bgImage.setTint(0x887766).setAlpha(0.9);
    }

    private rebuildLayout(): void {
        this.viewW = Math.max(800, this.scene.scale.width || 1280);
        this.viewH = Math.max(600, this.scene.scale.height || 720);
        this.layoutBg();
        drawFullWash(this.washGfx, this.viewW, this.viewH);
        this.panelGfx.clear();

        const leftW = Math.min(420, this.viewW * 0.4);
        const leftX = 48;
        const leftY = 110;
        const leftH = this.viewH - leftY - 48;
        drawPortalPanel(this.panelGfx, { x: leftX, y: leftY, w: leftW, h: leftH }, false);

        const rightX = leftX + leftW + 28;
        const rightW = this.viewW - rightX - 48;
        const stageH = Math.min(340, this.viewH * 0.48);
        drawPortalPanel(this.panelGfx, { x: rightX, y: leftY, w: rightW, h: stageH }, true);
        drawPortalPanel(
            this.panelGfx,
            { x: rightX, y: leftY + stageH + 16, w: rightW, h: leftH - stageH - 16 },
            false,
        );

        this.ensureStaticLabels(leftX, leftY, leftW, rightX, rightW, stageH);

        const cx = rightX + rightW / 2;
        const cy = leftY + stageH * 0.42;
        const rx = Math.min(70, rightW * 0.18);
        const ry = rx * 1.3;
        const feet = drawPortraitOval(this.panelGfx, cx, cy, rx, ry, true);
        this.feetX = feet.feetX;
        this.feetY = feet.feetY;

        this.drawNameFieldChrome();
        this.positionNameInput();
        this.refreshLabels();
    }

    private staticLabels: GameObjects.Text[] = [];
    private chipBuilt = false;

    private ensureStaticLabels(
        leftX: number,
        leftY: number,
        leftW: number,
        rightX: number,
        rightW: number,
        stageH: number,
    ): void {
        for (const t of this.staticLabels) {
            t.destroy();
        }
        this.staticLabels = [];

        const add = (t: GameObjects.Text) => {
            this.root.add(t);
            this.staticLabels.push(t);
            return t;
        };

        add(
            this.scene.add
                .text(this.viewW / 2, 28, CHAIN_LORDS_BRAND.toUpperCase(), clKickerStyle({ fontSize: '12px' }))
                .setOrigin(0.5, 0),
        );
        add(
            this.scene.add
                .text(this.viewW / 2, 48, 'Create Character', clTitleStyle({ fontSize: '34px' }))
                .setOrigin(0.5, 0),
        );
        add(
            this.scene.add
                .text(this.viewW / 2, 88, 'Type a unique name, choose look and attributes, then Create.', clBodyStyle({
                    fontSize: '16px',
                    color: CL_MUTED,
                }))
                .setOrigin(0.5, 0),
        );

        add(this.scene.add.text(leftX + 24, leftY + 24, 'Name', clBodyStyle({ fontSize: '12px', color: CL_MUTED })));
        this.nameFieldRect = {
            x: leftX + 24,
            y: leftY + 42,
            w: Math.min(320, leftW - 48),
            h: 36,
        };
        this.nameText.setPosition(leftX + 34, leftY + 50);
        this.nameStatusText.setPosition(leftX + 24, leftY + 82);
        this.nameStatusText.setWordWrapWidth(leftW - 48);

        if (!this.nameHitZone) {
            this.nameHitZone = this.scene.add
                .zone(this.nameFieldRect.x, this.nameFieldRect.y, this.nameFieldRect.w, this.nameFieldRect.h)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true });
            this.nameHitZone.on('pointerdown', () => this.focusNameInput());
            this.root.add(this.nameHitZone);
        } else {
            this.nameHitZone.setPosition(this.nameFieldRect.x, this.nameFieldRect.y);
            this.nameHitZone.setSize(this.nameFieldRect.w, this.nameFieldRect.h);
            this.nameHitZone.setInteractive({ useHandCursor: true });
        }

        let y = leftY + 110;
        const rows: Array<{ label: string; value: GameObjects.Text; left: () => void; right: () => void }> = [
            { label: 'Gender', value: this.genderText, left: () => this.cycleGender(-1), right: () => this.cycleGender(1) },
            { label: 'Skin', value: this.skinText, left: () => this.cycleSkin(-1), right: () => this.cycleSkin(1) },
            { label: 'Hair', value: this.hairText, left: () => this.cycleHair(-1), right: () => this.cycleHair(1) },
            {
                label: 'Cloth',
                value: this.underwearText,
                left: () => this.cycleUnderwear(-1),
                right: () => this.cycleUnderwear(1),
            },
        ];
        for (const row of rows) {
            add(this.scene.add.text(leftX + 24, y, row.label, clBodyStyle({ fontSize: '13px', color: CL_MUTED })));
            row.value.setPosition(leftX + 200, y);
            if (!this.chipBuilt) {
                makeClChip(this.scene, this.root, leftX + 130, y - 4, '◀', row.left, 26);
                makeClChip(this.scene, this.root, leftX + 162, y - 4, '▶', row.right, 26);
            }
            y += 36;
        }

        this.pointsLeftText.setPosition(leftX + 24, y + 8);
        y += 40;

        for (const key of STAT_KEYS) {
            add(
                this.scene.add.text(leftX + 24, y, STAT_LABELS[key], clBodyStyle({ fontSize: '13px', color: CL_PARCHMENT })),
            );
            this.statValueTexts[key].setPosition(leftX + 160, y);
            if (!this.chipBuilt) {
                makeClChip(this.scene, this.root, leftX + 200, y - 4, '+', () => this.adjustStat(key, 1), 26);
                makeClChip(this.scene, this.root, leftX + 232, y - 4, '−', () => this.adjustStat(key, -1), 26);
            }
            y += 32;
        }

        this.derivedText.setPosition(rightX + 24, leftY + stageH + 36);
        this.lookSummary.setPosition(rightX + 24, leftY + stageH + 100);

        if (!this.chipBuilt) {
            makeClButton(
                this.scene,
                this.root,
                rightX + 24,
                this.viewH - 80,
                200,
                44,
                'Create Character',
                () => this.handleCreate(),
                true,
            );
            makeClButton(
                this.scene,
                this.root,
                rightX + 240,
                this.viewH - 80,
                140,
                44,
                'Cancel',
                () => this.handleCancel(),
                false,
            );
            this.chipBuilt = true;
        }
    }

    private drawNameFieldChrome(): void {
        const r = this.nameFieldRect;
        this.nameFieldGfx.clear();
        this.nameFieldGfx.fillStyle(0x0c0804, 0.92);
        this.nameFieldGfx.fillRoundedRect(r.x, r.y, r.w, r.h, 2);
        this.nameFieldGfx.lineStyle(1, CL.goldLine, 0.7);
        this.nameFieldGfx.strokeRoundedRect(r.x, r.y, r.w, r.h, 2);
    }

    public setVisible(visible: boolean, slotIndex?: number): void {
        if (visible && this.visible) {
            if (typeof slotIndex === 'number') {
                this.slotIndex = Math.max(0, Math.min(3, slotIndex));
            }
            this.positionNameInput();
            this.focusNameInput();
            return;
        }
        if (!visible && !this.visible) {
            return;
        }

        this.visible = visible;
        this.root.setVisible(visible);
        if (visible) {
            if (typeof slotIndex === 'number') {
                this.slotIndex = Math.max(0, Math.min(3, slotIndex));
            }
            this.characterName = '';
            this.nameAvailable = false;
            this.setNameStatus('Click the name field and type (2–10 letters/numbers).', 'muted');
            this.gender = Math.random() < 0.5 ? Gender.MALE : Gender.FEMALE;
            this.skinColor = SKIN_CYCLE[Math.floor(Math.random() * SKIN_CYCLE.length)];
            this.hairStyleIndex = Math.floor(Math.random() * 8);
            this.underwearColorIndex = Math.floor(Math.random() * 8);
            this.resetStats();
            this.applyCanvasPresentation(true);
            this.mountNameInput();
            this.attachKeyboard();
            window.requestAnimationFrame(() => {
                if (!this.visible) {
                    return;
                }
                this.rebuildLayout();
                this.startMenuWalkAnimation();
                this.focusNameInput();
            });
        } else {
            this.stopMenuWalkAnimation();
            this.detachKeyboard();
            this.unmountNameInput();
            this.applyCanvasPresentation(false);
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public destroy(): void {
        this.detachKeyboard();
        this.unmountNameInput();
        this.stopMenuWalkAnimation();
        this.scene.scale.off('resize', this.onResize, this);
        window.removeEventListener('resize', this.onWindowResize);
        if (this.scaleRefreshFrame !== undefined) {
            window.cancelAnimationFrame(this.scaleRefreshFrame);
        }
        this.preview?.destroy();
        this.applyCanvasPresentation(false);
        this.root.destroy(true);
    }

    private resetStats(): void {
        for (const key of STAT_KEYS) {
            this.stats[key] = STAT_BASE;
        }
        this.pointsLeft = STAT_BUDGET - STAT_BASE * STAT_KEYS.length;
    }

    private adjustStat(key: StatKey, delta: number): void {
        if (delta > 0) {
            if (this.pointsLeft <= 0 || this.stats[key] >= STAT_MAX) {
                return;
            }
            this.stats[key] += 1;
            this.pointsLeft -= 1;
        } else if (delta < 0) {
            if (this.stats[key] <= STAT_BASE) {
                return;
            }
            this.stats[key] -= 1;
            this.pointsLeft += 1;
        }
        this.refreshLabels();
    }

    private setNameStatus(message: string, tone: NameStatusTone): void {
        this.nameStatusMessage = message;
        this.nameStatusTone = tone;
        this.nameStatusText.setText(message);
        const color =
            tone === 'ok' ? '#8fbf8a' : tone === 'error' ? '#e07070' : tone === 'warn' ? '#e0b45a' : CL_MUTED;
        this.nameStatusText.setColor(color);
    }

    private refreshLabels(): void {
        this.nameStatusText.setText(this.nameStatusMessage);
        this.genderText.setText(this.gender === Gender.MALE ? 'Male' : 'Female');
        this.skinText.setText(
            this.skinColor === SkinColor.Light
                ? 'Light'
                : this.skinColor === SkinColor.Tanned
                  ? 'Tanned'
                  : 'Dark',
        );
        this.hairText.setText(`Style ${this.hairStyleIndex + 1}`);
        this.underwearText.setText(`Color ${this.underwearColorIndex + 1}`);
        for (const key of STAT_KEYS) {
            this.statValueTexts[key].setText(String(this.stats[key]));
        }
        this.pointsLeftText.setText(
            this.pointsLeft > 0 ? `${this.pointsLeft} points left` : 'All points sealed',
        );
        this.pointsLeftText.setColor(this.pointsLeft > 0 ? CL_GOLD : '#8fbf8a');
        const hp = this.stats.vit * 3 + 2 + Math.floor(this.stats.str / 2);
        const mp = this.stats.mag * 2 + 2 + Math.floor(this.stats.int / 2);
        const sp = this.stats.str * 2 + 2;
        this.derivedText.setText(`Vitals   HP ${hp}   MP ${mp}   SP ${sp}`);
        this.lookSummary.setText(
            this.pointsLeft > 0
                ? `Allocate ${this.pointsLeft} more point${this.pointsLeft === 1 ? '' : 's'} before sealing.`
                : this.nameAvailable
                  ? 'Ready — Seal this soul to enter the World.'
                  : 'Pick an available name, then seal.',
        );
        this.refreshPreview();
    }

    private refreshPreview(): void {
        this.preview?.destroy();
        const ovalH = 200;
        this.preview = createMenuCharacterPreview(this.scene, this.root, this.feetX, this.feetY, {
            gender: this.gender,
            skinColor: this.skinColor,
            hairStyleIndex: this.hairStyleIndex,
            underwearColorIndex: this.underwearColorIndex,
            wearDefaultClothes: true,
            walkMode: true,
            fitOvalHeight: ovalH,
            fitFill: 0.92,
        });
        this.preview.setPose(this.menuDir, this.menuFrame);
    }

    private startMenuWalkAnimation(): void {
        this.stopMenuWalkAnimation();
        this.menuFrame = 0;
        this.menuDir = Direction.South;
        this.menuDirCnt = 0;
        this.preview?.setPose(this.menuDir, this.menuFrame);
        this.menuAnimTimer = this.scene.time.addEvent({
            delay: MENU_WALK_FRAME_MS,
            loop: true,
            callback: () => this.tickMenuWalkAnimation(),
        });
    }

    private stopMenuWalkAnimation(): void {
        if (this.menuAnimTimer) {
            this.menuAnimTimer.remove(false);
            this.menuAnimTimer = undefined;
        }
    }

    private tickMenuWalkAnimation(): void {
        if (!this.visible) {
            return;
        }
        this.menuFrame += 1;
        if (this.menuFrame >= MENU_WALK_FRAMES) {
            this.menuDirCnt += 1;
            if (this.menuDirCnt > MENU_WALK_CYCLES_PER_DIR) {
                this.menuDir = (((this.menuDir + 1) % 8) + 8) % 8 as Direction;
                this.menuDirCnt = 1;
            }
            this.menuFrame = 0;
        }
        this.preview?.setPose(this.menuDir, this.menuFrame);
    }

    private cycleGender(_d: number): void {
        this.gender = this.gender === Gender.MALE ? Gender.FEMALE : Gender.MALE;
        this.refreshLabels();
    }

    private cycleSkin(dir: number): void {
        const idx = SKIN_CYCLE.indexOf(this.skinColor);
        this.skinColor = SKIN_CYCLE[(idx + dir + SKIN_CYCLE.length) % SKIN_CYCLE.length];
        this.refreshLabels();
    }

    private cycleHair(dir: number): void {
        this.hairStyleIndex = (this.hairStyleIndex + dir + 8) % 8;
        this.refreshLabels();
    }

    private cycleUnderwear(dir: number): void {
        this.underwearColorIndex = (this.underwearColorIndex + dir + 8) % 8;
        this.refreshLabels();
    }

    private sanitizeName(raw: string): string {
        return raw.replace(/[^A-Za-z0-9]/g, '').slice(0, MAX_NAME_LEN);
    }

    private localNameValidation(name: string): { ok: boolean; message: string; tone: NameStatusTone } {
        if (name.length === 0) {
            return {
                ok: false,
                message: 'Click the name field and type (2–10 letters/numbers).',
                tone: 'muted',
            };
        }
        if (name.length < 2) {
            return { ok: false, message: 'Name must be at least 2 characters.', tone: 'warn' };
        }
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
            return {
                ok: false,
                message: 'Name must start with a letter (letters/numbers only).',
                tone: 'error',
            };
        }
        const slots = connectDialogStore.state.characterSlots;
        const ownConflict = slots.some(
            (s) => s.slotIndex !== this.slotIndex && s.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (ownConflict) {
            return { ok: false, message: 'You already have a character with that name.', tone: 'error' };
        }
        return { ok: true, message: 'Checking availability…', tone: 'muted' };
    }

    private onNameInputChanged(raw: string): void {
        const sanitized = this.sanitizeName(raw);
        this.characterName = sanitized;
        if (this.nameInput && this.nameInput.value !== sanitized) {
            this.nameInput.value = sanitized;
        }
        this.nameAvailable = false;
        const local = this.localNameValidation(sanitized);
        this.setNameStatus(local.message, local.tone);
        this.refreshLabels();
        if (!local.ok) {
            this.cancelNameCheck();
            return;
        }
        this.scheduleNameCheck(sanitized);
    }

    private cancelNameCheck(): void {
        if (this.nameCheckTimer !== undefined) {
            window.clearTimeout(this.nameCheckTimer);
            this.nameCheckTimer = undefined;
        }
        this.nameCheckSeq += 1;
    }

    private scheduleNameCheck(name: string): void {
        this.cancelNameCheck();
        const seq = this.nameCheckSeq;
        this.nameCheckTimer = window.setTimeout(() => {
            void this.runNameCheck(name, seq);
        }, NAME_CHECK_DEBOUNCE_MS);
    }

    private async runNameCheck(name: string, seq: number): Promise<void> {
        const session = connectDialogStore.state.walletSession;
        if (!session || seq !== this.nameCheckSeq || !this.visible) {
            return;
        }
        this.setNameStatus('Checking availability…', 'muted');
        try {
            const result = await checkCharacterNameAvailable(
                getDefaultGameHost(),
                getDefaultGamePort(),
                session.wallet,
                session.token,
                name,
            );
            if (seq !== this.nameCheckSeq || !this.visible || this.characterName !== name) {
                return;
            }
            this.nameAvailable = result.available;
            if (result.available) {
                this.setNameStatus(result.message || 'Name is available.', 'ok');
            } else {
                this.setNameStatus(result.message || 'That name is already taken.', 'error');
            }
            this.refreshLabels();
        } catch (err) {
            if (seq !== this.nameCheckSeq || !this.visible) {
                return;
            }
            // Network blip: still allow create; server re-checks on auth.
            this.nameAvailable = true;
            this.setNameStatus('Could not verify name online — will re-check on Create.', 'warn');
            this.refreshLabels();
            console.warn('[CreateCharDesk] name check failed', err);
        }
    }

    private handleCreate(): void {
        const name = this.characterName.trim();
        const local = this.localNameValidation(name);
        if (!local.ok) {
            EventBus.emit(TOAST_REQUESTED, {
                message: local.message,
                severity: 'warning',
            });
            this.focusNameInput();
            return;
        }
        // Block only when the server/local check already reported taken or invalid.
        // If still checking (or offline warn), proceed — auth re-validates on the server.
        if (!this.nameAvailable && this.nameStatusTone === 'error') {
            EventBus.emit(TOAST_REQUESTED, {
                message: this.nameStatusMessage || 'That name is already taken.',
                severity: 'warning',
            });
            this.focusNameInput();
            return;
        }
        if (this.pointsLeft > 0) {
            EventBus.emit(TOAST_REQUESTED, {
                message: `Allocate remaining ${this.pointsLeft} point${this.pointsLeft === 1 ? '' : 's'} first.`,
                severity: 'warning',
            });
            return;
        }
        EventBus.emit(OUT_UI_CREATECHAR_CONFIRM, {
            slotIndex: this.slotIndex,
            characterName: name,
            gender: this.gender,
            skinColor: this.skinColor,
            hairStyleIndex: this.hairStyleIndex,
            underwearColorIndex: this.underwearColorIndex,
            str: this.stats.str,
            vit: this.stats.vit,
            dex: this.stats.dex,
            int: this.stats.int,
            mag: this.stats.mag,
            chr: this.stats.chr,
        });
    }

    private handleCancel(): void {
        EventBus.emit(OUT_UI_CREATECHAR_CANCEL);
    }

    private mountNameInput(): void {
        this.unmountNameInput();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'createchar-name-input';
        input.maxLength = MAX_NAME_LEN;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.placeholder = 'Your name';
        input.value = this.characterName;
        input.setAttribute('aria-label', 'Character name');
        input.addEventListener('input', () => this.onNameInputChanged(input.value));
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleCreate();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.handleCancel();
            }
        });
        document.body.appendChild(input);
        this.nameInput = input;
        this.positionNameInput();
    }

    private unmountNameInput(): void {
        this.cancelNameCheck();
        if (this.nameInput) {
            this.nameInput.remove();
            this.nameInput = undefined;
        }
    }

    private focusNameInput(): void {
        if (!this.nameInput) {
            return;
        }
        try {
            this.nameInput.focus({ preventScroll: true });
            const len = this.nameInput.value.length;
            this.nameInput.setSelectionRange(len, len);
        } catch {
            this.nameInput.focus();
        }
    }

    private positionNameInput(): void {
        const input = this.nameInput;
        if (!input || !this.visible) {
            return;
        }
        const canvas = this.scene.game.canvas;
        if (!canvas) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const bufW = Math.max(1, this.scene.scale.width || this.viewW);
        const bufH = Math.max(1, this.scene.scale.height || this.viewH);
        const scaleX = rect.width / bufW;
        const scaleY = rect.height / bufH;
        const r = this.nameFieldRect;
        const left = rect.left + r.x * scaleX;
        const top = rect.top + r.y * scaleY;
        const width = r.w * scaleX;
        const height = r.h * scaleY;
        input.style.left = `${Math.round(left)}px`;
        input.style.top = `${Math.round(top)}px`;
        input.style.width = `${Math.max(80, Math.round(width))}px`;
        input.style.height = `${Math.max(28, Math.round(height))}px`;
        input.style.fontSize = `${Math.max(14, Math.round(16 * Math.min(scaleX, scaleY)))}px`;
        input.style.display = 'block';
    }

    private attachKeyboard(): void {
        this.detachKeyboard();
        // Fallback when DOM input is not focused (e.g. after clicking a chip).
        this.keyHandler = (event: KeyboardEvent) => {
            if (!this.visible) {
                return;
            }
            if (document.activeElement === this.nameInput) {
                return;
            }
            if (event.key === 'Backspace') {
                event.preventDefault();
                this.onNameInputChanged(this.characterName.slice(0, -1));
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleCreate();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                this.handleCancel();
                return;
            }
            if (event.key.length === 1 && /^[A-Za-z0-9]$/.test(event.key)) {
                event.preventDefault();
                this.onNameInputChanged(this.characterName + event.key);
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    private detachKeyboard(): void {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = undefined;
        }
    }

    private onResize = (): void => {
        if (!this.visible) {
            return;
        }
        const nextW = Math.max(800, Math.floor(this.scene.scale.width || 0));
        const nextH = Math.max(600, Math.floor(this.scene.scale.height || 0));
        if (Math.abs(nextW - this.viewW) < 8 && Math.abs(nextH - this.viewH) < 8) {
            this.positionNameInput();
            return;
        }
        this.scheduleLayout();
    };

    private onWindowResize = (): void => {
        if (!this.visible) {
            return;
        }
        this.applyCanvasPresentation(true);
        this.scheduleLayout();
    };

    private applyCanvasPresentation(active: boolean): void {
        this.canvasPresentationActive = active
            ? applyLoginDeskCanvasPresentation(this.scene, this.canvasPresentationActive)
            : restoreLoginDeskCanvasPresentation(this.scene, this.canvasPresentationActive);
        if (this.canvasPresentationActive) {
            if (this.scaleRefreshFrame !== undefined) {
                window.cancelAnimationFrame(this.scaleRefreshFrame);
            }
            this.scaleRefreshFrame = window.requestAnimationFrame(() => {
                this.scaleRefreshFrame = undefined;
                if (this.canvasPresentationActive) {
                    resyncLoginDeskCanvasPresentation(this.scene);
                }
                this.positionNameInput();
            });
        }
    }

    private scheduleLayout(): void {
        if (this.scaleRefreshFrame !== undefined) {
            window.cancelAnimationFrame(this.scaleRefreshFrame);
        }
        this.scaleRefreshFrame = window.requestAnimationFrame(() => {
            this.scaleRefreshFrame = undefined;
            if (this.visible) {
                this.rebuildLayout();
            }
        });
    }
}
