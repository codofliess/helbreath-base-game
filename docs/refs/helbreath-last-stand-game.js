const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d', { alpha: false });
const $ = (q) => document.querySelector(q);
const ui = {
  start: $('#start-screen'), startButton: $('#start'), startLabel: $('#start-label'), hud: $('#hud'),
  wave: $('#wave-value'), waveName: $('#wave-name'), timer: $('#timer'), remaining:$('#remaining'), kills: $('#kills'),
  gold: $('#gold'), shopGold: $('#shop-gold'), hpBar: $('#hp-bar'), hpText: $('#hp-text'),xpBar: $('#xp-bar'), level: $('#level'),dr:$('#dr-value'),potionButton:$('#potion-button'),potionIcon:$('#potion-icon'),potionCount:$('#potion-count'),criticalCount:$('#critical-count'),criticalButton:$('#critical-button'),autoAttackButton:$('#auto-attack-button'),autoAttackStatus:$('#auto-attack-status'),merienButton:$('#merien-button'),merienStatus:$('#merien-status'),
  upgrade: $('#upgrade-screen'), options: $('#upgrade-options'),confirmUpgrade:$('#confirm-upgrade'),pause: $('#pause-screen'), shop: $('#shop-screen'), shopItems:$('#shop-items'),inventory:$('#inventory-screen'),bag:$('#bag-grid'),gameover: $('#gameover-screen'),
  banner: $('#wave-banner'), error: $('#loading-error')
};

const VIEW = { w: 1280, h: 720 };
const WORLD = { w: 960, h: 960, tiles:30, tileSize:32 };
const HERO_RUN_FRAME_MS = 42;
const HERO_RUN_SPEED = WORLD.tileSize/(8*HERO_RUN_FRAME_MS/1000);
const HERO_RUN_FPS = 1000/HERO_RUN_FRAME_MS;
const WAVE_SECONDS = 60;
const GOLD_MULTIPLIER = 1.5;
const MOB_DAMAGE_MULTIPLIER = .55;
const KNIGHT_ARMOR_FILTER = 'sepia(.45) saturate(.75) brightness(.9)';
const MOB_ATTACK_INTERVAL = .65/.7;
const PREFERENCE_KEYS = { criticalAuto:'helbreath-waves-critical-auto', autoAttack:'helbreath-waves-auto-attack' };
const MOVE_DIRECTIONS = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
const packs = {};
const arenaImage = new Image();
let collisionRows = [];
const music = new Audio('assets/audio/middleland.wav?v=20260720-1');
music.loop = true;
music.volume = .26;
const sounds = Object.fromEntries(Object.entries({
  'hand-swing':'hand-swing.wav','weapon-swing':'weapon-swing.wav','weapon-hit':'weapon-hit.wav','male-critical':'male-critical.wav','character-impact':'character-impact.wav','character-hurt':'character-hurt.wav',
  slime:'slime-attack.wav','slime-hurt':'slime-hurt.wav',ant:'ant-attack.wav','ant-hurt':'ant-hurt.wav',orc:'orc-attack.wav','orc-hurt':'orc-hurt.wav',
  scorpion:'scorpion-attack.wav','scorpion-hurt':'scorpion-hurt.wav',zombie:'zombie-attack.wav','zombie-hurt':'zombie-hurt.wav',skeleton:'skeleton-attack.wav','skeleton-hurt':'skeleton-hurt.wav',
  'stone-golem':'stone-golem-attack.wav','stone-golem-hurt':'stone-golem-hurt.wav',werewolf:'werewolf-attack.wav','werewolf-hurt':'werewolf-hurt.wav',demon:'demon-attack.wav','demon-hurt':'demon-hurt.wav',
  gargoyle:'gargoyle-attack.wav','gargoyle-hurt':'gargoyle-hurt.wav',hellclaw:'hellclaw-attack.wav','hellclaw-hurt':'hellclaw-hurt.wav',tigerworm:'tigerworm-attack.wav','tigerworm-hurt':'tigerworm-hurt.wav',
  wyvern:'hellclaw-attack.wav','wyvern-hurt':'hellclaw-hurt.wav',abaddon:'demon-attack.wav','abaddon-hurt':'demon-hurt.wav'
}).map(([name,file])=>[name,new Audio(`assets/audio/${file}?v=20260720-1`)]));
const audioEvents = [];
const keys = new Set();
let moveTarget = null;
let combatTarget = null;
let state = 'loading';
let lastTime = 0;
let runTime = 0;
let waveTime = WAVE_SECONDS;
let currentWave = 1;
let waveSpawned = 0;
let kills = 0;
let spawnClock = 0;
let attackClock = 0;
let attackHeld = false;
let attackQueued = false;
let autoAttackEnabled = false;
let autoAttackEngaged = false;
let stationaryAttack = false;
let rightFacing = false;
let criticalHeld = false;
let criticalAuto = false;
const criticalKeys = new Set();
const pointer = { x:0, y:0, inside:false };
let nextId = 1;
let pendingLevels = 0;
let selectedUpgrades = [];
let enemies = [], corpses = [], projectiles = [], effects = [], particles = [];
let backgroundLoadPromise=Promise.resolve();
const shopOwned = new Set();
const itemUpgradeLevels = new Map();

function readPreference(key,fallback){try{const value=localStorage.getItem(key);return value===null?fallback:value==='true';}catch{return fallback;}}
function savePreference(key,value){try{localStorage.setItem(key,String(Boolean(value)));}catch{}}

const waveTypes = [
  { key:'slime', name:'SLIMES', sub:'The first stirrings', pack:'SLM', attackSound:'slime', hurtSound:'slime-hurt', hp:22, hitRatio:50, speed:48, damage:7, radius:19, xp:6, gold:3, color:'#88b85e' },
  { key:'ant', name:'GIANT ANTS', sub:'The earth begins to crawl', pack:'Ant', attackSound:'ant', hurtSound:'ant-hurt', hp:34, hitRatio:65, speed:67, damage:8, radius:19, xp:9, gold:4, color:'#b58143' },
  { key:'orc', name:'ORCS', sub:'War drums in the distance', pack:'Orc', attackSound:'orc', hurtSound:'orc-hurt', hp:66, hitRatio:70, speed:54, damage:11, radius:23, xp:13, gold:6, color:'#71945d' },
  { key:'scorpion', name:'SCORPIONS', sub:'Venom on the wind', pack:'Scp', attackSound:'scorpion', hurtSound:'scorpion-hurt', hp:82, hitRatio:80, speed:74, damage:12, radius:24, xp:16, gold:8, color:'#b18349' },
  { key:'zombie', name:'ZOMBIES', sub:'The dead refuse their rest', pack:'Zom', attackSound:'zombie', hurtSound:'zombie-hurt', hp:120, hitRatio:90, speed:43, damage:15, radius:23, xp:20, gold:11, color:'#7b8b68' },
  { key:'skeleton', name:'SKELETONS', sub:'Only bones remain', pack:'SKE', attackSound:'skeleton', hurtSound:'skeleton-hurt', hp:105, hitRatio:100, speed:62, damage:17, radius:22, xp:24, gold:14, color:'#b9b59f' },
  { key:'stone-golem', name:'STONE GOLEMS', sub:'The earth itself rises', pack:'GOL', attackSound:'stone-golem', hurtSound:'stone-golem-hurt', hp:150, hitRatio:150, speed:40, damage:20, radius:25, xp:32, gold:18, color:'#918773' },
  { key:'werewolf', name:'WEREWOLVES', sub:'Howls cross the battlefield', pack:'WereWolf', attackSound:'werewolf', hurtSound:'werewolf-hurt', hp:185, hitRatio:300, speed:64, damage:26, radius:23, xp:40, gold:24, color:'#8a755f' },
  { key:'demon', name:'DEMONS', sub:'The abyss opens', pack:'Demon', attackSound:'demon', hurtSound:'demon-hurt', hp:245, hitRatio:500, speed:42, damage:34, radius:28, xp:52, gold:32, color:'#98534a' },
  { key:'gargoyle', name:'GARGOYLES', sub:'Stone wings descend', pack:'Gagoyle', attackSound:'gargoyle', hurtSound:'gargoyle-hurt', hp:310, hitRatio:500, speed:48, damage:44, radius:27, xp:68, gold:42, color:'#777d78' },
  { key:'hellclaw', name:'HELLCLAWS', sub:'Claws from below', pack:'Hellclaw', attackSound:'hellclaw', hurtSound:'hellclaw-hurt', hp:430, hitRatio:1000, speed:52, damage:56, radius:30, xp:90, gold:55, color:'#804f45' },
  { key:'tigerworm', name:'TIGERWORMS', sub:'The ground devours the living', pack:'Tigerworm', attackSound:'tigerworm', hurtSound:'tigerworm-hurt', hp:600, hitRatio:1200, speed:42, damage:70, radius:32, xp:120, gold:72, color:'#9a7447' },
  { key:'wyvern', name:'WYVERN', sub:'A single ancient terror descends', pack:'Wyvern', moveBase:0, deathBase:16, attackSound:'wyvern', hurtSound:'wyvern-hurt', hp:1100, hitRatio:1300, speed:45, damage:153, radius:46, xp:260, gold:150, color:'#78906d' },
  { key:'abaddon', name:'ABADDON', sub:'Absolute evil enters the field', pack:'Abaddon', moveBase:0, deathBase:16, attackSound:'abaddon', hurtSound:'abaddon-hurt', hp:2200, hitRatio:1600, speed:39, damage:246, radius:52, xp:520, gold:300, color:'#724246' }
];

const endlessHorde={name:'ELITE HORDE',sub:'The strongest beasts return in force'};

function playMusic(){music.play().catch(()=>{});}
function playSound(name,source=hero){const original=sounds[name];if(!original)return;const sample=original.cloneNode();const falloff=source?Math.min(.72,distance(hero,source)/900):0;sample.volume=(name==='weapon-hit'?.5:.62)*(1-falloff);sample.play().catch(()=>{});audioEvents.push(name);if(audioEvents.length>60)audioEvents.shift();}

const hero = {
  x:WORLD.w/2, y:WORLD.h/2, radius:17, dir:0, moving:false,navDir:null,navRemaining:0,turn:0, hp:100, maxHp:100, speed:HERO_RUN_SPEED,
  level:1, xp:0, xpNext:28, damage:14, bonusDamage:0, attackRate:.56, reach:62, attackAnim:0, attackDuration:.42,
  gold:0,goldBonus:0,potions:2,weapon:null,shield:null,armorSet:null,physicalAbsorption:0,recoveryBonus:0,recoveryClock:5,hpSiphon:0,siphonCarry:0,defenseRatio:20,maxTargets:1,criticalCharges:1,criticalClock:5,criticalArmed:false,merienCooldown:0,merienActive:0,invuln:0
};

