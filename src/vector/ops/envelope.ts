// Envelope Distort: a 4 x 4 control mesh (a bicubic Bezier patch) over the selection.
// The warp is applied to the real paths live, so there is nothing to expand at the end.
import { create } from 'zustand';
import {
  findItem,
  hasIn,
  hasOut,
  itemsBox,
  orderedSelection,
  pathsIn,
  type Box,
  type VectorDoc,
  type VItem,
  type VNode,
  type VPath,
  type VSub,
} from '../../model/vector';
import { selectedItems, vs } from '../edit';

export interface MeshPt {
  x: number;
  y: number;
}
export type Grid = MeshPt[][];
export type EnvPreset = 'arc' | 'bulge' | 'flag' | 'wave' | 'fish' | 'rise';
export const ENV_PRESETS: { id: EnvPreset; label: string }[] = [
  { id: 'arc', label: 'Arc' },
  { id: 'bulge', label: 'Bulge' },
  { id: 'flag', label: 'Flag' },
  { id: 'wave', label: 'Wave' },
  { id: 'fish', label: 'Fish' },
  { id: 'rise', label: 'Rise' },
];

export const identityGrid = (b: Box): Grid =>
  [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => ({ x: b.x + (b.w * c) / 3, y: b.y + (b.h * r) / 3 })));

/** The mesh for a preset. Amount is 0 to 1. */
export function presetGrid(id: EnvPreset, amt: number, b: Box): Grid {
  const g = identityGrid(b);
  const cy = b.y + b.h / 2;
  const fishScale = [0.4, 0.7, -0.2, -0.8];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const u = c / 3, v = r / 3;
      const p = g[r][c];
      const inner = r > 0 && r < 3 && c > 0 && c < 3;
      switch (id) {
        case 'arc':
          p.y -= amt * b.h * 0.5 * Math.sin(Math.PI * u);
          break;
        case 'bulge':
          if (inner) {
            p.x += Math.sign(u - 0.5) * amt * b.w * 0.2;
            p.y += Math.sign(v - 0.5) * amt * b.h * 0.2;
          } else if (r === 0 && c > 0 && c < 3) p.y -= amt * b.h * 0.15;
          else if (r === 3 && c > 0 && c < 3) p.y += amt * b.h * 0.15;
          else if (c === 0 && r > 0 && r < 3) p.x -= amt * b.w * 0.15;
          else if (c === 3 && r > 0 && r < 3) p.x += amt * b.w * 0.15;
          break;
        case 'flag':
          p.y += amt * b.h * 0.4 * u * Math.sin(2 * Math.PI * u);
          break;
        case 'wave':
          p.y += amt * b.h * 0.25 * Math.sin(2 * Math.PI * u);
          p.x += amt * b.w * 0.12 * Math.sin(2 * Math.PI * v);
          break;
        case 'fish':
          p.y = cy + (p.y - cy) * Math.max(0.1, 1 + amt * fishScale[c]);
          break;
        case 'rise':
          p.y -= amt * b.h * 0.6 * Math.sin(Math.PI * u) * (1 - v);
          break;
      }
    }
  }
  return g;
}

const bern = (t: number): [number, number, number, number] => {
  const m = 1 - t;
  return [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
};

/** Where a point of the original box lands on the warped surface. */
function surface(grid: Grid, b: Box) {
  return (x: number, y: number): MeshPt => {
    const u = b.w ? (x - b.x) / b.w : 0;
    const v = b.h ? (y - b.y) / b.h : 0;
    const bu = bern(u), bv = bern(v);
    let ox = 0, oy = 0;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const w = bv[r] * bu[c];
        ox += grid[r][c].x * w;
        oy += grid[r][c].y * w;
      }
    return { x: ox, y: oy };
  };
}

