// Garment model and pure geometry helpers. Garment space is 300 x 516.
// Ported from the Edit mockup: build(), outline paths, details, live spec.

import { BLOCK_LOOK, buildTopPoints, topName, type TopOpts } from './top';
import { rng } from './rng';

export const GARMENT_W = 300;
export const GARMENT_H = 516;

export type GarmentType = 'jeans' | 'top' | 'shorts' | 'skirt';
export type Fit = 'Skinny' | 'Slim' | 'Straight' | 'Flare' | 'Baggy' | 'Wide';
export type Rise = 'Low' | 'Mid' | 'High';
export type WaistKind = 'Regular' | 'Belt loops' | 'Drawcord' | 'Knee strap' | 'Wide band';
export type HemKind = 'Clean' | 'Cuffed' | 'Raw';
export type ShortsLength = 'Micro' | 'Short' | 'Mid-thigh' | 'Knee' | 'Jorts';
export type SkirtShape = 'Pencil' | 'A-line' | 'Pleated' | 'Wrap';
export type SkirtLength = 'Mini' | 'Knee' | 'Midi' | 'Maxi';
export type PocketKind = 'Scoop' | 'Coin' | 'Cargo' | 'None';
export type WashName = 'Raw indigo' | 'Washed black' | 'Black' | 'Crimson' | 'Grey' | 'Bleached' | 'Ecru' | 'White' | 'Heather' | 'Navy' | 'Olive' | 'Cream';
export type FabricKind = 'Denim' | 'Plaid' | 'Houndstooth' | 'Pinstripe' | 'Polka dot' | 'Leather' | 'Satin' | 'Knit' | 'Jersey' | 'Rib';
export const FABRIC_NAMES: FabricKind[] = ['Denim', 'Plaid', 'Houndstooth', 'Pinstripe', 'Polka dot', 'Leather', 'Satin', 'Knit'];
export const TOP_FABRICS: FabricKind[] = ['Jersey', 'Rib', 'Knit', 'Satin', 'Leather', 'Plaid', 'Pinstripe', 'Polka dot', 'Denim'];

/** Pixels per inch in garment space: vertical measures, and leg widths. */
export const PX_IN_V = 9.4;
export const PX_IN_H = 4.6;

export interface Pt {
  x: number;
  y: number;
  key?: string;
  /** Tops only: which space the point lives in (a sleeve point rides the arm). */
  r?: 'armL' | 'armR';
  /** Tops only: the front neck point makes a straight V instead of a curve. */
  vee?: boolean;
}
export interface Hole {
  x: number;
  y: number;
  r: number;
}
export interface Rip {
  x: number;
  y: number;
}
export interface GText {
  x: number;
  y: number;
  t: string;
  size: number;
}
export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface Garment {
  id: string;
  name: string;
  type: GarmentType;
  block: string;
  fit: Fit;
  rise: Rise;
  points: Pt[];
  parts: { waist: WaistKind; pocket: PocketKind; /** Shorts only. */ hem?: HemKind };
  wash: WashName;
  fabric: FabricKind;
  fabricScale: number;
  holes: Hole[];
  distress: Rip[];
  texts: GText[];
  cropY: number | null;
  transform: Transform;
  visible: boolean;
  /** Tops only. */
  top?: TopOpts;
  /** Shorts only: the length preset and the inseam in inches. */
  shorts?: ShortsOpts;
  /** Skirts only. */
  skirt?: SkirtOpts;
}

export interface ShortsOpts {
  length: ShortsLength;
  /** Crotch to hem, inches. */
  inseam: number;
}
export interface SkirtOpts {
  shape: SkirtShape;
  length: SkirtLength;
  /** Waistband top to hem, inches. */
  len: number;
  /** Hem sweep in inches (same scale as the waist spec), or null for the silhouette default. */
  sweep: number | null;
}

