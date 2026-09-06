/**
 * Phaser-free HTTP fetch for `.spr` / `.amd` / audio.
 * Live nginx may 200 SPA HTML for missing `/game-assets/` paths; that must not be parsed as a map.
 */

export function isHtmlAssetBody(buffer: ArrayBuffer, contentType: string): boolean {
    const ct = contentType.toLowerCase();
    if (ct.includes('text/html') || ct.includes('application/xhtml')) {
        return true;
    }
    const slice = new Uint8Array(buffer, 0, Math.min(64, buffer.byteLength));
    const head = new TextDecoder('utf-8').decode(slice).trimStart().toLowerCase();
    return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<head');
}

export function looksLikeAmdMap(buffer: ArrayBuffer): boolean {
    const header = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, Math.min(256, buffer.byteLength)));
    return /MAPSIZEX/i.test(header) && /MAPSIZEY/i.test(header);
}

/**
 * Fetches a game binary. Live Hetzner serves packs under `/game-assets/`;
 * Vite/dev and some nginx layouts still use `assets/`.
 * SPA HTML 200s (index.html) must not be treated as `.amd`/`.spr` — that leaves the map registry empty.
 */
export async function fetchGameAssetArrayBuffer(
    folder: 'sprites' | 'maps' | 'sounds' | 'music',
    fileName: string,
    assetOrigin = '',
): Promise<ArrayBuffer> {
    const safeName = fileName.replace(/^.*[/\\]/, '');
    const prefix = assetOrigin.replace(/\/$/, '');
    const candidates = prefix
        ? [
              `${prefix}/game-assets/${folder}/${safeName}`,
              `${prefix}/assets/${folder}/${safeName}`,
          ]
        : [
              `/game-assets/${folder}/${safeName}`,
              `/assets/${folder}/${safeName}`,
              `assets/${folder}/${safeName}`,
          ];
    let lastStatus = 'no attempt';
    for (const url of candidates) {
        const response = await fetch(url);
        if (!response.ok) {
            lastStatus = `${url} → ${response.status} ${response.statusText}`;
            continue;
        }
        const contentType = response.headers.get('content-type') ?? '';
        const buffer = await response.arrayBuffer();
        if (isHtmlAssetBody(buffer, contentType)) {
            lastStatus = `${url} → HTML SPA fallback (not a binary)`;
            continue;
        }
        if (folder === 'maps' && !looksLikeAmdMap(buffer)) {
            lastStatus = `${url} → not an .amd (missing MAPSIZEX)`;
            continue;
        }
        return buffer;
    }
    throw new Error(`Failed to fetch ${folder}/${safeName} (${lastStatus})`);
}
