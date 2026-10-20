// Path geometry: split, join, reverse, smooth, simplify, offset and outline stroke. Pure functions on VSub / VPath.
import { corner, hasIn, hasOut, makePath, type VJoin, type VNode, type VPath, type VStyle, type VSub } from '../../model/vector';
import { ensurePaper } from './paperScope';
import { areaOf, closedGeom, geomToPath, MIN_AREA } from './pf_geom';
import { flattenSub, strokeSubs, type Pt } from './pf_stroke';

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const cloneSub = (s: VSub): VSub => structuredClone(s);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------- split and anchors ----------

/** Split the segment from node a to node b at t. Returns the three nodes that replace a and b. */
export function splitSegment(a: VNode, b: VNode, t: number): [VNode, VNode, VNode] {
  if (!hasOut(a) && !hasIn(b)) {
    const m = corner(r3(lerp(a.x, b.x, t)), r3(lerp(a.y, b.y, t)));
    return [{ ...a }, m, { ...b }];
  }
  const p0 = { x: a.x, y: a.y }, p1 = { x: a.ox, y: a.oy }, p2 = { x: b.ix, y: b.iy }, p3 = { x: b.x, y: b.y };
  const L = (p: Pt, q: Pt): Pt => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
  const A = L(p0, p1), B = L(p1, p2), C = L(p2, p3), D = L(A, B), E = L(B, C), F = L(D, E);
  const na: VNode = { ...a, ox: r3(A.x), oy: r3(A.y) };
  const mid: VNode = { x: r3(F.x), y: r3(F.y), ix: r3(D.x), iy: r3(D.y), ox: r3(E.x), oy: r3(E.y), smooth: true };
  const nb: VNode = { ...b, ix: r3(C.x), iy: r3(C.y) };
  return [na, mid, nb];
}

/** Insert a node into segment seg (from node seg to the next) at t. Returns the new sub and the index of the new node. */
export function insertAt(sub: VSub, seg: number, t: number): { sub: VSub; index: number } {
  const s = cloneSub(sub);
  const n = s.nodes.length;
  const j = (seg + 1) % n;
  const [na, mid, nb] = splitSegment(s.nodes[seg], s.nodes[j], t);
  s.nodes[seg] = na;
  s.nodes[j] = nb;
  if (j === 0) {
    s.nodes.push(mid);
    return { sub: s, index: s.nodes.length - 1 };
  }
  s.nodes.splice(seg + 1, 0, mid);
  return { sub: s, index: seg + 1 };
}

/** Add an anchor at the middle of every segment. */
export function addAnchors(sub: VSub): VSub {
  const out: VNode[] = [];
  const n = sub.nodes.length;
  const count = sub.closed ? n : n - 1;
  const nodes = sub.nodes.map((x) => ({ ...x }));
  const mids: VNode[] = [];
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const [na, mid, nb] = splitSegment(nodes[i], nodes[j], 0.5);
    nodes[i] = na;
    nodes[j] = nb;
    mids.push(mid);
  }
  for (let i = 0; i < n; i++) {
    out.push(nodes[i]);
    if (i < count) out.push(mids[i]);
  }
  return { nodes: out, closed: sub.closed };
}

/** Cut a sub path at node index k. A closed path opens there, an open path becomes two. */
export function openAt(sub: VSub, k: number): VSub[] {
  const n = sub.nodes.length;
  if (sub.closed) {
    const rot = [...sub.nodes.slice(k), ...sub.nodes.slice(0, k)].map((x) => ({ ...x }));
    const first = rot[0], last = { ...rot[0] };
    const prev = sub.nodes[(k + n - 1) % n];
    // the end copy keeps the incoming handle of the original anchor, the start copy keeps the outgoing one
    first.ix = first.x;
    first.iy = first.y;
    last.ix = sub.nodes[k].ix;
    last.iy = sub.nodes[k].iy;
    last.ox = last.x;
    last.oy = last.y;
    void prev;
    return [{ nodes: [...rot, last], closed: false }];
  }
  if (k <= 0 || k >= n - 1) return [cloneSub(sub)];
  const a = sub.nodes.slice(0, k + 1).map((x) => ({ ...x }));
  const b = sub.nodes.slice(k).map((x) => ({ ...x }));
  a[a.length - 1].ox = a[a.length - 1].x;
  a[a.length - 1].oy = a[a.length - 1].y;
  b[0].ix = b[0].x;
  b[0].iy = b[0].y;
  return [{ nodes: a, closed: false }, { nodes: b, closed: false }];
}

// ---------- reverse, join, close ----------

export function reverseSub(sub: VSub): VSub {
  const nodes = [...sub.nodes].reverse().map((n) => ({ ...n, ix: n.ox, iy: n.oy, ox: n.ix, oy: n.iy }));
  return { nodes, closed: sub.closed };
}

