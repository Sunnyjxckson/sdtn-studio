// Add Anchor Point (=), Delete Anchor Point (-), Anchor Point / convert (Shift+C).
import { findItem, hasIn, hasOut, type VectorDoc, type VNode } from '../../model/vector';
import type { NodeRef } from '../../store';
import { selectedPaths, vdoc, vs } from '../edit';
import { nearestOnSub, splitSeg, type Pt } from './t_geom';
import type { Hit, ToolCtx, VToolDef } from './types';

/** Select a path (and show all of its anchors) when it is clicked while not selected. Returns true if it did. */
function pickPath(hit: Hit): boolean {
  if (hit?.kind !== 'item') return false;
  const st = vs();
  if (st.vsel.includes(hit.top)) return false;
  st.setVSel([hit.top]);
  showAll();
  return true;
}

function showAll() {
  const refs: NodeRef[] = [];
  for (const p of selectedPaths()) p.subs.forEach((s, si) => s.nodes.forEach((_n, i) => refs.push({ id: p.id, s: si, i })));
  vs().setVNodes(refs);
}

// ---------- Add ----------

export const addAnchorTool: VToolDef = {
  id: 'addanchor',
  title: 'Add Anchor Point',
  key: '=',
  icon: 'M4,15 C7,4 13,4 16,15 M10,7 V11 M8,9 H12',
  help: 'Click a segment of the selected path to add an anchor. The shape does not change.',
  group: 'draw',
  decor: 'nodes',
  cursor: 'copy',
  snaps: false,
  down(e, hit, ctx) {
    if (pickPath(hit)) return;
    const p: Pt = { x: e.rx, y: e.ry };
    let best: { id: string; s: number; seg: number; t: number; d: number } | null = null;
    for (const path of selectedPaths()) {
      path.subs.forEach((sub, s) => {
        const n = nearestOnSub(sub, p);
        if (n && (!best || n.d < best.d)) best = { id: path.id, s, seg: n.seg, t: n.t, d: n.d };
      });
    }
    const b = best as { id: string; s: number; seg: number; t: number; d: number } | null;
    if (!b || b.d * ctx.k > 10) return;
    vs().vstep((v) => {
      const f = findItem(v as VectorDoc, b.id);
      if (f?.item.kind !== 'path') return;
      const nodes = f.item.subs[b.s].nodes as VNode[];
      const j = (b.seg + 1) % nodes.length;
      const r = splitSeg({ ...nodes[b.seg] }, { ...nodes[j] }, b.t);
      Object.assign(nodes[b.seg], r.a);
      Object.assign(nodes[j], r.b);
      nodes.splice(b.seg + 1, 0, r.m);
    });
    vs().setVNodes([{ id: b.id, s: b.s, i: b.seg + 1 }]);
  },
};

// ---------- Delete ----------

export const deleteAnchorTool: VToolDef = {
  id: 'delanchor',
  title: 'Delete Anchor Point',
  key: '-',
  icon: 'M4,15 C7,4 13,4 16,15 M8,9 H12',
  help: 'Click an anchor of the selected path to remove it. The path stays open or closed.',
  group: 'draw',
  decor: 'nodes',
  cursor: 'crosshair',
  snaps: false,
  down(_e, hit) {
    if (pickPath(hit)) return;
    if (hit?.kind !== 'node') return;
    const { id, s, i } = hit;
    vs().vstep((v) => {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind !== 'path') return;
      const subs = f.item.subs;
      const sub = subs[s];
      if (!sub) return;
      sub.nodes.splice(i, 1);
      if (sub.nodes.length < 2) subs.splice(s, 1);
      if (!subs.length) f.list.splice(f.index, 1);
    });
    vs().setVNodes([]);
    if (!findItem(vdoc(), id)) vs().setVSel(vs().vsel.filter((x) => x !== id));
    else showAll();
  },
};

// ---------- Convert ----------

type Mode =
  | { t: 'pull'; ref: NodeRef; had: boolean; started: boolean }
  | { t: 'handle'; ref: NodeRef; side: 'in' | 'out'; started: boolean };
let mode: Mode | null = null;

const nodeOf = (v: VectorDoc, r: NodeRef): VNode | null => {
  const f = findItem(v, r.id);
  return f?.item.kind === 'path' ? (f.item.subs[r.s]?.nodes[r.i] as VNode | undefined) ?? null : null;
};

export const convertAnchorTool: VToolDef = {
  id: 'convertanchor',
  title: 'Anchor Point',
  key: 'shift+c',
  icon: 'M4,16 L10,5 L16,16 M10,5 m-1.5,0 a1.5,1.5 0 1,0 3,0 a1.5,1.5 0 1,0 -3,0',
  help: 'Click a smooth anchor to make it a corner. Drag a corner anchor to pull out smooth handles. Drag a handle to move only that handle.',
  group: 'draw',
  decor: 'nodes',
  cursor: 'crosshair',
  snaps: false,
  down(_e, hit) {
    if (pickPath(hit)) return;
    if (hit?.kind === 'node') {
      const n = nodeOf(vdoc(), hit);
      if (!n) return;
      const r = { id: hit.id, s: hit.s, i: hit.i };
      vs().setVNodes([r]);
      mode = { t: 'pull', ref: r, had: hasIn(n) || hasOut(n), started: false };
    } else if (hit?.kind === 'handle') {
      mode = { t: 'handle', ref: { id: hit.id, s: hit.s, i: hit.i }, side: hit.side, started: false };
    }
  },
  move(e, ctx) {
    const m = mode;
    if (!m) return;
    const n = nodeOf(vdoc(), m.ref);
    if (!n) return;
    if (!m.started) {
      const at = m.t === 'pull' ? n : { x: m.side === 'in' ? n.ix : n.ox, y: m.side === 'in' ? n.iy : n.oy };
      if (Math.hypot(e.rx - at.x, e.ry - at.y) * ctx.k < 3) return;
      m.started = true;
      vs().checkpoint();
    }
    const r = m.ref;
    vs().vedit((v) => {
      const d = nodeOf(v, r);
      if (!d) return;
      if (m.t === 'pull') {
        d.ox = e.rx;
        d.oy = e.ry;
        d.ix = 2 * d.x - e.rx;
        d.iy = 2 * d.y - e.ry;
        d.smooth = true;
      } else {
        if (m.side === 'in') {
          d.ix = e.rx;
          d.iy = e.ry;
        } else {
          d.ox = e.rx;
          d.oy = e.ry;
        }
        d.smooth = false;
      }
    });
  },
  up() {
    const m = mode;
    mode = null;
    if (!m || m.started || m.t !== 'pull' || !m.had) return;
    // a plain click on a smooth anchor: drop its handles
    const r = m.ref;
    vs().vstep((v) => {
      const d = nodeOf(v, r);
      if (!d) return;
      d.ix = d.x;
      d.iy = d.y;
      d.ox = d.x;
      d.oy = d.y;
      d.smooth = false;
    });
  },
  cancel(_ctx: ToolCtx) {
    mode = null;
  },
};

export const anchorTools: VToolDef[] = [addAnchorTool, deleteAnchorTool, convertAnchorTool];
