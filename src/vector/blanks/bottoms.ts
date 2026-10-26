// Lower body blanks: shorts and pants from one parametric pair of legs.
import type { VItem, VSub } from '../../model/vector';
import { aglet, bez, both, circ, cordPaths, eyelet, full, GREY, grp, inset, mir, P, path, poly, RIBLN, ribLines, SEAM, STITCH, withMirror, type Pt } from './kit';
import type { View } from './tops';

export interface BotP {
  ww: number;
  wb: number;
  hip: number;
  hipY: number;
  rise: number;
  len: number;
  ho: number;
  hi: number;
  band: 'elastic' | 'belt';
  cord?: boolean;
  cuff?: number;
  hemFold?: number;
  front?: 'slant' | 'scoop' | 'cargo' | 'none';
  backPocket?: boolean;
  cargo?: boolean;
  mesh?: boolean;
  piping?: boolean;
  jean?: boolean;
}

function build(p: BotP, view: View): VItem[] {
  const front = view === 'front';
  const out: VItem[] = [];
  const { ww, wb, hip, hipY, rise, len, ho, hi } = p;
  const c1: Pt = [ww + (hip - ww) * 0.3, hipY * 0.28], c2: Pt = [hip, hipY * 0.62];
  const g: Pt = [0.9, rise + 1.9];

  /** Outer leg edge x at y. */
  const xo = (y: number) => {
    if (y >= hipY) return hip + ((ho - hip) * (y - hipY)) / (len - hipY);
    let lo = 0, hiT = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hiT) / 2;
      if (bez([ww, 0], c1, c2, [hip, hipY], m)[1] < y) lo = m;
      else hiT = m;
    }
    return bez([ww, 0], c1, c2, [hip, hipY], lo)[0];
  };
  const xi = (y: number) => g[0] + ((hi - g[0]) * (y - g[1])) / (len - g[1]);

  const bodyD = `M 0 0 L ${ww} 0 C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${hip} ${hipY} L ${ho} ${len} L ${hi} ${len} L ${g[0]} ${g[1]} Q 0.3 ${rise + 0.4} 0 ${rise}`;
  out.push(path('Body', full(bodyD), { fill: GREY, w: 1.5 }));

  // hem
  if (p.cuff) {
    const yb = len - p.cuff;
    const band = poly([[xi(yb), yb], [xo(yb), yb], [ho, len], [hi, len]], true);
    out.push(path('Rib cuff R', band, { fill: GREY, w: 1.4 }), path('Rib cuff L', mir(band), { fill: GREY, w: 1.4 }));
    out.push(path('Rib lines cuffs', withMirror(ribLines([xi(yb), yb], [xo(yb), yb], [hi, len], [ho, len], 0.4)), RIBLN));
  } else if (p.hemFold) {
    const y = len - p.hemFold;
    out.push(path('Stitch hem', withMirror([poly([[xi(y) + 0.05, y], [xo(y) - 0.05, y]])]), STITCH));
  }

  // waistband
  const wx = xo(wb);
  const wband = poly([[-ww, 0], [ww, 0], [wx, wb], [-wx, wb]], true);
  out.push(path('Waistband', wband, { fill: GREY, w: 1.4 }));
  if (p.band === 'elastic') {
    const ls: VSub[] = [];
    for (let x = -ww + 0.45; x < ww - 0.2; x += 0.42) {
      const f = x / ww;
      ls.push(poly([[x, 0.05], [x * (wx / ww), wb - 0.05]]));
      void f;
    }
    out.push(path('Rib lines waistband', ls, RIBLN));
    out.push(path('Stitch waistband', poly([[-wx + 0.05, wb + 0.45], [wx - 0.05, wb + 0.45]]), STITCH));
  } else {
    out.push(path('Stitch waistband', poly([[-ww + 0.1, 0.4], [ww - 0.1, 0.4]]), STITCH));
    out.push(path('Stitch waistband low', poly([[-wx + 0.05, wb - 0.4], [wx - 0.05, wb - 0.4]]), STITCH));
    // belt loops
    const xs = front ? [-ww + 0.9, -4.6, -2, 2, 4.6, ww - 0.9] : [-ww + 0.9, -4.2, 0, 4.2, ww - 0.9];
    for (const x of xs) out.push(path('Waistband loop', poly([[x - 0.3, -0.35], [x + 0.3, -0.35], [x + 0.3, wb + 0.6], [x - 0.3, wb + 0.6]], true), { fill: GREY, w: 1 }));
  }

  // side seam topstitch for woven pants
  if (p.jean || p.cargo) {
    const y0 = wb + 0.6, y1 = len - 1.3;
    out.push(path('Stitch outseam', withMirror([poly([[xo(y0) - 0.5, y0], [xo(hipY) - 0.5, hipY], [xo(y1) - 0.5, y1]])]), STITCH));
    out.push(path('Stitch inseam', withMirror([poly([[xi(g[1] + 1) + 0.5, g[1] + 1], [xi(y1) + 0.5, y1]])]), STITCH));
    const y = len - 1.2;
    out.push(path('Stitch hem', withMirror([poly([[xi(y) + 0.05, y], [xo(y) - 0.05, y]])]), STITCH));
  }
  out.push(path('Seam center', poly([[0, front && p.band === 'belt' ? wb + 8.4 : wb], [0, rise - 0.1]]), SEAM));

  if (front) {
    if (p.band === 'belt') {
      // fly and button
      out.push(path('Stitch fly', P(`M -1.2 ${wb} L -1.2 ${wb + 6.6} C -1.2 ${wb + 8} -0.4 ${wb + 8.6} 0 ${wb + 8.4}`), STITCH));
      out.push(path('Hardware button', circ(0, wb * 0.5, 0.42), { fill: '#BDBDBD', w: 0.9 }));
    }
    if (p.band === 'elastic' && p.cord) {
      for (const s of [1, -1]) {
        out.push(eyelet(s * 1.15, wb * 0.5, s > 0 ? 'R' : 'L'));
        out.push(...cordPaths(`M ${s * 1.15} ${wb * 0.5} C ${s * 1.5} ${wb + 2.5} ${s * 0.4} ${wb + 4.5} ${s * 1.4} ${wb + 7.2}`, s > 0 ? 'R' : 'L'));
        out.push(aglet(s * 1.4, wb + 7.0, s > 0 ? 'R' : 'L'));
      }
    }
    const fp = p.front ?? 'none';
    if (fp === 'slant') {
      const y1 = wb + 7.2;
      const pk = `M ${ww - 3.2} ${wb} C ${ww - 3.7} ${wb + 3} ${xo(y1) - 1.8} ${y1 - 1} ${xo(y1) - 0.1} ${y1}`;
      out.push(path('Seam pocket opening', both(pk), SEAM));
      const pk2 = `M ${ww - 3.7} ${wb + 0.1} C ${ww - 4.2} ${wb + 3} ${xo(y1) - 2.2} ${y1 - 0.6} ${xo(y1) - 0.5} ${y1 + 0.4}`;
      out.push(path('Stitch pocket opening', both(pk2), STITCH));
    } else if (fp === 'scoop') {
      const y1 = wb + 6.6;
      const pk = `M ${ww - 3.3} ${wb} C ${ww - 3.6} ${wb + 3.6} ${xo(y1) - 2.4} ${y1 + 0.2} ${xo(y1) - 0.1} ${y1 - 0.4}`;
      out.push(path('Seam pocket opening', both(pk), SEAM));
      const pk2 = `M ${ww - 3.8} ${wb + 0.1} C ${ww - 4.1} ${wb + 3.8} ${xo(y1) - 2.5} ${y1 + 0.8} ${xo(y1) - 0.4} ${y1 + 0.1}`;
      out.push(path('Stitch pocket opening', both(pk2), STITCH));
      out.push(path('Stitch coin pocket', P(`M ${ww - 6.2} ${wb + 0.5} L ${ww - 6.2} ${wb + 2.6} L ${ww - 3.9} ${wb + 2.6}`), STITCH));
    } else if (fp === 'cargo') {
      const y1 = wb + 6.4;
      const pk = `M ${ww - 3.2} ${wb} L ${xo(y1) - 0.1} ${y1}`;
      out.push(path('Seam pocket opening', both(pk), SEAM));
      out.push(path('Stitch pocket opening', both(`M ${ww - 3.7} ${wb + 0.1} L ${xo(y1) - 0.5} ${y1 + 0.5}`), STITCH));
    }
    if (p.cargo) {
      // side cargo pocket with flap on each leg
      const yc = rise + (len > 30 ? 3.4 : 2.0);
      const hgt = Math.min(8, len - yc - 2.4);
      const xr = xo(yc) - 0.4;
      const w = 5.4;
      const xl = xr - w;
      const body = poly([[xl, yc], [xr, yc], [xr + (xo(yc + hgt) - xo(yc)) * 0.0, yc + hgt], [xl, yc + hgt]], true);
      out.push(path('Pocket cargo R', body, { fill: GREY, w: 1.3 }), path('Pocket cargo L', mir(body), { fill: GREY, w: 1.3 }));
      const flap = poly([[xl - 0.15, yc - 0.3], [xr, yc - 0.3], [xr, yc + 3], [xl - 0.15, yc + 3]], true);
      out.push(path('Pocket flap R', flap, { fill: GREY, w: 1.3 }), path('Pocket flap L', mir(flap), { fill: GREY, w: 1.3 }));
      const ins = inset([[xl - 0.15, yc - 0.3], [xr, yc - 0.3], [xr, yc + 3], [xl - 0.15, yc + 3]], 0.38);
      out.push(path('Stitch flap', withMirror([poly([ins[3], ins[2], ins[1]])]), STITCH));
      const ins2 = inset([[xl, yc + 3.2], [xr, yc + 3.2], [xr, yc + hgt], [xl, yc + hgt]], 0.4);
      out.push(path('Stitch cargo pocket', withMirror([poly([ins2[0], ins2[3], ins2[2], ins2[1]])]), STITCH));
      out.push(path('Hardware button', [circ((xl + xr) / 2, yc + 2.1, 0.32), circ(-(xl + xr) / 2, yc + 2.1, 0.32)], { fill: '#BDBDBD', w: 0.9 }));
    }
    if (p.piping) {
      const y0 = wb, y1 = len - 0.8;
      const off = 1.5;
      out.push(path('Seam side panel', withMirror([poly([[xo(y0) - off, y0], [xo(hipY) - off, hipY], [xo(y1) - off - 0.1, y1]])]), SEAM));
    }
    if (p.mesh) {
      const rows: VSub[] = [];
      for (let y = wb + 2.2; y < len - 1.6; y += 1.15) {
        const xa = Math.max(xi(y) + 0.8, 1.2), xb = xo(y) - 2.4;
        if (xb > xa) rows.push(poly([[xa, y], [xb, y]]));
      }
      out.push(path('Detail mesh', withMirror(rows), { fill: null, stroke: '#A8A8A8', w: 1.5, dash: [0.1, 6.6], cap: 'round' }));
    }
  } else {
    // back
    if (p.band === 'belt') {
      out.push(path('Seam yoke', poly([[-ww + 0.4, wb], [0, wb + 3.9], [ww - 0.4, wb]]), SEAM));
      out.push(path('Stitch yoke', poly([[-ww + 0.6, wb + 0.45], [0, wb + 4.35], [ww - 0.6, wb + 0.45]]), STITCH));
    }
    if (p.backPocket) {
      for (const s of [-1, 1]) {
        const cx = s * 4.4, y = wb + 2.4 + (p.band === 'belt' ? 0.9 : 0);
        const pk: Pt[] = [[cx - 2.9, y], [cx + 2.9, y], [cx + 2.9, y + 5.6], [cx, y + 6.8], [cx - 2.9, y + 5.6]];
        out.push(path(`Pocket back ${s > 0 ? 'R' : 'L'}`, poly(pk, true), { fill: GREY, w: 1.3 }));
        const ins = inset(pk, 0.4);
        out.push(path('Stitch back pocket', poly([ins[4], ins[3], ins[2], ins[1], ins[0]]), STITCH));
        out.push(path('Stitch pocket hem', poly([[cx - 2.9, y + 0.7], [cx + 2.9, y + 0.7]]), STITCH));
      }
    }
    if (p.mesh) {
      const rows: VSub[] = [];
      for (let y = wb + 2.2; y < len - 1.6; y += 1.15) {
        const xa = Math.max(xi(y) + 0.8, 1.2), xb = xo(y) - 2.4;
        if (xb > xa) rows.push(poly([[xa, y], [xb, y]]));
      }
      out.push(path('Detail mesh', withMirror(rows), { fill: null, stroke: '#A8A8A8', w: 1.5, dash: [0.1, 6.6], cap: 'round' }));
    }
    if (p.piping) {
      const y0 = wb, y1 = len - 0.8;
      out.push(path('Seam side panel', withMirror([poly([[xo(y0) - 1.5, y0], [xo(hipY) - 1.5, hipY], [xo(y1) - 1.6, y1]])]), SEAM));
    }
  }
  return out;
}

