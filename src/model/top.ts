// Tops are stored in body-relative space so they fit whatever croquis and pose they land on.
//
// Torso points: x = 150 + u * 100, y = 100 + v * 200. u is -1 at the body's left edge and +1 at the
// right edge (beyond 1 is ease). v is 0 at the neck base, 1 at the waist, 1.5 at the hip.
// Sleeve points (r = 'armL' or 'armR'): x = a * 100 along the arm (0 shoulder, 1 elbow, 2 wrist),
// y = 100 + o * 100 across it (-1 outer edge, +1 inner edge, beyond is ease).

import type { TorsoProfile, Vec } from './figure';
import type { FabricKind, Garment, Pt, WashName } from './garment';

export type TopBlock =
  | 'Tank' | 'Tee' | 'Long sleeve' | 'Hoodie' | 'Moto jacket' | 'Dress'
  | 'Button-up' | 'Polo' | 'Sweatshirt' | 'Bomber' | 'Trucker' | 'Puffer' | 'Trench' | 'Blazer' | 'Zip hoodie';
export type SleeveKind = 'Short' | 'Long';
export const SLEEVE_KINDS: SleeveKind[] = ['Short', 'Long'];
export type Silhouette = 'Slip' | 'Bodycon' | 'A-line';
export type DressLen = 'Mini' | 'Midi' | 'Maxi';
export type DressTop = 'Straps' | 'Wide strap' | 'Strapless' | 'Short sleeve' | 'Long sleeve';
export type TopFit = 'Fitted' | 'Regular' | 'Oversized';
export type TopLength = 'Crop' | 'Waist' | 'Hip' | 'Long';
export type NeckKind = 'Crew' | 'Scoop' | 'V';
export const TOP_BLOCKS: TopBlock[] = ['Tank', 'Tee', 'Long sleeve', 'Button-up', 'Polo', 'Sweatshirt', 'Hoodie', 'Zip hoodie', 'Moto jacket', 'Bomber', 'Trucker', 'Puffer', 'Trench', 'Blazer', 'Dress'];
export const SILHOUETTES: Silhouette[] = ['Slip', 'Bodycon', 'A-line'];
export const DRESS_LENS: DressLen[] = ['Mini', 'Midi', 'Maxi'];
export const DRESS_TOPS: DressTop[] = ['Straps', 'Wide strap', 'Strapless', 'Short sleeve', 'Long sleeve'];
export const TOP_FITS: TopFit[] = ['Fitted', 'Regular', 'Oversized'];
export const TOP_LENGTHS: TopLength[] = ['Crop', 'Waist', 'Hip', 'Long'];
export const NECKS: NeckKind[] = ['Crew', 'Scoop', 'V'];

export interface TopOpts {
  block: TopBlock;
  fit: TopFit;
  length: TopLength;
  neck: NeckKind;
  tuck: boolean;
  /** Dress only (older saves leave these out). */
  silhouette?: Silhouette;
  dressLen?: DressLen;
  dressTop?: DressTop;
  /** Button-up and polo only: short or long sleeves. */
  sleeve?: SleeveKind;
  /** Puffer only: attach a hood. */
  hood?: boolean;
}

