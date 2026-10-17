// Garment model and pure geometry helpers. Garment space is 300 x 516.
// Ported from the Edit mockup: build(), outline paths, details, live spec.

import { buildTopPoints, type TopOpts } from './top';

export const GARMENT_W = 300;
export const GARMENT_H = 516;

export type GarmentType = 'jeans' | 'top';
export type Fit = 'Skinny' | 'Slim' | 'Straight' | 'Flare' | 'Baggy' | 'Wide';
export type Rise = 'Low' | 'Mid' | 'High';
export type WaistKind = 'Regular' | 'Belt loops' | 'Drawcord' | 'Knee strap';
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
  parts: { waist: WaistKind; pocket: PocketKind };
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
}

export const FIT_NAMES: Fit[] = ['Skinny', 'Slim', 'Straight', 'Flare', 'Baggy', 'Wide'];
export const RISE_NAMES: Rise[] = ['Low', 'Mid', 'High'];
export const WAIST_NAMES: WaistKind[] = ['Regular', 'Belt loops', 'Drawcord', 'Knee strap'];
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

export function createTop(o: TopOpts): Garment {
  const name = o.block === 'Tank' ? 'tank' : o.block === 'Tee' ? 'tee' : 'long sleeve';
  return {
    id: newId(),
    name: `${o.fit} ${name}`,
    type: 'top',
    block: o.block,
    fit: 'Straight',
    rise: 'Mid',
    points: buildTopPoints(o),
    parts: { waist: 'Regular', pocket: 'None' },
    wash: 'White',
    fabric: o.block === 'Tank' ? 'Rib' : 'Jersey',
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
  button: { x: number; y: number };
}

/** sag: how far the waist edge dips at the centre (garment units), so the band wraps the body. */
export function garmentPaths(g: Pick<Garment, 'points' | 'parts'>, sag = 0, inset: [number, number] = [0, 0]): GarmentPaths {
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
    solid += scoop + ' M78,230 H104 V284 H78 Z M78,240 H104 M222,230 H196 V284 H222 Z M222,240 H196';
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
  if (waist === 'Knee strap') {
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
  const cr = findPoint(p, 'crotch');
  const hemLi = findPoint(p, 'hemLi'), hemLo = findPoint(p, 'hemLo');
  const kneeLi = findPoint(p, 'kneeLi'), kneeLo = findPoint(p, 'kneeLo');
  const hemY = Math.max(hemLo.y, hemLi.y);
  const inseamPx = Math.min(g.cropY ?? Infinity, hemY) - cr.y;
  const hemW = Math.abs(hemLi.x - hemLo.x);
  const kneeW = Math.abs(kneeLi.x - kneeLo.x);
  const waistIn = (2 * Math.abs(wr.x - wl.x)) / 9;
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
