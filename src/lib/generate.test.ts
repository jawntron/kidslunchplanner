import { describe, expect, it } from 'vitest';
import { generateWeek, regenerateCells } from './generate';
import { seedFoods } from '../data/foods';
import { WEEKDAYS } from '../types';
import type { Compartment, Food, FoodBank, PackMode, Week, Weekday } from '../types';

function allAmbient(): Record<Weekday, PackMode> {
  return { Mon: 'ambient', Tue: 'ambient', Wed: 'ambient', Thu: 'ambient', Fri: 'ambient' };
}

function allChilled(): Record<Weekday, PackMode> {
  return { Mon: 'chilled', Tue: 'chilled', Wed: 'chilled', Thu: 'chilled', Fri: 'chilled' };
}

function mixedModes(): Record<Weekday, PackMode> {
  return { Mon: 'ambient', Tue: 'chilled', Wed: 'hot', Thu: 'chilled', Fri: 'ambient' };
}

/** Deterministic RNG (mulberry32) so tests are reproducible, not flaky. */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function food(overrides: Partial<Food> & Pick<Food, 'id' | 'covers' | 'variety' | 'base'>): Food {
  return {
    name: overrides.id,
    modes: ['ambient', 'chilled', 'hot'],
    prepMinutes: 0,
    ingredients: [],
    preference: 'ok',
    ...overrides,
  };
}

function allFoodIdsInWeek(week: Week): string[] {
  const ids: string[] = [];
  for (const day of WEEKDAYS) {
    for (const id of Object.values(week[day].slots)) {
      if (id) ids.push(id);
    }
  }
  return ids;
}

function varietiesFor(week: Week, bank: FoodBank, compartment: Compartment): string[] {
  const byId = new Map(bank.map((f) => [f.id, f]));
  const varieties: string[] = [];
  for (const day of WEEKDAYS) {
    const id = week[day].slots[compartment];
    if (!id) continue;
    const f = byId.get(id);
    if (f) varieties.push(f.variety);
  }
  return varieties;
}

describe('generateWeek - core constraints (real seed bank)', () => {
  it('never repeats a carb variety across the week', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { week } = generateWeek(seedFoods, { modes: allAmbient(), random: seededRandom(seed) });
      const varieties = varietiesFor(week, seedFoods, 'carb');
      expect(new Set(varieties).size).toBe(varieties.length);
    }
  });

  it('never repeats a protein variety across the week', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { week } = generateWeek(seedFoods, { modes: allChilled(), random: seededRandom(seed) });
      const varieties = varietiesFor(week, seedFoods, 'protein');
      expect(new Set(varieties).size).toBe(varieties.length);
    }
  });

  it('never selects a nut-containing food', () => {
    const nutty: FoodBank = [
      ...seedFoods,
      food({ id: 'protein-pb', covers: ['protein'], variety: 'peanut-butter', base: 'peanut', containsNuts: true, preference: 'loved' }),
    ];
    for (let seed = 0; seed < 15; seed++) {
      const { week } = generateWeek(nutty, { modes: allChilled(), random: seededRandom(seed) });
      expect(allFoodIdsInWeek(week)).not.toContain('protein-pb');
    }
  });

  it('never selects a food marked "no" (mushroom, tomato, onion)', () => {
    const byId = new Map(seedFoods.map((f) => [f.id, f]));
    const withDislikes: FoodBank = seedFoods.map((f) =>
      f.id === 'veg-cabbage-shredded' ? { ...f, preference: 'no' as const } : f,
    );
    for (let seed = 0; seed < 15; seed++) {
      const { week } = generateWeek(withDislikes, { modes: allChilled(), random: seededRandom(seed) });
      expect(allFoodIdsInWeek(week)).not.toContain('veg-cabbage-shredded');
    }
    expect(byId.get('veg-cabbage-shredded')?.preference).toBe('loved'); // sanity: seed data unmodified
  });

  it('on ambient days, every selected food is ambient-safe', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { week } = generateWeek(seedFoods, { modes: allAmbient(), random: seededRandom(seed) });
      const byId = new Map(seedFoods.map((f) => [f.id, f]));
      for (const day of WEEKDAYS) {
        for (const id of Object.values(week[day].slots)) {
          if (!id) continue;
          const f = byId.get(id)!;
          expect(f.modes).toContain('ambient');
        }
      }
    }
  });

  it('keeps every day within the 15-minute morning prep budget', () => {
    for (let seed = 0; seed < 15; seed++) {
      const { week } = generateWeek(seedFoods, { modes: mixedModes(), random: seededRandom(seed) });
      const byId = new Map(seedFoods.map((f) => [f.id, f]));
      for (const day of WEEKDAYS) {
        // A combo dish occupies two slots with the same food id but costs its
        // prepMinutes once - dedupe before summing, same as buildPrepPlan does.
        const uniqueIds = new Set(Object.values(week[day].slots).filter((id): id is string => !!id));
        const total = [...uniqueIds].reduce((sum, id) => sum + (byId.get(id)?.prepMinutes ?? 0), 0);
        expect(total).toBeLessThanOrEqual(15);
      }
    }
  });

  it('fills all four compartments for a typical mixed week', () => {
    const { week, warning } = generateWeek(seedFoods, { modes: mixedModes(), random: seededRandom(7) });
    expect(warning).toBeUndefined();
    for (const day of WEEKDAYS) {
      for (const c of ['carb', 'protein', 'veg', 'treat'] as Compartment[]) {
        expect(week[day].slots[c]).toBeTruthy();
      }
    }
  });
});

