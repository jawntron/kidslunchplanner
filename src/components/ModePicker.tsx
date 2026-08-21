import type { PackMode } from '../types';

const OPTIONS: { mode: PackMode; label: string; hint: string }[] = [
  { mode: 'ambient', label: 'No pack', hint: 'Bentgo only' },
  { mode: 'chilled', label: 'Ice pack', hint: '+ insulated sleeve' },
  { mode: 'hot', label: 'Thermos', hint: 'preheated jar' },
];

interface Props {
  value: PackMode;
  onChange: (mode: PackMode) => void;
  compact?: boolean;
}

/** Segmented control for a day's pack mode - the single toggle the whole app pivots on. */
export default function ModePicker({ value, onChange, compact }: Props) {
  return (
    <div className={`mode-picker${compact ? ' mode-picker-compact' : ''}`} role="radiogroup" aria-label="Pack mode">
      {OPTIONS.map((opt) => (
        <button
          key={opt.mode}
          type="button"
          role="radio"
          aria-checked={value === opt.mode}
          className={`mode-option${value === opt.mode ? ' mode-option-active' : ''}`}
          onClick={() => onChange(opt.mode)}
        >
          <span className="mode-option-label">{opt.label}</span>
          {!compact && <span className="mode-option-hint">{opt.hint}</span>}
        </button>
      ))}
    </div>
  );
}