// Item record IDs and one-based inventory sprite references from the source game data.
const shopItems = [
  { id:'dagger',itemId:1,name:'Dagger',description:'Fast short-sword-class starter.',cost:30,damage:10,dice:'1d2',strength:3,rate:.72,reach:72,attackRange:1,swingSound:'weapon-swing',pack:'Msw',offset:0,iconSprite:1,iconFrame:0 },
  { id:'great-sword',itemId:50,name:'Great Sword',description:'Long reach and heavy damage.',cost:110,damage:30,dice:'2d10',strength:50,rate:.72,reach:102,attackRange:3,twoHanded:true,swingSound:'weapon-swing',pack:'Msw',offset:336,iconSprite:1,iconFrame:10 },
  { id:'war-hammer',itemId:760,name:'War Hammer',description:'A crushing one-handed hammer.',cost:190,damage:40,dice:'5d13',strength:45,rate:.72,reach:94,attackRange:2,swingSound:'weapon-swing',pack:'MHammer',offset:0,iconSprite:15,iconFrame:7 },
  { id:'merien-shield',itemId:620,name:"Merien's Shield",description:'Grants Defense Ratio and the invincibility ability.',cost:260,damage:0,defense:30,dice:'—',strength:100,rate:0,reach:0,kind:'shield',iconSprite:3,iconFrame:9,tintFilter:'grayscale(1) sepia(1) saturate(6) hue-rotate(65deg) brightness(.9)' },
  { id:'flameberg',itemId:54,name:'Flameberg',description:'A long two-handed flame blade.',cost:280,damage:50,dice:'2d13',strength:65,rate:.72,reach:108,attackRange:3,twoHanded:true,swingSound:'weapon-swing',pack:'Msw',offset:616,iconSprite:1,iconFrame:11 },
  { id:'battle-axe',itemId:560,name:'Battle Axe',description:'A heavy two-handed battle axe.',cost:400,damage:60,dice:'3d10',strength:75,rate:.72,reach:94,attackRange:2,twoHanded:true,swingSound:'weapon-swing',pack:'MAxe6',offset:0,iconSprite:15,iconFrame:6 },
  { id:'battle-hammer',itemId:761,name:'Battle Hammer',description:'A forged two-handed war hammer.',cost:580,damage:70,dice:'3d10+2',strength:60,rate:.72,reach:94,attackRange:2,twoHanded:true,swingSound:'weapon-swing',pack:'MBHammer',offset:0,iconSprite:15,iconFrame:8 },
  { id:'barbarian-hammer',itemId:843,name:'Barbarian Hammer',description:'A brutal two-handed barbarian weapon.',cost:850,damage:80,dice:'3d11+2',strength:80,rate:.68,reach:98,attackRange:2,twoHanded:true,swingSound:'weapon-swing',pack:'MBabHammer',offset:0,iconSprite:15,iconFrame:10 },
  { id:'giant-battle-hammer',itemId:762,name:'Giant Battle Hammer',description:'A massive red two-handed hammer.',cost:1250,damage:100,dice:'3d11+5',strength:120,rate:.68,reach:102,attackRange:2,twoHanded:true,swingSound:'weapon-swing',pack:'MBHammer',offset:0,iconSprite:15,iconFrame:8,tintFilter:'grayscale(1) sepia(1) saturate(7) hue-rotate(320deg) brightness(.88)' },
  { id:'bane',itemId:1242,name:'Bane',description:'Hits twice with every swing.',cost:1800,damage:120,damageLabel:'60 + 60',dice:'5d17',strength:140,rate:.624,reach:100,attackRange:2,twoHanded:true,swingSound:'weapon-swing',pack:'MKlonessHammer',offset:0,iconSprite:15,iconFrame:16,endgame:true },
  { id:'devastator',itemId:846,name:'The Devastator',description:"More damage as the enemy weakens.",cost:3000,damage:150,dice:'2d17',strength:140,rate:.624,reach:112,attackRange:3,twoHanded:true,swingSound:'weapon-swing',pack:'MDebastator',offset:0,iconSprite:1,iconFrame:21,endgame:true },
  { id:'hero-set',name:'Hero Set',description:'Complete warrior set. Adds damage, Defense Ratio, and fiery criticals.',cost:2000,damage:100,defense:100,kind:'armor-set',iconSprite:9,iconFrame:8 }
];

const upgrades = [
  { icon:'◒', name:'Sweeping Blow', desc:'Hit one additional creature per swing, up to four.', stat:'+1 ATTACK AREA TARGET', current:()=>`${hero.maxTargets} / 4 TARGETS`, available:()=>hero.maxTargets<4,apply:()=>hero.maxTargets=Math.min(4,hero.maxTargets+1) },
  { icon:'◆', name:'Vitality', desc:'Increase maximum health and mend your wounds.', stat:'+50 MAX HP', current:()=>`${hero.maxHp} MAX HP`, apply:()=>{hero.maxHp+=50;hero.hp=Math.min(hero.maxHp,hero.hp+50)} },
  { icon:'⚔', name:'Tempered Steel', desc:'Add a little more force to every weapon strike.', stat:'+2 DAMAGE', current:()=>`+${hero.bonusDamage} BONUS DAMAGE`, apply:()=>{hero.bonusDamage+=2;hero.damage+=2} },
  { icon:'♜', name:'Physical Absorption', desc:'Absorb a percentage of every physical hit.', stat:'+1% PA', current:()=>`${hero.physicalAbsorption}% / 80% PA`, available:()=>hero.physicalAbsorption<80, apply:()=>hero.physicalAbsorption=Math.min(80,hero.physicalAbsorption+1) },
  { icon:'☥', name:'Renewal', desc:'Add ten health to every five-second recovery pulse.', stat:'+10 HP / 5 SEC', current:()=>`${recoveryAmount()} HP / 5 SEC`, apply:()=>hero.recoveryBonus+=10 },
  { icon:'●', name:'Gold Find', desc:'Increase all gold earned from defeated creatures.', stat:'+10% GOLD', current:()=>`+${Math.round(hero.goldBonus*100)}% GOLD`, apply:()=>hero.goldBonus+=.1 },
  { icon:'♥', name:'Life Siphon', desc:'Recover health from damage dealt, up to ten percent.', stat:'+1% HP SIPHON', current:()=>`${Math.round(hero.hpSiphon*100)}% / 10% SIPHON`, available:()=>hero.hpSiphon<.1-.0001,apply:()=>hero.hpSiphon=Math.min(.1,hero.hpSiphon+.01) },
  { icon:'♢', name:'Evasion Training', desc:'Raise Defense Ratio, reducing enemy hit chance.', stat:'+10 DEFENSE RATIO', current:()=>`${hero.defenseRatio} BASE DR`, apply:()=>hero.defenseRatio+=10 },
  { icon:'✥', name:'Battle Rhythm', desc:'Recover faster after every swing.', stat:'+12% ATTACK SPEED', current:()=>`${hero.attackRate.toFixed(2)} SEC / ATTACK`, apply:()=>hero.attackRate=Math.max(.35,hero.attackRate*.88) }
];

class OpkPack {
  constructor(buffer, label) {
    this.label = label;
    this.bytes = new Uint8Array(buffer);
    this.view = new DataView(buffer);
    this.version = this.view.getUint32(4, true);
    this.count = this.view.getUint32(8, true);
    this.sprites = [];
    this.cache = new Map();
    if (this.version !== 1) throw new Error(`${label}: browser MVP expects OPK v1`);
    let cursor = 12;
    for (let i=0; i<this.count; i++) {
      const dataOffset = u24(this.view, cursor+1);
      const dataSize = u24(this.view, cursor+5);
      const frameCount = u24(this.view, cursor+9);
      const frames = [];
      for (let f=0; f<frameCount; f++) {
        const o = cursor+13+f*12;
        frames.push({ sx:this.view.getInt16(o,true), sy:this.view.getInt16(o+2,true), sw:this.view.getInt16(o+4,true), sh:this.view.getInt16(o+6,true), px:this.view.getInt16(o+8,true), py:this.view.getInt16(o+10,true) });
      }
      this.sprites.push({ dataOffset, dataSize, frames });
      cursor += 13 + frameCount*12;
    }
  }
  async image(index) {
    index = Math.max(0, Math.min(this.count-1, index));
    if (!this.cache.has(index)) {
      const s = this.sprites[index];
      const bmp = this.bytes.slice(s.dataOffset, s.dataOffset+s.dataSize);
      this.cache.set(index, createImageBitmap(new Blob([bmp], {type:'image/bmp'})).then(removeGreenScreen));
    }
    return this.cache.get(index);
  }
}

class WebSpritePack {
  constructor(manifest,baseUrl,label){this.label=label;this.count=manifest.count;this.sprites=manifest.sprites;this.baseUrl=baseUrl;this.cache=new Map();}
  async image(index){index=Math.max(0,Math.min(this.count-1,index));if(!this.cache.has(index)){const sprite=this.sprites[index],url=new URL(sprite.file,this.baseUrl);this.cache.set(index,fetch(url).then(response=>{if(!response.ok)throw new Error(`Could not load ${url}`);return response.blob();}).then(createImageBitmap).then(removeGreenScreen));}return this.cache.get(index);}
}

async function removeGreenScreen(bitmap) {
  const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = surface.getContext('2d', {willReadFrequently:true});
  context.drawImage(bitmap,0,0);
  const image = context.getImageData(0,0,bitmap.width,bitmap.height);
  const data=image.data;
  const keyR=data[0],keyG=data[1],keyB=data[2];
  for(let i=0;i<data.length;i+=4) {
    // Like the original client and map explorer, use the bitmap's top-left pixel as the DirectDraw color key.
    if(data[i]===keyR&&data[i+1]===keyG&&data[i+2]===keyB)data[i+3]=0;
  }
  bitmap.close();
  context.putImageData(image,0,0);
  return createImageBitmap(surface);
}

function u24(view, at) { return view.getUint8(at) | view.getUint8(at+1)<<8 | view.getUint8(at+2)<<16; }

async function loadPacks() {
  const files = {
    SLM:'assets/npcs/SLM.opk', Ant:'assets/npcs/Ant.opk', Orc:'assets/npcs/Orc.opk', Scp:'assets/npcs/Scp.opk', Zom:'assets/npcs/Zom.opk', SKE:'assets/npcs/SKE.opk',
    GOL:'assets/npcs/GOL.opk',WereWolf:'assets/npcs/WereWolf.opk',Demon:'assets/npcs/Demon.opk',Gagoyle:'assets/npcs/gagoyle.opk',Hellclaw:'assets/npcs/Hellclaw.opk',Tigerworm:'assets/npcs/Tigerworm.opk',Wyvern:'assets/npcs/Wyvern.opk',Abaddon:'assets/npcs/abaddon-web/manifest.json',
    Wm:'assets/player/Wm.opk',MShoes:'assets/player/MShoes.opk',MHauberk:'assets/player/MHauberk.opk',MLeggings:'assets/player/MLeggings.opk',MPMail:'assets/player/MPMail.opk',NMHelm2:'assets/player/NMHelm2.opk',MHHauberk1:'assets/player/MHHauberk1.opk',MHLeggings1:'assets/player/MHLeggings1.opk',MHPMail1:'assets/player/MHPMail1.opk',MHHelm1:'assets/player/MHHelm1.opk',
    Msw:'assets/player/Msw.opk',Mflamberg:'assets/player/Mflamberg.opk',MDebastator:'assets/player/MDebastator.opk',Munderhammer:'assets/player/Munderhammer.opk',MKlonessHammer:'assets/player/MKlonessHammer.opk',MAxe3:'assets/player/MAxe3.opk',MAxe6:'assets/player/MAxe6.opk',MHammer:'assets/player/MHammer.opk',MBHammer:'assets/player/MBHammer.opk',MBabHammer:'assets/player/MBabHammer.opk',Msh:'assets/player/Msh.opk',
    GameDialog:'assets/GameDialog.opk',ItemPack:'assets/lgn_itempack.opk',Cursor:'assets/interface.opk',Effect5:'assets/effects/effect5.opk',HeroEffect:'assets/effects/effect10.opk'
  };
  let done = 0;
  const mobPacks=new Set(waveTypes.map(type=>type.pack));
  const loadPack=async(name,url,reportProgress=true)=>{const response=await fetch(url);if(!response.ok)throw new Error(`Could not load ${url}`);packs[name]=url.endsWith('.json')?new WebSpritePack(await response.json(),response.url,name):new OpkPack(await response.arrayBuffer(),name);if(reportProgress&&state==='loading')ui.startLabel.textContent=`UNSEALING SPRITES… ${++done} / ${foreground.length}`;return packs[name];};
  const arenaReady = new Promise((resolve,reject)=>{arenaImage.onload=resolve;arenaImage.onerror=()=>reject(new Error('Could not load the Middleland arena'));arenaImage.src='assets/middleland-arena.png?v=20260721-5';});
  const collisionReady = fetch('assets/middleland-collision.json?v=20260721-4').then(response=>{if(!response.ok)throw new Error('Could not load Middleland collision data');return response.json();}).then(data=>{collisionRows=data.blocked;if(data.size!==WORLD.tiles||data.tileSize!==WORLD.tileSize)throw new Error('Middleland collision data does not match the arena');});
  const entries=Object.entries(files),foreground=entries.filter(([name])=>name==='SLM'||!mobPacks.has(name)),background=entries.filter(([name])=>mobPacks.has(name)&&name!=='SLM');
  await Promise.all(foreground.map(([name,url])=>loadPack(name,url)));
  // Only Slimes and visible interface/player art block startup. Every later creature prepares in the background.
  await Promise.all([arenaReady,collisionReady,packs.Wm.image(0),packs.MShoes.image(0),packs.MHauberk.image(0),packs.MLeggings.image(0),packs.MPMail.image(0),packs.NMHelm2.image(0),packs.MHHauberk1.image(0),packs.MHLeggings1.image(0),packs.MHPMail1.image(0),packs.MHHelm1.image(0),packs.SLM.image(8),packs.GameDialog.image(7),packs.ItemPack.image(2),packs.Cursor.image(0),packs.Effect5.image(4),packs.HeroEffect.image(1),...shopItems.filter(item=>item.pack).map(item=>packs[item.pack].image(item.offset))]);
  buildShop();
  buildInventory();
  await renderPotionIcon();
  state = 'ready';
  ui.startButton.disabled = false;
  ui.startLabel.textContent = 'ENTER THE MIDDLELANDS';
  backgroundLoadPromise=Promise.all(background.map(async([name,url])=>{const pack=await loadPack(name,url,false),type=waveTypes.find(entry=>entry.pack===name);await pack.image(type?.moveBase??8);})).catch(error=>{console.error(error);throw error;});
}

