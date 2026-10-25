// Fold shapes for tops, defined on the body (u across, v down for the torso; a along, o across for
// sleeves) so they follow the croquis and pose. Each fold is drawn as a tapered ribbon, thick in the
// middle and pointed at both ends, which is how folds read in a fashion drawing.

import { rng } from './rng';
import { silhouetteOf, sleeveOf, type TopOpts } from './top';
import type { Pt } from './garment';

export interface Fold {
  pts: Pt[];
  /** Widest point of the ribbon, canvas units. */
  w: number;
  /** Darkness, 0..1. */
  o: number;
  /** Light ridge drawn alongside. */
  ridge: boolean;
}

const T = (u: number, v: number): Pt => ({ x: 150 + u * 100, y: 100 + v * 200 });
const A = (side: 'armL' | 'armR', a: number, o: number): Pt => ({ x: a * 100, y: 100 + o * 100, r: side });

export function topFolds(id: string, o: TopOpts, hemV: number, bust: boolean): Fold[] {
  const r = rng(id + ':tfold');
  const out: Fold[] = [];
  const j = (n: number) => (r() - 0.5) * n;
  const loose = o.block === 'Dress' ? 0 : o.block === 'Moto jacket' ? (o.fit === 'Oversized' ? 0.6 : 0.2) : o.fit === 'Oversized' ? 1 : o.fit === 'Regular' ? 0.5 : 0;
  const sleeved = sleeveOf(o) > 0;
  if (o.block === 'Dress') return dressFolds(r, o, hemV, bust);

  for (const s of [-1, 1] as const) {
    // pull from the underarm toward the bust or chest
    out.push({ pts: [T(s * 0.94, 0.36), T(s * (0.8 + j(0.05)), 0.42), T(s * (0.6 + j(0.06)), bust ? 0.45 : 0.48)], w: 2.6 + loose, o: 0.3, ridge: true });
    // gather at the waist where a fitted or regular top bunches
    if (hemV > 0.9 && loose < 1) {
      for (let k = 0; k < 2; k++) {
        const v = Math.min(hemV - 0.06, 0.86 + k * 0.08 + j(0.03));
        out.push({ pts: [T(s * 0.95, v - 0.02), T(s * (0.7 + j(0.08)), v + 0.015), T(s * (0.42 + j(0.1)), v)], w: 2 + loose * 1.5, o: 0.2, ridge: k === 0 });
      }
    }
    // looser fits: long drape folds falling from the shoulder blade toward the hem
    if (loose > 0) {
      const u0 = s * (0.55 + j(0.1));
      out.push({ pts: [T(u0, 0.22), T(u0 + s * 0.05 + j(0.05), (0.22 + hemV) / 2), T(u0 + s * 0.02, hemV - 0.03)], w: 4 + loose * 4, o: 0.16 + loose * 0.08, ridge: true });
      out.push({ pts: [T(s * 0.92, 0.5), T(s * (0.86 + j(0.04)), (0.5 + hemV) / 2), T(s * 0.88, hemV - 0.02)], w: 3 + loose * 3, o: 0.2, ridge: false });
    }
    if (sleeved) {
      const side = s < 0 ? 'armL' : 'armR';
      const len = sleeveOf(o) > 1 ? 2 : 0.4;
      // folds radiating from the armpit across the sleeve
      if (len > 1) {
        // elbow and wrist stacking on long sleeves
        for (const a0 of [0.9, 1.05, 1.75, 1.88]) out.push({ pts: [A(side, a0, -0.9), A(side, a0 + 0.04 + j(0.03), 0), A(side, a0, 0.9)], w: 2, o: 0.24, ridge: a0 < 1 });
      } else {
        out.push({ pts: [A(side, len - 0.06, 0.6), A(side, len * 0.6, 0.05), A(side, len - 0.04, -0.6)], w: 1.8, o: 0.18, ridge: false });
      }
    }
  }
  // hanging folds that rise from the hem where it ripples, longer on looser tops
  if (loose > 0) {
    for (let k = 0; k < 7; k++) {
      const f = (k + 0.5) / 7;
      if (Math.sin(f * Math.PI * 7 + 0.6) < 0.2) continue;
      const u = -0.95 + f * 1.9;
      const top = hemV - 0.12 - loose * 0.18 - r() * 0.08;
      out.push({ pts: [T(u + j(0.03), top), T(u + j(0.04), (top + hemV) / 2), T(u, hemV - 0.01)], w: 3 + loose * 2.5, o: 0.18 + loose * 0.06, ridge: true });
    }
    // a long diagonal pull from the bust toward the far side of the hem, from the walking stride
    out.push({ pts: [T(-0.4, 0.42), T(0.05, 0.75), T(0.55, hemV - 0.05)], w: 4 + loose * 2, o: 0.14, ridge: true });
  }
  if (o.block === 'Hoodie') {
    // the body blouses over the rib band, and the sleeves push up into stacked folds above the cuffs
    for (let k = 0; k < 6; k++) {
      const u = -0.85 + k * 0.34 + j(0.06);
      out.push({ pts: [T(u - 0.06, hemV - 0.2 + j(0.03)), T(u + 0.02, hemV - 0.12), T(u, hemV - 0.06)], w: 3.4, o: 0.3, ridge: k % 2 === 0 });
    }
    for (const s of [-1, 1] as const) {
      const side = s < 0 ? 'armL' : 'armR';
      for (const a0 of [1.62, 1.72, 1.82]) out.push({ pts: [A(side, a0, -1.0), A(side, a0 + 0.04 + j(0.03), 0.05), A(side, a0, 1.0)], w: 2.4, o: 0.3, ridge: a0 < 1.7 });
    }
  }
  if (o.block === 'Moto jacket') {
    // leather creases: across the inside of the elbow, from the armpit and gathering above the belt
    for (const s of [-1, 1] as const) {
      const side = s < 0 ? 'armL' : 'armR';
      for (const a0 of [0.95, 1.06, 1.17]) out.push({ pts: [A(side, a0, -0.7), A(side, a0 + 0.05, 0.1), A(side, a0 - 0.02, 0.9)], w: 2.4, o: 0.36, ridge: a0 < 1.05 });
      out.push({ pts: [T(s * 0.9, 0.34), T(s * 0.7, 0.4), T(s * 0.5, 0.42)], w: 2.4, o: 0.34, ridge: true });
      for (let k = 0; k < 2; k++) out.push({ pts: [T(s * (0.9 - k * 0.2), hemV - 0.2 - k * 0.04), T(s * (0.7 - k * 0.2), hemV - 0.16), T(s * (0.5 - k * 0.2), hemV - 0.19)], w: 2.2, o: 0.3, ridge: k === 0 });
    }
  }
  if (o.tuck) {
    for (let k = 0; k < 5; k++) {
      const u = -0.8 + k * 0.4 + j(0.1);
      out.push({ pts: [T(u - 0.05, 0.95), T(u + 0.02, 1.03), T(u, 1.1)], w: 3, o: 0.24, ridge: true });
    }
  }
  return out;
}

