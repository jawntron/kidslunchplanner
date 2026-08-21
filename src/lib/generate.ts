import type {
  Compartment,
  DayPlan,
  Food,
  FoodBank,
  GenerateResult,
  PackMode,
  Week,
  Weekday,
} from '../types';
import { WEEKDAYS } from '../types';

const COMPARTMENTS: Compartment[] = ['carb', 'protein', 'veg', 'treat'];

/** At most this many days per week may share a protein `base` (soft - see
 *  modeSatisfied comment below for why the analogous carb/protein `variety`
 *  rule is a hard constraint but this one bends). */
const MAX_DAYS_PER_BASE = 2;

/** Hard cap on same-day-morning prep minutes (packing itself isn't counted -
 *  only actual cooking/assembly steps via `morningStep`/`prepMinutes`). */
const MORNING_BUDGET_MINUTES = 15;

const PREFERENCE_WEIGHT: Record<Food['preference'], number> = {
  loved: 6,
  ok: 3,
  meh: 1,
  no: 0,
};

export interface GenerateOptions {
  /** Pack mode chosen for each weekday. */
  modes: Record<Weekday, PackMode>;
  /** Previous week, if any - locked cells are carried forward untouched. */
  previous?: Week;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  random?: () => number;
  /** Restart attempts before giving up and returning a partial week. */
  maxAttempts?: number;
}

/**
 * Whether `food` is safe/appetizing to pack on a day using `dayMode`.
 *
 * Each pack mode is a superset of the one below it: an ice pack or a hot
 * thermos only ADDS options, it never removes the ambient-safe ones already
 * in the box. So 'chilled' day = ambient-safe OR chilled-safe foods, and
 * 'hot' day = ambient-safe OR hot-safe foods (a thermos keeps the thermos
 * item hot, but the rest of the Bentgo compartments are still sitting at
 * room temperature, exactly like an ambient day - so a veg or treat that
 * only carries an 'ambient' tag is still perfectly fine on a thermos day).
 */
export function modeSatisfied(food: Food, dayMode: PackMode): boolean {
  if (food.modes.includes('ambient')) return true;
  return food.modes.includes(dayMode);
}

function weight(food: Food): number {
  return PREFERENCE_WEIGHT[food.preference];
}

