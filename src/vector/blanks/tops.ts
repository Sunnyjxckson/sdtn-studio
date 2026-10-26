// Upper body blanks: tees, long sleeves, sweatshirts, hoodies and jackets, built from one parametric top.
import type { VItem, VSub } from '../../model/vector';
import {
  aglet, bez, both, cordPaths, DETAIL, dist, eyelet, full, GREY, grp, inset, mir, P, path, poly, RIBLN, SEAM, snap, STITCH,
  teeth, TRIM, withMirror, zipPull, ribLines, type Pt,
} from './kit';

export type View = 'front' | 'back';

export interface TopP {
  /** Half chest width at the underarm. */
  ux: number;
  /** Shoulder tip half width and drop. */
  sx: number;
  sy: number;
  /** Underarm depth. */
  ah: number;
  len: number;
  /** Half hem width. */
  hx: number;
  nw: number;
  nd: number;
  /** Sleeve: top edge length, angle below horizontal in degrees, and either underarm length or opening width. */
  slv: { len: number; ang: number; ulen?: number; cw?: number; k?: number };
  raglan?: boolean;
  neck: 'crew' | 'mock' | 'hood' | 'collar' | 'qzip' | 'hzip' | 'coach' | 'anorak';
  /** Neck rib width for crew. */
  rw?: number;
  hemBand?: number;
  hemFold?: number;
  cuffBand?: number;
  slvFold?: number;
  curve?: number;
  pocket?: 'kanga' | 'flaps' | 'welt' | 'zipside' | 'anorak' | 'none';
  /** Zipper length from the neck, 99 for full. */
  zip?: number;
  cord?: boolean;
  ringer?: boolean;
  hoodH?: number;
  /** Back yoke seam depth. */
  yoke?: number;
  hemCord?: boolean;
}

type Side = (y: number) => number;