const BLOCK_WORD: Record<TopBlock, string> = {
  Tank: 'tank',
  Tee: 'tee',
  'Long sleeve': 'long sleeve',
  Hoodie: 'hoodie',
  'Moto jacket': 'moto jacket',
  Dress: 'dress',
  'Button-up': 'button-up',
  Polo: 'polo',
  Sweatshirt: 'sweatshirt',
  Bomber: 'bomber jacket',
  Trucker: 'trucker jacket',
  Puffer: 'puffer jacket',
  Trench: 'trench coat',
  Blazer: 'blazer',
  'Zip hoodie': 'zip hoodie',
};
export function topName(o: TopOpts): string {
  if (o.block === 'Dress') return `${silhouetteOf(o)} dress`;
  if (o.block === 'Button-up' || o.block === 'Polo') return `${sleeveKindOf(o) === 'Short' ? 'Short sleeve' : o.fit} ${BLOCK_WORD[o.block]}`;
  return `${o.fit} ${BLOCK_WORD[o.block]}`;
}
export const sleeveKindOf = (o: TopOpts): SleeveKind => o.sleeve ?? (o.block === 'Polo' ? 'Short' : 'Long');
/** Hooded blocks: the hood lies behind the neck. */
export const isHoodie = (o?: TopOpts) => o?.block === 'Hoodie' || o?.block === 'Zip hoodie' || (o?.block === 'Puffer' && !!o.hood);
/** Blocks with a band at the hem and cuffs, so the hem gathers in. */
export const isBanded = (o?: TopOpts) => o?.block === 'Hoodie' || o?.block === 'Zip hoodie' || o?.block === 'Sweatshirt' || o?.block === 'Bomber' || o?.block === 'Moto jacket';
/** Coats run past the hip and use the skirt part of the body mapping. */
export const isCoat = (o?: TopOpts) => o?.block === 'Trench';
/** Blocks that can be tucked in. */
export const canTuck = (o: TopOpts) => o.block === 'Tank' || o.block === 'Tee' || o.block === 'Long sleeve' || o.block === 'Button-up' || o.block === 'Polo';
/** Blocks where the neck option applies. */
export const hasNeckOption = (o: TopOpts) => o.block === 'Tank' || o.block === 'Tee' || o.block === 'Long sleeve';
export const isDress = (o?: TopOpts) => o?.block === 'Dress';
/** Block, fabric and wash a new block starts with. */
export const BLOCK_LOOK: Partial<Record<TopBlock, { fabric: FabricKind; wash: WashName }>> = {
  Hoodie: { fabric: 'Jersey', wash: 'Heather' },
  'Moto jacket': { fabric: 'Leather', wash: 'Black' },
  Dress: { fabric: 'Satin', wash: 'Black' },
  'Button-up': { fabric: 'Poplin', wash: 'White' },
  Polo: { fabric: 'Jersey', wash: 'Navy' },
  Sweatshirt: { fabric: 'Jersey', wash: 'Heather' },
  Bomber: { fabric: 'Nylon', wash: 'Olive' },
  Trucker: { fabric: 'Denim', wash: 'Raw indigo' },
  Puffer: { fabric: 'Nylon', wash: 'Black' },
  Trench: { fabric: 'Twill', wash: 'Cream' },
  Blazer: { fabric: 'Twill', wash: 'Navy' },
  'Zip hoodie': { fabric: 'Jersey', wash: 'Grey' },
};
export const dressTopOf = (o: TopOpts): DressTop => o.dressTop ?? 'Straps';
export const dressLenOf = (o: TopOpts): DressLen => o.dressLen ?? 'Midi';
export const silhouetteOf = (o: TopOpts): Silhouette => o.silhouette ?? 'Slip';
/** Does the top have sleeves, and how long (in arm units, 2 is the wrist). */
export function sleeveOf(o: TopOpts): number {
  switch (o.block) {
    case 'Tank': return 0;
    case 'Tee': return o.fit === 'Fitted' && o.length === 'Crop' ? 0.3 : 0.44;
    case 'Dress': return dressTopOf(o) === 'Long sleeve' ? 2.02 : dressTopOf(o) === 'Short sleeve' ? 0.4 : 0;
    case 'Button-up': return sleeveKindOf(o) === 'Short' ? 0.5 : 2.02;
    case 'Polo': return sleeveKindOf(o) === 'Short' ? 0.46 : 2.02;
    default: return 2.02;
  }
}
/** Cuffed sleeves end narrower than the sleeve above them. */
const CUFF: Record<TopFit, number> = { Fitted: 1.0, Regular: 1.1, Oversized: 1.26 };
const CUFF_BY: Partial<Record<TopBlock, Record<TopFit, number>>> = {
  Hoodie: CUFF,
  'Zip hoodie': CUFF,
  Sweatshirt: CUFF,
  'Moto jacket': CUFF,
  Bomber: { Fitted: 0.98, Regular: 1.06, Oversized: 1.2 },
  Puffer: { Fitted: 1.08, Regular: 1.16, Oversized: 1.3 },
  Trucker: { Fitted: 1.04, Regular: 1.14, Oversized: 1.28 },
  Trench: { Fitted: 1.1, Regular: 1.18, Oversized: 1.32 },
  'Button-up': { Fitted: 1.0, Regular: 1.08, Oversized: 1.22 },
  Polo: { Fitted: 1.0, Regular: 1.08, Oversized: 1.22 },
};
export const cuffedOf = (o: TopOpts): number | null => {
  if ((o.block === 'Button-up' || o.block === 'Polo') && sleeveOf(o) < 1) return null;
  return CUFF_BY[o.block]?.[o.fit] ?? null;
};

export const torsoPt = (u: number, v: number, key?: string): Pt => ({ x: 150 + u * 100, y: 100 + v * 200, ...(key ? { key } : {}) });
const armPt = (side: 'armL' | 'armR', a: number, o: number, key?: string): Pt => ({ x: a * 100, y: 100 + o * 100, r: side, ...(key ? { key } : {}) });
export const uv = (p: { x: number; y: number }) => ({ u: (p.x - 150) / 100, v: (p.y - 100) / 200 });

