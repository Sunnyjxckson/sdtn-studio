// Pattern piece generators. Each piece is a polygon in local inches (y runs down) plus its marks.
import { bandHeight, findPoint, PX_IN_H, PX_IN_V, type Garment } from './garment';
import type { TorsoProfile } from './figure';
import { uv } from './top';
import { cubic, dedupe, pathLen, quad, bbox, type P } from './patternGeo';

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type SizeName = (typeof SIZES)[number];

/** Grade rules: how much each measurement grows per size step. Inches. */
export interface GradeRules {
  /** Chest, waist, hip and sweep, as a circumference. */
  girth: number;
  length: number;
  shoulder: number;
  sleeve: number;
  /** Flat width of a sleeve, knee or leg opening. */
  width: number;
  rise: number;
  /** Inseam and skirt length. */
  inseam: number;
}
export const DEFAULT_RULES: GradeRules = { girth: 2, length: 0.25, shoulder: 0.25, sleeve: 0.25, width: 0.25, rise: 0.25, inseam: 0.5 };
export const RULE_LABELS: { k: keyof GradeRules; label: string }[] = [
  { k: 'girth', label: 'Chest, waist, hip (round)' },
  { k: 'length', label: 'Body length' },
  { k: 'shoulder', label: 'Shoulder width' },
  { k: 'sleeve', label: 'Sleeve length' },
  { k: 'width', label: 'Sleeve and leg width' },
  { k: 'rise', label: 'Rise and hip depth' },
  { k: 'inseam', label: 'Inseam, skirt length' },
];

export interface RawPiece {
  id: string;
  name: string;
  cut: number;
  poly: P[];
  /** The edge on x = 0 is a fold line (no seam allowance). */
  fold?: boolean;
  /** Cut as a mirrored pair. */
  mirror?: boolean;
  /** Allowance on the bottom edge when it is a hem. */
  hemSA?: number;
  saFn?: (a: P, b: P) => number;
  /** Vertical grain at x, or horizontal grain at y when `horizontal`. */
  grain: { x: number; y?: number; horizontal?: boolean; span?: number };
  notches: P[];
  lines?: { pts: P[]; kind: 'pleat' | 'place' | 'fold' | 'mark' }[];
  label: P;
  notes?: string[];
}

const SEAM_SA = 0.375;

export function saFor(r: RawPiece): (a: P, b: P) => number {
  const bb = bbox(r.poly);
  return (a, b) => {
    if (r.saFn) return r.saFn(a, b);
    if (r.fold && Math.abs(a[0]) < 1e-6 && Math.abs(b[0]) < 1e-6) return 0;
    if (r.hemSA && Math.abs(a[1] - b[1]) < 0.02 && a[1] > bb.y1 - 0.05) return r.hemSA;
    return SEAM_SA;
  };
}

const stepOf = (size: SizeName, base: SizeName) => SIZES.indexOf(size) - SIZES.indexOf(base);

// ---------------------------------------------------------------- bottoms

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
  const length = Math.max(rise + 1, (hemY - seam) / PX_IN_V);
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

