// Align and distribute, like Illustrator's Align panel.
import { useState, type ReactNode } from 'react';
import { useStore } from '../../../store';
import { findItem, itemBox, orderedSelection, transformItem, translate, type Box, type VectorDoc, type VItem } from '../../../model/vector';
import { vs } from '../../../vector/edit';
import { Section } from '../VectorPanels';

type To = 'selection' | 'artboard' | 'key';
type Op = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'dh' | 'dv' | 'sh' | 'sv';

const ARTBOARD: Box = { x: 0, y: 20, w: 600, h: 980 };

interface Row {
  id: string;
  box: Box;
}

function rows(v: VectorDoc, ids: string[]): Row[] {
  const out: Row[] = [];
  for (const id of ids) {
    const f = findItem(v, id);
    const box = f ? itemBox(f.item as VItem) : null;
    if (f && box && !f.layer.locked && !f.item.locked) out.push({ id, box });
  }
  return out;
}

const union = (rs: Row[]): Box => {
  const x = Math.min(...rs.map((r) => r.box.x)), y = Math.min(...rs.map((r) => r.box.y));
  return { x, y, w: Math.max(...rs.map((r) => r.box.x + r.box.w)) - x, h: Math.max(...rs.map((r) => r.box.y + r.box.h)) - y };
};

/** How far each item moves. */
function moves(rs: Row[], op: Op, ref: Box, keyId: string | null): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>();
  const set = (id: string, dx: number, dy: number) => {
    if (id !== keyId && (Math.abs(dx) > 1e-6 || Math.abs(dy) > 1e-6)) m.set(id, [dx, dy]);
  };
  if (op === 'left') rs.forEach((r) => set(r.id, ref.x - r.box.x, 0));
  if (op === 'right') rs.forEach((r) => set(r.id, ref.x + ref.w - (r.box.x + r.box.w), 0));
  if (op === 'hcenter') rs.forEach((r) => set(r.id, ref.x + ref.w / 2 - (r.box.x + r.box.w / 2), 0));
  if (op === 'top') rs.forEach((r) => set(r.id, 0, ref.y - r.box.y));
  if (op === 'bottom') rs.forEach((r) => set(r.id, 0, ref.y + ref.h - (r.box.y + r.box.h)));
  if (op === 'vcenter') rs.forEach((r) => set(r.id, 0, ref.y + ref.h / 2 - (r.box.y + r.box.h / 2)));
  if (rs.length < 3) return m;
  const horiz = op === 'dh' || op === 'sh';
  if (!horiz && op !== 'dv' && op !== 'sv') return m;
  const lo = (b: Box) => (horiz ? b.x : b.y);
  const size = (b: Box) => (horiz ? b.w : b.h);
  const sorted = [...rs].sort((a, b) => lo(a.box) + size(a.box) / 2 - (lo(b.box) + size(b.box) / 2));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const put = (r: Row, pos: number) => (horiz ? set(r.id, pos - r.box.x, 0) : set(r.id, 0, pos - r.box.y));
  if (op === 'dh' || op === 'dv') {
    const c0 = lo(first.box) + size(first.box) / 2, c1 = lo(last.box) + size(last.box) / 2;
    sorted.forEach((r, i) => put(r, c0 + ((c1 - c0) * i) / (sorted.length - 1) - size(r.box) / 2));
  } else {
    const start = lo(first.box), end = lo(last.box) + size(last.box);
    const total = sorted.reduce((a, r) => a + size(r.box), 0);
    const gap = (end - start - total) / (sorted.length - 1);
    let at = start;
    sorted.forEach((r) => {
      put(r, at);
      at += size(r.box) + gap;
    });
  }
  return m;
}

function run(op: Op, to: To) {
  const st = vs();
  const ids = orderedSelection(st.doc.vector, st.vsel);
  const rs = rows(st.doc.vector, ids);
  if (!rs.length) return;
  // the key object is the first one picked
  const keyId = to === 'key' ? (st.vsel.find((id) => rs.some((r) => r.id === id)) ?? rs[0].id) : null;
  const ref = to === 'artboard' ? ARTBOARD : to === 'key' ? rs.find((r) => r.id === keyId)!.box : union(rs);
  const m = moves(rs, op, ref, keyId);
  if (!m.size) return;
  st.vstep((v) => {
    for (const [id, [dx, dy]] of m) {
      const f = findItem(v as VectorDoc, id);
      if (f) transformItem(f.item as VItem, translate(dx, dy));
    }
  });
}