const EASE: Record<TopFit, { body: number; waist: number; sleeve: number; shoulder: number; drop: number }> = {
  Fitted: { body: 1.04, waist: 1.04, sleeve: 1.1, shoulder: 1.04, drop: 0 },
  Regular: { body: 1.1, waist: 1.1, sleeve: 1.26, shoulder: 1.07, drop: 0.03 },
  Oversized: { body: 1.26, waist: 1.3, sleeve: 1.55, shoulder: 1.2, drop: 0.12 },
};
const EASE_HOODIE: typeof EASE = {
  Fitted: { body: 1.1, waist: 1.07, sleeve: 1.12, shoulder: 1.05, drop: 0.02 },
  Regular: { body: 1.2, waist: 1.15, sleeve: 1.24, shoulder: 1.1, drop: 0.07 },
  Oversized: { body: 1.4, waist: 1.36, sleeve: 1.5, shoulder: 1.28, drop: 0.2 },
};
const EASE_MOTO: typeof EASE = {
  Fitted: { body: 1.05, waist: 1.02, sleeve: 1.12, shoulder: 1.05, drop: 0 },
  Regular: { body: 1.13, waist: 1.08, sleeve: 1.24, shoulder: 1.09, drop: 0.03 },
  Oversized: { body: 1.3, waist: 1.24, sleeve: 1.48, shoulder: 1.22, drop: 0.1 },
};
const EASE_PUFFER: typeof EASE = {
  Fitted: { body: 1.12, waist: 1.1, sleeve: 1.3, shoulder: 1.08, drop: 0.03 },
  Regular: { body: 1.22, waist: 1.18, sleeve: 1.4, shoulder: 1.12, drop: 0.08 },
  Oversized: { body: 1.4, waist: 1.36, sleeve: 1.55, shoulder: 1.26, drop: 0.18 },
};
const EASE_BOMBER: typeof EASE = {
  Fitted: { body: 1.1, waist: 1.04, sleeve: 1.14, shoulder: 1.05, drop: 0.02 },
  Regular: { body: 1.2, waist: 1.12, sleeve: 1.26, shoulder: 1.1, drop: 0.06 },
  Oversized: { body: 1.38, waist: 1.3, sleeve: 1.5, shoulder: 1.24, drop: 0.16 },
};
const EASE_TAILORED: typeof EASE = {
  Fitted: { body: 1.06, waist: 1.0, sleeve: 1.1, shoulder: 1.05, drop: 0 },
  Regular: { body: 1.12, waist: 1.05, sleeve: 1.2, shoulder: 1.08, drop: 0.02 },
  Oversized: { body: 1.28, waist: 1.2, sleeve: 1.4, shoulder: 1.2, drop: 0.1 },
};
const EASE_COAT: typeof EASE = {
  Fitted: { body: 1.1, waist: 1.02, sleeve: 1.14, shoulder: 1.05, drop: 0.01 },
  Regular: { body: 1.18, waist: 1.1, sleeve: 1.26, shoulder: 1.1, drop: 0.04 },
  Oversized: { body: 1.34, waist: 1.26, sleeve: 1.5, shoulder: 1.22, drop: 0.14 },
};
const EASE_SHIRT: typeof EASE = {
  Fitted: { body: 1.04, waist: 1.02, sleeve: 1.1, shoulder: 1.04, drop: 0 },
  Regular: { body: 1.1, waist: 1.08, sleeve: 1.22, shoulder: 1.07, drop: 0.02 },
  Oversized: { body: 1.26, waist: 1.26, sleeve: 1.5, shoulder: 1.2, drop: 0.12 },
};
function easeOf(o: TopOpts) {
  switch (o.block) {
    case 'Hoodie': case 'Sweatshirt': case 'Zip hoodie': return EASE_HOODIE[o.fit];
    case 'Moto jacket': return EASE_MOTO[o.fit];
    case 'Puffer': return EASE_PUFFER[o.fit];
    case 'Bomber': case 'Trucker': return EASE_BOMBER[o.fit];
    case 'Blazer': return EASE_TAILORED[o.fit];
    case 'Trench': return EASE_COAT[o.fit];
    case 'Button-up': case 'Polo': return EASE_SHIRT[o.fit];
    default: return EASE[o.fit];
  }
}
const LENGTH_V: Record<TopLength, number> = { Crop: 0.8, Waist: 1.1, Hip: 1.4, Long: 1.7 };
const LENGTH_MOTO: Record<TopLength, number> = { Crop: 0.85, Waist: 1.12, Hip: 1.32, Long: 1.58 };
const NECK_V: Record<NeckKind, number> = { Crew: 0.07, Scoop: 0.17, V: 0.27 };

/** Skirt v: 1.5 is the hip, and the ankle is 1.1 further down. */
const SKIRT_V = 1.1;
const DRESS_S: Record<DressLen, number> = { Mini: 0.2, Midi: 0.62, Maxi: 0.93 };
export const dressHemV = (o: TopOpts) => 1.5 + SKIRT_V * DRESS_S[dressLenOf(o)];

function buildDress(o: TopOpts): Pt[] {
  const e = EASE[o.fit];
  const top = dressTopOf(o);
  const sil = silhouetteOf(o);
  const sl = sleeveOf(o);
  const bare = top === 'Straps' || top === 'Strapless';
  const hv = dressHemV(o);
  const s01 = DRESS_S[dressLenOf(o)];
  // skirt width as a multiple of the leg span, at the hip, mid skirt and hem
  const W = sil === 'Slip' ? [1.07, 1.1, 1.14] : sil === 'Bodycon' ? [1.02, 1.02, 1.01] : [1.12, 1.12 + (0.2 + 0.55 * s01) * 0.5, 1.2 + 0.55 * s01];
  const waistU = sil === 'Slip' ? e.waist * 1.04 : sil === 'Bodycon' ? Math.min(e.waist, 1.04) : 1.04;
  const bodyU = sil === 'Bodycon' ? Math.min(e.body, 1.05) : e.body;
  const side = (s: -1 | 1): Pt[] => {
    const k = s < 0 ? 'L' : 'R';
    const arm = s < 0 ? 'armL' : 'armR';
    const out: Pt[] = [];
    if (top === 'Wide strap') {
      out.push(torsoPt(s * 0.6, 0.02, `strap${k}`));
      out.push(torsoPt(s * bodyU, 0.36, `arm${k}`));
    } else if (bare) {
      out.push(torsoPt(s * Math.min(bodyU, 1.02), 0.46, `arm${k}`));
    } else {
      out.push(torsoPt(s * e.shoulder, -0.015, `sh${k}`));
      out.push(armPt(arm, sl + e.drop, -(e.sleeve + 0.14), `slO${k}`));
      out.push(armPt(arm, sl + e.drop - 0.05, e.sleeve + 0.06, `slI${k}`));
      out.push(torsoPt(s * bodyU, 0.32 + e.drop, `arm${k}`));
    }
    out.push(torsoPt(s * waistU, 1.0, `side${k}`));
    out.push(torsoPt(s * W[0], 1.5, `sk1${k}`));
    out.push(torsoPt(s * W[1], 1.5 + (hv - 1.5) * 0.5, `sk2${k}`));
    out.push(torsoPt(s * W[2], hv, `hem${k}`));
    return out;
  };
  const left = side(-1);
  const right = side(1).reverse();
  if (bare) {
    const dip = o.neck === 'V' ? 0.2 : o.neck === 'Scoop' ? 0.08 : 0.025;
    return [torsoPt(-0.9, 0.33, 'neckL'), ...left, ...right, torsoPt(0.9, 0.33, 'neckR'), torsoPt(0, 0.33 + dip, 'neckF')];
  }
  const neckW = top === 'Wide strap' ? 0.36 : 0.3;
  return [torsoPt(-neckW, -0.01, 'neckL'), ...left, ...right, torsoPt(neckW, -0.01, 'neckR'), torsoPt(0, NECK_V[o.neck] + (top === 'Wide strap' ? 0.06 : 0), 'neckF')];
}

