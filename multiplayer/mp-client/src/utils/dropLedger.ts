import { getStoredWalletToken } from './walletAuth';

const DEFAULT_MIDDLEWARE_URL = 'http://localhost:3001';

export interface UnclaimedDrop {
    id: string;
    item_uid: string;
    item_id: number;
    item_attribute: number;
    item_color: number;
    quantity: number;
    source_monster_id: number | null;
    source_map: string | null;
    nft_tier: 'rare' | 'super_rare';
    created_at: string;
}

export interface DropVoucherResponse {
    success: boolean;
    voucher: {
        player: string;
        item_id: number;
        item_uid: string;
        item_attribute: number;
        item_color: number;
        drop_id: string;
        source_map: string | null;
        expiry: number;
    };
    signature: string;
    game_authority: string;
}

function getMiddlewareUrl(): string {
    return import.meta.env.VITE_MIDDLEWARE_URL ?? DEFAULT_MIDDLEWARE_URL;
}

function walletAuthHeaders(): Record<string, string> {
    const token = getStoredWalletToken();
    if (!token) {
        return {};
    }

    return { 'X-Wallet-Token': token };
}

export async function fetchUnclaimedDrops(wallet: string): Promise<UnclaimedDrop[]> {
    const res = await fetch(`${getMiddlewareUrl()}/drops?wallet=${encodeURIComponent(wallet)}`, {
        headers: walletAuthHeaders(),
    });
    if (!res.ok) {
        throw new Error('Failed to fetch unclaimed drops');
    }

    const body = await res.json() as { success: boolean; drops: UnclaimedDrop[] };
    return body.drops ?? [];
}

export async function requestDropVoucher(dropId: string): Promise<DropVoucherResponse> {
    const res = await fetch(`${getMiddlewareUrl()}/drops/${encodeURIComponent(dropId)}/voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw new Error('Failed to request drop voucher');
    }

    return res.json() as Promise<DropVoucherResponse>;
}

export async function claimNftDrop(dropId: string, wallet: string): Promise<{
    mintAddress: string;
    mintMode: string;
    signature: string | null;
    collectionMint: string | null;
    explorerUrl: string | null;
}> {
    const res = await fetch(`${getMiddlewareUrl()}/drops/${encodeURIComponent(dropId)}/claim`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...walletAuthHeaders(),
        },
        body: JSON.stringify({ wallet }),
    });

    const body = await res.json() as {
        success?: boolean;
        error?: string;
        mintAddress?: string;
        mintMode?: string;
        signature?: string | null;
        collectionMint?: string | null;
        explorerUrl?: string | null;
    };

    if (!res.ok || !body.success || !body.mintAddress) {
        const raw = body.error ?? 'Failed to claim NFT drop';
        // Middleware may surface Bubblegum/RPC lag after the on-chain mint already landed.
        if (/could not get transaction from signature/i.test(raw)
            || /leaf could not be read from RPC/i.test(raw)) {
            throw new Error(
                'NFT mint may have landed but Solana RPC could not read the tx yet. '
                + 'Check middleware logs for the signature before claiming again '
                + '(retry can double-mint). Prefer a stronger SOLANA_RPC_URL.',
            );
        }
        throw new Error(raw);
    }

    return {
        mintAddress: body.mintAddress,
        mintMode: body.mintMode ?? 'unknown',
        signature: body.signature ?? null,
        collectionMint: body.collectionMint ?? null,
        explorerUrl: body.explorerUrl ?? null,
    };
}

export async function markDropClaimed(dropId: string, mintAddress: string, wallet: string): Promise<void> {
    const res = await fetch(`${getMiddlewareUrl()}/drops/${encodeURIComponent(dropId)}/claimed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...walletAuthHeaders(),
        },
        body: JSON.stringify({ mint_address: mintAddress, wallet }),
    });
    if (!res.ok) {
        throw new Error('Failed to mark drop as claimed');
    }
}