function warpSub(s: VSub, map: (x: number, y: number) => MeshPt): VSub {
  const n = s.nodes.length;
  if (n < 2) return s;
  const segCount = s.closed ? n : n - 1;
  const out: VNode[] = [];
  const mk = (p: MeshPt): VNode => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y });
  for (let i = 0; i < segCount; i++) {
    const a = s.nodes[i], b = s.nodes[(i + 1) % n];
    let p1 = { x: a.ox, y: a.oy }, p2 = { x: b.ix, y: b.iy };
    const p0 = { x: a.x, y: a.y }, p3 = { x: b.x, y: b.y };
    if (!hasOut(a) && !hasIn(b)) {
      p1 = { x: p0.x + (p3.x - p0.x) / 3, y: p0.y + (p3.y - p0.y) / 3 };
      p2 = { x: p0.x + ((p3.x - p0.x) * 2) / 3, y: p0.y + ((p3.y - p0.y) * 2) / 3 };
    }
    const poly = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
    const K = Math.max(2, Math.min(14, Math.ceil(poly / 28)));
    const at = (t: number) => {
      const w = bern(t);
      return { x: w[0] * p0.x + w[1] * p1.x + w[2] * p2.x + w[3] * p3.x, y: w[0] * p0.y + w[1] * p1.y + w[2] * p2.y + w[3] * p3.y };
    };
    const d = (t: number) => {
      const m = 1 - t;
      return {
        x: 3 * (m * m * (p1.x - p0.x) + 2 * m * t * (p2.x - p1.x) + t * t * (p3.x - p2.x)),
        y: 3 * (m * m * (p1.y - p0.y) + 2 * m * t * (p2.y - p1.y) + t * t * (p3.y - p2.y)),
      };
    };
    for (let k = 0; k < K; k++) {
      const t0 = k / K, t1 = (k + 1) / K;
      const P0 = at(t0), P1 = at(t1);
      const D0 = d(t0), D1 = d(t1);
      const outH = map(P0.x + D0.x / (3 * K), P0.y + D0.y / (3 * K));
      const inH = map(P1.x - D1.x / (3 * K), P1.y - D1.y / (3 * K));
      if (k === 0 && i === 0) out.push(mk(map(P0.x, P0.y)));
      const cur = out[out.length - 1];
      cur.ox = outH.x;
      cur.oy = outH.y;
      const last = k === K - 1;
      const isWrap = last && s.closed && i === segCount - 1;
      if (isWrap) {
        out[0].ix = inH.x;
        out[0].iy = inH.y;
      } else {
        const nn = mk(map(P1.x, P1.y));
        nn.ix = inH.x;
        nn.iy = inH.y;
        out.push(nn);
      }
    }
  }
  return { nodes: out, closed: s.closed };
}

function warpItem(it: VItem, map: (x: number, y: number) => MeshPt) {
  if (it.kind === 'group') return void it.children.forEach((c) => warpItem(c, map));
  if (it.kind !== 'path') return;
  it.subs = it.subs.map((s) => warpSub(s, map));
}

// ---------- session state ----------

interface EnvState {
  active: boolean;
  ids: string[];
  box: Box | null;
  grid: Grid;
  originals: Record<string, VItem>;
  preset: EnvPreset | null;
  amount: number;
  msg: string;
  set: (p: Partial<EnvState>) => void;
}

export const useEnvelope = create<EnvState>((set) => ({
  active: false,
  ids: [],
  box: null,
  grid: [],
  originals: {},
  preset: null,
  amount: 0.5,
  msg: '',
  set: (p) => set(p),
}));

const env = () => useEnvelope.getState();

function applyWarp() {
  const e = env();
  if (!e.box) return;
  const map = surface(e.grid, e.box);
  vs().vedit((v) => {
    for (const id of e.ids) {
      const f = findItem(v as VectorDoc, id);
      const orig = e.originals[id];
      if (!f || !orig) continue;
      const c = structuredClone(orig);
      warpItem(c, map);
      (f.list as VItem[])[f.index] = c;
    }
  });
}

/** Begin an envelope on the selection and show the mesh. */
export function startEnvelope(): boolean {
  const st = vs();
  const items = selectedItems();
  const paths: VPath[] = items.flatMap(pathsIn);
  const box = itemsBox(items);
  if (!paths.length || !box || box.w < 1 || box.h < 1) {
    env().set({ msg: 'Select a path or group first' });
    return false;
  }
  const ids = orderedSelection(st.doc.vector, st.vsel).filter((id) => items.some((i) => i.id === id));
  const originals: Record<string, VItem> = {};
  for (const id of ids) {
    const f = findItem(st.doc.vector, id);
    if (f) originals[id] = structuredClone(f.item);
  }
  st.checkpoint();
  env().set({ active: true, ids, box, grid: identityGrid(box), originals, preset: null, msg: '' });
  st.setVTool('envelope');
  return true;
}

export function setEnvPreset(id: EnvPreset, amount = env().amount) {
  const e = env();
  if (!e.active || !e.box) return;
  env().set({ preset: id, amount, grid: presetGrid(id, amount, e.box) });
  applyWarp();
}

export function moveMeshPoint(r: number, c: number, x: number, y: number) {
  const e = env();
  if (!e.active) return;
  const grid = e.grid.map((row) => row.map((p) => ({ ...p })));
  grid[r][c] = { x, y };
  env().set({ grid, preset: null });
  applyWarp();
}

export function resetEnvelope() {
  const e = env();
  if (!e.active || !e.box) return;
  env().set({ grid: identityGrid(e.box), preset: null });
  applyWarp();
}

/** Keep the warped paths and close the mesh. */
export function expandEnvelope() {
  if (!env().active) return;
  env().set({ active: false, originals: {}, ids: [], box: null, grid: [], preset: null, msg: 'Expanded to paths' });
}

/** Put the originals back and close the mesh. */
export function cancelEnvelope() {
  const e = env();
  if (!e.active) return;
  vs().vedit((v) => {
    for (const id of e.ids) {
      const f = findItem(v as VectorDoc, id);
      if (f && e.originals[id]) (f.list as VItem[])[f.index] = structuredClone(e.originals[id]);
    }
  });
  env().set({ active: false, originals: {}, ids: [], box: null, grid: [], preset: null, msg: '' });
}
