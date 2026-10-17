// Fold shapes for tops, defined on the body (u across, v down for the torso; a along, o across for
// sleeves) so they follow the croquis and pose. Each fold is drawn as a tapered ribbon, thick in the
// middle and pointed at both ends, which is how folds read in a fashion drawing.

import { rng } from './rng';
import type { TopOpts } from './top';
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
  const loose = o.fit === 'Oversized' ? 1 : o.fit === 'Regular' ? 0.5 : 0;
  const sleeved = o.block !== 'Tank';

  for (const s of [-1, 1] as const) {
    // pull from the underarm toward the bust or chest
    out.push({ pts: [T(s * 0.98, 0.33), T(s * (0.8 + j(0.05)), 0.4), T(s * (0.58 + j(0.06)), bust ? 0.44 : 0.47)], w: 2.6 + loose, o: 0.3, ridge: true });
    out.push({ pts: [T(s * 0.97, 0.38), T(s * 0.82, 0.5 + j(0.03)), T(s * (0.66 + j(0.05)), 0.58)], w: 2 + loose, o: 0.22, ridge: false });
    if (bust && loose < 1) out.push({ pts: [T(s * 0.86, 0.46), T(s * 0.55, 0.5), T(s * 0.18, 0.45)], w: 3.2, o: 0.2, ridge: false });
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
      const len = o.block === 'Long sleeve' ? 2 : 0.4;
      // folds radiating from the armpit across the sleeve
      out.push({ pts: [A(side, 0.05, 0.85), A(side, 0.16, 0.25), A(side, 0.26 + j(0.04), -0.35)], w: 2.4 + loose, o: 0.26, ridge: true });
      if (len > 1) {
        // elbow and wrist stacking on long sleeves
        for (const a0 of [0.9, 1.05, 1.75, 1.88]) out.push({ pts: [A(side, a0, -0.9), A(side, a0 + 0.04 + j(0.03), 0), A(side, a0, 0.9)], w: 2, o: 0.24, ridge: a0 < 1 });
      } else {
        out.push({ pts: [A(side, len - 0.06, 0.6), A(side, len * 0.6, 0.05), A(side, len - 0.04, -0.6)], w: 1.8, o: 0.18, ridge: false });
      }
    }
  }
  // collar bone drag under the neckline
  out.push({ pts: [T(-0.32, 0.12), T(0, 0.16 + (o.neck === 'Crew' ? 0 : 0.08)), T(0.32, 0.12)], w: 1.8, o: 0.12, ridge: false });
  if (o.tuck) {
    for (let k = 0; k < 5; k++) {
      const u = -0.8 + k * 0.4 + j(0.1);
      out.push({ pts: [T(u - 0.05, 0.95), T(u + 0.02, 1.03), T(u, 1.1)], w: 3, o: 0.24, ridge: true });
    }
  }
  return out;
}
