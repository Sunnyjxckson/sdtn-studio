import { COLLECTION_TABS, useStore, type Tab } from '../store';
import { goHome } from '../projects';
import { pad2 } from '../model/project';

function LookBar() {
  const looks = useStore((s) => s.project.looks);
  const active = useStore((s) => s.project.activeLook);
  const selectedId = useStore((s) => s.selectedId);
  const setActive = useStore((s) => s.setActiveLook);
  const add = useStore((s) => s.addLook);
  const dup = useStore((s) => s.duplicateLook);
  const del = useStore((s) => s.deleteLook);
  const move = useStore((s) => s.moveLook);
  const rename = useStore((s) => s.renameLook);
  const copy = useStore((s) => s.copyGarmentToLook);
  const i = looks.findIndex((l) => l.id === active);
  const cur = looks[i];
  const others = looks.filter((l) => l.id !== active);
  return (
    <div className="lookbar" data-testid="lookbar">
      <div className="lookchips" role="tablist" aria-label="Looks">
        {looks.map((l, n) => (
          <button key={l.id} role="tab" aria-selected={l.id === active} className={l.id === active ? 'lookchip on' : 'lookchip'} onClick={() => setActive(l.id)} title={l.name}>
            <span className="mono">{pad2(n + 1)}</span>
            <span className="lookchipname">{l.name}</span>
          </button>
        ))}
        <button className="lookchip add" onClick={add} aria-label="Add look" title="Add look">
          + Look
        </button>
      </div>
      <div className="lookact">
        <input className="lookname" aria-label="Look name" value={cur?.name ?? ''} onChange={(e) => cur && rename(cur.id, e.target.value)} />
        <button className="iconbtn sm" onClick={() => cur && move(cur.id, -1)} disabled={i <= 0} aria-label="Move look earlier" title="Move earlier">
          ‹
        </button>
        <button className="iconbtn sm" onClick={() => cur && move(cur.id, 1)} disabled={i < 0 || i >= looks.length - 1} aria-label="Move look later" title="Move later">
          ›
        </button>
        <button className="btn mini" onClick={() => cur && dup(cur.id)}>
          Duplicate
        </button>
        <button className="btn mini" onClick={() => cur && del(cur.id)} disabled={looks.length <= 1}>
          Delete
        </button>
        {selectedId && others.length > 0 && (
          <select
            className="copysel"
            aria-label="Copy selected garment to look"
            value=""
            onChange={(e) => {
              if (e.target.value) copy(selectedId, e.target.value);
            }}
          >
            <option value="">Copy garment to...</option>
            {others.map((l) => (
              <option key={l.id} value={l.id}>
                {pad2(looks.indexOf(l) + 1)} {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export function TopBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const pname = useStore((s) => s.project.name);
  const season = useStore((s) => s.project.season);
  const setInfo = useStore((s) => s.setProjectInfo);
  const render = useStore((s) => s.doc.settings.render);
  const shading = useStore((s) => s.doc.settings.shading);
  const setRender = useStore((s) => s.setRender);
  const setShading = useStore((s) => s.setShading);
  const collection = COLLECTION_TABS.includes(tab);
  const tabs: { id: Tab | 'later'; label: string }[] = [
    { id: 'sketch', label: 'Sketch' },
    { id: 'draw', label: 'Draw' },
    { id: 'vector', label: 'Vector' },
    { id: 'flats', label: 'Flats' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'lineup', label: 'Collection' },
    { id: 'later', label: '3D, later' },
  ];
  const isOn = (id: Tab | 'later') => (id === 'lineup' ? collection : tab === id);
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">SDTN</span>
          <button className="btn mini" onClick={() => void goHome()} title="All projects">
            Projects
          </button>
          <input className="projname" aria-label="Project name" value={pname} onChange={(e) => setInfo({ name: e.target.value })} />
          <input className="projseason mono" aria-label="Season" value={season} onChange={(e) => setInfo({ season: e.target.value })} />
        </div>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={isOn(t.id)}
              disabled={t.id === 'later'}
              className={isOn(t.id) ? 'tab on' : 'tab'}
              onClick={() => t.id !== 'later' && setTab(t.id === 'lineup' && collection ? tab : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="topbar-end">
          {tab !== 'pattern' && tab !== 'flats' && !collection && (
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
      <LookBar />
    </>
  );
}
