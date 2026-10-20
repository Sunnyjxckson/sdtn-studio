// Option bars for the extra tools. Each one is a component, so hooks are fine here.
import { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { findItem, orderedSelection, rotateAt, scaleAt, type VectorDoc, type VText } from '../../model/vector';
import { NumField } from '../../components/vector/VectorPanels';
import { selectedItems, vs } from '../edit';
import { blendSelected } from './t_blend';
import { applyMat, leaves, refPoint, reflectMat, shearMat } from './t_common';
import { useBlendOpts, useMeasureOpts, usePencilOpts, useShapeOpts, useTypeOpts, useXfOpts } from './t_state';
import type { XfKind } from './transform';

// ---------- Pencil, Blob ----------

export function PencilOpts() {
  const f = usePencilOpts((s) => s.fidelity);
  const set = usePencilOpts((s) => s.set);
  return (
    <>
      <span className="muted small">Accurate</span>
      <input type="range" min={0.5} max={10} step={0.5} value={f} onChange={(e) => set({ fidelity: Number(e.target.value) })} style={{ width: 120 }} aria-label="Fidelity" />
      <span className="muted small">Smooth</span>
    </>
  );
}

export function BlobOpts() {
  const size = usePencilOpts((s) => s.blobSize);
  const pressure = usePencilOpts((s) => s.pressure);
  const set = usePencilOpts((s) => s.set);
  return (
    <>
      <NumField label="Size" value={size} onChange={(n) => set({ blobSize: n })} min={2} max={200} />
      <button className={pressure ? 'opt on' : 'opt'} onClick={() => set({ pressure: !pressure })}>
        Pen pressure
      </button>
    </>
  );
}

// ---------- Shapes ----------

export function RoundRectOpts() {
  const r = useShapeOpts((s) => s.radius);
  const set = useShapeOpts((s) => s.set);
  return <NumField label="Corner radius" value={r} onChange={(n) => set({ radius: n })} min={0} max={500} />;
}

export function PolygonOpts() {
  const n = useShapeOpts((s) => s.sides);
  const set = useShapeOpts((s) => s.set);
  return <NumField label="Sides" value={n} onChange={(v) => set({ sides: Math.round(v) })} min={3} max={60} />;
}

export function StarOpts() {
  const p = useShapeOpts((s) => s.points);
  const i = useShapeOpts((s) => s.inner);
  const set = useShapeOpts((s) => s.set);
  return (
    <>
      <NumField label="Points" value={p} onChange={(v) => set({ points: Math.round(v) })} min={3} max={40} />
      <NumField label="Inner radius" value={i} onChange={(v) => set({ inner: v })} min={0.05} max={0.95} step={0.05} />
    </>
  );
}

// ---------- Type ----------

const FONTS = ['IBM Plex Sans', 'IBM Plex Mono', 'Archivo Black', 'Caveat', 'Georgia', 'Arial'];
const WEIGHTS = [400, 600, 700, 900];
const ANCHORS: { v: VText['anchor']; label: string }[] = [
  { v: 'start', label: 'L' },
  { v: 'middle', label: 'C' },
  { v: 'end', label: 'R' },
];

/** Change the type settings, and the selected text with them. */
function setType(patch: Partial<Pick<VText, 'font' | 'size' | 'weight' | 'anchor' | 'letter'>>) {
  useTypeOpts.getState().set(patch);
  const ids = orderedSelection(vs().doc.vector, vs().vsel);
  if (!ids.length) return;
  const hasText = selectedItems().some((it) => leaves(it).some((x) => x.kind === 'text'));
  if (!hasText) return;
  vs().vstep((v) => {
    for (const id of ids) {
      const f = findItem(v as VectorDoc, id);
      if (f) for (const x of leaves(f.item as never)) if (x.kind === 'text') Object.assign(x, patch);
    }
  });
}

export function TypeOpts() {
  const o = useTypeOpts();
  const doc = useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const t = useMemo(() => selectedItems(doc, sel).flatMap(leaves).find((x): x is VText => x.kind === 'text') ?? null, [doc, sel]);
  const cur = t ?? o;
  return (
    <>
      <select className="hexin small" value={cur.font} onChange={(e) => setType({ font: e.target.value })} aria-label="Font" style={{ width: 140 }}>
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <NumField label="Size" value={cur.size} onChange={(n) => setType({ size: n })} min={1} max={400} />
      <select className="hexin small" value={cur.weight} onChange={(e) => setType({ weight: Number(e.target.value) })} aria-label="Weight" style={{ width: 70 }}>
        {WEIGHTS.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>
      {ANCHORS.map((a) => (
        <button key={a.v} title={`Align ${a.v === 'start' ? 'left' : a.v === 'end' ? 'right' : 'center'}`} className={cur.anchor === a.v ? 'opt on' : 'opt'} onClick={() => setType({ anchor: a.v })}>
          {a.label}
        </button>
      ))}
      <NumField label="Spacing" value={cur.letter} onChange={(n) => setType({ letter: n })} step={0.5} min={-20} max={100} />
    </>
  );
}

// ---------- Transform ----------

export function XfOpts({ kind }: { kind: XfKind }) {
  const o = useXfOpts();
  const has = useStore((s) => s.vsel.length > 0);
  const run = (copy: boolean) => {
    const c = refPoint();
    if (!c) return;
    const m =
      kind === 'rotate'
        ? rotateAt(o.angle, c.x, c.y)
        : kind === 'reflect'
          ? reflectMat(o.axis, c)
          : kind === 'scale'
            ? scaleAt(Math.max(0.01, o.sx / 100), Math.max(0.01, o.sy / 100), c.x, c.y)
            : shearMat(o.shear, o.shearAxis === 'h', c);
    applyMat(m, copy);
  };
  return (
    <>
      {kind === 'rotate' && <NumField label="Angle" value={o.angle} onChange={(n) => o.set({ angle: n })} suffix="deg" />}
      {kind === 'reflect' && (
        <>
          <NumField label="Axis" value={o.axis} onChange={(n) => o.set({ axis: n })} suffix="deg" />
          <button className={o.axis === 90 ? 'opt on' : 'opt'} onClick={() => o.set({ axis: 90 })}>
            Vertical
          </button>
          <button className={o.axis === 0 ? 'opt on' : 'opt'} onClick={() => o.set({ axis: 0 })}>
            Horizontal
          </button>
        </>
      )}
      {kind === 'scale' && (
        <>
          <NumField label="Width" value={o.sx} onChange={(n) => o.set({ sx: n })} suffix="%" />
          <NumField label="Height" value={o.sy} onChange={(n) => o.set({ sy: n })} suffix="%" />
          <button className="opt" onClick={() => o.set({ sy: o.sx })}>
            Even
          </button>
        </>
      )}
      {kind === 'shear' && (
        <>
          <NumField label="Angle" value={o.shear} onChange={(n) => o.set({ shear: n })} suffix="deg" />
          <button className={o.shearAxis === 'h' ? 'opt on' : 'opt'} onClick={() => o.set({ shearAxis: 'h' })}>
            Horizontal
          </button>
          <button className={o.shearAxis === 'v' ? 'opt on' : 'opt'} onClick={() => o.set({ shearAxis: 'v' })}>
            Vertical
          </button>
        </>
      )}
      <button className="opt" disabled={!has} onClick={() => run(false)}>
        Apply
      </button>
      <button className="opt" disabled={!has} onClick={() => run(true)}>
        Copy
      </button>
      <span className="muted small">Click canvas to set center</span>
    </>
  );
}

// ---------- Measure ----------

export function DimOpts() {
  const ppi = useMeasureOpts((s) => s.ppi);
  const set = useMeasureOpts((s) => s.set);
  return <NumField label="Units per inch" value={ppi} onChange={(n) => set({ ppi: n })} step={0.1} min={0.1} max={200} />;
}

export function MeasureOpts() {
  const readout = useMeasureOpts((s) => s.readout);
  const ppi = useMeasureOpts((s) => s.ppi);
  const set = useMeasureOpts((s) => s.set);
  return (
    <>
      <NumField label="Units per inch" value={ppi} onChange={(n) => set({ ppi: n })} step={0.1} min={0.1} max={200} />
      <span className="mono small">{readout || 'Drag to measure'}</span>
    </>
  );
}

// ---------- Blend ----------

export function BlendOpts() {
  const steps = useBlendOpts((s) => s.steps);
  const set = useBlendOpts((s) => s.set);
  const [msg, setMsg] = useState('');
  return (
    <>
      <NumField label="Steps" value={steps} onChange={(n) => set({ steps: Math.round(n) })} min={1} max={60} />
      <button className="opt" onClick={() => setMsg(blendSelected() ?? '')}>
        Blend selected
      </button>
      {msg && <span className="muted small">{msg}</span>}
    </>
  );
}
