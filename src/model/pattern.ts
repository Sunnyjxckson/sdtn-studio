// Sewing pattern pieces generated from a jeans garment's measurements.
// All construction is in inches; the placed output is in pixels at 96 px per inch.
import { findPoint, PX_IN_H, PX_IN_V, type Garment } from './garment';

export const PPI = 96;
export const SEAM_ALLOWANCE = 0.375;
type P = [number, number];

export interface Measures {
  waist: number;
  hip: number;
  rise: number;
  hipDepth: number;
  length: number;
  kneeY: number;
  knee: number;
  opening: number;
  band: number;
  pocket: boolean;
}

/** Pattern measurements in inches, taken from the same landmarks as the spec table. */
export function measures(g: Garment): Measures {
  const p = g.points;
  const wl = findPoint(p, 'waistL'), wr = findPoint(p, 'waistR');
  const cr = findPoint(p, 'crotch');
  const hipL = findPoint(p, 'hipL'), hipR = findPoint(p, 'hipR');
  const kneeLi = findPoint(p, 'kneeLi'), kneeLo = findPoint(p, 'kneeLo');
  const hemLi = findPoint(p, 'hemLi'), hemLo = findPoint(p, 'hemLo');
  const seam = wl.y;
  const hemY = Math.min(g.cropY ?? Infinity, Math.max(hemLi.y, hemLo.y));
  const rise = Math.max(5, (cr.y - seam) / PX_IN_V);
  const length = Math.max(rise + 4, (hemY - seam) / PX_IN_V);
  const kneeY = Math.min(length - 1, Math.max(rise + 1, (kneeLi.y - seam) / PX_IN_V));
  return {
    waist: (2 * Math.abs(wr.x - wl.x)) / 9,
    hip: (2 * Math.abs(hipR.x - hipL.x)) / 9,
    rise,
    hipDepth: Math.min(rise - 1, Math.max(3, (hipR.y - seam) / PX_IN_V)),
    length,
    kneeY,
    knee: Math.max(3, Math.abs(kneeLi.x - kneeLo.x) / PX_IN_H),
    opening: Math.max(3, Math.abs(hemLi.x - hemLo.x) / PX_IN_H),
    band: 14 / PX_IN_V,
    pocket: g.parts.pocket !== 'None',
  };
}

function quad(a: P, c: P, b: P, n = 8): P[] {
  const out: P[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

function area(poly: P[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

function dedupe(poly: P[]): P[] {
  return poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4;
  });
}

/** Outward unit normals for the edges, and the mitred offset polygon. */
function offset(poly: P[], d: number): { poly: P[]; normals: P[] } {
  const pts = dedupe(poly);
  const sign = area(pts) > 0 ? 1 : -1;
  const n = pts.length;
  const edgeN = (a: P, b: P): P => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return sign > 0 ? [dy / l, -dx / l] : [-dy / l, dx / l];
  };
  const out: P[] = [];
  const normals: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const n1 = edgeN(a, b), n2 = edgeN(b, c);
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    let mx = n1[0] + n2[0], my = n1[1] + n2[1];
    const k = 1 + dot;
    const l = Math.hypot(mx, my) || 1;
    normals.push([mx / l, my / l]);
    if (k < 0.25) {
      mx = (mx / l) * d;
      my = (my / l) * d;
    } else {
      mx = (mx / k) * d;
      my = (my / k) * d;
    }
    out.push([b[0] + mx, b[1] + my]);
  }
  return { poly: out, normals };
}

function clipY(poly: P[], y: number, keepBelow: boolean): P[] {
  const inside = (p: P) => (keepBelow ? p[1] >= y : p[1] <= y);
  const out: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (y - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, y]);
    }
  }
  return out;
}

interface RawPiece {
  id: string;
  name: string;
  cut: number;
  poly: P[];
  grainX: number;
  notches: P[];
}

