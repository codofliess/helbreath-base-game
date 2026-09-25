import type { ItemCategory, Rarity } from './public-types';

/** SAMPLE item catalog (fictional, Helbreath-flavoured). Public information. */
export interface CatalogItem { item_id: number; name: string; rarity: Rarity; category: ItemCategory; }

export const ITEM_CATALOG: CatalogItem[] = [
  { item_id: 101, name: 'Long Sword', rarity: 'common', category: 'weapon' },
  { item_id: 102, name: 'Battle Axe', rarity: 'common', category: 'weapon' },
  { item_id: 110, name: 'Giant Sword', rarity: 'rare', category: 'weapon' },
  { item_id: 120, name: 'Staff of the Magi', rarity: 'epic', category: 'weapon' },
  { item_id: 130, name: 'Blood Rapier', rarity: 'legendary', category: 'weapon' },
  { item_id: 201, name: 'Chain Mail', rarity: 'common', category: 'armor' },
  { item_id: 210, name: 'Plate Helm', rarity: 'rare', category: 'armor' },
  { item_id: 220, name: 'Knight Shield', rarity: 'epic', category: 'armor' },
  { item_id: 301, name: 'Ring of Mana', rarity: 'rare', category: 'jewel' },
  { item_id: 310, name: 'Necklace of Merien', rarity: 'legendary', category: 'jewel' },
  { item_id: 401, name: 'Red Potion', rarity: 'common', category: 'potion' },
  { item_id: 402, name: 'Blue Potion', rarity: 'common', category: 'potion' },
  { item_id: 501, name: 'Recall Scroll', rarity: 'common', category: 'scroll' },
  { item_id: 510, name: 'Scroll of Enchant', rarity: 'epic', category: 'scroll' },
  { item_id: 601, name: 'Magic Stone', rarity: 'rare', category: 'material' },
];
