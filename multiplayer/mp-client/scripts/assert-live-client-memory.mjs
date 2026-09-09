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
assert(
    /spriteTypeForEquippedAppearance/.test(assets) &&
        /SpriteType\.EquipmentPack/.test(assets) &&
        /getItemByEquippedSprite/.test(assets) &&
        /whhauberk1/.test(assets),
    'Unknown equipped clothes (Elvine hauberk / Hero Hauberk(W)) must synthesize as EquipmentPack, not Weapons',
);
const gameWorld = read('src/game/scenes/GameWorld.ts');
const loginScreen = read('src/game/scenes/LoginScreen.ts');
const appHub = read('src/App.tsx');
const connectDialog = read('src/ui/dialogs/ConnectDialog.tsx');
const maps = read('src/constants/Maps.ts');
const mapCatalogLookup = read('src/utils/mapCatalogLookup.ts');
const mapViewportStream = read('src/utils/mapViewportStream.ts');
const spriteHttp = read('src/utils/SpriteHttpLoader.ts');
const monsterAssets = read('src/utils/MonsterAssets.ts');
const npcAssets = read('src/utils/NpcAssets.ts');
const effectAssets = read('src/utils/EffectAssets.ts');
const itemIconAssets = read('src/utils/ItemIconAssets.ts');
const itemAssets = read('src/utils/ItemAssets.ts');
const bootCatalog = read('src/utils/bootCatalog.ts');
const entitySheetFilter = read('src/utils/entitySheetFilter.ts');
const gameAsset = read('src/game/objects/GameAsset.ts');
assert(
    /Map props skip debug Graphics/.test(gameAsset) &&
        /if \(!config\.mapObject\)/.test(gameAsset) &&
        /this\.debugGraphics = scene\.add\.graphics/.test(gameAsset),
    'GameAsset must not allocate debug Graphics for every map object on plaza enter',
);

