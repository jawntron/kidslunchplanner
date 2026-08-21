export type Tab = 'today' | 'week' | 'prep' | 'foods';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'today', label: 'Today', emoji: '📦' },
  { id: 'week', label: 'Week', emoji: '📅' },
  { id: 'prep', label: 'Prep', emoji: '🛒' },
  { id: 'foods', label: 'Foods', emoji: '🍽️' },
];

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar" aria-label="Main sections">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-button${active === tab.id ? ' tab-button-active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          <span className="tab-emoji" aria-hidden="true">
            {tab.emoji}
          </span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
