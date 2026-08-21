import CompartmentCard from './CompartmentCard';
import ModePicker from './ModePicker';
import type { Compartment, FoodBank, PackMode, Week, Weekday } from '../types';
import { WEEKDAYS } from '../types';

const COMPARTMENTS: Compartment[] = ['carb', 'protein', 'veg', 'treat'];

interface Props {
  week: Week | undefined;
  foods: FoodBank;
  warning?: string;
  onGenerateWeek: () => void;
  onModeChange: (day: Weekday, mode: PackMode) => void;
  onOpenSwap: (day: Weekday, compartment: Compartment) => void;
  onRerollDay: (day: Weekday) => void;
}

export default function WeekGrid({ week, foods, warning, onGenerateWeek, onModeChange, onOpenSwap, onRerollDay }: Props) {
  const byId = new Map(foods.map((f) => [f.id, f]));

  return (
    <div className="week-view">
      <div className="week-header">
        <h1>This week</h1>
        <button type="button" className="btn btn-primary" onClick={onGenerateWeek}>
          🔀 Generate week
        </button>
      </div>

      {warning && <p className="warning-banner">⚠️ {warning}</p>}

      {!week ? (
        <div className="empty-state">
          <p>No week planned yet. Hit "Generate week" to build one.</p>
        </div>
      ) : (
        <div className="week-columns">
          {WEEKDAYS.map((day) => {
            const plan = week[day];
            return (
              <div key={day} className="week-day-column">
                <div className="week-day-header">
                  <h2>{day}</h2>
                  <button type="button" className="btn btn-small" onClick={() => onRerollDay(day)}>
                    🎲
                  </button>
                </div>
                <ModePicker compact value={plan.mode} onChange={(mode) => onModeChange(day, mode)} />
                <div className="week-day-cells">
                  {COMPARTMENTS.map((c) => (
                    <CompartmentCard
                      key={c}
                      compartment={c}
                      food={plan.slots[c] ? byId.get(plan.slots[c]!) : undefined}
                      locked={!!plan.locked[c]}
                      onClick={() => onOpenSwap(day, c)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
