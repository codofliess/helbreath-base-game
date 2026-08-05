import { Scene, GameObjects, type Time } from 'phaser';
import { EventBus } from '../EventBus';
import {
    OUT_UI_ARENA_ACTION,
    OUT_UI_ARENA_BACK,
    TOAST_REQUESTED,
} from '../../constants/EventNames';
import { setArenaDeskIndex, setConnectGatePhase } from '../../ui/store/ConnectDialog.store';
import { connectDialogStore } from '../../ui/store/ConnectDialog.store';
import { getStoredWalletPubkey } from '../../utils/walletAuth';
import { Gender, SkinColor } from '../../Types';
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
} from './chainLordDeskSkin';
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
import {
    formatArenaCatalogLines,
    isArenaKitComplete,
    kitCreditSpend,
    kitCreditsLeft,
    loadArenaKits,
    resolveArenaKitEquippedPreview,
    type ArenaKit,
    type ArenaSlotIndex,
} from '../../utils/arenaKits';
import { ARENA_STARTER_CREDITS } from '../../constants/ArenaKitCatalog';
import { getOlympiaSkillById } from '../../constants/OlympiaSkills';

/**
 * Arena Pre-Ready layout contract (bottom → top, no overlap):
 *
 *  ┌ title / subtitle ─────────────────────────────────────────────┐
 *  │ [4 slots]     [hero oval]      [FIGHTER DETAIL]  [Ir a World] │
 *  │                              (right margin for mode tab)      │
 *  │ ── clear band ──                                              │
 *  │ [Create PVP] [Edit] [Delete] [Log Out]                        │
 *  │ [        Enter Bleeding Island        ]                       │
 *  │ Wallet (L)     ── React BI online strip (center) ──           │
 *  └───────────────────────────────────────────────────────────────┘
 *
 * ARENA_REACT_STRIP_H must stay in sync with `.bi-online-strip` max height.
 * MODE_TAB_CLEAR reserves the fixed right “oreja” (DeskModeJumpTab).
 */
const ARENA_REACT_STRIP_H = 86;
const ARENA_FOOTER_GAP = 8;
const ARENA_ACTION_H = 40;
const ARENA_BI_ENTER_H = 36;
/** Right inset so FIGHTER DETAIL never sits under Ir a World. */
const MODE_TAB_CLEAR = 58;
/** Cap list / hero ovals — beyond this sprites go giant + pixelated. */
const LIST_ROW_H_MAX = 132;
const LIST_ROW_H_MIN = 72;
const HERO_OVAL_H_MAX = 168;
const LIST_OVAL_FILL = 0.78;
const HERO_OVAL_FILL = 0.66;

interface SlotVisuals {
    cardGfx: GameObjects.Graphics;
    zone: GameObjects.Zone;
    nameValue: GameObjects.Text;
    levValue: GameObjects.Text;
    pathSealGfx: GameObjects.Graphics;
    pathSealLabel: GameObjects.Text;
    listRect: { x: number; y: number; w: number; h: number };
    feetX: number;
    feetY: number;
    preview: MenuPreviewController | undefined;
}

/**
 * Arena Pre-Ready list — same Chain Lords full-bleed layout as World SelectCharDesk.
 * 4 slots · center hero panel · right kit detail · bottom actions.
 */
export class ArenaSelectCharDesk {
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
    private kits: ArenaKit[] = [];
    private selectedSlotIndex = 0;
    private visible = false;
    private canvasPresentationActive = false;
    private scaleRefreshFrame: number | undefined;
    private ignoreActionsUntilMs = 0;
    private viewW = 1280;
    private viewH = 720;
    private walletRevealed = false;
    private rebuilding = false;
    private layoutDirty = false;
    private menuFrame = 0;
    private menuDir: Direction = Direction.South;
    private menuDirCnt = 0;
    private menuAnimTimer: Time.TimerEvent | undefined;
    private heroFeetX = 0;
    private heroFeetY = 0;
    private heroOvalH = 280;
    private listOvalH = 130;

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