// icons: bars as [x, y, w, h] in a 16 box, plus an optional guide line
type Bar = [number, number, number, number];
const ICONS: Record<Op, { bars: Bar[]; line?: [number, number, number, number] }> = {
  left: { line: [2, 1, 2, 15], bars: [[2, 3, 10, 3], [2, 9, 6, 3]] },
  hcenter: { line: [8, 1, 8, 15], bars: [[3, 3, 10, 3], [5, 9, 6, 3]] },
  right: { line: [14, 1, 14, 15], bars: [[4, 3, 10, 3], [8, 9, 6, 3]] },
  top: { line: [1, 2, 15, 2], bars: [[3, 2, 3, 10], [9, 2, 3, 6]] },
  vcenter: { line: [1, 8, 15, 8], bars: [[3, 3, 3, 10], [9, 5, 3, 6]] },
  bottom: { line: [1, 14, 15, 14], bars: [[3, 4, 3, 10], [9, 8, 3, 6]] },
  dh: { line: [8, 1, 8, 15], bars: [[1, 4, 3, 8], [6.5, 4, 3, 8], [12, 4, 3, 8]] },
  dv: { line: [1, 8, 15, 8], bars: [[4, 1, 8, 3], [4, 6.5, 8, 3], [4, 12, 8, 3]] },
  sh: { bars: [[1, 3, 3, 10], [6.5, 3, 3, 10], [12, 3, 3, 10]], line: [4, 8, 6.5, 8] },
  sv: { bars: [[3, 1, 10, 3], [3, 6.5, 10, 3], [3, 12, 10, 3]], line: [8, 4, 8, 6.5] },
};

function AIcon({ op }: { op: Op }) {
  const ic = ICONS[op];
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      {ic.bars.map((b, i) => (
        <rect key={i} x={b[0]} y={b[1]} width={b[2]} height={b[3]} fill="currentColor" opacity={0.85} />
      ))}
      {ic.line && <line x1={ic.line[0]} y1={ic.line[1]} x2={ic.line[2]} y2={ic.line[3]} stroke="var(--accent)" strokeWidth={1.2} />}
    </svg>
  );
}

const ALIGN: [Op, string][] = [
  ['left', 'Align left'],
  ['hcenter', 'Align horizontal center'],
  ['right', 'Align right'],
  ['top', 'Align top'],
  ['vcenter', 'Align vertical center'],
  ['bottom', 'Align bottom'],
];
const DIST: [Op, string][] = [
  ['dh', 'Distribute horizontal centers'],
  ['dv', 'Distribute vertical centers'],
  ['sh', 'Equal horizontal spacing'],
  ['sv', 'Equal vertical spacing'],
];

export function AlignPanel() {
  useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const [to, setTo] = useState<To>('selection');
  if (!sel.length) return null;
  const n = orderedSelection(vs().doc.vector, sel).length;
  const btn = (op: Op, title: string, min: number): ReactNode => (
    <button
      key={op}
      className="iconbtn"
      title={title}
      aria-label={title}
      disabled={n < min}
      onClick={() => run(op, to)}
    >
      <AIcon op={op} />
    </button>
  );
  return (
    <Section label="ALIGN">
      <div className="tabs small-tabs" role="group" aria-label="Align to">
        {([['selection', 'Selection'], ['artboard', 'Artboard'], ['key', 'Key object']] as [To, string][]).map(([k, label]) => (
          <button key={k} className={to === k ? 'tab on' : 'tab'} onClick={() => setTo(k)} title={k === 'key' ? 'The first selected item stays put' : undefined}>
            {label}
          </button>
        ))}
      </div>
      <div className="opts" data-testid="align-row">
        {ALIGN.map(([op, t]) => btn(op, t, 1))}
      </div>
      <div className="opts" data-testid="dist-row">
        {DIST.map(([op, t]) => btn(op, t, 3))}
      </div>
    </Section>
  );
}
