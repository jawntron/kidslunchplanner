import { useState } from 'react';
import CompartmentCard from './CompartmentCard';
import ModePicker from './ModePicker';
import type { Compartment, FoodBank, PackMode, Week, Weekday } from '../types';
import { buildPrepPlan } from '../lib/prep';

const COMPARTMENTS: Compartment[] = ['carb', 'protein', 'veg', 'treat'];

interface Props {
  today: Weekday | null;
  week: Week | undefined;
  foods: FoodBank;
  onOpenSwap: (day: Weekday, compartment: Compartment) => void;
  onModeChange: (day: Weekday, mode: PackMode) => void;
}

export default function TodayView({ today, week, foods, onOpenSwap, onModeChange }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (!today) {
    return (
      <div className="empty-state">
        <p>No school lunch today. Enjoy the weekend! 🎉</p>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="empty-state">
        <p>No week planned yet.</p>
        <p>Head to the Week tab and hit "Generate week" to get started.</p>
      </div>
    );
  }

  const plan = week[today];
  const byId = new Map(foods.map((f) => [f.id, f]));
  const prep = buildPrepPlan(week, foods);
  const morning = prep.morning[today];

  const toggleStep = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="today-view">
      <div className="today-header">
        <h1>{today}'s box</h1>
        <ModePicker value={plan.mode} onChange={(mode) => onModeChange(today, mode)} />
      </div>

      <div className="today-grid">
        {COMPARTMENTS.map((c) => (
          <CompartmentCard
            key={c}
            compartment={c}
            food={plan.slots[c] ? byId.get(plan.slots[c]!) : undefined}
            locked={!!plan.locked[c]}
            onClick={() => onOpenSwap(today, c)}
          />
        ))}
      </div>

      {morning.items.length > 0 && (
        <div className="morning-checklist">
          <h2>
            This morning ({morning.totalMinutes} of 15 min)
          </h2>
          <ul>
            {morning.items.map((item) => {
              const key = `${today}-${item.foodId}`;
              return (
                <li key={key}>
                  <label className={checked.has(key) ? 'step-done' : ''}>
                    <input
                      type="checkbox"
                      checked={checked.has(key)}
                      onChange={() => toggleStep(key)}
                    />
                    <span className="step-name">{item.name}:</span> {item.step}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