function resetGame() {
  const starter=shopItems.find(item=>item.id==='dagger');
  const starterShield=shopItems.find(item=>item.id==='merien-shield');
  Object.assign(hero,{x:WORLD.w/2,y:WORLD.h/2,dir:0,moving:false,navDir:null,navRemaining:0,turn:0,hp:100,maxHp:100,speed:HERO_RUN_SPEED,level:1,xp:0,xpNext:28,damage:starter.damage,bonusDamage:0,attackRate:starter.rate,reach:starter.reach,attackAnim:0,attackDuration:starter.rate,gold:0,goldBonus:0,potions:2,weapon:starter,shield:starterShield,armorSet:null,physicalAbsorption:0,recoveryBonus:0,recoveryClock:5,hpSiphon:0,siphonCarry:0,defenseRatio:20,maxTargets:1,criticalCharges:1,criticalClock:5,criticalArmed:false,merienCooldown:0,merienActive:0,invuln:0});moveTarget=null;combatTarget=null;attackHeld=false;attackQueued=false;autoAttackEnabled=readPreference(PREFERENCE_KEYS.autoAttack,sceneZoom()>1);autoAttackEngaged=false;stationaryAttack=false;rightFacing=false;criticalHeld=false;criticalAuto=readPreference(PREFERENCE_KEYS.criticalAuto,sceneZoom()>1);criticalKeys.clear();
  enemies=[];corpses=[];projectiles=[];effects=[];particles=[];shopOwned.clear();itemUpgradeLevels.clear();shopOwned.add(starter.id);shopOwned.add(starterShield.id);currentWave=1; waveSpawned=0; waveTime=WAVE_SECONDS; runTime=0; kills=0; spawnClock=.35; attackClock=.15; pendingLevels=0;
  ui.start.classList.add('hidden'); ui.gameover.classList.add('hidden'); ui.pause.classList.add('hidden'); ui.shop.classList.add('hidden');ui.inventory.classList.add('hidden');ui.upgrade.classList.add('hidden'); ui.hud.classList.remove('hidden');
  state='playing';canvas.classList.add('custom-cursor');audioEvents.length=0;playMusic();showWaveBanner(); updateHud();
}

function update(dt) {
  if (state !== 'playing'||isPortraitBlocked()) return;
  runTime += dt; waveTime -= dt;hero.merienCooldown=Math.max(0,hero.merienCooldown-dt);hero.merienActive=Math.max(0,hero.merienActive-dt);hero.invuln=Math.max(0,hero.invuln-dt);hero.attackAnim=Math.max(0,hero.attackAnim-dt);updateRecovery(dt);updateCriticalRecharge(dt);
  if (waveTime <= 0 || (waveSpawned>=waveQuota()&&enemies.length===0)) advanceWave();
  moveHero(dt); spawnClock-=dt;
  const intensity = 1+(currentWave-1)*.13;
  if (spawnClock<=0 && waveSpawned<waveQuota() && enemies.length<10) { spawnEnemy(); spawnClock=Math.max(.38, .95/intensity); }
  attackClock=Math.max(0,attackClock-dt);if(combatTarget&&!enemies.includes(combatTarget)){combatTarget=null;attackQueued=false;autoAttackEngaged=false;}if(attackClock<=0&&combatTarget&&(attackQueued||attackHeld||autoAttackEngaged)&&targetInAttackRange(combatTarget)){attackTarget();attackQueued=false;attackClock=hero.attackRate;}
  updateEnemies(dt);updateCorpses(dt);updateProjectiles(dt);updateEffects(dt);
  updateHud();
  if (hero.hp<=0) endGame();
}

function resetHeroNavigation(){hero.navDir=null;hero.navRemaining=0;}
function chooseHeroDirection(desired,probe){for(const dir of hbDirectionOrder(desired,hero.turn)){const vector=MOVE_DIRECTIONS[dir],x=hero.x+vector[0]*probe,y=hero.y+vector[1]*probe;if(isWalkable(x,y,hero.radius)&&isEntityPositionFree(hero,x,y,hero.radius))return dir;}return null;}
function moveHero(dt) {
  if(stationaryAttack&&combatTarget){const dx=combatTarget.x-hero.x,dy=combatTarget.y-hero.y,d=Math.hypot(dx,dy)||1;hero.moving=false;resetHeroNavigation();hero.dir=directionIndex(dx/d,dy/d);return;}
  const destination=combatTarget||moveTarget;if(!destination){hero.moving=false;return;}
  if(combatTarget&&targetInAttackRange(combatTarget)){const dx=combatTarget.x-hero.x,dy=combatTarget.y-hero.y,d=Math.hypot(dx,dy)||1;hero.moving=false;resetHeroNavigation();hero.dir=directionIndex(dx/d,dy/d);return;}
  const dx=destination.x-hero.x,dy=destination.y-hero.y,d=Math.hypot(dx,dy),stop=5;
  if(d<=stop){if(!combatTarget)moveTarget=null;hero.moving=false;resetHeroNavigation();if(combatTarget)hero.dir=directionIndex(dx/d,dy/d);return;}
  if(!combatTarget&&!isWalkable(destination.x,destination.y,hero.radius)&&tileDistance(hero,destination)<=2){moveTarget=null;hero.moving=false;resetHeroNavigation();return;}
  const desired=directionIndex(dx,dy);if(hero.navDir==null||hero.navRemaining<=.01){const dir=chooseHeroDirection(desired,WORLD.tileSize);if(dir==null){hero.turn=hero.turn?0:1;hero.moving=false;resetHeroNavigation();return;}hero.navDir=dir;hero.navRemaining=WORLD.tileSize;hero.dir=dir;}
  const vector=MOVE_DIRECTIONS[hero.navDir],step=Math.min(hero.speed*dt,hero.navRemaining),nextX=hero.x+vector[0]*step,nextY=hero.y+vector[1]*step;
  if(!isWalkable(nextX,nextY,hero.radius)||!isEntityPositionFree(hero,nextX,nextY,hero.radius)){hero.turn=hero.turn?0:1;hero.moving=false;resetHeroNavigation();return;}
  hero.x=nextX;hero.y=nextY;hero.navRemaining-=step;hero.moving=step>0;
}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function entityCellAt(x,y){return{x:Math.floor(x/WORLD.tileSize),y:Math.floor(y/WORLD.tileSize)};}
function entityCell(entity){return entityCellAt(entity.x,entity.y);}
function sameEntityCellAt(x,y,other){const cell=entityCellAt(x,y),otherCell=entityCell(other);return cell.x===otherCell.x&&cell.y===otherCell.y;}
function tileDistance(a,b){const ac=entityCell(a),bc=entityCell(b);return Math.max(Math.abs(ac.x-bc.x),Math.abs(ac.y-bc.y));}
function criticalCost(){return 1;}
function weaponAttackRange(){return hero.weapon?.attackRange||1;}
function criticalRequested(){return criticalHeld||criticalAuto;}
function criticalAvailable(){return criticalRequested()&&hero.criticalCharges>=criticalCost();}
function targetInAttackRange(target){return tileDistance(hero,target)<=(criticalAvailable()?weaponAttackRange():1);}
function isWalkable(x,y,radius=0){if(!collisionRows.length)return true;const minX=Math.floor((x-radius)/WORLD.tileSize),maxX=Math.floor((x+radius)/WORLD.tileSize),minY=Math.floor((y-radius)/WORLD.tileSize),maxY=Math.floor((y+radius)/WORLD.tileSize);if(minX<0||minY<0||maxX>=WORLD.tiles||maxY>=WORLD.tiles)return false;for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++)if(collisionRows[ty]?.[tx]==='1')return false;return true;}
function isEntityPositionFree(entity,x,y,radius){if(entity!==hero&&sameEntityCellAt(x,y,hero))return false;for(const other of enemies){if(other===entity)continue;if(sameEntityCellAt(x,y,other))return false;}return true;}
function moveEntity(entity,dx,dy,radius,checkEntities=false){const valid=(x,y)=>isWalkable(x,y,radius)&&(!checkEntities||isEntityPositionFree(entity,x,y,radius));const nextX=entity.x+dx,nextY=entity.y+dy;if(valid(nextX,nextY)){entity.x=nextX;entity.y=nextY;return true;}let moved=false;if(valid(nextX,entity.y)){entity.x=nextX;moved=true;}if(valid(entity.x,nextY)){entity.y=nextY;moved=true;}return moved;}
function hbDirectionOrder(desired,turn){return Array.from({length:8},(_,offset)=>(desired+(turn?-offset:offset)+8)%8);}
function chooseMobDirection(enemy,desired,probe){for(const dir of hbDirectionOrder(desired,enemy.turn)){enemy.compassChecks++;const vector=MOVE_DIRECTIONS[dir],probeX=enemy.x+vector[0]*probe,probeY=enemy.y+vector[1]*probe;if(isWalkable(probeX,probeY)&&isEntityPositionFree(enemy,probeX,probeY,enemy.radius))return dir;}return null;}
function setMobDirection(enemy,dir,desired){enemy.navDir=dir;enemy.navRemaining=WORLD.tileSize;enemy.navDecisions++;if(dir!==desired)enemy.detours++;if(dir!==enemy.dir)enemy.directionChanges++;enemy.dir=dir;}
function failMobMove(enemy){enemy.navDir=null;enemy.navRemaining=0;enemy.escapeStep=false;enemy.failedMoveTurns=Math.min(2,enemy.failedMoveTurns+1);enemy.maxFailedMoveTurns=Math.max(enemy.maxFailedMoveTurns,enemy.failedMoveTurns);enemy.turn=enemy.turn?0:1;}
function moveMobToward(enemy,dx,dy,distanceToTarget,dt){const step=Math.min(enemy.speed*dt,distanceToTarget);if(step<=0)return false;const desired=directionIndex(dx/distanceToTarget,dy/distanceToTarget);if(enemy.navDir==null||enemy.navRemaining<=.01){let dir=chooseMobDirection(enemy,desired,WORLD.tileSize),escaping=false;if(dir==null){failMobMove(enemy);if(enemy.failedMoveTurns<2)return false;dir=chooseMobDirection(enemy,desired,.25);if(dir==null)return false;escaping=true;}setMobDirection(enemy,dir,desired);enemy.escapeStep=escaping;}const vector=MOVE_DIRECTIONS[enemy.navDir],actualStep=Math.min(step,enemy.navRemaining,enemy.escapeStep?.25:Infinity),nextX=enemy.x+vector[0]*actualStep,nextY=enemy.y+vector[1]*actualStep;if(!isWalkable(nextX,nextY)||!isEntityPositionFree(enemy,nextX,nextY,enemy.radius)){failMobMove(enemy);return false;}enemy.x=nextX;enemy.y=nextY;enemy.navRemaining-=actualStep;enemy.escapeStep=false;enemy.failedMoveTurns=0;return true;}
function recoveryAmount(){return Math.round(10+hero.recoveryBonus);}
function healHero(amount){hero.hp=Math.min(hero.maxHp,Math.max(0,Math.round(hero.hp)));const healed=Math.min(Math.round(amount),hero.maxHp-hero.hp);hero.hp+=healed;return healed;}
function applySiphon(damage){if(hero.hpSiphon<=0||damage<=0)return 0;if(hero.hp>=hero.maxHp){hero.siphonCarry=0;return 0;}hero.siphonCarry+=damage*hero.hpSiphon;const points=Math.floor(hero.siphonCarry+1e-9);if(points<1)return 0;const healed=healHero(points);hero.siphonCarry=healed===points?hero.siphonCarry-points:0;if(healed>0)floating(hero.x,hero.y-48,`+${healed} HP`,'#d46d88');return healed;}
function updateRecovery(dt){hero.recoveryClock-=dt;while(hero.recoveryClock<=0){hero.recoveryClock+=5;const healed=healHero(recoveryAmount());if(healed>0)floating(hero.x,hero.y-36,`+${healed} HP`,'#72c982');}}
function updateCriticalRecharge(dt){const maximum=maxCriticalCharges();if(hero.criticalCharges>=maximum){hero.criticalCharges=maximum;hero.criticalClock=5;return;}hero.criticalClock-=dt;while(hero.criticalClock<=0&&hero.criticalCharges<maximum){hero.criticalCharges++;hero.criticalClock+=5;}if(hero.criticalCharges>=maximum)hero.criticalClock=5;}

