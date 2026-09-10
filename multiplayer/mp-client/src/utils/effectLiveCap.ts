/**
 * Caps concurrent one-shot cast VFX (Fire Strike = 4 explosions).
 * Unbounded drawEffect during slime-pit AoE farm is a Chrome discard path.
 */

export const MAX_LIVE_ONESHOT_EFFECTS = 24;

let liveOneShotEffects = 0;

export function tryAcquireOneShotEffectSlot(): boolean {
    if (liveOneShotEffects >= MAX_LIVE_ONESHOT_EFFECTS) {
        return false;
    }
    liveOneShotEffects += 1;
    return true;
}

export function releaseOneShotEffectSlot(): void {
    liveOneShotEffects = Math.max(0, liveOneShotEffects - 1);
}

export function liveOneShotEffectCount(): number {
    return liveOneShotEffects;
}

/** Test-only. */
export function resetOneShotEffectSlotsForTests(): void {
    liveOneShotEffects = 0;
}

export function isPhaserSceneActive(scene: { sys?: { isActive?: () => boolean } } | undefined): boolean {
    return scene?.sys?.isActive?.() === true;
}