function legPanel(m: Measures, back: boolean): { poly: P[]; ax: number; notches: P[] } {
  const q = m.waist / 4 + (back ? 0.75 : 0);
  const H = m.hip / 4 + (back ? 0.5 : 0);
  const fork = H * (back ? 0.34 : 0.18);
  const R = m.rise + (back ? 0.9 : 0);
  const hd = m.hipDepth + (back ? 0.4 : 0);
  const L = m.length;
  const kneeY = Math.min(L - 1, Math.max(R + 1, m.kneeY));
  const ax = (H + fork) / 2;
  const K = m.knee, O = m.opening;
  const P0: P = [H - q, 0], P1: P = [0, hd];
  const P2: P = [ax - K / 2, kneeY], P3: P = [ax - O / 2, L], P4: P = [ax + O / 2, L], P5: P = [ax + K / 2, kneeY];
  const P6: P = [H + fork, R];
  const Pm: P = [H, R * 0.5];
  const top: P = back ? [H + 0.6, -0.9] : [H, 0];
  const poly: P[] = [P0, ...quad(P0, [(H - q) * 0.3, hd * 0.5], P1), P2, P3, P4, P5, P6, ...quad(P6, [H + fork * 0.9, R * 0.93], Pm), top];
  return { poly, ax, notches: [P1, P2, P5] };
}

function rawPieces(m: Measures): RawPiece[] {
  const out: RawPiece[] = [];
  const front = legPanel(m, false);
  out.push({ id: 'front', name: 'Front leg panel', cut: 2, poly: front.poly, grainX: front.ax, notches: front.notches });

  const back = legPanel(m, true);
  const yokeY = Math.min(3.2, m.hipDepth * 0.45);
  out.push({ id: 'back', name: 'Back leg panel', cut: 2, poly: clipY(back.poly, yokeY, true), grainX: back.ax, notches: back.notches.slice(1) });
  const yoke = clipY(back.poly, yokeY, false);
  out.push({ id: 'yoke', name: 'Back yoke', cut: 2, poly: yoke, grainX: back.ax, notches: [back.notches[0]] });

  const len = m.waist + 1.5, h = m.band * 2 + 0.5;
  out.push({
    id: 'band',
    name: 'Waistband',
    cut: 1,
    poly: [[0, 0], [len, 0], [len, h], [0, h]],
    grainX: len / 2,
    notches: [[len / 2, 0], [len * 0.25, 0], [len * 0.75, 0]],
  });

  if (m.pocket) {
    const w = Math.max(5, m.waist / 4.6), hh = Math.max(7, m.rise * 0.85);
    const poly: P[] = [[0, 0], [w, 0], [w, hh * 0.78], ...quad([w, hh * 0.78], [w * 0.95, hh], [w * 0.45, hh]), ...quad([w * 0.45, hh], [0, hh * 0.98], [0, hh * 0.55]), [0, hh * 0.55]];
    out.push({ id: 'bag', name: 'Front pocket bag', cut: 2, poly, grainX: w / 2, notches: [[w, hh * 0.3]] });
  }
  const bw = Math.max(4.5, m.waist * 0.17), bh = bw * 1.1;
  out.push({
    id: 'bpocket',
    name: 'Back pocket',
    cut: 2,
    poly: [[0, 0], [bw, 0], [bw, bh * 0.7], [bw / 2, bh], [0, bh * 0.7]],
    grainX: bw / 2,
    notches: [[bw / 2, 0]],
  });
  return out;
}

export interface PlacedPiece {
  id: string;
  name: string;
  cut: number;
  /** Pixel space, already offset into the sheet. */
  outline: string;
  allowance: string;
  grain: { x1: number; y1: number; x2: number; y2: number };
  notches: string;
  label: { x: number; y: number };
  widthIn: number;
  heightIn: number;
}

export interface Sheet {
  pieces: PlacedPiece[];
  /** Sheet size in inches and pixels. */
  wIn: number;
  hIn: number;
  w: number;
  h: number;
  /** Ruler band size in inches. */
  ruler: number;
}

