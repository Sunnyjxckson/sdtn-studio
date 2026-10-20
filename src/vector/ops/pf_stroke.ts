// Stroke geometry: turns centre lines into filled outlines (outline stroke, offset, eraser and knife ribbons).
import { hasIn, hasOut, segments, type VCap, type VJoin, type VSub } from '../../model/vector';
import { ensurePaper } from './paperScope';
import { uniteTree, type PItem } from './pf_geom';

export interface Pt {
  x: number;
  y: number;
}

/** A flattened sub path. anchor[i] says the point is a real anchor (not a point along a curve). */
export interface Poly {
  pts: Pt[];
  anchor: boolean[];
  closed: boolean;
}

export interface StrokeOpts {
  width: number;
  cap: VCap;
  join: VJoin;
  dash?: number[];
  miterLimit?: number;
}

const near = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

/** Flatten a sub path into a polyline. step is the target spacing along curves. */
export function flattenSub(s: VSub, step = 3): Poly {
  const pts: Pt[] = [];
  const anchor: boolean[] = [];
  const push = (p: Pt, a: boolean) => {
    if (pts.length && near(pts[pts.length - 1], p)) {
      anchor[anchor.length - 1] = anchor[anchor.length - 1] || a;
      return;
    }
    pts.push(p);
    anchor.push(a);
  };
  const segs = segments(s);
  segs.forEach(([a, b]) => {
    push({ x: a.x, y: a.y }, true);
    if (hasOut(a) || hasIn(b)) {
      const len = Math.hypot(a.ox - a.x, a.oy - a.y) + Math.hypot(b.ix - a.ox, b.iy - a.oy) + Math.hypot(b.x - b.ix, b.y - b.iy);
      const n = Math.max(4, Math.min(120, Math.ceil(len / step)));
      for (let i = 1; i < n; i++) {
        const t = i / n, u = 1 - t;
        const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
        push({ x: w0 * a.x + w1 * a.ox + w2 * b.ix + w3 * b.x, y: w0 * a.y + w1 * a.oy + w2 * b.iy + w3 * b.y }, false);
      }
    }
  });
  if (!s.closed && s.nodes.length) {
    const l = s.nodes[s.nodes.length - 1];
    push({ x: l.x, y: l.y }, true);
  }
  if (s.closed && pts.length > 1 && near(pts[0], pts[pts.length - 1])) {
    pts.pop();
    anchor.pop();
  }
  return { pts, anchor, closed: s.closed && pts.length > 2 };
}

/** Split a polyline into dash pieces (open polylines). */
function dashPoly(poly: Poly, dash: number[]): Poly[] {
  const d = dash.map((x) => Math.max(0.01, x));
  const pat = d.length % 2 ? [...d, ...d] : d;
  const pts = poly.closed ? [...poly.pts, poly.pts[0]] : poly.pts;
  const out: Poly[] = [];
  let cur: Pt[] = [];
  let idx = 0, left = pat[0], on = true;
  const flush = () => {
    if (cur.length > 1) out.push({ pts: cur, anchor: cur.map(() => false), closed: false });
    cur = [];
  };
  if (on) cur.push(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let len = Math.hypot(b.x - a.x, b.y - a.y);
    while (len > left) {
      const t = left / len;
      const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (on) {
        cur.push(m);
        flush();
      } else cur = [m];
      on = !on;
      idx = (idx + 1) % pat.length;
      len -= left;
      left = pat[idx];
      a = m;
    }
    left -= len;
    if (on) cur.push(b);
  }
  flush();
  return out;
}

function orient(p: paper.Path) {
  p.clockwise = true;
  return p;
}