function build(p: TopP, view: View): VItem[] {
  const front = view === 'front';
  const out: VItem[] = [];
  const { ux, ah, len, nw } = p;
  const rw = p.rw ?? 1;
  const hemBand = p.hemBand ?? 0;
  const noHood = p.neck !== 'hood' && p.neck !== 'anorak';
  const stand = p.neck === 'mock' || p.neck === 'qzip' || p.neck === 'hzip';
  // neck depth at the center front of the body edge
  const nd = front ? p.nd : p.neck === 'hood' || p.neck === 'anorak' ? 1.2 : 0.9;
  const no = nw + 0.4;

  // ---- body outline, right half
  const S: Pt = p.raglan ? [no, 0] : [p.sx, p.sy];
  const sideX: Side = (y) => ux + ((p.hx - ux) * (y - ah)) / (len - ah);
  const c1: Pt = p.raglan ? [no + (ux - no) * 0.35, ah * 0.4] : [S[0] - 0.6, S[1] + (ah - S[1]) * 0.42];
  const c2: Pt = p.raglan ? [ux - 1.4, ah - 1.8] : [ux - 1.5, ah - 1.0];
  let top: string;
  const hasRibNeck = p.neck === 'crew';
  if (hasRibNeck) {
    const ndo = nd + rw;
    top = `M 0 ${ndo} C ${no * 0.55} ${ndo} ${no} ${ndo * 0.5} ${no} 0`;
  } else if (p.neck === 'hood' || p.neck === 'anorak') {
    top = `M 0 ${nd} C ${nw * 0.5} ${nd} ${nw} ${nd * 0.45} ${nw} 0`;
  } else if (stand) {
    top = `M 0 0.9 C ${nw * 0.5} 0.9 ${nw + 0.3} 0.6 ${nw + 0.3} 0.1 L ${nw + 0.3} 0`;
  } else {
    top = `M 0 ${nd} L ${nw} 0.2 L ${nw + 0.3} 0`;
  }
  const hc = p.curve ?? 0;
  const hemEnd = (lift: number) =>
    hc ? `L ${p.hx} ${len - hc - lift} C ${p.hx * 0.88} ${len - hc * 0.15 - lift} ${p.hx * 0.5} ${len - lift} 0 ${len - lift}` : `L ${p.hx} ${len - lift} L 0 ${len - lift}`;
  const startX = hasRibNeck ? no : stand ? nw + 0.3 : p.neck === 'hood' || p.neck === 'anorak' ? nw : nw + 0.3;
  const bodyD = p.raglan
    ? `${top} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${ux} ${ah} ${hemEnd(0)}`
    : `${top} L ${S[0]} ${S[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${ux} ${ah} ${hemEnd(0)}`;
  void startX;

  // ---- sleeves
  const a = (p.slv.ang * Math.PI) / 180;
  const d: Pt = [Math.cos(a), Math.sin(a)];
  const nrm: Pt = [-d[1], d[0]];
  const kk = p.slv.k ?? 0;
  const K: Pt = [S[0] + Math.cos(0.38) * kk, S[1] + Math.sin(0.38) * kk];
  const T: Pt = [K[0] + d[0] * p.slv.len, K[1] + d[1] * p.slv.len];
  const U: Pt = [ux, ah];
  const B: Pt = p.slv.ulen ? [U[0] + d[0] * p.slv.ulen, U[1] + d[1] * p.slv.ulen] : [T[0] + nrm[0] * p.slv.cw!, T[1] + nrm[1] * p.slv.cw!];
  const armBack = p.raglan ? `L ${S[0]} ${S[1]}` : `C ${c2[0]} ${c2[1]} ${c1[0]} ${c1[1]} ${S[0]} ${S[1]}`;
  const slvD = `M ${S[0]} ${S[1]} L ${K[0]} ${K[1]} L ${T[0]} ${T[1]} L ${B[0]} ${B[1]} L ${U[0]} ${U[1]} ${armBack} Z`;
  const slvR = P(slvD);
  const bandName = p.ringer ? 'Trim' : 'Rib';

  const sleeves = [path('Sleeve R', slvR, { fill: GREY, w: 1.5 }), path('Sleeve L', mir(slvR), { fill: GREY, w: 1.5 })];

  // hood sits behind the body in front, over it in back
  const hh = p.hoodH ?? 9.5;
  const hw = nw + 2;
  const hoodOuter = `M ${-hw} 1.6 C ${-hw - 0.4} ${-hh * 0.55} ${-hw * 0.6} ${-hh} 0 ${-hh} C ${hw * 0.6} ${-hh} ${hw + 0.4} ${-hh * 0.55} ${hw} 1.6 Z`;
  if (!noHood && front) out.push(path('Hood', P(hoodOuter), { fill: GREY, w: 1.5 }));

  out.push(...sleeves);
  out.push(path('Body', full(bodyD), { fill: GREY, w: 1.5 }));

  // ---- sleeve cuffs
  const dB = dist(U, B);
  const cuffH = p.cuffBand ?? 0;
  if (cuffH) {
    const T2: Pt = [T[0] - d[0] * cuffH, T[1] - d[1] * cuffH];
    const ub: Pt = [(B[0] - U[0]) / dB, (B[1] - U[1]) / dB];
    const B2: Pt = [B[0] - ub[0] * cuffH, B[1] - ub[1] * cuffH];
    const band = P(`M ${T2[0]} ${T2[1]} L ${T[0]} ${T[1]} L ${B[0]} ${B[1]} L ${B2[0]} ${B2[1]} Z`);
    out.push(path(`${bandName} cuff R`, band, { fill: p.ringer ? TRIM : GREY, w: 1.3 }), path(`${bandName} cuff L`, mir(band), { fill: p.ringer ? TRIM : GREY, w: 1.3 }));
    const lines = p.ringer ? [] : ribLines(T2, B2, T, B, 0.4);
    if (lines.length) out.push(path('Rib lines cuffs', withMirror(lines), RIBLN));
  }
  if (p.slvFold && !cuffH) {
    const f = p.slvFold;
    const T2: Pt = [T[0] - d[0] * f, T[1] - d[1] * f];
    const ub: Pt = [(B[0] - U[0]) / dB, (B[1] - U[1]) / dB];
    const B2: Pt = [B[0] - ub[0] * f, B[1] - ub[1] * f];
    out.push(path('Stitch sleeve hem', withMirror([poly([T2, B2])]), STITCH));
  }
  if (p.ringer && !cuffH) {
    // ringer: contrast sleeve band
    const f = 1.5;
    const T2: Pt = [T[0] - d[0] * f, T[1] - d[1] * f];
    const ub: Pt = [(B[0] - U[0]) / dB, (B[1] - U[1]) / dB];
    const B2: Pt = [B[0] - ub[0] * f, B[1] - ub[1] * f];
    const band = poly([T2, T, B, B2], true);
    out.push(path('Trim cuff R', band, { fill: TRIM, w: 1.3 }), path('Trim cuff L', mir(band), { fill: TRIM, w: 1.3 }));
  }
  if (p.cord && false) out.push();

  // ---- neck
  const nds = nd;
  if (hasRibNeck) {
    const ndo = nds + rw;
    if (front) {
      const by = 1.5;
      const inner = full(`M 0 ${-by} C ${nw * 0.55} ${-by} ${nw} ${-by * 0.6} ${nw} 0 C ${nw} ${nds * 0.5} ${nw * 0.55} ${nds} 0 ${nds}`);
      out.push(path("Detail neck opening", inner, { fill: DETAIL, w: 1.1 }));
      out.push(path('Stitch back neck', both(`M 0 ${-by + 0.7} C ${nw * 0.5} ${-by + 0.7} ${nw - 0.1} ${-by * 0.55} ${nw - 0.1} 0`), STITCH));
    }
    const ring = full(`M 0 ${ndo} C ${no * 0.55} ${ndo} ${no} ${ndo * 0.5} ${no} 0 L ${nw} 0 C ${nw} ${nds * 0.5} ${nw * 0.55} ${nds} 0 ${nds}`);
    out.push(path(`${p.ringer ? 'Trim' : 'Rib'} collar`, ring, { fill: p.ringer ? TRIM : GREY, w: 1.4 }));
    if (!p.ringer) {
      const ls: VSub[] = [];
      const n = 11;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const A = bez([no, 0], [no, ndo * 0.5], [no * 0.55, ndo], [0, ndo], t);
        const Bp = bez([nw, 0], [nw, nds * 0.5], [nw * 0.55, nds], [0, nds], t);
        ls.push(poly([A, Bp]));
      }
      out.push(path('Rib lines collar', withMirror(ls), RIBLN));
    }
    out.push(path('Stitch neck', both(`M ${no - 0.02} 0.3 C ${no - 0.02} ${ndo * 0.55} ${no * 0.55} ${ndo + 0.4} 0 ${ndo + 0.4}`), STITCH));
  }
  if (stand) {
    const ch = p.neck === 'mock' ? 2.6 : 2.2;
    const nwt = nw - 0.25, nwb = nw + 0.35;
    const topY = front ? -ch + 0.5 : -ch + 0.15;
    const botY = front ? 1.0 : 0.5;
    const zipped = p.neck !== 'mock' && front;
    const half = `M 0 ${topY} C ${nwt * 0.5} ${topY} ${nwt * 0.8} ${-ch + 0.15} ${nwt} ${-ch} L ${nwb} 0.1 C ${nwb * 0.7} ${botY * 0.9} ${nwb * 0.3} ${botY} 0 ${botY}`;
    if (zipped) {
      const hs = P(half + ' Z');
      out.push(path('Rib collar R', hs, { fill: GREY, w: 1.4 }), path('Rib collar L', mir(hs), { fill: GREY, w: 1.4 }));
    } else out.push(path('Rib collar', full(half), { fill: GREY, w: 1.4 }));
    const ls: VSub[] = [];
    for (let x = 0.4; x < nwt - 0.1; x += 0.42) {
      const f = x / nwt;
      const yt = topY - (topY + ch) * f * f;
      const yb = botY - (botY - 0.1) * Math.pow(x / nwb, 2.2);
      ls.push(poly([[x, yt + 0.05], [x * (nwb / nwt), yb - 0.05]]));
    }
    out.push(path('Rib lines collar', withMirror(ls), RIBLN));
  }

  if (p.neck === 'hood' || p.neck === 'anorak') {
    if (front) {
      const hi = hh - 1.7;
      const lining = P(
        `M ${-nw} 0 C ${-nw - 0.7} ${-hi * 0.45} ${-nw * 0.7} ${-hi} 0 ${-hi} C ${nw * 0.7} ${-hi} ${nw + 0.7} ${-hi * 0.45} ${nw} 0 C ${nw} ${nd * 0.45} ${nw * 0.5} ${nd} 0 ${nd} C ${-nw * 0.5} ${nd} ${-nw} ${nd * 0.45} ${-nw} 0 Z`
      );
      out.push(path('Detail hood lining', lining, { fill: DETAIL, w: 1.4 }));
      const s = hh - 0.6, w2 = hw - 0.55;
      out.push(path('Stitch hood', P(`M ${-w2} 1.4 C ${-w2 - 0.3} ${-s * 0.55} ${-w2 * 0.6} ${-s} 0 ${-s} C ${w2 * 0.6} ${-s} ${w2 + 0.3} ${-s * 0.55} ${w2} 1.4`), STITCH));
    } else {
      const hd = `M ${-hw} 0.6 C ${-hw - 0.4} ${-hh * 0.55} ${-hw * 0.6} ${-hh} 0 ${-hh} C ${hw * 0.6} ${-hh} ${hw + 0.4} ${-hh * 0.55} ${hw} 0.6 C ${hw * 0.6} 1.9 ${hw * 0.25} 2.4 0 2.4 C ${-hw * 0.25} 2.4 ${-hw * 0.6} 1.9 ${-hw} 0.6 Z`;
      out.push(path('Hood', P(hd), { fill: GREY, w: 1.5 }));
      out.push(path('Seam hood center', P(`M 0 ${-hh} L 0 2.4`), SEAM));
      const s = hh - 0.6, w2 = hw - 0.55;
      out.push(path('Stitch hood', P(`M ${-w2} 0.8 C ${-w2 - 0.3} ${-s * 0.55} ${-w2 * 0.6} ${-s} 0 ${-s} C ${w2 * 0.6} ${-s} ${w2 + 0.3} ${-s * 0.55} ${w2} 0.8`), STITCH));
      out.push(path('Stitch hood center', both(`M 0.45 ${-hh + 0.6} L 0.45 2.0`), STITCH));
    }
  }

  if (p.neck === 'collar' || p.neck === 'coach') {
    const nn = nd;
    const sp = p.neck === 'coach' ? 0.75 : 1;
    if (front) {
      const interior = full(`M 0 -1.3 L ${nw - 0.1} -1.0 L ${nw} 0.2 L 0 ${nn}`);
      out.push(path('Detail collar opening', interior, { fill: DETAIL, w: 1.1 }));
      const leaf: Pt[] = [[0.1, nn], [2.1, nn + 2.7 * sp], [nw + 1.5, 0.9], [nw + 0.5, -1.1], [nw - 0.3, -1.0], [nw, 0.2]];
      const lf = poly(leaf, true);
      out.push(path('Collar R', lf, { fill: GREY, w: 1.4 }), path('Collar L', mir(lf), { fill: GREY, w: 1.4 }));
      const ins = inset(leaf, 0.42);
      out.push(path('Stitch collar', withMirror([poly([ins[1], ins[2], ins[3]])]), STITCH));
    } else {
      const col = full(`M 0 -1.7 C ${nw * 0.5} -1.7 ${nw + 0.2} -1.4 ${nw + 0.5} -1.1 L ${nw + 1.5} 0.9 C ${nw * 0.7} 1.5 ${nw * 0.3} 1.6 0 1.6`);
      out.push(path('Collar', col, { fill: GREY, w: 1.4 }));
      out.push(path('Stitch collar', both(`M 0 -1.2 C ${nw * 0.5} -1.2 ${nw} -1.0 ${nw + 0.2} -0.7`), STITCH));
    }
  }

  // ---- hem
  const sx = (y: number) => sideX(y);
  if (hemBand) {
    const yb = len - hemBand;
    const xs = sx(yb);
    const band = poly([[-xs, yb], [xs, yb], [p.hx, len], [-p.hx, len]], true);
    out.push(path('Rib hem band', band, { fill: GREY, w: 1.4 }));
    out.push(path('Rib lines hem', ribLines([-xs, yb], [xs, yb], [-p.hx, len], [p.hx, len], 0.4), RIBLN));
  } else if (p.hemFold) {
    const y = len - p.hemFold;
    if (hc) out.push(path('Stitch hem', P(`M ${-p.hx + 0.2} ${len - hc - p.hemFold} C ${-p.hx * 0.88} ${len - hc * 0.15 - p.hemFold} ${-p.hx * 0.5} ${y} 0 ${y} C ${p.hx * 0.5} ${y} ${p.hx * 0.88} ${len - hc * 0.15 - p.hemFold} ${p.hx - 0.2} ${len - hc - p.hemFold}`), STITCH));
    else out.push(path('Stitch hem', poly([[-sx(y) + 0.1, y], [sx(y) - 0.1, y]]), STITCH));
  }
  if (hc) {
    // side vents on the curved hem
    out.push(path('Seam side vents', withMirror([poly([[p.hx - 0.1, len - hc - 2.2], [p.hx - 0.1, len - hc]])]), SEAM));
  }
  if (p.hemCord) {
    const y = len - 2.4;
    out.push(path('Stitch hem channel', poly([[-sx(y) + 0.15, y], [sx(y) - 0.15, y]]), STITCH));
  }

  // ---- yoke seam on backs
  if (!front && p.yoke) {
    const y = p.yoke;
    out.push(path('Seam yoke', P(`M ${-xAtArm()} ${y} C ${-xAtArm() * 0.5} ${y + 0.5} ${xAtArm() * 0.5} ${y + 0.5} ${xAtArm()} ${y}`), SEAM));
  }
  function xAtArm() {
    return ux - 0.3;
  }

  // ---- front details
  if (front) {
    const topN = stand ? 0.9 : nd;
    // zipper
    if (p.zip) {
      const y0 = hasRibNeck ? nd : stand ? 0.9 : p.neck === 'hood' || p.neck === 'anorak' ? nd : nd;
      const y1 = p.zip >= 99 ? len : Math.min(len, y0 + p.zip);
      out.push(path('Seam zip tape', [poly([[-0.3, y0 - (stand ? 0.2 : 0)], [-0.3, y1]]), poly([[0.3, y0 - (stand ? 0.2 : 0)], [0.3, y1]])], { fill: null, w: 1 }));
      out.push(path('Hardware zip teeth', teeth(0, y0 + 0.2, y1 - 0.2), { fill: null, stroke: '#7A7A7A', w: 0.7, cap: 'butt' }));
      out.push(path('Stitch zip', withMirror([poly([[0.62, y0 + 0.2], [0.62, y1]])]), STITCH));
      out.push(...zipPull(0, y0 + 0.1, p.neck === 'coach' ? 1 : 1.4));
    }
    void topN;
    if (p.neck === 'coach') {
      // snap placket
      out.push(path('Seam placket', [poly([[-0.9, nd + 0.8], [-0.9, len]]), poly([[0.9, nd + 0.8], [0.9, len]])], SEAM));
      const n = 5;
      for (let i = 0; i < n; i++) out.push(...snap(0, nd + 3 + (i * (len - nd - 6)) / (n - 1), String(i + 1)));
    }

    // drawcord
    if (p.cord && (p.neck === 'hood' || p.neck === 'anorak')) {
      const ey = nd + 0.9;
      for (const sgn of [1, -1]) {
        const ex = 1.55 * sgn;
        out.push(eyelet(ex, ey, sgn > 0 ? 'R' : 'L'));
        out.push(...cordPaths(`M ${ex} ${ey} C ${ex + 0.5 * sgn} ${ey + 3} ${ex - 0.4 * sgn} ${ey + 5.8} ${ex + 0.15 * sgn} ${ey + 8}`, sgn > 0 ? 'R' : 'L'));
        out.push(aglet(ex + 0.15 * sgn, ey + 7.8, sgn > 0 ? 'R' : 'L'));
      }
    }

    // pockets
    const pk = p.pocket ?? 'none';
    if (pk === 'kanga') {
      const ph = Math.min(8.6, (len - hemBand) * 0.34);
      const y1 = len - hemBand - ph - 0.5;
      const w1 = p.ux * 0.52, w2 = p.ux * 0.62;
      const poc: Pt[] = [[-w1, y1], [w1, y1], [w2, y1 + ph], [-w2, y1 + ph]];
      out.push(path('Pocket kangaroo', poly(poc, true), { fill: GREY, w: 1.4 }));
      const ins = inset(poc, 0.5);
      out.push(path('Stitch pocket', poly([ins[3], ins[0], ins[1], ins[2]]), STITCH));
      out.push(path('Seam pocket openings', withMirror([poly([[w1 - 0.3, y1 + 0.2], [w1 + 0.55, y1 + ph * 0.45]])]), SEAM));
    } else if (pk === 'anorak') {
      const ph = Math.min(8, (len - hemBand) * 0.3);
      const y1 = ah - 1.5;
      const w1 = p.ux * 0.7;
      const poc: Pt[] = [[-w1, y1 + 1.6], [0, y1], [w1, y1 + 1.6], [w1, y1 + ph], [-w1, y1 + ph]];
      out.push(path('Pocket chest panel', poly(poc, true), { fill: GREY, w: 1.4 }));
      const ins = inset(poc, 0.5);
      out.push(path('Stitch pocket', poly([ins[0], ins[1], ins[2]]), STITCH));
      out.push(path('Seam pocket zip', poly([[-w1 + 0.9, y1 + 1.9 - 0.1], [-0.35, y1 + 0.55]]), { fill: null, w: 0.9 }));
      out.push(...zipPull(-w1 + 1.4, y1 + 1.4, 1));
    } else if (pk === 'flaps') {
      for (const sgn of [-1, 1]) {
        const cx = sgn * (nw + 2.3 + p.ux * 0.18);
        const y1 = ah - 3.2;
        const w = 2.9;
        const pb: Pt[] = [[cx - w, y1], [cx + w, y1], [cx + w, y1 + 5.4], [cx - w, y1 + 5.4]];
        out.push(path(`Pocket chest ${sgn > 0 ? 'R' : 'L'}`, poly(pb, true), { fill: GREY, w: 1.4 }));
        const fl: Pt[] = [[cx - w - 0.1, y1 - 0.3], [cx + w + 0.1, y1 - 0.3], [cx + w + 0.1, y1 + 2.4], [cx, y1 + 3.1], [cx - w - 0.1, y1 + 2.4]];
        out.push(path(`Pocket flap ${sgn > 0 ? 'R' : 'L'}`, poly(fl, true), { fill: GREY, w: 1.4 }));
        const ins = inset(fl, 0.35);
        out.push(path('Stitch flap', poly([ins[4], ins[3], ins[2]]), STITCH));
        out.push(...snap(cx, y1 + 2.0, sgn > 0 ? 'R' : 'L'));
      }
    } else if (pk === 'welt') {
      for (const sgn of [-1, 1]) {
        const x0 = sgn * (ux * 0.6), y0 = ah + 2.6;
        out.push(path(`Pocket welt ${sgn > 0 ? 'R' : 'L'}`, poly([[x0 - sgn * 0.3, y0], [x0 + sgn * 0.9, y0 + 4.6], [x0 + sgn * 1.4, y0 + 4.5], [x0 - sgn * 0.1, y0 - 0.1]], true), { fill: GREY, w: 1.1 }));
        out.push(path('Stitch welt', poly([[x0 - sgn * 0.6, y0 + 0.1], [x0 + sgn * 0.7, y0 + 4.9]]), STITCH));
      }
    } else if (pk === 'zipside') {
      for (const sgn of [-1, 1]) {
        const x0 = sgn * (ux * 0.58), y0 = len - hemBand - 11;
        const l = poly([[x0, y0], [x0 + sgn * 1.0, y0 + 6.2]]);
        out.push(path('Seam pocket slit', l, { fill: null, w: 1 }));
        out.push(path('Stitch pocket slit', poly([[x0 + sgn * 0.45, y0 - 0.1], [x0 + sgn * 1.45, y0 + 6.1]]), STITCH));
      }
    }

    // half zip placket seams for anorak
    if (p.neck === 'anorak') {
      out.push(path('Seam placket', poly([[-1.1, nd], [-1.1, nd + (p.zip ?? 11)]]), SEAM));
    }
  }
  return out;
}

