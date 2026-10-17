import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { buildSheet } from '../model/pattern';
import { PatternSheet } from './PatternSheet';

interface V {
  x: number;
  y: number;
  k: number;
}

export function PatternView() {
  const g = useStore((s) => s.doc.garments.find((x) => x.id === s.selectedId) ?? [...s.doc.garments].reverse()[0]);
  const wrap = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<SVGGElement>(null);
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  const [v, setV] = useState<V>({ x: 0, y: 0, k: 0.5 });
  const sheet = useMemo(() => (g ? buildSheet(g) : null), [g]);
  const fitted = useRef<string>('');

  const fit = () => {
    const el = wrap.current;
    if (!el || !sheet) return;
    const r = el.getBoundingClientRect();
    const k = Math.min((r.width - 32) / sheet.w, (r.height - 32) / sheet.h);
    setV({ k, x: (r.width - sheet.w * k) / 2, y: 16 });
  };
  useEffect(() => {
    if (sheet && fitted.current !== g?.id) {
      fitted.current = g?.id ?? '';
      fit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, g?.id]);

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

  const exportSvg = () => {
    const node = sheetRef.current;
    if (!node || !sheet || !g) return;
    const clone = node.cloneNode(true) as SVGGElement;
    clone.removeAttribute('transform');
    const body = new XMLSerializer().serializeToString(clone);
    const svg =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.w.toFixed(0)}" height="${sheet.h.toFixed(0)}" viewBox="0 0 ${sheet.w.toFixed(0)} ${sheet.h.toFixed(0)}">` +
      body.replace(' xmlns="http://www.w3.org/2000/svg"', '') +
      `</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sdtn-pattern-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stage">
      <div className="patternbar">
        <span className="toolname">Pattern</span>
        <span className="muted small toolhelp">
          {g ? `${g.name}. Pieces follow your fit, rise, length and leg opening. 1 in = 96 px.` : 'Add jeans from the Library to see the pattern.'}
        </span>
        <div className="barend">
          <button className="btn" style={{ padding: '6px 12px' }} onClick={fit} disabled={!sheet}>Fit</button>
          <button className="primary" onClick={exportSvg} disabled={!sheet}>Export SVG</button>
        </div>
      </div>
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
          <div className="loading muted">No jeans yet. Pick a block from the Library.</div>
        )}
      </div>
    </div>
  );
}