function directionIndex(x,y) {
  const a=Math.atan2(y,x); return (Math.round((a+Math.PI/2)/(Math.PI/4))+8)%8;
}

function endlessPhase(wave=currentWave){return ((wave-15)%5+5)%5;}
function waveLeadType(){if(currentWave<=14)return waveTypes[currentWave-1];const phase=endlessPhase();return phase<3?endlessHorde:waveTypes[phase===3?12:13];}
function spawnType(){if(currentWave<=14){const leadIndex=currentWave-1;if(leadIndex===0)return waveTypes[leadIndex];if(currentWave===2)return waveSpawned===2?waveTypes[0]:waveTypes[1];if((waveSpawned+1)%3!==0)return waveTypes[leadIndex];const first=Math.max(0,leadIndex-4),previous=waveTypes.slice(first,leadIndex);return previous[(currentWave+waveSpawned)%previous.length];}const phase=endlessPhase();if(phase===3)return waveTypes[12];if(phase===4)return waveTypes[13];const eliteMix=[waveTypes[7],waveTypes[10],waveTypes[11],waveTypes[7],waveTypes[10],waveTypes[7]];return eliteMix[waveSpawned%eliteMix.length];}

function waveQuota(){if(currentWave===1)return 14;if(currentWave===2)return 12;if(currentWave<8)return Math.min(10,3+currentWave);if(currentWave===8)return 8;if(currentWave<=10)return 7;if(currentWave<=12)return 6;if(currentWave<=14)return 1;if(endlessPhase()>=3)return 1;return Math.min(10,6+Math.floor((currentWave-15)/15));}
function waveRemaining(){return enemies.length+Math.max(0,waveQuota()-waveSpawned);}
function advanceWave(){currentWave++;waveSpawned=0;waveTime=WAVE_SECONDS;spawnClock=.65;showWaveBanner();}
function mobDamage(type,wave=currentWave){return Math.round(type.damage*MOB_DAMAGE_MULTIPLIER*(1+(wave-1)*.065));}
function mobHitChance(wave=currentWave,defenseRatio=effectiveDefenseRatio(),type=waveTypes[Math.min(wave-1,waveTypes.length-1)]){const hitRatio=(type.hitRatio??1200)*(1+(wave-1)*.04);return Math.max(15,Math.min(99,Math.floor(hitRatio/Math.max(1,defenseRatio)*50)));}
function physicalDamageAfterAbsorption(damage,absorption=hero.physicalAbsorption){return Math.max(0,Math.round(damage*(1-Math.max(0,Math.min(80,absorption))/100)));}

function spawnEnemy() {
  const type=spawnType();
  const scale=1+(currentWave-1)*.16;
  const point=findSpawnPoint(type.radius);if(!point)return false;
  enemies.push({id:nextId++,type,x:point.x,y:point.y,hp:type.hp*scale,maxHp:type.hp*scale,speed:type.speed*(1+Math.min(.45,(currentWave-1)*.025)),damage:mobDamage(type),radius:type.radius,dir:0,turn:Math.random()<.5?0:1,navDir:null,navRemaining:0,navDecisions:0,directionChanges:0,detours:0,failedMoveTurns:0,maxFailedMoveTurns:0,compassChecks:0,flash:0,hitClock:0,age:Math.random()*2});
  waveSpawned++;
  return true;
}
function findSpawnPoint(radius){for(let attempt=0;attempt<100;attempt++){const angle=Math.random()*Math.PI*2,dist=320+Math.random()*300,x=Math.max(radius+2,Math.min(WORLD.w-radius-2,hero.x+Math.cos(angle)*dist)),y=Math.max(radius+2,Math.min(WORLD.h-radius-2,hero.y+Math.sin(angle)*dist));if(distance(hero,{x,y})>280&&isWalkable(x,y,radius)&&isEntityPositionFree(null,x,y,radius))return{x,y};}for(let attempt=0;attempt<300;attempt++){const tx=Math.floor(Math.random()*WORLD.tiles),ty=Math.floor(Math.random()*WORLD.tiles),x=(tx+.5)*WORLD.tileSize,y=(ty+.5)*WORLD.tileSize;if(distance(hero,{x,y})>220&&isWalkable(x,y,radius)&&isEntityPositionFree(null,x,y,radius))return{x,y};}return null;}

function updateEnemies(dt) {
  for (const e of enemies) {
    const dx=hero.x-e.x,dy=hero.y-e.y,d=Math.hypot(dx,dy)||1;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.hitClock=Math.max(0,e.hitClock-dt);
    const readyToAttack=tileDistance(e,hero)<=1;if(!readyToAttack)moveMobToward(e,dx,dy,d,dt);else e.failedMoveTurns=0;
    if(readyToAttack&&e.hitClock<=0){e.hitClock=MOB_ATTACK_INTERVAL;playSound(e.type.attackSound,e);if(hero.merienActive>0){floating(hero.x,hero.y-32,'BLOCK','#78c9df');continue;}if(hero.invuln>0)continue;if(Math.random()*100>mobHitChance(currentWave,effectiveDefenseRatio(),e.type)){floating(hero.x,hero.y-32,'MISS','#b8c4bd');continue;}const dealt=physicalDamageAfterAbsorption(e.damage);playSound('character-impact',hero);playSound('character-hurt',hero);hero.hp-=dealt;hero.invuln=.18;floating(hero.x,hero.y-32,`-${dealt}`,'#ff7668');burst(hero.x,hero.y,'#a94137',8);}
  }
}

function attackTarget() {
  const target=combatTarget;if(!target)return;
  playSound(hero.weapon?.swingSound||'hand-swing');
  const base=Math.atan2(target.y-hero.y,target.x-hero.x);hero.dir=directionIndex(Math.cos(base),Math.sin(base));hero.attackDuration=hero.attackRate;hero.attackAnim=hero.attackDuration;
  const cost=criticalCost(),critical=criticalRequested()&&hero.criticalCharges>=cost;if(critical){hero.criticalCharges-=cost;playSound('male-critical',hero);if(hero.armorSet?.id==='hero-set')effects.push({kind:'hero-fire',x:hero.x,y:hero.y,life:.36,max:.36});}
  const victims=[];
  for(const e of enemies){const dx=e.x-hero.x,dy=e.y-hero.y;let diff=Math.atan2(dy,dx)-base;diff=Math.atan2(Math.sin(diff),Math.cos(diff));const inRange=tileDistance(hero,e)<=(critical?weaponAttackRange():1);if(inRange&&Math.abs(diff)<.78)victims.push(e);}
  const struck=victims.slice(0,hero.maxTargets);let damageDealt=0;if(struck.length)playSound('weapon-hit',struck[0]);for(const e of struck){playSound(e.type.hurtSound,e);const packets=weaponDamagePackets(hero.damage,hero.weapon,critical,e.hp/e.maxHp);for(let i=0;i<packets.length;i++){damageDealt+=Math.min(Math.max(0,e.hp),packets[i]);e.hp-=packets[i];const offset=packets.length===2?(i===0?-13:13):0;floating(e.x+offset,e.y-28-i*7,packets[i],critical?'#ff9e50':'#f4d783');}e.flash=.1;burst(e.x,e.y,critical?'#ee713d':'#d5b363',critical?10:5);if(e.hp<=0)killEnemy(e);}applySiphon(damageDealt);
  if(autoAttackEnabled&&struck.includes(target)&&target.hp>0)autoAttackEngaged=true;enemies=enemies.filter(e=>e.hp>0);if(target.hp<=0){combatTarget=null;attackQueued=false;autoAttackEngaged=false;}effects.push({kind:'slash',x:hero.x+Math.cos(base)*38,y:hero.y+Math.sin(base)*38,angle:base,life:.18,max:.18});
}

function maxCriticalCharges(){return Math.min(140,hero.level);}
function criticalDamage(base){return Math.round(base*2);}
function weaponDamagePackets(base,weapon,critical,hpRatio=1){let total=critical?criticalDamage(base):Math.round(base);if(weapon?.id==='devastator')total=Math.round(total*(1+Math.min(.25,(1-hpRatio)*.25)));return weapon?.id==='bane'?[Math.floor(total/2),Math.ceil(total/2)]:[total];}

function updateProjectiles(dt) {
  for(const p of projectiles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
    for(const e of enemies){if(p.hit.has(e.id))continue;if((p.x-e.x)**2+(p.y-e.y)**2<(e.radius+8)**2){p.hit.add(e.id);e.hp-=p.damage;e.flash=.09;floating(e.x,e.y-28,Math.round(p.damage),'#f4d783');burst(p.x,p.y,'#e7c46b',5);if(e.hp<=0)killEnemy(e);if(p.pierce--<=0){p.life=0;break;}}}
  }
  projectiles=projectiles.filter(p=>p.life>0);
  enemies=enemies.filter(e=>e.hp>0);
}

function goldReward(base){return Math.round(base*GOLD_MULTIPLIER*(1+hero.goldBonus));}
function killEnemy(e){const reward=goldReward(e.type.gold+Math.floor((currentWave-1)/3)+Math.floor(Math.random()*3));kills++;hero.gold+=reward;gainXp(e.type.xp*(1+(currentWave-1)*.035));corpses.push({type:e.type,x:e.x,y:e.y,dir:e.dir,age:0});floating(e.x,e.y-42,`+${reward}g`,'#e6bd56');burst(e.x,e.y,e.type.color,8);}
function updateCorpses(dt){for(const corpse of corpses)corpse.age+=dt;corpses=corpses.filter(corpse=>corpse.age<1.55);}

function gainXp(amount){if(hero.level>=140)return;hero.xp+=amount;while(hero.xp>=hero.xpNext&&hero.level<140){hero.xp-=hero.xpNext;hero.level++;hero.xpNext=Math.round(hero.xpNext*1.16+8);hero.criticalCharges=Math.min(maxCriticalCharges(),hero.criticalCharges+1);hero.potions+=1;pendingLevels++;}if(hero.level>=140)hero.xp=0;if(pendingLevels&&state==='playing')openUpgrade();}

