/**
 * Olympia-style automatic EK screenshot: schedule ~650ms after award, JPEG the Phaser canvas,
 * download locally as {victim}_{nnn}.jpg, and best-effort POST to the middleware gallery stub.
 */

export type EkScreenshotRarity = 'unspecified' | 'common' | 'rare' | 'legendary';

export interface EkScreenshotMeta {
    victimName: string;
    victimPlayerId: string;
    mapName?: string;
    killerName?: string;
    victimCityKillerRank?: number;
    rarity?: EkScreenshotRarity;
}

/** Observed Olympia delay between "Scheduled EK screenshot" and capture (~650ms). */
export const EK_SCREENSHOT_DELAY_MS = 650;

const JPEG_QUALITY = 0.92;

const perVictimCounters = new Map<string, number>();

let middlewareBaseUrl = 'http://localhost:3001';

/** Optional override for gallery upload base (defaults to local middleware). */
export function setEkScreenshotMiddlewareBaseUrl(url: string): void {
    middlewareBaseUrl = url.replace(/\/$/, '');
}

/**
 * Maps proto rarity enum / string into gallery badge labels.
 */
export function normalizeEkScreenshotRarity(raw: string | number | undefined): EkScreenshotRarity {
    if (raw === undefined || raw === null) {
        return 'unspecified';
    }
    if (typeof raw === 'number') {
        switch (raw) {
            case 1:
                return 'common';
            case 2:
                return 'rare';
            case 3:
                return 'legendary';
            default:
                return 'unspecified';
        }
    }
    const key = String(raw).toLowerCase();
    if (key.includes('legendary') || key === '3') {
        return 'legendary';
    }
    if (key.includes('rare') || key === '2') {
        return 'rare';
    }
    if (key.includes('common') || key === '1') {
        return 'common';
    }
    return 'unspecified';
}

/**
 * Locked PO rarity from opposing-city killer rank (1-based). Undefined / out of range → unspecified.
 */
export function rarityFromOpposingCityKillerRank(rank: number | undefined): EkScreenshotRarity {
    if (rank === undefined || !Number.isFinite(rank) || rank < 1) {
        return 'unspecified';
    }
    if (rank <= 10) {
        return 'legendary';
    }
    if (rank <= 50) {
        return 'rare';
    }
    if (rank <= 200) {
        return 'common';
    }
    return 'unspecified';
}

function nextFileIndex(victimName: string): number {
    const key = victimName.trim() || 'unknown';
    const next = perVictimCounters.get(key) ?? 0;
    perVictimCounters.set(key, next + 1);
    return next;
}

function buildFileName(victimName: string, index: number): string {
    const safe = (victimName.trim() || 'unknown').replace(/[\\/:*?"<>|]/g, '_');
    return `${safe}_${String(index).padStart(3, '0')}.jpg`;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | undefined> {
    if (typeof canvas.toBlob === 'function') {
        const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((result) => resolve(result), 'image/jpeg', JPEG_QUALITY);
        });
        if (blob) {
            return blob;
        }
    }
    try {
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        const res = await fetch(dataUrl);
        return await res.blob();
    } catch (err) {
        console.warn('[EkScreenshotCapture] canvas encode failed', err);
        return undefined;
    }
}

async function uploadStub(blob: Blob, fileName: string, meta: EkScreenshotMeta): Promise<void> {
    const rarity = meta.rarity ?? rarityFromOpposingCityKillerRank(meta.victimCityKillerRank);
    const body = {
        fileName,
        victimName: meta.victimName,
        victimPlayerId: meta.victimPlayerId,
        killerName: meta.killerName ?? '',
        mapName: meta.mapName ?? '',
        victimCityKillerRank: meta.victimCityKillerRank,
        rarity,
        capturedAtMs: Date.now(),
        imageBase64: await blobToBase64(blob),
    };
    try {
        const res = await fetch(`${middlewareBaseUrl}/ek-screenshots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            console.warn('[EkScreenshotCapture] upload stub HTTP', res.status);
        }
    } catch (err) {
        // Local download already succeeded; gallery upload is best-effort in MVP.
        console.warn('[EkScreenshotCapture] upload stub failed', err);
    }
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result ?? '');
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Manual screenshot (PrintScreen): JPEG download of the Phaser canvas, no gallery upload.
 */
export function captureManualScreenshot(game: Phaser.Game | undefined): void {
    void (async () => {
        const canvas = game?.canvas;
        if (!canvas) {
            console.warn('[EkScreenshotCapture] manual screenshot: no game canvas');
            return;
        }
        const blob = await canvasToJpegBlob(canvas);
        if (!blob) {
            return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `chainlord_${stamp}.jpg`;
        triggerBrowserDownload(blob, fileName);
        console.info(`[EkScreenshotCapture] Manual screenshot (${fileName})`);
    })();
}

/**
 * Schedules an EK capture on the given Phaser game canvas (Olympia ~650ms delay).
 */
export function scheduleEkScreenshot(game: Phaser.Game | undefined, meta: EkScreenshotMeta): void {
    const victimName = meta.victimName?.trim();
    if (!victimName) {
        console.warn('[EkScreenshotCapture] missing victim name; skip');
        return;
    }
    console.info(`[EkScreenshotCapture] Scheduled EK screenshot for ${victimName}`);
    window.setTimeout(() => {
        void captureNow(game, { ...meta, victimName });
    }, EK_SCREENSHOT_DELAY_MS);
}

async function captureNow(game: Phaser.Game | undefined, meta: EkScreenshotMeta): Promise<void> {
    console.info(`[EkScreenshotCapture] Taking Enemy Kill screenshot... (${meta.victimName})`);
    const canvas = game?.canvas;
    if (!canvas) {
        console.warn('[EkScreenshotCapture] no game canvas');
        return;
    }
    const blob = await canvasToJpegBlob(canvas);
    if (!blob) {
        return;
    }
    const index = nextFileIndex(meta.victimName);
    const fileName = buildFileName(meta.victimName, index);
    triggerBrowserDownload(blob, fileName);
    console.info(`[EkScreenshotCapture] Screenshot (${fileName})`);
    await uploadStub(blob, fileName, meta);
}
