import { rng } from './rng';
import { findPoint, type Garment, type Hole, type Rip } from './garment';
import type { Stroke } from './shading';

type P = [number, number];
const n1 = (x: number) => x.toFixed(1);

/** Ragged hole outline, seeded by garment id and index. Wide, torn and uneven, not star shaped. */
export function ripPoly(id: string, i: number, h: Hole): P[] {
  const r = rng(`${id}:hole:${i}`);
  const n = 44;
  const rx = h.r * 1.75, ry = h.r * 1.0;
  const phase = r() * 6.28, phase2 = r() * 6.28;
  const skew = (r() - 0.5) * 0.5;
  const pts: P[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    let f = 0.8 + 0.16 * Math.sin(a * 2 + phase) + 0.1 * Math.sin(a * 5 + phase2) + (r() - 0.5) * 0.3;
    if (k % 2) f *= 0.93 + r() * 0.05; // small notches between teeth
    if (r() < 0.16) f += 0.16 + r() * 0.26; // a few torn tongues, mostly sideways
    const sideways = Math.abs(Math.cos(a));
    if (f > 1) f = 1 + (f - 1) * (0.4 + sideways * 0.5);
    f = Math.min(f, 1.22);
    const x = Math.cos(a) * rx * f;
    const y = Math.sin(a) * ry * f * (1 + (r() - 0.5) * 0.3);
    pts.push([h.x + x + y * skew, h.y + y]);
  }
  return pts;
}

export const polyPath = (pts: P[]) => 'M' + pts.map((p) => `${n1(p[0])},${n1(p[1])}`).join(' L') + ' Z';

export interface Thread extends Stroke {
  /** Index into the thread tones, 0 cream to 2 grey. */
  t: number;
}

/** White weft threads running across the opening, wavy, uneven in length, some broken. */
export function ripThreads(id: string, i: number, poly: P[]): Thread[] {
  const r = rng(`${id}:thr:${i}`);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const k = 6 + Math.floor(r() * 4);
  const span = maxx - minx;
  const out: Thread[] = [];
  for (let j = 0; j < k; j++) {
    const y = miny + 0.5 + ((j + 0.5 + (r() - 0.5) * 0.45) / k) * (maxy - miny - 1);
    // most threads cross the whole gap, some are snapped part way
    const snapped = r() < 0.3;
    const x0 = minx - 2 - r() * 2 + (snapped && r() < 0.5 ? r() * span * 0.5 : 0);
    const x1 = maxx + 2 + r() * 2 - (snapped && x0 < minx ? r() * span * 0.5 : 0);
    const amp = 0.4 + r() * 1.1;
    const ph = r() * 6.28;
    const steps = 6;
    let d = '';
    for (let s = 0; s <= steps; s++) {
      const x = x0 + ((x1 - x0) * s) / steps;
      const yy = y + Math.sin((s / steps) * 4.5 + ph) * amp;
      d += `${s ? 'L' : 'M'}${n1(x)},${n1(yy)} `;
    }
    out.push({ d, w: 0.5 + r() * 0.6, o: 0.75 + r() * 0.25, t: r() < 0.7 ? 0 : r() < 0.6 ? 1 : 2 });
  }
  return out;
}

/** Short blue warp ends poking in from the top and bottom rim of the opening. */
export function ripWarp(id: string, i: number, h: Hole, poly: P[]): string {
  const r = rng(`${id}:warp:${i}`);
  let d = '';
  for (const [x, y] of poly) {
    const dy = y - h.y;
    if (Math.abs(dy) < h.r * 0.25 || r() < 0.45) continue;
    const l = 1.5 + r() * 3.5;
    const sx = (r() - 0.5) * 1.2;
    d += `M${n1(x)},${n1(y)} L${n1(x + sx)},${n1(y - Math.sign(dy) * l)} `;
  }
  return d;
}

/** Fray ticks around the rim. Mostly horizontal, because the weft is what pulls out. */
export function ripFray(id: string, i: number, h: Hole, poly: P[]): string {
  const r = rng(`${id}:fray:${i}`);
  let d = '';
  for (const [x, y] of poly) {
    if (r() < 0.3) continue;
    const dx = x - h.x, dy = y - h.y;
    const len = Math.hypot(dx, dy) || 1;
    // blend of outward and sideways
    let ux = dx / len + Math.sign(dx || 1) * 1.4;
    let uy = (dy / len) * 0.6 + (r() - 0.5) * 0.5;
    const m = Math.hypot(ux, uy) || 1;
    ux /= m;
    uy /= m;
    const l = 1.2 + r() * (Math.abs(dx) > h.r ? 6 : 3);
    d += `M${n1(x)},${n1(y)} L${n1(x + ux * l)},${n1(y + uy * l)} `;
  }
  return d;
}

/** A few thin loose threads curling out of the rim, longer than the fray ticks. */
export function ripLoose(id: string, i: number, h: Hole, poly: P[]): string {
  const r = rng(`${id}:loose:${i}`);
  let d = '';
  const count = 3 + Math.floor(r() * 3);
  for (let c = 0; c < count; c++) {
    const [x, y] = poly[Math.floor(r() * poly.length)];
    const side = x < h.x ? -1 : 1;
    const l = 5 + r() * 8;
    const dir = (r() - 0.5) * 1.2 + (y > h.y ? 0.5 : -0.3);
    const ex = x + side * l * Math.cos(dir * 0.6);
    const ey = y + l * Math.sin(dir) * 0.6;
    const c1x = x + side * l * 0.35, c1y = y + (r() - 0.5) * 6;
    const c2x = x + side * l * 0.75, c2y = ey + (r() - 0.5) * 7;
    d += `M${n1(x)},${n1(y)} C${n1(c1x)},${n1(c1y)} ${n1(c2x)},${n1(c2y)} ${n1(ex)},${n1(ey)} `;
  }
  return d;
}