/** Convex polygons (quads, wedges, caps) that together cover the stroke. */
function polysFor(poly: Poly, o: StrokeOpts): paper.Path[] {
  const P = ensurePaper();
  const h = Math.max(0.005, o.width / 2);
  const out: paper.Path[] = [];
  const poligon = (...pp: Pt[]) => {
    const p = new P.Path({ segments: pp.map((q) => [q.x, q.y]), closed: true, insert: false });
    if (Math.abs(p.area) > 1e-9) out.push(orient(p));
  };
  const circle = (c: Pt) => out.push(orient(new P.Path.Circle({ center: [c.x, c.y], radius: h, insert: false })));
  const pts = poly.pts;
  const n = pts.length;
  if (n === 0) return out;
  if (n === 1) {
    if (o.cap === 'round') circle(pts[0]);
    else if (o.cap === 'square') poligon({ x: pts[0].x - h, y: pts[0].y - h }, { x: pts[0].x + h, y: pts[0].y - h }, { x: pts[0].x + h, y: pts[0].y + h }, { x: pts[0].x - h, y: pts[0].y + h });
    return out;
  }
  const segCount = poly.closed ? n : n - 1;
  const dirs: Pt[] = [];
  for (let i = 0; i < segCount; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    dirs.push({ x: (b.x - a.x) / l, y: (b.y - a.y) / l });
  }
  for (let i = 0; i < segCount; i++) {
    const a = pts[i], b = pts[(i + 1) % n], u = dirs[i];
    const nx = -u.y * h, ny = u.x * h;
    poligon({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny });
  }
  const limit = o.miterLimit ?? 4;
  const joinAt = (vi: number, u0: Pt, u1: Pt) => {
    const v = pts[vi];
    const cross = u0.x * u1.y - u0.y * u1.x;
    const dot = u0.x * u1.x + u0.y * u1.y;
    if (Math.abs(cross) < 1e-6 && dot > 0) return;
    const s = cross > 0 ? -1 : 1;
    const n0 = { x: -u0.y, y: u0.x }, n1 = { x: -u1.y, y: u1.x };
    const A = { x: v.x + s * n0.x * h, y: v.y + s * n0.y * h };
    const B = { x: v.x + s * n1.x * h, y: v.y + s * n1.y * h };
    const isAnchor = poly.anchor[vi];
    const type = isAnchor ? o.join : 'miter';
    if (type === 'round') return circle(v);
    if (type === 'miter') {
      const k = 1 + n0.x * n1.x + n0.y * n1.y;
      if (k > 1e-6) {
        const m = { x: (n0.x + n1.x) / k, y: (n0.y + n1.y) / k };
        if (Math.hypot(m.x, m.y) <= limit) return poligon(v, A, { x: v.x + s * m.x * h, y: v.y + s * m.y * h }, B);
      }
    }
    poligon(v, A, B);
  };
  if (poly.closed) for (let i = 0; i < n; i++) joinAt(i, dirs[(i + n - 1) % n], dirs[i]);
  else {
    for (let i = 1; i < n - 1; i++) joinAt(i, dirs[i - 1], dirs[i]);
    const cap = (p: Pt, u: Pt) => {
      if (o.cap === 'round') return circle(p);
      if (o.cap === 'square') {
        const nx = -u.y * h, ny = u.x * h;
        poligon({ x: p.x + nx, y: p.y + ny }, { x: p.x + nx + u.x * h, y: p.y + ny + u.y * h }, { x: p.x - nx + u.x * h, y: p.y - ny + u.y * h }, { x: p.x - nx, y: p.y - ny });
      }
    };
    cap(pts[0], { x: -dirs[0].x, y: -dirs[0].y });
    cap(pts[n - 1], dirs[segCount - 1]);
  }
  return out;
}

/** The filled outline of a set of polylines, united into clean geometry. Null when empty. */
export function strokePolys(polys: Poly[], o: StrokeOpts): PItem | null {
  let live = polys;
  if (o.dash && o.dash.some((x) => x > 0)) live = polys.flatMap((p) => (p.pts.length > 1 ? dashPoly(p, o.dash!) : [p]));
  const parts = live.flatMap((p) => polysFor(p, o));
  if (!parts.length) return null;
  try {
    return uniteTree(parts);
  } catch {
    return null;
  }
}

/** Outline of sub paths with stroke settings. */
export function strokeSubs(subs: VSub[], o: StrokeOpts): PItem | null {
  return strokePolys(
    subs.filter((s) => s.nodes.length > 0).map((s) => flattenSub(s)),
    o,
  );
}

/** A hairline ribbon through free points, used by the Knife and Divide Objects Below. */
export function ribbon(points: Pt[], width = 0.06): PItem | null {
  return strokePolys([{ pts: points, anchor: points.map(() => false), closed: false }], { width, cap: 'butt', join: 'bevel' });
}
