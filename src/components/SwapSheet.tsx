import { modeSatisfied } from '../lib/generate';
import type { Compartment, FoodBank, Week, Weekday } from '../types';
import { WEEKDAYS } from '../types';

interface Props {
  day: Weekday;
  compartment: Compartment;
  week: Week;
  foods: FoodBank;
  onClose: () => void;
  onPick: (foodId: string) => void;
  onReroll: () => void;
  onToggleLock: () => void;
}

/** Bottom sheet opened by tapping a cell in the Week grid: re-roll, lock, or
 *  hand-pick a specific replacement food. */
export default function SwapSheet({ day, compartment, week, foods, onClose, onPick, onReroll, onToggleLock }: Props) {
  const plan = week[day];
  const currentId = plan.slots[compartment];
  const locked = !!plan.locked[compartment];
  const byId = new Map(foods.map((f) => [f.id, f]));
  const current = currentId ? byId.get(currentId) : undefined;

  const usedElsewhere = new Map<string, Weekday>(); // variety -> day it's used on (excluding this day)
  for (const d of WEEKDAYS) {
    if (d === day) continue;
    for (const c of ['carb', 'protein'] as Compartment[]) {
      const id = week[d].slots[c];
      if (!id) continue;
      const food = byId.get(id);
      if (food) usedElsewhere.set(food.variety, d);
    }
  }

  const options = foods
    .filter((f) => !f.containsNuts)
    .filter((f) => f.preference !== 'no')
    .filter((f) => f.covers.includes(compartment))
    .filter((f) => modeSatisfied(f, plan.mode))
    .filter((f) => {
      if (f.covers.length <= 1) return true;
      // A combo dish can only be offered here if every OTHER compartment it
      // covers is free to take it (empty, or already this exact dish).
      return f.covers.every((c) => c === compartment || !plan.slots[c] || plan.slots[c] === f.id);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>
            {day} · {compartment}
          </h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {current && (
          <div className="sheet-current">
            Currently: <strong>{current.name}</strong>
            {current.covers.length > 1 && <span className="sheet-combo-badge"> combo dish</span>}
          </div>
        )}

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onReroll} disabled={locked}>
            🎲 Re-roll
          </button>
          <button type="button" className="btn" onClick={onToggleLock} disabled={!currentId}>
            {locked ? '🔓 Unlock' : '🔒 Lock'}
          </button>
        </div>

        <div className="sheet-list">
          {options.map((food) => {
            const conflictDay = usedElsewhere.get(food.variety);
            return (
              <button
                key={food.id}
                type="button"
                className={`sheet-list-item${food.id === currentId ? ' sheet-list-item-current' : ''}`}
                onClick={() => onPick(food.id)}
                disabled={locked}
              >
                <span className="sheet-list-name">{food.name}</span>
                {food.covers.length > 1 && <span className="sheet-combo-badge">combo</span>}
                {conflictDay && (
                  <span className="sheet-conflict">also on {conflictDay}</span>
                )}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="sheet-empty">No foods match this compartment and pack mode yet - add some in the Foods tab.</p>
          )}
        </div>
      </div>
    </div>
  );
}
