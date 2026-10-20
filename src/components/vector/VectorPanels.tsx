// Vector mode panels: tool strip, tool bar, Layers, Appearance, Transform, Arrange.
import { useEffect, useState, type ReactNode } from 'react';
import { canRedo, canUndo, useStore } from '../../store';
import {
  findItem,
  getScaleStrokes,
  itemsBox,
  newLayer,
  orderedSelection,
  rotateAt,
  scaleAt,
  setScaleStrokes,
  translate,
  VBLENDS,
  type VCap,
  type VectorDoc,
  type VItem,
  type VJoin,
  type VLayer,
  type VPaint,
  type VStyle,
} from '../../model/vector';
import { fitToArtboard, zoomBy } from '../../viewport';
import { runCommand } from '../../vector/commands';
import { editStyle, selectedItems, shownStyle, transformSelection, vs } from '../../vector/edit';
import { toolById, VTOOLS } from '../../vector/tools';
import { Icon } from '../icons';
import { AlignPanel } from './extra/AlignPanel';
import { FilePanel } from './extra/FilePanel';
import { GradientPanel } from './extra/GradientPanel';
import { PathfinderPanel } from './extra/PathfinderPanel';
import { RepeatPanel } from './extra/RepeatPanel';
import { SwatchesPanel } from './extra/SwatchesPanel';

export function VIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Section({ label, children, right }: { label: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="group">
      <div className="titlerow">
        <h3 className="label">{label}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

const keyLabel = (k?: string) => (k ? k.replace('shift+', 'Shift+').toUpperCase().replace('SHIFT+', 'Shift+') : '');

export function VectorToolStrip() {
  const tool = useStore((s) => s.vtool);
  const setTool = useStore((s) => s.setVTool);
  let lastGroup = '';
  return (
    <nav className="toolstrip vtools" aria-label="Vector tools">
      {VTOOLS.map((t) => {
        const sep = lastGroup && lastGroup !== t.group;
        lastGroup = t.group;
        return (
          <span key={t.id} className={sep ? 'vtoolcell sep' : 'vtoolcell'}>
            <button
              className={tool === t.id ? 'tool on' : 'tool'}
              title={`${t.title}${t.key ? ` (${keyLabel(t.key)})` : ''}`}
              aria-label={t.title}
              aria-pressed={tool === t.id}
              data-tool={t.id}
              onClick={() => setTool(t.id)}
            >
              <VIcon d={t.icon} />
            </button>
          </span>
        );
      })}
    </nav>
  );
}

export function VectorBar() {
  const tool = toolById(useStore((s) => s.vtool));
  const k = useStore((s) => s.view.k);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const u = useStore(canUndo);
  const r = useStore(canRedo);
  const Opts = tool.options;
  return (
    <div className="canvasbar">
      <span className="toolname">
        {tool.title} <span className="mono muted">{keyLabel(tool.key)}</span>
      </span>
      {Opts ? <div className="vopts">{Opts()}</div> : <span className="muted small toolhelp">{tool.help}</span>}
      <div className="barend">
        <button className="iconbtn" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / 1.25)}>
          <Icon name="minus" size={16} />
        </button>
        <span className="mono small zoomval">{Math.round(k * 100)}%</span>
        <button className="iconbtn" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.25)}>
          <Icon name="plus" size={16} />
        </button>
        <button className="iconbtn" aria-label="Fit to screen" title="Fit to screen" onClick={() => fitToArtboard()}>
          <Icon name="fit" size={16} />
        </button>
        <span className="sep" />
        <button className="iconbtn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!u} onClick={undo}>
          <Icon name="undo" size={18} />
        </button>
        <button className="iconbtn" aria-label="Redo" title="Redo (Shift+Ctrl+Z)" disabled={!r} onClick={redo}>
          <Icon name="redo" size={18} />
        </button>
      </div>
    </div>
  );
}

// ---------- Layers ----------

const itemLabel = (it: VItem) => (it.kind === 'text' ? `"${it.text.slice(0, 18)}"` : it.name || it.kind);

