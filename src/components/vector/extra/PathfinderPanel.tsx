// Pathfinder: shape modes, pathfinders and a row of path commands.
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../../store';
import { pathsIn } from '../../../model/vector';
import { selectedItems } from '../../../vector/edit';
import { runCommand } from '../../../vector/commands';
import { PF_LABEL, PF_MIN, type PfOp } from '../../../vector/ops/pathfinder';
import { applyPathfinder, onSay, pfParams } from '../../../vector/ops/pf_apply';
import { NumField, Section } from '../VectorPanels';

const A = 'M3,3 H12 V12 H3 Z';
const B = 'M8,8 H17 V17 H8 Z';

const ICONS: Record<PfOp, { a: string; b?: string }> = {
  unite: { a: 'M3,3 H12 V8 H17 V17 H8 V12 H3 Z' },
  minusFront: { a: 'M3,3 H12 V8 H8 V12 H3 Z', b: 'M12,8 H17 V17 H8 V12' },
  intersect: { a: 'M8,8 H12 V12 H8 Z', b: `${A} ${B}` },
  exclude: { a: 'M3,3 H12 V8 H8 V12 H3 Z M12,8 H17 V17 H8 V12 H12 Z' },
  divide: { a: `${A} ${B}` },
  trim: { a: A, b: 'M12,8 H17 V17 H8 V12' },
  merge: { a: 'M3,3 H12 V8 H17 V17 H8 V12 H3 Z', b: 'M8,12 H12 V8' },
  crop: { a: 'M8,8 H12 V12 H8 Z', b: 'M3,3 H12 V8 M8,12 H3 V3 M12,8 H17 V17 H8 V12' },
  outline: { a: 'M3,3 H12 V8 M12,12 H3 V3', b: 'M8,17 H17 V8 M8,8 V17' },
  minusBack: { a: 'M12,8 H17 V17 H8 V12 H12 Z', b: A },
};

const SHAPE_MODES: PfOp[] = ['unite', 'minusFront', 'intersect', 'exclude'];
const PATHFINDERS: PfOp[] = ['divide', 'trim', 'merge', 'crop', 'outline', 'minusBack'];

function OpIcon({ op }: { op: PfOp }) {
  const i = ICONS[op];
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      {i.b && <path d={i.b} opacity={0.4} />}
      <path d={i.a} />
    </svg>
  );
}

function OpButton({ op, count }: { op: PfOp; count: number }) {
  const off = count < PF_MIN[op];
  return (
    <button
      className="opt"
      data-testid={`pf-${op}`}
      title={PF_LABEL[op]}
      disabled={off}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '5px 2px', minHeight: 0, opacity: off ? 0.4 : 1 }}
      onClick={() => applyPathfinder(op)}
    >
      <OpIcon op={op} />
      <span style={{ fontSize: 10 }}>{PF_LABEL[op]}</span>
    </button>
  );
}

const PATH_ROW: { id: string; label: string; title: string }[] = [
  { id: 'join', label: 'Join', title: 'Join (Ctrl+J)' },
  { id: 'average', label: 'Average', title: 'Average anchors (Ctrl+Alt+J)' },
  { id: 'makeCompound', label: 'Compound', title: 'Make compound path (Ctrl+8)' },
  { id: 'releaseCompound', label: 'Release', title: 'Release compound path (Ctrl+Alt+8)' },
  { id: 'makeClip', label: 'Mask', title: 'Make clipping mask (Ctrl+7)' },
  { id: 'releaseClip', label: 'Unmask', title: 'Release clipping mask (Ctrl+Alt+7)' },
  { id: 'outlineStroke', label: 'Outline stroke', title: 'Turn the stroke into a filled shape' },
  { id: 'smooth', label: 'Smooth', title: 'Make corners smooth' },
  { id: 'reversePath', label: 'Reverse', title: 'Reverse path direction' },
  { id: 'addAnchors', label: 'Add anchors', title: 'Add an anchor in the middle of every segment' },
  { id: 'divideBelow', label: 'Divide below', title: 'Cut the objects under the selected path' },
  { id: 'cleanUp', label: 'Clean up', title: 'Remove stray points and empty text' },
];

export function PathfinderPanel() {
  const doc = useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const [msg, setMsg] = useState('');
  const [off, setOff] = useState(pfParams.offset);
  const [join, setJoin] = useState(pfParams.join);
  const [tol, setTol] = useState(pfParams.simplify);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () =>
      onSay((m) => {
        setMsg(m);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setMsg(''), 3500);
      }),
    [],
  );

  void doc;
  if (!sel.length)
    return (
      <Section label="PATHFINDER">
        <div className="opts">
          <button className="opt" title="Remove paths with one anchor and empty text" data-testid="cmd-cleanUp" onClick={() => runCommand('cleanUp')}>
            Clean up
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </Section>
    );
  const count = selectedItems().flatMap(pathsIn).length;

  return (
    <Section label="PATHFINDER">
      <div className="muted small">Shape modes</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {SHAPE_MODES.map((op) => (
          <OpButton key={op} op={op} count={count} />
        ))}
      </div>
      <div className="muted small">Pathfinders</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {PATHFINDERS.map((op) => (
          <OpButton key={op} op={op} count={count} />
        ))}
      </div>
      <div className="muted small">Path</div>
      <div className="opts">
        {PATH_ROW.map((b) => (
          <button key={b.id} className="opt" title={b.title} data-testid={`cmd-${b.id}`} onClick={() => runCommand(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="vrow2">
        <NumField
          label="Offset"
          value={off}
          step={1}
          w={52}
          onChange={(n) => {
            pfParams.offset = n;
            setOff(n);
          }}
        />
        {(['round', 'miter', 'bevel'] as const).map((j) => (
          <button
            key={j}
            className={`seg${join === j ? ' on' : ''}`}
            onClick={() => {
              pfParams.join = j;
              setJoin(j);
            }}
          >
            {j}
          </button>
        ))}
        <button className="opt" data-testid="cmd-offsetPath" onClick={() => runCommand('offsetPath')}>
          Offset path
        </button>
      </div>
      <div className="vrow2">
        <NumField
          label="Simplify"
          value={tol}
          step={0.5}
          min={0.05}
          w={52}
          onChange={(n) => {
            pfParams.simplify = n;
            setTol(n);
          }}
        />
        <button className="opt" data-testid="cmd-simplify" onClick={() => runCommand('simplify')}>
          Simplify
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </Section>
  );
}
