/**
 * Static guards so live `pnpm build` cannot silently reintroduce Chrome OOM
 * (Aw Snap 9) on map enter: preload-all-maps, full-world minimap capture, or
 * eager catalog (effects / NPCs / item-pack data URLs) + parallel sprite decode.
 *
 *   node scripts/assert-live-client-memory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(rel) {
    return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assert(cond, message) {
    if (!cond) {
        failures.push(message);
    }
}

const config = read('src/Config.ts');
const mapManager = read('src/utils/MapManager.ts');
const mapAssets = read('src/utils/MapAssets.ts');
const loadingScreen = read('src/game/scenes/LoadingScreen.ts');
const assets = read('src/constants/Assets.ts');
const gameWorld = read('src/game/scenes/GameWorld.ts');
const loginScreen = read('src/game/scenes/LoginScreen.ts');
const maps = read('src/constants/Maps.ts');
const mapCatalogLookup = read('src/utils/mapCatalogLookup.ts');
const mapViewportStream = read('src/utils/mapViewportStream.ts');
const spriteHttp = read('src/utils/SpriteHttpLoader.ts');
const gameAssetHttp = read('src/utils/gameAssetHttp.ts');
const hbSprite = read('src/game/assets/HBSprite.ts');
const hbMap = read('src/game/assets/HBMap.ts');
const prodVite = read('vite/config.prod.mjs');
const viteEnv = read('src/vite-env.d.ts');
const itemIcons = read('src/utils/ItemIconAssets.ts');
const bootCatalog = read('src/utils/bootCatalog.ts');
const inventoryDialog = read('src/ui/dialogs/InventoryDialog.tsx');
const characterDialog = read('src/ui/dialogs/CharacterDialog.tsx');
const paperDoll = read('src/ui/components/CharacterPaperDoll.tsx');

assert(
    fs.existsSync(path.join(root, 'public/assets/sounds/magic.mp3')),
    'public/assets/sounds/magic.mp3 must be committed so live /assets/sounds/magic.mp3 is not a 404 (fetch stays optional/fallback to C5)',
);

assert(
    /export const LOAD_MAP_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_MAP_ASSETS_ON_DEMAND must stay true so live does not preload every .amd / tile .spr',
);

assert(
    /export const LOAD_MONSTER_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_MONSTER_ASSETS_ON_DEMAND must stay true so live does not register every monster pack at load',
);

assert(
    /export const LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND must stay true so live does not preload every gear .spr',
);

assert(
    /export const LOAD_EFFECT_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_EFFECT_ASSETS_ON_DEMAND must stay true so live does not register every effect pack at load',
);

assert(
    /export const LOAD_NPC_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_NPC_ASSETS_ON_DEMAND must stay true so live does not register every NPC .spr at load',
);

assert(
    /export const LOAD_ITEM_ICON_ASSETS_ON_DEMAND = true;/.test(config),
    'LOAD_ITEM_ICON_ASSETS_ON_DEMAND must stay true so live does not unpack item-pack/item-ground at load',
);

assert(
    /export const LOAD_AUDIO_ON_DEMAND = true;/.test(config),
    'LOAD_AUDIO_ON_DEMAND must stay true so live does not decode catalog mp3s (or 404 magic.mp3) before Select',
);

assert(
    /export const LOAD_BOOT_SPRITES_ON_DEMAND = true;/.test(config),
    'LOAD_BOOT_SPRITES_ON_DEMAND must stay true so live does not decode body/UI .spr before the React hub',
);

assert(
    /export const ENABLE_ZIP_LOADING = false;/.test(config),
    'ENABLE_ZIP_LOADING must stay false on live (zip decompress + register all files OOMs enter)',
);

assert(
    !/export const GENERATE_MINIMAP\s*=\s*true/.test(config),
    'GENERATE_MINIMAP must not be hardcoded true (full-world snapshot OOMs live Chrome)',
);

assert(
    /export const GENERATE_MINIMAP = isViteFlagOn\(import\.meta\.env\.VITE_GENERATE_MINIMAP\)/.test(
        config,
    ),
    'GENERATE_MINIMAP must be gated on VITE_GENERATE_MINIMAP via isViteFlagOn',
);

assert(
    /readonly VITE_GENERATE_MINIMAP\?: string;/.test(viteEnv),
    'vite-env.d.ts must declare VITE_GENERATE_MINIMAP',
);

assert(
    /import\.meta\.env\.VITE_GENERATE_MINIMAP/.test(prodVite) &&
        /process\.env\.VITE_GENERATE_MINIMAP \|\| ''/.test(prodVite),
    'vite/config.prod.mjs must default VITE_GENERATE_MINIMAP to empty (off) unless the operator sets it',
);

assert(
    /shouldGenerateMinimap/.test(mapManager) &&
        /GENERATE_MINIMAP && catalogMinimap === Minimap\.ON_DEMAND_GENERATED/.test(mapManager),
    'MapManager must only full-world-capture when GENERATE_MINIMAP and ON_DEMAND_GENERATED',
);

assert(
    /Minimap\.NONE/.test(mapManager) && /Skipping full-world minimap snapshot/.test(mapManager),
    'MapManager must skip ON_DEMAND capture without hanging the minimap HUD',
);

assert(
    /isTreeSpriteIndex\(idx\)/.test(mapViewportStream) && /indices\.add\(idx \+ 50\)/.test(mapViewportStream),
    'MapAssets must still pull tree-shadow tile indices (tree + 50) on the on-demand path',
);

assert(
    /export async function prepareMapForGameWorld/.test(mapAssets) &&
        /ensureTileSpriteSheets/.test(mapAssets) &&
        /sheetIndices/.test(mapAssets) &&
        /initialFocusStreamRect/.test(mapAssets),
    'prepareMapForGameWorld must decode only viewport tile sheets (not every sheet in the .spr pack)',
);

assert(
    /for \(const asset of tileAssets\)/.test(mapAssets),
    'prepareMapForGameWorld must load tile packs sequentially (not Promise.all)',
);

assert(
    /MAP_STREAM_MAX_WIDTH_TILES = 56/.test(mapViewportStream) &&
        /MAP_STREAM_RING_TILES = 8/.test(mapViewportStream) &&
        /export function cameraStreamTileRect/.test(mapViewportStream) &&
        /export function paintStreamTileRect/.test(mapViewportStream) &&
        /export function shouldRefreshMapStream/.test(mapViewportStream) &&
        /export function mapTileKeysToEvict/.test(mapViewportStream),
    'mapViewportStream must cap the painted window and evict sheets that leave the walk cap',
);

assert(
    /syncViewportStream/.test(hbMap) &&
        /rowTilemapsByY/.test(hbMap) &&
        /Never creates one Phaser tilemap per world row/.test(hbMap),
    'HBMap must stream viewport rows, not one tilemap layer per world Y',
);

assert(
    /paintStreamTileRect/.test(mapManager) &&
        /shouldRefreshMapStream/.test(mapManager) &&
        /evictUnusedMapTileTextures/.test(mapManager) &&
        /streamRefreshQueued/.test(mapManager),
    'MapManager must restream only when the camera leaves the painted cap and evict leftover sheets',
);

assert(
    /export function evictUnusedMapTileTextures/.test(mapAssets),
    'MapAssets must evict map-tile textures outside the current stream keep-set',
);

assert(
    /syncStreamedView/.test(gameWorld) &&
        /focusTileX: this\.initialGameWorldState\?\.playerX/.test(gameWorld) &&
        /setInitialFocusTile\(this\.player\.getWorldX/.test(gameWorld),
    'GameWorld must stream around spawn and re-stream the live player cell after setupMap',
);

assert(
    /findMapByServerId/.test(maps) &&
        /catalogAmdFileName/.test(mapCatalogLookup) &&
        /mapFile\.toLowerCase\(\) === withAmd\.toLowerCase\(\)/.test(mapCatalogLookup),
    'getMapData must match server map id elvine to catalog elvine.amd (PRE_GENERATED minimap / HUD)',
);

assert(
    /catalogAmdFileName\(data\.mapName\)/.test(loginScreen) &&
        /catalogAmdFileName\(data\.mapName\)/.test(gameWorld) &&
        !/`\$\{data\.mapName\}\.amd`/.test(loginScreen) &&
        !/`\$\{data\.mapName\}\.amd`/.test(gameWorld),
    'IGWS mapName must use catalogAmdFileName (never append .amd onto elvine.amd)',
);

assert(
    /isHtmlAssetBody/.test(gameAssetHttp) &&
        /looksLikeAmdMap/.test(gameAssetHttp) &&
        /\/game-assets\//.test(gameAssetHttp) &&
        /\/assets\//.test(gameAssetHttp) &&
        /fetchGameAssetArrayBuffer/.test(spriteHttp),
    'fetchGameAssetArrayBuffer must try game-assets + assets and reject HTML SPA bodies',
);

assert(
    !/tryDecodeWithImageDecoder/.test(hbSprite) &&
        /ImageDecoder\/VideoFrame is not used/.test(hbSprite) &&
        /scene\.game\.renderer\.type === CANVAS/.test(hbSprite) &&
        /sheetIndices/.test(hbSprite) &&
        /Partial tile-sheet loads keep it/.test(hbSprite) &&
        /Yield so Canvas-first Chrome can GC ImageBitmaps/.test(hbSprite) &&
        /sliceSprSheets/.test(hbSprite),
    'HBSprite must not upload VideoFrames then close them; tile packs decode only requested sheets',
);

const sprSheetSlice = read('src/utils/sprSheetSlice.ts');
assert(
    /export function sliceSprSheets/.test(sprSheetSlice) &&
        /png: new Uint8Array\(buffer\.slice/.test(sprSheetSlice),
    'sliceSprSheets must copy only requested sheet PNGs (not views of the full .spr)',
);

assert(
    /occupiedFlags\.fill\(0\)/.test(hbMap) &&
        /new Uint8Array\(this\.sizeX \* this\.sizeY\)/.test(hbMap) &&
        /Use \{\@link getTile\}/.test(hbMap),
    'HBMap must not allocate one HBMapTile per world cell at parse (Elvine 300×300 OOM)',
);

assert(
    /LOAD_MAP_ASSETS_ON_DEMAND && \(a\.assetType === AssetType\.MAP \|\| a\.assetType === AssetType\.TILE_SPRITE\)/.test(
        loadingScreen,
    ),
    'LoadingScreen must omit MAP and TILE_SPRITE assets when LOAD_MAP_ASSETS_ON_DEMAND is on',
);

assert(
    /if \(!LOAD_MAP_ASSETS_ON_DEMAND\)/.test(loadingScreen),
    'LoadingScreen must not unpack all maps when on-demand is on',
);

assert(
    /for \(const asset of spriteAssets\)/.test(loadingScreen) &&
        /Body first/.test(loadingScreen) &&
        /wm\.spr/.test(loadingScreen),
    'LoadingScreen must decode sprites sequentially (body first / wm.spr), not Promise.all catalog packs',
);

assert(
    /Consumption SFX are never eager-registered/.test(assets) &&
        !/consumptionSounds\.forEach/.test(assets),
    'getAssets must not enqueue consumptionSound files (magic.mp3 404 / boot decode)',
);

assert(
    /LOAD_AUDIO_ON_DEMAND/.test(loadingScreen) &&
        /LOAD_BOOT_SPRITES_ON_DEMAND/.test(loadingScreen) &&
        /a\.assetType === AssetType\.SPRITE/.test(loadingScreen),
    'LoadingScreen must omit MUSIC/SOUND/SPRITE on the HTTP live path',
);

assert(
    /if \(!LOAD_EFFECT_ASSETS_ON_DEMAND\)/.test(assets) &&
        /if \(!LOAD_NPC_ASSETS_ON_DEMAND\)/.test(assets) &&
        /sprite-item-pack/.test(assets) &&
        /sprite-item-ground/.test(assets),
    'getAssets must skip effects, NPCs, and item-pack/item-ground when on-demand flags are on',
);

assert(
    /startDeferredAppearancePrefetch/.test(gameWorld) &&
        /drainPlayerItemAppearancePrefetch/.test(gameWorld) &&
        /loadWorldDeferredSprites/.test(gameWorld),
    'GameWorld must defer equipped appearance prefetch and HUD sheets until after map setup',
);

assert(
    /loadSelectAppearanceSprites/.test(loginScreen),
    'LoginScreen must load SELECTCHAR paper-dolls after the React hub, not at Boot',
);

assert(
    /failedAudioKeys/.test(spriteHttp) &&
        /will not retry/.test(spriteHttp) &&
        /resolveSoundAsset/.test(spriteHttp),
    'Sound fetch must alias magic→C5 and never throw/retry on 404',
);

assert(
    /loadNpcSpriteOnDemand/.test(gameWorld) && /loadItemIconAssetsOnDemand/.test(gameWorld),
    'GameWorld must lazy-load NPC sprites and item icon packs on enter/view, not at LoadingScreen',
);

assert(
    /loadSpriteSheetsOnDemand/.test(spriteHttp) &&
        /sheetIndices: new Set\(still\)/.test(spriteHttp) &&
        /new HBSpriteFile\(asset\.key, asset\.spriteType, false/.test(spriteHttp),
    'SpriteHttpLoader must decode listed sheets only and never data-URL dump them',
);

assert(
    /packSheets/.test(itemIcons) &&
        /groundSheets/.test(itemIcons) &&
        /if \(packSheets\.length === 0 && groundSheets\.length === 0\)/.test(itemIcons),
    'ItemIconAssets must no-op without sheet lists (never decode full bag on Char open)',
);

assert(
    /loadSpriteSheetsOnDemand/.test(bootCatalog) &&
        /WORLD_HUD_FRAME_KEYS/.test(bootCatalog) &&
        /ensureNamedSpriteFrames/.test(bootCatalog) &&
        !/dialogtext\.spr/.test(bootCatalog) &&
        !/item-pack\.spr/.test(bootCatalog),
    'Deferred world HUD must not decode dialogtext or item-pack',
);

assert(
    /key: 'sprite-item-pack', fileName: 'item-pack\.spr', assetType: AssetType\.SPRITE, spriteType: SpriteType\.ItemPack, exportFramesAsDataUrls: false/.test(
        assets,
    ) &&
        /key: 'sprite-dialogtext', fileName: 'dialogtext\.spr', assetType: AssetType\.SPRITE, spriteType: SpriteType\.Interface, exportFramesAsDataUrls: false/.test(
            assets,
        ),
    'Interface and item-pack catalog rows must not dump every frame as a PNG data URL',
);

assert(
    /IN_UI_ENSURE_SPRITE_FRAMES/.test(gameWorld) &&
        /runPaperDollCapture/.test(gameWorld) &&
        /groundItemIconSheets/.test(gameWorld) &&
        /loadItemIconAssetsOnDemand\(this, request\)/.test(gameWorld),
    'GameWorld must sheet-filter ground icons and coalesce F5 paper-doll captures',
);

assert(
    /packSheets/.test(inventoryDialog) &&
        /BAG_CHROME_FRAME_KEYS/.test(inventoryDialog) &&
        !/loadItemIconAssetsOnDemand\(scene\)/.test(inventoryDialog),
    'F6 bag must load item-pack sheets for bagged items only, not the full pack+ground',
);

assert(
    /CHARACTER_MAIN_FRAME_KEYS/.test(characterDialog) &&
        /IN_UI_ENSURE_SPRITE_FRAMES/.test(characterDialog) &&
        /IN_UI_ENSURE_SPRITE_FRAMES/.test(paperDoll) &&
        !/4000/.test(paperDoll),
    'F5 Char must request dialogtext chrome + jewelry frames only (no 6-timeout capture burst)',
);

if (failures.length > 0) {
    console.error('[assert-live-client-memory] FAILED:');
    for (const f of failures) {
        console.error(`  - ${f}`);
    }
    process.exit(1);
}

console.log(
    '[assert-live-client-memory] OK — live on-demand maps/minimap/catalog + sequential sprite decode',
);