export function buildTop(p: TopP, view: View, name: string): VItem {
  return grp(name, build(p, view));
}

const ST = { len: 8, ang: 28, ulen: 6.4 };
export const TOP_PARAMS: Record<string, TopP> = {
  tee: { ux: 10, sx: 8.4, sy: 1.1, ah: 8.6, len: 28, hx: 10, nw: 3.9, nd: 3.0, slv: { ...ST }, neck: 'crew', rw: 1, hemFold: 1 , slvFold: 0.9, yoke: 5.5 },
  teeBoxy: { ux: 11.5, sx: 9.6, sy: 1.2, ah: 9, len: 26, hx: 11.5, nw: 4.1, nd: 3.1, slv: { len: 8.5, ang: 24, ulen: 7.4 }, neck: 'crew', rw: 1.1, hemFold: 1, slvFold: 1, yoke: 5.5 },
  teeOver: { ux: 12.8, sx: 11.6, sy: 1.5, ah: 10.6, len: 29, hx: 13, nw: 4.4, nd: 3.2, slv: { len: 10, ang: 20, ulen: 9.2 }, neck: 'crew', rw: 1.2, hemFold: 1.1, slvFold: 1.1, yoke: 6 },
  teeCrop: { ux: 11.5, sx: 9.8, sy: 1.2, ah: 8.8, len: 20, hx: 11.8, nw: 4.1, nd: 3.0, slv: { len: 8, ang: 24, ulen: 7 }, neck: 'crew', rw: 1.1, hemFold: 1, slvFold: 1 },
  teeRaglan: { ux: 9.8, sx: 4.3, sy: 0.3, ah: 8.8, len: 28, hx: 10, nw: 3.9, nd: 3.0, slv: { len: 14.2, ang: 30, ulen: 7 }, raglan: true, neck: 'crew', rw: 1, hemFold: 1, slvFold: 0.9 },
  teeLong: { ux: 10.8, sx: 9, sy: 1.1, ah: 9, len: 33, hx: 11, nw: 4, nd: 3.0, slv: { len: 8.5, ang: 26, ulen: 7 }, neck: 'crew', rw: 1.1, hemFold: 1, slvFold: 1, curve: 3.4, yoke: 5.5 },
  teeRinger: { ux: 10, sx: 8.4, sy: 1.1, ah: 8.6, len: 28, hx: 10, nw: 3.9, nd: 3.0, slv: { ...ST }, neck: 'crew', rw: 1, hemFold: 1, ringer: true, yoke: 5.5 },
  ls: { ux: 10, sx: 8.4, sy: 1.1, ah: 8.6, len: 28, hx: 10, nw: 3.9, nd: 3.0, slv: { len: 20.8, k: 3.4, ang: 64, cw: 4.4 }, neck: 'crew', rw: 1, hemFold: 1, slvFold: 1.1, yoke: 5.5 },
  lsRaglan: { ux: 9.8, sx: 4.3, sy: 0.3, ah: 8.8, len: 28, hx: 10, nw: 3.9, nd: 3.0, slv: { len: 26.3, k: 3.4, ang: 64, cw: 4.4 }, raglan: true, neck: 'crew', rw: 1, hemFold: 1, slvFold: 1.1 },
  lsCrop: { ux: 11.3, sx: 9.7, sy: 1.2, ah: 8.8, len: 20, hx: 11.6, nw: 4.1, nd: 3.0, slv: { len: 19.3, k: 3.4, ang: 66, cw: 4.4 }, neck: 'crew', rw: 1.1, hemFold: 1, slvFold: 1.1 },
  mock: { ux: 10, sx: 8.4, sy: 1.1, ah: 8.6, len: 28, hx: 10, nw: 3.7, nd: 1, slv: { len: 20.8, k: 3.4, ang: 64, cw: 4.4 }, neck: 'mock', hemFold: 1, slvFold: 1.1 },
  crew: { ux: 11, sx: 9.1, sy: 1.2, ah: 9.2, len: 26.5, hx: 11, nw: 4, nd: 3.2, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.8 }, neck: 'crew', rw: 1.2, hemBand: 2.6, cuffBand: 2.8, yoke: 0 },
  crewOver: { ux: 13.2, sx: 12.2, sy: 1.6, ah: 11, len: 28, hx: 13.2, nw: 4.4, nd: 3.3, slv: { len: 21.3, k: 3.4, ang: 60, cw: 4.2 }, neck: 'crew', rw: 1.3, hemBand: 2.8, cuffBand: 3, },
  crewCrop: { ux: 12, sx: 10.2, sy: 1.3, ah: 9.2, len: 20, hx: 12, nw: 4.1, nd: 3.1, slv: { len: 19.8, k: 3.4, ang: 62, cw: 3.8 }, neck: 'crew', rw: 1.2, hemBand: 2.4, cuffBand: 2.8 },
  qzip: { ux: 11, sx: 9.1, sy: 1.2, ah: 9.2, len: 27, hx: 11, nw: 3.8, nd: 1, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.8 }, neck: 'qzip', zip: 8, hemBand: 2.6, cuffBand: 2.8 },
  hzip: { ux: 11, sx: 9.1, sy: 1.2, ah: 9.2, len: 27, hx: 11, nw: 3.8, nd: 1, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.8 }, neck: 'hzip', zip: 14, hemBand: 2.6, cuffBand: 2.8 },
  hood: { ux: 11.5, sx: 9.6, sy: 1.3, ah: 9.6, len: 27.5, hx: 11.5, nw: 4, nd: 3.8, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.9 }, neck: 'hood', hemBand: 2.8, cuffBand: 3, pocket: 'kanga', cord: true, hoodH: 9.5 },
  hoodZip: { ux: 11.5, sx: 9.6, sy: 1.3, ah: 9.6, len: 27.5, hx: 11.5, nw: 4, nd: 2.6, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.9 }, neck: 'hood', hemBand: 2.8, cuffBand: 3, pocket: 'zipside', cord: true, zip: 99, hoodH: 9.5 },
  hoodOver: { ux: 14, sx: 12.6, sy: 1.7, ah: 11.4, len: 29, hx: 14, nw: 4.4, nd: 3.9, slv: { len: 21.3, k: 3.4, ang: 58, cw: 4.4 }, neck: 'hood', hemBand: 3, cuffBand: 3.2, pocket: 'kanga', cord: true, hoodH: 11 },
  hoodCrop: { ux: 12.8, sx: 10.8, sy: 1.4, ah: 9.6, len: 20.5, hx: 12.8, nw: 4.1, nd: 3.7, slv: { len: 20.3, k: 3.4, ang: 60, cw: 3.9 }, neck: 'hood', hemBand: 2.6, cuffBand: 3, pocket: 'kanga', cord: true, hoodH: 9.5 },
  hoodPlain: { ux: 11.5, sx: 9.6, sy: 1.3, ah: 9.6, len: 27.5, hx: 11.5, nw: 4, nd: 3.8, slv: { len: 20.8, k: 3.4, ang: 62, cw: 3.9 }, neck: 'hood', hemBand: 2.8, cuffBand: 3, cord: true, hoodH: 9.5 },
  anorak: { ux: 12.4, sx: 10.5, sy: 1.4, ah: 10, len: 28, hx: 12.8, nw: 4.1, nd: 3.6, slv: { len: 21.3, k: 3.4, ang: 60, cw: 4.2 }, neck: 'anorak', zip: 11, cuffBand: 1.6, pocket: 'anorak', cord: true, hoodH: 10, hemCord: true },
  work: { ux: 12.6, sx: 10.9, sy: 1.3, ah: 9.6, len: 22, hx: 12.8, nw: 3.8, nd: 1.2, slv: { len: 20.8, k: 3.4, ang: 62, cw: 4.2 }, neck: 'collar', zip: 99, hemBand: 2.6, cuffBand: 2.4, pocket: 'flaps', yoke: 5 },
  coach: { ux: 12.2, sx: 10.4, sy: 1.3, ah: 10, len: 28.5, hx: 12.4, nw: 3.9, nd: 1.2, slv: { len: 21.8, k: 3.4, ang: 62, cw: 4.4 }, neck: 'coach', hemBand: 1.6, cuffBand: 1.5, pocket: 'welt', yoke: 4.5 },
};