export function buildBottom(p: BotP, view: View, name: string): VItem {
  return grp(name, build(p, view));
}

export const BOT_PARAMS: Record<string, BotP> = {
  sweatShort: { ww: 9.8, wb: 2.2, hip: 12.2, hipY: 8, rise: 12.4, len: 20, ho: 12.6, hi: 1.4, band: 'elastic', cord: true, hemFold: 1.4, front: 'slant' },
  meshShort: { ww: 9.8, wb: 2, hip: 12.8, hipY: 8, rise: 12, len: 20, ho: 13.8, hi: 1.2, band: 'elastic', cord: true, hemFold: 1.2, piping: true, mesh: true },
  cargoShort: { ww: 9.4, wb: 2, hip: 12.6, hipY: 8, rise: 12.6, len: 24, ho: 13.4, hi: 2, band: 'belt', front: 'cargo', cargo: true, backPocket: true, hemFold: 1.2, jean: false },
  jort: { ww: 9.2, wb: 2, hip: 12.4, hipY: 8, rise: 12.6, len: 25, ho: 13.6, hi: 2.2, band: 'belt', front: 'scoop', backPocket: true, jean: true },
  sweatCuff: { ww: 9.6, wb: 2.2, hip: 12.4, hipY: 8.5, rise: 13.2, len: 40, ho: 8.4, hi: 3.3, band: 'elastic', cord: true, cuff: 3, front: 'slant' },
  sweatWide: { ww: 9.8, wb: 2.4, hip: 13.4, hipY: 8.5, rise: 13.6, len: 41, ho: 15.4, hi: 3, band: 'elastic', cord: true, hemFold: 1.6, front: 'slant' },
  jeanStraight: { ww: 8.6, wb: 1.6, hip: 11.2, hipY: 8, rise: 11.5, len: 41, ho: 9.6, hi: 1.7, band: 'belt', front: 'scoop', backPocket: true, jean: true },
  jeanBaggy: { ww: 9.6, wb: 1.8, hip: 13.8, hipY: 8.5, rise: 13.4, len: 41.5, ho: 15, hi: 3.6, band: 'belt', front: 'scoop', backPocket: true, jean: true },
  cargo: { ww: 9.5, wb: 1.9, hip: 13.2, hipY: 8.5, rise: 13.2, len: 41, ho: 14, hi: 3.2, band: 'belt', front: 'cargo', cargo: true, backPocket: true },
};