/** Where the front neck point sits, and whether the neck is a straight V. */
function neckFront(o: TopOpts): { v: number; vee: boolean } {
  switch (o.block) {
    case 'Moto jacket': return { v: 0.46, vee: true };
    case 'Blazer': return { v: 0.6, vee: true };
    case 'Trench': return { v: 0.5, vee: true };
    case 'Button-up': return { v: 0.11, vee: false };
    case 'Trucker': return { v: 0.1, vee: false };
    case 'Polo': return { v: 0.14, vee: false };
    case 'Bomber': return { v: 0.05, vee: false };
    case 'Puffer': return { v: 0.03, vee: false };
    case 'Sweatshirt': return { v: 0.08, vee: false };
    case 'Zip hoodie': return { v: 0.03, vee: false };
    case 'Hoodie': return { v: 0.03 + NECK_V[o.neck], vee: false };
    case 'Tank': return { v: NECK_V[o.neck] + 0.06, vee: false };
    default: return { v: NECK_V[o.neck], vee: false };
  }
}
const NECK_HALF: Partial<Record<TopBlock, number>> = { Tank: 0.36, 'Moto jacket': 0.32, Blazer: 0.3, Trench: 0.3, 'Button-up': 0.27, Trucker: 0.28, Bomber: 0.27, Puffer: 0.27, Polo: 0.28 };
const LENGTH_TAILORED: Record<TopLength, number> = { Crop: 0.9, Waist: 1.12, Hip: 1.38, Long: 1.6 };
const lengthsOf = (o: TopOpts) => (o.block === 'Moto jacket' || o.block === 'Bomber' || o.block === 'Trucker' ? LENGTH_MOTO : o.block === 'Blazer' ? LENGTH_TAILORED : LENGTH_V);
/** Coat hem v (the skirt part of the body mapping starts at 1.5). */
const COAT_V: Record<TopLength, number> = { Crop: 1.5, Waist: 1.62, Hip: 1.8, Long: 2.05 };
export const coatHemV = (o: TopOpts) => COAT_V[o.length];

function buildCoat(o: TopOpts): Pt[] {
  const e = easeOf(o);
  const hv = coatHemV(o);
  const flare = o.fit === 'Oversized' ? 0.14 : o.fit === 'Fitted' ? -0.06 : 0;
  const drop = hv - 1.5;
  const W = [e.body * 0.98 + 0.08 + flare * 0.5, 1.22 + flare + drop * 0.35, 1.3 + flare + drop * 0.75];
  const side = (s: -1 | 1): Pt[] => {
    const k = s < 0 ? 'L' : 'R';
    const arm = s < 0 ? 'armL' : 'armR';
    const cuff = cuffedOf(o) ?? e.sleeve + 0.06;
    return [
      torsoPt(s * e.shoulder, -0.015, `sh${k}`),
      armPt(arm, 2.02 + e.drop, -cuff, `slO${k}`),
      armPt(arm, 2.02 + e.drop - 0.05, cuff, `slI${k}`),
      torsoPt(s * e.body, 0.32 + e.drop, `arm${k}`),
      torsoPt(s * e.waist, 1.0, `side${k}`),
      torsoPt(s * W[0], 1.5, `sk1${k}`),
      torsoPt(s * W[1], 1.5 + (hv - 1.5) * 0.5, `sk2${k}`),
      torsoPt(s * W[2], hv, `hem${k}`),
    ];
  };
  const left = side(-1);
  const right = side(1).reverse();
  const nf = torsoPt(0, neckFront(o).v, 'neckF');
  nf.vee = true;
  return [torsoPt(-0.3, -0.01, 'neckL'), ...left, ...right, torsoPt(0.3, -0.01, 'neckR'), nf];
}

