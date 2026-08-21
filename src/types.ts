// Core domain types for the toddler bento lunch planner.
//
// The whole design pivots on one real-world fact: this lunch is packed in
// the morning and sits unrefrigerated for 3-4 hours before it's eaten. What's
// safe to pack depends on what's carrying it (nothing / an ice pack / a
// preheated thermos), so every food declares which of those "pack modes" it
// is both SAFE and GOOD in — never just one blanket "is this ok" flag.

export type Compartment = 'carb' | 'protein' | 'veg' | 'treat';

/**
 * ambient - Bentgo box only, no ice pack. The default: never assume gear
 *           wasn't packed.
 * chilled - Bentgo box + ice pack in an insulated sleeve. Unlocks
 *           cooked-and-cooled food (pasta salad, chicken strips, egg, beans,
 *           steamed veg).
 * hot     - Preheated thermos alongside the Bentgo. Unlocks hot food that
 *           would be unpleasant or unsafe cold (dino nuggets, hot noodles).
 */
export type PackMode = 'ambient' | 'chilled' | 'hot';

/**
 * How much she actually likes a food, seeded from her parents' notes and
 * editable in the Foods tab as real-world feedback comes in.
 *   loved - favor heavily
 *   ok    - favor normally
 *   meh   - allowed, but picked rarely (e.g. plain bread, big beef/pork chunks)
 *   no    - never selected (mushroom, tomato, onion)
 */
export type Preference = 'loved' | 'ok' | 'meh' | 'no';

export type Aisle =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'pantry'
  | 'frozen'
  | 'other';

export interface Ingredient {
  item: string;
  qty: string;
  aisle: Aisle;
}

export interface Food {
  id: string;
  name: string;

  /** Which compartment(s) this fills. Usually one; a combo dish like
   *  "chicken fried rice" can cover both carb and protein at once. */
  covers: Compartment[];

  /**
   * No-repeat key, by EATING EXPERIENCE rather than base ingredient.
   * "Penne salad" and "orzo salad" share variety 'pasta' and can't both
   * appear in one week - they read as the same lunch. Roasted chicken and
   * dino nuggets get *different* varieties ('chicken-roasted' vs 'nugget')
   * because to a toddler they plainly are different foods.
   */
  variety: string;

  /**
   * Underlying ingredient, used only for the soft same-base cap (at most
   * two days per week sharing a base), never a hard block. Lets roasted
   * chicken and nuggets both appear without letting a week go
   * chicken-five-ways.
   */
  base: string;

  /** Pack modes in which this food is both food-safe and still appetizing
   *  after a 3-4 hour unrefrigerated sit. */
  modes: PackMode[];

  /** Minutes of same-day-morning work this costs (0 if fully batch-prepped
   *  ahead of time). Days are capped at 15 total. */
  prepMinutes: number;

  /** Weekend prep instructions, if any ("cook Sunday, portion into 5 tubs"). */
  batchStep?: string;

  /** Morning-of instructions, if any ("preheat jar with boiling water, fill"). */
  morningStep?: string;

  /** Choking-hazard guidance for a not-quite-3-year-old, when relevant. */
  cutNote?: string;

  ingredients: Ingredient[];

  preference: Preference;

  /** Contains tree nuts or peanuts. Always false in the seed bank (school is
   *  nut-free) but kept explicit so a user-added food can be checked too. */
  containsNuts?: boolean;
}

export type FoodBank = Food[];

export interface DayPlan {
  mode: PackMode;
  /** Food id selected for each compartment, or undefined if unfilled. */
  slots: Partial<Record<Compartment, string>>;
  /** Compartments the user has locked against re-roll. */
  locked: Partial<Record<Compartment, boolean>>;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Week = Record<Weekday, DayPlan>;

export interface GenerateResult {
  week: Week;
  /** Set when the bank couldn't fully satisfy the constraints - the week is
   *  still returned filled as far as possible, plus a human-readable reason. */
  warning?: string;
}
