import fs from 'fs'
import path from 'path'

const BINARY_EXT = /\.(amd|spr|mp3|wav|ogg|m4a|bin|wma)$/i

/**
 * Playtest Vite: serve Helbreath binaries from public/assets.
 * `/game-assets/*` is the client fetch prefix (CF prod); locally files live at `/assets/*`.
 * World id `traveler` maps to `default.amd`. Never SPA-fallback `.amd`/audio to index.html.
 *
 * @param {string} mpClientRoot
 */
export function helbreathPlaytestAssetsPlugin(mpClientRoot) {
    const assetsRoot = path.resolve(mpClientRoot, 'public', 'assets')

    /**
     * @param {string} url
     * @returns {string | null}
     */
    function resolveDiskPath(url) {
        let pathname = (url ?? '').split('?')[0]
        try {
            pathname = decodeURIComponent(pathname)
        } catch {
            /* keep raw */
        }
        if (pathname.startsWith('/game-assets/')) {
            pathname = `/assets/${pathname.slice('/game-assets/'.length)}`
        }
        if (/\/traveler\.amd$/i.test(pathname)) {
            pathname = '/assets/maps/default.amd'
        }
        if (/\/assets\/maps\/traveler\.amd$/i.test(pathname)) {
            pathname = '/assets/maps/default.amd'
        }
        if (!pathname.startsWith('/assets/')) {
            return null
        }
        const rel = pathname.slice('/assets/'.length)
        const resolved = path.resolve(assetsRoot, rel)
        const rootWithSep = assetsRoot.endsWith(path.sep) ? assetsRoot : `${assetsRoot}${path.sep}`
        if (resolved !== assetsRoot && !resolved.startsWith(rootWithSep)) {
            return null
        }
        return resolved
    }

    /**
     * @param {string} ext
     */
    function contentTypeFor(ext) {
        switch (ext) {
            case '.mp3':
                return 'audio/mpeg'
            case '.wav':
                return 'audio/wav'
            case '.ogg':
                return 'audio/ogg'
            case '.m4a':
                return 'audio/mp4'
            default:
                return 'application/octet-stream'
        }
    }

    /**
     * @param {import('http').IncomingMessage} req
     * @param {import('http').ServerResponse} res
     * @param {() => void} next
     */
    function serveHelbreathAsset(req, res, next) {
        const url = req.url ?? ''
        const pathname = url.split('?')[0]
        const disk = resolveDiskPath(url)
        if (disk && fs.existsSync(disk) && fs.statSync(disk).isFile()) {
            const ext = path.extname(disk).toLowerCase()
            res.statusCode = 200
            res.setHeader('Content-Type', contentTypeFor(ext))
            res.setHeader('Cache-Control', 'no-cache')
            fs.createReadStream(disk).pipe(res)
            return
        }
        if (BINARY_EXT.test(pathname) || pathname.endsWith('.amd')) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('Helbreath asset not found (not index.html)')
            return
        }
        next()
    }

    return {
        name: 'helbreath-playtest-assets',
        configureServer(server) {
            server.middlewares.use(serveHelbreathAsset)
        },
        configurePreviewServer(server) {
            server.middlewares.use(serveHelbreathAsset)
        },
    }
}
