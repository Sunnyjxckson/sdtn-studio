// Small geometry kit for sewing pattern pieces. Everything is in inches, y runs down the page.
export type P = [number, number];

export const SEAM = 0.375;

export function quad(a: P, c: P, b: P, n = 8): P[] {
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

export function cubic(a: P, c1: P, c2: P, b: P, n = 10): P[] {
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
    out.push([k0 * a[0] + k1 * c1[0] + k2 * c2[0] + k3 * b[0], k0 * a[1] + k1 * c1[1] + k2 * c2[1] + k3 * b[1]]);
  }
  return out;
}

export function area(poly: P[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function dedupe(poly: P[]): P[] {
  return poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4;
  });
}

export function pathLen(pts: P[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}

export function bbox(pts: P[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return { x0, y0, x1, y1 };
}

/** Outward unit normal of edge a to b for a polygon with the given winding sign. */
function edgeNormal(a: P, b: P, sign: number): P {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  return sign > 0 ? [dy / l, -dx / l] : [-dy / l, dx / l];
}

/** Offset a closed polygon outward, with its own distance for each edge (edge i runs poly[i] to poly[i + 1]). */
export function offsetEdges(poly: P[], d: number[]): P[] {
  const n = poly.length;
  const sign = area(poly) > 0 ? 1 : -1;
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = poly[(i + n - 1) % n], b = poly[i], c = poly[(i + 1) % n];
    const d1 = d[(i + n - 1) % n], d2 = d[i];
    const n1 = edgeNormal(a, b, sign), n2 = edgeNormal(b, c, sign);
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    let ox: number, oy: number;
    if (Math.abs(det) < 0.12) {
      ox = (n1[0] * d1 + n2[0] * d2) / 2;
      oy = (n1[1] * d1 + n2[1] * d2) / 2;
    } else {
      ox = (d1 * n2[1] - d2 * n1[1]) / det;
      oy = (n1[0] * d2 - n2[0] * d1) / det;
      const lim = 3 * Math.max(d1, d2);
      const l = Math.hypot(ox, oy);
      if (l > lim && l > 0) {
        ox = (ox / l) * lim;
        oy = (oy / l) * lim;
      }
    }
    out.push([b[0] + ox, b[1] + oy]);
  }
  return out;
}

/** The point of the outline nearest to p: its edge index and outward normal. */
export function nearestEdge(poly: P[], p: P): { i: number; at: P; normal: P; tangent: P } {
  const sign = area(poly) > 0 ? 1 : -1;
  let best = { i: 0, at: poly[0], d: Infinity };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    const q: P = [a[0] + dx * t, a[1] + dy * t];
    const dd = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (dd < best.d) best = { i, at: q, d: dd };
  }
  const a = poly[best.i], b = poly[(best.i + 1) % poly.length];
  const normal = edgeNormal(a, b, sign);
  return { i: best.i, at: best.at, normal, tangent: [-normal[1], normal[0]] };
}

export function mirrorX(pts: P[]): P[] {
  return pts.map((p) => [-p[0], p[1]] as P);
}

/** Row spans of a polygon: for each band of `res` inches, the min and max x it reaches. */
export function rowSpans(poly: P[], res: number, y0: number, rows: number): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = Array.from({ length: rows }, () => null);
  const n = poly.length;
  const add = (r: number, x: number) => {
    if (r < 0 || r >= rows) return;
    const o = out[r];
    if (!o) out[r] = [x, x];
    else {
      if (x < o[0]) o[0] = x;
      if (x > o[1]) o[1] = x;
    }
  };
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ya = (a[1] - y0) / res, yb = (b[1] - y0) / res;
    const lo = Math.min(ya, yb), hi = Math.max(ya, yb);
    const r0 = Math.floor(lo), r1 = Math.floor(hi);
    for (let r = r0; r <= r1; r++) {
      // clip the edge to this band and take both ends
      const t0 = hi === lo ? 0 : Math.max(0, (Math.max(lo, r) - ya) / (yb - ya || 1));
      const ts = [ya === yb ? 0 : (Math.max(lo, r) - ya) / (yb - ya), ya === yb ? 1 : (Math.min(hi, r + 1) - ya) / (yb - ya)];
      void t0;
      for (const t of ts) add(r, a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, t)));
    }
  }
  return out;
}