/** Keyed outline points, clockwise from the left neck, ending at the front neck point. */
export function buildTopPoints(o: TopOpts): Pt[] {
  if (o.block === 'Dress') return buildDress(o);
  if (o.block === 'Trench') return buildCoat(o);
  const e = easeOf(o);
  const banded = isBanded(o), hood = o.block === 'Hoodie' || o.block === 'Zip hoodie';
  const len = o.tuck && canTuck(o) ? 1.12 : lengthsOf(o)[o.length];
  const neckW = NECK_HALF[o.block] ?? 0.3;
  const cuff = cuffedOf(o);
  const side = (s: -1 | 1): Pt[] => {
    const k = s < 0 ? 'L' : 'R';
    const arm = s < 0 ? 'armL' : 'armR';
    const out: Pt[] = [];
    if (o.block === 'Tank') {
      out.push(torsoPt(s * 0.6, 0.02, `strap${k}`));
      out.push(torsoPt(s * e.body, 0.36, `arm${k}`));
    } else {
      const sleeveLen = sleeveOf(o);
      out.push(torsoPt(s * e.shoulder, -0.015, `sh${k}`));
      // sleeves open out a little toward the hem, unless a cuff holds them in
      out.push(armPt(arm, sleeveLen + e.drop, -(cuff ?? e.sleeve + 0.14), `slO${k}`));
      out.push(armPt(arm, sleeveLen + e.drop - 0.05, cuff ?? e.sleeve + 0.06, `slI${k}`));
      out.push(torsoPt(s * e.body, 0.32 + e.drop, `arm${k}`));
    }
    out.push(torsoPt(s * (o.length === 'Crop' && !o.tuck ? e.body * 0.97 : e.waist), Math.min(1, len - 0.02), `side${k}`));
    // banded hems are gathered in by a band, so they do not flare; puffers and tailored blocks hang straight
    const flare = !banded && len > 1.2 && (o.block === 'Tank' || o.block === 'Tee' || o.block === 'Long sleeve' || o.block === 'Polo');
    out.push(torsoPt(s * (flare ? Math.max(e.waist, e.body) * 1.04 + 0.1 : hood ? e.waist * 0.99 : o.block === 'Puffer' ? e.waist * 1.02 : e.waist), len, `hem${k}`));
    return out;
  };
  const left = side(-1);
  const right = side(1).reverse();
  const nk = neckFront(o);
  const nf = torsoPt(0, nk.v, 'neckF');
  if (nk.vee) nf.vee = true;
  return [torsoPt(-neckW, -0.01, 'neckL'), ...left, ...right, torsoPt(neckW, -0.01, 'neckR'), nf];
}

/** Points as they show from the front or back: the back neckline sits high. */
export function viewPoints(points: Pt[], o: TopOpts | undefined, view: 'front' | 'back'): Pt[] {
  if (view !== 'back') return points;
  const backV = o?.block === 'Dress' && (o.dressTop === 'Strapless' || o.dressTop === undefined || o.dressTop === 'Straps') ? 0.33 : o?.block === 'Tank' ? 0.1 : 0.05;
  return points.map((p) => (p.key === 'neckF' ? { ...p, y: Math.min(p.y, 100 + backV * 200), vee: undefined } : p));
}

// ---------- mapping onto the body ----------

function sideX(pts: Vec[], y: number): number {
  if (y <= pts[0].y) return pts[0].x;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (y <= b.y) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return b.x + ((y - b.y) / (b.y - a.y || 1)) * (b.x - a.x) * 0.5;
}

/** Body left and right edge x at canvas y, above the armpit running up to the shoulder tip. */
function edges(t: TorsoProfile, y: number): [number, number] {
  const e = (s: 0 | 1) => {
    const tip = t.tip[s], pit = t.armpit[s];
    if (y < pit.y) {
      const k = Math.max(0, Math.min(1, (y - tip.y) / (pit.y - tip.y || 1)));
      return tip.x + (pit.x - tip.x) * k;
    }
    return sideX(t.sides[s], y);
  };
  return [e(0), e(1)];
}

const neckY = (t: TorsoProfile) => (t.neck[0].y + t.neck[1].y) / 2;

function vToY(t: TorsoProfile, v: number): number {
  const yN = neckY(t);
  if (v > 1.5) return t.hipY + ((v - 1.5) / SKIRT_V) * (t.ankleY - t.hipY);
  return v <= 1 ? yN + v * (t.waistY - yN) : t.waistY + ((v - 1) / 0.5) * (t.hipY - t.waistY);
}

/** Canvas height per unit v at v. */
function dYdv(t: TorsoProfile, v: number): number {
  if (v > 1.5) return (t.ankleY - t.hipY) / SKIRT_V;
  return v > 1 ? (t.hipY - t.waistY) / 0.5 : t.waistY - neckY(t);
}

/** Centre and half width of a skirt at y: the hip at the top, the span of both legs below. */
function skirtHalf(t: TorsoProfile, y: number): { c: number; h: number } {
  const [l0, r0] = edges(t, t.hipY);
  const [l1, r1] = t.span(y);
  const k = Math.max(0, Math.min(1, (y - t.hipY) / 40));
  const w = k * k * (3 - 2 * k);
  const l = l0 + (l1 - l0) * w, r = r0 + (r1 - r0) * w;
  return { c: (l + r) / 2, h: (r - l) / 2 };
}

