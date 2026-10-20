// Curve helpers shared by the anchor, pencil and blend tools.
import { hasIn, hasOut, segments, type VNode, type VSub } from '../../model/vector';

export type Pt = { x: number; y: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function cubicAt(a: VNode, b: VNode, t: number): Pt {
  const u = 1 - t;
  const f = (p0: number, p1: number, p2: number, p3: number) => u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
  return { x: f(a.x, a.ox, b.ix, b.x), y: f(a.y, a.oy, b.iy, b.y) };
}

/** Split one segment exactly at t (de Casteljau). Returns the new versions of both ends and the new anchor. */
export function splitSeg(a: VNode, b: VNode, t: number): { a: VNode; m: VNode; b: VNode } {
  if (!hasOut(a) && !hasIn(b)) {
    const x = r3(lerp(a.x, b.x, t)), y = r3(lerp(a.y, b.y, t));
    return { a: { ...a }, m: { x, y, ix: x, iy: y, ox: x, oy: y }, b: { ...b } };
  }
  const l = (p: Pt, q: Pt): Pt => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  const p0 = { x: a.x, y: a.y }, p1 = { x: a.ox, y: a.oy }, p2 = { x: b.ix, y: b.iy }, p3 = { x: b.x, y: b.y };
  const q0 = l(p0, p1), q1 = l(p1, p2), q2 = l(p2, p3);
  const r0 = l(q0, q1), r1 = l(q1, q2);
  const m = l(r0, r1);
  return {
    a: { ...a, ox: r3(q0.x), oy: r3(q0.y) },
    m: { x: r3(m.x), y: r3(m.y), ix: r3(r0.x), iy: r3(r0.y), ox: r3(r1.x), oy: r3(r1.y), smooth: true },
    b: { ...b, ix: r3(q2.x), iy: r3(q2.y) },
  };
}

export interface Near {
  /** Segment index: from nodes[seg] to nodes[(seg + 1) % n]. */
  seg: number;
  t: number;
  d: number;
  pt: Pt;
}

/** Nearest point on a sub path: sample, then refine. */
export function nearestOnSub(sub: VSub, p: Pt): Near | null {
  const segs = segments(sub);
  let best: Near | null = null;
  const dist = (a: VNode, b: VNode, t: number) => {
    const q = cubicAt(a, b, t);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  segs.forEach(([a, b], seg) => {
    const N = 32;
    let bt = 0, bd = Infinity;
    for (let i = 0; i <= N; i++) {
      const d = dist(a, b, i / N);
      if (d < bd) {
        bd = d;
        bt = i / N;
      }
    }
    let lo = Math.max(0, bt - 1 / N), hi = Math.min(1, bt + 1 / N);
    for (let i = 0; i < 24; i++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      if (dist(a, b, m1) < dist(a, b, m2)) hi = m2;
      else lo = m1;
    }
    const t = (lo + hi) / 2;
    const d = dist(a, b, t);
    if (!best || d < best.d) best = { seg, t, d, pt: cubicAt(a, b, t) };
  });
  return best;
}

function segLen(a: VNode, b: VNode) {
  let len = 0, prev = { x: a.x, y: a.y };
  for (let i = 1; i <= 8; i++) {
    const q = cubicAt(a, b, i / 8);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    prev = q;
  }
  return len;
}

/** Add anchors on the longest segments (exact splits) until the sub has n nodes. */
export function resampleSub(sub: VSub, n: number): VSub {
  const nodes = sub.nodes.map((x) => ({ ...x }));
  while (nodes.length < n && nodes.length > 1) {
    const cnt = nodes.length;
    const last = sub.closed ? cnt : cnt - 1;
    let bi = 0, bl = -1;
    for (let i = 0; i < last; i++) {
      const l = segLen(nodes[i], nodes[(i + 1) % cnt]);
      if (l > bl) {
        bl = l;
        bi = i;
      }
    }
    const j = (bi + 1) % cnt;
    const r = splitSeg(nodes[bi], nodes[j], 0.5);
    nodes[bi] = r.a;
    nodes[j] = r.b;
    nodes.splice(bi + 1, 0, r.m);
  }
  return { closed: sub.closed, nodes };
}
