import { Scene, GameObjects, type Time } from 'phaser';
import { EventBus } from '../EventBus';
import {
    OUT_UI_SELECTCHAR_ACTION,
    OUT_UI_SELECTCHAR_BACK,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import {
    normalizeCitizenshipSide,
    type CharacterSlotSummary,
} from '../../utils/characterListApi';
import {
    setConnectGatePhase,
    setSelectedSlotIndex,
    connectDialogStore,
} from '../../ui/store/ConnectDialog.store';
import { Gender, SkinColor } from '../../Types';
import {
    applyLoginDeskCanvasPresentation,
    holdLoginDeskCanvasPresentation,
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
import { getStoredWalletPubkey, getStoredWalletToken } from '../../utils/walletAuth';
import { CHAIN_LORDS_BRAND } from './charUiMode';
import { getItemById } from '../../constants/Items';
import { OLYMPIA_SUPER_RARE_ITEM_IDS } from '../../utils/olympiaDropRules';
import { fetchUnclaimedDrops, type UnclaimedDrop } from '../../utils/dropLedger';
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
} from './chainLordDeskSkin';

/** ~1cm in CSS px (96dpi). */
const CM_PX = 38;
/** Left list row was 108 → +50% height target. */
const LIST_ROW_H_TARGET = Math.round(108 * 1.5); // 162
/** Center oval +20% vs previous ship. */
const HERO_OVAL_SCALE = 1.2;
/**
 * Oval fill fraction for auto-fit scale.
 * Keep hero under ~0.72: classic sprs are tiny; filling 90%+ at NEAREST looks brick-like in Chrome.
 * LINEAR filter + slightly smaller fill reads cleaner (closer to Comet’s smoother default).
 */
const LIST_OVAL_FILL = 0.82;
const HERO_OVAL_FILL = 0.7;

const MIDDLEWARE_URL =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIDDLEWARE_URL) ||
    'http://localhost:3001';

interface HellStatusSnapshot {
    pendingHell: number | null;
    claimedHell: number | null;
    mint: string | null;
    miningConfigured: boolean;
    note?: string;
}

interface SlotVisuals {
    cardGfx: GameObjects.Graphics;
    zone: GameObjects.Zone;
    nameValue: GameObjects.Text;
    levValue: GameObjects.Text;
    /** City seal drawn on the empty right half of the slot card. */
    citySealGfx: GameObjects.Graphics;
    citySealLabel: GameObjects.Text;
    feetX: number;
    feetY: number;
    /** Last laid-out list card rect (for seal placement). */
    listRect: { x: number; y: number; w: number; h: number };
    preview: MenuPreviewController | undefined;
    /** Mini walk only (list). Selected uses center hero feet. */
    isHeroStage: boolean;
}

/**
 * Helbreath - Chain Lords Character List — layout B only.
 * Left: 4 slots (+50%). Center: walking hero. Right: gear/status detail.
 * Bottom: classic action buttons in a horizontal row.
 */
export class SelectCharDesk {
    private readonly scene: Scene;
    private readonly root: GameObjects.Container;
    private bgImage: GameObjects.Image | undefined;
    private washGfx: GameObjects.Graphics;
    private detailGfx: GameObjects.Graphics;
    private chromeGfx: GameObjects.Graphics;
    private readonly slotVisuals: SlotVisuals[] = [];
    private ephemeral: GameObjects.GameObject[] = [];
    private detailTexts: GameObjects.Text[] = [];
    private heroNameText: GameObjects.Text | undefined;
    private heroMetaText: GameObjects.Text | undefined;
    private walletText: GameObjects.Text | undefined;
    private statusHint: GameObjects.Text | undefined;
    private slots: CharacterSlotSummary[] = [];
    private selectedSlotIndex = 0;
    private visible = false;
    private canvasPresentationActive = false;
    private scaleRefreshFrame: number | undefined;
    private ignoreActionsUntilMs = 0;
    private keyHandler: ((event: KeyboardEvent) => void) | undefined;
    private menuFrame = 0;
    private menuDir: Direction = Direction.South;
    private menuDirCnt = 0;
    private menuAnimTimer: Time.TimerEvent | undefined;
    private viewW = 1280;
    private viewH = 720;
    private walletRevealed = false;
    private heroFeetX = 0;
    private heroFeetY = 0;
    /** Full oval heights (2 * ry) for auto-fit sprite scale. */
    private heroOvalH = 280;
    private listOvalH = 130;
    /** Guard: presentation resize must not re-enter rebuild forever. */
    private rebuilding = false;
    private layoutDirty = false;
    private walletPanelOpen = false;
    private walletPanelRoot: GameObjects.Container | undefined;

    constructor(scene: Scene) {
        this.scene = scene;
        this.root = scene.add.container(0, 0);
        this.root.setDepth(20);
        this.root.setVisible(false);

        this.washGfx = scene.add.graphics();
        this.detailGfx = scene.add.graphics();
        this.chromeGfx = scene.add.graphics();
        this.root.add([this.washGfx, this.detailGfx, this.chromeGfx]);

        this.ensureBg();
        for (let i = 0; i < 4; i++) {
            this.slotVisuals.push(this.createSlotShell(i));
        }

        // Do not rebuild in constructor — scale may be 0 / mid-presentation.
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
        const scale = Math.max(this.viewW / tw, this.viewH / th) * 1.05;
        this.bgImage.setScale(scale).setPosition(this.viewW / 2, this.viewH / 2);
        this.bgImage.setTint(0x887766).setAlpha(0.88);
    }