/** Height of the top of the shoulder at canvas x (neck to tip), or null past the tip. */
function shoulderY(t: TorsoProfile, x: number): number | null {
  const s = x < (t.neck[0].x + t.neck[1].x) / 2 ? t.shoulder[0] : t.shoulder[1];
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i], b = s[i + 1];
    if ((x - a.x) * (x - b.x) <= 0) return a.y + ((x - a.x) / (b.x - a.x || 1)) * (b.y - a.y);
  }
  // past the tip (dropped shoulders) the line keeps falling, like fabric over the shoulder
  const tip = s[s.length - 1];
  const out = Math.abs(x - s[0].x) > Math.abs(tip.x - s[0].x);
  return out ? tip.y + Math.abs(x - tip.x) * 0.9 : null;
}

function armHalf(arm: TorsoProfile['arms'][0], a: number): number {
  const h = arm.half;
  if (a <= h[0][0]) return h[0][1];
  for (let i = 0; i < h.length - 1; i++) if (a <= h[i + 1][0]) return h[i][1] + ((a - h[i][0]) / (h[i + 1][0] - h[i][0] || 1)) * (h[i + 1][1] - h[i][1]);
  return h[h.length - 1][1];
}

function armFrame(arm: TorsoProfile['arms'][0], a: number) {
  const seg = a <= 1 ? 0 : 1;
  const A = arm.bones[seg], B = arm.bones[seg + 1];
  const t = a - seg;
  const dx = B.x - A.x, dy = B.y - A.y;
  const L = Math.hypot(dx, dy) || 1;
  const u = { x: dx / L, y: dy / L };
  return { base: { x: A.x + dx * t, y: A.y + dy * t }, n: { x: u.y, y: -u.x }, u, A, L, seg };
}

/** Body half width at y, stiffened toward the chest width so looser tops hang straight. */
function halfAt(t: TorsoProfile, y: number, stiff: number): { c: number; h: number } {
  const [l, r] = edges(t, y);
  let h = (r - l) / 2;
  const c = (l + r) / 2;
  if (stiff > 0) {
    const yc = Math.max(...t.armpit.map((p) => p.y)) + 6;
    if (y > yc) {
      const [cl, cr] = edges(t, yc);
      h = h + (Math.max(h, (cr - cl) / 2) - h) * stiff;
    }
  }
  return { c, h };
}

function torsoForward(t: TorsoProfile, u: number, v: number, stiff: number): Vec {
  if (v > 1.5) {
    const ys = vToY(t, v);
    const { c, h } = skirtHalf(t, ys);
    return { x: c + u * h, y: ys };
  }
  let y = vToY(t, v);
  let x = 0;
  // near the top, ride the actual shoulder line (a little above the skin) so nothing shows
  for (let i = 0; i < 3; i++) {
    const { c, h } = halfAt(t, y, stiff);
    x = c + u * h;
    if (v < 0.22) {
      const sy = shoulderY(t, x);
      if (sy != null) {
        const yN = neckY(t);
        const onShoulder = sy - 2 + v * (t.waistY - yN);
        const w = Math.max(0, 1 - v / 0.22);
        y = vToY(t, v) * (1 - w) + onShoulder * w;
      }
    }
  }
  return { x, y };
}

/** Top space to posed canvas. stiff: 0 hugs the body, 1 hangs straight from the chest. */
export function topForward(t: TorsoProfile, p: Pt, stiff = 0): Vec {
  if (p.r === 'armL' || p.r === 'armR') {
    const s = p.r === 'armL' ? 0 : 1;
    const arm = t.arms[s];
    const a = p.x / 100, o = (p.y - 100) / 100;
    const f = armFrame(arm, a);
    const off = o * armHalf(arm, a) * (s === 0 ? 1 : -1);
    return { x: f.base.x + f.n.x * off, y: f.base.y + f.n.y * off };
  }
  const { u, v } = uv(p);
  return torsoForward(t, u, v, stiff);
}

/** Posed canvas back to top space, in the given region. */
export function topInverse(t: TorsoProfile, q: Vec, region?: Pt['r'], stiff = 0): Pt {
  if (region === 'armL' || region === 'armR') {
    const s = region === 'armL' ? 0 : 1;
    const arm = t.arms[s];
    let best = { a: 0, o: 0, d: Infinity };
    for (const seg of [0, 1]) {
      const A = arm.bones[seg], B = arm.bones[seg + 1];
      const dx = B.x - A.x, dy = B.y - A.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const tt = Math.max(seg === 0 ? -0.3 : 0, Math.min(seg === 0 ? 1 : 1.3, ((q.x - A.x) * ux + (q.y - A.y) * uy) / L));
      const bx = A.x + dx * tt, by = A.y + dy * tt;
      const d = Math.hypot(q.x - bx, q.y - by);
      if (d < best.d) {
        const a = seg + tt;
        const off = (q.x - bx) * uy + (q.y - by) * -ux;
        best = { a, o: (off / armHalf(arm, a)) * (s === 0 ? 1 : -1), d };
      }
    }
    return { x: best.a * 100, y: 100 + best.o * 100, r: region };
  }
  // numeric inverse: start from the plain mapping and walk toward the target
  const yN = neckY(t);
  let v = q.y <= t.waistY ? (q.y - yN) / (t.waistY - yN) : q.y <= t.hipY ? 1 + ((q.y - t.waistY) / (t.hipY - t.waistY)) * 0.5 : 1.5 + ((q.y - t.hipY) / (t.ankleY - t.hipY)) * SKIRT_V;
  let u = 0;
  for (let i = 0; i < 14; i++) {
    const f = torsoForward(t, u, v, stiff);
    const { h } = v > 1.5 ? skirtHalf(t, f.y) : halfAt(t, q.y, stiff);
    u += (q.x - f.x) / (h || 1);
    v += (q.y - f.y) / dYdv(t, v);
  }
  return torsoPt(u, v);
}

