import { useEffect, useMemo, useState } from 'react';
import TabBar, { type Tab } from './components/TabBar';
import TodayView from './components/TodayView';
import WeekGrid from './components/WeekGrid';
import PrepView from './components/PrepView';
import FoodsView from './components/FoodsView';
import SwapSheet from './components/SwapSheet';
import { generateWeek, regenerateCells } from './lib/generate';
import { loadState, saveState } from './lib/storage';
import type { Compartment, Food, FoodBank, PackMode, Week, Weekday } from './types';
import { WEEKDAYS } from './types';

const COMPARTMENTS: Compartment[] = ['carb', 'protein', 'veg', 'treat'];
const WEEKDAY_BY_JS_DAY: Record<number, Weekday | undefined> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

function computeToday(): Weekday | null {
  return WEEKDAY_BY_JS_DAY[new Date().getDay()] ?? null;
}

function defaultModes(): Record<Weekday, PackMode> {
  return { Mon: 'ambient', Tue: 'ambient', Wed: 'ambient', Thu: 'ambient', Fri: 'ambient' };
}

export default function App() {
  const initial = useMemo(() => loadState(), []);
  const [foods, setFoods] = useState<FoodBank>(initial.foods);
  const [week, setWeek] = useState<Week | undefined>(initial.week);
  const [warning, setWarning] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('today');
  const [swapTarget, setSwapTarget] = useState<{ day: Weekday; compartment: Compartment } | null>(null);

  const today = useMemo(computeToday, []);

  useEffect(() => {
    saveState({ version: 1, foods, week });
  }, [foods, week]);

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const handleGenerateWeek = () => {
    const modes = week
      ? (Object.fromEntries(WEEKDAYS.map((d) => [d, week[d].mode])) as Record<Weekday, PackMode>)
      : defaultModes();
    const result = generateWeek(foods, { modes, previous: week });
    setWeek(result.week);
    setWarning(result.warning);
  };

  const handleModeChange = (day: Weekday, mode: PackMode) => {
    setWeek((prev) => {
      const base: Week =
        prev ?? (Object.fromEntries(WEEKDAYS.map((d) => [d, { mode: 'ambient' as PackMode, slots: {}, locked: {} }])) as Week);
      const next: Week = structuredClone(base);
      next[day].mode = mode;

      // Re-roll every unlocked cell for the day, not just ones that became
      // unsafe. An ambient-safe food (bagel, cheese, cucumber) stays valid
      // under every mode, so only clearing invalid cells meant switching to
      // Ice Pack or Thermos could silently change nothing at all - the
      // toggle needs to visibly show what that mode actually unlocks.
      const targets = COMPARTMENTS.filter((c) => !next[day].locked[c]).map((compartment) => ({
        day,
        compartment,
      }));
      for (const { compartment } of targets) {
        next[day].slots[compartment] = undefined;
      }

      if (targets.length === 0) return next;
      const result = regenerateCells(foods, next, targets);
      setWarning(result.warning);
      return result.week;
    });
  };

  const handleOpenSwap = (day: Weekday, compartment: Compartment) => setSwapTarget({ day, compartment });
  const handleCloseSwap = () => setSwapTarget(null);

  const handleReroll = (day: Weekday, compartment: Compartment) => {
    if (!week) return;
    const currentId = week[day].slots[compartment];
    const currentFood = currentId ? byId.get(currentId) : undefined;
    const covers = currentFood?.covers ?? [compartment];
    const targets = covers
      .filter((c) => !week[day].locked[c])
      .map((c) => ({ day, compartment: c }));
    const result = regenerateCells(foods, week, targets.length > 0 ? targets : [{ day, compartment }]);
    setWeek(result.week);
    setWarning(result.warning);
  };

  const handleRerollDay = (day: Weekday) => {
    if (!week) return;
    const targets = COMPARTMENTS.filter((c) => !week[day].locked[c]).map((compartment) => ({ day, compartment }));
    const result = regenerateCells(foods, week, targets);
    setWeek(result.week);
    setWarning(result.warning);
  };

  const handleToggleLock = (day: Weekday, compartment: Compartment) => {
    if (!week) return;
    setWeek((prev) => {
      const next: Week = structuredClone(prev!);
      const currentId = next[day].slots[compartment];
      const food = currentId ? byId.get(currentId) : undefined;
      const covers = food?.covers ?? [compartment];
      const newLocked = !next[day].locked[compartment];
      for (const c of covers) next[day].locked[c] = newLocked;
      return next;
    });
  };

  // `compartment` isn't read here - a food fills every slot in its own
  // `covers`, not just the one the swap sheet was opened for - but it's kept
  // in the signature so call sites read clearly (matching handleReroll etc).
  const handlePickFood = (day: Weekday, _compartment: Compartment, foodId: string) => {
    const food = byId.get(foodId);
    if (!food) return;
    setWeek((prev) => {
      const next: Week = structuredClone(prev!);
      for (const c of food.covers) {
        if (next[day].locked[c]) continue;
        next[day].slots[c] = foodId;
      }
      return next;
    });
  };

  const handleUpdateFood = (id: string, patch: Partial<Food>) => {
    setFoods((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleAddFood = (food: Food) => {
    setFoods((prev) => [...prev, food]);
  };

  const handleDeleteFood = (id: string) => {
    setFoods((prev) => prev.filter((f) => f.id !== id));
    setWeek((prev) => {
      if (!prev) return prev;
      const next: Week = structuredClone(prev);
      for (const day of WEEKDAYS) {
        for (const c of COMPARTMENTS) {
          if (next[day].slots[c] === id) {
            next[day].slots[c] = undefined;
            next[day].locked[c] = false;
          }
        }
      }
      return next;
    });
  };

  return (
    <div className="app">
      <main className="app-content">
        {tab === 'today' && (
          <TodayView today={today} week={week} foods={foods} onOpenSwap={handleOpenSwap} onModeChange={handleModeChange} />
        )}
        {tab === 'week' && (
          <WeekGrid
            week={week}
            foods={foods}
            warning={warning}
            onGenerateWeek={handleGenerateWeek}
            onModeChange={handleModeChange}
            onOpenSwap={handleOpenSwap}
            onRerollDay={handleRerollDay}
          />
        )}
        {tab === 'prep' && <PrepView week={week} foods={foods} />}
        {tab === 'foods' && (
          <FoodsView foods={foods} onUpdateFood={handleUpdateFood} onAddFood={handleAddFood} onDeleteFood={handleDeleteFood} />
        )}
      </main>

      <TabBar active={tab} onChange={setTab} />

      {swapTarget && week && (
        <SwapSheet
          day={swapTarget.day}
          compartment={swapTarget.compartment}
          week={week}
          foods={foods}
          onClose={handleCloseSwap}
          onPick={(foodId) => {
            handlePickFood(swapTarget.day, swapTarget.compartment, foodId);
            handleCloseSwap();
          }}
          onReroll={() => {
            handleReroll(swapTarget.day, swapTarget.compartment);
            handleCloseSwap();
          }}
          onToggleLock={() => handleToggleLock(swapTarget.day, swapTarget.compartment)}
        />
      )}
    </div>
  );
}