function gradeMeasures(m: Measures, k: number, r: GradeRules): Measures {
  if (!k) return m;
  const inseam = r.inseam * k;
  return {
    ...m,
    waist: m.waist + r.girth * k,
    hip: m.hip + r.girth * k,
    rise: m.rise + r.rise * k,
    hipDepth: m.hipDepth + r.rise * k * 0.5,
    length: m.length + inseam + r.rise * k,
    kneeY: m.kneeY + inseam * 0.5 + r.rise * k,
    knee: m.knee + r.width * k,
    opening: m.opening + r.width * k,
  };
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

const rect = (w: number, h: number): P[] => [[0, 0], [w, 0], [w, h], [0, h]];

function jeansPieces(m0: Measures, g?: Garment): RawPiece[] {
  const kind = g?.pants?.block;
  const m = kind === 'Jogger' ? { ...m0, length: Math.max(m0.rise + 2, m0.length - 2.5) } : m0;
  const out: RawPiece[] = [];
  const front = legPanel(m, false);
  const fb = bbox(front.poly);
  out.push({ id: 'front', name: 'Front leg panel', cut: 2, mirror: true, hemSA: 1, poly: dedupe(front.poly), grain: { x: front.ax }, notches: front.notches, label: [front.ax + 0.9, fb.y1 * 0.3] });

  const back = legPanel(m, true);
  const yokeY = Math.min(3.2, m.hipDepth * 0.45);
  const bp = dedupe(clipY(back.poly, yokeY, true));
  out.push({ id: 'back', name: 'Back leg panel', cut: 2, mirror: true, hemSA: 1, poly: bp, grain: { x: back.ax }, notches: back.notches.slice(1), label: [back.ax + 0.9, yokeY + (bbox(bp).y1 - yokeY) * 0.3] });
  const yoke = dedupe(clipY(back.poly, yokeY, false));
  out.push({ id: 'yoke', name: 'Back yoke', cut: 2, mirror: true, poly: yoke, grain: { x: back.ax }, notches: [back.notches[0]], label: [back.ax + 0.9, (bbox(yoke).y0 + yokeY) / 2] });

  const len = m.waist + 1.5, h = m.band * 2 + 0.5;
  out.push({ id: 'band', name: 'Waistband', cut: 1, poly: rect(len, h), grain: { x: len / 2, y: h / 2 + 0.55, horizontal: true, span: Math.min(6, len * 0.25) }, notches: [[len / 2, 0], [len * 0.25, 0], [len * 0.75, 0]], label: [len / 2, h / 2 - 0.15] });

  if (m.pocket) {
    const w = Math.max(5, m.waist / 4.6), hh = Math.max(7, m.rise * 0.85);
    const poly: P[] = [[0, 0], [w, 0], [w, hh * 0.78], ...quad([w, hh * 0.78], [w * 0.95, hh], [w * 0.45, hh]), ...quad([w * 0.45, hh], [0, hh * 0.98], [0, hh * 0.55]), [0, hh * 0.55]];
    out.push({ id: 'bag', name: 'Front pocket bag', cut: 2, mirror: true, poly: dedupe(poly), grain: { x: w / 2 }, notches: [[w, hh * 0.3]], label: [w / 2, hh * 0.35] });
  }
  const bw = Math.max(4.5, m.waist * 0.17), bh = bw * 1.1;
  out.push({ id: 'bpocket', name: 'Back pocket', cut: 2, poly: [[0, 0], [bw, 0], [bw, bh * 0.7], [bw / 2, bh], [0, bh * 0.7]], grain: { x: bw / 2 }, notches: [[bw / 2, 0]], label: [bw / 2, bh * 0.4] });
  return kind ? pantsVariant(out, m, kind, g?.pants?.pleats) : out;
}

function pantsVariant(base: RawPiece[], m: Measures, kind: string, pleats?: boolean): RawPiece[] {
  let out = base;
  const lenW = m.waist + 1.5;
  if (kind === 'Legging') {
    out = out.filter((p) => !['yoke', 'bpocket', 'bag'].includes(p.id));
    const back = out.find((p) => p.id === 'back');
    if (back) back.name = 'Back leg panel';
    out = out.map((p) => (p.id === 'band' ? band('band', 'Elastic waistband', lenW * 0.85, 3, 1, ['stretch fabric, join into a loop']) : p));
    out.forEach((p) => (p.notes = [...(p.notes ?? []), 'four way stretch, use a stretch stitch']));
    return out;
  }
  if (kind === 'Jogger') {
    out = out.map((p) => (p.id === 'band' ? band('band', 'Waistband', lenW, 5, 1, ['casing for elastic and drawcord']) : p));
    out.push(band('cuff', 'Rib ankle cuff', Math.max(6, m.opening * 0.8), 5, 2, ['rib, fold in half'], true));
    return out;
  }
  if (kind === 'Trouser') {
    out = out.filter((p) => p.id !== 'bpocket');
    out = out.map((p) => (p.id === 'band' ? band('band', 'Waistband', lenW + 1.5, m.band * 2 + 0.5, 1, ['interface, extension on the right']) : p));
    const front = out.find((p) => p.id === 'front');
    if (front) {
      const bb = bbox(front.poly);
      const x0 = bb.x0 + (bb.x1 - bb.x0) * 0.2;
      const ln = pleats ? [x0, x0 + 1.4] : [];
      front.lines = [...ln.map((x) => ({ kind: 'pleat' as const, pts: [[x, 0.2], [x, 3.8]] as P[] })), { kind: 'mark' as const, pts: [[bb.x0 + (bb.x1 - bb.x0) * 0.5, 0.5], [bb.x0 + (bb.x1 - bb.x0) * 0.5, bb.y1 - 1.5]] as P[] }];
      if (pleats) front.notes = ['fold pleats toward the side seam'];
    }
    const wp = 5.5, hp = 1.5;
    out.push({ id: 'welt', name: 'Back welt', cut: 2, poly: rect(wp, hp), grain: { x: wp / 2 }, notches: [], label: [wp / 2, hp / 2] });
    return out;
  }
  if (kind === 'Cargo') {
    const w = Math.max(7, m.waist * 0.25), h = 8;
    out.push({ id: 'cargo', name: 'Cargo pocket', cut: 2, mirror: true, poly: rect(w, h), grain: { x: w / 2 }, notches: [[w / 2, 0]], label: [w / 2, h / 2], notes: ['patch, 1 in hem on top'] });
    out.push({ id: 'cargoflap', name: 'Cargo flap', cut: 2, mirror: true, poly: [[0, 0], [w, 0], [w, 3], [w / 2, 3.8], [0, 3]], grain: { x: w / 2 }, notches: [], label: [w / 2, 1.5] });
    return out;
  }
  return out;
}

interface SkirtDims {
  waist: number;
  hip: number;
  sweep: number;
  L: number;
  hipDepth: number;
  band: number;
  pleated: boolean;
  wrap: boolean;
}

function skirtDims(g: Garment): SkirtDims {
  const p = g.points;
  const wl = findPoint(p, 'waistL'), wr = findPoint(p, 'waistR');
  const hl = findPoint(p, 'hemL'), hr = findPoint(p, 'hemR');
  const hemY = Math.min(g.cropY ?? Infinity, Math.max(hl.y, hr.y));
  const L = Math.max(6, (hemY - wl.y) / PX_IN_V);
  return {
    waist: (2 * Math.abs(wr.x - wl.x)) / 9,
    hip: (2 * Math.abs(findPoint(p, 'hipR').x - findPoint(p, 'hipL').x)) / 9,
    sweep: (2 * Math.abs(hr.x - hl.x)) / 9,
    L,
    hipDepth: Math.min(L - 2, Math.max(4, (findPoint(p, 'hipR').y - wl.y) / PX_IN_V)),
    band: bandHeight(g.parts.waist) / PX_IN_V,
    pleated: g.skirt?.shape === 'Pleated',
    wrap: g.skirt?.shape === 'Wrap',
  };
}

function gradeSkirt(s: SkirtDims, k: number, r: GradeRules): SkirtDims {
  if (!k) return s;
  return { ...s, waist: s.waist + r.girth * k, hip: s.hip + r.girth * k, sweep: s.sweep + r.girth * k, L: s.L + r.inseam * k, hipDepth: s.hipDepth + r.rise * k * 0.5 };
}

/** Pleat layout: knife pleats, fold line to placement line is the depth, intake is twice that. */
export const PLEAT_DEPTH = 1.25;
export const PLEATS_PER_PANEL = 6;

function pleatedPanel(s: SkirtDims, back: boolean): RawPiece {
  const n = PLEATS_PER_PANEL, D = PLEAT_DEPTH;
  const intake = n * 2 * D;
  const W0 = s.waist / 2 + intake, W1 = Math.max(s.sweep, s.waist) / 2 + intake;
  const L = s.L;
  const poly: P[] = [[0, 0], [W0, 0], [W1, L], [0, L]];
  const lines: NonNullable<RawPiece['lines']> = [];
  for (let k = 0; k < n; k++) {
    const u0 = W0 / n, u1 = W1 / n;
    const g0 = u0 - 2 * D, g1 = u1 - 2 * D;
    const f0 = k * u0 + g0 / 2, f1 = k * u1 + g1 / 2;
    lines.push({ kind: 'fold', pts: [[f0, 0], [f1, L]] });
    lines.push({ kind: 'place', pts: [[f0 + D, 0], [f1 + D, L]] });
  }
  return {
    id: back ? 'back' : 'front',
    name: back ? 'Back panel' : 'Front panel',
    cut: 1,
    hemSA: 1.5,
    poly,
    grain: { x: W0 * 0.5 },
    notches: [[0, s.hipDepth], [W1, s.hipDepth]],
    lines,
    label: [W0 * 0.5, L * 0.5],
    notes: [`${n} pleats, ${D} in deep`, `intake ${(2 * D).toFixed(2).replace(/\.?0+$/, '')} in each, ${intake.toFixed(1).replace(/\.0$/, '')} in total`, 'solid: fold  dashed: bring to'],
  };
}

function skirtPieces(s: SkirtDims): RawPiece[] {
  const out: RawPiece[] = [];
  if (s.pleated) {
    out.push(pleatedPanel(s, false), pleatedPanel(s, true));
  } else {
    for (const back of [false, true]) {
      const wq = s.waist / 4 + 0.25, hq = s.hip / 4 + 0.5, sq = s.sweep / 4;
      const hd = s.hipDepth + (back ? 0.3 : 0);
      const poly: P[] = [[0, 0], [wq, back ? -0.4 : 0], ...quad([wq, 0], [(wq + hq) / 2 + 0.2, hd * 0.5], [hq, hd]), [sq, s.L], [0, s.L]];
      const gx = Math.max(wq, sq) * 0.35;
      out.push({ id: back ? 'back' : 'front', name: back ? 'Back panel' : 'Front panel', cut: 1, fold: true, hemSA: 1.5, poly: dedupe(poly), grain: { x: gx }, notches: [[hq, hd]], label: [Math.max(wq, sq) * 0.62, s.L * 0.38] });
    }
  }
  const len = s.waist + 1.5, h = s.band * 2 + 0.5;
  out.push({ id: 'band', name: 'Waistband', cut: 1, poly: rect(len, h), grain: { x: len / 2, y: h / 2 + 0.55, horizontal: true, span: Math.min(6, len * 0.25) }, notches: [[len / 2, 0], [len * 0.25, 0], [len * 0.75, 0]], label: [len / 2, h / 2 - 0.15] });
  return out;
}

// ---------------------------------------------------------------- tops

export interface TopDims {
  block: string;
  chest: number;
  waist: number;
  hem: number;
  shoulder: number;
  neckHalf: number;
  dropF: number;
  dropB: number;
  armY: number;
  tipDrop: number;
  waistY: number;
  len: number;
  sleeveLen: number;
  bicep: number;
  capH: number;
  sleeveHem: number;
  strapped: boolean;
  bare: boolean;
  vee: boolean;
  /** Dress only. */
  dress?: { waist: number; hip: number; mid: number; hem: number; L: number; hipDepth: number; topY: number; dip: number };
  torso: number;
  cuffed: boolean;
}

const bodyLenAt = (v: number, torso: number) => (v <= 1 ? v * torso : v <= 1.5 ? torso + (v - 1) * 14 : torso + 7 + ((v - 1.5) / 1.1) * 30);
const yOf = (v: number, torso: number) => bodyLenAt(v, torso) + 2;

export function topDims(g: Garment, t: TorsoProfile): TopDims {
  const o = g.top!;
  const at = (k: string) => g.points.find((p) => p.key === k);
  const inch = t.inches;
  const torso = inch.torso;
  const hs = (a?: { x: number; y: number }, b?: { x: number; y: number }) => (a && b ? (uv(b).u - uv(a).u) / 2 : 1);
  const aL = at('armL'), aR = at('armR');
  const bare = !at('shL') && !at('strapL');
  const strapped = !!at('strapL');
  const chest = inch.chest * hs(aL, aR);
  const waist = inch.chest * 0.92 * hs(at('sideL'), at('sideR'));
  const hem = inch.chest * 0.92 * hs(at('hemL'), at('hemR'));
  const sL = at('shL') ?? at('strapL'), sR = at('shR') ?? at('strapR');
  const shoulder = sL && sR ? inch.shoulder * hs(sL, sR) : inch.shoulder;
  const nF = at('neckF');
  const armV = aL ? uv(aL).v : 0.32;
  const drop = Math.max(0, armV - 0.32);
  const armY = yOf(armV, torso);
  const tipDrop = strapped ? 1.0 : 1.3 + drop * 8;
  const nHalf0 = inch.shoulder * hs(at('neckL'), at('neckR')) * 0.72;
  const neckHalf = strapped ? Math.min(nHalf0, shoulder / 2 - 1.2) : nHalf0;
  const dropF = Math.max(1.8, (nF ? uv(nF).v : 0.07) * torso + 1.6);
  const slO = at('slOL'), slI = at('slIL');
  const dO = slO && slI ? (slI.y - slO.y) / 100 : 2.4;
  const sleeveLen = slO ? (slO.x / 100) * (inch.arm / 2) : 0;
  const bicep = dO * inch.chest * 0.0788;
  const hAdj = armY - tipDrop;
  const capH = Math.max(1.6, 0.62 * hAdj * (1 - 3 * drop));
  const long = sleeveLen > 1.5 * (inch.arm / 2);
  const sleeveHem = long ? bicep * 0.64 : bicep * 0.93;
  const waistKey = at('sideL');
  const waistV = waistKey ? Math.min(1, uv(waistKey).v) : 1;
  const hemKey = at('hemL');
  const len = hemKey ? yOf(uv(hemKey).v, torso) : yOf(1.1, torso);
  const d: TopDims = {
    block: o.block,
    chest,
    waist,
    hem,
    shoulder,
    neckHalf,
    dropF,
    dropB: 0.9,
    armY,
    tipDrop,
    waistY: yOf(waistV, torso),
    len,
    sleeveLen,
    bicep,
    capH,
    sleeveHem,
    strapped,
    bare,
    vee: !!nF?.vee || o.neck === 'V',
    torso,
    cuffed: styleOf(o).rib,
  };
  if (o.block === 'Dress') {
    const hv = at('hemL') ? uv(at('hemL')!).v : 2;
    const sk1 = at('sk1L'), sk1R = at('sk1R'), sk2 = at('sk2L'), sk2R = at('sk2R');
    const hemK = at('hemL'), hemR = at('hemR');
    d.dress = {
      waist: inch.chest * 0.92 * hs(at('sideL'), at('sideR')),
      hip: inch.chest * 0.92 * hs(sk1, sk1R),
      mid: inch.chest * 0.92 * hs(sk2, sk2R),
      hem: inch.chest * 0.92 * hs(hemK, hemR),
      L: Math.max(8, bodyLenAt(hv, torso) - torso),
      hipDepth: 7,
      topY: yOf(0.33, torso),
      dip: Math.max(0.4, ((nF ? uv(nF).v : 0.355) - 0.33) * torso),
    };
    d.len = d.waistY;
    d.hem = d.waist;
  }
  return d;
}

function gradeTop(d: TopDims, k: number, r: GradeRules): TopDims {
  if (!k) return d;
  const out: TopDims = {
    ...d,
    chest: d.chest + r.girth * k,
    waist: d.waist + r.girth * k,
    hem: d.hem + r.girth * k,
    shoulder: d.shoulder + r.shoulder * k,
    armY: d.armY + r.length * k * 0.5,
    waistY: d.waistY + r.length * k * 0.5,
    len: d.len + r.length * k,
    sleeveLen: d.sleeveLen + r.sleeve * k,
    bicep: d.bicep + r.width * k,
    sleeveHem: d.sleeveHem + r.width * k * 0.7,
    capH: d.capH + r.length * k * 0.25,
  };
  if (d.dress) {
    out.dress = { ...d.dress, waist: d.dress.waist + r.girth * k, hip: d.dress.hip + r.girth * k, mid: d.dress.mid + r.girth * k, hem: d.dress.hem + r.girth * k, L: d.dress.L + r.inseam * k };
    out.len = out.waistY;
    out.hem = out.waist;
  }
  return out;
}

function neckCurve(nh: number, drop: number, vee: boolean): P[] {
  // from the centre front up to the high point of the shoulder
  if (vee) return [[0, drop], [nh * 0.5, drop * 0.5], [nh, 0]];
  const out: P[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    out.push([nh * Math.sin(a), drop * Math.cos(a)]);
  }
  return out;
}

interface BodiceOpts {
  back: boolean;
  len: number;
  hem: number;
  waistY?: number;
  /** Dress and tank style open shoulders. */
  strapped?: boolean;
  bare?: boolean;
}

function bodice(d: TopDims, o: BodiceOpts): { poly: P[]; neckPts: P[]; ux: number; armLen: number } {
  const ux = d.chest / 4;
  const nh = d.neckHalf;
  const st = d.shoulder / 2;
  const dropN = o.back ? d.dropB : d.dropF;
  const pts: P[] = [];
  let neckPts: P[] = [];
  let armLen = 0;
  if (o.bare && d.dress) {
    const tw = ux * 0.97;
    const dip = o.back ? 0.5 : d.dress.dip;
    const topY = d.dress.topY;
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      pts.push([tw * u, topY + dip * (1 - u) * (1 - u)]);
    }
    neckPts = [...pts];
    pts.push([ux, topY + 1.0]);
  } else {
    neckPts = neckCurve(nh, dropN, !o.back && d.vee);
    pts.push(...neckPts);
    pts.push([st, d.tipDrop]);
    const h = d.armY - d.tipDrop;
    const bend = o.back ? 0.25 : 0.55;
    const c1: P = [st - (d.strapped ? 0.25 : 0.45) * bend * 1.6, d.tipDrop + h * 0.34];
    const c2: P = [st + (ux - st) * (d.strapped ? 0.45 : 0.55), d.armY - h * (o.back ? 0.02 : 0.04)];
    const arm = cubic([st, d.tipDrop], c1, c2, [ux, d.armY], 12);
    armLen = pathLen([[st, d.tipDrop], ...arm]);
    pts.push(...arm);
  }
  const wx = d.waist / 4, hx = o.hem / 4;
  const wy = o.waistY ?? d.waistY;
  if (o.len > wy + 1.5 && Math.abs(wx - (ux + (hx - ux) * ((wy - d.armY) / (o.len - d.armY)))) > 0.25) pts.push([wx, wy]);
  pts.push([hx, o.len]);
  pts.push([0, o.len]);
  return { poly: pts, neckPts, ux, armLen };
}