function ItemRow({ it, depth, color }: { it: VItem; depth: number; color: string }) {
  const sel = useStore((s) => s.vsel.includes(it.id));
  const [open, setOpen] = useState(false);
  const toggle = (field: 'hidden' | 'locked') => vs().vstep((v) => {
    const f = findItem(v as VectorDoc, it.id);
    if (f) f.item[field] = !f.item[field];
  });
  return (
    <>
      <div className={sel ? 'layer vrow on' : 'layer vrow'} style={{ paddingLeft: 4 + depth * 14 }}>
        <span className="vdot" style={{ background: sel ? color : 'transparent', borderColor: color }} />
        {it.kind === 'group' ? (
          <button className="iconbtn sm" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen(!open)}>
            <Icon name={open ? 'down' : 'up'} size={12} />
          </button>
        ) : (
          <span style={{ width: 28 }} />
        )}
        <button
          className="layername"
          onClick={(e) => {
            const st = vs();
            st.setVSel(e.shiftKey ? (st.vsel.includes(it.id) ? st.vsel.filter((x) => x !== it.id) : [...st.vsel, it.id]) : [it.id]);
          }}
        >
          <span className="mono muted small">{it.kind === 'group' ? (it.clip ? 'CLIP' : it.repeat ? 'RPT' : 'GRP') : it.kind === 'path' ? (it.subs.length > 1 ? 'CMP' : 'PTH') : it.kind === 'text' ? 'TXT' : 'DIM'}</span>
          {itemLabel(it)}
        </button>
        <button className="iconbtn sm" aria-label={it.hidden ? 'Show' : 'Hide'} onClick={() => toggle('hidden')}>
          <Icon name={it.hidden ? 'eyeoff' : 'eye'} size={14} />
        </button>
        <button className="iconbtn sm" aria-label={it.locked ? 'Unlock' : 'Lock'} onClick={() => toggle('locked')} style={{ color: it.locked ? 'var(--text)' : undefined, opacity: it.locked ? 1 : 0.45 }}>
          <Icon name="lock" size={14} />
        </button>
      </div>
      {open && it.kind === 'group' && [...it.children].reverse().map((c) => <ItemRow key={c.id} it={c} depth={depth + 1} color={color} />)}
    </>
  );
}