function dressFolds(r: () => number, o: TopOpts, hemV: number, bust: boolean): Fold[] {
  const out: Fold[] = [];
  const j = (n: number) => (r() - 0.5) * n;
  const sil = silhouetteOf(o);
  const sl = sleeveOf(o);
  for (const s of [-1, 1] as const) {
    out.push({ pts: [T(s * 0.94, 0.4), T(s * (0.8 + j(0.05)), 0.46), T(s * (0.6 + j(0.06)), bust ? 0.5 : 0.52)], w: 2.4, o: 0.3, ridge: true });
    if (sl > 1) for (const a0 of [0.95, 1.1, 1.8, 1.92]) out.push({ pts: [A(s < 0 ? 'armL' : 'armR', a0, -0.9), A(s < 0 ? 'armL' : 'armR', a0 + 0.04, 0), A(s < 0 ? 'armL' : 'armR', a0, 0.9)], w: 2, o: 0.24, ridge: a0 < 1 });
    if (sil === 'Bodycon') {
      // stretch lines pulling across the hip and thigh
      for (const [v, du] of [[1.28, 0], [1.42, 0.05], [1.62, 0.1]] as const) out.push({ pts: [T(s * 0.96, v), T(s * (0.6 + du + j(0.05)), v + 0.03), T(s * (0.2 + du), v + 0.015)], w: 2.2, o: 0.24, ridge: v < 1.4 });
      out.push({ pts: [T(s * 0.9, 0.86), T(s * 0.6, 0.93), T(s * 0.3, 0.9)], w: 2, o: 0.22, ridge: false });
    }
  }
  if (sil === 'Slip') {
    // bias drape: long soft folds falling from the hip, and a pull across the hip
    for (let k = 0; k < 6; k++) {
      const u = -0.8 + k * 0.32 + j(0.08);
      const top = 1.5 + 0.02 + r() * 0.1;
      out.push({ pts: [T(u, top), T(u + j(0.06), (top + hemV) / 2), T(u * 1.1 + j(0.04), hemV - 0.03)], w: 4.5, o: 0.2, ridge: k % 2 === 0 });
    }
    out.push({ pts: [T(-0.7, 1.12), T(-0.1, 1.28), T(0.6, 1.4)], w: 3.4, o: 0.18, ridge: true });
  }
  if (sil === 'A-line') {
    // folds fan out from the waist seam
    for (let k = 0; k < 7; k++) {
      const u = -0.9 + k * 0.3 + j(0.05);
      out.push({ pts: [T(u * 0.55, 1.08), T(u * 0.85 + j(0.04), (1.08 + hemV) / 2), T(u * 1.08, hemV - 0.02)], w: 4 + (k % 2) * 2, o: 0.2, ridge: k % 2 === 0 });
    }
  }
  return out;
}