const dist = (a: VNode, b: VNode) => Math.hypot(a.x - b.x, a.y - b.y);

/** Close an open sub path. If the ends sit on top of each other they merge into one anchor. */
export function closeSub(sub: VSub): VSub {
  if (sub.closed || sub.nodes.length < 2) return sub;
  const s = cloneSub(sub);
  const f = s.nodes[0], l = s.nodes[s.nodes.length - 1];
  if (s.nodes.length > 2 && dist(f, l) < 0.5) {
    f.ix = l.ix;
    f.iy = l.iy;
    s.nodes.pop();
  }
  s.closed = true;
  return s;
}

/** Join two open sub paths at the chosen ends into one. */
export function joinSubs(a: VSub, aEnd: 'start' | 'end', b: VSub, bEnd: 'start' | 'end'): VSub {
  const A = aEnd === 'start' ? reverseSub(a) : cloneSub(a);
  const B = bEnd === 'end' ? reverseSub(b) : cloneSub(b);
  const l = A.nodes[A.nodes.length - 1], f = B.nodes[0];
  if (dist(l, f) < 0.5) {
    l.ox = f.ox;
    l.oy = f.oy;
    if (f.smooth === false) l.smooth = false;
    B.nodes.shift();
  }
  return { nodes: [...A.nodes, ...B.nodes], closed: false };
}

// ---------- smooth ----------

/** Give corner anchors smooth handles (Catmull Rom style). only limits it to some anchors. */
export function smoothSub(sub: VSub, only?: Set<number>): VSub {
  const s = cloneSub(sub);
  const n = s.nodes.length;
  if (n < 2) return s;
  const src = sub.nodes;
  s.nodes.forEach((nd, i) => {
    if (only && !only.has(i)) return;
    if (nd.smooth && (hasIn(nd) || hasOut(nd))) return;
    const hasPrev = s.closed || i > 0, hasNext = s.closed || i < n - 1;
    const p = src[(i + n - 1) % n], q = src[(i + 1) % n];
    let tx: number, ty: number;
    if (hasPrev && hasNext) {
      tx = q.x - p.x;
      ty = q.y - p.y;
    } else if (hasNext) {
      tx = q.x - nd.x;
      ty = q.y - nd.y;
    } else {
      tx = nd.x - p.x;
      ty = nd.y - p.y;
    }
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    if (hasPrev) {
      const d = Math.hypot(nd.x - p.x, nd.y - p.y) / 3;
      nd.ix = r3(nd.x - tx * d);
      nd.iy = r3(nd.y - ty * d);
    }
    if (hasNext) {
      const d = Math.hypot(q.x - nd.x, q.y - nd.y) / 3;
      nd.ox = r3(nd.x + tx * d);
      nd.oy = r3(nd.y + ty * d);
    }
    nd.smooth = true;
  });
  return s;
}

// ---------- simplify ----------

const CORNER_DEG = 28;

/** Refit a sub path with fewer anchors. Corners stay corners, runs of curve get refitted. */
export function simplifySub(sub: VSub, tol: number): VSub {
  const P = ensurePaper();
  const poly = flattenSub(sub, 1.5);
  const pts = poly.pts;
  const n = pts.length;
  if (n < 3) return sub;
  const isCorner = pts.map((p, i) => {
    if (!poly.anchor[i]) return false;
    if (!sub.closed && (i === 0 || i === n - 1)) return true;
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const a1 = Math.atan2(p.y - a.y, p.x - a.x), a2 = Math.atan2(b.y - p.y, b.x - p.x);
    let d = Math.abs(a1 - a2);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return (d * 180) / Math.PI > CORNER_DEG;
  });
  const fit = (run: Pt[]): VNode[] => {
    if (run.length <= 2) return run.map((p) => corner(p.x, p.y));
    const path = new P.Path({ segments: run.map((p) => [p.x, p.y]), insert: false });
    path.simplify(tol);
    return nodesOf(path);
  };
  let corners = isCorner.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  // a smooth closed path has no corners, so break it at two opposite points and smooth those after
  const artificial = !corners.length && sub.closed;
  if (artificial) corners = [0, n >> 1];
  if (corners.length < 2 && !sub.closed) return sub;
  const runs: Pt[][] = [];
  if (sub.closed) {
    for (let c = 0; c < corners.length; c++) {
      const from = corners[c], to = corners[(c + 1) % corners.length];
      const run: Pt[] = [];
      for (let i = from; ; i = (i + 1) % n) {
        run.push(pts[i]);
        if (i === to && run.length > 1) break;
        if (run.length > n + 1) break;
      }
      runs.push(run);
    }
  } else {
    for (let c = 0; c < corners.length - 1; c++) runs.push(pts.slice(corners[c], corners[c + 1] + 1));
  }
  const nodes: VNode[] = [];
  const at: number[] = [0];
  runs.forEach((run, ri) => {
    const part = fit(run);
    if (ri === 0) nodes.push(...part);
    else {
      const prev = nodes[nodes.length - 1];
      prev.ox = part[0].ox;
      prev.oy = part[0].oy;
      nodes.push(...part.slice(1));
    }
    at.push(nodes.length - 1);
  });
  if (sub.closed) {
    const last = nodes[nodes.length - 1], first = nodes[0];
    first.ix = last.ix;
    first.iy = last.iy;
    nodes.pop();
  }
  if (artificial) {
    corners.forEach((c, k) => {
      const nd = nodes[at[k]];
      if (!nd) return;
      const a = pts[(c + n - 1) % n], b = pts[(c + 1) % n];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const tx = (b.x - a.x) / tl, ty = (b.y - a.y) / tl;
      const li = Math.hypot(nd.ix - nd.x, nd.iy - nd.y), lo = Math.hypot(nd.ox - nd.x, nd.oy - nd.y);
      nd.ix = r3(nd.x - tx * li);
      nd.iy = r3(nd.y - ty * li);
      nd.ox = r3(nd.x + tx * lo);
      nd.oy = r3(nd.y + ty * lo);
      nd.smooth = true;
    });
  }
  if (nodes.length < 2 || nodes.length >= sub.nodes.length) return sub;
  return { nodes, closed: sub.closed };
}

