import type { FoodBank, Weekday } from '../types';
import { WEEKDAYS } from '../types';
import type { Week } from '../types';

export interface BatchPrepItem {
  foodId: string;
  name: string;
  step: string;
}

export interface MorningPrepItem {
  foodId: string;
  name: string;
  step: string;
  minutes: number;
}

export interface PrepPlan {
  /** Weekend batch-cook checklist, de-duplicated across the week. */
  batch: BatchPrepItem[];
  /** Per-day morning steps plus a running minute total, for the 15-minute budget. */
  morning: Record<Weekday, { items: MorningPrepItem[]; totalMinutes: number }>;
}

/** Derives the weekend and morning prep checklists from a generated week. */
export function buildPrepPlan(week: Week, bank: FoodBank): PrepPlan {
  const byId = new Map(bank.map((f) => [f.id, f]));
  const seenBatchIds = new Set<string>();
  const batch: BatchPrepItem[] = [];
  const morning = {} as PrepPlan['morning'];

  for (const day of WEEKDAYS) {
    const plan = week[day];
    const items: MorningPrepItem[] = [];
    const seenFoodIdsToday = new Set<string>();

    for (const foodId of Object.values(plan.slots)) {
      if (!foodId || seenFoodIdsToday.has(foodId)) continue;
      seenFoodIdsToday.add(foodId);
      const food = byId.get(foodId);
      if (!food) continue;

      if (food.batchStep && !seenBatchIds.has(food.id)) {
        seenBatchIds.add(food.id);
        batch.push({ foodId: food.id, name: food.name, step: food.batchStep });
      }
      if (food.morningStep) {
        items.push({ foodId: food.id, name: food.name, step: food.morningStep, minutes: food.prepMinutes });
      }
    }

    morning[day] = {
      items,
      totalMinutes: items.reduce((sum, i) => sum + i.minutes, 0),
    };
  }

  return { batch, morning };
}