const toPath = (pts: P[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + ' Z';

export function buildSheet(g: Garment, maxRowIn = 38): Sheet {
  const m = measures(g);
  const raws = rawPieces(m);
  const ruler = 0.6;
  const gap = 0.6;

  // local geometry: shift every piece so its allowance box starts at 0,0
  const built = raws.map((r) => {
    const sa = offset(r.poly, SEAM_ALLOWANCE);
    const all = sa.poly;
    const minx = Math.min(...all.map((p) => p[0])), miny = Math.min(...all.map((p) => p[1]));
    const maxx = Math.max(...all.map((p) => p[0])), maxy = Math.max(...all.map((p) => p[1]));
    const pts = dedupe(r.poly);
    const inner = offset(r.poly, 0);
    return { r, pts, sa, inner, minx, miny, w: maxx - minx, h: maxy - miny };
  });
  built.sort((a, b) => b.h - a.h);

  // shelf layout
  let x = ruler, y = ruler, rowH = 0, maxX = 0;
  const placed: PlacedPiece[] = [];
  for (const b of built) {
    if (x > ruler && x + b.w > maxRowIn) {
      x = ruler;
      y += rowH + gap;
      rowH = 0;
    }
    const ox = x - b.minx, oy = y - b.miny;
    const T = (p: P): P => [(p[0] + ox) * PPI, (p[1] + oy) * PPI];
    const outline = toPath(b.pts.map(T));
    const allowance = toPath(b.sa.poly.map(T));

    // notches: small triangles on the nearest outline vertex, pointing out into the allowance
    let notches = '';
    for (const np of b.r.notches) {
      let bi = 0, bd = Infinity;
      b.pts.forEach((p, i) => {
        const d = Math.hypot(p[0] - np[0], p[1] - np[1]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      const v = b.pts[bi], nn = b.inner.normals[bi];
      const t: P = [-nn[1], nn[0]];
      const a = T([v[0] - t[0] * 0.08, v[1] - t[1] * 0.08]);
      const c = T([v[0] + t[0] * 0.08, v[1] + t[1] * 0.08]);
      const tip = T([v[0] + nn[0] * 0.25, v[1] + nn[1] * 0.25]);
      notches += `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${tip[0].toFixed(1)},${tip[1].toFixed(1)} L${c[0].toFixed(1)},${c[1].toFixed(1)} `;
    }

    // grainline runs down the piece at its axis
    const ys = b.pts.map((p) => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const gy0 = y0 + (y1 - y0) * 0.14, gy1 = y1 - (y1 - y0) * 0.1;
    const horizontal = b.r.id === 'band';
    const g1 = horizontal ? T([b.r.grainX - Math.min(6, b.w * 0.25), (y0 + y1) / 2 + 0.55]) : T([b.r.grainX, gy0]);
    const g2 = horizontal ? T([b.r.grainX + Math.min(6, b.w * 0.25), (y0 + y1) / 2 + 0.55]) : T([b.r.grainX, gy1]);
    const labelPt = horizontal ? T([b.r.grainX, (y0 + y1) / 2 - 0.15]) : T([b.r.grainX + (b.r.id === 'front' || b.r.id === 'back' ? 0.9 : 0), y0 + (y1 - y0) * (b.r.id === 'yoke' ? 0.5 : 0.3)]);

    placed.push({
      id: b.r.id,
      name: b.r.name,
      cut: b.r.cut,
      outline,
      allowance,
      grain: { x1: g1[0], y1: g1[1], x2: g2[0], y2: g2[1] },
      notches,
      label: { x: labelPt[0], y: labelPt[1] },
      widthIn: b.w - SEAM_ALLOWANCE * 2,
      heightIn: b.h - SEAM_ALLOWANCE * 2,
    });
    x += b.w + gap;
    maxX = Math.max(maxX, x - gap);
    rowH = Math.max(rowH, b.h);
  }
  const wIn = Math.max(maxX + ruler, 20);
  const hIn = y + rowH + ruler + 1.4;
  return { pieces: placed, wIn, hIn, w: wIn * PPI, h: hIn * PPI, ruler };
}