/** A worn lighter patch: pulled weft streaks, a few dark gaps between them, short white ticks. */
export function wornPatch(id: string, i: number, d: Rip) {
  const r = rng(`${id}:worn:${i}`);
  const rx = 12 + r() * 5, ry = 7 + r() * 4;
  let ticks = '';
  let gaps = '';
  const count = 14 + Math.floor(r() * 8);
  for (let k = 0; k < count; k++) {
    const x = d.x + (r() - 0.5) * 2 * rx * 0.9;
    const y = d.y + (r() - 0.5) * 2 * ry * 0.9;
    const len = 2 + r() * 8;
    const a = (r() - 0.5) * 0.3;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    ticks += `M${n1(x)},${n1(y)} L${n1(x1)},${n1(y1)} `;
    if (r() < 0.55) gaps += `M${n1(x)},${n1(y + 1.1)} L${n1(x1 - len * 0.2)},${n1(y1 + 1.1)} `;
  }
  return { rx, ry, ticks, gaps };
}

/** Stacked sagging creases over each knee, the honeycomb fade of a worn wash. */
export function honeycomb(g: Garment): { light: Stroke[]; dark: Stroke[] } {
  const r = rng(g.id + ':honey');
  const p = g.points;
  const light: Stroke[] = [];
  const dark: Stroke[] = [];
  const has = (...k: string[]) => k.every((x) => p.some((q) => q.key === x));
  for (const [lo, li, hem] of [['kneeLo', 'kneeLi', 'hemLo'], ['kneeRo', 'kneeRi', 'hemRo']] as const) {
    if (!has(lo, li)) continue;
    const o = findPoint(p, lo), n = findPoint(p, li);
    const width = Math.abs(n.x - o.x);
    const dir = Math.sign(n.x - o.x) || 1;
    const loose = has(hem) ? Math.max(0, Math.min(1, (Math.abs(findPoint(p, hem).x - o.x) - 20) / 40)) : 0;
    const rows = 6;
    for (let k = 0; k < rows; k++) {
      const y = o.y - 14 + k * 5.2 + (r() - 0.5) * 1.2;
      const a = 0.12 + r() * 0.1, b = 0.78 + r() * 0.12;
      const x0 = o.x + dir * width * a, x1 = o.x + dir * width * b;
      const bend = 2.2 + r() * 2.2;
      const d = `M${n1(x0)},${n1(y + (r() - 0.5) * 1.5)} Q${n1((x0 + x1) / 2)},${n1(y + bend)} ${n1(x1)},${n1(y + (r() - 0.5) * 1.5)}`;
      light.push({ d, w: 2.1 + r() * 0.9, o: (0.34 + r() * 0.16) * (1 - loose * 0.4) });
      dark.push({ d, w: 0.7, o: 0.22 });
    }
  }
  return { light, dark };
}

/** Topstitch lines 3 units in from the leg seams and hem. */
export function seamStitch(g: Garment): string {
  const p = g.points;
  const has = (...k: string[]) => k.every((x) => p.some((q) => q.key === x));
  const legs: [string[], string[], string][] = [
    [['hipL', 'kneeLo', 'hemLo'], ['crotch', 'kneeLi', 'hemLi'], 'L'],
    [['hipR', 'kneeRo', 'hemRo'], ['crotch', 'kneeRi', 'hemRi'], 'R'],
  ];
  const hem = Math.min(
    g.cropY ?? Infinity,
    Math.max(...['hemLo', 'hemLi', 'hemRo', 'hemRi'].filter((k) => has(k)).map((k) => findPoint(p, k).y)),
  );
  let d = '';
  const inset = 3.2;
  for (const [outer, inner] of legs) {
    if (!has(...outer, ...inner)) continue;
    const O = outer.map((k) => findPoint(p, k)), I = inner.map((k) => findPoint(p, k));
    const side = Math.sign(I[1].x - O[1].x) || 1;
    const seam = (pts: { x: number; y: number }[], s: number, from: number) => {
      // the outline is straight between points, so follow it the same way
      const t = Math.min(0.9, from / (Math.abs(pts[1].y - pts[0].y) || 1));
      const a = { x: pts[0].x + (pts[1].x - pts[0].x) * t + s * inset, y: pts[0].y + (pts[1].y - pts[0].y) * t };
      const m = { x: pts[1].x + s * inset, y: pts[1].y };
      const ey = Math.min(pts[2].y, hem) - 6;
      const u = pts[2].y === pts[1].y ? 0 : (ey - pts[1].y) / (pts[2].y - pts[1].y);
      const e = { x: pts[1].x + (pts[2].x - pts[1].x) * u + s * inset, y: ey };
      return `M${n1(a.x)},${n1(a.y)} L${n1(m.x)},${n1(m.y)} L${n1(e.x)},${n1(e.y)} `;
    };
    d += seam(O, side, 14);
    d += seam(I, -side, 4);
    // hem
    const y = hem - 6;
    const ox = O[1].x + (O[2].x - O[1].x) * ((y - O[1].y) / (O[2].y - O[1].y || 1));
    const ix = I[1].x + (I[2].x - I[1].x) * ((y - I[1].y) / (I[2].y - I[1].y || 1));
    d += `M${n1(ox + side * inset)},${n1(y)} L${n1(ix - side * inset)},${n1(y)} `;
  }
  return d;
}
