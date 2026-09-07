import { forwardRef, useEffect, useRef } from 'react';
import { useStore } from '@tanstack/react-store';
import type { Game, Scene } from 'phaser';
import { EventBus } from './game/EventBus';
import type { IRefPhaserGame, PhaserGameLike } from './game/phaserHubTypes';
import { isPhaserParkedForWalletUi, setLivePhaserGame } from './game/phaserWalletPark';
import { CURRENT_SCENE_READY, IN_UI_SUPPRESS_POINTER_INPUT } from './constants/EventNames';
import { connectDialogStore, shouldConstructPhaserAfterSeal } from './ui/store/ConnectDialog.store';
import { setWindowFocused } from './utils/RegistryUtils';
import './ui/rpg-ui.css';

export type { IRefPhaserGame } from './game/phaserHubTypes';

/**
 * Hosts the Phaser canvas in React **after** a successful wallet seal.
 *
 * Do not static-import `./game/main`. PR #47 delayed `new Game()` until desk phase but
 * still evaluated Phaser on the hub (EventBus + StartGame graph). KindGem Phantom overlay
 * then Aw Snapped Chrome Error 9 before signMessage (firmas=0). StartGame is a dynamic
 * import so the hub chunk never constructs Canvas/WebGL.
 */

interface IProps
{
    currentActiveScene?: (scene_instance: Scene) => void
}

