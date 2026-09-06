import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    fetchGameAssetArrayBuffer,
    isHtmlAssetBody,
    loadSoundAssetOnDemand,
    looksLikeAmdMap,
} from './SpriteHttpLoader';

function asciiBuffer(text: string, minBytes = text.length): ArrayBuffer {
    const bytes = new Uint8Array(minBytes);
    for (let i = 0; i < text.length && i < minBytes; i++) {
        bytes[i] = text.charCodeAt(i);
    }
    return bytes.buffer;
}

describe('gameAssetHttp fetch guards', () => {
    it('rejects SPA HTML bodies that nginx would return as 200', () => {
        const html = asciiBuffer('<!DOCTYPE html><html><head></head></html>');
        assert.equal(isHtmlAssetBody(html, 'text/html; charset=utf-8'), true);
        assert.equal(isHtmlAssetBody(html, 'application/octet-stream'), true);
    });

    it('accepts a live-shaped .amd header (Elvine MAPSIZEX 300)', () => {
        const header = 'MAPSIZEX =  300 MAPSIZEY =  300 TILESIZE = 10';
        const buf = asciiBuffer(header, 256);
        assert.equal(looksLikeAmdMap(buf), true);
        assert.equal(isHtmlAssetBody(buf, 'application/octet-stream'), false);
    });

    it('skips HTML 200 then loads /assets/maps/elvine.amd', async () => {
        const amd = asciiBuffer('MAPSIZEX =  300 MAPSIZEY =  300 TILESIZE = 10', 256);
        const html = asciiBuffer('<!DOCTYPE html><html>', 64);
        const seen: string[] = [];
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            seen.push(url);
            if (url.includes('/game-assets/')) {
                return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
            }
            return new Response(amd, {
                status: 200,
                headers: { 'content-type': 'application/octet-stream' },
            });
        }) as typeof fetch;
        try {
            const buf = await fetchGameAssetArrayBuffer('maps', 'elvine.amd');
            assert.equal(looksLikeAmdMap(buf), true);
            assert.ok(seen.some((u) => u.includes('/game-assets/maps/elvine.amd')));
            assert.ok(seen.some((u) => u.includes('/assets/maps/elvine.amd')));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});

describe('on-demand sound 404 / alias', () => {
    function fakeScene() {
        const keys = new Set<string>();
        return {
            cache: {
                audio: {
                    exists: (k: string) => keys.has(k),
                    add: (k: string) => {
                        keys.add(k);
                    },
                },
            },
            sound: {
                context: {
                    decodeAudioData: async (buffer: ArrayBuffer) => buffer,
                },
            },
        };
    }

    it('does not throw when a catalog sound 404s', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch;
        try {
            await loadSoundAssetOnDemand(fakeScene() as never, 'zzz-missing', 'zzz-missing.mp3');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('resolves consumptionSound magic to C5.mp3 URLs', async () => {
        const seen: string[] = [];
        const originalFetch = globalThis.fetch;
        const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer;
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            seen.push(url);
            if (url.includes('C5.mp3')) {
                return new Response(mp3, {
                    status: 200,
                    headers: { 'content-type': 'audio/mpeg' },
                });
            }
            return new Response('no', { status: 404 });
        }) as typeof fetch;
        try {
            const scene = fakeScene();
            await loadSoundAssetOnDemand(scene as never, 'magic', 'magic.mp3');
            assert.equal(seen.some((u) => u.includes('magic.mp3')), false);
            assert.ok(seen.some((u) => u.includes('C5.mp3')));
            assert.equal(scene.cache.audio.exists('C5'), true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