// ---------- outline for drawing ----------

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ...(a.r ? { r: a.r } : {}) });
const quad = (a: Pt, c: Pt, b: Pt, k: number): Pt => ({
  x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * b.x,
  y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * c.y + k * k * b.y,
  ...(a.r ? { r: a.r } : {}),
});

export interface TopShape {
  /** Closed outline in canvas space. */
  outline: Vec[];
  /** Index into outline for each original point. */
  index: number[];
  /** Open polylines in canvas space for the neckline, armholes and sleeve and body hems. */
  neckline: Vec[];
  hems: Vec[][];
  /** Sleeve shapes (canvas), for shading the underside. */
  sleeves: Vec[][];
}

/** Map the top onto the body, adding in-between points so every edge follows the body. */
/** How straight a fit hangs. */
export const stiffOf = (o?: TopOpts) =>
  o?.block === 'Dress' || o?.block === 'Moto jacket' || o?.block === 'Blazer' || o?.block === 'Trench' ? 0 : o?.fit === 'Oversized' ? 1 : o?.fit === 'Regular' ? 0.65 : 0;

export function topShape(t: TorsoProfile, points: Pt[], stiff = 0, o?: TopOpts): TopShape {
  const n = points.length;
  const F = (p: Pt) => topForward(t, p, stiff);
  const outline: Vec[] = [];
  const index: number[] = new Array(n).fill(0);
  const iNF = points.findIndex((p) => p.key === 'neckF');
  const neckline: Vec[] = [];
  const hems: Vec[][] = [];
  const sleeveRun: { L: Vec[]; R: Vec[] } = { L: [], R: [] };
  const key = (p: Pt) => p.key ?? '';

  for (let i = 0; i < n; i++) {
    if (i === iNF) continue;
    const a = points[i];
    let b = points[(i + 1) % n];
    const steps: Pt[] = [];
    if (a.key === 'neckR' && iNF >= 0) {
      // neckline: one curve from neckR through neckF round to neckL
      const f = points[iNF];
      b = points[(iNF + 1) % n];
      const c = { x: 2 * f.x - (a.x + b.x) / 2, y: 2 * f.y - (a.y + b.y) / 2 } as Pt;
      if (f.vee) {
        // two straight runs meeting at the front point
        for (let k = 1; k < 8; k++) steps.push(lerpPt(a, f, k / 8));
        steps.push(f);
        for (let k = 1; k < 8; k++) steps.push(lerpPt(f, b, k / 8));
      } else {
        for (let k = 1; k < 16; k++) steps.push(quad(a, c, b, k / 16));
      }
      index[i] = outline.length;
      outline.push(F(a));
      index[iNF] = outline.length + 7;
      steps.forEach((p) => outline.push(F(p)));
      neckline.push(F(a), ...steps.map(F), F(b));
      continue;
    }
    if ((a.r ?? 't') === (b.r ?? 't')) {
      const armhole = (/^strap/.test(key(a)) && /^arm/.test(key(b))) || (/^arm/.test(key(a)) && /^strap/.test(key(b)));
      const cnt = 10;
      if (armhole) {
        const strap = /^strap/.test(key(a)) ? a : b, pit = strap === a ? b : a;
        const c = torsoPt(uv(strap).u * 1.02, uv(pit).v * 0.92);
        for (let k = 1; k < cnt; k++) steps.push(quad(a, c, b, k / cnt));
      } else if (key(a) === 'hemL' && key(b) === 'hemR') {
        // body hem: dips a touch at the centre front and rolls up at the side seams
        const cnt2 = 16;
        for (let k = 1; k < cnt2; k++) {
          const f = k / cnt2;
          const p = lerpPt(a, b, f);
          // looser tops ripple along the hem as the fabric hangs in soft folds
          const skirtWave = o?.block === 'Dress' ? (o.silhouette === 'A-line' ? 3.4 : o.silhouette === 'Slip' ? 1.1 : 0) : 0;
          const wave = (stiff * 3.2 + skirtWave) * Math.sin(f * Math.PI * 7 + 0.6) * Math.sin(Math.PI * f);
          steps.push({ ...p, y: p.y + (o?.block === 'Dress' ? 5 : 4) * Math.sin(Math.PI * f) + wave });
        }
      } else if (a.r && a.r === b.r && /^sl/.test(key(a)) && /^sl/.test(key(b))) {
        // sleeve hem: curves around the arm
        for (let k = 1; k < 8; k++) {
          const f = k / 8;
          const p = lerpPt(a, b, f);
          steps.push({ ...p, x: p.x + 4 * Math.sin(Math.PI * f) });
        }
      } else if (!a.r && /^(arm|side)/.test(key(a)) && /^(side|hem)/.test(key(b))) {
        // side seams bow in a little and the hem corner rounds off, so the body is not a box
        const sgn = Math.sign(uv(a).u) || 1;
        const toHem = /^hem/.test(key(b));
        for (let k = 1; k < cnt; k++) {
          const f = k / cnt;
          const p = lerpPt(a, b, f);
          // only bow in as far as the ease allows, so a fitted top never cuts into the body
          const room = Math.max(0, Math.min(3.5, (Math.min(Math.abs(uv(a).u), Math.abs(uv(b).u)) - 1.03) * 45));
          const bow = room * Math.sin(Math.PI * f) * (1 - stiff) - stiff * 2.5 * Math.sin(2 * Math.PI * f);
          const corner = toHem ? 4 * Math.pow(f, 5) : 0;
          steps.push({ ...p, x: p.x - sgn * (bow + corner) });
        }
      } else if (!a.r && /^hem/.test(key(a)) && /^side/.test(key(b))) {
        const sgn = Math.sign(uv(a).u) || 1;
        for (let k = 1; k < cnt; k++) {
          const f = k / cnt;
          const p = lerpPt(a, b, f);
          const room = Math.max(0, Math.min(3.5, (Math.min(Math.abs(uv(a).u), Math.abs(uv(b).u)) - 1.03) * 45));
          steps.push({ ...p, x: p.x - sgn * (room * Math.sin(Math.PI * f) + 4 * Math.pow(1 - f, 5)) });
        }
      } else {
        for (let k = 1; k < cnt; k++) steps.push(lerpPt(a, b, k / cnt));
      }
    } else {
      // shoulder to sleeve or sleeve to underarm: run along the arm so the sleeve wraps it
      const arm = (a.r ?? b.r) as 'armL' | 'armR';
      const tp = a.r ? b : a, ap = a.r ? a : b;
      const start = topInverse(t, F(tp), arm, stiff);
      const runA = Math.max(0.04, Math.min(start.x / 100, 0.14));
      // the cap hugs the arm (outer side from the shoulder, inner side from the underarm) and eases out to the hem
      const oHem = (ap.y - 100) / 100;
      // the underside of the sleeve falls straight from the underarm instead of tapering into a notch
      const oCap = /^sh/.test(key(tp)) ? -1.04 : Math.max(1.0, oHem - 0.08);
      const mid: Pt[] = [];
      for (let k = 1; k <= 6; k++) {
        const f = k / 7;
        mid.push({ x: (runA + (ap.x / 100 - runA) * f) * 100, y: 100 + (oCap + (oHem - oCap) * f) * 100, r: arm });
      }
      if (a.r) mid.reverse();
      steps.push(...mid);
    }
    index[i] = outline.length;
    outline.push(F(a));
    steps.forEach((p) => outline.push(F(p)));
    if ((key(a) === 'slOL' && key(b) === 'slIL') || (key(a) === 'slIR' && key(b) === 'slOR')) hems.push([F(a), ...steps.map(F), F(b)]);
    if (key(a) === 'hemL' && key(b) === 'hemR') hems.push([F(a), ...steps.map(F), F(b)]);
    if (a.r === 'armL' || b.r === 'armL') sleeveRun.L.push(F(a), ...steps.map(F));
    if (a.r === 'armR' || b.r === 'armR') sleeveRun.R.push(F(a), ...steps.map(F));
  }
  const sleeves = [sleeveRun.L, sleeveRun.R].filter((x) => x.length > 2);
  return { outline, index, neckline, hems, sleeves };
}

