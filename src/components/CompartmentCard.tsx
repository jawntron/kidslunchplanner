import type { Compartment, Food } from '../types';

const COMPARTMENT_LABEL: Record<Compartment, string> = {
  carb: 'Carb',
  protein: 'Protein',
  veg: 'Veg',
  treat: 'Treat',
};

const COMPARTMENT_EMOJI: Record<Compartment, string> = {
  carb: '🍞',
  protein: '🍗',
  veg: '🥦',
  treat: '🍪',
};

interface Props {
  compartment: Compartment;
  food?: Food;
  onClick?: () => void;
  locked?: boolean;
}

/** One compartment of the box - used in both Today's big view and the Week grid. */
export default function CompartmentCard({ compartment, food, onClick, locked }: Props) {
  return (
    <button
      type="button"
      className={`compartment-card compartment-${compartment}${food ? '' : ' compartment-empty'}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="compartment-header">
        <span className="compartment-emoji" aria-hidden="true">
          {COMPARTMENT_EMOJI[compartment]}
        </span>
        <span className="compartment-label">{COMPARTMENT_LABEL[compartment]}</span>
        {locked && (
          <span className="compartment-lock" title="Locked" aria-label="Locked">
            🔒
          </span>
        )}
      </div>
      {food ? (
        <>
          <div className="compartment-food-name">{food.name}</div>
          {food.cutNote && <div className="compartment-cut-note">⚠️ {food.cutNote}</div>}
        </>
      ) : (
        <div className="compartment-food-name compartment-placeholder">Not set</div>
      )}
    </button>
  );
}
