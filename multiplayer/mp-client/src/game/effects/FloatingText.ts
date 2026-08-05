import type { Scene } from 'phaser';
import { FLOATING_TEXT_DEPTH } from '../../Config';
import {
    OLYMPIA_FLOATING_TEXT_COLORS,
    olympiaPhaserOutlinedTextStyle,
} from '../../constants/OlympiaTypography';

/**
 * Configuration for creating a FloatingText instance.
 */
export type FloatingTextConfig = {
    /** Text to display */
    text: string;
    /** X position in pixels (origin, text travels upward from here) */
    x: number;
    /** Y position in pixels (origin, text travels upward from here) */
    y: number;
    /** Font size in pixels */
    fontSize?: number;
    /** Text colour (hex string, e.g. '#ff0000') */
    color?: string;
    /** Upward travel speed in pixels per second */
    upwardTravelPxPerSec?: number;
    /** Total duration in milliseconds before destroy */
    totalDurationMs: number;
    /** Fade duration in milliseconds. Fade starts at (totalDurationMs - fadeDurationMs). 0 = no fade, destroyed immediately at end. */
    fadeDurationMs?: number;
    /** Whether the font is bold */
    bold?: boolean;
    /** Horizontal offset in pixels. Negative = shift left, positive = shift right. */
    horizontalOffset?: number;
    /** Invoked once when this instance destroys itself or is destroyed externally. */
    onDestroy?: () => void;
};

/** Options for Olympia-style chained damage / heal numbers. */
export type DamageChainHitOptions = {
    /** World pixel X (center of entity). */
    x: number;
    /** World pixel Y where the number originates. */
    y: number;
    /** Absolute hit amount (sign applied by kind). */
    amount: number;
    /** dealt = yellow (outgoing), taken = red, heal = green. */
    kind: 'dealt' | 'taken' | 'heal';
    /** Appends trailing `!` (crit / knockback). */
    critical?: boolean;
    fontSize?: number;
};

const DAMAGE_CHAIN_MERGE_MS = 480;
const DAMAGE_CHAIN_DURATION_MS = 2200;
const DAMAGE_CHAIN_FADE_MS = 1100;
const DAMAGE_CHAIN_TRAVEL_PX_PER_SEC = 28;

/**
 * Formats Olympia stacked hits: `-45-45-45!` or `+12+12`.
 */
export function formatOlympiaDamageChain(
    hits: number[],
    kind: 'dealt' | 'taken' | 'heal',
    critical: boolean,
): string {
    if (hits.length === 0) {
        return '';
    }
    if (kind === 'heal') {
        const body = hits.map((h) => `+${Math.abs(Math.round(h))}`).join('');
        return critical || hits.length > 1 ? `${body}!` : body;
    }
    const body = hits.map((h) => `-${Math.abs(Math.round(h))}`).join('');
    return critical || hits.length > 1 ? `${body}!` : body;
}

/**
 * Converts a spell display name to Olympia announce form (`Mass-Fire-Strike!`).
 */
export function formatOlympiaSpellAnnounce(spellName: string): string {
    const trimmed = spellName.trim();
    if (!trimmed) {
        return '';
    }
    const dashed = trimmed.replace(/\s+/g, '-');
    return dashed.endsWith('!') ? dashed : `${dashed}!`;
}

function colorForDamageKind(kind: 'dealt' | 'taken' | 'heal'): string {
    switch (kind) {
        case 'dealt':
            return OLYMPIA_FLOATING_TEXT_COLORS.damageDealt;
        case 'heal':
            return OLYMPIA_FLOATING_TEXT_COLORS.heal;
        case 'taken':
        default:
            return OLYMPIA_FLOATING_TEXT_COLORS.damageTaken;
    }
}

/**
 * Represents numerical or textual indicators on the game canvas.
 * Renders at very high depth above all other objects.
 * Text travels upward from origin and fades out before being destroyed.
 *
 * Face approximates PutString_SprNum / PutString2 (Tahoma + black outline), not Georgia.
 */
export class FloatingText {
    private scene: Scene;
    private textObject: Phaser.GameObjects.Text;
    private originY: number;
    private upwardTravelPxPerSec: number;
    private totalDurationMs: number;
    private fadeDurationMs: number;
    private elapsedMs: number = 0;
    private destroyed = false;
    private readonly onDestroy?: () => void;
    private updateCallback: (time: number, delta: number) => void;

    constructor(scene: Scene, config: FloatingTextConfig) {
        this.scene = scene;
        this.originY = config.y;
        this.upwardTravelPxPerSec = config.upwardTravelPxPerSec ?? 0;
        this.totalDurationMs = config.totalDurationMs;
        this.fadeDurationMs = config.fadeDurationMs ?? 0;
        this.onDestroy = config.onDestroy;

        const x = config.x + (config.horizontalOffset ?? 0);
        this.textObject = scene.add.text(
            x,
            config.y,
            config.text,
            olympiaPhaserOutlinedTextStyle(config.color ?? '#ffffff', {
                fontSize: `${config.fontSize ?? 16}px`,
                fontStyle: config.bold ? 'bold' : 'normal',
            }),
        );
        this.textObject.setOrigin(0.5, 0.5);
        this.textObject.setDepth(FLOATING_TEXT_DEPTH);

        this.updateCallback = (_time: number, delta: number) => this.update(delta);
        this.scene.events.on('update', this.updateCallback);
    }