function LayerBlock({ l, active }: { l: VLayer; active: boolean }) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const st = vs;
  const patch = (p: Partial<VLayer>) => st().vstep((v) => {
    const x = v.layers.find((y) => y.id === l.id);
    if (x) Object.assign(x, p);
  });
  return (
    <div className="vlayer">
      <div className={active ? 'layer on' : 'layer'}>
        <span className="vbar" style={{ background: l.color }} />
        <button className="iconbtn sm" aria-label={open ? 'Collapse layer' : 'Expand layer'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'down' : 'up'} size={12} />
        </button>
        {editing ? (
          <input
            className="layerinput"
            autoFocus
            defaultValue={l.name}
            onBlur={(e) => {
              patch({ name: e.target.value || l.name });
              setEditing(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        ) : (
          <button className="layername" onClick={() => st().setVLayer(l.id)} onDoubleClick={() => setEditing(true)}>
            <b>{l.name}</b> <span className="muted small">{l.items.length}</span>
          </button>
        )}
        <button className="iconbtn sm" aria-label={l.visible ? 'Hide layer' : 'Show layer'} onClick={() => patch({ visible: !l.visible })}>
          <Icon name={l.visible ? 'eye' : 'eyeoff'} size={14} />
        </button>
        <button className="iconbtn sm" aria-label={l.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => patch({ locked: !l.locked })} style={{ color: l.locked ? 'var(--text)' : undefined, opacity: l.locked ? 1 : 0.45 }}>
          <Icon name="lock" size={14} />
        </button>
      </div>
      {open && [...l.items].reverse().map((it) => <ItemRow key={it.id} it={it} depth={1} color={l.color} />)}
    </div>
  );
}

export function LayersPanel() {
  const layers = useStore((s) => s.doc.vector.layers);
  const vlayer = useStore((s) => s.vlayer);
  const active = layers.find((l) => l.id === vlayer) ?? layers[layers.length - 1];
  const move = (dir: 1 | -1) => {
    const i = layers.findIndex((l) => l.id === active.id);
    const j = i + dir;
    if (j < 0 || j >= layers.length) return;
    vs().vstep((v) => {
      const [l] = v.layers.splice(i, 1);
      v.layers.splice(j, 0, l);
    });
  };
  /** Move the selection into the active layer. */
  const collect = () => {
    const st = vs();
    const ids = orderedSelection(st.doc.vector, st.vsel);
    st.vstep((v) => {
      const items: VItem[] = [];
      for (const id of ids) {
        const f = findItem(v as VectorDoc, id);
        if (!f) continue;
        items.push(f.item as VItem);
        f.list.splice(f.index, 1);
      }
      v.layers.find((l) => l.id === active.id)?.items.push(...(items as never[]));
    });
  };
  return (
    <Section
      label="LAYERS"
      right={
        <span style={{ display: 'flex', gap: 2 }}>
          <button className="iconbtn sm" title="New layer (Ctrl+L)" aria-label="New layer" onClick={() => runCommand('newLayer')}>
            <Icon name="plus" size={14} />
          </button>
          <button className="iconbtn sm" title="Move layer up" aria-label="Move layer up" onClick={() => move(1)}>
            <Icon name="up" size={14} />
          </button>
          <button className="iconbtn sm" title="Move layer down" aria-label="Move layer down" onClick={() => move(-1)}>
            <Icon name="down" size={14} />
          </button>
          <button className="iconbtn sm" title="Move selection to this layer" aria-label="Move selection to this layer" onClick={collect}>
            <Icon name="copy" size={14} />
          </button>
          <button
            className="iconbtn sm"
            title="Delete layer"
            aria-label="Delete layer"
            onClick={() =>
              vs().vstep((v) => {
                v.layers = v.layers.filter((l) => l.id !== active.id);
                if (!v.layers.length) v.layers.push(newLayer(1));
              })
            }
          >
            <Icon name="trash" size={14} />
          </button>
        </span>
      }
    >
      <div className="layers vlayers">
        {[...layers].reverse().map((l) => (
          <LayerBlock key={l.id} l={l} active={l.id === active.id} />
        ))}
      </div>
    </Section>
  );
}

export function VectorLeftPanel() {
  return (
    <aside className="panel left">
      <LayersPanel />
      <FilePanel />
    </aside>
  );
}

// ---------- Appearance ----------

export const paintColor = (p: VPaint | null) => (p?.kind === 'solid' ? p.color : p ? p.stops[0]?.color ?? '#000000' : null);

export function PaintField({ label, paint, onChange, testid }: { label: string; paint: VPaint | null; onChange: (p: VPaint | null) => void; testid?: string }) {
  const c = paintColor(paint);
  const [hex, setHex] = useState(c ?? '');
  useEffect(() => setHex(c ?? ''), [c]);
  const grad = paint && paint.kind !== 'solid';
  return (
    <div className="paintfield" data-testid={testid}>
      <span className="small" style={{ width: 44 }}>{label}</span>
      <label className={paint ? 'pswatch' : 'pswatch none'} style={{ background: grad ? `linear-gradient(90deg, ${(paint as { stops: { color: string }[] }).stops.map((s) => s.color).join(',')})` : c ?? undefined }}>
        <input
          type="color"
          value={c ?? '#000000'}
          onChange={(e) => onChange({ kind: 'solid', color: e.target.value.toUpperCase() })}
          aria-label={`${label} color`}
        />
      </label>
      <input
        className="hexin small"
        value={paint ? (grad ? 'Gradient' : hex) : 'None'}
        disabled={!paint || !!grad}
        onChange={(e) => {
          setHex(e.target.value);
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange({ kind: 'solid', color: e.target.value.toUpperCase() });
        }}
        aria-label={`${label} hex`}
      />
      <button className={paint ? 'seg' : 'seg on'} title="None (/)" onClick={() => onChange(paint ? null : { kind: 'solid', color: label === 'Fill' ? '#FFFFFF' : '#141414' })}>
        {paint ? 'None' : 'Add'}
      </button>
    </div>
  );
}

const DASHES: { name: string; d: number[] }[] = [
  { name: 'Solid', d: [] },
  { name: 'Topstitch', d: [3, 2] },
  { name: 'Dashed', d: [8, 4] },
  { name: 'Dotted', d: [0.5, 3] },
  { name: 'Coverstitch', d: [5, 2, 1, 2] },
];

export function NumField({ label, value, onChange, step = 1, min, max, suffix, w = 64 }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string; w?: number }) {
  const [txt, setTxt] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setTxt(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => {
    const n = Number(txt);
    if (Number.isFinite(n)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
    else setTxt(String(Math.round(value * 100) / 100));
  };
  return (
    <label className="numfield">
      <span className="muted small">{label}</span>
      <input
        className="hexin small mono"
        style={{ width: w }}
        value={txt}
        inputMode="decimal"
        onChange={(e) => setTxt(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = Math.round((value + (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1)) * 100) / 100;
            onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
          }
        }}
        aria-label={label}
      />
      {suffix && <span className="muted small">{suffix}</span>}
    </label>
  );
}

export function useShownStyle(): VStyle {
  useStore((s) => s.doc.vector);
  useStore((s) => s.vsel);
  useStore((s) => s.vstyle);
  return shownStyle();
}

function AppearancePanel() {
  const s = useShownStyle();
  const set = (fn: (x: VStyle) => void, key?: string) => editStyle((x) => fn(x as VStyle), key);
  const dashName = DASHES.find((d) => d.d.join(',') === s.dash.join(','))?.name ?? 'Custom';
  return (
    <Section label="APPEARANCE">
      <PaintField label="Fill" testid="fill" paint={s.fill} onChange={(p) => set((x) => void (x.fill = p))} />
      <PaintField label="Stroke" testid="stroke" paint={s.stroke} onChange={(p) => set((x) => void (x.stroke = p))} />
      <div className="vrow2">
        <NumField label="Weight" value={s.width} step={0.1} min={0} onChange={(n) => set((x) => void (x.width = n), 'width')} />
        <NumField label="Opacity" value={Math.round(s.opacity * 100)} min={0} max={100} suffix="%" w={48} onChange={(n) => set((x) => void (x.opacity = n / 100), 'opacity')} />
      </div>
      <div className="opts">
        {DASHES.map((d) => (
          <button key={d.name} className={dashName === d.name ? 'opt on' : 'opt'} onClick={() => set((x) => void (x.dash = d.d))}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="vrow2">
        <div className="tabs small-tabs" role="group" aria-label="Cap">
          {(['butt', 'round', 'square'] as VCap[]).map((c) => (
            <button key={c} className={s.cap === c ? 'tab on' : 'tab'} onClick={() => set((x) => void (x.cap = c))}>
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <div className="tabs small-tabs" role="group" aria-label="Join">
          {(['miter', 'round', 'bevel'] as VJoin[]).map((c) => (
            <button key={c} className={s.join === c ? 'tab on' : 'tab'} onClick={() => set((x) => void (x.join = c))}>
              {c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="vrow2">
        <label className="numfield">
          <span className="muted small">Blend</span>
          <select className="hexin small" value={s.blend} onChange={(e) => set((x) => void (x.blend = e.target.value as VStyle['blend']))}>
            {VBLENDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <button className="seg" title="Even odd fill punches holes where shapes overlap" onClick={() => set((x) => void (x.fillRule = x.fillRule === 'evenodd' ? 'nonzero' : 'evenodd'))}>
          {s.fillRule === 'evenodd' ? 'Even odd' : 'Non zero'}
        </button>
      </div>
    </Section>
  );
}

// ---------- Transform ----------

function TransformPanel() {
  useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const items = selectedItems();
  const b = itemsBox(items);
  const [ss, setSs] = useState(getScaleStrokes());
  const [rot, setRot] = useState(0);
  if (!sel.length || !b) return null;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return (
    <Section label="TRANSFORM">
      <div className="vgrid4">
        <NumField label="X" value={b.x} onChange={(n) => transformSelection(translate(n - b.x, 0))} />
        <NumField label="Y" value={b.y} onChange={(n) => transformSelection(translate(0, n - b.y))} />
        <NumField label="W" value={b.w} min={0.1} onChange={(n) => b.w > 0 && transformSelection(scaleAt(n / b.w, 1, b.x, b.y))} />
        <NumField label="H" value={b.h} min={0.1} onChange={(n) => b.h > 0 && transformSelection(scaleAt(1, n / b.h, b.x, b.y))} />
      </div>
      <div className="vrow2">
        <NumField label="Rotate" value={rot} suffix="°" w={48} onChange={(n) => setRot(n)} />
        <button className="seg" onClick={() => rot && transformSelection(rotateAt(rot, cx, cy))}>
          Apply
        </button>
        <button className="seg" title="Flip horizontal" onClick={() => transformSelection(scaleAt(-1, 1, cx, cy))}>
          Flip H
        </button>
        <button className="seg" title="Flip vertical" onClick={() => transformSelection(scaleAt(1, -1, cx, cy))}>
          Flip V
        </button>
      </div>
      <label className="small vcheck">
        <input
          type="checkbox"
          checked={ss}
          onChange={(e) => {
            setScaleStrokes(e.target.checked);
            setSs(e.target.checked);
          }}
        />
        Scale strokes
      </label>
    </Section>
  );
}

function ArrangePanel() {
  const n = useStore((s) => s.vsel.length);
  if (!n) return null;
  const B = ({ id, label }: { id: string; label: string }) => (
    <button className="opt" onClick={() => runCommand(id)}>
      {label}
    </button>
  );
  return (
    <Section label="ARRANGE">
      <div className="opts">
        <B id="group" label="Group" />
        <B id="ungroup" label="Ungroup" />
        <B id="front" label="To front" />
        <B id="forward" label="Forward" />
        <B id="backward" label="Backward" />
        <B id="back" label="To back" />
        <B id="duplicate" label="Duplicate" />
        <B id="lock" label="Lock" />
        <B id="hide" label="Hide" />
        <B id="delete" label="Delete" />
      </div>
    </Section>
  );
}

function SelectionTitle() {
  const v = useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  const ids = orderedSelection(v, sel);
  const first = ids.length ? findItem(v, ids[0])?.item : null;
  return (
    <div className="titlerow">
      <span className="title">{ids.length === 0 ? 'Nothing selected' : ids.length === 1 && first ? itemLabel(first) : `${ids.length} objects`}</span>
    </div>
  );
}

export function VectorRightPanel() {
  return (
    <aside className="panel right">
      <SelectionTitle />
      <AppearancePanel />
      <SwatchesPanel />
      <GradientPanel />
      <TransformPanel />
      <AlignPanel />
      <PathfinderPanel />
      <RepeatPanel />
      <ArrangePanel />
    </aside>
  );
}