export const FIT_NAMES: Fit[] = ['Skinny', 'Slim', 'Straight', 'Flare', 'Baggy', 'Wide'];
export const RISE_NAMES: Rise[] = ['Low', 'Mid', 'High'];
export const WAIST_NAMES: WaistKind[] = ['Regular', 'Belt loops', 'Drawcord', 'Knee strap'];
export const SHORTS_WAIST_NAMES: WaistKind[] = ['Regular', 'Belt loops', 'Drawcord'];
export const SKIRT_WAIST_NAMES: WaistKind[] = ['Regular', 'Wide band', 'Belt loops', 'Drawcord'];
export const HEM_NAMES: HemKind[] = ['Clean', 'Cuffed', 'Raw'];
export const SHORTS_LENGTH_NAMES: ShortsLength[] = ['Micro', 'Short', 'Mid-thigh', 'Knee', 'Jorts'];
/** Inseam in inches for each shorts length. */
export const SHORTS_INSEAM: Record<ShortsLength, number> = { Micro: 1.5, Short: 3.5, 'Mid-thigh': 7, Knee: 14, Jorts: 19.5 };
export const SHORTS_FIT_NAMES: Fit[] = ['Skinny', 'Slim', 'Straight', 'Baggy', 'Wide'];
export const SHORTS_FIT_DEFAULT: Record<ShortsLength, Fit> = { Micro: 'Slim', Short: 'Straight', 'Mid-thigh': 'Straight', Knee: 'Straight', Jorts: 'Baggy' };
export const SKIRT_SHAPE_NAMES: SkirtShape[] = ['Pencil', 'A-line', 'Pleated', 'Wrap'];
export const SKIRT_LENGTH_NAMES: SkirtLength[] = ['Mini', 'Knee', 'Midi', 'Maxi'];
/** Waistband top to hem in inches for each skirt length. */
export const SKIRT_LEN: Record<SkirtLength, number> = { Mini: 18, Knee: 28, Midi: 36, Maxi: 44 };
/** Band height in garment px, and the top of the band for a given band style. */
export const bandHeight = (w: WaistKind) => (w === 'Wide band' ? 28 : 14);
export const POCKET_NAMES: PocketKind[] = ['Scoop', 'Coin', 'Cargo', 'None'];

export const WASHES: Record<WashName, string> = {
  'Raw indigo': '#2C3A5C',
  'Washed black': '#454B54',
  Black: '#1C1C1C',
  Crimson: '#7A2B2B',
  Grey: '#8A8F96',
  Bleached: '#9DB4CC',
  Ecru: '#E2D9C3',
  White: '#F1EFEA',
  Heather: '#9A9A98',
  Navy: '#25304A',
  Olive: '#5B5E3E',
  Cream: '#E8DFCB',
};
export const WASH_NAMES = Object.keys(WASHES) as WashName[];

export const HOLE_SIZES = { S: 6, M: 10, L: 16, XL: 24 } as const;
export type HoleSize = keyof typeof HOLE_SIZES;
export const TEXT_SIZES = { Small: 11, Medium: 16, Large: 24 } as const;

export const MIN_POINTS = 6;
export const MIN_CROP_Y = 120;

// [knee width, opening width] in garment px
const FITS: Record<Fit, [number, number]> = {
  Skinny: [30, 24],
  Slim: [36, 32],
  Straight: [42, 42],
  Flare: [36, 64],
  Baggy: [58, 60],
  Wide: [62, 78],
};
const RISES: Record<Rise, number> = { Low: 84, Mid: 62, High: 40 };

/** The 13 keyed outline points of a jeans block. */
export function buildPoints(fit: Fit, rise: Rise): Pt[] {
  const [k, h] = FITS[fit];
  const w = RISES[rise] + 14;
  const Y = 486, kn = 330, lc = 110, rc = 190, hl = 104, hr = 196;
  return [
    { key: 'waistL', x: 80, y: w },
    { key: 'waistR', x: 220, y: w },
    { key: 'hipR', x: 228, y: 170 },
    { key: 'kneeRo', x: rc + k / 2, y: kn },
    { key: 'hemRo', x: hr + h / 2, y: Y },
    { key: 'hemRi', x: hr - h / 2, y: Y },
    { key: 'kneeRi', x: rc - k / 2, y: kn },
    { key: 'crotch', x: 150, y: 184 },
    { key: 'kneeLi', x: lc + k / 2, y: kn },
    { key: 'hemLi', x: hl + h / 2, y: Y },
    { key: 'hemLo', x: hl - h / 2, y: Y },
    { key: 'kneeLo', x: lc - k / 2, y: kn },
    { key: 'hipL', x: 72, y: 170 },
  ];
}

/** Shorts: the jeans outline cut off at the hem, with knee points carried along the leg lines. */
export function buildShortsPoints(fit: Fit, rise: Rise, inseam: number): Pt[] {
  const base = buildPoints(fit, rise);
  const at = (k: string) => base.find((p) => p.key === k) as Pt;
  const crotch = at('crotch');
  const hemY = Math.min(GARMENT_H - 6, crotch.y + inseam * PX_IN_V);
  const kneeY = hemY > 345 ? at('kneeRo').y : (crotch.y + hemY) / 2;
  const lineX = (a: Pt, b: Pt, c: Pt, y: number) =>
    y <= b.y ? a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y) : b.x + ((c.x - b.x) * (y - b.y)) / (c.y - b.y);
  const lines: Record<string, [Pt, Pt, Pt]> = {
    Ro: [at('hipR'), at('kneeRo'), at('hemRo')],
    Ri: [crotch, at('kneeRi'), at('hemRi')],
    Li: [crotch, at('kneeLi'), at('hemLi')],
    Lo: [at('hipL'), at('kneeLo'), at('hemLo')],
  };
  return base.map((p) => {
    const m = /^(knee|hem)(Ro|Ri|Li|Lo)$/.exec(p.key ?? '');
    if (!m) return p;
    const y = m[1] === 'hem' ? hemY : kneeY;
    return { ...p, x: lineX(...lines[m[2]], y), y };
  });
}