function nodesOf(path: paper.Path): VNode[] {
  return path.segments.map((sg) => {
    const x = sg.point.x, y = sg.point.y;
    const hi = sg.handleIn, ho = sg.handleOut;
    const flat = hi.length < 1e-3 && ho.length < 1e-3;
    return {
      x: r3(x),
      y: r3(y),
      ix: r3(flat ? x : x + hi.x),
      iy: r3(flat ? y : y + hi.y),
      ox: r3(flat ? x : x + ho.x),
      oy: r3(flat ? y : y + ho.y),
    };
  });
}

// ---------- offset and outline stroke ----------

/** Fit curves back onto polygon output so results are not hundreds of straight bits. */
export function tidy(subs: VSub[], tol = 0.2): VSub[] {
  return subs.map((s) => {
    try {
      return simplifySub(s, tol);
    } catch {
      return s;
    }
  });
}

/** Offset a path by d (positive grows the shape). Null when nothing is left. */
export function offsetPath(p: VPath, d: number, join: VJoin = 'round'): VPath | null {
  if (!d || !p.subs.length) return null;
  const P = ensurePaper();
  const w = Math.abs(d) * 2;
  const opts = { width: w, cap: join === 'round' ? ('round' as const) : ('butt' as const), join, miterLimit: 4 };
  const closed = p.subs.filter((s) => s.closed && s.nodes.length >= 3);
  const open = p.subs.filter((s) => !s.closed && s.nodes.length >= 2);
  let result: paper.PathItem | null = null;
  if (closed.length) {
    const shape = closedGeom({ ...p, subs: closed });
    const ring = strokeSubs(closed, opts);
    if (ring) result = d > 0 ? shape.unite(ring, { insert: false }) : shape.subtract(ring, { insert: false });
    else result = shape;
  }
  const line = open.length ? strokeSubs(open, opts) : null;
  if (line) result = result ? result.unite(line, { insert: false }) : line;
  if (!result || areaOf(result) <= MIN_AREA) return null;
  const out = geomToPath(result, structuredClone(p.style), `${p.name} offset`);
  if (!out) return null;
  const curvy = p.subs.some((s) => s.nodes.some((n) => hasIn(n) || hasOut(n)));
  if (curvy || join === 'round') out.subs = tidy(out.subs);
  void P;
  return out;
}

/** The stroke of a path as filled outline paths. Empty when the path has no stroke. */
export function outlineStroke(p: VPath): VPath[] {
  const st = p.style;
  if (!st.stroke || st.width <= 0) return [];
  const geom = strokeSubs(p.subs, { width: st.width, cap: st.cap, join: st.join, dash: st.dash, miterLimit: 4 });
  if (!geom) return [];
  const style: VStyle = { ...structuredClone(st), fill: structuredClone(st.stroke), stroke: null, dash: [], width: 0 };
  const out = geomToPath(geom, style, `${p.name} outline`);
  if (!out) return [];
  const curvy = p.subs.some((s) => s.nodes.some((n) => hasIn(n) || hasOut(n)));
  if (curvy || st.join === 'round' || st.cap === 'round') out.subs = tidy(out.subs);
  return [out];
}

/** Fresh path from sub paths, convenience for callers. */
export const pathFrom = (subs: VSub[], style: VStyle, name: string) => makePath(subs, style, name);
