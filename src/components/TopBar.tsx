import { useStore, type Tab } from '../store';

export function TopBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const name = useStore((s) => s.doc.name);
  const tabs: { id: Tab | 'later'; label: string }[] = [
    { id: 'sketch', label: 'Sketch' },
    { id: 'flats', label: 'Flats' },
    { id: 'later', label: '3D, later' },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">SDTN</span>
        <span className="mono muted small">Studio / {name}</span>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            disabled={t.id === 'later'}
            className={tab === t.id ? 'tab on' : 'tab'}
            onClick={() => t.id !== 'later' && setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="topbar-end mono muted small">Saved in this browser</div>
    </header>
  );
}
