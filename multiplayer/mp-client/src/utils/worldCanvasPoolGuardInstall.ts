import { Display, type Game } from 'phaser';
import {
    attachWorldCanvasPoolGuard,
    type WorldCanvasPoolApi,
} from './worldCanvasPoolGuard';

/**
 * Bind Phaser's singleton CanvasPool so Magias select / prepare cannot
 * 1×1 or reuse `game.canvas` (full-black map, CSS cursor still visible).
 */
export function installWorldCanvasPoolGuard(game: Game): void {
    attachWorldCanvasPoolGuard(
        game,
        Display.Canvas.CanvasPool as unknown as WorldCanvasPoolApi,
    );
}