function sleevePiece(d: TopDims, len: number, hemW: number, hemSA: number): RawPiece {
  const W = d.bicep, cap = d.capH, L = Math.max(cap + 1, len + d.capH * 0.45);
  const cx = W / 2;
  const T: P = [cx, 0];
  const poly: P[] = [T];
  poly.push(...cubic(T, [cx + W * 0.28, 0], [W * 0.97, cap * 0.42], [W, cap], 12));
  poly.push([cx + hemW / 2, L]);
  poly.push([cx - hemW / 2, L]);
  poly.push([0, cap]);
  poly.push(...cubic([0, cap], [W * 0.03, cap * 0.5], [cx - W * 0.26, 0], T, 12).slice(0, -1));
  return {
    id: 'sleeve',
    name: 'Sleeve',
    cut: 2,
    mirror: true,
    hemSA,
    poly: dedupe(poly),
    grain: { x: cx, y: cap + (L - cap) * 0.1 },
    notches: [T, [W * 0.1, cap * 0.62], [W * 0.9, cap * 0.62], [W * 0.95, cap * 0.78]],
    label: [cx, cap + (L - cap) * 0.5],
  };
}

const band = (id: string, name: string, w: number, h: number, cut: number, notes?: string[], fold = false): RawPiece => ({
  id,
  name,
  cut,
  poly: rect(w, h),
  grain: { x: w / 2, y: h / 2 + 0.6, horizontal: true, span: Math.min(5, w * 0.25) },
  notches: [[w / 2, 0], [w * 0.25, 0], [w * 0.75, 0]],
  label: [w / 2, h / 2 - 0.2],
  notes,
  lines: fold ? [{ kind: 'fold', pts: [[0, h / 2], [w, h / 2]] }] : undefined,
});

