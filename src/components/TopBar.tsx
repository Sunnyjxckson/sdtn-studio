import { useStore, type Tab } from '../store';

export function TopBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const name = useStore((s) => s.doc.name);
  const render = useStore((s) => s.doc.settings.render);
  const shading = useStore((s) => s.doc.settings.shading);
  const setRender = useStore((s) => s.setRender);
  const setShading = useStore((s) => s.setShading);
  const tabs: { id: Tab | 'later'; label: string }[] = [
    { id: 'sketch', label: 'Sketch' },
    { id: 'flats', label: 'Flats' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'later', label: '3D, later' },
  ];
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">SDTN</span>
        <span className="mono muted small brandname">Studio / {name}</span>
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
      <div className="topbar-end">
        {tab !== 'pattern' && (
          <>
            <div className="tabs small-tabs" role="group" aria-label="Render mode">
              {(['line', 'rendered'] as const).map((m) => (
                <button key={m} className={render === m ? 'tab on' : 'tab'} aria-pressed={render === m} onClick={() => setRender(m)}>
                  {m === 'line' ? 'Line' : 'Rendered'}
                </button>
              ))}
            </div>
            <button
              className={shading ? 'btn on shadebtn' : 'btn shadebtn'}
              aria-pressed={shading}
              disabled={render !== 'rendered'}
              onClick={() => setShading(!shading)}
            >
              Shading
            </button>
          </>
        )}
      </div>
    </header>
  );
}
