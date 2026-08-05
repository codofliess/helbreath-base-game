import { Store } from '@tanstack/react-store';
import { claimNftDrop, fetchUnclaimedDrops, type UnclaimedDrop } from '../../utils/dropLedger';
import { getStoredWalletPubkey } from '../../utils/walletAuth';

interface NftClaimsState {
    wallet: string | undefined;
    drops: UnclaimedDrop[];
    loading: boolean;
    claimingDropId: string | null;
    error: string | undefined;
    lastClaimedMint: string | undefined;
    lastExplorerUrl: string | undefined;
}

const initialState: NftClaimsState = {
    wallet: getStoredWalletPubkey(),
    drops: [],
    loading: false,
    claimingDropId: null,
    error: undefined,
    lastClaimedMint: undefined,
    lastExplorerUrl: undefined,
};

export const nftClaimsStore = new Store<NftClaimsState>(initialState);

export async function refreshNftClaims(wallet?: string): Promise<void> {
    const resolvedWallet = wallet?.trim() || getStoredWalletPubkey();
    if (!resolvedWallet) {
        nftClaimsStore.setState((state) => ({
            ...state,
            wallet: undefined,
            drops: [],
            loading: false,
            error: undefined,
        }));
        return;
    }

    nftClaimsStore.setState((state) => ({
        ...state,
        wallet: resolvedWallet,
        loading: true,
        error: undefined,
    }));

    try {
        const drops = await fetchUnclaimedDrops(resolvedWallet);
        nftClaimsStore.setState((state) => ({
            ...state,
            drops,
            loading: false,
        }));
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load NFT drops';
        nftClaimsStore.setState((state) => ({
            ...state,
            drops: [],
            loading: false,
            error: message,
        }));
    }
}

export async function claimNftDropFromStore(dropId: string): Promise<{ mintAddress: string; explorerUrl: string | null }> {
    const wallet = nftClaimsStore.state.wallet ?? getStoredWalletPubkey();
    if (!wallet) {
        throw new Error('Connect with Phantom to claim NFT drops');
    }

    nftClaimsStore.setState((state) => ({
        ...state,
        claimingDropId: dropId,
        error: undefined,
    }));

    try {
        const result = await claimNftDrop(dropId, wallet);
        nftClaimsStore.setState((state) => ({
            ...state,
            drops: state.drops.filter((drop) => drop.id !== dropId),
            claimingDropId: null,
            lastClaimedMint: result.mintAddress,
            lastExplorerUrl: result.explorerUrl ?? undefined,
        }));
        return { mintAddress: result.mintAddress, explorerUrl: result.explorerUrl };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Claim failed';
        nftClaimsStore.setState((state) => ({
            ...state,
            claimingDropId: null,
            error: message,
        }));
        throw error;
    }
}