function hoodPiece(d: TopDims, neckLen: number): RawPiece {
  const w = Math.max(10, neckLen * 1.25);
  const h = Math.max(11, d.chest * 0.36);
  // front edge at x = 0, neck seam along the bottom, centre back seam on the right
  const poly: P[] = [[0, h]];
  poly.push(...quad([0, h], [w * 0.5, h + 0.9], [w, h - 0.2], 8));
  poly.push(...cubic([w, h - 0.2], [w * 1.0, h * 0.6], [w * 1.0, h * 0.18], [w * 0.62, 0.05], 12));
  poly.push(...cubic([w * 0.62, 0.05], [w * 0.28, -0.1], [w * 0.0, h * 0.14], [0, h * 0.34], 10));
  const edge = (a: P, b: P) => (Math.abs(a[0]) < 1e-6 && Math.abs(b[0]) < 1e-6 ? 1.25 : SEAM_SA);
  return {
    id: 'hood',
    name: 'Hood side',
    cut: 2,
    mirror: true,
    poly: dedupe(poly),
    saFn: edge,
    grain: { x: w * 0.38, y: h * 0.25 },
    notches: [[w * 0.62, 0.05], [w * 0.5, h + 0.45], [w * 0.97, h * 0.62]],
    label: [w * 0.5, h * 0.55],
    notes: ['face edge 1.25 in for the drawcord casing'],
  };
}

