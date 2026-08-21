import { useState } from 'react';
import type { Aisle, Compartment, Food, FoodBank, PackMode, Preference } from '../types';

const COMPARTMENTS: Compartment[] = ['carb', 'protein', 'veg', 'treat'];
const MODES: PackMode[] = ['ambient', 'chilled', 'hot'];
const PREFERENCES: Preference[] = ['loved', 'ok', 'meh', 'no'];

const COMPARTMENT_LABEL: Record<Compartment, string> = {
  carb: 'Carb',
  protein: 'Protein',
  veg: 'Veg',
  treat: 'Treat',
};

const MODE_LABEL: Record<PackMode, string> = {
  ambient: 'No pack',
  chilled: 'Ice pack',
  hot: 'Thermos',
};

interface Props {
  foods: FoodBank;
  onUpdateFood: (id: string, patch: Partial<Food>) => void;
  onAddFood: (food: Food) => void;
  onDeleteFood: (id: string) => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function FoodsView({ foods, onUpdateFood, onAddFood, onDeleteFood }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [compartment, setCompartment] = useState<Compartment>('carb');
  const [modes, setModes] = useState<Set<PackMode>>(new Set(['ambient']));
  const [ingredientsText, setIngredientsText] = useState('');

  const grouped = COMPARTMENTS.map((c) => ({
    compartment: c,
    items: foods.filter((f) => f.covers[0] === c || (f.covers.includes(c) && f.covers[0] !== c)),
  }));

  const resetForm = () => {
    setName('');
    setCompartment('carb');
    setModes(new Set(['ambient']));
    setIngredientsText('');
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed || modes.size === 0) return;
    const slug = slugify(trimmed);
    const id = `custom-${slug}-${Date.now().toString(36)}`;
    const ingredients = ingredientsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => ({ item, qty: 'as needed', aisle: 'other' as Aisle }));

    onAddFood({
      id,
      name: trimmed,
      covers: [compartment],
      variety: slug,
      base: slug,
      modes: [...modes],
      prepMinutes: 0,
      ingredients,
      preference: 'ok',
    });
    resetForm();
    setShowAdd(false);
  };

  const toggleModeInForm = (mode: PackMode) => {
    setModes((prev) => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });
  };

  const toggleFoodMode = (food: Food, mode: PackMode) => {
    const has = food.modes.includes(mode);
    const nextModes = has ? food.modes.filter((m) => m !== mode) : [...food.modes, mode];
    onUpdateFood(food.id, { modes: nextModes });
  };

  return (
    <div className="foods-view">
      <div className="foods-header">
        <h1>Food bank</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? 'Cancel' : '+ Add food'}
        </button>
      </div>

      {showAdd && (
        <div className="add-food-form">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cheese quesadilla strips" />
          </label>
          <label>
            Compartment
            <select value={compartment} onChange={(e) => setCompartment(e.target.value as Compartment)}>
              {COMPARTMENTS.map((c) => (
                <option key={c} value={c}>
                  {COMPARTMENT_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Safe pack modes</legend>
            {MODES.map((m) => (
              <label key={m} className="checkbox-label">
                <input type="checkbox" checked={modes.has(m)} onChange={() => toggleModeInForm(m)} />
                {MODE_LABEL[m]}
              </label>
            ))}
          </fieldset>
          <label>
            Ingredients (comma separated, for the shopping list)
            <input
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="e.g. Tortillas, shredded cheese"
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={!name.trim()}>
            Add to bank
          </button>
        </div>
      )}

      {grouped.map(({ compartment: c, items }) => (
        <section key={c} className="foods-section">
          <h2>{COMPARTMENT_LABEL[c]}</h2>
          <ul className="foods-list">
            {items.map((food) => (
              <li key={food.id} className="foods-list-item">
                <div className="foods-list-name">
                  {food.name}
                  {food.covers.length > 1 && <span className="sheet-combo-badge">combo</span>}
                </div>
                <div className="foods-list-controls">
                  <select
                    value={food.preference}
                    onChange={(e) => onUpdateFood(food.id, { preference: e.target.value as Preference })}
                    aria-label={`Preference for ${food.name}`}
                  >
                    {PREFERENCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <div className="foods-mode-toggles">
                    {MODES.map((m) => (
                      <label key={m} className="checkbox-label checkbox-label-small">
                        <input type="checkbox" checked={food.modes.includes(m)} onChange={() => toggleFoodMode(food, m)} />
                        {MODE_LABEL[m]}
                      </label>
                    ))}
                  </div>
                  {food.id.startsWith('custom-') && (
                    <button type="button" className="btn btn-small btn-danger" onClick={() => onDeleteFood(food.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
