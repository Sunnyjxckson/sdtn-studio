// Garment model and pure geometry helpers. Garment space is 300 x 516.
// Ported from the Edit mockup: build(), outline paths, details, live spec.

export const GARMENT_W = 300;
export const GARMENT_H = 516;

export type GarmentType = 'jeans';
export type Fit = 'Skinny' | 'Slim' | 'Straight' | 'Flare' | 'Baggy' | 'Wide';
export type Rise = 'Low' | 'Mid' | 'High';
export type WaistKind = 'Regular' | 'Belt loops' | 'Drawcord' | 'Knee strap';
export type PocketKind = 'Scoop' | 'Coin' | 'Cargo' | 'None';
export type WashName = 'Raw indigo' | 'Washed black' | 'Grey' | 'Bleached' | 'Ecru';

export interface Pt {
  x: number;
  y: number;
  key?: string;
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
  holes: Hole[];
  distress: Rip[];
  texts: GText[];
  cropY: number | null;
  transform: Transform;
  visible: boolean;
}

export const FIT_NAMES: Fit[] = ['Skinny', 'Slim', 'Straight', 'Flare', 'Baggy', 'Wide'];
export const RISE_NAMES: Rise[] = ['Low', 'Mid', 'High'];
export const WAIST_NAMES: WaistKind[] = ['Regular', 'Belt loops', 'Drawcord', 'Knee strap'];
export const POCKET_NAMES: PocketKind[] = ['Scoop', 'Coin', 'Cargo', 'None'];

export const WASHES: Record<WashName, string> = {
  'Raw indigo': '#2C3A5C',
  'Washed black': '#454B54',
  Grey: '#8A8F96',
  Bleached: '#9DB4CC',
  Ecru: '#E2D9C3',
};
export const WASH_NAMES = Object.keys(WASHES) as WashName[];

export const HOLE_SIZES = { S: 6, M: 10, L: 16 } as const;
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
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
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
}

export function garmentPaths(g: Pick<Garment, 'points' | 'parts'>): GarmentPaths {
  const pts = g.points;
  const body = 'M' + pts.map((p) => f(p.x, p.y)).join(' L') + ' Z';
  const wl = findPoint(pts, 'waistL');
  const wr = findPoint(pts, 'waistR');
  const top = wl.y;
  const band = 'M' + [f(wl.x, wl.y - 14), f(wr.x, wr.y - 14), f(wr.x, wr.y), f(wl.x, wl.y)].join(' L') + ' Z';
  const details =
    'M' + f(150, top) + ' V' + (top + 52) +
    ' M' + f(160, top) + ' V' + (top + 42) +
    ' Q' + f(160, top + 54) + ' ' + f(150, top + 56);

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
      ' M' + f(142, top - 6) + ' Q' + f(136, top + 26) + ' ' + f(142, top + 46) +
      ' M' + f(158, top - 6) + ' Q' + f(164, top + 26) + ' ' + f(158, top + 46);
  }
  if (waist === 'Belt loops') {
    [0.1, 0.3, 0.7, 0.9].forEach((t) => {
      const x = wl.x + (wr.x - wl.x) * t;
      solid += ' M' + f(x, top - 16) + ' V' + (top + 2);
    });
  }
  let strap = '';
  if (waist === 'Knee strap') {
    const a = findPoint(pts, 'kneeLi');
    const b = findPoint(pts, 'kneeRi');
    strap = 'M' + f(a.x - 4, a.y + 26) + ' Q' + f(150, a.y + 56) + ' ' + f(b.x + 4, b.y + 26);
  }
  return { body, band, details, solid, strap };
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
  return w === 'Raw indigo' || w === 'Washed black';
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
    { k: 'Rise', v: `${half((cr.y - bandTop(p)) / 9.4)} in` },
    { k: 'Inseam', v: `${half(Math.max(0, inseamPx) / 9.4)} in` },
    { k: 'Knee', v: `${half(kneeW / 4.6)} in` },
    { k: 'Leg opening', v: `${half(hemW / 4.6)} in` },
    { k: 'Holes / rips', v: `${g.holes.length} / ${g.distress.length}` },
  ];
}