function topPieces(d: TopDims, g: Garment): RawPiece[] {
  const o = g.top!;
  const out: RawPiece[] = [];
  const dress = o.block === 'Dress';
  const bandH = 2.5;

  if (dress && d.dress) {
    const bareTop = d.bare;
    for (const back of [false, true]) {
      const b = bodice(d, { back, len: d.waistY, hem: d.waist, waistY: d.waistY, bare: bareTop, strapped: d.strapped });
      const bb = bbox(b.poly);
      out.push({
        id: back ? 'bodice-b' : 'bodice-f',
        name: back ? 'Back bodice' : 'Front bodice',
        cut: 1,
        fold: true,
        poly: dedupe(b.poly),
        grain: { x: d.chest / 8 },
        notches: [[b.ux, d.armY], [d.waist / 4, d.waistY]],
        label: [d.chest * 0.17, (bb.y0 + bb.y1) / 2 + 1],
      });
    }
    const dr = d.dress;
    for (const back of [false, true]) {
      const wq = dr.waist / 4 + 0.2, hq = dr.hip / 4, mq = dr.mid / 4, sq = dr.hem / 4;
      const poly: P[] = [[0, 0], [wq, 0], ...quad([wq, 0], [(wq + hq) / 2 + 0.1, dr.hipDepth * 0.5], [hq, dr.hipDepth]), ...quad([hq, dr.hipDepth], [mq, (dr.hipDepth + dr.L) / 2], [sq, dr.L], 10), [0, dr.L]];
      out.push({
        id: back ? 'skirt-b' : 'skirt-f',
        name: back ? 'Back skirt' : 'Front skirt',
        cut: 1,
        fold: true,
        hemSA: 1.5,
        poly: dedupe(poly),
        grain: { x: Math.max(wq, sq) * 0.33 },
        notches: [[hq, dr.hipDepth], [wq, 0]],
        label: [Math.max(wq, sq) * 0.62, dr.L * 0.4],
      });
    }
    if ((o.dressTop ?? 'Straps') === 'Straps') {
      out.push(band('strap', 'Strap', 14, 3.2, 2, ['fold lengthwise, stitch, turn']));
    }
    if (d.sleeveLen > 0 && !d.bare && !d.strapped) {
      out.push(sleevePiece(d, d.sleeveLen, d.sleeveHem, 1));
    }
    if (!d.bare) {
      const f = neckCurve(d.neckHalf, d.dropF, d.vee), bk = neckCurve(d.neckHalf, d.dropB, false);
      out.push(band('bind', 'Neck binding', Math.max(12, (pathLen(f) + pathLen(bk)) * 2 * 0.85), 2, 1, ['stretch to fit']));
    }
    return out;
  }

  // everything else: tee family, shirts, sweats and the open-front jackets
  const cfg = styleOf(o);
  const rib = cfg.rib;
  const bodyLen = rib ? d.len - bandH : d.len;
  const mkBody = (back: boolean) => bodice(d, { back, len: bodyLen, hem: d.hem, strapped: d.strapped });
  const nf = neckCurve(d.neckHalf, d.dropF, d.vee), nb = neckCurve(d.neckHalf, d.dropB, false);
  const neckLen = (pathLen(nf) + pathLen(nb)) * 2;
  const labF: P = [d.chest * 0.17, d.armY + 3];
  const nt: P[] = [[d.chest / 4, d.armY], [d.waist / 4, d.waistY]];

  if (cfg.open) {
    const ovl = cfg.ovl;
    const mkFront = (left: boolean) => {
      const b = mkBody(false);
      const pts = b.poly.slice();
      pts[0] = left && ovl > 0 ? [-ovl * 0.44, d.dropF] : [0, d.dropF];
      pts[pts.length - 1] = left ? [-ovl, bodyLen] : [0, bodyLen];
      return { pts, bb: bbox(pts) };
    };
    const zip = (a: P, b: P) => (a[0] <= 0.01 && b[0] <= 0.01 && Math.abs(a[1] - b[1]) > 0.5 ? (cfg.ovl > 0 ? 0.5 : 0.625) : SEAM_SA);
    const front = (id: string, name: string, f: { pts: P[]; bb: ReturnType<typeof bbox> }, cut: number, mirror: boolean): RawPiece => ({
      id,
      name,
      cut,
      mirror,
      hemSA: rib ? undefined : 1,
      saFn: (a, b) => (!rib && Math.abs(a[1] - b[1]) < 0.02 && a[1] > f.bb.y1 - 0.05 ? 1 : zip(a, b)),
      poly: dedupe(f.pts),
      grain: { x: d.chest / 8 },
      notches: nt,
      label: labF,
      notes: cfg.frontNote ? [cfg.frontNote] : undefined,
    });
    if (ovl > 0) out.push(front('front-l', 'Left front (overlap)', mkFront(true), 1, false), front('front-r', 'Right front', mkFront(false), 1, false));
    else out.push(front('front', 'Front', mkFront(false), 2, true));
    const b = mkBody(true);
    out.push({ id: 'back', name: 'Back', cut: 1, fold: true, hemSA: rib ? undefined : 1, poly: dedupe(b.poly), grain: { x: d.chest / 8 }, notches: [[b.ux, d.armY], [b.ux, d.armY + 0.4], nt[1]], label: [labF[0], labF[1] + 0.2] });
    if (d.sleeveLen > 0) {
      const cuff = rib ? bandH : o.block === 'Button-up' ? 1.75 : 0;
      const hemW = o.block === 'Moto jacket' ? Math.max(d.sleeveHem, 4.2) : d.sleeveHem;
      out.push(sleevePiece(d, d.sleeveLen - cuff, hemW, cuff ? 0.375 : 1));
      if (rib) out.push(band('cuff', 'Rib cuff', Math.max(6, d.sleeveHem * 2 * 0.78), bandH * 2, 2, ['rib, fold in half'], true));
      else if (o.block === 'Button-up') out.push(band('cuff', 'Cuff', d.sleeveHem + 1.5, 3.5, 4, ['interface half, button at the end']));
    }
    const vl = Math.hypot(d.neckHalf, d.dropF) + 1.4, bk = pathLen(nb);
    const Lh = Math.max(neckLen / 2 + ovl * 0.4, vl + bk + 0.4);
    const fold = (id: string, name: string, poly: P[], notes: string[]): RawPiece => ({ id, name, cut: 2, fold: true, poly: dedupe(poly), grain: { x: Lh * 0.2, y: -1.1 }, notches: [[bk, 0.2], [Lh * 0.95, 0.9]], label: [Lh * 0.55, -0.9], notes });
    if (cfg.collar === 'notch') {
      const hh = o.block === 'Trench' ? 3.4 : 2.6;
      out.push(fold('collar', 'Collar', [[0, 0], ...quad([0, 0], [Lh * 0.5, 0.1], [Lh, 1.1], 8), [Lh + 0.5, -hh], ...quad([Lh + 0.5, -hh], [Lh * 0.5, -hh - 0.4], [0, -hh], 8)], ['self and facing']));
      if (o.block === 'Blazer' || o.block === 'Trench') out.push({ id: 'facing', name: 'Front facing', cut: 2, mirror: true, poly: [[0, 0], [3.2, 0], [3.2 - 0.6, bodyLen - d.dropF], [0, bodyLen - d.dropF]], grain: { x: 1.4 }, notches: [], label: [1.1, (bodyLen - d.dropF) / 2], notes: ['interface'] });
    } else if (cfg.collar === 'shirt') {
      out.push(fold('collar', 'Collar', [[0, 0], [Lh, 0], [Lh + 0.6, -2.4], [Lh * 0.5, -2.2], [0, -2.0]], ['interface one layer']));
      out.push(band('stand', 'Collar stand', Lh, 1.5, 2, ['interface']));
    } else if (cfg.collar === 'stand') {
      out.push(band('collar', cfg.rib ? 'Rib collar' : 'Stand collar', Math.max(10, neckLen * 0.82 / 2), 2 * (cfg.rib ? 1.5 : 1.25), cfg.rib ? 2 : 2, cfg.rib ? ['rib, fold in half'] : ['interface, topstitch'], true));
    }
    if (cfg.hood || (o.block === 'Puffer' && o.hood)) out.push(hoodPiece(d, neckLen / 2));
    if (rib) out.push(band('hemband', 'Rib hem band', d.hem * 0.8 / 2, bandH * 2, 2, ['rib, front and back'], true));
    if (cfg.belt) out.push(band('belt', 'Belt', (d.waist + 4) / 2, o.block === 'Trench' ? 4 : 3.5, 2, ['join at centre back']));
    if (o.block === 'Trench') out.push({ id: 'epaulet', name: 'Epaulet', cut: 2, poly: [[0, 0], [2.4, 0], [2.4, 6], [1.2, 6.8], [0, 6]], grain: { x: 1.2 }, notches: [], label: [1.2, 3] });
    if (cfg.pocket === 'flap') {
      const w = o.block === 'Blazer' ? 5.5 : 5, h = o.block === 'Blazer' ? 2 : 5.5;
      out.push({ id: 'pocket', name: o.block === 'Blazer' ? 'Pocket flap' : 'Chest pocket', cut: 2, poly: [[0, 0], [w, 0], [w, h * 0.8], [w / 2, h], [0, h * 0.8]], grain: { x: w / 2 }, notches: [[w / 2, 0]], label: [w / 2, h * 0.4] });
    } else if (cfg.pocket === 'kanga') {
      const w = Math.max(9, d.chest * 0.34), ph = 8.5, tw = w * 0.62;
      out.push({ id: 'pocket', name: 'Kangaroo pocket', cut: 1, hemSA: 0.375, poly: [[(w - tw) / 2, 0], [(w + tw) / 2, 0], [w, ph], [0, ph]], saFn: (a, b) => (a[1] < 0.02 && b[1] < 0.02 ? 1 : SEAM_SA), grain: { x: w / 2 }, notches: [[(w - tw) / 2, 0], [(w + tw) / 2, 0]], label: [w / 2, ph * 0.5] });
    }
    if (o.block === 'Button-up' || o.block === 'Trucker') out.push(band('placket', 'Button band', Math.max(10, bodyLen - d.dropF + 1), 2.5, 2, ['fold in thirds, buttonholes on right'], false));
    return out;
  }

  const f = mkBody(false), bk = mkBody(true);
  out.push({ id: 'front', name: 'Front', cut: 1, fold: true, hemSA: rib ? undefined : 1, poly: dedupe(f.poly), grain: { x: d.chest / 8 }, notches: [[f.ux, d.armY], nt[1]], label: labF });
  out.push({ id: 'back', name: 'Back', cut: 1, fold: true, hemSA: rib ? undefined : 1, poly: dedupe(bk.poly), grain: { x: d.chest / 8 }, notches: [[bk.ux, d.armY], [bk.ux, d.armY + 0.4], nt[1]], label: [labF[0], labF[1] + 0.2] });
  if (d.sleeveLen > 0 && !d.strapped) {
    const cuff = rib ? bandH : 0;
    out.push(sleevePiece(d, d.sleeveLen - cuff, d.sleeveHem, cuff ? 0.375 : 1));
  }
  if (cfg.hood) {
    out.push(hoodPiece(d, neckLen / 2));
  } else if (o.block === 'Sweatshirt') {
    out.push(band('bind', 'Rib neckband', Math.max(12, neckLen * 0.8), 5, 1, ['rib, fold in half'], true));
  } else if (o.block === 'Polo') {
    out.push(band('collar', 'Knit collar', Math.max(14, neckLen * 0.9), 6, 1, ['fold in half, open at the placket'], true));
    out.push(band('placket', 'Placket', 7.5, 3.2, 2, ['fold, 3 buttons']));
  } else {
    out.push(band('bind', 'Neck binding', Math.max(12, neckLen * 0.85), 2, 1, ['stretch to fit']));
    if (d.strapped) out.push(band('armbind', 'Armhole binding', Math.max(10, f.armLen * 0.85), 2, 2, ['stretch to fit']));
  }
  if (rib) {
    out.push(band('cuff', 'Cuff', Math.max(6, d.sleeveHem * 2 * 0.78), bandH * 2, 2, ['rib, fold in half'], true));
    out.push(band('hemband', 'Hem band', d.hem * 0.8 / 2, bandH * 2, 2, ['rib, front and back'], true));
  }
  if (cfg.pocket === 'kanga') {
    const w = Math.max(9, d.chest * 0.34), ph = 8.5, tw = w * 0.62;
    out.push({ id: 'pocket', name: 'Kangaroo pocket', cut: 1, hemSA: 0.375, poly: [[(w - tw) / 2, 0], [(w + tw) / 2, 0], [w, ph], [0, ph]], saFn: (a, b) => (a[1] < 0.02 && b[1] < 0.02 ? 1 : SEAM_SA), grain: { x: w / 2 }, notches: [[(w - tw) / 2, 0], [(w + tw) / 2, 0]], label: [w / 2, ph * 0.5] });
  }
  return out;
}