describe('generateWeek - combo dishes', () => {
  const comboBank: FoodBank = [
    food({ id: 'combo', covers: ['carb', 'protein'], variety: 'fried-rice', base: 'chicken', preference: 'loved', modes: ['hot'] }),
    food({ id: 'carb-a', covers: ['carb'], variety: 'bagel', base: 'wheat', preference: 'ok' }),
    food({ id: 'carb-b', covers: ['carb'], variety: 'pasta', base: 'wheat', preference: 'ok' }),
    food({ id: 'carb-c', covers: ['carb'], variety: 'noodle', base: 'wheat', preference: 'ok' }),
    food({ id: 'carb-d', covers: ['carb'], variety: 'rice', base: 'rice', preference: 'ok' }),
    food({ id: 'protein-a', covers: ['protein'], variety: 'egg', base: 'egg', preference: 'ok' }),
    food({ id: 'protein-b', covers: ['protein'], variety: 'bean', base: 'legume', preference: 'ok' }),
    food({ id: 'protein-c', covers: ['protein'], variety: 'cheese', base: 'dairy', preference: 'ok' }),
    food({ id: 'protein-d', covers: ['protein'], variety: 'turkey', base: 'turkey', preference: 'ok' }),
    food({ id: 'veg-a', covers: ['veg'], variety: 'cucumber', base: 'vegetable', preference: 'ok' }),
    food({ id: 'treat-a', covers: ['treat'], variety: 'cracker', base: 'wheat', preference: 'ok' }),
  ];

  it('a combo dish fills both carb and protein with the same food id', () => {
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const modes: Record<Weekday, PackMode> = { Mon: 'hot', Tue: 'ambient', Wed: 'ambient', Thu: 'ambient', Fri: 'ambient' };
      const { week } = generateWeek(comboBank, { modes, random: seededRandom(seed) });
      if (week.Mon.slots.carb === 'combo' && week.Mon.slots.protein === 'combo') {
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('registers both the carb and protein variety when a combo dish is picked', () => {
    const modes: Record<Weekday, PackMode> = { Mon: 'hot', Tue: 'hot', Wed: 'hot', Thu: 'hot', Fri: 'hot' };
    // Only one combo dish and one hot-safe fallback per compartment exists in
    // this mode, so Monday should take the combo and no other day can reuse
    // its 'fried-rice' variety for either carb or protein.
    const onlyComboBank: FoodBank = [
      food({ id: 'combo', covers: ['carb', 'protein'], variety: 'fried-rice', base: 'chicken', preference: 'loved', modes: ['hot'] }),
    ];
    const { week, warning } = generateWeek(onlyComboBank, { modes, random: seededRandom(1) });
    // Which day gets it depends on shuffle order, not on which day is
    // "Monday" - assert on the property that matters: exactly one day
    // carries the combo in both compartments, every other day is left
    // unfilled (only one carb/protein variety exists and it's used up)
    // rather than illegally reusing it.
    const daysWithCombo = WEEKDAYS.filter(
      (day) => week[day].slots.carb === 'combo' && week[day].slots.protein === 'combo',
    );
    expect(daysWithCombo.length).toBe(1);
    expect(warning).toBeDefined();
  });
});

describe('generateWeek - soft same-base cap', () => {
  it('allows roasted chicken and dino nuggets in the same week (different variety, same base)', () => {
    // Isolated fixture rather than the full seed bank: the real bank now has
    // six chicken presentations competing for the same soft cap, so whether
    // these two *specific* items land in one random week is a coin flip
    // that has nothing to do with the mechanism being tested here - the
    // variety/base distinction itself, proven on a small, controlled bank.
    const bank: FoodBank = [
      food({ id: 'protein-chicken-roasted', covers: ['protein'], variety: 'chicken-roasted', base: 'chicken', modes: ['chilled', 'hot'], preference: 'loved' }),
      food({ id: 'protein-nugget', covers: ['protein'], variety: 'nugget', base: 'chicken', modes: ['hot'], preference: 'loved' }),
      food({ id: 'protein-egg', covers: ['protein'], variety: 'egg', base: 'egg', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'protein-bean', covers: ['protein'], variety: 'bean', base: 'legume', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'protein-cheese', covers: ['protein'], variety: 'cheese', base: 'dairy', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'carb-a', covers: ['carb'], variety: 'bagel', base: 'wheat', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'carb-b', covers: ['carb'], variety: 'pasta', base: 'wheat', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'carb-c', covers: ['carb'], variety: 'noodle', base: 'wheat', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'carb-d', covers: ['carb'], variety: 'rice', base: 'rice', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'carb-e', covers: ['carb'], variety: 'tortilla', base: 'wheat', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'veg-a', covers: ['veg'], variety: 'cucumber', base: 'vegetable', modes: ['chilled', 'hot'], preference: 'ok' }),
      food({ id: 'treat-a', covers: ['treat'], variety: 'cracker', base: 'wheat', modes: ['chilled', 'hot'], preference: 'ok' }),
    ];
    // Dino nuggets are hot-only (cold nuggets aren't appetizing), so this
    // needs at least one hot day in the mix for both to have a chance.
    const modes: Record<Weekday, PackMode> = {
      Mon: 'chilled',
      Tue: 'hot',
      Wed: 'chilled',
      Thu: 'hot',
      Fri: 'chilled',
    };
    let bothAppear = false;
    for (let seed = 0; seed < 40 && !bothAppear; seed++) {
      const { week } = generateWeek(bank, { modes, random: seededRandom(seed) });
      const ids = allFoodIdsInWeek(week);
      if (ids.includes('protein-chicken-roasted') && ids.includes('protein-nugget')) {
        bothAppear = true;
      }
    }
    expect(bothAppear).toBe(true);
  });

  it('does not let a protein base take over more than 3 days when alternatives exist', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { week } = generateWeek(seedFoods, { modes: allChilled(), random: seededRandom(seed) });
      const byId = new Map(seedFoods.map((f) => [f.id, f]));
      const baseCounts = new Map<string, number>();
      for (const day of WEEKDAYS) {
        const id = week[day].slots.protein;
        if (!id) continue;
        const base = byId.get(id)!.base;
        baseCounts.set(base, (baseCounts.get(base) ?? 0) + 1);
      }
      for (const count of baseCounts.values()) {
        expect(count).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('generateWeek - locking', () => {
  it('keeps a locked cell across a re-roll and still respects it in the new week', () => {
    const first = generateWeek(seedFoods, { modes: allChilled(), random: seededRandom(3) });
    const lockedFoodId = first.week.Mon.slots.carb!;

    const previous: Week = structuredClone(first.week);
    previous.Mon.locked.carb = true;
    // Wipe every other slot so the only thing carried forward is the lock.
    for (const day of WEEKDAYS) {
      for (const c of ['protein', 'veg', 'treat'] as Compartment[]) {
        previous[day].slots[c] = undefined;
      }
      if (day !== 'Mon') previous[day].slots.carb = undefined;
    }

    for (let seed = 0; seed < 10; seed++) {
      const { week } = generateWeek(seedFoods, { modes: allChilled(), previous, random: seededRandom(seed + 100) });
      expect(week.Mon.slots.carb).toBe(lockedFoodId);
      expect(week.Mon.locked.carb).toBe(true);
      // No other day may reuse the locked carb's variety.
      const byId = new Map(seedFoods.map((f) => [f.id, f]));
      const lockedVariety = byId.get(lockedFoodId)!.variety;
      for (const day of WEEKDAYS) {
        if (day === 'Mon') continue;
        const id = week[day].slots.carb;
        if (id) expect(byId.get(id)!.variety).not.toBe(lockedVariety);
      }
    }
  });
});

describe('generateWeek - morning prep budget is a real constraint', () => {
  it('refuses to combine two foods that together exceed 15 minutes', () => {
    // Two 10-minute carbs with no cheaper alternative: any day must pick at
    // most one of them, proving the budget check actually excludes
    // candidates rather than just happening to pass by luck.
    const bank: FoodBank = [
      food({ id: 'carb-a', covers: ['carb'], variety: 'bagel', base: 'wheat', prepMinutes: 10, preference: 'loved' }),
      food({ id: 'carb-b', covers: ['carb'], variety: 'pasta', base: 'wheat', prepMinutes: 10, preference: 'loved' }),
      food({ id: 'protein-a', covers: ['protein'], variety: 'egg', base: 'egg', prepMinutes: 10, preference: 'loved' }),
      food({ id: 'veg-a', covers: ['veg'], variety: 'cucumber', base: 'vegetable', prepMinutes: 0, preference: 'ok' }),
      food({ id: 'treat-a', covers: ['treat'], variety: 'cracker', base: 'wheat', prepMinutes: 0, preference: 'ok' }),
    ];
    for (let seed = 0; seed < 20; seed++) {
      const { week } = generateWeek(bank, { modes: allAmbient(), random: seededRandom(seed) });
      const byId = new Map(bank.map((f) => [f.id, f]));
      for (const day of WEEKDAYS) {
        const total = Object.values(week[day].slots).reduce((sum, id) => {
          if (!id) return sum;
          return sum + (byId.get(id)?.prepMinutes ?? 0);
        }, 0);
        expect(total).toBeLessThanOrEqual(15);
      }
    }
  });
});

describe('generateWeek - infeasible bank', () => {
  it('returns a partial week with a reason instead of throwing or hanging', () => {
    const tinyBank: FoodBank = [
      food({ id: 'only-carb', covers: ['carb'], variety: 'bagel', base: 'wheat', preference: 'loved' }),
      food({ id: 'only-protein', covers: ['protein'], variety: 'egg', base: 'egg', preference: 'loved' }),
      food({ id: 'only-veg', covers: ['veg'], variety: 'cucumber', base: 'vegetable', preference: 'loved' }),
      food({ id: 'only-treat', covers: ['treat'], variety: 'cracker', base: 'wheat', preference: 'loved' }),
    ];
    const result = generateWeek(tinyBank, { modes: allAmbient(), random: seededRandom(0) });
    expect(result.warning).toBeDefined();
    expect(result.warning).toMatch(/carb/);
    // Exactly one weekday gets the only carb variety available (which day
    // depends on shuffle order); every other weekday is left short rather
    // than illegally reusing it.
    const daysWithCarb = WEEKDAYS.filter((day) => result.week[day].slots.carb === 'only-carb');
    expect(daysWithCarb.length).toBe(1);
  });

  it('never throws or infinite-loops on an empty bank', () => {
    const result = generateWeek([], { modes: allAmbient(), random: seededRandom(0) });
    expect(result.warning).toBeDefined();
    for (const day of WEEKDAYS) {
      expect(result.week[day].slots).toEqual({});
    }
  });
});

describe('regenerateCells', () => {
  it('re-rolls a single compartment on a single day and leaves every other cell untouched', () => {
    const { week: original } = generateWeek(seedFoods, { modes: allChilled(), random: seededRandom(9) });
    const before = structuredClone(original);

    const result = regenerateCells(seedFoods, original, [{ day: 'Wed', compartment: 'veg' }], seededRandom(42));

    for (const day of WEEKDAYS) {
      for (const c of ['carb', 'protein', 'treat'] as Compartment[]) {
        expect(result.week[day].slots[c]).toBe(before[day].slots[c]);
      }
      if (day !== 'Wed') {
        expect(result.week[day].slots.veg).toBe(before[day].slots.veg);
      }
    }
    expect(result.week.Wed.slots.veg).toBeTruthy();
    expect(result.week.Wed.locked.veg).toBeFalsy();
  });

  it('re-rolling a whole day leaves its locked cells alone and regenerates the rest', () => {
    const { week: original } = generateWeek(seedFoods, { modes: allChilled(), random: seededRandom(11) });
    original.Tue.locked.protein = true;
    const lockedProteinId = original.Tue.slots.protein;

    const targets = (['carb', 'veg', 'treat'] as Compartment[]).map((compartment) => ({
      day: 'Tue' as Weekday,
      compartment,
    }));
    const result = regenerateCells(seedFoods, original, targets, seededRandom(5));

    expect(result.week.Tue.slots.protein).toBe(lockedProteinId);
    expect(result.week.Tue.locked.protein).toBe(true);
    for (const c of ['carb', 'veg', 'treat'] as Compartment[]) {
      expect(result.week.Tue.locked[c]).toBeFalsy();
    }
    // Every other day is completely untouched.
    for (const day of WEEKDAYS) {
      if (day === 'Tue') continue;
      expect(result.week[day]).toEqual(original[day]);
    }
  });
});
