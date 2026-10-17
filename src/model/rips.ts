import { rng } from './rng';
import type { Hole, Rip } from './garment';
import type { Stroke } from './shading';

type P = [number, number];
const n1 = (x: number) => x.toFixed(1);

/** Ragged hole outline, seeded by garment id and index. Wide and shredded, not star shaped. */
export function ripPoly(id: string, i: number, h: Hole): P[] {
  const r = rng(`${id}:hole:${i}`);
  const n = 26;
  const rx = h.r * 1.9, ry = h.r * 0.8;
  const phase = r() * 6.28, phase2 = r() * 6.28;
  const pts: P[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    let f = 0.8 + 0.18 * Math.sin(a * 2 + phase) + 0.12 * Math.sin(a * 5 + phase2) + (r() - 0.5) * 0.22;
    if (r() < 0.22) f += 0.18 + r() * 0.2; // a few torn tongues
    pts.push([h.x + Math.cos(a) * rx * f, h.y + Math.sin(a) * ry * f * (1 + (r() - 0.5) * 0.3)]);
  }
  return pts;
}

export const polyPath = (pts: P[]) => 'M' + pts.map((p) => `${n1(p[0])},${n1(p[1])}`).join(' L') + ' Z';

/** White horizontal weft threads crossing the opening (4 to 7). */
export function ripThreads(id: string, i: number, poly: P[]): Stroke[] {
  const r = rng(`${id}:thr:${i}`);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const k = 4 + Math.floor(r() * 4);
  const out: Stroke[] = [];
  for (let j = 0; j < k; j++) {
    const y = miny + ((j + 0.5 + (r() - 0.5) * 0.5) / k) * (maxy - miny);
    const x0 = minx - 1 + (r() < 0.55 ? r() * (maxx - minx) * 0.4 : 0);
    const x1 = maxx + 1 - (r() < 0.55 ? r() * (maxx - minx) * 0.4 : 0);
    out.push({
      d: `M${n1(x0)},${n1(y)} Q${n1((x0 + x1) / 2)},${n1(y + (r() - 0.5) * 1.8)} ${n1(x1)},${n1(y + (r() - 0.5) * 1.2)}`,
      w: 0.6 + r() * 1.0,
      o: 0.55 + r() * 0.45,
    });
  }
  return out;
}

/** Short frayed marks around the rim of a hole. */
export function ripFray(id: string, i: number, h: Hole, poly: P[]): string {
  const r = rng(`${id}:fray:${i}`);
  let d = '';
  for (const [x, y] of poly) {
    if (r() < 0.4) continue;
    const dx = x - h.x, dy = y - h.y;
    const len = Math.hypot(dx, dy) || 1;
    const l = 1.5 + r() * 3;
    const ang = (r() - 0.5) * 0.7;
    const ux = (dx / len) * Math.cos(ang) - (dy / len) * Math.sin(ang);
    const uy = (dx / len) * Math.sin(ang) + (dy / len) * Math.cos(ang);
    d += `M${n1(x)},${n1(y)} L${n1(x + ux * l)},${n1(y + uy * l)} `;
  }
  return d;
}

/** A worn lighter patch with short white fray ticks. */
export function wornPatch(id: string, i: number, d: Rip) {
  const r = rng(`${id}:worn:${i}`);
  const rx = 12 + r() * 5, ry = 7 + r() * 4;
  let ticks = '';
  const count = 7 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const x = d.x + (r() - 0.5) * 2 * rx * 0.85;
    const y = d.y + (r() - 0.5) * 2 * ry * 0.85;
    const len = 3 + r() * 4;
    const a = (r() - 0.5) * 0.5;
    ticks += `M${n1(x)},${n1(y)} L${n1(x + Math.cos(a) * len)},${n1(y + Math.sin(a) * len)} `;
  }
  return { rx, ry, ticks };
}
