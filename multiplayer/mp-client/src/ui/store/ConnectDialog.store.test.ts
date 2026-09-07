import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    beginEnteringWorld,
    clearPhaserWorldSession,
    connectDialogStore,
    enterPlayWorldPhase,
    shouldConstructPhaserAfterSeal,
    setCharacterSlots,
    setConnectGatePhase,
    setConnectWalletSession,
    setSelectedSlotIndex,
} from './ConnectDialog.store';

const wallet = {
    wallet: '4R7FsyC8elonWallet111111111111111',
    token: 'tok',
    expiresAt: Date.now() + 60_000,
};

describe('shouldConstructPhaserAfterSeal', () => {
    it('stays false on hub, play-world, arena-lobby (no WebGL until Start)', () => {
        connectDialogStore.setState((s) => ({
            ...s,
            walletSession: wallet,
            phase: 'hub',
            phaserWorldSession: false,
            pendingWorldEnter: null,
        }));
        assert.equal(shouldConstructPhaserAfterSeal(), false);
        setConnectGatePhase('play-world');
        assert.equal(shouldConstructPhaserAfterSeal(), false);
        setConnectGatePhase('arena-lobby');
        assert.equal(shouldConstructPhaserAfterSeal(), false);
        setConnectGatePhase('create-char');
        assert.equal(shouldConstructPhaserAfterSeal(), false);
    });

    it('is true only after beginEnteringWorld', () => {
        setConnectWalletSession(wallet);
        setConnectGatePhase('play-world');
        beginEnteringWorld({
            host: '127.0.0.1',
            port: 1,
            characterName: 'Elon',
            slotIndex: 0,
            walletSession: wallet,
        });
        assert.equal(connectDialogStore.state.phase, 'entering-world');
        assert.equal(shouldConstructPhaserAfterSeal(), true);
        clearPhaserWorldSession();
        setConnectGatePhase('play-world');
        assert.equal(shouldConstructPhaserAfterSeal(), false);
        setConnectWalletSession(null);
        assert.equal(shouldConstructPhaserAfterSeal(), false);
    });
});

describe('enterPlayWorldPhase', () => {
    it('focuses the highest-level traveler even when slot 0 is a low-level card', () => {
        const base = {
            exp: 0,
            rebirth: 0,
            hoursPlayed: 0,
            str: 10,
            vit: 10,
            dex: 10,
            intel: 10,
            mag: 10,
            chr: 10,
            gender: 0,
            skinColor: 0,
            hairStyleIndex: 0,
            underwearColorIndex: 0,
        };
        setCharacterSlots([
            { ...base, slotIndex: 0, name: 'BebaMaster', level: 1 },
            { ...base, slotIndex: 1, name: 'Co2', level: 150 },
        ]);
        setSelectedSlotIndex(0);
        enterPlayWorldPhase(wallet);
        assert.equal(connectDialogStore.state.phase, 'play-world');
        assert.equal(connectDialogStore.state.selectedSlotIndex, 1);
    });
});