function pickWeighted<T extends Food>(candidates: T[], random: () => number): T {
  const total = candidates.reduce((sum, f) => sum + weight(f), 0);
  if (total <= 0) {
    return candidates[Math.floor(random() * candidates.length)];
  }
  let r = random() * total;
  for (const food of candidates) {
    r -= weight(food);
    if (r <= 0) return food;
  }
  return candidates[candidates.length - 1];
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface UnfilledSlot {
  day: Weekday;
  compartment: Compartment;
}

interface Attempt {
  week: Week;
  unfilled: UnfilledSlot[];
  softCapRelaxed: boolean;
}

function emptyDayPlan(mode: PackMode): DayPlan {
  return { mode, slots: {}, locked: {} };
}

function runAttempt(
  bank: FoodBank,
  modes: Record<Weekday, PackMode>,
  previous: Week | undefined,
  random: () => number,
): Attempt {
  const byId = new Map(bank.map((f) => [f.id, f]));
  const week: Week = {} as Week;

  for (const day of WEEKDAYS) {
    const prevDay = previous?.[day];
    const plan = emptyDayPlan(modes[day]);
    if (prevDay) {
      for (const c of COMPARTMENTS) {
        if (prevDay.locked[c] && prevDay.slots[c]) {
          plan.slots[c] = prevDay.slots[c];
          plan.locked[c] = true;
        }
      }
    }
    week[day] = plan;
  }

  const usedCarbVariety = new Set<string>();
  const usedProteinVariety = new Set<string>();
  const usedVegIds = new Set<string>();
  const proteinBaseCount = new Map<string, number>();
  let softCapRelaxed = false;

  const registerAssignment = (compartment: Compartment, food: Food) => {
    if (compartment === 'carb') usedCarbVariety.add(food.variety);
    if (compartment === 'protein') {
      usedProteinVariety.add(food.variety);
      proteinBaseCount.set(food.base, (proteinBaseCount.get(food.base) ?? 0) + 1);
    }
    if (compartment === 'veg') usedVegIds.add(food.id);
  };

  // Seed constraint state from any locked cells before we assign anything else.
  for (const day of WEEKDAYS) {
    for (const c of COMPARTMENTS) {
      const id = week[day].slots[c];
      if (!id) continue;
      const food = byId.get(id);
      if (food) registerAssignment(c, food);
    }
  }

  const unfilled: UnfilledSlot[] = [];

  // A combo dish already occupying two slots costs its prepMinutes once, not
  // once per slot - so this dedupes by food id before summing.
  const morningMinutesUsed = (plan: DayPlan): number => {
    const ids = new Set(Object.values(plan.slots).filter((id): id is string => !!id));
    let total = 0;
    for (const id of ids) total += byId.get(id)?.prepMinutes ?? 0;
    return total;
  };

  const assign = (plan: DayPlan, food: Food) => {
    // A combo dish (covers.length > 1, e.g. chicken fried rice covering both
    // carb and protein) fills every compartment it covers at once, not just
    // the one it was chosen for.
    for (const covered of food.covers) {
      plan.slots[covered] = food.id;
      registerAssignment(covered, food);
    }
  };

  const fillSlot = (day: Weekday, plan: DayPlan, compartment: Compartment) => {
    if (plan.slots[compartment]) return; // already filled (locked, or by a combo dish)

    let candidates = bank.filter((food) => {
      if (food.containsNuts) return false;
      if (food.preference === 'no') return false;
      if (!food.covers.includes(compartment)) return false;
      if (!modeSatisfied(food, plan.mode)) return false;

      // A combo dish spanning multiple compartments can only be placed while
      // every compartment it covers is still empty and unlocked - otherwise
      // it would silently overwrite an existing pick.
      if (food.covers.length > 1) {
        for (const other of food.covers) {
          if (other === compartment) continue;
          if (plan.slots[other] || plan.locked[other]) return false;
        }
      }

      if (compartment === 'carb' && usedCarbVariety.has(food.variety)) return false;
      if (compartment === 'protein' && usedProteinVariety.has(food.variety)) return false;
      // A combo dish covering protein (from the carb pass) must also honor
      // the protein no-repeat rule, and vice versa.
      if (food.covers.includes('carb') && food.covers.includes('protein')) {
        if (usedCarbVariety.has(food.variety) || usedProteinVariety.has(food.variety)) return false;
      }

      // Morning-of prep is capped per day; a combo dish only costs its
      // prepMinutes once even though it fills multiple compartments.
      if (morningMinutesUsed(plan) + food.prepMinutes > MORNING_BUDGET_MINUTES) return false;

      return true;
    });

    if (candidates.length === 0) {
      unfilled.push({ day, compartment });
      return;
    }

    if (compartment === 'veg') {
      const unused = candidates.filter((f) => !usedVegIds.has(f.id));
      if (unused.length > 0) candidates = unused;
      // else: every eligible veg already used this week - allow a repeat
      // rather than leaving the slot empty.
    }

    if (compartment === 'protein' || (compartment === 'carb' && candidates.some((f) => f.covers.includes('protein')))) {
      const underCap = candidates.filter(
        (f) => !f.covers.includes('protein') || (proteinBaseCount.get(f.base) ?? 0) < MAX_DAYS_PER_BASE,
      );
      if (underCap.length > 0) {
        candidates = underCap;
      } else if (candidates.some((f) => f.covers.includes('protein'))) {
        softCapRelaxed = true;
      }
    }

    const chosen = pickWeighted(candidates, random);
    assign(plan, chosen);
  };

  const dayOrder = shuffle([...WEEKDAYS], random);
  for (const day of dayOrder) {
    const plan = week[day];
    fillSlot(day, plan, 'carb');
    fillSlot(day, plan, 'protein');
    fillSlot(day, plan, 'veg');
    fillSlot(day, plan, 'treat');
  }

  return { week, unfilled, softCapRelaxed };
}

function describeUnfilled(unfilled: UnfilledSlot[]): string {
  const byCompartment = new Map<Compartment, Set<Weekday>>();
  for (const { day, compartment } of unfilled) {
    if (!byCompartment.has(compartment)) byCompartment.set(compartment, new Set());
    byCompartment.get(compartment)!.add(day);
  }
  const parts = [...byCompartment.entries()].map(
    ([compartment, days]) => `${compartment} (${[...days].join(', ')})`,
  );
  return (
    `Couldn't fill every slot: ${parts.join('; ')}. ` +
    'Try adding more foods to the bank, marking fewer items "no", or switching a day to chilled/thermos mode.'
  );
}

export function generateWeek(bank: FoodBank, options: GenerateOptions): GenerateResult {
  const random = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 25;

  let best: Attempt | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = runAttempt(bank, options.modes, options.previous, random);
    if (result.unfilled.length === 0) {
      return { week: result.week };
    }
    if (!best || result.unfilled.length < best.unfilled.length) {
      best = result;
    }
  }

  return {
    week: best!.week,
    warning: describeUnfilled(best!.unfilled),
  };
}

export interface RegenerateTarget {
  day: Weekday;
  compartment: Compartment;
}

/**
 * Re-rolls just the given (day, compartment) cells - a single swap, a whole
 * day, whatever the caller collects - while leaving every other cell in the
 * week exactly as it is. Used by the Week tab's per-cell and per-day re-roll
 * actions; a full "generate week" instead calls `generateWeek` directly with
 * `previous: week`, since its own locked-cell handling already does the
 * right thing for that case.
 *
 * Implemented by temporarily treating every non-target cell as locked (so
 * the underlying solver can't touch it), then restoring each cell's real
 * lock flag afterwards - the freeze is only a generation-time mechanism, not
 * a real lock the user asked for.
 */
export function regenerateCells(
  bank: FoodBank,
  week: Week,
  targets: RegenerateTarget[],
  random?: () => number,
): GenerateResult {
  const isTarget = (day: Weekday, compartment: Compartment) =>
    targets.some((t) => t.day === day && t.compartment === compartment);

  const working: Week = structuredClone(week);
  for (const day of WEEKDAYS) {
    for (const compartment of COMPARTMENTS) {
      if (isTarget(day, compartment)) {
        working[day].slots[compartment] = undefined;
        working[day].locked[compartment] = false;
      } else {
        working[day].locked[compartment] = true;
      }
    }
  }

  const modes = Object.fromEntries(WEEKDAYS.map((d) => [d, week[d].mode])) as Record<
    Weekday,
    PackMode
  >;

  const result = generateWeek(bank, { modes, previous: working, random });

  const targetDays = new Set(targets.map((t) => t.day));
  const week2: Week = {} as Week;
  for (const day of WEEKDAYS) {
    if (!targetDays.has(day)) {
      // Nothing on this day was a target, so it can't have changed - reuse
      // the original DayPlan untouched rather than the frozen/thawed copy.
      week2[day] = week[day];
      continue;
    }
    const dayPlan = result.week[day];
    for (const compartment of COMPARTMENTS) {
      dayPlan.locked[compartment] = isTarget(day, compartment)
        ? false
        : !!week[day].locked[compartment];
    }
    week2[day] = dayPlan;
  }

  return { week: week2, warning: result.warning };
}
