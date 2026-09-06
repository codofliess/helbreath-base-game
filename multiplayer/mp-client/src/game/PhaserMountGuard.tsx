import { Component, type ErrorInfo, type ReactNode } from 'react';

interface PhaserMountGuardProps {
    children: ReactNode;
}

interface PhaserMountGuardState {
    failed: boolean;
}

/**
 * Keeps the React login hub mounted if Phaser's first paint throws
 * (WebGL abort, missing canvas parent, etc.). Effects are still try/caught in PhaserGame.
 */
export class PhaserMountGuard extends Component<PhaserMountGuardProps, PhaserMountGuardState> {
    public state: PhaserMountGuardState = { failed: false };

    public static getDerivedStateFromError(): PhaserMountGuardState {
        return { failed: true };
    }

    public componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('[PhaserMountGuard] Phaser tree failed; login hub remains', error, info.componentStack);
    }

    public render(): ReactNode {
        if (this.state.failed) {
            return (
                <div id="game-wrapper">
                    <div id="game-container" />
                </div>
            );
        }
        return this.props.children;
    }
}