function asHubGame(g: Game | null): PhaserGameLike | null {
    return g as unknown as PhaserGameLike | null;
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame({ currentActiveScene }, ref)
{
    const game = useRef<Game | null>(null);
    const suppressedPointerInputUntilRef = useRef(0);
    const restoreInputTimeoutRef = useRef<number | undefined>(undefined);
    const gatePhase = useStore(connectDialogStore, (s) => s.phase);
    const walletSession = useStore(connectDialogStore, (s) => s.walletSession);
    const allowPhaser = shouldConstructPhaserAfterSeal({ phase: gatePhase, walletSession });

    useEffect(() =>
    {
        if (!allowPhaser || game.current !== null) {
            return;
        }

        let cancelled = false;
        let paintFrame = 0;

        const bootPhaser = () => {
            void import('./game/main').then((mod) => {
                try {
                    if (cancelled || game.current !== null) {
                        return;
                    }
                    if (!shouldConstructPhaserAfterSeal()) {
                        return;
                    }
                    game.current = mod.default('game-container');
                    setLivePhaserGame(asHubGame(game.current));
                } catch (err) {
                    console.error('[PhaserGame] StartGame threw; leaving canvas empty so React hub can paint', err);
                    game.current = null;
                    setLivePhaserGame(null);
                }

                if (cancelled) {
                    if (game.current) {
                        game.current.destroy(true);
                        game.current = null;
                        setLivePhaserGame(null);
                    }
                    return;
                }

                if (typeof ref === 'function')
                {
                    ref({ game: asHubGame(game.current), scene: null });
                } else if (ref)
                {
                    ref.current = { game: asHubGame(game.current), scene: null };
                }
            }).catch((err) => {
                console.error('[PhaserGame] game/main import failed', err);
            });
        };

        paintFrame = window.requestAnimationFrame(() => {
            paintFrame = window.requestAnimationFrame(bootPhaser);
        });

        return () =>
        {
            cancelled = true;
            window.cancelAnimationFrame(paintFrame);
        }
    }, [allowPhaser, ref]);

    useEffect(() =>
    {
        return () =>
        {
            if (game.current)
            {
                game.current.destroy(true);
                game.current = null;
                setLivePhaserGame(null);
            }
        }
    }, [ref]);

    useEffect(() => {
        const isPhaserTarget = (target: EventTarget | null) => {
            const gameContainer = document.getElementById('game-container');
            return target instanceof Node && gameContainer?.contains(target) === true;
        };

        const stopSuppressedPointerEvent = (event: Event) => {
            if (performance.now() > suppressedPointerInputUntilRef.current) {
                return;
            }

            if (!isPhaserTarget(event.target)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            if ('stopImmediatePropagation' in event) {
                event.stopImmediatePropagation();
            }
        };

        const suppressPhaserPointerInput = (durationMs = 150) => {
            const activeGame = game.current;
            if (!activeGame) {
                return;
            }

            const suppressionEndsAt = performance.now() + durationMs;
            suppressedPointerInputUntilRef.current = Math.max(suppressedPointerInputUntilRef.current, suppressionEndsAt);
            activeGame.input.enabled = false;

            if (restoreInputTimeoutRef.current !== undefined) {
                clearTimeout(restoreInputTimeoutRef.current);
            }

            restoreInputTimeoutRef.current = window.setTimeout(() => {
                restoreInputTimeoutRef.current = undefined;
                if (!game.current) {
                    return;
                }

                if (performance.now() <= suppressedPointerInputUntilRef.current) {
                    return;
                }

                game.current.input.enabled = true;
            }, durationMs + 20);
        };

        EventBus.on(IN_UI_SUPPRESS_POINTER_INPUT, suppressPhaserPointerInput);
        window.addEventListener('pointerdown', stopSuppressedPointerEvent, true);
        window.addEventListener('pointerup', stopSuppressedPointerEvent, true);
        window.addEventListener('click', stopSuppressedPointerEvent, true);
        window.addEventListener('mousedown', stopSuppressedPointerEvent, true);
        window.addEventListener('mouseup', stopSuppressedPointerEvent, true);

        return () => {
            EventBus.off(IN_UI_SUPPRESS_POINTER_INPUT, suppressPhaserPointerInput);
            window.removeEventListener('pointerdown', stopSuppressedPointerEvent, true);
            window.removeEventListener('pointerup', stopSuppressedPointerEvent, true);
            window.removeEventListener('click', stopSuppressedPointerEvent, true);
            window.removeEventListener('mousedown', stopSuppressedPointerEvent, true);
            window.removeEventListener('mouseup', stopSuppressedPointerEvent, true);
            if (restoreInputTimeoutRef.current !== undefined) {
                clearTimeout(restoreInputTimeoutRef.current);
            }
        };
    }, []);

    // Handle window focus/blur to mute/unmute audio when browser window becomes inactive
    useEffect(() => {
        let savedVolume = 1.0;
        let fadeInterval: number | undefined;
        let fadeTimeout: number | undefined;

        const handleWindowBlur = () => {
            setWindowFocused(false);
            if (!game.current || isPhaserParkedForWalletUi()) {
                return;
            }
            
            console.log('[PhaserGame] Browser window lost focus, muting all audio');
            // Clear any pending fade operations
            if (fadeInterval !== undefined) {
                clearInterval(fadeInterval);
                fadeInterval = undefined;
            }
            if (fadeTimeout !== undefined) {
                clearTimeout(fadeTimeout);
                fadeTimeout = undefined;
            }
            
            // Save pre-mute master volume only while it is still audible. A second blur while
            // already muted would otherwise record 0 and the focus fade would never recover.
            const master = game.current.sound.volume;
            if (master > 0) {
                savedVolume = master;
            }
            game.current.sound.volume = 0;
        };

        const handleWindowFocus = () => {
            setWindowFocused(true);
            if (!game.current || isPhaserParkedForWalletUi()) {
                return;
            }
            
            console.log('[PhaserGame] Browser window gained focus, will fade in audio after 1 second');
            
            // Wait 1 second before starting fade-in
            fadeTimeout = window.setTimeout(() => {
                if (!game.current) {
                    return;
                }
                
                console.log('[PhaserGame] Starting audio fade-in');
                // Ensure volume starts at 0
                game.current.sound.volume = 0;
                
                // Gradually fade in over 300ms (30 steps of 10ms each)
                const steps = 30;
                const stepDuration = 10;
                let currentStep = 0;
                
                fadeInterval = window.setInterval(() => {
                    currentStep++;
                    if (game.current && currentStep <= steps) {
                        const progress = currentStep / steps;
                        game.current.sound.volume = savedVolume * progress;
                    }
                    
                    if (currentStep >= steps) {
                        if (fadeInterval !== undefined) {
                            clearInterval(fadeInterval);
                            fadeInterval = undefined;
                        }
                        console.log('[PhaserGame] Audio fade-in complete');
                    }
                }, stepDuration);
                
                fadeTimeout = undefined;
            }, 1000);
        };

        setWindowFocused(document.hasFocus());

        // Listen for window focus/blur events (detects when entire browser window becomes inactive)
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        console.log('[PhaserGame] Window focus/blur listeners set up');

        return () => {
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
            if (fadeInterval !== undefined) {
                clearInterval(fadeInterval);
            }
            if (fadeTimeout !== undefined) {
                clearTimeout(fadeTimeout);
            }
            console.log('[PhaserGame] Window focus/blur listeners removed');
        };
    }, []);

    useEffect(() =>
    {
        const onCurrentSceneReady = (scene_instance: Scene) =>
        {
            if (scene_instance.scene.key === 'GameWorld') {
                document.body.classList.add('helbreath-game-active');
            } else if (scene_instance.scene.key === 'LoginScreen') {
                document.body.classList.remove('helbreath-game-active');
            }

            if (currentActiveScene && typeof currentActiveScene === 'function')
            {

                currentActiveScene(scene_instance);

            }

            if (typeof ref === 'function')
            {
                ref({ game: asHubGame(game.current), scene: scene_instance });
            } else if (ref)
            {
                ref.current = { game: asHubGame(game.current), scene: scene_instance };
            }
            
        };
        EventBus.on(CURRENT_SCENE_READY, onCurrentSceneReady);
        return () =>
        {
            document.body.classList.remove('helbreath-game-active');
            EventBus.off(CURRENT_SCENE_READY, onCurrentSceneReady);
        }
    }, [currentActiveScene, ref]);

    return (
        <div id="game-wrapper">
            <div id="game-container"></div>
        </div>
    );

});
