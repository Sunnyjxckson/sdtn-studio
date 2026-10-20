// Live repeats: mirror, radial and grid, for symmetric flats.
import { current, isDraft } from 'immer';
import { useStore } from '../../../store';
import { newId } from '../../../model/garment';
import {
  cloneItem,
  findItem,
  itemBox,
  itemsBox,
  orderedSelection,
  repeatMats,
  transformItem,
  type VectorDoc,
  type VGroup,
  type VItem,
  type VRepeat,
} from '../../../model/vector';
import { removeIds, selectedItems, vs } from '../../../vector/edit';
import { NumField, Section } from '../VectorPanels';

const plain = <T,>(x: T): T => structuredClone(isDraft(x) ? (current(x as never) as T) : x);
const r1 = (n: number) => Math.round(n * 100) / 100;

function defaults(kind: VRepeat['kind'], items: VItem[]): VRepeat {
  const b = itemsBox(items.map((i) => (i.kind === 'group' ? { ...i, repeat: undefined } : i))) ?? { x: 300, y: 500, w: 100, h: 100 };
  if (kind === 'mirror') return { kind: 'mirror', axis: 'v', at: 300 };
  if (kind === 'radial') return { kind: 'radial', cx: r1(b.x + b.w / 2), cy: r1(b.y + b.h / 2), count: 6 };
  return { kind: 'grid', cols: 3, rows: 3, gx: r1(b.w + 10), gy: r1(b.h + 10) };
}

function apply(kind: VRepeat['kind']) {
  const st = vs();
  const items = selectedItems();
  if (!items.length) return;
  const rep = defaults(kind, items);
  const only = items.length === 1 && items[0].kind === 'group' && !items[0].repeat ? items[0] : null;
  if (only) {
    st.vstep((v) => {
      const f = findItem(v as VectorDoc, only.id);
      if (f?.item.kind === 'group') f.item.repeat = rep;
    });
    return;
  }
  const ids = orderedSelection(st.doc.vector, st.vsel);
  const gid = newId();
  st.vstep((v) => {
    const top = findItem(v as VectorDoc, ids[ids.length - 1]);
    if (!top) return;
    const g: VGroup = { kind: 'group', id: gid, name: `${kind[0].toUpperCase()}${kind.slice(1)} repeat`, children: [], repeat: rep };
    top.list.splice(top.index + 1, 0, g as never);
    const moved = removeIds(v, ids);
    const gf = findItem(v as VectorDoc, gid);
    if (gf?.item.kind === 'group') gf.item.children.push(...(moved as never[]));
  });
  st.setVSel([gid]);
}

function patch(id: string, fn: (r: VRepeat) => void) {
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, id);
    if (f?.item.kind === 'group' && f.item.repeat) fn(f.item.repeat);
  });
}

function release(id: string) {
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, id);
    if (f?.item.kind === 'group') f.item.repeat = undefined;
  });
}

/** Turn the copies into real items. */
function expand(id: string) {
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, id);
    if (f?.item.kind !== 'group' || !f.item.repeat) return;
    const g = f.item as VGroup;
    const mats = repeatMats(g.repeat!);
    g.repeat = undefined;
    if (g.clip) {
      // keep each clipped copy whole: wrap the original and its copies
      const orig = plain(g) as VGroup;
      const copies = mats.map((m) => {
        const c = cloneItem(orig);
        transformItem(c, m);
        return c;
      });
      g.clip = undefined;
      g.name = 'Expanded';
      g.children = [orig, ...copies] as never[];
      return;
    }
    const base = g.children.map((c) => plain(c) as VItem);
    for (const m of mats) {
      for (const c of base) {
        const k = cloneItem(c);
        transformItem(k, m);
        g.children.push(k as never);
      }
    }
  });
}

export function RepeatPanel() {
  useStore((s) => s.doc.vector);
  const sel = useStore((s) => s.vsel);
  if (!sel.length) return null;
  const items = selectedItems();
  if (!items.length) return null;
  const one = items.length === 1 && items[0].kind === 'group' && items[0].repeat ? items[0] : null;
  if (!one) {
    return (
      <Section label="REPEAT">
        <div className="opts">
          <button className="opt" title="Mirror across the center line" onClick={() => apply('mirror')}>Mirror</button>
          <button className="opt" title="Copies around a center" onClick={() => apply('radial')}>Radial</button>
          <button className="opt" title="Rows and columns of copies" onClick={() => apply('grid')}>Grid</button>
        </div>
      </Section>
    );
  }
  const r = one.repeat!;
  const id = one.id;
  const base = itemBox(one, false);
  return (
    <Section label={`REPEAT, ${r.kind.toUpperCase()}`}>
      {r.kind === 'mirror' && (
        <div className="vrow2">
          <div className="tabs small-tabs" role="group" aria-label="Mirror axis">
            <button className={r.axis === 'v' ? 'tab on' : 'tab'} title="Mirror left to right" onClick={() => patch(id, (x) => x.kind === 'mirror' && void (x.axis = 'v'))}>Vertical</button>
            <button className={r.axis === 'h' ? 'tab on' : 'tab'} title="Mirror top to bottom" onClick={() => patch(id, (x) => x.kind === 'mirror' && void (x.axis = 'h'))}>Horizontal</button>
          </div>
          <NumField label="At" value={r.at} onChange={(n) => patch(id, (x) => x.kind === 'mirror' && void (x.at = n))} />
          {base && (
            <button className="opt" title="Put the axis at the edge of the art" onClick={() => patch(id, (x) => x.kind === 'mirror' && void (x.at = r1(x.axis === 'v' ? base.x + base.w : base.y + base.h)))}>
              To edge
            </button>
          )}
        </div>
      )}
      {r.kind === 'radial' && (
        <div className="vgrid4">
          <NumField label="Count" value={r.count} min={2} max={64} onChange={(n) => patch(id, (x) => x.kind === 'radial' && void (x.count = Math.round(n)))} />
          <NumField label="Center X" value={r.cx} onChange={(n) => patch(id, (x) => x.kind === 'radial' && void (x.cx = n))} />
          <NumField label="Center Y" value={r.cy} onChange={(n) => patch(id, (x) => x.kind === 'radial' && void (x.cy = n))} />
        </div>
      )}
      {r.kind === 'grid' && (
        <div className="vgrid4">
          <NumField label="Cols" value={r.cols} min={1} max={50} onChange={(n) => patch(id, (x) => x.kind === 'grid' && void (x.cols = Math.round(n)))} />
          <NumField label="Rows" value={r.rows} min={1} max={50} onChange={(n) => patch(id, (x) => x.kind === 'grid' && void (x.rows = Math.round(n)))} />
          <NumField label="Gap X" value={r.gx} onChange={(n) => patch(id, (x) => x.kind === 'grid' && void (x.gx = n))} />
          <NumField label="Gap Y" value={r.gy} onChange={(n) => patch(id, (x) => x.kind === 'grid' && void (x.gy = n))} />
        </div>
      )}
      <div className="opts">
        <button className="opt" title="Turn the copies into real items" onClick={() => expand(id)}>Expand</button>
        <button className="opt" title="Remove the repeat, keep the originals" onClick={() => release(id)}>Release repeat</button>
      </div>
    </Section>
  );
}
