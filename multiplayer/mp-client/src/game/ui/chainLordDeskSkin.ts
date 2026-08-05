import { GameObjects, type Scene } from 'phaser';

/**
 * Helbreath - Chain Lords desk chrome — hub-matched (not classic gamedialog).
 * Tokens mirror .login-hub in rpg-ui.css.
 */

export const CL_GOLD = '#e0b45a';
export const CL_GOLD_DIM = '#a86b24';
export const CL_PARCHMENT = '#f0e0c0';
export const CL_MUTED = '#cbb892';
export const CL_INK = '#0a0602';
export const CL_TALENT = '#c4a0e0';

export const CL_FONT_TITLE = 'Cinzel, Georgia, serif';
export const CL_FONT_BODY = 'Spectral, Georgia, serif';

export const CL = {
    bgDeep: 0x0a0602,
    panel: 0x1c120a,
    panelGlass: 0x201408,
    gold: 0xe0b45a,
    goldDim: 0xa86b24,
    goldLine: 0xc49a48,
    ovalFill: 0x0c0806,
    ovalRing: 0xa86b24,
    ovalRingHot: 0xe0b45a,
    button: 0xe0b45a,
    buttonText: 0x0a0602,
    buttonOutline: 0x3a2810,
} as const;

export function clTitleStyle(
    overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: CL_FONT_TITLE,
        fontSize: '28px',
        color: CL_GOLD,
        ...overrides,
    };
}

export function clKickerStyle(
    overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: CL_FONT_TITLE,
        fontSize: '11px',
        color: CL_GOLD,
        ...overrides,
    };
}

export function clBodyStyle(
    overrides: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
    return {
        fontFamily: CL_FONT_BODY,
        fontSize: '14px',
        color: CL_PARCHMENT,
        ...overrides,
    };
}

export interface PanelRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Full-bleed dark wash (key art drawn separately as Image). */
export function drawFullWash(g: GameObjects.Graphics, w: number, h: number): void {
    g.clear();
    g.fillStyle(CL.bgDeep, 0.72);
    g.fillRect(0, 0, w, h);
    // soft vignette edges
    g.fillStyle(CL.bgDeep, 0.35);
    g.fillRect(0, 0, w, Math.max(48, h * 0.1));
    g.fillRect(0, h - Math.max(48, h * 0.12), w, Math.max(48, h * 0.12));
}

/** Hub-style glass portal panel (thin gold frame). */
export function drawPortalPanel(g: GameObjects.Graphics, r: PanelRect, selected = false): void {
    const alpha = selected ? 0.92 : 0.78;
    g.fillStyle(CL.panelGlass, alpha);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 2);
    g.lineStyle(selected ? 2 : 1, selected ? CL.gold : CL.goldLine, selected ? 0.95 : 0.45);
    g.strokeRoundedRect(r.x, r.y, r.w, r.h, 2);
    if (selected) {
        g.lineStyle(1, 0xffe8a0, 0.25);
        g.strokeRoundedRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 1);
    }
}

export function drawPortraitOval(
    g: GameObjects.Graphics,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    selected: boolean,
): { feetX: number; feetY: number } {
    g.fillStyle(CL.ovalFill, 0.95);
    g.fillEllipse(cx, cy, rx * 2, ry * 2);
    g.lineStyle(selected ? 2 : 1, selected ? CL.ovalRingHot : CL.ovalRing, selected ? 0.95 : 0.55);
    g.strokeEllipse(cx, cy, rx * 2, ry * 2);
    // Near bottom of oval so auto-fit body fills most of the disc upward.
    return { feetX: cx, feetY: cy + ry * 0.72 };
}

export interface ClButtonHandle {
    root: GameObjects.Container;
    label: GameObjects.Text;
    zone: GameObjects.Zone;
    setPrimary: (primary: boolean) => void;
}

/** Hub CTA — gold fill primary, or outline secondary. */
export function makeClButton(
    scene: Scene,
    parent: GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    onClick: () => void,
    primary = true,
): ClButtonHandle {
    const root = scene.add.container(x, y);
    const bg = scene.add.graphics();
    let isPrimary = primary;

    const paint = (hovered: boolean) => {
        bg.clear();
        if (isPrimary) {
            const fill = hovered ? 0xecd07a : CL.button;
            bg.fillStyle(fill, 1);
            bg.fillRoundedRect(0, 0, w, h, 2);
            bg.lineStyle(1, 0xfff0c0, hovered ? 0.5 : 0.2);
            bg.strokeRoundedRect(0, 0, w, h, 2);
        } else {
            bg.fillStyle(CL.panel, hovered ? 0.9 : 0.55);
            bg.fillRoundedRect(0, 0, w, h, 2);
            bg.lineStyle(1, CL.goldLine, hovered ? 0.9 : 0.5);
            bg.strokeRoundedRect(0, 0, w, h, 2);
        }
    };
    paint(false);

    const text = scene.add
        .text(w / 2, h / 2, label.toUpperCase(), {
            fontFamily: CL_FONT_TITLE,
            fontSize: Math.min(13, Math.max(11, h * 0.36)) + 'px',
            color: isPrimary ? CL_INK : CL_GOLD,
            fontStyle: '600',
        })
        .setOrigin(0.5, 0.5);

    const zone = scene.add.zone(w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
        paint(true);
        if (!isPrimary) {
            text.setColor('#f0d080');
        }
    });
    zone.on('pointerout', () => {
        paint(false);
        text.setColor(isPrimary ? CL_INK : CL_GOLD);
    });
    zone.on('pointerdown', onClick);
    root.add([bg, text, zone]);
    parent.add(root);
    return {
        root,
        label: text,
        zone,
        setPrimary: (p) => {
            isPrimary = p;
            text.setColor(p ? CL_INK : CL_GOLD);
            paint(false);
        },
    };
}

export function makeClChip(
    scene: Scene,
    parent: GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    size = 28,
): ClButtonHandle {
    return makeClButton(scene, parent, x, y, size, size, label, onClick, false);
}

/** Tiny design-mode switcher strip (A / B / Hybrid). */
export function makeModeSwitcher(
    scene: Scene,
    parent: GameObjects.Container,
    x: number,
    y: number,
    current: string,
    labels: Array<{ id: string; label: string }>,
    onPick: (id: string) => void,
): GameObjects.Container {
    const root = scene.add.container(x, y);
    let ox = 0;
    for (const item of labels) {
        const active = item.id === current;
        const w = 72;
        const h = 22;
        const bg = scene.add.graphics();
        bg.fillStyle(active ? CL.gold : CL.panel, active ? 1 : 0.7);
        bg.fillRoundedRect(ox, 0, w, h, 2);
        bg.lineStyle(1, CL.goldLine, 0.6);
        bg.strokeRoundedRect(ox, 0, w, h, 2);
        const t = scene.add
            .text(ox + w / 2, h / 2, item.label, {
                fontFamily: CL_FONT_TITLE,
                fontSize: '10px',
                color: active ? CL_INK : CL_GOLD,
            })
            .setOrigin(0.5, 0.5);
        const zone = scene.add.zone(ox + w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => onPick(item.id));
        root.add([bg, t, zone]);
        ox += w + 6;
    }
    parent.add(root);
    return root;
}