function openUpgrade(){state='upgrade';selectedUpgrades=[];ui.confirmUpgrade.disabled=true;ui.upgrade.classList.remove('hidden');const choices=[...new Map(upgrades.map(u=>[u.name,u])).values()];ui.options.replaceChildren(...choices.map(u=>{const b=document.createElement('button'),capped=typeof u.available==='function',maxed=capped&&!u.available();b.className=maxed?'upgrade maxed':'upgrade';b.disabled=maxed;b.innerHTML=`<span class="rune">${u.icon}</span><h3>${u.name}</h3><p>${u.desc}</p><small>${u.stat}</small><output class="upgrade-current">${maxed?'MAX':'CURRENT'}: ${u.current()}</output>`;b.onclick=()=>{const selected=selectedUpgrades.includes(u);if(selected)selectedUpgrades=selectedUpgrades.filter(choice=>choice!==u);else{if(selectedUpgrades.length>=2)selectedUpgrades.pop();selectedUpgrades.push(u);}for(const [index,card] of [...ui.options.children].entries())card.classList.toggle('selected',selectedUpgrades.includes(choices[index]));ui.confirmUpgrade.disabled=selectedUpgrades.length!==2;};return b;}));}
function confirmUpgrade(){if(state!=='upgrade'||selectedUpgrades.length!==2)return;for(const upgrade of selectedUpgrades)upgrade.apply();selectedUpgrades=[];pendingLevels--;ui.upgrade.classList.add('hidden');if(pendingLevels)openUpgrade();else state='playing';}

function itemUpgradeLevel(item){return itemUpgradeLevels.get(item.id)||0;}
function upgradedItemDamage(item){return Math.round(item.damage*Math.pow(1.1,itemUpgradeLevel(item)));}
function upgradedItemDefense(item){return Math.round((item.defense||0)*Math.pow(1.1,itemUpgradeLevel(item)));}
function itemUpgradeCost(item){return Math.round(item.cost*.1*Math.pow(1.2,itemUpgradeLevel(item)));}
function itemDamageLabel(item){const damage=upgradedItemDamage(item);return item.id==='bane'?`${Math.floor(damage/2)} + ${Math.ceil(damage/2)}`:String(damage);}
function isEquipped(item){return (item.kind==='shield'?hero.shield:item.kind==='armor-set'?hero.armorSet:hero.weapon)?.id===item.id;}
function heroSetDamage(){return hero.armorSet?upgradedItemDamage(hero.armorSet):0;}
function effectiveDefenseRatio(){return hero.defenseRatio+(hero.shield?upgradedItemDefense(hero.shield):0)+(hero.armorSet?upgradedItemDefense(hero.armorSet):0);}
function recalculateDamage(){hero.damage=(hero.weapon?upgradedItemDamage(hero.weapon):14)+hero.bonusDamage+heroSetDamage();}
function upgradeItem(item){if(!item||!shopOwned.has(item.id))return false;const cost=itemUpgradeCost(item);if(hero.gold<cost)return false;hero.gold-=cost;itemUpgradeLevels.set(item.id,itemUpgradeLevel(item)+1);recalculateDamage();refreshShop();refreshInventory();updateHud();return true;}
function buildShop(){
  const shield=shopItems.find(item=>item.kind==='shield'),displayItems=[...shopItems.filter(item=>item.kind!=='shield'),shield];
  ui.shopItems.replaceChildren(...displayItems.map(item=>{const card=document.createElement('article');card.className='shop-item';card.dataset.item=item.id;const range=item.kind==='shield'?'DEFENSE':item.kind==='armor-set'?'FULL SET':`CRIT RANGE ${item.attackRange} SQ`;const speed=item.kind==='shield'?'30 SEC ABILITY':item.kind==='armor-set'?'FIRE CRITICALS':item.twoHanded?'TWO-HANDED':`ATK ${item.rate.toFixed(2)}s`;card.innerHTML=`<canvas width="88" height="72" aria-label="${item.name} sprite"></canvas><h3>${item.name} <em class="upgrade-level"></em></h3><p>${item.description}</p><div class="item-stats"><span class="item-damage"></span><span>${range}</span><span>${speed}</span></div><div class="shop-actions"><button class="buy-item"></button><button class="upgrade-item"></button></div>`;card.querySelector('.buy-item').onclick=()=>buyOrEquip(item);card.querySelector('.upgrade-item').onclick=()=>upgradeItem(item);renderItemIcon(card.querySelector('canvas'),item);return card;}));
  refreshShop();
}
async function renderItemIcon(canvas,item){const index=Math.max(0,item.iconSprite-1),pack=packs.ItemPack,image=await pack.image(index),sprite=pack.sprites[index],f=sprite.frames[item.iconFrame%sprite.frames.length];await drawCroppedFrame(canvas,image,f,70,62,item.tintFilter);}
async function renderPotionIcon(){const index=5,pack=packs.ItemPack,image=await pack.image(index),sprite=pack.sprites[index],f=sprite.frames[2];await drawCroppedFrame(ui.potionIcon,image,f,30,34);}
async function drawCroppedFrame(canvas,image,f,maxW,maxH,filter='none'){const sample=new OffscreenCanvas(f.sw,f.sh),sampleContext=sample.getContext('2d',{willReadFrequently:true});sampleContext.drawImage(image,f.sx,f.sy,f.sw,f.sh,0,0,f.sw,f.sh);const pixels=sampleContext.getImageData(0,0,f.sw,f.sh).data;let left=f.sw,top=f.sh,right=-1,bottom=-1;for(let y=0;y<f.sh;y++)for(let x=0;x<f.sw;x++)if(pixels[(y*f.sw+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);if(right<left)return;const sw=right-left+1,sh=bottom-top+1,scale=Math.min(maxW/sw,maxH/sh),w=sw*scale,h=sh*scale;context.imageSmoothingEnabled=false;context.save();context.filter=filter||'none';context.drawImage(image,f.sx+left,f.sy+top,sw,sh,(canvas.width-w)/2,(canvas.height-h)/2,w,h);context.restore();}
function buyOrEquip(item){if(!item)return false;if(!shopOwned.has(item.id)){if(hero.gold<item.cost)return false;hero.gold-=item.cost;shopOwned.add(item.id);}equipItem(item);return true;}
function equipItem(item){if(item.kind==='shield'){if(hero.weapon?.twoHanded){hero.weapon=null;hero.attackRate=.56;hero.reach=62;}hero.shield=item;}else if(item.kind==='armor-set'){hero.armorSet=item;}else{hero.weapon=item;if(item.twoHanded)hero.shield=null;else hero.shield=shopItems.find(entry=>entry.id==='merien-shield');hero.attackRate=item.rate;hero.reach=item.reach;}recalculateDamage();refreshShop();refreshInventory();updateHud();}
function refreshShop(){ui.shopGold.textContent=hero.gold;for(const item of shopItems){const card=ui.shopItems.querySelector(`[data-item="${item.id}"]`);if(!card)continue;const buy=card.querySelector('.buy-item'),upgrade=card.querySelector('.upgrade-item'),owned=shopOwned.has(item.id),equipped=isEquipped(item),level=itemUpgradeLevel(item);card.classList.toggle('equipped',equipped);card.querySelector('.upgrade-level').textContent=level?`+${level}`:'';card.querySelector('.item-damage').textContent=item.kind==='shield'?`DR +${upgradedItemDefense(item)}`:item.kind==='armor-set'?`DMG +${itemDamageLabel(item)} · DR +${upgradedItemDefense(item)}`:`DMG ${itemDamageLabel(item)}`;buy.textContent=equipped?'EQUIPPED':owned?'EQUIP':`${item.cost} GOLD`;buy.disabled=equipped||(!owned&&hero.gold<item.cost);upgrade.textContent=owned?`UPGRADE +${level+1} · ${itemUpgradeCost(item)} GOLD`:'UPGRADE LOCKED';upgrade.disabled=!owned||hero.gold<itemUpgradeCost(item);}}
function toggleShop(){autoAttackEngaged=false;if(state==='playing'){state='shop';ui.shop.classList.remove('hidden');refreshShop();}else if(state==='shop'){state='playing';ui.shop.classList.add('hidden');lastTime=performance.now();}}

function buildInventory(){
  const art=$('#inventory-art'),pack=packs.GameDialog,index=Math.min(7,pack.count-1),sprite=pack.sprites[index];pack.image(index).then(image=>drawCroppedFrame(art,image,sprite.frames[0],art.width,art.height));
  ui.bag.replaceChildren(...Array.from({length:18},(_,slot)=>{const cell=document.createElement('button');cell.className='bag-slot';cell.dataset.slot=slot;return cell;}));
  refreshInventory();
}
function refreshInventory(){
  if(!ui.bag)return;$('#equipped-weapon').textContent=hero.weapon?`${hero.weapon.name}${itemUpgradeLevel(hero.weapon)?` +${itemUpgradeLevel(hero.weapon)}`:''}`:'Fists';$('#equipped-shield').textContent=hero.shield?`${hero.shield.name}${itemUpgradeLevel(hero.shield)?` +${itemUpgradeLevel(hero.shield)}`:''}`:'None';$('#equipped-armor').textContent=hero.armorSet?`${hero.armorSet.name}${itemUpgradeLevel(hero.armorSet)?` +${itemUpgradeLevel(hero.armorSet)}`:''}`:'Knight Set';$('#inventory-gold').textContent=hero.gold;
  const owned=shopItems.filter(item=>shopOwned.has(item.id));[...ui.bag.children].forEach((cell,i)=>{cell.replaceChildren();cell.disabled=true;const item=owned[i];if(!item)return;cell.disabled=false;const level=itemUpgradeLevel(item),damage=item.kind==='shield'?`Defense Ratio +${upgradedItemDefense(item)}`:item.kind==='armor-set'?`Damage +${itemDamageLabel(item)} · Defense Ratio +${upgradedItemDefense(item)}`:`Damage ${itemDamageLabel(item)}`;cell.title=`${item.name}${level?` +${level}`:''} · ${damage}`;const icon=document.createElement('canvas');icon.width=56;icon.height=48;const label=document.createElement('span');label.textContent=`${item.name}${level?` +${level}`:''}`;cell.append(icon,label);cell.classList.toggle('equipped',isEquipped(item));cell.onclick=()=>equipItem(item);renderItemIcon(icon,item);});
}
function toggleInventory(){autoAttackEngaged=false;if(state==='playing'){state='inventory';ui.inventory.classList.remove('hidden');refreshInventory();}else if(state==='inventory'){state='playing';ui.inventory.classList.add('hidden');lastTime=performance.now();}}
function setCriticalModifier(active){if(state!=='playing'&&active)return false;criticalHeld=Boolean(active);hero.criticalArmed=criticalRequested();updateHud();return criticalHeld;}
function armCritical(active=true){return setCriticalModifier(active);}
function toggleCriticalAuto(){if(state!=='playing')return false;criticalAuto=!criticalAuto;savePreference(PREFERENCE_KEYS.criticalAuto,criticalAuto);hero.criticalArmed=criticalRequested();updateHud();return criticalAuto;}
function toggleAutoAttack(){if(state!=='playing')return false;autoAttackEnabled=!autoAttackEnabled;savePreference(PREFERENCE_KEYS.autoAttack,autoAttackEnabled);if(!autoAttackEnabled)autoAttackEngaged=false;updateHud();return autoAttackEnabled;}
function activateMerien(){if(state!=='playing'||hero.shield?.id!=='merien-shield'||hero.merienCooldown>0||hero.merienActive>0)return false;hero.merienActive=30;hero.merienCooldown=150;floating(hero.x,hero.y-42,'MERIEN INVINCIBILITY','#78d6ef');updateHud();return true;}

function updateEffects(dt){for(const e of effects)e.life-=dt;effects=effects.filter(e=>e.life>0);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt;p.life-=dt;}particles=particles.filter(p=>p.life>0);}
function burst(x,y,color,n){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=25+Math.random()*90;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.35,max:.6,color,size:1+Math.random()*3});}}
function floating(x,y,text,color){effects.push({kind:'text',x,y,text,color,life:.65,max:.65});}

