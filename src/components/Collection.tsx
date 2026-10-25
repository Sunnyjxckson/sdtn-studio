import { useEffect, useMemo, useRef, useState } from 'react';
import { fullProject, useStore, type Tab } from '../store';
import { exportSdtn, importSdtn } from '../projects';
import { pad2, styleRows, type StyleRow } from '../model/project';
import { buildFlat, flatSheetSvg } from '../model/flats';
import { torsoProfile } from '../model/figure';
import { exportLineupPdf, exportLineupPng, lookSvg, svgUri } from '../lineup';
import { exportLineSheet } from '../lineSheet';
import { MoodView } from './MoodView';

const SUB: { id: Tab; label: string }[] = [
  { id: 'lineup', label: 'Lineup' },
  { id: 'linesheet', label: 'Line sheet' },
  { id: 'mood', label: 'Mood board' },
];

/** The open project with the working doc merged in, recomputed only when something changed. */
function useFullProject() {
  const project = useStore((s) => s.project);
  const doc = useStore((s) => s.doc);
  return useMemo(() => fullProject({ project, doc }), [project, doc]);
}

function Nav({ children }: { children?: React.ReactNode }) {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  return (
    <div className="patternbar collnav">
      <div className="tabs small-tabs" role="tablist" aria-label="Collection">
        {SUB.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {msg && <span className="muted small">{msg}</span>}
      <div className="barend">
        {children}
        <span className="sep" />
        <button className="btn mini" onClick={exportSdtn} title="Download the whole project as a .sdtn backup">
          Backup .sdtn
        </button>
        <button className="btn mini" onClick={() => file.current?.click()} title="Open a .sdtn backup as a new project">
          Import .sdtn
        </button>
        <input
          ref={file}
          type="file"
          accept=".sdtn,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setMsg((await importSdtn(f)) ? '' : 'That file is not an SDTN backup.');
          }}
        />
      </div>
    </div>
  );
}

function Lineup() {
  const p = useFullProject();
  const setActive = useStore((s) => s.setActiveLook);
  const setTab = useStore((s) => s.setTab);
  const [busy, setBusy] = useState('');
  const figs = useMemo(() => p.looks.map((l) => ({ id: l.id, name: l.name, src: svgUri(lookSvg(l.doc)), pieces: l.doc.garments.filter((g) => g.visible).length })), [p.looks]);
  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="stage">
      <Nav>
        <button className="btn mini" disabled={!!busy} onClick={() => run('png', () => exportLineupPng(p))}>
          {busy === 'png' ? 'Building PNG' : 'Lineup PNG'}
        </button>
        <button className="primary" disabled={!!busy} onClick={() => run('pdf', () => exportLineupPdf(p))}>
          {busy === 'pdf' ? 'Building PDF' : 'Lineup PDF'}
        </button>
      </Nav>
      <div className="canvaswrap">
        <div className="lineupwrap" data-testid="lineup">
          <div className="lineuprow">
            {figs.map((f, i) => (
              <figure key={f.id} className={f.id === p.activeLook ? 'lfig on' : 'lfig'} data-testid="lineup-look">
                <button
                  className="lfigbtn"
                  onClick={() => {
                    setActive(f.id);
                    setTab('sketch');
                  }}
                  aria-label={`Open look ${pad2(i + 1)}`}
                >
                  <img src={f.src} alt={`Look ${pad2(i + 1)} ${f.name}`} />
                </button>
                <figcaption>
                  <span className="mono lfignum">LOOK {pad2(i + 1)}</span>
                  <span className="lfigname">{f.name}</span>
                  <span className="muted small mono">{f.pieces} pieces</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A text field that keeps what you type even while the stored value falls back to a default. */
function Cell({ value, onCommit, label, className }: { value: string; onCommit: (v: string) => void; label: string; className?: string }) {
  const [v, setV] = useState(value);
  const focus = useRef(false);
  useEffect(() => {
    if (!focus.current) setV(value);
  }, [value]);
  return (
    <input
      aria-label={label}
      className={className}
      value={v}
      onFocus={() => (focus.current = true)}
      onBlur={() => {
        focus.current = false;
        setV(value);
      }}
      onChange={(e) => {
        setV(e.target.value);
        onCommit(e.target.value);
      }}
    />
  );
}

function Flat({ p, r }: { p: ReturnType<typeof fullProject>; r: StyleRow }) {
  const html = useMemo(() => {
    const base = p.looks[r.looks[0] - 1].doc.base;
    return flatSheetSvg(buildFlat(r.g, torsoProfile(base.sex, base.pose)));
  }, [p, r]);
  return <div className="lsflat" dangerouslySetInnerHTML={{ __html: html }} />;
}

function LineSheet() {
  const p = useFullProject();
  const setInfo = useStore((s) => s.setStyleInfo);
  const rows = useMemo(() => styleRows(p), [p]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="stage">
      <Nav>
        <button
          className="primary"
          disabled={!rows.length || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await exportLineSheet(p);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Building PDF' : 'Line sheet PDF'}
        </button>
      </Nav>
      <div className="canvaswrap">
        <div className="lswrap" data-testid="linesheet">
          {rows.length === 0 ? (
            <p className="muted">Add garments to your looks and each style shows up here.</p>
          ) : (
            <table className="lstable">
              <thead>
                <tr>
                  <th>Flat</th>
                  <th>Style</th>
                  <th>Number</th>
                  <th>Looks</th>
                  <th>Colorways</th>
                  <th>Fabric</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} data-testid="style-row">
                    <td>
                      <Flat p={p} r={r} />
                    </td>
                    <td>
                      <Cell label="Style name" value={r.name} onCommit={(v) => setInfo(r.key, { name: v })} />
                    </td>
                    <td>
                      <Cell label="Style number" className="mono" value={r.number} onCommit={(v) => setInfo(r.key, { number: v })} />
                    </td>
                    <td className="mono small">{r.looks.map(pad2).join(', ')}</td>
                    <td>
                      <Cell label="Colorways" value={r.colorways} onCommit={(v) => setInfo(r.key, { colorways: v })} />
                    </td>
                    <td>
                      <Cell label="Fabric" value={r.fabric} onCommit={(v) => setInfo(r.key, { fabric: v })} />
                    </td>
                    <td>
                      <Cell label="Price" className="mono" value={r.price} onCommit={(v) => setInfo(r.key, { price: v })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Collection() {
  const tab = useStore((s) => s.tab);
  return tab === 'linesheet' ? <LineSheet /> : tab === 'mood' ? <MoodView Nav={Nav} /> : <Lineup />;
}
