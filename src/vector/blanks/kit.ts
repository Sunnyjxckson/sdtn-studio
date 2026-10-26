// Drawing kit for the Blanks library. Geometry is written in inches (x across from the center line,
// y down) and baked to canvas units at PX_IN_V per inch, the same scale the Measure tool defaults to.
import { newId, PX_IN_V } from '../../model/garment';
import { defaultStyle, makePath, ellipseSub, type VGroup, type VItem, type VNode, type VPath, type VStyle, type VSub, type VText } from '../../model/vector';

export const S = PX_IN_V;
export type Pt = [number, number];

export const INK = '#1C1C1C';
export const GREY = '#D9D9D9';

export interface Over {
  fill?: string | null;
  stroke?: string | null;
  w?: number;
  dash?: number[];
  cap?: VStyle['cap'];
  join?: VStyle['join'];
}

export function mkStyle(o: Over = {}): VStyle {
  const s = defaultStyle();
  s.fill = o.fill === undefined ? null : o.fill ? { kind: 'solid', color: o.fill } : null;
  s.stroke = o.stroke === undefined ? { kind: 'solid', color: INK } : o.stroke ? { kind: 'solid', color: o.stroke } : null;
  s.width = o.w ?? 1.3;
  s.dash = o.dash ?? [];
  s.cap = o.cap ?? 'round';
  s.join = o.join ?? 'round';
  return s;
}

const nd = (x: number, y: number): VNode => ({ x, y, ix: x, iy: y, ox: x, oy: y });

/** Parse an absolute path in inches: M L C Q H V Z. Returns canvas units. */
export function P(d: string): VSub {
  const tok = d.match(/[MLCQHVZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const nodes: VNode[] = [];
  let closed = false;
  let i = 0;
  const num = () => parseFloat(tok[i++]) * S;
  let cmd = '';
  while (i < tok.length) {
    if (/[A-Z]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
    if (cmd === 'Z') {
      closed = true;
      continue;
    }
    const last = nodes[nodes.length - 1];
    if (cmd === 'M' || cmd === 'L') {
      nodes.push(nd(num(), num()));
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'H') {
      nodes.push(nd(num(), last.y));
    } else if (cmd === 'V') {
      nodes.push(nd(last.x, num()));
    } else if (cmd === 'C') {
      const c1x = num(), c1y = num(), c2x = num(), c2y = num(), x = num(), y = num();
      last.ox = c1x; last.oy = c1y;
      const n = nd(x, y);
      n.ix = c2x; n.iy = c2y;
      nodes.push(n);
    } else if (cmd === 'Q') {
      const qx = num(), qy = num(), x = num(), y = num();
      last.ox = last.x + (2 / 3) * (qx - last.x); last.oy = last.y + (2 / 3) * (qy - last.y);
      const n = nd(x, y);
      n.ix = x + (2 / 3) * (qx - x); n.iy = y + (2 / 3) * (qy - y);
      nodes.push(n);
    } else i++;
  }
  // a closing line back to the start that repeats the first point is just the close
  if (closed && nodes.length > 2) {
    const a = nodes[0], b = nodes[nodes.length - 1];
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) {
      a.ix = b.ix; a.iy = b.iy;
      nodes.pop();
    }
  }
  return { nodes, closed };
}

const mirNode = (n: VNode): VNode => ({ x: -n.x, y: n.y, ix: -n.ox, iy: n.oy, ox: -n.ix, oy: n.iy });

/** Reflect a path across the center line. */
export function mir(s: VSub): VSub {
  return { closed: s.closed, nodes: s.nodes.map((n) => ({ x: -n.x, y: n.y, ix: -n.ix, iy: n.iy, ox: -n.ox, oy: n.oy })) };
}

/** A path and its mirror image. */
export const both = (d: string): VSub[] => {
  const a = P(d);
  return [a, mir(a)];
};

/** The right half from the top center to the bottom center becomes a closed, symmetric outline. */
export function full(d: string): VSub {
  const h = P(d).nodes;
  const first = h[0], last = h[h.length - 1];
  first.ix = -first.ox; first.iy = first.oy;
  last.ox = -last.ix; last.oy = last.iy;
  const rest = h.slice(1, -1).reverse().map(mirNode);
  return { closed: true, nodes: [...h, ...rest] };
}

/** Straight polyline, inches. */
export const poly = (pts: Pt[], closed = false): VSub => ({ closed, nodes: pts.map(([x, y]) => nd(x * S, y * S)) });
export const circ = (x: number, y: number, r: number): VSub => ellipseSub(x * S, y * S, r * S, r * S);
export const oval = (x: number, y: number, rx: number, ry: number): VSub => ellipseSub(x * S, y * S, rx * S, ry * S);

export const path = (name: string, subs: VSub | VSub[], o: Over = {}): VPath => makePath(Array.isArray(subs) ? subs : [subs], mkStyle(o), name);
export const grp = (name: string, children: VItem[]): VGroup => ({ kind: 'group', id: newId(), name, children });

export const text = (t: string, x: number, y: number, size: number): VText => ({
  kind: 'text',
  id: newId(),
  name: 'Label',
  x,
  y,
  text: t,
  size,
  font: 'IBM Plex Sans',
  weight: 600,
  anchor: 'middle',
  rot: 0,
  letter: 0,
  style: mkStyle({ fill: INK, stroke: null }),
});

// ---------- looks ----------

export const SEAM: Over = { fill: null, w: 0.9 };
export const STITCH: Over = { fill: null, w: 0.75, dash: [3.2, 2.6], cap: 'butt' };
export const RIBLN: Over = { fill: null, w: 0.55 };

/** Lighter or darker version of a color. f below 1 darkens, above 1 lightens. */
export function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Math.max(0, Math.min(255, Math.round(f <= 1 ? x * f : x + (255 - x) * (f - 1)))));
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export const DETAIL = shade(GREY, 0.9);
export const TRIM = '#707070';
export const CORD = '#F2F2F2';

// ---------- geometry helpers ----------

export const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function bez(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ];
}

