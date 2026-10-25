import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { buildSheet, DEFAULT_RULES, RULE_LABELS, SIZES, defaultOpts, type GradeRules, type SizeName } from '../model/pattern';
import { markerEstimate } from '../model/patternMarker';
import { torsoProfile } from '../model/figure';
import { PatternSheet, SIZE_COLORS } from './PatternSheet';
import { PAPERS, exportDxf, exportLargePdf, exportSvgFile, exportTiledPdf, layoutWidth, planTiles, type PaperKind } from '../patternExport';
import { attachTouchGestures } from '../touch';

interface V {
  x: number;
  y: number;
  k: number;
}

const KEY = 'sdtn-grade-rules';
function loadRules(): GradeRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch {
    // storage can be blocked
  }
  return { ...DEFAULT_RULES };
}

export function PatternView() {
  const g = useStore((s) => s.doc.garments.find((x) => x.id === s.selectedId) ?? [...s.doc.garments].reverse().find((x) => x.type !== 'shoes') ?? s.doc.garments[0]);
  const sex = useStore((s) => s.doc.base.sex);
  const pose = useStore((s) => s.doc.base.pose);
  const wrap = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<SVGGElement>(null);
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [v, setV] = useState<V>({ x: 0, y: 0, k: 0.5 });
  const [size, setSize] = useState<SizeName>('M');
  const [base, setBase] = useState<SizeName>('M');
  const [nested, setNested] = useState(false);
  const [nestSizes, setNestSizes] = useState<SizeName[]>(['S', 'M', 'L']);
  const [rules, setRules] = useState<GradeRules>(loadRules);
  const [fabricW, setFabricW] = useState(58);
  const [paper, setPaper] = useState<PaperKind>('letter');
  const [overlap, setOverlap] = useState(0.5);
  const [busy, setBusy] = useState('');
  const fitted = useRef<string>('');

  const torso = useMemo(() => torsoProfile(sex, pose), [sex, pose]);
  const opts = useMemo(() => ({ ...defaultOpts(), size, base, rules, nested, sizes: nestSizes }), [size, base, rules, nested, nestSizes]);
  const noPattern = g?.type === 'shoes';
  const sheet = useMemo(() => (g && !noPattern ? buildSheet(g, torso, opts) : null), [g, noPattern, torso, opts]);
  const marker = useMemo(() => (g && !noPattern ? markerEstimate(g, torso, opts, fabricW) : []), [g, noPattern, torso, opts, fabricW]);
  const pages = useMemo(() => {
    const p = PAPERS.find((x) => x.id === paper)!;
    if (!sheet) return 0;
    return p.tiled ? planTiles(sheet, { paper: paper as 'letter' | 'a4', overlap }).tiles.length + 1 : 1;
  }, [sheet, paper, overlap]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(rules));
    } catch {
      // ignore
    }
  }, [rules]);

  const fit = () => {
    const el = wrap.current;
    if (!el || !sheet) return;
    const r = el.getBoundingClientRect();
    const k = Math.min((r.width - 32) / sheet.w, (r.height - 32) / sheet.h);
    setV({ k, x: (r.width - sheet.w * k) / 2, y: 16 });
  };
  useEffect(() => {
    if (sheet && fitted.current !== `${g?.id}:${nested}`) {
      fitted.current = `${g?.id}:${nested}`;
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, g?.id, nested]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      setV((o) => {
        const k = Math.max(0.1, Math.min(4, o.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
        const f = k / o.k;
        return { k, x: cx - (cx - o.x) * f, y: cy - (cy - o.y) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const vRef = useRef(v);
  vRef.current = v;
  const hasSheet = !!sheet;
  useEffect(() => {
    const el = wrap.current?.querySelector('svg');
    if (!el) return;
    return attachTouchGestures(el, {
      get: () => vRef.current,
      set: (nv) => setV(nv),
      min: 0.1,
      max: 4,
      cancel: () => {
        drag.current = null;
      },
    });
  }, [hasSheet]);

  const printSheet = () => (g && !noPattern ? buildSheet(g, torso, { ...opts, maxRowIn: layoutWidth(paper) }) : null);

  const run = async (label: string, fn: () => Promise<unknown> | unknown) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy('');
    }
  };

  const exportPdf = () =>
    run('Building PDF', async () => {
      const s = printSheet();
      if (!s) return;
      const p = PAPERS.find((x) => x.id === paper)!;
      if (p.tiled) await exportTiledPdf(s, { paper: paper as 'letter' | 'a4', overlap });
      else await exportLargePdf(s, paper as 'a0' | 'plotter36');
    });

  const setRule = (k: keyof GradeRules, val: string) => {
    const n = parseFloat(val);
    setRules((r) => ({ ...r, [k]: Number.isFinite(n) ? n : 0 }));
  };
  const toggleNest = (s: SizeName) =>
    setNestSizes((a) => (a.includes(s) ? (a.length > 1 ? a.filter((x) => x !== s) : a) : [...a, s]));
  const rulesChanged = RULE_LABELS.some((r) => rules[r.k] !== DEFAULT_RULES[r.k]);
  const row = marker.find((m) => m.size === size);

  return (
    <div className="stage">
      <div className="patternbar">
        <span className="toolname">Pattern</span>
        <span className="muted small toolhelp">
          {g ? `${g.name}, size ${nested ? nestSizes.join(' ') : size}. Real scale, 1 in = 96 px.` : 'Add a garment from the Library to see the pattern.'}
        </span>
        <div className="barend">
          <button className="btn" style={{ padding: '6px 12px' }} onClick={fit} disabled={!sheet}>Fit</button>
          <button className="btn" style={{ padding: '6px 12px' }} onClick={() => sheet && sheetRef.current && exportSvgFile(sheet, sheetRef.current)} disabled={!sheet}>SVG</button>
          <button className="btn" style={{ padding: '6px 12px' }} onClick={() => run('Building DXF', () => { const s = printSheet(); if (s) exportDxf(s); })} disabled={!sheet}>DXF</button>
          <button className="primary" onClick={exportPdf} disabled={!sheet || !!busy}>{busy || 'Print PDF'}</button>
        </div>
      </div>
      <div className="patternbody">
        <div className="canvaswrap" ref={wrap}>
          {sheet ? (
            <svg
              className="patternsvg"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (d) setV((o) => ({ ...o, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <g ref={sheetRef} transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
                <PatternSheet sheet={sheet} />
              </g>
            </svg>
          ) : (
            <div className="loading muted">{noPattern ? 'No pattern for shoes. Select a garment to see its pattern.' : 'No garment yet. Pick a block from the Library.'}</div>
          )}
        </div>
        <aside className="patternside" data-testid="pattern-side">
          <section>
            <p className="label">SIZE</p>
            <div className="chips">
              {SIZES.map((s) => (
                <button key={s} className={size === s ? 'chip on' : 'chip'} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
            <label className="prow">
              <span>Drawn as</span>
              <select value={base} onChange={(e) => setBase(e.target.value as SizeName)}>
                {SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="prow">
              <input type="checkbox" checked={nested} onChange={(e) => setNested(e.target.checked)} />
              <span>Nested graded outlines</span>
            </label>
            {nested && (
              <div className="chips">
                {SIZES.map((s) => (
                  <button key={s} className={nestSizes.includes(s) ? 'chip on' : 'chip off'} onClick={() => toggleNest(s)} style={nestSizes.includes(s) ? { background: SIZE_COLORS[s], color: '#fff' } : undefined}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <p className="label">GRADE RULES, IN PER SIZE</p>
            <table className="ptable">
              <tbody>
                {RULE_LABELS.map((r) => (
                  <tr key={r.k}>
                    <td>{r.label}</td>
                    <td>
                      <input type="number" step={0.125} min={0} value={rules[r.k]} onChange={(e) => setRule(r.k, e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rulesChanged && (
              <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRules({ ...DEFAULT_RULES })}>
                Reset rules
              </button>
            )}
          </section>
          <section>
            <p className="label">FABRIC ESTIMATE</p>
            <label className="prow">
              <span>Fabric width, in</span>
              <input type="number" min={20} max={120} step={1} value={fabricW} onChange={(e) => setFabricW(Math.max(20, parseFloat(e.target.value) || 58))} />
            </label>
            <table className="ptable" data-testid="marker-table">
              <thead>
                <tr>
                  <th>Size</th>
                  <th>Yards</th>
                  <th>Inches</th>
                  <th>Use</th>
                </tr>
              </thead>
              <tbody>
                {marker.map((m) => (
                  <tr key={m.size} className={m.size === size ? 'on' : ''}>
                    <td>{m.size}</td>
                    <td>{m.yards.toFixed(2).replace(/0$/, '')}</td>
                    <td>{m.lengthIn.toFixed(0)}</td>
                    <td>{m.tooWide ? 'too wide' : `${Math.round(m.efficiency * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">{row ? `Size ${size}: about ${row.yards} yd of ${fabricW} in fabric, ${row.pieces} cut pieces.` : ''} Rough lay with grain running down the length.</p>
          </section>
          <section>
            <p className="label">PRINT</p>
            <label className="prow">
              <span>Paper</span>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PaperKind)}>
                {PAPERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {PAPERS.find((p) => p.id === paper)?.tiled && (
              <label className="prow">
                <span>Page overlap, in</span>
                <select value={overlap} onChange={(e) => setOverlap(parseFloat(e.target.value))}>
                  {[0.25, 0.5, 0.75, 1].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="hint">{PAPERS.find((p) => p.id === paper)?.tiled ? `${pages} pages with a 2 in scale square on page 1.` : 'One sheet, full size.'}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