const playerTs = read('src/game/objects/Player.ts');
assert(
    /delayedCall\(0/.test(playerTs) && /IN_UI_PAPERDOLL_CAPTURE/.test(playerTs),
    'Player must defer F5 capture after gear bind (sync capture can blank the world canvas)',
);
assert(
    /currentState === PlayerState\.Cast/.test(playerTs)
        && /shouldAdvanceCastToReady/.test(playerTs)
        && /canPresentCastingCircle/.test(playerTs)
        && /canCreateMagiasUiPhaserText/.test(playerTs)
        && /endMagiasRitual/.test(playerTs)
        && /castAppearanceSkipped/.test(playerTs)
        && /fail-closed/.test(playerTs)
        && !/loadEffectAssetsOnDemand/.test(playerTs)
        && !/\.generateTexture\(/.test(playerTs),
    'Missile select/prepare must not generateTexture or lazy-load effect5-7; skip F5 blit, Phaser Text, and Cast appearance; wait castSpeed if CAST anim never plays',
);
const createCircle = playerTs.slice(
    playerTs.indexOf('private createCastingCircleEffect'),
    playerTs.indexOf('private spawnCastingCircleEffect'),
);
assert(
    /canPresentCastingCircle/.test(createCircle)
        && !/loadEffectAssetsOnDemand/.test(createCircle)
        && !/removeWorldCanvasAliasedTexture/.test(createCircle),
    'createCastingCircleEffect must not load or textures.remove on Missile prepare',
);
const appearanceMgr = read('src/utils/PlayerAppearanceManager.ts');
const scheduleMissing = appearanceMgr.slice(
    appearanceMgr.indexOf('private scheduleMissingAnimationSheetIfNeeded'),
    appearanceMgr.indexOf('private flushPendingLazyItemPromotionForSprite'),
);
assert(
    /canFetchAppearanceSheetOnStateEnter/.test(scheduleMissing)
        && /PlayerState\.Cast/.test(scheduleMissing),
    'Cast enter must not fetch clothes CAST sheet 8 / angelic CAST sheets',
);
const scheduleLazy = appearanceMgr.slice(
    appearanceMgr.indexOf('private scheduleLazyItemAppearanceIfNeeded'),
    appearanceMgr.indexOf('private scheduleMissingAnimationSheetIfNeeded'),
);
assert(
    /canFetchAppearanceSheetOnStateEnter/.test(scheduleLazy)
        && /PlayerState\.Cast/.test(scheduleLazy),
    'Cast enter must not HTTP the clothes idle pack (scheduleLazyItemAppearanceIfNeeded)',
);
const castPresentation = read('src/utils/castPresentation.ts');
assert(
    /canMutateWorldCanvasTexturesOnCastEnter/.test(castPresentation)
        && /canCreateMagiasUiPhaserText/.test(castPresentation)
        && /planCastEnterVisuals/.test(castPresentation)
        && /planMagiasSpellSelect/.test(castPresentation)
        && /applyMagiasSpellSelectVisuals/.test(castPresentation)
        && /beginMagiasRitual/.test(castPresentation)
        && /canTouchCanvasPoolOnMagiasSelect/.test(castPresentation)
        && /return false/.test(castPresentation.slice(castPresentation.indexOf('export function canMutateWorldCanvasTexturesOnCastEnter')))
        && /return false/.test(castPresentation.slice(castPresentation.indexOf('export function canCreateMagiasUiPhaserText')))
        && /return false/.test(castPresentation.slice(castPresentation.indexOf('export function canTouchCanvasPoolOnMagiasSelect'))),
    'Magias select/Cast path must refuse Phaser Text, CanvasPool(game.canvas), generateTexture, addCanvas, textures.remove',
);
const castDialogStore = read('src/ui/store/CastDialog.store.ts');
assert(
    /beginMagiasRitual/.test(castDialogStore)
        && /castSpellById/.test(castDialogStore),
    'F7 spell select (castSpellById) must arm the magias ritual before IN_UI_CAST_SPELL / PlayerState.Cast',
);
const floatingText = read('src/game/effects/FloatingText.ts');
assert(
    /isMagiasRitualActive/.test(floatingText)
        && /destroyed = true/.test(floatingText),
    'FloatingText must not scene.add.text during the magias ritual (CanvasPool steal)',
);
const spellMap = read('src/constants/OlympiaServerSpellMap.ts');
assert(
    /SPELL_MAGIC_MISSILE_ID/.test(spellMap) && /ENERGY_BOLT/.test(spellMap),
    'Magic Missile must map to the Energy Bolt catalog so confirm/spend reach the server',
);
const spriteUtils = read('src/utils/SpriteUtils.ts');
const lightOverlay = spriteUtils.slice(
    spriteUtils.indexOf('export function createLightRadiusOverlay'),
    spriteUtils.indexOf('export function getSpriteFrameHeight'),
);
assert(
    /isSafeDrawableTexture/.test(lightOverlay),
    'createLightRadiusOverlay must refuse a world-canvas alias of sprite-effect-0',
);
const shadowMgr = read('src/utils/ShadowManager.ts');
assert(
    /isSafeDrawableTexture/.test(shadowMgr),
    'ShadowManager must not bind human CAST sheet 64+dir when it is a world-canvas alias',
);
const safetyTs = read('src/utils/worldCanvasTextureSafety.ts');
const removeAliasFn = safetyTs.slice(safetyTs.indexOf('export function removeWorldCanvasAliasedTexture'));
assert(
    !/scene\.textures\.remove/.test(removeAliasFn) && !/anims\.remove/.test(removeAliasFn),
    'removeWorldCanvasAliasedTexture must not textures.remove a world-canvas alias (CanvasPool 1×1)',
);
const magicBook = read('src/utils/magicBookClient.ts');
assert(
    /CIRCLE_ONE_OLYMPIA_IDS = \[0, 1, 2\]/.test(magicBook),
    'F7 Circle Olympia ids must stay [0, 1, 2]',
);
const energyBolt = read('src/game/spells/EnergyBolt.ts');
const effectTs = read('src/game/effects/Effect.ts');
const effectUtils = read('src/utils/EffectUtils.ts');
assert(
    /isSafeDrawableTexture/.test(energyBolt)
        && /loadEffectAssetsOnDemand/.test(energyBolt)
        && !/\.generateTexture\(/.test(energyBolt)
        && /isSafeDrawableTexture/.test(effectTs)
        && /pendingLazyPlayerItemAppearance/.test(effectTs) === false
        && /isSafeDrawableTexture/.test(effectUtils),
    'Cast FX / Missile projectile must refuse a world-canvas texture alias and must not use the paperdoll pending GameAsset',
);
assert(
    /Keep pending so the 1/.test(gameAsset) &&
        /ensurePendingPlayerItemAppearanceTexture/.test(gameAsset) &&
        /Missing sheet must not throw/.test(gameAsset),
    'GameAsset.promote must not clear pending when the real sheet is missing; missing player textures must not throw',
);
assert(
    /isSafeDrawableTexture/.test(gameAsset) && /removeWorldCanvasAliasedTexture/.test(gameAsset),
    'GameAsset must not bind a generateTexture alias of the live world canvas (Missile / Heal prepare)',
);
const playAnim = gameAsset.slice(
    gameAsset.indexOf('public playAnimationWithDirection'),
    gameAsset.indexOf('private setStaticFrameFromAnimation'),
);
assert(
    /isSafeDrawableTexture/.test(playAnim),
    'playAnimationWithDirection must refuse a world-canvas texture alias (CAST clothes bind)',
);
assert(
    /safeBindableTextureKey/.test(gameAsset),
    'GameAsset must bind __DEFAULT when pending is still a world-canvas alias',
);

const bootTs = read('src/game/scenes/Boot.ts');
const pendingTex = read('src/utils/pendingAppearanceTexture.ts');
const eventBusTs = read('src/game/EventBus.ts');
assert(
    /ensurePendingPlayerItemAppearanceTexture/.test(bootTs) &&
        !/\.generateTexture\(/.test(bootTs) &&
        /addCanvas/.test(pendingTex) &&
        /isWorldCanvasImageSource/.test(pendingTex),
    'Pending appearance texture must be an isolated addCanvas, not generateTexture of the world canvas',
);
assert(
    /listener failed for/.test(eventBusTs) && /onEquipItem failed/.test(playerTs),
    'EventBus and Player.equip must swallow throws so F5/equip cannot remount the landing hub',
);

assert(
    /idleEntitySheetIndices/.test(entitySheetFilter) &&
        /ENTITY_DEAD_SHEET_BASE = 32/.test(entitySheetFilter),
    'entitySheetFilter must keep idle 0-7 and exclude death 32+',
);

assert(
    /sheetIndices \?\? idleEntitySheetIndices/.test(monsterAssets) &&
        /false, asset\.tileStartIndex/.test(monsterAssets),
    'MonsterAssets must decode idle sheets by default and never dump data URLs',
);

assert(
    /idleEntitySheetIndices\(\)/.test(npcAssets),
    'NpcAssets must decode idle sheets only (not full 40-sheet NPC packs on plaza enter)',
);

assert(
    /config\.spriteSheetIndex/.test(effectAssets),
    'EffectAssets must decode only the VFX sheet used by the config',
);

assert(
    /SETTLE_APPEARANCE_SHEETS/.test(itemAssets) &&
        /settleAppearanceSheetIndices/.test(itemAssets) &&
        /sheetIndices \?\? settleAppearanceSheetIndices/.test(itemAssets) &&
        /sheetIndices: new Set\(stillMissing\)/.test(itemAssets) &&
        /playerItemAppearanceDecodeAllowed/.test(itemAssets) &&
        !/hbFile\.load\(scene\);/.test(itemAssets),
    'ItemAssets must decode idle appearance sheets only after settle, never the full .spr on enter',
);
const itemAppearanceSheets = read('src/utils/itemAppearanceSheets.ts');
const paperDollCapture = read('src/utils/paperDollCapture.ts');
const characterPaperDoll = read('src/ui/components/CharacterPaperDoll.tsx');
assert(
    /ARMOUR_SETTLE_SHEETS = \[0, 1, 2, 3\]/.test(itemAppearanceSheets) &&
        /WEAPON_SETTLE_SHEETS = \[/.test(itemAppearanceSheets) &&
        /8, 9, 10, 11, 12, 13, 14, 15/.test(itemAppearanceSheets) &&
        /weaponAppearanceSheetIndex/.test(itemAppearanceSheets) &&
        /paperDollLayerSheetIndices/.test(itemAppearanceSheets) &&
        /paperDollPendingGearJobs/.test(itemAppearanceSheets) &&
        /packBase/.test(itemAppearanceSheets),
    'Armour settle 0–3; weapon settle idle-peace+combat 0–15 (attackMode stand is pack+8+dir)',
);
assert(
    /runPaperDollCapture/.test(paperDollCapture) &&
        /paperDollPendingGearJobs/.test(paperDollCapture) &&
        /sheetIndices: new Set\(job\.sheets\)/.test(paperDollCapture) &&
        /arePlayerItemAppearanceSheetsLoaded/.test(paperDollCapture) &&
        /queuePaperDollPendingGearLoads/.test(paperDollCapture) &&
        /PENDING_APPEARANCE_TEXTURE_KEY/.test(paperDollCapture) &&
        /isWorldCanvasImageSource/.test(paperDollCapture) &&
        !/pending\.map\(\(name\) =>/.test(paperDollCapture),
    'F5 capture must coalesce, skip world-canvas sources, and load only paper-doll south sheets',
);
assert(
    /paperDollLookKey/.test(characterPaperDoll) &&
        /\[400, 1600\]/.test(characterPaperDoll) &&
        !/80, 250, 600, 1200, 2200, 4000/.test(characterPaperDoll),
    'F5 paper-doll must not burst six recaptures on equippedItems identity',
);

assert(
    /LoadItemIconOptions/.test(itemIconAssets) &&
        /packSheets/.test(itemIconAssets) &&
        /groundSheets/.test(itemIconAssets),
    'ItemIconAssets must decode only requested bag/ground sheets',
);

assert(
    /WORLD_ENTER_HUD_ASSETS/.test(bootCatalog) &&
        /sheets: \[6\]/.test(bootCatalog) &&
        /WORLD_ENTER_HUD_FRAME_KEYS/.test(bootCatalog) &&
        /evictUnusedSelectAppearanceSprites/.test(bootCatalog) &&
        /trimSelectAppearanceToIdleSheets/.test(bootCatalog) &&
        /loadWorldEnterAppearanceSprites/.test(bootCatalog) &&
        /worldEnterAppearanceSheetJobs/.test(bootCatalog) &&
        /sheetIndices: new Set\(job\.sheets\)/.test(bootCatalog) &&
        /hairStyle \* 12/.test(read('src/utils/worldEnterAppearance.ts')) &&
        !/getMonsterPlaceholderAsset\(\)/.test(
            bootCatalog.slice(bootCatalog.indexOf('export async function loadWorldDeferredSprites')),
        ),
    'bootCatalog enter HUD must be cursor + gamedialog2 sheet 6 only, no placeholder pack',
);

assert(
    /sheetIndices/.test(spriteHttp) &&
        /Never dumps every frame as a PNG data URL/.test(spriteHttp) &&
        /exportFramesAsDataUrls === true/.test(spriteHttp) === false,
    'SpriteHttpLoader must not dump catalog exportFramesAsDataUrls on the live on-demand path',
);
const gameAssetHttp = read('src/utils/gameAssetHttp.ts');
const hbSprite = read('src/game/assets/HBSprite.ts');
const hbMap = read('src/game/assets/HBMap.ts');
const prodVite = read('vite/config.prod.mjs');
const viteEnv = read('src/vite-env.d.ts');

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

const phaserGame = read('src/PhaserGame.tsx');
const walletAuth = read('src/utils/walletAuth.ts');
assert(
    /shouldConstructPhaserAfterSeal/.test(phaserGame) &&
        !/from ['"]phaser['"]/.test(phaserGame) &&
        /setLivePhaserGame/.test(phaserGame) &&
        /parkPhaserForWalletUi/.test(walletAuth) &&
        walletAuth.indexOf('parkPhaserForWalletUi') < walletAuth.indexOf('phantom.connect'),
    'Phaser must not boot on the hub; PhaserGame must not import phaser; Phantom connect/sign must park the canvas (KindGem Aw Snap 9)',
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
    /includeTreeShadows \?\? false/.test(mapAssets) &&
        /includeObjectSprites \?\? !firstPaint/.test(mapAssets) &&
        /firstPaintStreamRect/.test(mapAssets) &&
        /includeTreeShadows = true/.test(mapAssets) &&
        /includeObjectSprites = true/.test(mapAssets) &&
        /waitMs\(yieldMs\)/.test(mapAssets) &&
        /waitForBrowserFrames\(1\)/.test(mapAssets) &&
        /for \(const asset of tileAssets\)/.test(mapAssets),
    'prepareMapForGameWorld must skip tree-shadow and object sheets on first paint and yield between sequential packs',
);

assert(
    /MAP_STREAM_MAX_WIDTH_TILES = 56/.test(mapViewportStream) &&
        /MAP_STREAM_RING_TILES = 8/.test(mapViewportStream) &&
        /MAP_ENTER_RING_TILES = 4/.test(mapViewportStream) &&
        /MAP_FIRST_PAINT_MAX_WIDTH_TILES = 12/.test(mapViewportStream) &&
        /MAP_FIRST_PAINT_MAX_HEIGHT_TILES = 8/.test(mapViewportStream) &&
        /MAP_STREAM_REFRESH_SLACK_TILES = 10/.test(mapViewportStream) &&
        /MAP_STAND_REFRESH_SLACK_TILES = 16/.test(mapViewportStream) &&
        /MAP_EXPAND_STEP_TILES = 4/.test(mapViewportStream) &&
        /MAP_POST_PAINT_MAX_WIDTH_TILES = 20/.test(mapViewportStream) &&
        /MAP_POST_PAINT_MAX_HEIGHT_TILES = 12/.test(mapViewportStream) &&
        /ringTiles: MAP_ENTER_RING_TILES/.test(mapViewportStream) &&
        /export function firstPaintStreamRect/.test(mapViewportStream) &&
        /export function postPaintStreamRect/.test(mapViewportStream) &&
        /export function growMapTileRectToward/.test(mapViewportStream) &&
        /export function waitForBrowserFrames/.test(mapViewportStream) &&
        /export function waitMs/.test(mapViewportStream) &&
        /export function cameraStreamTileRect/.test(mapViewportStream) &&
        /export function paintStreamTileRect/.test(mapViewportStream) &&
        /export function shouldRefreshMapStream/.test(mapViewportStream) &&
        /export function mapTileKeysToEvict/.test(mapViewportStream),
    'mapViewportStream must cap walk paint, use a tiny first-paint window, tighter enter ring, and evict leftover sheets',
);

assert(
    /syncViewportStream/.test(hbMap) &&
        /rowTilemapsByY/.test(hbMap) &&
        /Never creates one Phaser tilemap per world row/.test(hbMap) &&
        /1 ground layer/.test(hbMap) &&
        /ground-stream/.test(hbMap) &&
        /streamObjectsEnabled = false/.test(hbMap) &&
        /countUninstantiatedStreamObjects/.test(hbMap) &&
        /maxNewInstances/.test(hbMap) &&
        !/ground-y-\$\{y\}/.test(hbMap),
    'HBMap must stream one ground layer, not one tilemap layer per world Y',
);

assert(
    /firstPaintStreamRect/.test(mapManager) &&
        /Frame-0: ground only/.test(mapManager) &&
        /standingHold/.test(mapManager) &&
        /growMapTileRectToward/.test(mapManager) &&
        /MAP_STAND_REFRESH_SLACK_TILES/.test(mapManager) &&
        /shouldRefreshMapStream/.test(mapManager) &&
        /evictUnusedMapTileTextures/.test(mapManager) &&
        /streamRefreshQueued/.test(mapManager),
    'MapManager must paint a tiny ground-only first window, restream later, and evict leftover sheets',
);

assert(
    /export function evictUnusedMapTileTextures/.test(mapAssets) &&
        /export function evictAllMapTileTextures/.test(mapAssets),
    'MapAssets must evict map-tile textures outside the current stream keep-set',
);

assert(
    /syncStreamedView/.test(gameWorld) &&
        /focusTileX: this\.initialGameWorldState\?\.playerX/.test(gameWorld) &&
        /setInitialFocusTile\(this\.player\.getWorldX/.test(gameWorld) &&
        /expandMapAfterFirstPaint/.test(gameWorld) &&
        /waitForBrowserFrames/.test(gameWorld) &&
        /evictUnusedSelectAppearanceSprites/.test(gameWorld) &&
        /trimSelectAppearanceToIdleSheets/.test(gameWorld) &&
        /loadWorldEnterAppearanceSprites/.test(gameWorld) &&
        /runPaperDollCapture/.test(gameWorld) &&
        /evictAllMapTileTextures/.test(gameWorld) &&
        !/invalidatePaperDollCache/.test(gameWorld) &&
        /firstPaint: true/.test(gameWorld) &&
        /includeObjectSprites: false/.test(gameWorld) &&
        /enableTreesAfterFirstPaint/.test(gameWorld) &&
        /standingHold/.test(gameWorld) &&
        /postPaintStreamRect/.test(gameWorld) &&
        /growMapTileRectToward/.test(gameWorld) &&
        /instantiateStreamObjectsBatched/.test(gameWorld) &&
        /mapStreamWalkEnabled/.test(gameWorld),
    'GameWorld must first-paint tiny ground, expand in steps after rAF, and hold walk-cap restream while standing',
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
        /scene\.game\.renderer\.type === PHASER_RENDERER_CANVAS/.test(hbSprite) &&
        /sheetIndices/.test(hbSprite) &&
        /Partial loads keep it/.test(hbSprite) &&
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
    /worldReadyForEntities/.test(gameWorld) &&
        /tickMapSetupWatchdog/.test(gameWorld) &&
        /noteMapSetupProgress/.test(gameWorld) &&
        /onProgress: \(\) => this\.noteMapSetupProgress/.test(gameWorld) &&
        /delayedCall\(10000/.test(gameWorld) &&
        /delayedCall\(12000/.test(gameWorld) &&
        /delayedCall\(14000/.test(gameWorld) &&
        /delayedCall\(16000/.test(gameWorld) &&
        /delayedCall\(18000/.test(gameWorld) &&
        /delayedCall\(20000/.test(gameWorld) &&
        /setPlayerItemAppearanceDecodeAllowed\(false\)/.test(gameWorld) &&
        /setPlayerItemAppearanceDecodeAllowed\(true\)/.test(gameWorld) &&
        /displayedMap \|\| this\.pendingLoadedMap \|\| this\.mapPrepareInFlight/.test(gameWorld),
    'GameWorld must fail-soft map timeout without retrying a painted map, delay NPC decode, and delay HUD packs',
);

assert(
    /idleEntitySheetIndices/.test(gameWorld) &&
        /evictMonsterSpriteSheets/.test(gameWorld) &&
        /evictNpcSpriteSheets/.test(gameWorld) &&
        /loadingMap \|\| !this\.worldReadyForEntities/.test(gameWorld),
    'GameWorld must not spawn/decode monsters or NPCs during map setup, and must evict sheets that leave view',
);

assert(
    !/from ['"]\.\.\/ui\/SelectCharDesk['"]/.test(loginScreen) &&
        !/from ['"]\.\.\/ui\/CreateCharDesk['"]/.test(loginScreen) &&
        !/from ['"]\.\.\/ui\/ArenaSelectCharDesk['"]/.test(loginScreen) &&
        !/loadSelectAppearanceSprites/.test(loginScreen) &&
        !/loadWorldEnterAppearanceSprites/.test(loginScreen) &&
        !/ensureDesks/.test(loginScreen),
    'LoginScreen must not construct Phaser SELECTCHAR desks or load paper-dolls (KindGem Error 9 before Occupied)',
);

assert(
    !/from ['"]\.\/ui\/components\/HotkeyBar['"]/.test(appHub) &&
        !/from ['"]\.\/ui\/dialogs\/ControlsDialog['"]/.test(appHub) &&
        /import\('\.\/ui\/components\/HotkeyBar'\)/.test(appHub) &&
        /import\('\.\/ui\/dialogs\/ControlsDialog'\)/.test(appHub) &&
        !/from ['"]\.\.\/components\/SelectCharReactDesk['"]/.test(connectDialog) &&
        /import\('\.\.\/components\/SelectCharReactDesk'\)/.test(connectDialog),
    'Hub entry must not static-import HotkeyBar/ControlsDialog/Explorer (Phaser canvas + Occupied must stay off connect UI)',
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