interface Style {
  open: boolean;
  ovl: number;
  rib: boolean;
  hood: boolean;
  belt: boolean;
  collar: 'none' | 'notch' | 'stand' | 'shirt';
  pocket: 'none' | 'kanga' | 'flap';
  frontNote?: string;
}
const NO: Style = { open: false, ovl: 0, rib: false, hood: false, belt: false, collar: 'none', pocket: 'none' };
function styleOf(o: { block: string; hood?: boolean }): Style {
  switch (o.block) {
    case 'Hoodie': return { ...NO, rib: true, hood: true, pocket: 'kanga' };
    case 'Sweatshirt': return { ...NO, rib: true };
    case 'Zip hoodie': return { ...NO, open: true, rib: true, hood: true, pocket: 'kanga', frontNote: 'separating zip on the centre front' };
    case 'Moto jacket': return { ...NO, open: true, ovl: 3.2, belt: true, collar: 'notch' };
    case 'Bomber': return { ...NO, open: true, rib: true, collar: 'stand', frontNote: 'separating zip on the centre front' };
    case 'Trucker': return { ...NO, open: true, ovl: 1.25, collar: 'shirt', pocket: 'flap', frontNote: 'button band, 1.25 in overlap' };
    case 'Button-up': return { ...NO, open: true, ovl: 1.25, collar: 'shirt', frontNote: 'button band, 1.25 in overlap' };
    case 'Blazer': return { ...NO, open: true, ovl: 1.5, collar: 'notch', pocket: 'flap', frontNote: 'interface the front edge' };
    case 'Trench': return { ...NO, open: true, ovl: 4, collar: 'notch', belt: true, frontNote: 'double breasted, 4 in overlap' };
    case 'Puffer': return { ...NO, open: true, collar: 'stand', frontNote: 'quilt channels about 4 in apart, separating zip' };
    default: return NO;
  }
}

// ---------------------------------------------------------------- entry

export function piecesFor(g: Garment, t: TorsoProfile, size: SizeName, base: SizeName, rules: GradeRules): RawPiece[] {
  const k = stepOf(size, base);
  if (g.type === 'top') return topPieces(gradeTop(topDims(g, t), k, rules), g);
  if (g.type === 'skirt') return skirtPieces(gradeSkirt(skirtDims(g), k, rules));
  if (g.type === 'shoes') return [];
  return jeansPieces(gradeMeasures(measures(g), k, rules), g);
}

export function garmentKind(g: Garment): string {
  if (g.type === 'top') return g.top?.block ?? 'top';
  if (g.type === 'skirt') return g.skirt?.shape ?? 'skirt';
  return g.type;
}