    /** Replaces visible string (used when chaining multi-hit damage). */
    public setText(text: string): void {
        if (this.destroyed) {
            return;
        }
        this.textObject.setText(text);
    }

    /** Updates fill color without recreating the Phaser text object. */
    public setColor(color: string): void {
        if (this.destroyed) {
            return;
        }
        this.textObject.setColor(color);
    }

    /** Moves the float origin (keeps current travel progress relative to a new base Y). */
    public setOriginPosition(x: number, y: number): void {
        if (this.destroyed) {
            return;
        }
        this.originY = y;
        const travelOffset = (this.elapsedMs / 1000) * this.upwardTravelPxPerSec;
        this.textObject.setPosition(x, this.originY - travelOffset);
    }

    /** Restarts lifetime so chained hits stay visible longer. */
    public refreshLifetime(totalDurationMs?: number, fadeDurationMs?: number): void {
        if (this.destroyed) {
            return;
        }
        if (totalDurationMs !== undefined) {
            this.totalDurationMs = totalDurationMs;
        }
        if (fadeDurationMs !== undefined) {
            this.fadeDurationMs = fadeDurationMs;
        }
        this.elapsedMs = 0;
        this.textObject.setAlpha(1);
    }

    public isDestroyed(): boolean {
        return this.destroyed;
    }

    private update(delta: number): void {
        this.elapsedMs += delta;

        const travelOffset = (this.elapsedMs / 1000) * this.upwardTravelPxPerSec;
        this.textObject.setPosition(this.textObject.x, this.originY - travelOffset);

        const fadeStartMs = this.totalDurationMs - this.fadeDurationMs;
        if (this.fadeDurationMs > 0 && this.elapsedMs >= fadeStartMs) {
            const fadeElapsed = this.elapsedMs - fadeStartMs;
            const fadeProgress = Math.min(1, fadeElapsed / this.fadeDurationMs);
            const alpha = 1 - fadeProgress;
            this.textObject.setAlpha(alpha);
            if (alpha <= 0) {
                this.destroy();
                return;
            }
        }

        if (this.elapsedMs >= this.totalDurationMs) {
            this.destroy();
        }
    }

    public destroy(): void {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        this.scene.events.off('update', this.updateCallback);
        this.textObject.destroy();
        this.onDestroy?.();
    }
}

/**
 * Merges rapid consecutive hits into one Olympia-style chain (`-45-45-45!`).
 * Owned per GameObject; call {@link destroy} on entity teardown.
 */
export class DamageChainFloatingText {
    private floating: FloatingText | undefined;
    private hits: number[] = [];
    private kind: 'dealt' | 'taken' | 'heal' = 'taken';
    private critical = false;
    private lastHitAtMs = 0;

    /**
     * Appends a hit to the active chain when within the merge window and same kind; otherwise starts a new float.
     */
    public push(scene: Scene, options: DamageChainHitOptions): void {
        const amount = Math.abs(Math.round(options.amount));
        if (amount <= 0) {
            return;
        }

        const now = scene.time.now;
        const canMerge =
            this.floating !== undefined &&
            !this.floating.isDestroyed() &&
            this.kind === options.kind &&
            now - this.lastHitAtMs <= DAMAGE_CHAIN_MERGE_MS;

        if (!canMerge) {
            this.floating?.destroy();
            this.hits = [amount];
            this.kind = options.kind;
            this.critical = Boolean(options.critical);
            this.lastHitAtMs = now;
            const color = colorForDamageKind(this.kind);
            this.floating = new FloatingText(scene, {
                text: formatOlympiaDamageChain(this.hits, this.kind, this.critical),
                x: options.x,
                y: options.y,
                fontSize: options.fontSize ?? 16,
                color,
                bold: false,
                horizontalOffset: -2,
                upwardTravelPxPerSec: DAMAGE_CHAIN_TRAVEL_PX_PER_SEC,
                totalDurationMs: DAMAGE_CHAIN_DURATION_MS,
                fadeDurationMs: DAMAGE_CHAIN_FADE_MS,
                onDestroy: () => {
                    this.floating = undefined;
                    this.hits = [];
                    this.critical = false;
                },
            });
            return;
        }

        this.hits.push(amount);
        this.critical = this.critical || Boolean(options.critical);
        this.lastHitAtMs = now;
        this.floating!.setText(formatOlympiaDamageChain(this.hits, this.kind, this.critical));
        this.floating!.setOriginPosition(options.x + (-2), options.y);
        this.floating!.refreshLifetime(DAMAGE_CHAIN_DURATION_MS, DAMAGE_CHAIN_FADE_MS);
    }

    public destroy(): void {
        this.floating?.destroy();
        this.floating = undefined;
        this.hits = [];
        this.critical = false;
    }
}
