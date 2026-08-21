import { useState } from 'react';
import type { FoodBank, Week } from '../types';
import { buildPrepPlan } from '../lib/prep';
import { buildShoppingList, AISLE_ORDER } from '../lib/shopping';

const AISLE_LABEL: Record<string, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  meat: 'Meat',
  bakery: 'Bakery',
  frozen: 'Frozen',
  pantry: 'Pantry',
  other: 'Other',
};

interface Props {
  week: Week | undefined;
  foods: FoodBank;
}

export default function PrepView({ week, foods }: Props) {
  const [checkedBatch, setCheckedBatch] = useState<Set<string>>(new Set());
  const [checkedShopping, setCheckedShopping] = useState<Set<string>>(new Set());

  if (!week) {
    return (
      <div className="empty-state">
        <p>Generate a week first - the Sunday prep list and shopping list build themselves from it.</p>
      </div>
    );
  }

  const prep = buildPrepPlan(week, foods);
  const shopping = buildShoppingList(week, foods);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSet(next);
  };

  return (
    <div className="prep-view">
      <section>
        <h1>Sunday prep</h1>
        {prep.batch.length === 0 ? (
          <p className="empty-state">Nothing needs batch-cooking this week.</p>
        ) : (
          <ul className="checklist">
            {prep.batch.map((item) => (
              <li key={item.foodId}>
                <label className={checkedBatch.has(item.foodId) ? 'step-done' : ''}>
                  <input
                    type="checkbox"
                    checked={checkedBatch.has(item.foodId)}
                    onChange={() => toggle(checkedBatch, setCheckedBatch, item.foodId)}
                  />
                  <span className="step-name">{item.name}:</span> {item.step}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h1>Shopping list</h1>
        {AISLE_ORDER.filter((aisle) => shopping[aisle].length > 0).map((aisle) => (
          <div key={aisle} className="shopping-aisle">
            <h2>{AISLE_LABEL[aisle]}</h2>
            <ul className="checklist">
              {shopping[aisle].map((item) => {
                const key = `${aisle}::${item.item}`;
                return (
                  <li key={key}>
                    <label className={checkedShopping.has(key) ? 'step-done' : ''}>
                      <input
                        type="checkbox"
                        checked={checkedShopping.has(key)}
                        onChange={() => toggle(checkedShopping, setCheckedShopping, key)}
                      />
                      {item.item}
                      <span className="shopping-qty"> ({item.quantities.join(', ')})</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