function sceneZoom(){return matchMedia('(orientation: landscape) and (max-height: 520px)').matches?1.5:1;}
function camera(){const zoom=sceneZoom(),viewW=VIEW.w/zoom,viewH=VIEW.h/zoom;return{x:WORLD.w<=viewW?-(viewW-WORLD.w)/2:Math.max(0,Math.min(WORLD.w-viewW,hero.x-viewW/2)),y:WORLD.h<=viewH?-(viewH-WORLD.h)/2:Math.max(0,Math.min(WORLD.h-viewH,hero.y-viewH/2))};}

function draw(time) {
  ctx.save();const zoom=sceneZoom(),cam=camera();ctx.scale(zoom,zoom);drawGround(cam,time);
  if(moveTarget&&state==='playing')drawMoveTarget(cam,time);
  const drawables=[...corpses.map(o=>({o,y:o.y,kind:'corpse'})),...enemies.map(o=>({o,y:o.y,kind:'enemy'})),...(packs.Wm?[{o:hero,y:hero.y,kind:'hero'}]:[])].sort((a,b)=>a.y-b.y);
  for(const d of drawables){if(d.kind==='enemy')drawEnemy(d.o,cam,time);else if(d.kind==='corpse')drawCorpse(d.o,cam);else drawHero(cam,time);}
  drawProjectiles(cam,time);drawParticles(cam);drawEffects(cam);ctx.restore();drawCursor();
}

function drawGround(cam,time){
  ctx.fillStyle='#07100c';ctx.fillRect(0,0,VIEW.w,VIEW.h);
  if(arenaImage.complete&&arenaImage.naturalWidth)ctx.drawImage(arenaImage,Math.round(-cam.x),Math.round(-cam.y),WORLD.w,WORLD.h);
  ctx.fillStyle='rgba(8,18,12,.1)';ctx.fillRect(-cam.x,-cam.y,WORLD.w,WORLD.h);
  ctx.strokeStyle='rgba(214,183,105,.28)';ctx.lineWidth=2;ctx.strokeRect(-cam.x+1,-cam.y+1,WORLD.w-2,WORLD.h-2);
}

function drawEnemy(e,cam,time){
  const x=e.x-cam.x,y=e.y-cam.y;if(x<-100||x>VIEW.w+100||y<-120||y>VIEW.h+100)return;
  const spriteIndex=(e.type.moveBase??8)+e.dir;const frame=Math.floor((e.age*7)%4);drawSprite(packs[e.type.pack],spriteIndex,frame,x,y,e.flash>0);
  if(e.hp<e.maxHp){ctx.fillStyle='#120d0c';ctx.fillRect(x-20,y-e.radius-34,40,4);ctx.fillStyle='#b44438';ctx.fillRect(x-19,y-e.radius-33,38*(e.hp/e.maxHp),2);}
}
function drawCorpse(corpse,cam){const x=corpse.x-cam.x,y=corpse.y-cam.y,frame=Math.min(3,Math.floor(corpse.age/.18));ctx.save();if(corpse.age>1.15)ctx.globalAlpha=Math.max(0,(1.55-corpse.age)/.4);drawSprite(packs[corpse.type.pack],(corpse.type.deathBase??32)+corpse.dir,frame,x,y,false);ctx.restore();}

function drawHero(cam,time){
  const x=hero.x-cam.x,y=hero.y-cam.y,scale=1.12;const attacking=hero.attackAnim>0;let action,frame;
  if(attacking){action=hero.weapon?6:5;frame=Math.min(7,Math.floor((1-hero.attackAnim/hero.attackDuration)*8));}
  else if(hero.moving){action=4;frame=Math.floor(time*HERO_RUN_FPS)%8;}
  else{action=(hero.weapon||hero.shield)?1:0;frame=0;}
  if(hero.merienActive>0)drawSprite(packs.Effect5,4,Math.floor(time*14)%12,x,y,false,'none',scale);
  drawSprite(packs.Wm,action*8+hero.dir,frame,x,y,hero.invuln>0&&Math.floor(time*20)%2===0,'none',scale);
  drawLayer(packs.MShoes,action,hero.dir*8+frame,x,y,'none',scale);
  if(hero.armorSet){drawLayer(packs.MHLeggings1,action,hero.dir*8+frame,x,y,'none',scale);drawLayer(packs.MHHauberk1,action,hero.dir*8+frame,x,y,'none',scale);drawLayer(packs.MShoes,action,hero.dir*8+frame,x,y,'none',scale);drawLayer(packs.MHPMail1,action,hero.dir*8+frame,x,y,'none',scale);drawLayer(packs.MHHelm1,action,hero.dir*8+frame,x,y,'none',scale);}
  else{drawLayer(packs.MLeggings,action,hero.dir*8+frame,x,y,KNIGHT_ARMOR_FILTER,scale);drawLayer(packs.MHauberk,action,hero.dir*8+frame,x,y,KNIGHT_ARMOR_FILTER,scale);drawLayer(packs.MShoes,action,hero.dir*8+frame,x,y,'none',scale);drawLayer(packs.MPMail,action,hero.dir*8+frame,x,y,KNIGHT_ARMOR_FILTER,scale);drawLayer(packs.NMHelm2,action,hero.dir*8+frame,x,y,'none',scale);}
  if(hero.shield){const shieldAction=attacking?4:(hero.moving?6:1);drawSprite(packs.Msh,56+shieldAction,hero.dir*8+frame,x,y,false,hero.shield.tintFilter,scale);}
  if(hero.weapon){const weaponAction=attacking?4:(hero.moving?6:1);drawSprite(packs[hero.weapon.pack],hero.weapon.offset+weaponAction*8+hero.dir,frame,x,y,false,hero.weapon.tintFilter,scale);}
}

function drawMoveTarget(cam,time){const x=moveTarget.x-cam.x,y=moveTarget.y-cam.y,pulse=9+Math.sin(time*8)*3;ctx.strokeStyle='rgba(225,193,105,.75)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,pulse,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(x-15,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+15,y);ctx.moveTo(x,y-15);ctx.lineTo(x,y-7);ctx.moveTo(x,y+7);ctx.lineTo(x,y+15);ctx.stroke();}

function drawSprite(pack,index,frame,x,y,flash=false,filter='none',scale=1){if(!pack)return;const sprite=pack.sprites[index];if(!sprite?.frames?.length)return;const f=sprite.frames[frame%sprite.frames.length];if(!f)return;const image=pack.cache.get(index);if(!image)return void pack.image(index);image.then?.(()=>{});const img=image instanceof Promise?null:image;if(!img)return;ctx.save();ctx.filter=filter||'none';if(flash){ctx.globalAlpha=.7;ctx.filter='brightness(2) saturate(.2)';}ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,Math.round(x+f.px*scale),Math.round(y+f.py*scale),f.sw*scale,f.sh*scale);ctx.restore();}
function spriteAtFeetAnchor(pack,index,frame,x,y,scale=1){const sprite=pack?.sprites[index];if(!sprite?.frames?.length)return null;const f=sprite.frames[frame%sprite.frames.length];return f?{x:x-(f.px+f.sw/2)*scale,y:y-(f.py+f.sh)*scale,frame:f}:null;}
function drawSpriteAtFeet(pack,index,frame,x,y,scale=1){const anchor=spriteAtFeetAnchor(pack,index,frame,x,y,scale);if(anchor)drawSprite(pack,index,frame,anchor.x,anchor.y,false,'none',scale);}
function drawLayer(pack,index,frame,x,y,filter='none',scale=1){drawSprite(pack,index,frame,x,y,false,filter,scale);}

function pointerWorld(){const cam=camera(),zoom=sceneZoom();return{x:pointer.x/zoom+cam.x,y:pointer.y/zoom+cam.y};}
function enemyAt(worldX,worldY){let selected=null,best=42;for(const enemy of enemies){const d=Math.hypot(worldX-enemy.x,worldY-enemy.y);if(d<best){best=d;selected=enemy;}}return selected;}
function pointerEnemy(){if(!pointer.inside)return null;const world=pointerWorld();return enemyAt(world.x,world.y);}
function cursorFrame(){return pointerEnemy()?3:0;}
function drawCursor(){if(state!=='playing'||!pointer.inside||!packs.Cursor)return;drawSprite(packs.Cursor,0,cursorFrame(),pointer.x,pointer.y,false);}

// Promote fulfilled images into the synchronous draw cache without blocking the loop.
for(const Pack of [OpkPack,WebSpritePack]){const original=Pack.prototype.image;Pack.prototype.image=async function(index){const value=this.cache.get(index);if(value&&!(value instanceof Promise))return value;const bitmap=await original.call(this,index);this.cache.set(index,bitmap);return bitmap;};}

