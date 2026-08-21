import type { Aisle, FoodBank, Ingredient, Week } from '../types';
import { WEEKDAYS } from '../types';

export interface ShoppingItem {
  item: string;
  aisle: Aisle;
  /** Merged quantities as written by each contributing food, e.g. ["2 cups dry", "1 lb"]. */
  quantities: string[];
}

export type ShoppingList = Record<Aisle, ShoppingItem[]>;

const AISLE_ORDER: Aisle[] = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'other'];

/** Flattens every food selected in `week` into a grouped, de-duplicated shopping list. */
export function buildShoppingList(week: Week, bank: FoodBank): ShoppingList {
  const byId = new Map(bank.map((f) => [f.id, f]));
  const seenFoodIds = new Set<string>();
  const merged = new Map<string, ShoppingItem>();

  const addIngredient = (ing: Ingredient) => {
    const key = `${ing.aisle}::${ing.item.toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.quantities.includes(ing.qty)) existing.quantities.push(ing.qty);
    } else {
      merged.set(key, { item: ing.item, aisle: ing.aisle, quantities: [ing.qty] });
    }
  };

  for (const day of WEEKDAYS) {
    const plan = week[day];
    for (const foodId of Object.values(plan.slots)) {
      if (!foodId || seenFoodIds.has(foodId)) continue;
      seenFoodIds.add(foodId);
      const food = byId.get(foodId);
      if (!food) continue;
      for (const ing of food.ingredients) addIngredient(ing);
    }
  }

  const list: ShoppingList = {
    produce: [],
    dairy: [],
    meat: [],
    bakery: [],
    pantry: [],
    frozen: [],
    other: [],
  };
  for (const entry of merged.values()) {
    list[entry.aisle].push(entry);
  }
  for (const aisle of AISLE_ORDER) {
    list[aisle].sort((a, b) => a.item.localeCompare(b.item));
  }
  return list;
}

export { AISLE_ORDER };