// ---------- spec ----------

const half = (n: number) => (Math.round(n * 2) / 2).toString();

export function computeTopSpec(points: Pt[], t: TorsoProfile): { k: string; v: string }[] {
  const at = (k: string) => points.find((p) => p.key === k);
  const aL = at('armL'), aR = at('armR'), hL = at('hemL'), hR = at('hemR');
  const sL = at('shL') ?? at('strapL'), sR = at('shR') ?? at('strapR');
  const slO = at('slOL');
  const rows: { k: string; v: string }[] = [];
  if (aL && aR) rows.push({ k: 'Chest', v: `${half((t.inches.chest * (uv(aR).u - uv(aL).u)) / 2)} in` });
  if (hL && hR) rows.push({ k: 'Hem', v: `${half((t.inches.chest * 0.92 * (uv(hR).u - uv(hL).u)) / 2)} in` });
  if (sL && sR) rows.push({ k: 'Shoulder', v: `${half((t.inches.shoulder * (uv(sR).u - uv(sL).u)) / 2)} in` });
  if (hL) {
    const v = uv(hL).v;
    const len = v <= 1 ? v * t.inches.torso : v <= 1.5 ? t.inches.torso + (v - 1) * 2 * 7 : t.inches.torso + 7 + ((v - 1.5) / SKIRT_V) * 30;
    rows.push({ k: 'Body length', v: `${half(len + 2)} in` });
  }
  if (slO) rows.push({ k: 'Sleeve', v: `${half((slO.x / 100) * (t.inches.arm / 2))} in` });
  return rows;
}

/** The shape a top draws as, from the front or the back. */
export const garmentShape = (t: TorsoProfile, g: Pick<Garment, 'points' | 'top'>, view: 'front' | 'back'): TopShape =>
  topShape(t, viewPoints(g.points, g.top, view), stiffOf(g.top), g.top);