        scene.scale.on('resize', this.onResize, this);
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('arena-kits-changed', this.onKitsChanged);
    }

    private onKitsChanged = (): void => {
        if (this.visible) {
            this.reloadKits();
            this.rebuild();
        }
    };

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
        if (!this.scene.textures.exists(key) || this.bgImage) {
            if (this.bgImage) {
                this.layoutBg();
            }
            return;
        }
        this.bgImage = this.scene.add.image(0, 0, key).setOrigin(0.5, 0.5);
        this.root.addAt(this.bgImage, 0);
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
        const pathSealGfx = this.scene.add.graphics();
        this.root.add(pathSealGfx);
        const zone = this.scene.add.zone(0, 0, 10, 10).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.handleSlotClick(index));
        this.root.add(zone);
        const nameValue = this.scene.add
            .text(0, 0, '', clBodyStyle({ fontSize: '18px', color: CL_PARCHMENT, fontStyle: 'bold' }))
            .setOrigin(0, 0);
        const levValue = this.scene.add
            .text(0, 0, '', clBodyStyle({ fontSize: '16px', color: CL_MUTED }))
            .setOrigin(0, 0);
        const pathSealLabel = this.scene.add
            .text(0, 0, '', clKickerStyle({ fontSize: '11px', color: CL_GOLD }))
            .setOrigin(0.5, 0);
        this.root.add([nameValue, levValue, pathSealLabel]);
        return {
            cardGfx,
            zone,
            nameValue,
            levValue,
            pathSealGfx,
            pathSealLabel,
            listRect: { x: 0, y: 0, w: 0, h: 0 },
            feetX: 0,
            feetY: 0,
            preview: undefined,
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
                window.requestAnimationFrame(() => {
                    if (this.visible) {
                        this.rebuild();
                    }
                });
            }
        }
    }

    private rebuildInner(): void {
        this.clearEphemeral();
        this.viewW = Math.max(900, Math.floor(this.scene.scale.width || window.innerWidth || 1280));
        this.viewH = Math.max(600, Math.floor(this.scene.scale.height || window.innerHeight || 720));
        this.layoutBg();
        drawFullWash(this.washGfx, this.viewW, this.viewH);
        this.chromeGfx.clear();
        this.detailGfx.clear();

        this.addEph(
            this.scene.add
                .text(this.viewW / 2, 18, CHAIN_LORDS_BRAND.toUpperCase(), clKickerStyle({ fontSize: '14px' }))
                .setOrigin(0.5, 0),
        );
        this.addEph(
            this.scene.add
                .text(this.viewW / 2, 40, 'Arena — Pre-Ready Fighters', clTitleStyle({ fontSize: '34px' }))
                .setOrigin(0.5, 0),
        );
        this.addEph(
            this.scene.add
                .text(
                    this.viewW / 2,
                    84,
                    'Same flow as World: empty slot → Create · filled → Edit · complete kit → Start.',
                    clBodyStyle({ fontSize: '15px', color: CL_MUTED }),
                )
                .setOrigin(0.5, 0),
        );

        this.layoutListColumn();
        this.layoutHeroCenter();
        this.layoutDetailPanel();
        this.layoutBottomButtons();
        this.refreshSlotTexts();
    }

    /**
     * Y of the top action button row.
     * Packed from the bottom: React strip → Enter BI → action row.
     * Everything above this Y must stay clear (slots / hero / detail).
     */
    private footerActionY(): number {
        return (
            this.viewH -
            ARENA_REACT_STRIP_H -
            ARENA_FOOTER_GAP -
            ARENA_BI_ENTER_H -
            ARENA_FOOTER_GAP -
            ARENA_ACTION_H
        );
    }

    private layoutListColumn(): void {
        const listX = 24;
        const listY = 108;
        const w = Math.min(320, this.viewW * 0.24);
        // Never invade the footer action band.
        const listBottom = this.footerActionY() - 14;
        const gap = 8;
        const avail = Math.max(0, listBottom - listY - 3 * gap);
        // CRITICAL: rowH must never exceed maxRow (old code Math.max(96, maxRow) overflowed).
        const maxRow = Math.floor(avail / 4);
        const rowH = Math.min(LIST_ROW_H_MAX, Math.max(LIST_ROW_H_MIN, maxRow));
        // If the viewport is very short, prefer fitting 4 rows over a floor min.
        const fitRowH = maxRow < LIST_ROW_H_MIN ? Math.max(56, maxRow) : rowH;

        for (let i = 0; i < 4; i++) {
            const sel = i === this.selectedSlotIndex;
            const y = listY + i * (fitRowH + gap);
            const visual = this.slotVisuals[i];
            visual.cardGfx.clear();
            drawPortalPanel(visual.cardGfx, { x: listX, y, w, h: fitRowH }, sel);
            visual.listRect = { x: listX, y, w, h: fitRowH };
            visual.zone.setPosition(listX + w / 2, y + fitRowH / 2);
            visual.zone.setSize(w, fitRowH);

            const ovalRx = Math.min(40, fitRowH * 0.28);
            const ovalRy = Math.min(54, fitRowH * 0.4);
            this.listOvalH = ovalRy * 2;
            const miniCx = listX + 14 + ovalRx;
            const miniCy = y + fitRowH / 2;
            drawPortraitOval(visual.cardGfx, miniCx, miniCy, ovalRx, ovalRy, sel);
            visual.feetX = miniCx;
            visual.feetY = miniCy + ovalRy * 0.72;

            const textX = listX + w * 0.48;
            visual.nameValue.setPosition(textX, y + fitRowH * 0.14);
            visual.nameValue.setFontSize(Math.max(14, Math.min(17, fitRowH * 0.16)));
            visual.levValue.setPosition(textX, y + fitRowH * 0.36);
            visual.levValue.setFontSize(Math.max(12, Math.min(15, fitRowH * 0.13)));
        }
    }

    private paintPathSeal(visual: SlotVisuals, kit: ArenaKit | undefined): void {
        const g = visual.pathSealGfx;
        g.clear();
        if (!kit) {
            visual.pathSealLabel.setText('').setVisible(false);
            return;
        }
        const { x, y, w, h } = visual.listRect;
        const cx = x + w * 0.72;
        const cy = y + h * 0.58;
        const r = Math.min(36, h * 0.28);
        const isWar = kit.path === 'war';
        const fill = isWar ? 0x5a1810 : 0x142848;
        const stroke = isWar ? 0xd06048 : 0x5888d0;
        const label = isWar ? 'WAR' : 'MAGE';
        const labelColor = isWar ? '#e8a090' : '#a8c8f0';

        g.fillStyle(fill, 0.92);
        g.fillCircle(cx, cy, r);
        g.lineStyle(2.5, stroke, 1);
        g.strokeCircle(cx, cy, r);
        g.lineStyle(1.5, CL.gold, 0.65);
        g.strokeCircle(cx, cy, r * 0.72);
        g.fillStyle(stroke, 1);
        g.fillCircle(cx, cy - r * 0.12, Math.max(3, r * 0.14));

        visual.pathSealLabel
            .setText(label)
            .setVisible(true)
            .setPosition(cx, cy + r * 0.28)
            .setColor(labelColor)
            .setFontSize(Math.max(10, Math.floor(r * 0.32)));
    }

    private layoutHeroCenter(): void {
        const cx = this.viewW * 0.5;
        // Name + meta need ~52px under the oval before the action row.
        const maxFeetY = this.footerActionY() - 56;
        // Cap oval so classic sprites stay sharp (not giant / brick-pixelated).
        const rx = Math.min(68, this.viewW * 0.06);
        const ry = Math.min(rx * 1.28, HERO_OVAL_H_MAX / 2);
        this.heroOvalH = ry * 2;
        // Sit in upper-mid body band; never push feet into the footer.
        const idealCy = Math.min(this.viewH * 0.34, maxFeetY - ry * 0.9);
        const cy = Math.max(this.heroOvalH * 0.55 + 100, idealCy);
        this.heroFeetX = cx;
        this.heroFeetY = Math.min(cy + ry * 0.78, maxFeetY);

        this.chromeGfx.fillStyle(CL.ovalFill, 0.65);
        this.chromeGfx.fillEllipse(cx, cy, rx * 2, ry * 2);
        this.chromeGfx.lineStyle(2, CL.gold, 0.75);
        this.chromeGfx.strokeEllipse(cx, cy, rx * 2, ry * 2);

        const nameY = Math.min(cy + ry + 10, this.footerActionY() - 48);
        this.heroNameText = this.scene.add
            .text(cx, nameY, '', clTitleStyle({ fontSize: '22px' }))
            .setOrigin(0.5, 0);
        this.heroMetaText = this.scene.add
            .text(cx, nameY + 26, '', clBodyStyle({ fontSize: '13px', color: CL_MUTED }))
            .setOrigin(0.5, 0);
        this.addEph(this.heroNameText);
        this.addEph(this.heroMetaText);
    }

    private layoutDetailPanel(): void {
        const panelW = Math.min(300, this.viewW * 0.24);
        // Leave MODE_TAB_CLEAR so Ir a World never covers catalog lines.
        const panelX = this.viewW - panelW - 16 - MODE_TAB_CLEAR;
        const panelY = 108;
        const panelH = Math.max(180, this.footerActionY() - panelY - 14);
        drawPortalPanel(this.detailGfx, { x: panelX, y: panelY, w: panelW, h: panelH }, false);
        this.refreshDetailPanel(panelX, panelY, panelW);
    }

    private refreshDetailPanel(panelX?: number, panelY?: number, panelW?: number): void {
        for (const t of this.detailTexts) {
            t.destroy();
        }
        this.detailTexts = [];

        const w = panelW ?? Math.min(400, this.viewW * 0.28);
        const x = panelX ?? this.viewW - w - 28;
        const y = panelY ?? 112;

        const add = (tx: number, ty: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle) =>
            this.addDetailText(this.scene.add.text(tx, ty, text, style));

        add(x + 18, y + 16, 'FIGHTER DETAIL', clKickerStyle({ fontSize: '13px' }));

        const kit = this.kitForSlot(this.selectedSlotIndex);
        if (!kit) {
            add(
                x + 18,
                y + 56,
                'Empty Pre-Ready slot\n\nClick Create Character\nto build gender, stats,\nskills, pots & catalog.',
                clBodyStyle({ fontSize: '14px', color: CL_MUTED, wordWrap: { width: w - 28 }, lineSpacing: 5 }),
            );
            return;
        }

        const complete = isArenaKitComplete(kit);
        const spend = kitCreditSpend(kit);
        const left = kitCreditsLeft(kit);
        const skills100 = kit.skills100.map((id) => getOlympiaSkillById(id)?.name ?? `#${id}`).join(', ') || '—';
        const skills50 = kit.skills50.map((id) => getOlympiaSkillById(id)?.name ?? `#${id}`).join(', ') || '—';
        const catalogLines = formatArenaCatalogLines(kit);

        const block = [
            complete ? 'Status: PRE-READY' : 'Status: DRAFT (finish Create)',
            `${kit.name}  ·  ${kit.path.toUpperCase()}  ·  ${kit.gender}`,
            '',
            '— Attributes (L150) —',
            `STR ${kit.stats.str}  VIT ${kit.stats.vit}  DEX ${kit.stats.dex}`,
            `INT ${kit.stats.int}  MAG ${kit.stats.mag}  CHR ${kit.stats.chr}`,
            '',
            '— Skills 100% —',
            skills100,
            '',
            '— Skills 50% —',
            skills50,
            '',
            `Pots  R${kit.potions.red} / B${kit.potions.blue} / Candy ${kit.potions.greenCandy}`,
            kit.path === 'mage' ? `Free spell: ${kit.freeMageSpell ?? '—'}` : '',
            '',
            `— Catalog (${spend}c / ${ARENA_STARTER_CREDITS}c · ${left}c left) —`,
            ...catalogLines,
            '',
            '— Starter always —',
            'Hero set, Liche, wand, Emmy 3000, Angelics +15.',
            'Free bag: CIC+7/HP50 + MC/MP capes (no plain cape),',
            'mage+war HP50 & MP50 armor sets to mix.',
            'Credits: weapons/utility + DR/MR (+ MCon capes).',
        ]
            .filter((line) => line !== '')
            .join('\n');

        add(
            x + 14,
            y + 44,
            block,
            clBodyStyle({
                fontSize: '12px',
                color: CL_PARCHMENT,
                wordWrap: { width: w - 28 },
                lineSpacing: 3,
            }),
        );
    }

    private layoutBottomButtons(): void {
        const kit = this.kitForSlot(this.selectedSlotIndex);
        const complete = kit ? isArenaKitComplete(kit) : false;
        const labels: Array<{ label: string; primary: boolean; fn: () => void; enabled?: boolean }> = [
            {
                label: 'Create PVP Duel',
                primary: complete,
                enabled: true,
                fn: () => {
                    if (!kit) {
                        EventBus.emit(TOAST_REQUESTED, {
                            message: 'Create a fighter first (Create Character).',
                            severity: 'warning',
                        });
                        return;
                    }
                    if (!complete) {
                        EventBus.emit(TOAST_REQUESTED, {
                            message: 'Finish the kit with Edit Fighter before Create PVP Duel.',
                            severity: 'warning',
                        });
                        return;
                    }
                    this.emitAction('enter');
                },
            },
            {
                label: kit ? 'Edit Fighter' : 'Create Character',
                primary: !kit || !complete,
                enabled: true,
                fn: () => this.emitAction('save'),
            },
            {
                label: 'Delete Character',
                primary: false,
                enabled: !!kit,
                fn: () => this.emitAction('delete'),
            },
            {
                label: 'Log Out',
                primary: false,
                enabled: true,
                fn: () => {
                    EventBus.emit(OUT_UI_ARENA_BACK);
                    setConnectGatePhase('hub');
                },
            },
        ];

        // Footer (above React BI-online strip — never under HTML):
        //   [Create PVP] [Edit] [Delete] [Log Out]
        //   [     Enter Bleeding Island      ]
        //   ─── React strip: BI online ───
        const gap = 10;
        const row1Y = this.footerActionY();
        const biY = row1Y + ARENA_ACTION_H + ARENA_FOOTER_GAP;
        // Keep footer clear of the right mode tab.
        const maxFooterW = Math.min(720, this.viewW - 48 - MODE_TAB_CLEAR);
        const btnW = Math.min(160, (maxFooterW - (labels.length - 1) * gap) / labels.length);
        const totalW = labels.length * btnW + (labels.length - 1) * gap;
        let x = (this.viewW - totalW) / 2;

        for (const a of labels) {
            const enabled = a.enabled !== false;
            const btn = makeClButton(
                this.scene,
                this.root,
                x,
                row1Y,
                btnW,
                ARENA_ACTION_H,
                a.label,
                enabled
                    ? a.fn
                    : () => {
                          EventBus.emit(TOAST_REQUESTED, {
                              message: 'Nothing in this slot to delete.',
                              severity: 'info',
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

        const biW = Math.min(360, maxFooterW);
        const biX = (this.viewW - biW) / 2;
        const biBtn = makeClButton(
            this.scene,
            this.root,
            biX,
            biY,
            biW,
            ARENA_BI_ENTER_H,
            'Enter Bleeding Island',
            () => {
                if (!kit) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Create a Pre-Ready fighter first (Create Character).',
                        severity: 'warning',
                    });
                    return;
                }
                if (!complete) {
                    EventBus.emit(TOAST_REQUESTED, {
                        message: 'Finish the kit (Edit Fighter) before entering Bleeding Island.',
                        severity: 'warning',
                    });
                    return;
                }
                this.emitAction('enter-bleeding');
            },
            true,
        );
        this.ephemeral.push(biBtn.root);

        // Wallet seal: left edge, mid-height of the React strip band (HTML is center-only).
        const walletY = this.viewH - Math.floor(ARENA_REACT_STRIP_H * 0.55);
        this.walletText = this.scene.add
            .text(20, walletY, '', clBodyStyle({ fontSize: '11px', color: CL_MUTED }))
            .setOrigin(0, 0.5)
            .setInteractive({ useHandCursor: true });
        this.walletText.on('pointerdown', () => {
            this.walletRevealed = !this.walletRevealed;
            this.refreshWalletRow();
        });
        this.addEph(this.walletText);
        this.refreshWalletRow();
    }

    private resolveWallet(): string {
        const session = connectDialogStore.state.walletSession;
        return session?.wallet?.trim() || getStoredWalletPubkey()?.trim() || '';
    }

    private maskWallet(wallet: string): string {
        if (!wallet || wallet.length <= 8) {
            return wallet ? '*'.repeat(Math.max(6, wallet.length)) : '';
        }
        return `${wallet.slice(0, 4)}${'*'.repeat(10)}${wallet.slice(-4)}`;
    }

    private refreshWalletRow(): void {
        if (!this.walletText) {
            return;
        }
        const wallet = this.resolveWallet();
        if (!wallet) {
            this.walletText.setText('Wallet: — (seal from hub)');
            return;
        }
        const shown = this.walletRevealed ? wallet : this.maskWallet(wallet);
        this.walletText.setText(
            `Wallet: ${shown}  ·  Arena kits bound to this seal  ·  ${this.walletRevealed ? 'hide' : 'reveal'}`,
        );
    }

    private kitForSlot(index: number): ArenaKit | undefined {
        return this.kits.find((k) => k.slotIndex === index);
    }

    private reloadKits(): void {
        this.kits = loadArenaKits(this.resolveWallet());
    }

    private refreshSlotTexts(): void {
        for (let i = 0; i < 4; i++) {
            const visual = this.slotVisuals[i];
            const kit = this.kitForSlot(i);
            const selected = i === this.selectedSlotIndex;
            this.paintPathSeal(visual, kit);
            if (!kit) {
                visual.nameValue.setText('Empty slot').setColor(CL_MUTED);
                visual.levValue.setText('Create Character').setColor(CL_MUTED);
            } else {
                const complete = isArenaKitComplete(kit);
                visual.nameValue.setText(kit.name).setColor(CL_PARCHMENT);
                visual.levValue
                    .setText(
                        complete
                            ? `L150 · ${kit.path.toUpperCase()} · Pre-Ready · ${kitCreditsLeft(kit)}c left`
                            : `L150 · ${kit.path.toUpperCase()} · Draft`,
                    )
                    .setColor(complete ? CL_GOLD : CL_MUTED);
            }
            this.refreshSlotPreview(i, kit, selected);
        }

        const sel = this.kitForSlot(this.selectedSlotIndex);
        if (sel) {
            this.heroNameText?.setText(sel.name).setVisible(true);
            this.heroMetaText
                ?.setText(
                    isArenaKitComplete(sel)
                        ? `Pre-Ready  ·  ${sel.path.toUpperCase()}  ·  ${kitCreditSpend(sel)}c catalog`
                        : 'Draft — finish Create Character',
                )
                .setVisible(true);
        } else {
            this.heroNameText?.setText('Empty slot').setVisible(true);
            this.heroMetaText?.setText('Create Character to fill this Pre-Ready cradle').setVisible(true);
        }

        this.refreshDetailPanel();
        this.refreshWalletRow();
    }

    private refreshSlotPreview(index: number, kit: ArenaKit | undefined, selected: boolean): void {
        const visual = this.slotVisuals[index];
        visual.preview?.destroy();
        visual.preview = undefined;
        if (!kit) {
            return;
        }

        const gender = kit.gender === 'female' ? Gender.FEMALE : Gender.MALE;
        const skinColor =
            kit.skinColor === 2 ? SkinColor.Dark : kit.skinColor === 1 ? SkinColor.Tanned : SkinColor.Light;
        // Hero set + catalog weapon/shield/armor (e.g. Berserk MS.20 / ZW-style staff).
        const equipped = resolveArenaKitEquippedPreview(kit);

        const mini = createMenuCharacterPreview(this.scene, this.root, visual.feetX, visual.feetY, {
            gender,
            skinColor,
            hairStyleIndex: Math.max(0, Math.min(7, kit.hairStyleIndex ?? 0)),
            underwearColorIndex: Math.max(0, Math.min(7, kit.underwearColorIndex ?? 0)),
            wearDefaultClothes: true,
            equipped,
            walkMode: true,
            fitOvalHeight: this.listOvalH,
            fitFill: LIST_OVAL_FILL,
        });
        mini.setPose(this.menuDir, this.menuFrame);

        if (selected) {
            const hero = createMenuCharacterPreview(this.scene, this.root, this.heroFeetX, this.heroFeetY, {
                gender,
                skinColor,
                hairStyleIndex: Math.max(0, Math.min(7, kit.hairStyleIndex ?? 0)),
                underwearColorIndex: Math.max(0, Math.min(7, kit.underwearColorIndex ?? 0)),
                wearDefaultClothes: true,
                equipped,
                walkMode: true,
                fitOvalHeight: this.heroOvalH,
                fitFill: HERO_OVAL_FILL,
            });
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
        this.menuAnimTimer?.remove(false);
        this.menuAnimTimer = undefined;
    }

    private tickMenuWalkAnimation(): void {
        this.menuFrame++;
        if (this.menuFrame >= MENU_WALK_FRAMES) {
            this.menuFrame = 0;
            this.menuDirCnt++;
            if (this.menuDirCnt > MENU_WALK_CYCLES_PER_DIR) {
                this.menuDirCnt = 1;
                this.menuDir = ((this.menuDir + 1) % 8) as Direction;
            }
        }
        this.applyMenuPoseToAllSlots();
    }

    private applyMenuPoseToAllSlots(): void {
        for (const v of this.slotVisuals) {
            v.preview?.setPose(this.menuDir, this.menuFrame);
        }
    }

    private handleSlotClick(index: number): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        if (this.selectedSlotIndex === index) {
            const kit = this.kitForSlot(index);
            this.emitAction(kit ? 'save' : 'save'); // Create or Edit
            return;
        }
        this.selectedSlotIndex = index;
        setArenaDeskIndex(index);
        EventBus.emit(OUT_UI_ARENA_ACTION, { kind: 'select', deskIndex: index });
        this.rebuild();
    }

    private emitAction(kind: 'enter' | 'enter-bleeding' | 'save' | 'delete' | 'load'): void {
        if (performance.now() < this.ignoreActionsUntilMs) {
            return;
        }
        EventBus.emit(OUT_UI_ARENA_ACTION, {
            kind,
            deskIndex: this.selectedSlotIndex as ArenaSlotIndex,
        });
    }

    /** @deprecated Prefer setKits — kept so LoginScreen can call either during transition. */
    public setBuilds(_builds: unknown[]): void {
        this.reloadKits();
        if (this.visible) {
            this.refreshSlotTexts();
        }
    }

    public setKits(kits: ArenaKit[]): void {
        this.kits = kits;
        if (this.visible) {
            this.refreshSlotTexts();
        }
    }

    public setSelectedDeskIndex(index: number): void {
        this.selectedSlotIndex = Math.max(0, Math.min(3, index));
        if (this.visible) {
            this.rebuild();
        }
    }

    public setVisible(visible: boolean): void {
        if (visible === this.visible) {
            if (visible) {
                this.reloadKits();
                this.refreshSlotTexts();
            }
            return;
        }
        this.visible = visible;
        this.root.setVisible(visible);
        if (visible) {
            this.ignoreActionsUntilMs = performance.now() + 600;
            this.reloadKits();
            this.applyCanvasPresentation(true);
            holdLoginDeskCanvasPresentation(this.scene, 1500);
            window.requestAnimationFrame(() => {
                if (!this.visible) {
                    return;
                }
                this.rebuild();
                this.startMenuWalkAnimation();
            });
        } else {
            this.stopMenuWalkAnimation();
            this.applyCanvasPresentation(false);
        }
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public destroy(): void {
        this.scene.scale.off('resize', this.onResize, this);
        window.removeEventListener('resize', this.onWindowResize);
        window.removeEventListener('arena-kits-changed', this.onKitsChanged);
        if (this.scaleRefreshFrame !== undefined) {
            window.cancelAnimationFrame(this.scaleRefreshFrame);
        }
        this.stopMenuWalkAnimation();
        for (const v of this.slotVisuals) {
            v.preview?.destroy();
        }
        this.applyCanvasPresentation(false);
        this.root.destroy(true);
    }

    private onResize = (): void => {
        if (this.visible) {
            this.rebuild();
        }
    };

    private onWindowResize = (): void => {
        if (this.visible) {
            this.applyCanvasPresentation(true);
            this.rebuild();
        }
    };

    private applyCanvasPresentation(active: boolean): void {
        this.canvasPresentationActive = active;
        if (active) {
            applyLoginDeskCanvasPresentation(this.scene, true);
            resyncLoginDeskCanvasPresentation(this.scene);
        } else {
            restoreLoginDeskCanvasPresentation(this.scene);
        }
    }
}
