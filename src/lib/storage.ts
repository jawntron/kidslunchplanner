import type { FoodBank, Week } from '../types';
import { seedFoods } from '../data/foods';

const STORAGE_KEY = 'lunch-planner:v1';

export interface PersistedState {
  version: 1;
  foods: FoodBank;
  week?: Week;
}

function defaultState(): PersistedState {
  return { version: 1, foods: seedFoods, week: undefined };
}

/**
 * Loads app state from localStorage. Every read is wrapped in try/catch:
 * a private window, cleared site data, or a browser that blocks storage
 * access should degrade to the seed bank, never throw or blank the page.
 */
export function loadState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.foods)) {
      return defaultState();
    }
    return parsed as PersistedState;
  } catch {
    return defaultState();
  }
}

/** Saves app state to localStorage. Failures (quota, private mode, blocked
 *  storage) are swallowed - losing persistence is better than crashing. */
export function saveState(state: PersistedState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore - the in-memory state still works for this session.
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