function drawProjectiles(cam,time){for(const p of projectiles){const x=p.x-cam.x,y=p.y-cam.y;ctx.strokeStyle='rgba(237,204,114,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-p.vx*.025,y-p.vy*.025);ctx.lineTo(x,y);ctx.stroke();ctx.shadowColor='#ffe9a4';ctx.shadowBlur=14;ctx.fillStyle='#f9dc83';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}}
function drawParticles(cam){for(const p of particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x-cam.x,p.y-cam.y,p.size,p.size);}ctx.globalAlpha=1;}
function drawEffects(cam){for(const e of effects){const x=e.x-cam.x,y=e.y-cam.y,t=1-e.life/e.max;if(e.kind==='hero-fire'){drawSpriteAtFeet(packs.HeroEffect,1,Math.min(18,Math.floor(t*19)),x,y,1.12);}else if(e.kind==='text'){ctx.globalAlpha=e.life/e.max;ctx.fillStyle=e.color;ctx.font='800 13px Inter';ctx.textAlign='center';ctx.fillText(e.text,x,y-t*30);}else if(e.kind==='ring'){ctx.globalAlpha=e.life/e.max;ctx.strokeStyle='#d9bd70';ctx.beginPath();ctx.arc(x,y,8+t*28,0,Math.PI*2);ctx.stroke();}else if(e.kind==='slash'){ctx.save();ctx.translate(x,y);ctx.rotate(e.angle);ctx.globalAlpha=e.life/e.max;ctx.strokeStyle='#f0d687';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,25,-.8,.8);ctx.stroke();ctx.restore();}else{ctx.globalAlpha=e.life/e.max;ctx.fillStyle='#f5d77b';ctx.beginPath();ctx.arc(x,y,6+t*22,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;ctx.textAlign='start';}

function showWaveBanner(){const type=waveLeadType();ui.banner.innerHTML=`<small>WAVE <b>${currentWave}</b></small><strong>${type.name}</strong><span>${type.sub}</span>`;ui.banner.classList.remove('hidden');ui.banner.style.animation='none';void ui.banner.offsetWidth;ui.banner.style.animation='banner 2.5s both';setTimeout(()=>ui.banner.classList.add('hidden'),2500);}
function usePotion(){if(state!=='playing'||hero.potions<=0||hero.hp>=hero.maxHp)return false;hero.potions--;const healed=healHero(recoveryAmount());floating(hero.x,hero.y-36,`+${healed} HP`,'#72c982');burst(hero.x,hero.y,'#b83c36',8);updateHud();return true;}
function updateHud(){const type=waveLeadType();ui.wave.textContent=currentWave;ui.waveName.textContent=type.name;ui.timer.textContent=formatTime(Math.max(0,waveTime));ui.remaining.textContent=waveRemaining();ui.kills.textContent=kills;ui.gold.textContent=hero.gold;ui.hpBar.style.width=`${Math.max(0,hero.hp/hero.maxHp)*100}%`;ui.hpText.textContent=`${Math.ceil(Math.max(0,hero.hp))} / ${hero.maxHp}`;ui.level.textContent=hero.level;ui.dr.textContent=effectiveDefenseRatio();ui.xpBar.style.width=`${hero.level>=140?100:hero.xp/hero.xpNext*100}%`;ui.potionCount.textContent=hero.potions;ui.potionButton.disabled=hero.potions<=0;ui.criticalCount.textContent=`${hero.criticalCharges} / ${maxCriticalCharges()}${criticalAuto?' · AUTO':''}`;ui.criticalButton.disabled=false;ui.criticalButton.classList.toggle('armed',criticalRequested());ui.criticalButton.classList.toggle('waiting',criticalRequested()&&hero.criticalCharges<criticalCost());ui.criticalButton.setAttribute('aria-pressed',String(criticalAuto));ui.autoAttackStatus.textContent=autoAttackEnabled?'ON':'OFF';ui.autoAttackButton.classList.toggle('armed',autoAttackEnabled);ui.autoAttackButton.setAttribute('aria-pressed',String(autoAttackEnabled));const equipped=hero.shield?.id==='merien-shield';ui.merienButton.classList.toggle('hidden',!equipped);ui.merienButton.disabled=!equipped||hero.merienCooldown>0||hero.merienActive>0;ui.merienButton.classList.toggle('active',hero.merienActive>0);ui.merienStatus.textContent=hero.merienActive>0?`ACTIVE ${Math.ceil(hero.merienActive)}s`:hero.merienCooldown>0?`READY ${formatTime(hero.merienCooldown)}`:'READY';}
function formatTime(t){const s=Math.floor(t);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
function endGame(){state='gameover';ui.gameover.classList.remove('hidden');$('#result-wave').textContent=currentWave;$('#result-kills').textContent=kills;$('#result-time').textContent=formatTime(runTime);}
function togglePause(){autoAttackEngaged=false;if(state==='playing'){state='paused';ui.pause.classList.remove('hidden');}else if(state==='paused'){state='playing';ui.pause.classList.add('hidden');lastTime=performance.now();}}

function resize(){const ratio=Math.min(window.innerWidth/VIEW.w,window.innerHeight/VIEW.h);canvas.width=VIEW.w;canvas.height=VIEW.h;ctx.imageSmoothingEnabled=false;}
function isPortraitBlocked(){return matchMedia('(orientation: portrait) and (max-width: 900px)').matches;}
function loop(now){const dt=Math.min(.034,(now-lastTime)/1000||0);lastTime=now;update(dt);draw(now/1000);requestAnimationFrame(loop);}

addEventListener('keydown',e=>{if(e.repeat)return;if(e.code==='AltLeft'||e.code==='AltRight'||e.code==='KeyC'){e.preventDefault();criticalKeys.add(e.code);setCriticalModifier(true);}else if((e.code==='Digit1'||e.code==='Numpad1')&&state==='playing')usePotion();else if(e.code==='KeyB'&&(state==='playing'||state==='shop'))toggleShop();else if(e.code==='KeyI'&&(state==='playing'||state==='inventory'))toggleInventory();else if((e.code==='Digit5'||e.code==='Numpad5')&&state==='playing')activateMerien();else if(e.code==='Escape'&&state==='shop')toggleShop();else if(e.code==='Escape'&&state==='inventory')toggleInventory();else if(e.code==='Escape'&&(state==='playing'||state==='paused'))togglePause();});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='AltLeft'||e.code==='AltRight'||e.code==='KeyC'){criticalKeys.delete(e.code);setCriticalModifier(criticalKeys.size>0);}});addEventListener('blur',()=>{keys.clear();criticalKeys.clear();setCriticalModifier(false);});addEventListener('resize',resize);
ui.startButton.onclick=resetGame;$('#pause').onclick=togglePause;$('#resume').onclick=togglePause;$('#restart').onclick=resetGame;$('#restart-pause').onclick=resetGame;$('#shop-button').onclick=toggleShop;$('#close-shop').onclick=toggleShop;$('#inventory-button').onclick=toggleInventory;$('#close-inventory').onclick=toggleInventory;ui.potionButton.onclick=usePotion;ui.criticalButton.onclick=toggleCriticalAuto;ui.autoAttackButton.onclick=toggleAutoAttack;ui.merienButton.onclick=activateMerien;
ui.confirmUpgrade.onclick=confirmUpgrade;

function updatePointer(e){const rect=canvas.getBoundingClientRect();pointer.x=(e.clientX-rect.left)*VIEW.w/rect.width;pointer.y=(e.clientY-rect.top)*VIEW.h/rect.height;pointer.inside=pointer.x>=0&&pointer.x<=VIEW.w&&pointer.y>=0&&pointer.y<=VIEW.h;}
canvas.addEventListener('pointermove',e=>{updatePointer(e);if(rightFacing){if((e.buttons&2)===0){rightFacing=false;return;}faceHeroToward(pointerWorld());}});
canvas.addEventListener('pointerenter',e=>{updatePointer(e);pointer.inside=true;});
canvas.addEventListener('pointerleave',()=>pointer.inside=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function faceHeroToward(world){const dx=world.x-hero.x,dy=world.y-hero.y;if(dx||dy)hero.dir=directionIndex(dx,dy);hero.moving=false;moveTarget=null;combatTarget=null;resetHeroNavigation();stationaryAttack=false;attackHeld=false;attackQueued=false;autoAttackEngaged=false;}
function issuePointerCommand(e){if(state!=='playing')return;updatePointer(e);const world=pointerWorld(),selected=enemyAt(world.x,world.y);if(selected){rightFacing=false;autoAttackEngaged=false;combatTarget=selected;moveTarget=null;resetHeroNavigation();stationaryAttack=e.button===2;attackQueued=true;attackHeld=true;if(e.pointerId!==undefined)canvas.setPointerCapture?.(e.pointerId);}else if(e.button===0){rightFacing=false;attackHeld=false;attackQueued=false;autoAttackEngaged=false;stationaryAttack=false;combatTarget=null;resetHeroNavigation();moveTarget={x:Math.max(0,Math.min(WORLD.w,world.x)),y:Math.max(0,Math.min(WORLD.h,world.y))};}else if(e.button===2){rightFacing=true;faceHeroToward(world);}}
canvas.addEventListener('pointerdown',e=>{if(e.button===0)issuePointerCommand(e);});
canvas.addEventListener('mousedown',e=>{if(e.button===2)issuePointerCommand(e);});
addEventListener('pointerup',()=>{attackHeld=false;rightFacing=false;});addEventListener('pointercancel',()=>{attackHeld=false;rightFacing=false;});addEventListener('mouseup',()=>{attackHeld=false;rightFacing=false;});

if(location.hostname==='localhost'||location.hostname==='127.0.0.1'){
window.__HB_TEST__={getState:()=>({state,wave:currentWave,waveTime,waveSpawned,waveQuota:waveQuota(),waveRemaining:waveRemaining(),kills,enemies:enemies.length,enemyTypes:[...new Set(enemies.map(e=>e.type.key))],hp:hero.hp,maxHp:hero.maxHp,level:hero.level,gold:hero.gold,goldBonus:hero.goldBonus,potions:hero.potions,damage:hero.damage,bonusDamage:hero.bonusDamage,physicalAbsorption:hero.physicalAbsorption,weapon:hero.weapon?.id||null,shield:hero.shield?.id||null,armorSet:hero.armorSet?.id||null,target:combatTarget?.id||null,maxTargets:hero.maxTargets,baseDefenseRatio:hero.defenseRatio,defenseRatio:effectiveDefenseRatio(),recoveryBonus:hero.recoveryBonus,recoveryClock:hero.recoveryClock,recoveryAmount:recoveryAmount(),hpSiphon:hero.hpSiphon,siphonCarry:hero.siphonCarry,criticalCharges:hero.criticalCharges,criticalClock:hero.criticalClock,maxCritical:maxCriticalCharges(),criticalAuto,autoAttackEnabled,autoAttackEngaged,criticalArmed:criticalAvailable(),criticalRequested:criticalRequested(),merienCooldown:hero.merienCooldown,merienActive:hero.merienActive,audioEvents:[...audioEvents],world:{...WORLD,blocked:collisionRows.reduce((count,row)=>count+[...row].filter(cell=>cell==='1').length,0)},hero:{x:hero.x,y:hero.y,dir:hero.dir,attacking:hero.attackAnim>0,moving:hero.moving,walkable:isWalkable(hero.x,hero.y,hero.radius),navDir:hero.navDir,navRemaining:hero.navRemaining},packs:Object.fromEntries(Object.entries(packs).map(([k,p])=>[k,p.count]))}),start:resetGame,step:(seconds)=>{const n=Math.max(1,Math.ceil(seconds/.016)),dt=seconds/n;for(let i=0;i<n;i++)update(dt);},setWave:(wave)=>{currentWave=wave;waveSpawned=0;waveTime=WAVE_SECONDS;enemies=[];combatTarget=null;stationaryAttack=false;updateHud();},spawn:spawnEnemy,moveTo:(x,y)=>{combatTarget=null;stationaryAttack=false;resetHeroNavigation();moveTarget={x,y};},selectFirst:()=>{combatTarget=enemies[0]||null;resetHeroNavigation();stationaryAttack=false;attackClock=0;},clearWave:()=>{enemies=[];combatTarget=null;waveSpawned=waveQuota();updateHud();},expireWave:()=>waveTime=0,giveGold:n=>{hero.gold+=n;refreshShop();},buy:id=>buyOrEquip(shopItems.find(item=>item.id===id)),gainXp,damageHero:(n)=>hero.hp-=n,setLevel:n=>{hero.level=Math.min(140,n);hero.criticalCharges=maxCriticalCharges();hero.criticalClock=5;updateHud();},setCriticalCharges:n=>{hero.criticalCharges=Math.max(0,Math.min(maxCriticalCharges(),n));setCriticalModifier(false);},setCriticalClock:n=>hero.criticalClock=n,applyUpgrade:name=>{const u=upgrades.find(x=>x.name===name);if(u&&(!u.available||u.available()))u.apply();updateHud();},armCritical,releaseCritical:()=>setCriticalModifier(false),toggleCriticalAuto,toggleAutoAttack,activateMerien,usePotion,setMerienReady:()=>hero.merienCooldown=0,setRecoveryClock:n=>hero.recoveryClock=n,criticalDamage};
window.__HB_TEST__.floatingTexts=()=>effects.filter(effect=>effect.kind==='text').map(effect=>String(effect.text));
window.__HB_TEST__.equip=(id)=>{const item=shopItems.find(entry=>entry.id===id);if(item)equipItem(item);};
window.__HB_TEST__.forceCritical=()=>{criticalHeld=true;hero.criticalArmed=true;};
window.__HB_TEST__.placeFirstNear=()=>{if(enemies[0]){enemies[0].x=hero.x+WORLD.tileSize;enemies[0].y=hero.y;}};
window.__HB_TEST__.setFirstHitClock=(seconds)=>{if(enemies[0])enemies[0].hitClock=seconds;};
window.__HB_TEST__.selectFirst=()=>{combatTarget=enemies[0]||null;stationaryAttack=false;attackQueued=Boolean(combatTarget);};
window.__HB_TEST__.firstEnemyHp=()=>enemies[0]?.hp??null;
window.__HB_TEST__.firstEnemyDamage=()=>enemies[0]?.damage??null;
window.__HB_TEST__.enemyCount=(key)=>enemies.filter(enemy=>enemy.type.key===key).length;
window.__HB_TEST__.mobBaseSpeed=(key)=>waveTypes.find(type=>type.key===key)?.speed??null;
window.__HB_TEST__.mobProgression=()=>waveTypes.map(({key,xp,gold,damage})=>({key,xp,gold,damage}));
window.__HB_TEST__.mobScaledDamage=(key,wave)=>mobDamage(waveTypes.find(type=>type.key===key),wave);
window.__HB_TEST__.mobScaledHealth=(key,wave)=>Math.round(waveTypes.find(type=>type.key===key).hp*(1+(wave-1)*.16));
window.__HB_TEST__.mobHitChance=(wave,defenseRatio)=>mobHitChance(wave,defenseRatio);
window.__HB_TEST__.outfit=()=>hero.armorSet?['Hero Plate Mail','Hero Leggings','Hero Hauberk','Hero Helm']:['Knight Plate Mail','Knight Plate Leggings','Knight Hauberk','Wings Helm'];
window.__HB_TEST__.mobAttackInterval=()=>MOB_ATTACK_INTERVAL;
window.__HB_TEST__.enemiesWalkable=()=>enemies.every(enemy=>isWalkable(enemy.x,enemy.y));
window.__HB_TEST__.entitiesSeparated=()=>{const cells=[entityCell(hero),...enemies.map(entityCell)].map(cell=>`${cell.x},${cell.y}`);return new Set(cells).size===cells.length;};
window.__HB_TEST__.hbDirectionOrder=hbDirectionOrder;
window.__HB_TEST__.moveDirections=()=>MOVE_DIRECTIONS.map(direction=>[...direction]);
window.__HB_TEST__.attackRanges=()=>Object.fromEntries(shopItems.filter(item=>item.attackRange).map(item=>[item.id,item.attackRange]));
window.__HB_TEST__.itemData=(id)=>{const item=shopItems.find(entry=>entry.id===id);return item?{id:item.id,name:item.name,dice:item.dice,strength:item.strength,attackRange:item.attackRange,defense:item.defense||0,twoHanded:Boolean(item.twoHanded),pack:item.pack,offset:item.offset||0,tintFilter:item.tintFilter||''}:null;};
window.__HB_TEST__.rangeAt=(tilesX,tilesY)=>targetInAttackRange({x:hero.x+tilesX*WORLD.tileSize,y:hero.y+tilesY*WORLD.tileSize,radius:1});
window.__HB_TEST__.quietArena=()=>{enemies=[];combatTarget=null;spawnClock=999;};
window.__HB_TEST__.detourCount=()=>enemies.reduce((total,enemy)=>total+enemy.detours,0);
window.__HB_TEST__.firstNavigation=()=>enemies[0]?{direction:enemies[0].dir,decisions:enemies[0].navDecisions,changes:enemies[0].directionChanges,remaining:enemies[0].navRemaining,failures:enemies[0].failedMoveTurns,maxFailures:enemies[0].maxFailedMoveTurns,checks:enemies[0].compassChecks,x:enemies[0].x,y:enemies[0].y}:null;
window.__HB_TEST__.maxMoveFailures=()=>Math.max(0,...enemies.map(enemy=>enemy.maxFailedMoveTurns));
window.__HB_TEST__.setupDetourProbe=()=>{let point=null;for(let ty=2;ty<WORLD.tiles-2&&!point;ty++)for(let tx=2;tx<WORLD.tiles-7&&!point;tx++){const x=(tx+.5)*WORLD.tileSize,y=(ty+.5)*WORLD.tileSize,heroX=x+6*WORLD.tileSize;if(isWalkable(x,y)&&isWalkable(heroX,y,hero.radius)&&!isWalkable(x+WORLD.tileSize,y)&&MOVE_DIRECTIONS.some(([mx,my],dir)=>dir!==2&&isWalkable(x+mx*WORLD.tileSize,y+my*WORLD.tileSize)))point={x,y,heroX,natural:true};}if(!point)for(let ty=2;ty<WORLD.tiles-2&&!point;ty++)for(let tx=2;tx<WORLD.tiles-7&&!point;tx++){const x=(tx+.5)*WORLD.tileSize,y=(ty+.5)*WORLD.tileSize,heroX=x+6*WORLD.tileSize;if(isWalkable(heroX,y,hero.radius)&&isWalkable(x,y)&&MOVE_DIRECTIONS.every(([mx,my])=>isWalkable(x+mx*WORLD.tileSize,y+my*WORLD.tileSize,waveTypes[0].radius)))point={x,y,heroX,natural:false};}if(!point)return false;enemies=[];currentWave=1;waveSpawned=0;if(!spawnEnemy())return false;const enemy=enemies[0];Object.assign(hero,{x:point.heroX,y:point.y});Object.assign(enemy,{x:point.x,y:point.y,speed:48,turn:0,navDir:null,navRemaining:0,navDecisions:0,directionChanges:0,detours:0,failedMoveTurns:0,maxFailedMoveTurns:0,compassChecks:0,hitClock:99});if(!point.natural){if(!spawnEnemy())return false;Object.assign(enemies[1],{x:point.x+WORLD.tileSize,y:point.y,speed:0,navDir:null,navRemaining:0,hitClock:99});}return true;};
window.__HB_TEST__.setupBlockedCompassProbe=()=>{let center=null;for(let ty=2;ty<WORLD.tiles-2&&!center;ty++)for(let tx=2;tx<WORLD.tiles-7&&!center;tx++){const x=(tx+.5)*WORLD.tileSize,y=(ty+.5)*WORLD.tileSize,heroX=x+6*WORLD.tileSize;if(isWalkable(heroX,y,hero.radius)&&isWalkable(x,y)&&MOVE_DIRECTIONS.every(([mx,my])=>isWalkable(x+mx*WORLD.tileSize,y+my*WORLD.tileSize)))center={x,y,heroX};}if(!center)return false;enemies=[];currentWave=1;waveSpawned=0;Object.assign(hero,{x:center.heroX,y:center.y});for(let i=0;i<9;i++)if(!spawnEnemy())return false;Object.assign(enemies[0],{x:center.x,y:center.y,speed:48,turn:0,navDir:null,navRemaining:0,failedMoveTurns:0,maxFailedMoveTurns:0,compassChecks:0,hitClock:99});for(let dir=0;dir<8;dir++){const blocker=enemies[dir+1],vector=MOVE_DIRECTIONS[dir];Object.assign(blocker,{x:center.x+vector[0]*WORLD.tileSize,y:center.y+vector[1]*WORLD.tileSize,speed:0,hitClock:99,navDir:null,navRemaining:0});}return true;};
window.__HB_TEST__.setupEightSurround=()=>{let center=null;for(let ty=2;ty<WORLD.tiles-2&&!center;ty++)for(let tx=2;tx<WORLD.tiles-2&&!center;tx++){const x=(tx+.5)*WORLD.tileSize,y=(ty+.5)*WORLD.tileSize;if(isWalkable(x,y,hero.radius)&&MOVE_DIRECTIONS.every(([mx,my])=>isWalkable(x+mx*WORLD.tileSize,y+my*WORLD.tileSize,waveTypes[0].radius)))center={x,y};}if(!center)return false;enemies=[];currentWave=1;waveSpawned=0;Object.assign(hero,center);for(let dir=0;dir<8;dir++){if(!spawnEnemy())return false;const enemy=enemies.at(-1),vector=MOVE_DIRECTIONS[dir];Object.assign(enemy,{x:center.x+vector[0]*WORLD.tileSize,y:center.y+vector[1]*WORLD.tileSize,dir:(dir+4)%8,hitClock:99,navDir:null,navRemaining:0});}return true;};
window.__HB_TEST__.surroundState=()=>{const hc=entityCell(hero),adjacent=enemies.filter(enemy=>tileDistance(enemy,hero)===1),directions=adjacent.map(enemy=>{const ec=entityCell(enemy);return directionIndex(ec.x-hc.x,ec.y-hc.y);}).sort((a,b)=>a-b);return{adjacent:adjacent.length,directions,unique:window.__HB_TEST__.entitiesSeparated()};};
window.__HB_TEST__.restoreArenaCenter=()=>{hero.x=WORLD.w/2;hero.y=WORLD.h/2;enemies=[];combatTarget=null;moveTarget=null;resetHeroNavigation();};
window.__HB_TEST__.firstBlocked=()=>{for(let y=0;y<WORLD.tiles;y++)for(let x=0;x<WORLD.tiles;x++)if(collisionRows[y]?.[x]==='1')return{x:(x+.5)*WORLD.tileSize,y:(y+.5)*WORLD.tileSize};return null;};
window.__HB_TEST__.attackCooldown=()=>attackClock;
window.__HB_TEST__.corpseCount=()=>corpses.length;
window.__HB_TEST__.xp=()=>hero.xp;
window.__HB_TEST__.goldReward=goldReward;
window.__HB_TEST__.damagePackets=(id,critical=false,hpRatio=1)=>{const item=shopItems.find(entry=>entry.id===id);return item&&item.kind!=='armor-set'?weaponDamagePackets(upgradedItemDamage(item),item,critical,hpRatio):[];};
window.__HB_TEST__.upgradeItem=(id)=>upgradeItem(shopItems.find(item=>item.id===id));
window.__HB_TEST__.upgradeData=(id)=>{const item=shopItems.find(entry=>entry.id===id);return item?item.kind==='shield'?{level:itemUpgradeLevel(item),cost:itemUpgradeCost(item),defense:upgradedItemDefense(item)}:item.kind==='armor-set'?{level:itemUpgradeLevel(item),cost:itemUpgradeCost(item),damage:upgradedItemDamage(item),defense:upgradedItemDefense(item)}:{level:itemUpgradeLevel(item),cost:itemUpgradeCost(item),damage:upgradedItemDamage(item)}:null;};
window.__HB_TEST__.heroFireActive=()=>effects.some(effect=>effect.kind==='hero-fire');
window.__HB_TEST__.heroFireAlignment=()=>{const effect=effects.find(entry=>entry.kind==='hero-fire');if(!effect)return null;const t=1-effect.life/effect.max,frame=Math.min(18,Math.floor(t*19)),anchor=spriteAtFeetAnchor(packs.HeroEffect,1,frame,effect.x,effect.y,1.12),f=anchor?.frame;return anchor&&f?{dx:anchor.x+f.px*1.12+f.sw*1.12/2-effect.x,dy:anchor.y+f.py*1.12+f.sh*1.12-effect.y}:null;};
window.__HB_TEST__.portraitBlocked=isPortraitBlocked;
window.__HB_TEST__.sceneZoom=sceneZoom;
window.__HB_TEST__.clearCombatText=()=>{effects=effects.filter(effect=>effect.kind!=='text');};
window.__HB_TEST__.attackNow=attackTarget;
window.__HB_TEST__.physicalDamageAfterAbsorption=physicalDamageAfterAbsorption;
window.__HB_TEST__.backgroundReady=()=>backgroundLoadPromise;
window.__HB_TEST__.cursorFrame=cursorFrame;
window.__HB_TEST__.pointAtFirst=()=>{if(!enemies[0])return;const cam=camera();pointer.x=enemies[0].x-cam.x;pointer.y=enemies[0].y-cam.y;pointer.inside=true;};
window.__HB_TEST__.placeFirstOnHero=()=>{if(enemies[0]){enemies[0].x=hero.x+hero.radius+enemies[0].radius;enemies[0].y=hero.y;enemies[0].hitClock=0;}};
window.__HB_TEST__.placeFirstAt=(dx,dy)=>{if(enemies[0]){enemies[0].x=hero.x+dx;enemies[0].y=hero.y+dy;}};
window.__HB_TEST__.firstScreen=()=>{if(!enemies[0])return null;const cam=camera(),zoom=sceneZoom();return{x:(enemies[0].x-cam.x)*zoom,y:(enemies[0].y-cam.y)*zoom};};
window.__HB_TEST__.heroScreen=()=>{const cam=camera(),zoom=sceneZoom();return{x:(hero.x-cam.x)*zoom,y:(hero.y-cam.y)*zoom};};
window.__HB_TEST__.runTiming=()=>({frameMs:HERO_RUN_FRAME_MS,fps:HERO_RUN_FPS,speed:HERO_RUN_SPEED,tileSeconds:WORLD.tileSize/HERO_RUN_SPEED});
window.__HB_TEST__.setupRunProbe=()=>{let point=null;for(let ty=2;ty<WORLD.tiles-2&&!point;ty++)for(let tx=2;tx<WORLD.tiles-5&&!point;tx++){const x=tx*WORLD.tileSize,y=ty*WORLD.tileSize;if([0,1,2,3].every(i=>isWalkable(x+i*WORLD.tileSize,y,hero.radius)))point={x,y};}if(!point)return false;enemies=[];spawnClock=999;Object.assign(hero,{x:point.x,y:point.y,navDir:null,navRemaining:0,turn:0});combatTarget=null;moveTarget={x:point.x+3*WORLD.tileSize,y:point.y};return true;};
}

resize();requestAnimationFrame(loop);
loadPacks().catch(error=>{console.error(error);ui.error.textContent=`Sprite loading failed: ${error.message}. Serve this folder over HTTP/HTTPS (Cloudflare Pages works directly).`;ui.error.classList.remove('hidden');ui.startLabel.textContent='FAILED TO LOAD SPRITES';});