/** Short rib strokes between two matching edges, a to a2 and b to b2, about every gap inches. */
export function ribLines(a: Pt, a2: Pt, b: Pt, b2: Pt, gap = 0.42): VSub[] {
  const n = Math.max(2, Math.round(dist(a, a2) / gap));
  const out: VSub[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    out.push(poly([lerp(a, a2, t), lerp(b, b2, t)]));
  }
  return out;
}

export const withMirror = (subs: VSub[]): VSub[] => [...subs, ...subs.map(mir)];

/** Offset a simple polygon inward by d inches (negative grows it). */
export function inset(pts: Pt[], d: number): Pt[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    area += x1 * y2 - x2 * y1;
  }
  const sgn = area > 0 ? 1 : -1;
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * sgn, ny = (dx / l) * sgn;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Pt, d: [dx / l, dy / l] as Pt };
  });
  return pts.map((_, i) => {
    const a = lines[(i + n - 1) % n], b = lines[i];
    const det = a.d[0] * b.d[1] - a.d[1] * b.d[0];
    if (Math.abs(det) < 1e-6) return b.p;
    const t = ((b.p[0] - a.p[0]) * b.d[1] - (b.p[1] - a.p[1]) * b.d[0]) / det;
    return [a.p[0] + a.d[0] * t, a.p[1] + a.d[1] * t] as Pt;
  });
}

/** x at a given y along a polyline sorted by y. */
export function xAt(pts: Pt[], y: number): number {
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][1]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1);
    }
  }
  return pts[pts.length - 1][0];
}

/** A zig zag tooth line down a zipper. */
export function teeth(x: number, y0: number, y1: number, step = 0.28, half = 0.1): VSub {
  const pts: Pt[] = [];
  let k = 0;
  for (let y = y0; y <= y1; y += step) pts.push([x + (k++ % 2 ? half : -half), y]);
  return poly(pts);
}

/** A cord that hangs from an eyelet: dark outline stroke under a light stroke. */
export function cordPaths(d: string, name: string): VPath[] {
  const s = P(d);
  const s2 = structuredClone(s);
  return [
    path(`Hardware cord edge ${name}`, s, { fill: null, w: 4.2, cap: 'round' }),
    path(`Hardware cord ${name}`, s2, { fill: null, stroke: CORD, w: 2.4, cap: 'round' }),
  ];
}

export const aglet = (x: number, y: number, name: string): VPath =>
  path(`Hardware aglet ${name}`, poly([[x - 0.17, y], [x + 0.17, y], [x + 0.17, y + 0.7], [x - 0.17, y + 0.7]], true), { fill: '#C9C9C9', w: 0.8 });

export const eyelet = (x: number, y: number, name: string): VPath =>
  path(`Hardware eyelet ${name}`, circ(x, y, 0.2), { fill: '#BDBDBD', w: 0.8 });

/** Zipper pull: slider plus tab, hanging from (x, y). */
export function zipPull(x: number, y: number, len = 1.3): VPath[] {
  return [
    path('Hardware zip slider', poly([[x - 0.2, y - 0.1], [x + 0.2, y - 0.1], [x + 0.2, y + 0.5], [x - 0.2, y + 0.5]], true), { fill: '#BDBDBD', w: 0.9 }),
    path('Hardware zip pull', poly([[x - 0.15, y + 0.5], [x + 0.15, y + 0.5], [x + 0.15, y + 0.5 + len], [x - 0.15, y + 0.5 + len]], true), { fill: '#CFCFCF', w: 0.9 }),
  ];
}

export const snap = (x: number, y: number, name: string): VPath[] => [
  path(`Hardware snap ${name}`, circ(x, y, 0.3), { fill: '#C4C4C4', w: 0.9 }),
  path(`Hardware snap dot ${name}`, circ(x, y, 0.1), { fill: '#9A9A9A', stroke: null }),
];