    private createSlotShell(index: number): SlotVisuals {
        const cardGfx = this.scene.add.graphics();
        this.root.add(cardGfx);
        const citySealGfx = this.scene.add.graphics();
        this.root.add(citySealGfx);
        const zone = this.scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.handleSlotClick(index));
        this.root.add(zone);
        const nameValue = this.scene.add
            .text(0, 0, '', clBodyStyle({ fontSize: '18px', color: CL_PARCHMENT, fontStyle: 'bold' }))
            .setOrigin(0, 0);
        const levValue = this.scene.add
            .text(0, 0, '', clBodyStyle({ fontSize: '16px', color: CL_MUTED }))
            .setOrigin(0, 0);
        const citySealLabel = this.scene.add
            .text(0, 0, '', clKickerStyle({ fontSize: '11px', color: CL_GOLD }))
            .setOrigin(0.5, 0);
        this.root.add([nameValue, levValue, citySealLabel]);
        return {
            cardGfx,
            zone,
            nameValue,
            levValue,
            citySealGfx,
            citySealLabel,
            feetX: 0,
            feetY: 0,
            listRect: { x: 0, y: 0, w: 0, h: 0 },
            preview: undefined,
            isHeroStage: false,
        };
    }

    private clearEphemeral(): void {
        for (const o of this.ephemeral) {
            o.destroy();
        }
        this.ephemeral = [];
        for (const t of this.detailTexts) {
            t.destroy();
        }
        this.detailTexts = [];
        this.heroNameText = undefined;
        this.heroMetaText = undefined;
        this.walletText = undefined;
        this.statusHint = undefined;
    }

    private addEph(obj: GameObjects.GameObject): void {
        this.root.add(obj);
        this.ephemeral.push(obj);
    }

    private addDetailText(t: GameObjects.Text): GameObjects.Text {
        this.root.add(t);
        this.detailTexts.push(t);
        return t;
    }

    private rebuild(): void {
        if (this.rebuilding) {
            this.layoutDirty = true;
            return;
        }
        this.rebuilding = true;
        try {
            this.rebuildInner();
        } finally {
            this.rebuilding = false;
            if (this.layoutDirty) {
                this.layoutDirty = false;
                // One deferred pass if something marked dirty mid-build.
                window.requestAnimationFrame(() => {
                    if (this.visible) {
                        this.rebuild();
                    }
                });
            }
        }
    }

    private rebuildInner(): void {
        // Avoid stale modal geometry after resize.
        this.closeWalletPanel();
        this.clearEphemeral();
        const nextW = Math.max(900, Math.floor(this.scene.scale.width || window.innerWidth || 1280));
        const nextH = Math.max(600, Math.floor(this.scene.scale.height || window.innerHeight || 720));
        this.viewW = nextW;
        this.viewH = nextH;
        this.layoutBg();
        drawFullWash(this.washGfx, this.viewW, this.viewH);
        this.chromeGfx.clear();
        this.detailGfx.clear();

        // Header
        this.addEph(
            this.scene.add
                .text(this.viewW / 2, 18, CHAIN_LORDS_BRAND.toUpperCase(), clKickerStyle({
                    fontSize: '14px',
                }))
                .setOrigin(0.5, 0),
        );
        this.addEph(
            this.scene.add
                .text(this.viewW / 2, 40, 'Character List', clTitleStyle({ fontSize: '36px' }))
                .setOrigin(0.5, 0),
        );
        const hasAny = this.slots.length > 0;
        this.addEph(
            this.scene.add
                .text(
                    this.viewW / 2,
                    84,
                    hasAny
                        ? 'Select a character and Start — or Create Character in an empty slot.'
                        : 'Step 1: Create Character (name + looks + stats). Step 2: Start that character.',
                    clBodyStyle({
                        fontSize: '16px',
                        color: CL_MUTED,
                    }),
                )
                .setOrigin(0.5, 0),
        );

        this.layoutListColumn();
        this.layoutHeroCenter();
        this.layoutDetailPanel();
        this.layoutBottomButtons();
        this.refreshSlotTexts();
    }

    /** Left column: 4 slots, +50% taller, large type + proportional ovals. */
    private layoutListColumn(): void {
        const listX = 28;
        const listY = 112;
        const w = Math.min(420, this.viewW * 0.3);
        // Leave room for buttons raised 1cm + wallet row.
        const listBottom = this.viewH - 120 - CM_PX;
        const gap = 10;
        const maxRow = Math.floor((listBottom - listY - 3 * gap) / 4);
        const rowH = Math.max(120, Math.min(LIST_ROW_H_TARGET, maxRow));

        for (let i = 0; i < 4; i++) {
            const sel = i === this.selectedSlotIndex;
            const y = listY + i * (rowH + gap);
            const visual = this.slotVisuals[i];
            visual.cardGfx.clear();
            drawPortalPanel(visual.cardGfx, { x: listX, y, w, h: rowH }, sel);
            visual.listRect = { x: listX, y, w, h: rowH };
            visual.zone.setPosition(listX + w / 2, y + rowH / 2);
            visual.zone.setSize(w, rowH);

            // Oval sized to the taller slot — feet low so body fills the disc.
            // Keep oval on the LEFT half so the RIGHT half holds the city seal.
            const ovalRx = Math.min(48, rowH * 0.3);
            const ovalRy = Math.min(70, rowH * 0.44);
            this.listOvalH = ovalRy * 2;
            const miniCx = listX + 16 + ovalRx;
            const miniCy = y + rowH / 2;
            drawPortraitOval(visual.cardGfx, miniCx, miniCy, ovalRx, ovalRy, sel);
            // Feet near bottom of oval (body grows upward into the disc).
            visual.feetX = miniCx;
            visual.feetY = miniCy + ovalRy * 0.72;
            visual.isHeroStage = false;

            // Name / lev sit above the seal on the right half.
            const textX = listX + w * 0.52;
            visual.nameValue.setPosition(textX, y + rowH * 0.12);
            visual.nameValue.setFontSize(18);
            visual.nameValue.setColor(CL_PARCHMENT);
            visual.levValue.setPosition(textX, y + rowH * 0.28);
            visual.levValue.setFontSize(15);
            visual.levValue.setColor(CL_MUTED);
        }
    }

    /**
     * City seal on the empty right half of a list card.
     * Aresden = red, Elvine = blue (hub goddess colors).
     */
    private paintCitySeal(
        visual: SlotVisuals,
        side: 'aresden' | 'elvine' | 'traveler' | undefined,
        occupied: boolean,
    ): void {
        const g = visual.citySealGfx;
        g.clear();
        if (!occupied) {
            visual.citySealLabel.setText('').setVisible(false);
            return;
        }

        const { x, y, w, h } = visual.listRect;
        // Center of the right half of the rectangle.
        const cx = x + w * 0.72;
        const cy = y + h * 0.58;
        const r = Math.min(36, h * 0.28);

        const city = side === 'aresden' || side === 'elvine' ? side : 'traveler';
        const fill =
            city === 'aresden' ? 0x5a1810 : city === 'elvine' ? 0x142848 : 0x2a2218;
        const stroke =
            city === 'aresden' ? 0xd06048 : city === 'elvine' ? 0x5888d0 : 0x8a7040;
        const label =
            city === 'aresden' ? 'ARESDEN' : city === 'elvine' ? 'ELVINE' : 'TRAVELER';
        const labelColor =
            city === 'aresden' ? '#e8a090' : city === 'elvine' ? '#a8c8f0' : CL_MUTED;

        // Outer seal disc
        g.fillStyle(fill, 0.92);
        g.fillCircle(cx, cy, r);
        g.lineStyle(2.5, stroke, 1);
        g.strokeCircle(cx, cy, r);
        // Gold inner ring (hub portal language)
        g.lineStyle(1.5, CL.gold, 0.65);
        g.strokeCircle(cx, cy, r * 0.72);
        // Small hub “sigil” dot
        g.fillStyle(stroke, 1);
        g.fillCircle(cx, cy - r * 0.12, Math.max(3, r * 0.14));

        visual.citySealLabel
            .setText(label)
            .setVisible(true)
            .setPosition(cx, cy + r * 0.28)
            .setColor(labelColor)
            .setFontSize(Math.max(10, Math.floor(r * 0.32)));
    }

    /** True center of screen for selected character (+20% oval). */
    private layoutHeroCenter(): void {
        const cx = this.viewW * 0.5;
        const cy = this.viewH * 0.4;
        const rx = Math.min(120, this.viewW * 0.1) * HERO_OVAL_SCALE;
        const ry = rx * 1.38;
        this.heroOvalH = ry * 2;

        this.chromeGfx.fillStyle(CL.ovalFill, 0.65);
        this.chromeGfx.fillEllipse(cx, cy, rx * 2, ry * 2);
        this.chromeGfx.lineStyle(2, CL.gold, 0.75);
        this.chromeGfx.strokeEllipse(cx, cy, rx * 2, ry * 2);

        // Feet near bottom of oval — body fills upward through most of the disc.
        this.heroFeetX = cx;
        this.heroFeetY = cy + ry * 0.78;

        this.heroNameText = this.scene.add
            .text(cx, cy + ry + 18, '', clTitleStyle({ fontSize: '30px' }))
            .setOrigin(0.5, 0);
        this.heroMetaText = this.scene.add
            .text(cx, cy + ry + 54, '', clBodyStyle({ fontSize: '18px', color: CL_MUTED }))
            .setOrigin(0.5, 0);
        this.addEph(this.heroNameText);
        this.addEph(this.heroMetaText);
    }

    /** Right panel: legendary row, rare row, status/stats/hunt. */
    private layoutDetailPanel(): void {
        const panelW = Math.min(400, this.viewW * 0.28);
        const panelX = this.viewW - panelW - 28;
        const panelY = 112;
        // Clear the raised action row + wallet vault button.
        const panelH = this.viewH - panelY - 120 - CM_PX;
        drawPortalPanel(this.detailGfx, { x: panelX, y: panelY, w: panelW, h: panelH }, false);

        this.addDetailText(
            this.scene.add.text(panelX + 18, panelY + 16, 'CHARACTER DETAIL', clKickerStyle({
                fontSize: '13px',
            })),
        );
        // Content filled in refreshDetailPanel
        this.refreshDetailPanel(panelX, panelY, panelW, panelH);
    }

    private refreshDetailPanel(panelX?: number, panelY?: number, panelW?: number, panelH?: number): void {
        // Destroy only detail body texts (keep header if we re-call from refreshSlotTexts)
        for (const t of this.detailTexts) {
            t.destroy();
        }
        this.detailTexts = [];

        const w = panelW ?? Math.min(400, this.viewW * 0.28);
        const x = panelX ?? this.viewW - w - 28;
        const y = panelY ?? 120;
        const h = panelH ?? this.viewH - y - 110;

        const add = (tx: number, ty: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
            this.addDetailText(this.scene.add.text(tx, ty, text, style));

        add(x + 18, y + 16, 'CHARACTER DETAIL', clKickerStyle({ fontSize: '13px' }));

        const occupied = this.slotForIndex(this.selectedSlotIndex);
        if (!occupied) {
            add(
                x + 18,
                y + 56,
                'Empty slot\n\nClick Create Character\nto bind a new player here.',
                clBodyStyle({ fontSize: '17px', color: CL_MUTED, wordWrap: { width: w - 36 }, lineSpacing: 6 }),
            );
            return;
        }

        const { legendary, rare } = this.classifyEquipped(occupied);
        let yy = y + 48;

        add(x + 18, yy, 'LEGENDARY ITEMS', clKickerStyle({ fontSize: '12px', color: '#e8c060' }));
        yy += 22;
        const legLine = legendary.length > 0 ? legendary.join('  ·  ') : '— none equipped —';
        add(x + 18, yy, legLine, clBodyStyle({
            fontSize: '15px',
            color: '#f0d080',
            wordWrap: { width: w - 36 },
            lineSpacing: 4,
        }));
        yy += legendary.length > 0 ? 28 + Math.floor(legendary.length / 3) * 18 : 28;

        add(x + 18, yy, 'RARE ITEMS', clKickerStyle({ fontSize: '12px', color: '#a0c0e8' }));
        yy += 22;
        const rareLine = rare.length > 0 ? rare.join('  ·  ') : '— none equipped —';
        add(x + 18, yy, rareLine, clBodyStyle({
            fontSize: '15px',
            color: '#b8d0f0',
            wordWrap: { width: w - 36 },
            lineSpacing: 4,
        }));
        yy += rare.length > 0 ? 28 + Math.floor(rare.length / 3) * 18 : 28;

        add(x + 18, yy, 'STATUS', clKickerStyle({ fontSize: '12px' }));
        yy += 24;

        const rebirth =
            occupied.rebirth > 0 ? `  ·  Rebirth +${occupied.rebirth}` : '';
        const hours =
            occupied.hoursPlayed > 0
                ? `${occupied.hoursPlayed.toFixed(1)} h played`
                : 'Hours: —';

        const city = normalizeCitizenshipSide(occupied.citizenshipSide);
        const cityLabel =
            city === 'aresden' ? 'Aresden (War)' : city === 'elvine' ? 'Elvine (Grace)' : 'Traveler';
        const statusBlock = [
            `City seal: ${cityLabel}`,
            `Level ${occupied.level}${rebirth}`,
            hours,
            '',
            'Attributes',
            `STR ${occupied.str}   VIT ${occupied.vit}   DEX ${occupied.dex}`,
            `INT ${occupied.intel}   MAG ${occupied.mag}   CHR ${occupied.chr}`,
            '',
            'Hunt profile',
            'Highest monster tiers: — (play to fill)',
            'Recent hunt zones: —',
        ].join('\n');

        add(x + 18, yy, statusBlock, clBodyStyle({
            fontSize: '16px',
            color: CL_PARCHMENT,
            wordWrap: { width: w - 36 },
            lineSpacing: 5,
        }));

        void h;
    }

    private classifyEquipped(slot: CharacterSlotSummary): { legendary: string[]; rare: string[] } {
        const legendary: string[] = [];
        const rare: string[] = [];
        for (const eq of slot.equipped ?? []) {
            if (!eq?.itemId) {
                continue;
            }
            const def = getItemById(eq.itemId);
            const name = def?.name?.trim() || `Item ${eq.itemId}`;
            if (OLYMPIA_SUPER_RARE_ITEM_IDS.has(eq.itemId)) {
                legendary.push(name);
            } else {
                // Equipped non-legendary shown as rare candidates (list has no magic-roll attr yet).
                rare.push(name);
            }
        }
        return { legendary, rare };
    }

    /** Classic buttons, horizontal row ~1cm above wallet line. */
    private layoutBottomButtons(): void {
        const selectedOccupied = !!this.slotForIndex(this.selectedSlotIndex);
        const labels: Array<{ label: string; primary: boolean; fn: () => void; enabled?: boolean }> = [
            {
                label: 'Start',
                primary: selectedOccupied,
                enabled: selectedOccupied,
                fn: () => this.handleActionClick(0),
            },
            {
                label: 'Create Character',
                primary: !selectedOccupied,
                enabled: true,
                fn: () => this.handleActionClick(1),
            },
            { label: 'Delete Character', primary: false, enabled: true, fn: () => this.handleActionClick(2) },
            { label: 'Change Password', primary: false, enabled: true, fn: () => this.handleActionClick(3) },
            { label: 'Log Out', primary: false, enabled: true, fn: () => this.handleActionClick(4) },
        ];

        const btnW = Math.min(180, (this.viewW - 80) / labels.length - 10);
        const btnH = 40;
        const gap = 12;
        const totalW = labels.length * btnW + (labels.length - 1) * gap;
        let x = (this.viewW - totalW) / 2;
        // Raised ~1cm so they clear the wallet row.
        const y = this.viewH - 72 - CM_PX;

        for (const a of labels) {
            const enabled = a.enabled !== false;
            const btn = makeClButton(
                this.scene,
                this.root,
                x,
                y,
                btnW,
                btnH,
                a.label,
                enabled
                    ? a.fn
                    : () => {
                          EventBus.emit(TOAST_REQUESTED, {
                              message: 'Create a character first, then Start.',
                              severity: 'warning',
                              autoClose: 3500,
                          });
                      },
                a.primary && enabled,
            );
            if (!enabled) {
                btn.root.setAlpha(0.45);
            }
            this.ephemeral.push(btn.root);
            x += btnW + gap;
        }

        // Wallet / $HELL sits LEFT of the React Referral strip (cl-ref-panel is
        // centered min(920px) over the canvas — Phaser under HTML loses clicks in that band).
        const refW = Math.min(920, this.viewW - 24);
        const refLeft = (this.viewW - refW) / 2;
        const vaultW = 168;
        const vaultH = 32;
        const vaultGap = 14;
        const vaultX = Math.max(16, refLeft - vaultW - vaultGap);
        // Vertically align with the middle of the referral card (~bottom strip).
        const vaultY = this.viewH - 88;
        this.walletText = this.scene.add
            .text(vaultX + vaultW / 2, vaultY - 14, '', clBodyStyle({ fontSize: '12px', color: CL_MUTED }))
            .setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true });
        this.walletText.on('pointerdown', () => {
            this.walletRevealed = !this.walletRevealed;
            this.refreshWalletRow();
        });
        this.addEph(this.walletText);

        const vaultBtn = makeClButton(
            this.scene,
            this.root,
            vaultX,
            vaultY,
            vaultW,
            vaultH,
            'Wallet / $HELL',
            () => this.openWalletPanel(),
            true,
        );
        this.ephemeral.push(vaultBtn.root);
        this.refreshWalletRow();
    }

    private async openWalletPanel(): Promise<void> {
        if (this.walletPanelOpen) {
            this.closeWalletPanel();
            return;
        }
        this.walletPanelOpen = true;
        this.renderWalletPanelShell('Loading wallet vault…');

        const wallet = this.resolveWallet();
        if (!wallet) {
            this.renderWalletPanelShell('No wallet bound. Bind your seal from the hub first.');
            return;
        }

        try {
            const [hell, drops] = await Promise.all([
                this.fetchHellStatus(wallet),
                fetchUnclaimedDrops(wallet).catch(() => [] as UnclaimedDrop[]),
            ]);
            if (!this.walletPanelOpen || !this.visible) {
                return;
            }
            this.renderWalletPanelContent(wallet, hell, drops);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load wallet vault.';
            this.renderWalletPanelShell(msg);
        }
    }

    private closeWalletPanel(): void {
        this.walletPanelOpen = false;
        this.walletPanelRoot?.destroy(true);
        this.walletPanelRoot = undefined;
    }

    private async fetchHellStatus(wallet: string): Promise<HellStatusSnapshot> {
        const token = getStoredWalletToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers['X-Wallet-Token'] = token;
        }
        const res = await fetch(
            `${MIDDLEWARE_URL}/hell/status?wallet=${encodeURIComponent(wallet)}`,
            { headers },
        );
        if (!res.ok) {
            throw new Error(`$HELL status failed (${res.status})`);
        }
        const body = (await res.json()) as {
            pendingHell?: number | null;
            claimedHell?: number | null;
            mint?: string | null;
            miningConfigured?: boolean;
            note?: string;
        };
        return {
            pendingHell: body.pendingHell ?? null,
            claimedHell: body.claimedHell ?? null,
            mint: body.mint ?? null,
            miningConfigured: Boolean(body.miningConfigured),
            note: body.note,
        };
    }

    private renderWalletPanelShell(message: string): void {
        this.walletPanelRoot?.destroy(true);
        const panel = this.scene.add.container(0, 0);
        panel.setDepth(80);
        this.walletPanelRoot = panel;

        const dim = this.scene.add.graphics();
        dim.fillStyle(0x0a0602, 0.78);
        dim.fillRect(0, 0, this.viewW, this.viewH);
        panel.add(dim);
        const dimZone = this.scene.add
            .zone(this.viewW / 2, this.viewH / 2, this.viewW, this.viewH)
            .setInteractive({ useHandCursor: false });
        dimZone.on('pointerdown', () => this.closeWalletPanel());
        panel.add(dimZone);

        const pw = Math.min(560, this.viewW - 80);
        const ph = Math.min(480, this.viewH - 80);
        const px = (this.viewW - pw) / 2;
        const py = (this.viewH - ph) / 2;
        const frame = this.scene.add.graphics();
        drawPortalPanel(frame, { x: px, y: py, w: pw, h: ph }, true);
        panel.add(frame);

        panel.add(
            this.scene.add
                .text(px + pw / 2, py + 22, 'WALLET VAULT', clKickerStyle({ fontSize: '14px' }))
                .setOrigin(0.5, 0),
        );
        panel.add(
            this.scene.add
                .text(px + pw / 2, py + 48, 'Helbreath - Chain Lords · $HELL & NFTs', clTitleStyle({
                    fontSize: '22px',
                }))
                .setOrigin(0.5, 0),
        );
        panel.add(
            this.scene.add
                .text(px + 28, py + 100, message, clBodyStyle({
                    fontSize: '16px',
                    color: CL_MUTED,
                    wordWrap: { width: pw - 56 },
                    lineSpacing: 6,
                }))
                .setOrigin(0, 0),
        );

        makeClButton(
            this.scene,
            panel,
            px + pw - 120,
            py + 16,
            96,
            30,
            'Close',
            () => this.closeWalletPanel(),
            false,
        );
        this.root.add(panel);
    }

    private renderWalletPanelContent(
        wallet: string,
        hell: HellStatusSnapshot,
        drops: UnclaimedDrop[],
    ): void {
        this.walletPanelRoot?.destroy(true);
        const panel = this.scene.add.container(0, 0);
        panel.setDepth(80);
        this.walletPanelRoot = panel;

        const dim = this.scene.add.graphics();
        dim.fillStyle(0x0a0602, 0.78);
        dim.fillRect(0, 0, this.viewW, this.viewH);
        panel.add(dim);
        const dimZone = this.scene.add
            .zone(this.viewW / 2, this.viewH / 2, this.viewW, this.viewH)
            .setInteractive({ useHandCursor: false });
        dimZone.on('pointerdown', () => this.closeWalletPanel());
        panel.add(dimZone);

        const pw = Math.min(620, this.viewW - 60);
        const ph = Math.min(540, this.viewH - 60);
        const px = (this.viewW - pw) / 2;
        const py = (this.viewH - ph) / 2;
        const frame = this.scene.add.graphics();
        drawPortalPanel(frame, { x: px, y: py, w: pw, h: ph }, true);
        // Absorb clicks inside the card so dim doesn't close mid-read.
        const block = this.scene.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive();
        block.on('pointerdown', () => {
            /* swallow */
        });
        panel.add(frame);
        panel.add(block);

        const add = (x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) => {
            const t = this.scene.add.text(x, y, text, style).setOrigin(0, 0);
            panel.add(t);
            return t;
        };

        add(px + 28, py + 18, 'WALLET VAULT', clKickerStyle({ fontSize: '13px' }));
        add(px + 28, py + 40, 'Helbreath - Chain Lords', clTitleStyle({ fontSize: '24px' }));
        makeClButton(this.scene, panel, px + pw - 120, py + 16, 96, 30, 'Close', () => this.closeWalletPanel(), false);

        const shortW =
            wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
        let y = py + 84;
        add(px + 28, y, `Seal  ${shortW}`, clBodyStyle({ fontSize: '15px', color: CL_MUTED }));
        y += 28;

        add(px + 28, y, '$HELL TOKEN', clKickerStyle({ fontSize: '12px', color: CL_GOLD }));
        y += 22;
        const pending = hell.pendingHell ?? 0;
        const claimed = hell.claimedHell ?? 0;
        const mintShort = hell.mint
            ? `${hell.mint.slice(0, 6)}…${hell.mint.slice(-4)}`
            : '— not configured —';
        add(
            px + 28,
            y,
            [
                `Active mint: ${mintShort}`,
                `Mining vault: ${hell.miningConfigured ? 'ready' : 'offline'}`,
                `Credits / pending $HELL:  ${pending}`,
                `Claimed / stacked $HELL:  ${claimed}`,
                '',
                'Earned by mode (play-mine):',
                '  · Monster kills → credits  (500 kills/day → tokens)',
                '  · Legendary EK / top ranks → bonus credits',
                '  · Timed Challenge clear → daily bonus',
                '  · Stake: does not mint (policy C1)',
            ].join('\n'),
            clBodyStyle({
                fontSize: '15px',
                color: CL_PARCHMENT,
                wordWrap: { width: pw - 56 },
                lineSpacing: 4,
            }),
        );
        y += 200;

        add(px + 28, y, 'NFTS BY CATEGORY', clKickerStyle({ fontSize: '12px', color: CL_GOLD }));
        y += 22;

        const legendary = drops.filter((d) => d.nft_tier === 'super_rare');
        const rare = drops.filter((d) => d.nft_tier === 'rare');
        const fmtDrop = (d: UnclaimedDrop) => {
            const name = getItemById(d.item_id)?.name?.trim() || `Item ${d.item_id}`;
            return name;
        };
        const legLine =
            legendary.length > 0
                ? legendary.slice(0, 8).map(fmtDrop).join('  ·  ') +
                  (legendary.length > 8 ? `  (+${legendary.length - 8})` : '')
                : '— none unclaimed —';
        const rareLine =
            rare.length > 0
                ? rare.slice(0, 10).map(fmtDrop).join('  ·  ') +
                  (rare.length > 10 ? `  (+${rare.length - 10})` : '')
                : '— none unclaimed —';

        add(
            px + 28,
            y,
            [
                `Legendary (super rare):  ${legendary.length}`,
                legLine,
                '',
                `Rare:  ${rare.length}`,
                rareLine,
                '',
                hell.note || 'Pending $HELL is utility mining — not ROI.',
            ].join('\n'),
            clBodyStyle({
                fontSize: '15px',
                color: CL_PARCHMENT,
                wordWrap: { width: pw - 56 },
                lineSpacing: 4,
            }),
        );

        this.root.add(panel);
    }

    public setVisible(visible: boolean): void {
        if (visible === this.visible) {
            if (visible) {
                this.refreshSlotTexts();
            }
            return;
        }
        this.visible = visible;
        this.root.setVisible(visible);
        if (visible) {
            this.ignoreActionsUntilMs = performance.now() + 600;
            this.applyCanvasPresentation(true);
            holdLoginDeskCanvasPresentation(this.scene, 1500);
            this.attachKeyboard();
            // Layout after presentation settles (avoid resize thrash).
            window.requestAnimationFrame(() => {
                if (!this.visible) {
                    return;
                }
                this.rebuild();
                this.startMenuWalkAnimation();
            });
        } else {
            this.detachKeyboard();
            this.closeWalletPanel();
            this.stopMenuWalkAnimation();
            this.applyCanvasPresentation(false);
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public setCharacterSlots(slots: CharacterSlotSummary[]): void {
        this.slots = slots;
        this.refreshSlotTexts();
    }

    public setSelectedSlotIndex(index: number): void {
        this.selectedSlotIndex = Math.max(0, Math.min(3, index));
        this.layoutListColumn();
        this.refreshSlotTexts();
    }

    public setLoading(loading: boolean): void {
        if (this.statusHint) {
            this.statusHint.setText(loading ? 'Loading characters…' : '');
        }
    }

    private resolveWallet(): string {
        const session = connectDialogStore.state.walletSession;
        return session?.wallet?.trim() || getStoredWalletPubkey()?.trim() || '';
    }

    private maskWallet(wallet: string): string {
        if (!wallet) {
            return '';
        }
        if (wallet.length <= 8) {
            return '*'.repeat(Math.max(6, wallet.length));
        }
        return `${wallet.slice(0, 4)}${'*'.repeat(10)}${wallet.slice(-4)}`;
    }

    private refreshWalletRow(): void {
        if (!this.walletText) {
            return;
        }
        const wallet = this.resolveWallet();
        if (!wallet) {
            this.walletText.setText('Wallet: —');
            return;
        }
        const shown = this.walletRevealed ? wallet : this.maskWallet(wallet);
        this.walletText.setText(
            `Wallet: ${shown}  ·  ${this.walletRevealed ? 'click to hide' : 'click to reveal'}`,
        );
    }

    public destroy(): void {
        this.detachKeyboard();
        this.scene.scale.off('resize', this.onResize, this);
        window.removeEventListener('resize', this.onWindowResize);
        if (this.scaleRefreshFrame !== undefined) {
            window.cancelAnimationFrame(this.scaleRefreshFrame);
        }
        this.closeWalletPanel();
        this.stopMenuWalkAnimation();
        for (const v of this.slotVisuals) {
            v.preview?.destroy();
        }
        this.applyCanvasPresentation(false);
        this.root.destroy(true);
    }

    /** Arrow / Tab / Enter / Escape — classic SELECTCHAR keyboard nav. */
    private attachKeyboard(): void {
        this.detachKeyboard();
        this.keyHandler = (event: KeyboardEvent) => {
            if (!this.visible) {
                return;
            }
            // Wallet vault modal: Esc closes; don't move slots underneath.
            if (this.walletPanelOpen) {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.closeWalletPanel();
                }
                return;
            }

            const key = event.key;
            if (
                key === 'ArrowDown' ||
                key === 'ArrowRight' ||
                key === 'Tab' ||
                key === 'ArrowUp' ||
                key === 'ArrowLeft' ||
                key === 'Enter' ||
                key === ' ' ||
                key === 'Escape'
            ) {
                event.preventDefault();
            }

            if (key === 'ArrowDown' || key === 'ArrowRight' || (key === 'Tab' && !event.shiftKey)) {
                this.moveSelection(1);
                return;
            }
            if (key === 'ArrowUp' || key === 'ArrowLeft' || (key === 'Tab' && event.shiftKey)) {
                this.moveSelection(-1);
                return;
            }
            if (key === 'Enter' || key === ' ') {
                // Occupied → Start; empty → Create Character
                this.handleActionClick(this.slotForIndex(this.selectedSlotIndex) ? 0 : 1);
                return;
            }
            if (key === 'Escape') {
                this.handleActionClick(4); // Log Out → hub
                return;
            }
            // Home / End jump first/last slot
            if (key === 'Home') {
                event.preventDefault();
                this.selectSlot(0);
                return;
            }
            if (key === 'End') {
                event.preventDefault();
                this.selectSlot(3);
                return;
            }
            // 1–4 direct slot pick
            if (key >= '1' && key <= '4') {
                event.preventDefault();
                this.selectSlot(Number(key) - 1);
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

    private moveSelection(delta: number): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        const next = (((this.selectedSlotIndex + delta) % 4) + 4) % 4;
        this.selectSlot(next);
    }

    private selectSlot(index: number): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        const i = Math.max(0, Math.min(3, index));
        if (i === this.selectedSlotIndex) {
            return;
        }
        this.selectedSlotIndex = i;
        setSelectedSlotIndex(i);
        this.layoutListColumn();
        this.refreshSlotTexts();
    }

    private handleSlotClick(index: number): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        if (this.selectedSlotIndex === index) {
            this.handleActionClick(this.slotForIndex(index) ? 0 : 1);
            return;
        }
        this.selectSlot(index);
    }

    private handleActionClick(actionIndex: number): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        switch (actionIndex) {
            case 0: {
                const occupied = this.slotForIndex(this.selectedSlotIndex);
                if (!occupied) {
                    // Never enter the world without a created character.
                    EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                        kind: 'create',
                        slotIndex: this.selectedSlotIndex,
                    });
                    break;
                }
                EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                    kind: 'start',
                    slotIndex: this.selectedSlotIndex,
                });
                break;
            }
            case 1: {
                const empty =
                    this.slots.length < 4
                        ? ([0, 1, 2, 3].find((i) => !this.slotForIndex(i)) ?? this.selectedSlotIndex)
                        : this.selectedSlotIndex;
                this.selectedSlotIndex = empty;
                setSelectedSlotIndex(empty);
                EventBus.emit(OUT_UI_SELECTCHAR_ACTION, {
                    kind: 'create',
                    slotIndex: empty,
                });
                break;
            }
            case 2:
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'Delete Character is not available yet.',
                    severity: 'warning',
                });
                break;
            case 3:
                EventBus.emit(TOAST_REQUESTED, {
                    message: 'Change Password is not used with wallet login.',
                    severity: 'info',
                });
                break;
            case 4:
                EventBus.emit(OUT_UI_SELECTCHAR_BACK);
                setConnectGatePhase('hub');
                break;
            default:
                break;
        }
    }

    private slotForIndex(index: number): CharacterSlotSummary | undefined {
        return this.slots.find((s) => s.slotIndex === index);
    }

    private refreshSlotTexts(): void {
        for (let i = 0; i < 4; i++) {
            const visual = this.slotVisuals[i];
            const occupied = this.slotForIndex(i);
            const selected = i === this.selectedSlotIndex;

            if (occupied) {
                const displayName =
                    occupied.name.length > 16 ? `${occupied.name.slice(0, 15)}…` : occupied.name;
                const lev =
                    occupied.rebirth > 0
                        ? `Lev. ${occupied.level} (+${occupied.rebirth})`
                        : `Lev. ${occupied.level}`;
                visual.nameValue.setText(displayName);
                visual.levValue.setText(lev);
                const city = normalizeCitizenshipSide(occupied.citizenshipSide);
                this.paintCitySeal(visual, city, true);
                if (selected) {
                    const cityLabel =
                        city === 'aresden' ? 'Aresden' : city === 'elvine' ? 'Elvine' : 'Traveler';
                    this.heroNameText?.setText(displayName).setVisible(true);
                    this.heroMetaText?.setText(`${lev}  ·  ${cityLabel}`).setVisible(true);
                }
            } else {
                visual.nameValue.setText('Empty');
                visual.levValue.setText('Create Character');
                this.paintCitySeal(visual, undefined, false);
                if (selected) {
                    this.heroNameText?.setText('Empty slot').setVisible(true);
                    this.heroMetaText?.setText('Create Character to fill this slot').setVisible(true);
                }
            }
            this.refreshSlotPreview(i, occupied, selected);
        }
        this.refreshDetailPanel();
        this.refreshWalletRow();
    }

    private refreshSlotPreview(
        index: number,
        occupied: CharacterSlotSummary | undefined,
        selected: boolean,
    ): void {
        const visual = this.slotVisuals[index];
        visual.preview?.destroy();
        visual.preview = undefined;
        if (!occupied) {
            return;
        }

        const gender = occupied.gender === 1 ? Gender.FEMALE : Gender.MALE;
        const skinColor =
            occupied.skinColor === 2
                ? SkinColor.Dark
                : occupied.skinColor === 1
                  ? SkinColor.Tanned
                  : SkinColor.Light;
        const equipped = (occupied.equipped ?? [])
            .filter((e) => e && e.itemId > 0 && e.slot)
            .map((e) => ({ slot: e.slot, itemId: e.itemId }));

        // Auto-fit: body frame height → fills most of the oval (container scale, not lost on walk).
        const mini = createMenuCharacterPreview(
            this.scene,
            this.root,
            visual.feetX,
            visual.feetY,
            {
                gender,
                skinColor,
                hairStyleIndex: Math.max(0, Math.min(7, occupied.hairStyleIndex ?? 0)),
                underwearColorIndex: Math.max(0, Math.min(7, occupied.underwearColorIndex ?? 0)),
                wearDefaultClothes: true,
                equipped,
                walkMode: true,
                fitOvalHeight: this.listOvalH,
                fitFill: LIST_OVAL_FILL,
            },
        );
        mini.setPose(this.menuDir, this.menuFrame);

        if (selected) {
            const hero = createMenuCharacterPreview(
                this.scene,
                this.root,
                this.heroFeetX,
                this.heroFeetY,
                {
                    gender,
                    skinColor,
                    hairStyleIndex: Math.max(0, Math.min(7, occupied.hairStyleIndex ?? 0)),
                    underwearColorIndex: Math.max(0, Math.min(7, occupied.underwearColorIndex ?? 0)),
                    wearDefaultClothes: true,
                    equipped,
                    walkMode: true,
                    fitOvalHeight: this.heroOvalH,
                    fitFill: HERO_OVAL_FILL,
                },
            );
            hero.setPose(this.menuDir, this.menuFrame);
            visual.preview = {
                layers: [...mini.layers, ...hero.layers],
                setPose: (dir, frame) => {
                    mini.setPose(dir, frame);
                    hero.setPose(dir, frame);
                },
                destroy: () => {
                    mini.destroy();
                    hero.destroy();
                },
            };
        } else {
            visual.preview = mini;
        }
    }

    private startMenuWalkAnimation(): void {
        this.stopMenuWalkAnimation();
        this.menuFrame = 0;
        this.menuDir = Direction.South;
        this.menuDirCnt = 0;
        this.applyMenuPoseToAllSlots();
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
        this.applyMenuPoseToAllSlots();
    }

    private applyMenuPoseToAllSlots(): void {
        for (const visual of this.slotVisuals) {
            visual.preview?.setPose(this.menuDir, this.menuFrame);
        }
    }

    private onResize = (): void => {
        if (!this.visible || this.rebuilding) {
            return;
        }
        const nextW = Math.max(900, Math.floor(this.scene.scale.width || 0));
        const nextH = Math.max(600, Math.floor(this.scene.scale.height || 0));
        // Ignore tiny thrash from presentation resync (1–2 px).
        if (Math.abs(nextW - this.viewW) < 8 && Math.abs(nextH - this.viewH) < 8) {
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
            // Only resync CSS/displayScale — never rebuild here (that caused freezes).
            if (this.scaleRefreshFrame !== undefined) {
                window.cancelAnimationFrame(this.scaleRefreshFrame);
            }
            this.scaleRefreshFrame = window.requestAnimationFrame(() => {
                this.scaleRefreshFrame = undefined;
                if (this.canvasPresentationActive) {
                    resyncLoginDeskCanvasPresentation(this.scene);
                }
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
                this.rebuild();
            }
        });
    }
}