const SKIRT_FLARE: Record<SkirtShape, number> = { Pencil: 0, 'A-line': 0.26, Pleated: 0.22, Wrap: 0.2 };
const PENCIL_HEM: Record<SkirtLength, number> = { Mini: 74, Knee: 68, Midi: 64, Maxi: 62 };

/** The 8 keyed outline points of a skirt block. */
export function buildSkirtPoints(o: SkirtOpts): Pt[] {
  const bandBottom = 76;
  const hipY = 170;
  const hemY = Math.min(GARMENT_H - 8, bandBottom - 14 + o.len * PX_IN_V);
  let half: number;
  if (o.sweep != null) half = (o.sweep * 4.5) / 2;
  else if (o.shape === 'Pencil') half = PENCIL_HEM[o.length];
  else half = 78 + (hemY - hipY) * SKIRT_FLARE[o.shape];
  half = Math.max(40, half);
  const mid = (hemY + hipY) / 2;
  // pencil keeps the hip width a little longer, then tapers; the rest run straight
  const k = o.shape === 'Pencil' ? 0.36 : o.shape === 'Pleated' ? 0.46 : 0.5;
  const sideHalf = 78 + (half - 78) * k;
  const wrapDrop = o.shape === 'Wrap' ? 12 : 0;
  return [
    { key: 'waistL', x: 80, y: bandBottom },
    { key: 'waistR', x: 220, y: bandBottom },
    { key: 'hipR', x: 228, y: hipY },
    { key: 'sideR', x: 150 + sideHalf, y: mid },
    { key: 'hemR', x: 150 + half, y: hemY },
    { key: 'hemL', x: 150 - half, y: hemY - wrapDrop },
    { key: 'sideL', x: 150 - sideHalf, y: mid - wrapDrop / 2 },
    { key: 'hipL', x: 72, y: hipY },
  ];
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `g${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createJeans(fit: Fit = 'Straight', rise: Rise = 'Mid'): Garment {
  return {
    id: newId(),
    name: `${fit} jeans`,
    type: 'jeans',
    block: 'five-pocket',
    fit,
    rise,
    points: buildPoints(fit, rise),
    parts: { waist: 'Regular', pocket: 'Scoop' },
    wash: 'Washed black',
    fabric: 'Denim',
    fabricScale: 1,
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
  };
}

export const shortsName = (l: ShortsLength) => (l === 'Jorts' ? 'Jorts' : l === 'Short' ? 'Shorts' : `${l} shorts`);

export function createShorts(length: ShortsLength = 'Short', fit?: Fit): Garment {
  const f = fit ?? SHORTS_FIT_DEFAULT[length];
  const inseam = SHORTS_INSEAM[length];
  return {
    id: newId(),
    name: shortsName(length),
    type: 'shorts',
    block: 'five-pocket',
    fit: f,
    rise: 'Mid',
    points: buildShortsPoints(f, 'Mid', inseam),
    parts: { waist: 'Regular', pocket: 'Scoop', hem: length === 'Jorts' ? 'Raw' : 'Clean' },
    wash: length === 'Jorts' ? 'Bleached' : 'Washed black',
    fabric: 'Denim',
    fabricScale: 1,
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
    shorts: { length, inseam },
  };
}

export function nearestShortsLength(inseam: number): ShortsLength {
  let best: ShortsLength = 'Short';
  let bd = Infinity;
  for (const l of SHORTS_LENGTH_NAMES) {
    const d = Math.abs(SHORTS_INSEAM[l] - inseam);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

const SKIRT_LOOK: Record<SkirtShape, { fabric: FabricKind; wash: WashName }> = {
  Pencil: { fabric: 'Leather', wash: 'Black' },
  'A-line': { fabric: 'Denim', wash: 'Raw indigo' },
  Pleated: { fabric: 'Plaid', wash: 'Crimson' },
  Wrap: { fabric: 'Satin', wash: 'Cream' },
};

export function createSkirt(shape: SkirtShape = 'A-line', length: SkirtLength = 'Mini'): Garment {
  const skirt: SkirtOpts = { shape, length, len: SKIRT_LEN[length], sweep: null };
  return {
    id: newId(),
    name: `${shape} skirt`,
    type: 'skirt',
    block: shape.toLowerCase(),
    fit: 'Straight',
    rise: 'Mid',
    points: buildSkirtPoints(skirt),
    parts: { waist: 'Regular', pocket: 'None' },
    wash: SKIRT_LOOK[shape].wash,
    fabric: SKIRT_LOOK[shape].fabric,
    fabricScale: 1,
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
    skirt,
  };
}

export function createTop(o: TopOpts): Garment {
  const look = BLOCK_LOOK[o.block];
  return {
    id: newId(),
    name: topName(o),
    type: 'top',
    block: o.block,
    fit: 'Straight',
    rise: 'Mid',
    points: buildTopPoints(o),
    parts: { waist: 'Regular', pocket: 'None' },
    wash: look?.wash ?? 'White',
    fabric: look?.fabric ?? (o.block === 'Tank' ? 'Rib' : 'Jersey'),
    fabricScale: 1,
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
    top: o,
  };
}

export function findPoint(points: Pt[], key: string): Pt {
  return points.find((p) => p.key === key) ?? { x: 150, y: 200 };
}

/** Top of the waistband in garment space. */
export function bandTop(points: Pt[]): number {
  return findPoint(points, 'waistL').y - 14;
}

const f = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

export interface GarmentPaths {
  body: string;
  band: string;
  details: string;
  solid: string;
  strap: string;
  /** Topstitching along the band, and rivet and button positions. */
  stitch: string;
  rivets: { x: number; y: number }[];
  button: { x: number; y: number } | null;
}

type V2 = { x: number; y: number };

/** Point at fraction u (0 to 1) along a polyline, by length. */
export function along(chain: V2[], u: number): V2 {
  if (chain.length === 1) return chain[0];
  let total = 0;
  for (let i = 0; i < chain.length - 1; i++) total += Math.hypot(chain[i + 1].x - chain[i].x, chain[i + 1].y - chain[i].y);
  let want = Math.max(0, Math.min(1, u)) * total;
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i], b = chain[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= L || i === chain.length - 2) {
      const t = L ? Math.min(1, want / L) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    want -= L;
  }
  return chain[chain.length - 1];
}

/** The outline points from one key to another, in outline order, or null if either is missing. */
export function chainBetween(points: Pt[], from: string, to: string): Pt[] | null {
  const a = points.findIndex((p) => p.key === from);
  const b = points.findIndex((p) => p.key === to);
  if (a < 0 || b < 0 || b < a) return null;
  return points.slice(a, b + 1);
}

/** x of the outline on one side of the leg at height y, walking the keyed chain hip, knee, hem. */
function sideX(points: Pt[], keys: string[], y: number): number | null {
  const lo = Math.min(...keys.map((k) => points.findIndex((p) => p.key === k)));
  const hi = Math.max(...keys.map((k) => points.findIndex((p) => p.key === k)));
  if (lo < 0) return null;
  for (let i = lo; i < hi; i++) {
    const a = points[i], b = points[i + 1];
    if ((y - a.y) * (y - b.y) <= 0 && a.y !== b.y) return a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
  }
  return null;
}

function skirtPaths(g: Pick<Garment, 'points' | 'parts' | 'skirt'>, sag: number, inset: [number, number]): GarmentPaths {
  const pts = g.points;
  const body = 'M' + pts.map((p) => f(p.x, p.y)).join(' L') + ' Z';
  const wl = findPoint(pts, 'waistL');
  const wr = findPoint(pts, 'waistR');
  const bh = bandHeight(g.parts.waist);
  const mx = (wl.x + wr.x) / 2;
  const my = (wl.y + wr.y) / 2;
  const tl = wl.x + inset[0], tr = wr.x - inset[1];
  const band =
    'M' + f(tl, wl.y - bh) + ' Q' + f(mx, my - bh + sag * 2) + ' ' + f(tr, wr.y - bh) +
    ' L' + f(wr.x, wr.y) + ' Q' + f(mx, my + sag * 2) + ' ' + f(wl.x, wl.y) + ' Z';
  const stitch =
    'M' + f(tl + 1.5, wl.y - bh + 3) + ' Q' + f(mx, my - bh + 3 + sag * 2) + ' ' + f(tr - 1.5, wr.y - bh + 3) +
    ' M' + f(wl.x + 1, wl.y - 3) + ' Q' + f(mx, my - 3 + sag * 2) + ' ' + f(wr.x - 1, wr.y - 3);
  const waistChain = chainBetween(pts, 'waistL', 'waistR') ?? [wl, wr];
  const hemChain = chainBetween(pts, 'hemR', 'hemL')?.slice().reverse() ?? [findPoint(pts, 'hemL'), findPoint(pts, 'hemR')];
  const shape = g.skirt?.shape ?? 'A-line';
  // a two point waist edge is straight, so add the same dip the band has
  const waistAt = (u: number): V2 => {
    const q = along(waistChain, u);
    return waistChain.length > 2 ? q : { x: q.x, y: q.y + sag * 4 * u * (1 - u) };
  };
  const hemAt = (u: number) => along(hemChain, u);
  let details = '';
  let solid = '';
  let button: V2 | null = null;
  if (shape === 'Pleated') {
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const u = 0.03 + (0.94 * i) / N;
      const a = waistAt(u), b = hemAt(u);
      const top = { x: a.x + (b.x - a.x) * 0.2, y: a.y + (b.y - a.y) * 0.2 };
      const c = { x: (top.x + b.x) / 2 + (i % 2 ? 1.5 : -1.5), y: (top.y + b.y) / 2 };
      solid += ' M' + f(top.x, top.y) + ' Q' + f(c.x, c.y) + ' ' + f(b.x, b.y);
    }
    // stitched down yoke line
    for (let i = 0; i <= 8; i++) {
      const u = 0.03 + (0.94 * i) / 8;
      const a = waistAt(u), b = hemAt(u);
      details += (i ? ' L' : 'M') + f(a.x + (b.x - a.x) * 0.2, a.y + (b.y - a.y) * 0.2);
    }
  } else if (shape === 'Wrap') {
    const a = waistAt(0.8), b = hemAt(0.26);
    const c = { x: (a.x + b.x) / 2 + 10, y: (a.y + b.y) / 2 + 4 };
    solid += ' M' + f(a.x, a.y) + ' Q' + f(c.x, c.y) + ' ' + f(b.x, b.y);
    const a2 = waistAt(0.2), b2 = hemAt(0.3);
    details += 'M' + f(a2.x + 2, a2.y + 4) + ' Q' + f((a2.x + b2.x) / 2 - 6, (a2.y + b2.y) / 2) + ' ' + f(b2.x + 1, b2.y - 3);
    button = { x: a.x - 4, y: a.y + 7 };
  } else {
    // front darts
    for (const u of [0.3, 0.7]) {
      const a = waistAt(u), b = hemAt(u);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const L = Math.min(40, len * 0.3);
      details += ' M' + f(a.x - 3, a.y) + ' L' + f(a.x + ((b.x - a.x) / len) * L, a.y + ((b.y - a.y) / len) * L) + ' L' + f(a.x + 3, a.y);
    }
    if (shape === 'Pencil') {
      const a = waistAt(0.5), b = hemAt(0.5);
      details += ' M' + f(a.x, a.y + 6) + ' L' + f(b.x, b.y - 2);
    }
  }
  const { waist } = g.parts;
  if (waist === 'Drawcord') {
    const a = waistAt(0.46), b = waistAt(0.54);
    solid +=
      ' M' + f(a.x, a.y - 6) + ' Q' + f(a.x - 5, a.y + 14) + ' ' + f(a.x - 1, a.y + 30) +
      ' M' + f(b.x, b.y - 6) + ' Q' + f(b.x + 5, b.y + 14) + ' ' + f(b.x + 1, b.y + 30);
  }
  if (waist === 'Belt loops') {
    [0.1, 0.3, 0.7, 0.9].forEach((t) => {
      const q = waistAt(t);
      solid += ' M' + f(q.x, q.y - bh - 2) + ' V' + (q.y + 2);
    });
  }
  return { body, band, details, solid, strap: '', stitch, rivets: [], button };
}

/** sag: how far the waist edge dips at the centre (garment units), so the band wraps the body. */
export function garmentPaths(g: Pick<Garment, 'points' | 'parts'> & Partial<Pick<Garment, 'type' | 'skirt'>>, sag = 0, inset: [number, number] = [0, 0]): GarmentPaths {
  if (g.type === 'skirt') return skirtPaths(g, sag, inset);
  const pts = g.points;
  const body = 'M' + pts.map((p) => f(p.x, p.y)).join(' L') + ' Z';
  const wl = findPoint(pts, 'waistL');
  const wr = findPoint(pts, 'waistR');
  const top = wl.y;
  const mx = (wl.x + wr.x) / 2;
  const my = (wl.y + wr.y) / 2;
  const tl = wl.x + inset[0], tr = wr.x - inset[1];
  const band =
    'M' + f(tl, wl.y - 14) + ' Q' + f(mx, my - 14 + sag * 2) + ' ' + f(tr, wr.y - 14) +
    ' L' + f(wr.x, wr.y) + ' Q' + f(mx, my + sag * 2) + ' ' + f(wl.x, wl.y) + ' Z';
  const stitch =
    'M' + f(tl + 1.5, wl.y - 11) + ' Q' + f(mx, my - 11 + sag * 2) + ' ' + f(tr - 1.5, wr.y - 11) +
    ' M' + f(wl.x + 1, wl.y - 3) + ' Q' + f(mx, my - 3 + sag * 2) + ' ' + f(wr.x - 1, wr.y - 3);
  const ct = top + sag;
  const details =
    'M' + f(150, ct) + ' V' + (ct + 52) +
    ' M' + f(160, ct) + ' V' + (ct + 42) +
    ' Q' + f(160, ct + 54) + ' ' + f(150, ct + 56);

  let solid = '';
  const scoop =
    ' M' + f(wl.x + 8, top) + ' Q' + f(wl.x + 16, top + 38) + ' ' + f(wl.x + 42, top + 40) +
    ' M' + f(wr.x - 8, top) + ' Q' + f(wr.x - 16, top + 38) + ' ' + f(wr.x - 42, top + 40);
  const { pocket, waist } = g.parts;
  if (pocket === 'Scoop') solid += scoop;
  if (pocket === 'Coin') {
    solid += scoop + ' M' + f(wr.x - 40, top + 8) + ' H' + (wr.x - 22) + ' V' + (top + 26) + ' H' + (wr.x - 40);
  }
  if (pocket === 'Cargo') {
    solid += scoop;
    if (g.type === 'shorts') {
      // thigh pockets sit on the leg outline and stay clear of the hem
      const hemY = Math.max(findPoint(pts, 'hemLo').y, findPoint(pts, 'hemLi').y);
      const cuff = g.parts.hem === 'Cuffed' ? CUFF : 0;
      const bot = Math.min(284, hemY - 14 - cuff);
      const topY = Math.max(bot - 54, wl.y + 40);
      const side = (keys: string[], y: number, dflt: number) => sideX(pts, keys, y) ?? dflt;
      const LK = ['hipL', 'kneeLo', 'hemLo'], RK = ['hipR', 'kneeRo', 'hemRo'];
      const w = 26;
      const lt = side(LK, topY, 78) + 2, lb = side(LK, bot, 78) + 2;
      const rt = side(RK, topY, 222) - 2, rb = side(RK, bot, 222) - 2;
      const fl = (y: number, a: number, c: number) => a + ((c - a) * (y - topY)) / (bot - topY || 1);
      solid +=
        ` M${f(lt, topY)} L${f(lt + w, topY)} L${f(lb + w, bot)} L${f(lb, bot)} Z M${f(fl(topY + 10, lt, lb), topY + 10)} L${f(fl(topY + 10, lt, lb) + w, topY + 10)}` +
        ` M${f(rt, topY)} L${f(rt - w, topY)} L${f(rb - w, bot)} L${f(rb, bot)} Z M${f(fl(topY + 10, rt, rb), topY + 10)} L${f(fl(topY + 10, rt, rb) - w, topY + 10)}`;
    } else {
      solid += ' M78,230 H104 V284 H78 Z M78,240 H104 M222,230 H196 V284 H222 Z M222,240 H196';
    }
  }
  if (waist === 'Drawcord') {
    solid +=
      ' M' + f(142, ct - 6) + ' Q' + f(136, ct + 26) + ' ' + f(142, ct + 46) +
      ' M' + f(158, ct - 6) + ' Q' + f(164, ct + 26) + ' ' + f(158, ct + 46);
  }
  if (waist === 'Belt loops') {
    [0.1, 0.3, 0.7, 0.9].forEach((t) => {
      const x = wl.x + (wr.x - wl.x) * t;
      const dip = sag * 4 * t * (1 - t);
      solid += ' M' + f(x, top - 16 + dip) + ' V' + (top + 2 + dip);
    });
  }
  let strap = '';
  if (waist === 'Knee strap' && g.type !== 'shorts') {
    const a = findPoint(pts, 'kneeLi');
    const b = findPoint(pts, 'kneeRi');
    strap = 'M' + f(a.x - 4, a.y + 26) + ' Q' + f(150, a.y + 56) + ' ' + f(b.x + 4, b.y + 26);
  }
  const rivets = [
    { x: wl.x + 9, y: top + 4 + sag * 0.3 },
    { x: wr.x - 9, y: top + 4 + sag * 0.3 },
  ];
  return { body, band, details, solid, strap, stitch, rivets, button: { x: mx + 6, y: my - 7 + sag } };
}

/** Height of a folded cuff, garment px. */
export const CUFF = 14;

export interface HemPaths {
  /** Folded cuff band, one closed shape per leg. */
  cuff: string;
  /** Top edge of the cuff, and a stitch line just above the hem edge. */
  cuffLine: string;
  cuffStitch: string;
  /** Raw hem: loose threads past the edge, and worn weft lines just above it. */
  fray: string;
  wear: string;
}

/** Hem treatment for shorts, from the (possibly posed) outline. Empty strings when there is nothing to draw. */
export function hemPaths(g: Pick<Garment, 'id' | 'points' | 'parts'>): HemPaths {
  const out: HemPaths = { cuff: '', cuffLine: '', cuffStitch: '', fray: '', wear: '' };
  const kind = g.parts.hem ?? 'Clean';
  if (kind === 'Clean') return out;
  const r = rng(g.id + ':hem');
  const pts = g.points;
  const fmt = (v: V2) => `${v.x.toFixed(1)},${v.y.toFixed(1)}`;
  // each leg opening runs outer to inner on the right leg and inner to outer on the left
  for (const [ka, kb] of [['hemRo', 'hemRi'], ['hemLi', 'hemLo']]) {
    const chain = chainBetween(pts, ka, kb);
    if (!chain || chain.length < 2) continue;
    const ia = pts.findIndex((p) => p.key === ka), ib = pts.findIndex((p) => p.key === kb);
    // walk up the outline from a hem corner by arc length: first corner goes back, second goes forward
    const walk = (i: number, dir: number, d: number): V2 => {
      let a: V2 = pts[i], left = d;
      for (let j = i + dir; j >= 0 && j < pts.length; j += dir) {
        const b = pts[j];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        if (left <= L) return { x: a.x + ((b.x - a.x) * left) / (L || 1), y: a.y + ((b.y - a.y) * left) / (L || 1) };
        left -= L;
        a = b;
      }
      return a;
    };
    const A = chain[0], B = chain[chain.length - 1];
    const N = chain.length - 1;
    // the hem curve moved up the leg: the chord between the raised corners plus the hem's own bulge
    const shifted = (d: number): V2[] => {
      const a2 = walk(ia, -1, d), b2 = walk(ib, 1, d);
      return chain.map((c, k) => {
        const u = k / N;
        return {
          x: a2.x + (b2.x - a2.x) * u + (c.x - (A.x + (B.x - A.x) * u)),
          y: a2.y + (b2.y - a2.y) * u + (c.y - (A.y + (B.y - A.y) * u)),
        };
      });
    };
    if (kind === 'Cuffed') {
      const top = shifted(CUFF);
      out.cuff += 'M' + chain.map(fmt).join(' L') + ' L' + top.slice().reverse().map(fmt).join(' L') + ' Z ';
      out.cuffLine += 'M' + top.map(fmt).join(' L') + ' ';
      out.cuffStitch += 'M' + shifted(3).map(fmt).join(' L') + ' ';
    } else {
      for (let k = 0; k < chain.length - 1; k++) {
        const a = chain[k], b = chain[k + 1];
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.max(1, Math.round(L / 2.2));
        for (let j = 0; j < n; j++) {
          const t = (j + r() * 0.8) / n;
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          out.fray += `M${x.toFixed(1)},${(y - 1).toFixed(1)} l${((r() - 0.5) * 2.4).toFixed(1)},${(2 + r() * 5).toFixed(1)} `;
        }
      }
      for (const [d, share] of [[2.5, 0.8], [5, 0.55], [8, 0.35]] as [number, number][]) {
        let on = false;
        shifted(d).forEach((p) => {
          const keep = r() < share;
          if (keep) out.wear += `${on ? ' L' : ' M'}${fmt(p)}`;
          on = keep;
        });
      }
    }
  }
  return out;
}

/** Zig-zag line used for raw edges and rips. */
export function zig(x0: number, x1: number, y: number, amp: number, step: number): string {
  let s = 'M' + f(x0, y);
  let up = true;
  for (let x = x0 + step; x <= x1; x += step) {
    s += ' L' + f(x, y + (up ? -amp : amp));
    up = !up;
  }
  return s;
}

export function ripPath(d: Rip): string {
  return (
    zig(d.x - 10, d.x + 10, d.y - 4, 2.5, 4) + ' ' +
    zig(d.x - 8, d.x + 8, d.y + 1, 2.5, 4) + ' ' +
    zig(d.x - 6, d.x + 6, d.y + 6, 2, 4)
  );
}

export function holeThreads(h: Hole): string {
  return (
    'M' + f(h.x - h.r, h.y - 2) + ' L' + f(h.x + h.r, h.y - 1) +
    ' M' + f(h.x - h.r, h.y + 2) + ' L' + f(h.x + h.r, h.y + 3) +
    ' M' + f(h.x - h.r * 0.8, h.y) + ' L' + f(h.x + h.r * 0.8, h.y + 0.5)
  );
}

export function isDarkWash(w: WashName): boolean {
  return !['Grey', 'Bleached', 'Ecru', 'White', 'Heather', 'Cream'].includes(w);
}

/** Index to insert at, plus the nearest point on the outline, for the Add point tool. */
export function nearestSegment(points: Pt[], at: { x: number; y: number }): { index: number; point: Pt } {
  const n = points.length;
  let best = 0;
  let bd = Infinity;
  let bp: Pt = { x: at.x, y: at.y };
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = dx * dx + dy * dy || 1;
    let t = ((at.x - a.x) * dx + (at.y - a.y) * dy) / L;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    const d = (px - at.x) ** 2 + (py - at.y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
      bp = { x: px, y: py };
    }
  }
  return { index: best + 1, point: bp };
}

export interface SpecRow {
  k: string;
  v: string;
}

const half = (n: number) => (Math.round(n * 2) / 2).toString();

/** Live spec from landmark points. Rise and inseam use 9.4 px per inch, knee and opening 4.6. */
export function computeSpec(g: Garment): SpecRow[] {
  const p = g.points;
  const wl = findPoint(p, 'waistL');
  const wr = findPoint(p, 'waistR');
  if (g.type === 'skirt') {
    const hl = findPoint(p, 'hemL'), hr = findPoint(p, 'hemR');
    const hemYs = Math.min(g.cropY ?? Infinity, Math.max(hl.y, hr.y));
    return [
      { k: 'Waist', v: `${half((2 * Math.abs(wr.x - wl.x)) / 9)} in` },
      { k: 'Hip', v: `${half((2 * Math.abs(findPoint(p, 'hipR').x - findPoint(p, 'hipL').x)) / 9)} in` },
      { k: 'Length', v: `${half(Math.max(0, hemYs - bandTop(p)) / PX_IN_V)} in` },
      { k: 'Hem sweep', v: `${half((2 * Math.abs(hr.x - hl.x)) / 9)} in` },
      { k: 'Holes / rips', v: `${g.holes.length} / ${g.distress.length}` },
    ];
  }
  const cr = findPoint(p, 'crotch');
  const hemLi = findPoint(p, 'hemLi'), hemLo = findPoint(p, 'hemLo');
  const kneeLi = findPoint(p, 'kneeLi'), kneeLo = findPoint(p, 'kneeLo');
  const hemY = Math.max(hemLo.y, hemLi.y);
  const inseamPx = Math.min(g.cropY ?? Infinity, hemY) - cr.y;
  const hemW = Math.abs(hemLi.x - hemLo.x);
  const kneeW = Math.abs(kneeLi.x - kneeLo.x);
  const waistIn = (2 * Math.abs(wr.x - wl.x)) / 9;
  if (g.type === 'shorts') {
    const hem = g.parts.hem ?? 'Clean';
    return [
      { k: 'Waist', v: `${half(waistIn)} in` },
      { k: 'Hip', v: `${half((2 * Math.abs(findPoint(p, 'hipR').x - findPoint(p, 'hipL').x)) / 9)} in` },
      { k: 'Rise', v: `${half((cr.y - bandTop(p)) / 9.4)} in` },
      { k: 'Inseam', v: `${half(Math.max(0, inseamPx) / 9.4)} in` },
      { k: 'Leg opening', v: `${half(hemW / 4.6)} in` },
      { k: 'Hem', v: hem === 'Cuffed' ? `Cuffed ${half(CUFF / 9.4)} in` : hem },
      { k: 'Holes / rips', v: `${g.holes.length} / ${g.distress.length}` },
    ];
  }
  return [
    { k: 'Waist', v: `${half(waistIn)} in` },
    { k: 'Hip', v: `${half((2 * Math.abs(findPoint(p, 'hipR').x - findPoint(p, 'hipL').x)) / 9)} in` },
    { k: 'Rise', v: `${half((cr.y - bandTop(p)) / 9.4)} in` },
    { k: 'Inseam', v: `${half(Math.max(0, inseamPx) / 9.4)} in` },
    { k: 'Knee', v: `${half(kneeW / 4.6)} in` },
    { k: 'Leg opening', v: `${half(hemW / 4.6)} in` },
    { k: 'Holes / rips', v: `${g.holes.length} / ${g.distress.length}` },
  ];
}

/** Fill in fields that older saved garments do not have. */
export function normalizeGarment(g: Garment): Garment {
  return { ...g, fabric: g.fabric ?? 'Denim', fabricScale: g.fabricScale ?? 1 };
}

export type Measure = 'inseam' | 'knee' | 'opening';

/** Set a measurement (inches) by moving the keyed points. Mutates the given garment. */
export function applyMeasure(g: Garment, which: Measure, inches: number): void {
  const at = (k: string) => g.points.find((p) => p.key === k);
  // shorts and skirts rebuild their outline from the new number (hand edited points reset)
  if (g.type === 'skirt' && g.skirt) {
    if (which === 'inseam') g.skirt.len = inches;
    else if (which === 'opening') g.skirt.sweep = inches;
    g.points = buildSkirtPoints(g.skirt);
    return;
  }
  if (g.type === 'shorts' && g.shorts && which === 'inseam') {
    g.shorts.inseam = inches;
    g.shorts.length = nearestShortsLength(inches);
    g.points = buildShortsPoints(g.fit, g.rise, inches);
    g.name = shortsName(g.shorts.length);
    return;
  }
  if (which === 'inseam') {
    const cr = at('crotch');
    if (!cr) return;
    const y = Math.min(GARMENT_H - 6, cr.y + inches * PX_IN_V);
    for (const k of ['hemLo', 'hemLi', 'hemRi', 'hemRo']) {
      const p = at(k);
      if (p) p.y = y;
    }
    return;
  }
  const keys = which === 'knee' ? (['kneeLo', 'kneeLi', 'kneeRi', 'kneeRo'] as const) : (['hemLo', 'hemLi', 'hemRi', 'hemRo'] as const);
  const half = (inches * PX_IN_H) / 2;
  const [lo, li, ri, ro] = keys.map(at);
  if (lo && li) {
    const c = (lo.x + li.x) / 2;
    lo.x = c - half;
    li.x = c + half;
  }
  if (ri && ro) {
    const c = (ri.x + ro.x) / 2;
    ri.x = c - half;
    ro.x = c + half;
  }
}
