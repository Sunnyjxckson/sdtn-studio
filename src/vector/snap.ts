// Snapping: grid, anchor points and smart guides (line up with other items' edges and centers).
import { itemBox, walkItems, type VectorDoc } from '../model/vector';

export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

let guides: Guide[] = [];
const subs = new Set<() => void>();
export const getGuides = () => guides;
export function setGuides(g: Guide[]) {
  if (g.length === 0 && guides.length === 0) return;
  guides = g;
  subs.forEach((f) => f());
}
export function onGuides(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

interface Targets {
  pts: { x: number; y: number }[];
  xs: number[];
  ys: number[];
}

let cache: { v: VectorDoc; ex: string; t: Targets } | null = null;

function targets(v: VectorDoc, exclude: string[]): Targets {
  const ex = exclude.join(',');
  if (cache && cache.v === v && cache.ex === ex) return cache.t;
  const skip = new Set(exclude);
  const t: Targets = { pts: [], xs: [], ys: [] };
  const hiddenUnder = new Set<string>();
  walkItems(v, (it, layer) => {
    if (!layer.visible || it.hidden || skip.has(it.id)) {
      if (it.kind === 'group') it.children.forEach((c) => hiddenUnder.add(c.id));
      return;
    }
    if (hiddenUnder.has(it.id)) {
      if (it.kind === 'group') it.children.forEach((c) => hiddenUnder.add(c.id));
      return;
    }
    if (it.kind === 'path') for (const s of it.subs) for (const n of s.nodes) t.pts.push({ x: n.x, y: n.y });
    if (it.kind === 'dim') t.pts.push({ x: it.ax, y: it.ay }, { x: it.bx, y: it.by });
    const b = it.kind === 'group' ? null : itemBox(it);
    if (b) {
      t.xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      t.ys.push(b.y, b.y + b.h / 2, b.y + b.h);
      t.pts.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    }
  });
  // the croquis center line and artboard edges are always useful
  t.xs.push(300, 0, 600);
  t.ys.push(20, 1000);
  cache = { v, ex, t };
  return t;
}

export interface SnapOpts {
  grid: boolean;
  gridSize: number;
  snap: boolean;
  smart: boolean;
  /** Snap distance in canvas units. */
  tol: number;
}

/** Snap a point. Shows smart guide lines while it is snapped. */
export function snapPoint(v: VectorDoc, p: { x: number; y: number }, o: SnapOpts, exclude: string[] = []): { x: number; y: number } {
  if (!o.snap) {
    setGuides([]);
    return p;
  }
  const t = targets(v, exclude);
  // anchors win
  let best: { x: number; y: number } | null = null;
  let bd = o.tol;
  for (const q of t.pts) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bd) {
      bd = d;
      best = q;
    }
  }
  if (best) {
    setGuides([]);
    return { x: best.x, y: best.y };
  }
  let x = p.x, y = p.y;
  const g: Guide[] = [];
  if (o.smart) {
    let dx = o.tol, dy = o.tol, gx: number | null = null, gy: number | null = null;
    for (const xx of t.xs) if (Math.abs(xx - p.x) < dx) { dx = Math.abs(xx - p.x); gx = xx; }
    for (const yy of t.ys) if (Math.abs(yy - p.y) < dy) { dy = Math.abs(yy - p.y); gy = yy; }
    if (gx !== null) { x = gx; g.push({ x1: gx, y1: -2000, x2: gx, y2: 3000 }); }
    if (gy !== null) { y = gy; g.push({ x1: -2000, y1: gy, x2: 3000, y2: gy }); }
  }
  if (o.grid) {
    if (!g.some((l) => l.x1 === l.x2)) x = Math.round(x / o.gridSize) * o.gridSize;
    if (!g.some((l) => l.y1 === l.y2)) y = Math.round(y / o.gridSize) * o.gridSize;
  }
  setGuides(g);
  return { x, y };
}

/** Constrain a point to 45 degree steps from an origin (Shift). */
export function constrain45(o: { x: number; y: number }, p: { x: number; y: number }) {
  const dx = p.x - o.x, dy = p.y - o.y;
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy) * Math.cos(Math.atan2(dy, dx) - a);
  return { x: o.x + Math.cos(a) * len, y: o.y + Math.sin(a) * len };
}
