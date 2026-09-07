import { Gender, SkinColor } from '../Types';
import { getItemByEquippedSprite, getItemById, ItemTypes, type Effect } from '../constants/Items';

type EquippedItems = Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[]; itemColor?: number }>>;

export type AppearanceGearConfig = {
    human: string;
    underwear?: string;
    underwearColorIndex?: number;
    hairStyleIndex?: number;
    hauberk?: string;
    helm?: string;
    leggings?: string;
    boots?: string;
    armor?: string;
    cape?: string;
    weapon?: string;
    weaponStartSpriteSheetIndex?: number;
    shield?: string;
    shieldStartSpriteSheetIndex?: number;
    accessory?: string;
};

/** Catalog human sprite basename (wm/ym/bm / ww/yw/bw). Phaser-free for hub paper-doll. */
export function getHumanSpriteName(gender: Gender, skinColor: SkinColor = SkinColor.Light): string {
    const spriteMap: Record<Gender, Record<SkinColor, string>> = {
        [Gender.MALE]: { [SkinColor.Light]: 'wm', [SkinColor.Tanned]: 'ym', [SkinColor.Dark]: 'bm' },
        [Gender.FEMALE]: { [SkinColor.Light]: 'ww', [SkinColor.Tanned]: 'yw', [SkinColor.Dark]: 'bw' },
    };
    return spriteMap[gender][skinColor];
}

/** Resolve equipped catalog sprites onto a gear config without constructing Phaser GameAssets. */
export function resolveGearFromEquippedItems(
    gear: AppearanceGearConfig,
    equippedItems: EquippedItems,
    gender: Gender,
): AppearanceGearConfig {
    const equippedSprite = (
        def: { equippedSpriteMale?: string; equippedSpriteFemale?: string } | undefined,
    ): string | undefined => {
        if (!def) {
            return undefined;
        }
        if (gender === Gender.MALE) {
            return def.equippedSpriteMale || def.equippedSpriteFemale;
        }
        return def.equippedSpriteFemale || def.equippedSpriteMale;
    };

    const weaponItem = equippedItems[ItemTypes.WEAPON];
    const weaponDef = weaponItem ? getItemById(weaponItem.itemId) : undefined;
    const weapon = gear.weapon ?? equippedSprite(weaponDef);
    const weaponStartSpriteSheetIndex = gear.weaponStartSpriteSheetIndex
        ?? weaponDef?.startSpriteSheetIndex
        ?? (weapon ? getItemByEquippedSprite(weapon)?.startSpriteSheetIndex : undefined);

    const shieldItem = equippedItems[ItemTypes.SHIELD];
    const shieldDef = shieldItem ? getItemById(shieldItem.itemId) : undefined;
    const shield = gear.shield ?? equippedSprite(shieldDef);
    const shieldStartSpriteSheetIndex = gear.shieldStartSpriteSheetIndex
        ?? shieldDef?.startSpriteSheetIndex
        ?? (shield ? getItemByEquippedSprite(shield)?.startSpriteSheetIndex : undefined);

    const armorItem = equippedItems[ItemTypes.ARMOR];
    const armorDef = armorItem ? getItemById(armorItem.itemId) : undefined;
    const armor = gear.armor ?? equippedSprite(armorDef);

    const hauberkItem = equippedItems[ItemTypes.HAUBERK];
    const hauberkDef = hauberkItem ? getItemById(hauberkItem.itemId) : undefined;
    const hauberk = gear.hauberk ?? equippedSprite(hauberkDef);

    const leggingsItem = equippedItems[ItemTypes.LEGGINGS];
    const leggingsDef = leggingsItem ? getItemById(leggingsItem.itemId) : undefined;
    const leggings = gear.leggings ?? equippedSprite(leggingsDef);

    const bootsItem = equippedItems[ItemTypes.BOOTS];
    const bootsDef = bootsItem ? getItemById(bootsItem.itemId) : undefined;
    const boots = gear.boots ?? equippedSprite(bootsDef);

    const helmItem = equippedItems[ItemTypes.HELMET];
    const helmDef = helmItem ? getItemById(helmItem.itemId) : undefined;
    const helm = gear.helm ?? equippedSprite(helmDef);

    const capeItem = equippedItems[ItemTypes.CAPE];
    const capeDef = capeItem ? getItemById(capeItem.itemId) : undefined;
    const cape = gear.cape ?? equippedSprite(capeDef);

    const accessoryItem = equippedItems[ItemTypes.ACCESSORY];
    const accessoryDef = accessoryItem ? getItemById(accessoryItem.itemId) : undefined;
    const accessory = gear.accessory ?? equippedSprite(accessoryDef);

    const underwear = gear.underwear ?? (gender === Gender.MALE ? 'mpt' : 'wpt');
    return { ...gear, weapon, weaponStartSpriteSheetIndex, shield, shieldStartSpriteSheetIndex, armor, hauberk, leggings, boots, helm, cape, accessory, underwear };
}
