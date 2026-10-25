// Flats: clean front and back technical drawings built from the same garment data as the sketch.
// Jeans reuse garmentPaths() and the outline points as they are. Tops are stored in body space,
// so they are laid flat: torso straight, sleeves angled out from the shoulder, nothing posed.

import {
  computeSpec,
  garmentPaths,
  findPoint,
  HOLE_SIZES,
  ripPath,
  hemPaths,
  CUFF,
  PX_IN_V,
  WASHES,
  zig,
  bandTop,
  bandHeight,
  type Garment,
  type Pt,
  type SpecRow,
} from './garment';
import { computeTopSpec, dressHemV, dressLenOf, dressTopOf, silhouetteOf, sleeveOf, uv } from './top';
import { blockParts } from './flatsBlocks';
import type { TorsoProfile } from './figure';
import { polyPath, ripPoly } from './rips';
import type { Note } from './note';

interface V {
  x: number;
  y: number;
}

export type ShapeKind = 'line' | 'seam' | 'stitch' | 'hole' | 'rip' | 'cut' | 'rib' | 'edge';
export interface FlatShape {
  d: string;
  k: ShapeKind;
  /** Fill white (the waistband sits on top of the body). */
  fill?: boolean;
  /** Offset, for a stitch row that runs beside a seam. */
  t?: [number, number];
}
export interface FlatText {
  x: number;
  y: number;
  t: string;
  size: number;
}
export interface FlatAnchor {
  key: string;
  label: string;
  desc: string;
  x: number;
  y: number;
}
export interface FlatView {
  id: 'front' | 'back';
  label: string;
  outline: string;
  clip: string;
  shapes: FlatShape[];
  /** Drawn before the body and not clipped to it (hood, straps). */
  behind?: FlatShape[];
  /** Drawn after the body and not clipped to it. */
  over?: FlatShape[];
  texts: FlatText[];
  /** Crop line: everything below is cut off. */
  cutY: number | null;
  box: { x0: number; y0: number; x1: number; y1: number };
  anchors: FlatAnchor[];
}
export interface LegendRow {
  n: number;
  label: string;
  desc: string;
}
export interface PlacedView {
  view: FlatView;
  ox: number;
  oy: number;
  /** View box in sheet space. */
  x0: number;
  x1: number;
  y1: number;
}
export interface PlacedCallout {
  n: number;
  cx: number;
  cy: number;
  ax: number;
  ay: number;
}
export interface FlatModel {
  g: Garment;
  views: FlatView[];
  legend: LegendRow[];
  spec: SpecRow[];
  materials: { k: string; v: string; swatch?: string }[];
  notes: string[];
  sheet: { w: number; h: number; views: PlacedView[]; callouts: PlacedCallout[] };
}

const f1 = (n: number) => n.toFixed(1);
const M = (p: V) => `${f1(p.x)},${f1(p.y)}`;
const mid = (a: V, b: V): V => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const quadPt = (a: V, c: V, b: V, t: number): V => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});
const circleD = (x: number, y: number, r: number) => `M${f1(x - r)},${f1(y)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
const holeSize = (r: number) => (Object.entries(HOLE_SIZES).sort((a, b) => Math.abs(a[1] - r) - Math.abs(b[1] - r))[0][0]);

/** x positions where a horizontal line at y crosses the polygon, left to right. */
function scan(poly: V[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  return xs.sort((p, q) => p - q);
}

function bbox(pts: V[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const WAIST_DESC: Record<string, string> = {
  Regular: 'Waistband, 2 rows of topstitch',
  'Belt loops': 'Waistband, 2 rows of topstitch, belt loops',
  Drawcord: 'Waistband with drawcord, 2 rows of topstitch',
  'Knee strap': 'Waistband, 2 rows of topstitch',
};

// ---------- jeans ----------

function jeansViews(g: Garment): FlatView[] {
  const pts = g.points;
  const poly = pts.map((p) => ({ x: p.x, y: p.y }));
  const wl = findPoint(pts, 'waistL'), wr = findPoint(pts, 'waistR');
  const cr = findPoint(pts, 'crotch');
  const top = wl.y;
  const hemY = Math.max(findPoint(pts, 'hemLo').y, findPoint(pts, 'hemLi').y);
  const cutY = g.cropY != null && g.cropY < hemY ? g.cropY : null;
  const effY = cutY ?? hemY;
  const P = garmentPaths(g, 0);
  const shorts = g.type === 'shorts';
  const hemKind = shorts ? g.parts.hem ?? 'Clean' : 'Clean';
  const hp = shorts ? hemPaths(g) : null;
  const pocketP = garmentPaths({ type: g.type, points: pts, parts: { waist: 'Regular', pocket: g.parts.pocket, hem: g.parts.hem } }, 0).solid;
  const waistP = garmentPaths({ type: g.type, points: pts, parts: { waist: g.parts.waist, pocket: 'None', hem: g.parts.hem } }, 0);
  const ct = top;
  const clip = P.body + ' ' + P.band;
  const bx = bbox([...poly, { x: wl.x, y: bandTop(pts) }, { x: wr.x, y: bandTop(pts) }, { x: wl.x, y: effY + 3 }]);
  const box = { x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: Math.min(bx.y1, effY + 4) };
  const hemStitch = (): { d: string; mid: V } => {
    const xs = scan(poly, effY - 7);
    let d = '';
    if (xs.length >= 4) d += `M${f1(xs[0] + 2)},${f1(effY - 7)} L${f1(xs[1] - 2)},${f1(effY - 7)} M${f1(xs[2] + 2)},${f1(effY - 7)} L${f1(xs[3] - 2)},${f1(effY - 7)}`;
    else if (xs.length >= 2) d += `M${f1(xs[0] + 2)},${f1(effY - 7)} L${f1(xs[xs.length - 1] - 2)},${f1(effY - 7)}`;
    return { d, mid: { x: xs.length >= 2 ? (xs[0] + xs[1]) / 2 : 100, y: effY - 7 } };
  };
  const hs = hemStitch();
  const cut: FlatShape[] = cutY != null ? [{ d: zig(20, 290, cutY - 3, 3, 5), k: 'cut' }] : [];
  const hemDesc =
    cutY != null
      ? 'Cut hem, raw edge'
      : hemKind === 'Cuffed'
        ? `Cuffed hem, ${f1(CUFF / PX_IN_V)} in turn up, stitched at the top`
        : hemKind === 'Raw'
          ? 'Raw cut hem, frayed edge, no stitching'
          : 'Hem, single needle topstitch';

  const hemShapes = (): FlatShape[] =>
    hemKind === 'Cuffed' && hp
      ? [{ d: hp.cuff, k: 'line' }, { d: hp.cuffLine, k: 'line' }, { d: hp.cuffStitch, k: 'stitch' }]
      : hemKind === 'Raw' && hp
        ? [{ d: hp.wear, k: 'rip' }]
        : [{ d: hs.d, k: 'stitch' }];
  const hemOver: FlatShape[] = hemKind === 'Raw' && hp ? [{ d: hp.fray, k: 'rip' }] : [];
  const common = (): FlatShape[] => [{ d: P.stitch, k: 'stitch' }, ...hemShapes(), ...cut];
  const marks: FlatShape[] = [];
  g.holes.forEach((h, i) => marks.push({ d: polyPath(ripPoly(g.id, i, h)), k: 'hole' }));
  g.distress.forEach((d) => marks.push({ d: ripPath(d), k: 'rip' }));

  // front
  const fa: FlatAnchor[] = [
    { key: 'band', label: 'Waistband', desc: WAIST_DESC[g.parts.waist] ?? WAIST_DESC.Regular, x: wl.x + 28, y: top - 6 },
  ];
  const pk = g.parts.pocket;
  if (pk !== 'None') fa.push({ key: 'fpocket', label: 'Front pockets', desc: 'Scoop pockets, topstitched opening', x: wl.x + 20.5, y: top + 29 });
  if (pk === 'Coin') fa.push({ key: 'coin', label: 'Coin pocket', desc: 'Patch coin pocket, topstitched', x: wr.x - 31, y: top + 26 });
  if (pk === 'Cargo') {
    if (shorts) {
      const bot = Math.min(284, effY - 14 - (hemKind === 'Cuffed' ? CUFF : 0));
      const topY = Math.max(bot - 54, wl.y + 40);
      const edge = scan(poly, (topY + bot) / 2)[0] ?? 78;
      fa.push({ key: 'cargo', label: 'Cargo pockets', desc: 'Patch thigh pockets, flap with topstitch', x: edge + 15, y: (topY + bot) / 2 });
    } else fa.push({ key: 'cargo', label: 'Cargo pockets', desc: 'Patch cargo pockets, flap with topstitch', x: 91, y: 284 });
  }
  fa.push({ key: 'fly', label: 'Fly', desc: 'Zip fly, J stitch, bar tack', x: 160, y: ct + 28 });
  if (P.button) fa.push({ key: 'button', label: 'Button and rivets', desc: 'Metal shank button, 2 rivets at pocket corners', x: P.button.x, y: P.button.y });
  if (g.parts.waist === 'Belt loops') fa.push({ key: 'loops', label: 'Belt loops', desc: '4 belt loops, bar tacked', x: wl.x + (wr.x - wl.x) * 0.7, y: top - 7 });
  if (g.parts.waist === 'Drawcord') fa.push({ key: 'cord', label: 'Drawcord', desc: 'Drawcord, finished with metal tips', x: 139, y: ct + 24 });
  if (g.parts.waist === 'Knee strap' && P.strap) {
    const a = findPoint(pts, 'kneeLi');
    fa.push({ key: 'strap', label: 'Knee strap', desc: 'Strap across the knees, buckle closure', x: 150, y: a.y + 41 });
  }
  fa.push({ key: 'hem', label: cutY != null ? 'Cut hem' : 'Hem', desc: hemDesc, x: hs.mid.x, y: hs.mid.y });
  g.holes.forEach((h, i) =>
    fa.push({ key: `hole${i}`, label: `Hole ${i + 1}`, desc: `Ripped opening, size ${holeSize(h.r)}, exposed weft threads`, x: h.x, y: h.y }),
  );
  g.distress.forEach((d, i) => fa.push({ key: `rip${i}`, label: `Distress ${i + 1}`, desc: 'Worn and frayed area, hand sanded', x: d.x, y: d.y }));
  g.texts.forEach((t, i) => fa.push({ key: `txt${i}`, label: `Print ${i + 1}`, desc: `Print "${t.t}", ${t.size} px type`, x: t.x, y: t.y }));

  const frontShapes: FlatShape[] = [
    { d: P.band, k: 'line', fill: true },
    { d: pocketP, k: 'line' },
    { d: pocketP, k: 'stitch', t: [0, 2.6] },
    { d: waistP.solid, k: 'line' },
    { d: P.details, k: 'stitch' },
    ...common(),
    ...(waistP.strap ? [{ d: waistP.strap, k: 'line' as const }] : []),
    ...P.rivets.map((r) => ({ d: circleD(r.x, r.y, 1.8), k: 'line' as const })),
    ...(P.button ? [{ d: circleD(P.button.x, P.button.y, 3.6), k: 'line' as const }] : []),
    ...marks,
  ];
  const front: FlatView = {
    id: 'front',
    label: 'FRONT',
    outline: P.body,
    clip,
    shapes: frontShapes,
    over: hemOver,
    texts: g.texts.map((t) => ({ x: t.x, y: t.y, t: t.t, size: t.size })),
    cutY,
    box,
    anchors: fa,
  };

  // back: yoke, patch pockets, belt loops, center back seam
  const yoke = top + 30;
  const xs = scan(poly, yoke);
  const xL = xs.length ? xs[0] : wl.x - 6, xR = xs.length ? xs[xs.length - 1] : wr.x + 6;
  const yokeD = `M${f1(xL)},${f1(yoke)} L150,${f1(top + 46)} L${f1(xR)},${f1(yoke)}`;
  const seamD = `M150,${f1(top + 46)} L150,${f1(cr.y)}`;
  const pocket = (cx: number): string => {
    const y0 = top + 46;
    return `M${f1(cx - 18)},${f1(y0)} L${f1(cx + 18)},${f1(y0)} L${f1(cx + 18)},${f1(y0 + 30)} L${f1(cx)},${f1(y0 + 38)} L${f1(cx - 18)},${f1(y0 + 30)} Z`;
  };
  const pocketTop = (cx: number) => `M${f1(cx - 15)},${f1(top + 51)} L${f1(cx + 15)},${f1(top + 51)}`;
  const cxL = wl.x + (150 - wl.x) * 0.5, cxR = wr.x - (wr.x - 150) * 0.5;
  const backShapes: FlatShape[] = [
    { d: P.band, k: 'line', fill: true },
    { d: yokeD, k: 'seam' },
    { d: yokeD, k: 'stitch', t: [0, 2.6] },
    { d: seamD, k: 'seam' },
    { d: seamD, k: 'stitch', t: [2.4, 0] },
  ];
  const bAnch: FlatAnchor[] = [
    { key: 'band', label: 'Waistband', desc: WAIST_DESC[g.parts.waist] ?? WAIST_DESC.Regular, x: wl.x + 28, y: top - 6 },
    { key: 'yoke', label: 'Back yoke', desc: 'Pointed yoke seam, topstitched, center back seam', x: xL + 12, y: yoke + 1.5 },
  ];
  if (pk !== 'None') {
    backShapes.push(
      { d: pocket(cxL), k: 'line' },
      { d: pocket(cxR), k: 'line' },
      { d: pocketTop(cxL), k: 'stitch' },
      { d: pocketTop(cxR), k: 'stitch' },
    );
    bAnch.push({ key: 'bpocket', label: 'Back pockets', desc: 'Patch pockets, topstitched, bar tacked', x: cxR + 18, y: top + 46 + 17 });
  }
  if (g.parts.waist === 'Belt loops') {
    [0.1, 0.5, 0.9].forEach((t) => {
      const x = wl.x + (wr.x - wl.x) * t;
      backShapes.push({ d: `M${f1(x)},${f1(top - 16)} V${f1(top + 2)}`, k: 'line' });
    });
    bAnch.push({ key: 'loops', label: 'Belt loops', desc: '4 belt loops, bar tacked', x: wl.x + (wr.x - wl.x) * 0.9, y: top - 7 });
  }
  backShapes.push({ d: P.stitch, k: 'stitch' }, ...hemShapes(), ...cut);
  bAnch.push({ key: 'hem', label: cutY != null ? 'Cut hem' : 'Hem', desc: hemDesc, x: hs.mid.x, y: hs.mid.y });
  const back: FlatView = { id: 'back', label: 'BACK', outline: P.body, clip, shapes: backShapes, over: hemOver, texts: [], cutY, box, anchors: bAnch };
  return [front, back];
}

// ---------- skirts ----------

function skirtViews(g: Garment): FlatView[] {
  const pts = g.points;
  const poly = pts.map((p) => ({ x: p.x, y: p.y }));
  const wl = findPoint(pts, 'waistL'), wr = findPoint(pts, 'waistR');
  const hl = findPoint(pts, 'hemL'), hr = findPoint(pts, 'hemR');
  const hipY = findPoint(pts, 'hipL').y;
  const shape = g.skirt?.shape ?? 'A-line';
  const waist = g.parts.waist;
  const bh = bandHeight(waist);
  const P = garmentPaths(g, 0);
  const clip = P.body + ' ' + P.band;
  const hemMax = Math.max(hl.y, hr.y);
  const cutY = g.cropY != null && g.cropY < hemMax ? g.cropY : null;
  const effY = cutY ?? hemMax;
  const bx = bbox([...poly, { x: wl.x, y: wl.y - bh }, { x: wr.x, y: wl.y - bh }]);
  const box = { x0: bx.x0, y0: bx.y0, x1: bx.x1, y1: Math.min(bx.y1, effY + 4) };
  const waistAt = (u: number): V => ({ x: wl.x + (wr.x - wl.x) * u, y: wl.y + (wr.y - wl.y) * u });
  const hemAt = (u: number): V => ({ x: hl.x + (hr.x - hl.x) * u, y: hl.y + (hr.y - hl.y) * u });
  const cut: FlatShape[] = cutY != null ? [{ d: zig(hl.x - 10, hr.x + 10, cutY - 3, 3, 5), k: 'cut' }] : [];
  const hemStitch = `M${f1(hl.x - 30)},${f1(hl.y - 7)} L${f1(hr.x + 30)},${f1(hr.y - 7)}`;
  const hemDesc = cutY != null ? 'Cut hem, raw edge' : shape === 'Pleated' ? 'Hem, blind stitched, pleats pressed' : 'Hem, single needle topstitch';
  const hemMid = { x: 150, y: (hl.y + hr.y) / 2 - 7 };
  const bandDesc: Record<string, string> = {
    Regular: 'Waistband, 2 rows of topstitch',
    'Wide band': 'Wide waistband, 3 in, 2 rows of topstitch',
    'Belt loops': 'Waistband, 2 rows of topstitch, belt loops',
    Drawcord: 'Waistband with drawcord, 2 rows of topstitch',
  };
  const bandAnchor: FlatAnchor = { key: 'band', label: 'Waistband', desc: bandDesc[waist] ?? bandDesc.Regular, x: wl.x + 24, y: wl.y - bh / 2 };
  const dart = (u: number): string => {
    const a = waistAt(u), b = hemAt(u);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const L = Math.min(40, len * 0.3);
    return `M${f1(a.x - 3)},${f1(a.y)} L${f1(a.x + ((b.x - a.x) / len) * L)},${f1(a.y + ((b.y - a.y) / len) * L)} L${f1(a.x + 3)},${f1(a.y)}`;
  };
  const loop = (u: number): string => {
    const q = waistAt(u);
    return `M${f1(q.x)},${f1(q.y - bh - 2)} V${f1(q.y + 2)}`;
  };
  const marks: FlatShape[] = [];
  g.holes.forEach((h, i) => marks.push({ d: polyPath(ripPoly(g.id, i, h)), k: 'hole' }));
  g.distress.forEach((d) => marks.push({ d: ripPath(d), k: 'rip' }));
  const markAnchors: FlatAnchor[] = [];
  g.holes.forEach((h, i) => markAnchors.push({ key: `hole${i}`, label: `Hole ${i + 1}`, desc: `Ripped opening, size ${holeSize(h.r)}, exposed threads`, x: h.x, y: h.y }));
  g.distress.forEach((d, i) => markAnchors.push({ key: `rip${i}`, label: `Distress ${i + 1}`, desc: 'Worn and frayed area, hand sanded', x: d.x, y: d.y }));
  g.texts.forEach((t, i) => markAnchors.push({ key: `txt${i}`, label: `Print ${i + 1}`, desc: `Print "${t.t}", ${t.size} px type`, x: t.x, y: t.y }));

  // front
  const front: FlatShape[] = [
    { d: P.band, k: 'line', fill: true },
    { d: P.solid, k: 'line' },
    { d: P.details, k: shape === 'Pleated' || shape === 'Wrap' ? 'stitch' : 'seam' },
    { d: P.stitch, k: 'stitch' },
    { d: hemStitch, k: 'stitch' },
    ...(P.button ? [{ d: circleD(P.button.x, P.button.y, 3.2), k: 'line' as const }] : []),
    ...cut,
    ...marks,
  ];
  const fa: FlatAnchor[] = [bandAnchor];
  if (shape === 'Pleated') {
    const a = waistAt(0.5), b = hemAt(0.5);
    fa.push({ key: 'pleats', label: 'Knife pleats', desc: '13 knife pleats, stitched down to the hip, pressed below', x: a.x + (b.x - a.x) * 0.55 + 8, y: a.y + (b.y - a.y) * 0.55 });
  } else if (shape === 'Wrap') {
    const a = waistAt(0.8), b = hemAt(0.26);
    fa.push({ key: 'wrap', label: 'Wrap overlap', desc: 'Wraps left over right, 5 in overlap, edge topstitched', x: (a.x + b.x) / 2 + 6, y: (a.y + b.y) / 2 + 2 });
    if (P.button) fa.push({ key: 'button', label: 'Button', desc: 'Button closure at the waist, inner tie', x: P.button.x, y: P.button.y });
  } else {
    const a = waistAt(0.3);
    fa.push({ key: 'darts', label: 'Front darts', desc: 'Two waist darts, pressed toward the centre', x: a.x, y: a.y + 14 });
    if (shape === 'Pencil') {
      const c = waistAt(0.5), h = hemAt(0.5);
      fa.push({ key: 'cfseam', label: 'Centre front seam', desc: 'Seam down the centre front, topstitched', x: c.x, y: c.y + (h.y - c.y) * 0.55 });
    }
  }
  if (waist === 'Belt loops') fa.push({ key: 'loops', label: 'Belt loops', desc: '4 belt loops, bar tacked', x: waistAt(0.7).x, y: wl.y - bh - 2 });
  if (waist === 'Drawcord') fa.push({ key: 'cord', label: 'Drawcord', desc: 'Drawcord, finished with metal tips', x: waistAt(0.46).x - 3, y: wl.y + 16 });
  fa.push({ key: 'hem', label: cutY != null ? 'Cut hem' : 'Hem', desc: hemDesc, x: hemMid.x + 30, y: hemMid.y });
  fa.push(...markAnchors);
  const fv: FlatView = {
    id: 'front',
    label: 'FRONT',
    outline: P.body,
    clip,
    shapes: front,
    texts: g.texts.map((t) => ({ x: t.x, y: t.y, t: t.t, size: t.size })),
    cutY,
    box,
    anchors: fa,
  };

  // back
  const PB = garmentPaths({ ...g, parts: { ...g.parts, waist: waist === 'Drawcord' ? 'Regular' : waist } }, 0);
  const back: FlatShape[] = [{ d: PB.band, k: 'line', fill: true }, { d: P.stitch, k: 'stitch' }];
  const ba: FlatAnchor[] = [bandAnchor];
  const cbEnd = shape === 'Pencil' ? effY - 62 : shape === 'Wrap' ? hipY : hipY;
  if (shape === 'Pleated') {
    back.push({ d: PB.solid, k: 'line' }, { d: PB.details, k: 'stitch' });
    const a = waistAt(0.5), b = hemAt(0.5);
    ba.push({ key: 'pleats', label: 'Knife pleats', desc: '13 knife pleats, stitched down to the hip, pressed below', x: a.x + (b.x - a.x) * 0.55 + 8, y: a.y + (b.y - a.y) * 0.55 });
    back.push({ d: `M150,${f1(wl.y)} V${f1(hipY - 20)}`, k: 'seam' });
    ba.push({ key: 'czip', label: 'Centre back zip', desc: 'Invisible zip at the centre back, hook and eye', x: 150, y: wl.y + 22 });
  } else {
    back.push({ d: dart(0.3) + ' ' + dart(0.7), k: 'seam' });
    const a = waistAt(0.3);
    ba.push({ key: 'bdarts', label: 'Back darts', desc: 'Two waist darts, pressed toward the centre', x: a.x, y: a.y + 14 });
    back.push({ d: `M150,${f1(wl.y)} V${f1(cbEnd)}`, k: 'seam' }, { d: `M152.6,${f1(wl.y)} V${f1(shape === 'Wrap' ? hipY : hipY)}`, k: 'stitch' });
    if (shape === 'Wrap') ba.push({ key: 'cbseam', label: 'Centre back seam', desc: 'Plain seam, no zip, closes at the front', x: 150, y: wl.y + 40 });
    else ba.push({ key: 'czip', label: 'Centre back zip', desc: 'Invisible zip at the centre back, hook and eye', x: 150, y: wl.y + 22 });
    if (waist === 'Belt loops') [0.1, 0.3, 0.7, 0.9].forEach((u) => back.push({ d: loop(u), k: 'line' }));
    if (shape === 'Pencil') {
      back.push({ d: `M150,${f1(effY)} V${f1(effY - 62)} L156,${f1(effY - 62)} V${f1(effY)}`, k: 'line' });
      ba.push({ key: 'vent', label: 'Back vent', desc: 'Vent, 6.5 in, overlapped and topstitched at the top', x: 156, y: effY - 40 });
    }
  }
  if (waist === 'Belt loops') ba.push({ key: 'loops', label: 'Belt loops', desc: '4 belt loops, bar tacked', x: waistAt(0.7).x, y: wl.y - bh - 2 });
  back.push({ d: hemStitch, k: 'stitch' }, ...cut);
  ba.push({ key: 'hem', label: cutY != null ? 'Cut hem' : 'Hem', desc: hemDesc, x: hemMid.x + 30, y: hemMid.y });
  const bv: FlatView = { id: 'back', label: 'BACK', outline: P.body, clip, shapes: back, texts: [], cutY, box, anchors: ba };
  return [fv, bv];
}

// ---------- tops ----------

const SY = 1.3;
const SLEEVE_UNIT = 150;
const ARM_HALF = 24;

function topViews(g: Garment): FlatView[] {
  const o = g.top!;
  const pts = g.points;
  const hasKey = (k: string) => pts.some((p) => p.key === k);
  const strapped = hasKey('strapL');
  const sleeved = hasKey('shL');
  const bare = !strapped && !sleeved;
  const theta = ((sleeveOf(o) > 1 ? 34 : 55) * Math.PI) / 180;
  const torso = (p: Pt): V => ({ x: p.x, y: 100 + (p.y - 100) * SY });
  const T = (u: number, v: number): V => ({ x: 150 + u * 100, y: 100 + v * 200 * SY });
  const dirOf = (K: 'L' | 'R'): V => ({ x: K === 'L' ? -Math.sin(theta) : Math.sin(theta), y: Math.cos(theta) });
  const F = (p: Pt): V => {
    if (!p.r) return torso(p);
    const K = p.r === 'armL' ? 'L' : 'R';
    const sh = pts.find((q) => q.key === 'sh' + K);
    const o0 = sh ? torso(sh) : { x: 150, y: 100 };
    const { x: ux, y: uy } = dirOf(K);
    const nx = uy, ny = -ux;
    const a = p.x / 100, off = ((p.y - 100) / 100) * ARM_HALF * (K === 'L' ? 1 : -1);
    return { x: o0.x + ux * a * SLEEVE_UNIT + nx * off, y: o0.y + uy * a * SLEEVE_UNIT + ny * off };
  };
  const idx = (k: string) => pts.findIndex((p) => p.key === k);
  const iNF = idx('neckF'), iNL = idx('neckL'), iNR = idx('neckR');
  const fp = pts.map(F);
  const nL = fp[iNL], nR = fp[iNR];
  const depthF = fp[iNF].y - nL.y;
  const at = (k: string) => fp[idx(k)];
  const isDress = o.block === 'Dress';
  const hemV = uv(pts[idx('hemL')]).v;

  const build = (back: boolean): FlatView => {
    const nf: V = back ? { x: 150, y: nL.y + (strapped ? depthF * 0.55 : bare ? depthF * 0.4 : Math.min(depthF * 0.3, 10)) } : fp[iNF];
    const ctrl: V = { x: 2 * nf.x - (nL.x + nR.x) / 2, y: 2 * nf.y - (nL.y + nR.y) / 2 };
    const vNeck = !back && (o.block === 'Moto jacket' || (!isDress && o.neck === 'V') || (isDress && o.neck === 'V' && !bare));
    const neckOpen = vNeck ? `M${M(nR)} L${M(nf)} L${M(nL)}` : `M${M(nR)} Q${M(ctrl)} ${M(nL)}`;
    const isPair = (a: Pt, b: Pt) => (/^strap/.test(a.key ?? '') && /^arm/.test(b.key ?? '')) || (/^arm/.test(a.key ?? '') && /^strap/.test(b.key ?? ''));
    let d = 'M' + M(fp[0]);
    let prev = 0;
    for (let i = 1; i < pts.length; i++) {
      if (i === iNF) continue;
      if (strapped && isPair(pts[prev], pts[i])) {
        const m = mid(fp[prev], fp[i]);
        d += ` Q${M({ x: m.x + Math.sign(150 - m.x) * 16, y: m.y })} ${M(fp[i])}`;
      } else d += ' L' + M(fp[i]);
      prev = i;
    }
    d += vNeck ? ` L${M(nf)} Z` : ` Q${M(ctrl)} ${M(fp[0])} Z`;

    const poly = fp.filter((_, i) => i !== iNF);
    const hemL = at('hemL'), hemR = at('hemR');
    const hemY = (hemL.y + hemR.y) / 2;
    const xs = scan(poly, hemY - 7);
    let x0 = hemL.x, x1 = hemR.x;
    for (let i = 0; i + 1 < xs.length; i++) if (xs[i] < 150 && xs[i + 1] > 150) { x0 = xs[i]; x1 = xs[i + 1]; }
    const hemD = `M${f1(x0 + 2)},${f1(hemY - 7)} L${f1(x1 - 2)},${f1(hemY - 7)}`;
    const neckAt = (t: number): V => quadPt(nR, ctrl, nL, t);

    const parts = blockParts({ g, o, back, T, at, hemV, hemY, dir: dirOf, neck: neckAt });
    const shapes: FlatShape[] = [
      { d: neckOpen, k: 'seam', t: [0, 5] },
      { d: neckOpen, k: 'stitch', t: [0, 2.5] },
    ];
    if (!parts?.noHemStitch) shapes.push({ d: hemD, k: 'stitch' });
    const anchors: FlatAnchor[] = [];
    const nA = vNeck ? mid(mid(nR, nf), nR) : neckAt(0.28);
    anchors.push({
      key: 'neck',
      label: strapped ? 'Neck binding' : 'Neck',
      desc: strapped ? `${back ? 'Back' : o.neck} neck, self binding, topstitched` : `${back ? 'Back neck' : o.neck + ' neck'}, rib binding, topstitched`,
      x: nA.x,
      y: nA.y + 4,
    });
    if (strapped) {
      for (const K of ['L', 'R'] as const) {
        const s = at('strap' + K), a = at('arm' + K);
        const m = mid(s, a), dir = Math.sign(150 - m.x);
        const c = { x: m.x + dir * 16, y: m.y };
        const sd = `M${M(s)} Q${M(c)} ${M(a)}`;
        shapes.push({ d: sd, k: 'stitch', t: [dir * 3.5, 0] });
        if (K === 'L') {
          const p = quadPt(s, c, a, 0.5);
          anchors.push({ key: 'armhole', label: 'Armhole binding', desc: 'Self binding, topstitched', x: p.x + 3, y: p.y });
        }
      }
    } else if (sleeved) {
      for (const K of ['L', 'R'] as const) {
        const s = at('sh' + K), a = at('arm' + K);
        const m = mid(s, a), dir = Math.sign(150 - m.x);
        const c = { x: m.x + dir * 12, y: m.y };
        shapes.push({ d: `M${M(s)} Q${M(c)} ${M(a)}`, k: 'seam' });
        const so = at('slO' + K), si = at('sl' + 'I' + K);
        const { x: ux, y: uy } = dirOf(K);
        const hs = (p: V) => ({ x: p.x - ux * 7, y: p.y - uy * 7 });
        const a1 = hs(so), a2 = hs(si);
        if (!parts?.noSleeveStitch) shapes.push({ d: `M${M(a1)} L${M(a2)}`, k: 'stitch' });
        if (K === 'L') {
          const p = quadPt(s, c, a, 0.5);
          anchors.push({ key: 'armhole', label: 'Armhole seam', desc: 'Set-in sleeve, overlocked seam', x: p.x, y: p.y });
          const hm = mid(a1, a2);
          anchors.push({ key: 'sleeve', label: 'Sleeve hem', desc: 'Sleeve hem, single needle topstitch', x: hm.x, y: hm.y });
        }
      }
    }
    anchors.push({ key: 'hem', label: 'Body hem', desc: 'Body hem, single needle topstitch', x: 150 + 55, y: hemY - 7 });

    const texts: FlatText[] = [];
    if (!back) {
      g.holes.forEach((h, i) => {
        const c = torso({ x: h.x, y: h.y } as Pt);
        const hh = { x: c.x, y: c.y, r: h.r * 1.1 };
        shapes.push({ d: polyPath(ripPoly(g.id, i, hh)), k: 'hole' });
        anchors.push({ key: `hole${i}`, label: `Hole ${i + 1}`, desc: `Ripped opening, size ${holeSize(h.r)}, exposed threads`, x: c.x, y: c.y });
      });
      g.distress.forEach((r, i) => {
        const c = torso({ x: r.x, y: r.y } as Pt);
        shapes.push({ d: ripPath({ x: c.x, y: c.y }), k: 'rip' });
        anchors.push({ key: `rip${i}`, label: `Distress ${i + 1}`, desc: 'Worn and frayed area, hand sanded', x: c.x, y: c.y });
      });
      g.texts.forEach((t, i) => {
        const c = torso({ x: t.x, y: t.y } as Pt);
        texts.push({ x: c.x, y: c.y, t: t.t, size: t.size * 0.8 });
        anchors.push({ key: `txt${i}`, label: `Print ${i + 1}`, desc: `Print "${t.t}", ${t.size} px type`, x: c.x, y: c.y });
      });
    }
    let finalAnchors = anchors;
    let behind: FlatShape[] | undefined, over: FlatShape[] | undefined;
    const extent: V[] = [...poly, nf];
    if (parts) {
      shapes.push(...parts.shapes);
      behind = parts.behind;
      over = parts.over;
      extent.push(...parts.extent);
      finalAnchors = anchors.filter((a) => !parts.drop.includes(a.key)).map((a) => (parts.rename[a.key] ? { ...a, ...parts.rename[a.key] } : a));
      // block details go after the neck and armhole, before prints and holes
      const at0 = finalAnchors.findIndex((a) => /^(hole|rip|txt)/.test(a.key));
      finalAnchors.splice(at0 < 0 ? finalAnchors.length : at0, 0, ...parts.anchors);
    }
    const b = bbox(extent);
    return {
      id: back ? 'back' : 'front',
      label: back ? 'BACK' : 'FRONT',
      outline: d,
      clip: d,
      shapes,
      behind,
      over,
      texts,
      cutY: null,
      box: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 },
      anchors: finalAnchors,
    };
  };
  return [build(false), build(true)];
}

// ---------- sheet layout ----------

const PAD = 64;
const TOP = 22;
const LABEL = 36;
const GAP = 27;

function layout(views: FlatView[], keyN: Map<string, number>): FlatModel['sheet'] {
  let cursor = PAD;
  const placed: PlacedView[] = [];
  let maxH = 0;
  for (const v of views) {
    const bw = v.box.x1 - v.box.x0, bh = v.box.y1 - v.box.y0;
    const ox = cursor - v.box.x0, oy = TOP - v.box.y0;
    placed.push({ view: v, ox, oy, x0: cursor, x1: cursor + bw, y1: TOP + bh });
    cursor += bw + 2 * PAD;
    maxH = Math.max(maxH, bh);
  }
  const w = cursor - PAD;
  const h = TOP + maxH + LABEL;
  const callouts: PlacedCallout[] = [];
  for (const pv of placed) {
    const cxMid = (pv.x0 + pv.x1) / 2;
    const sides: Record<'L' | 'R', { n: number; ax: number; ay: number }[]> = { L: [], R: [] };
    for (const a of pv.view.anchors) {
      const n = keyN.get(a.key);
      if (!n) continue;
      const ax = a.x + pv.ox, ay = a.y + pv.oy;
      sides[ax < cxMid ? 'L' : 'R'].push({ n, ax, ay });
    }
    for (const s of ['L', 'R'] as const) {
      const list = sides[s].sort((p, q) => p.ay - q.ay);
      let last = -Infinity;
      for (const it of list) {
        const cy = Math.max(it.ay, last + GAP);
        last = cy;
        callouts.push({ n: it.n, cx: s === 'L' ? pv.x0 - 34 : pv.x1 + 34, cy, ax: it.ax, ay: it.ay });
      }
    }
  }
  return { w, h: Math.max(h, ...callouts.map((c) => c.cy + 20)), views: placed, callouts };
}

// ---------- build ----------

const half = (n: number) => (Math.round(n * 2) / 2).toString();

/** Dress spec: bust, waist, hip, length, hem sweep and shoulder or sleeve where there is one. */
function dressSpec(g: Garment, torso: TorsoProfile): SpecRow[] {
  const o = g.top!;
  const at = (k: string) => g.points.find((p) => p.key === k);
  const wide = (a?: Pt, b?: Pt) => (a && b ? uv(b).u - uv(a).u : 0);
  const c = torso.inches.chest;
  const rows: SpecRow[] = [];
  const bust = wide(at('armL'), at('armR'));
  if (bust) rows.push({ k: 'Bust', v: `${half((c * bust) / 2)} in` });
  const waist = wide(at('sideL'), at('sideR'));
  if (waist) rows.push({ k: 'Waist', v: `${half((c * 0.82 * waist) / 2)} in` });
  const hip = wide(at('sk1L'), at('sk1R'));
  if (hip) rows.push({ k: 'Hip', v: `${half((c * 1.05 * hip) / 2)} in` });
  const hem = wide(at('hemL'), at('hemR'));
  if (hem) rows.push({ k: 'Hem sweep', v: `${half((c * 1.05 * hem) / 2)} in` });
  const hv = dressHemV(o);
  rows.push({ k: 'Length', v: `${half(torso.inches.torso + 7 + ((hv - 1.5) / 1.1) * 30 + 2)} in` });
  const sh = at('shL') ?? at('strapL'), sr = at('shR') ?? at('strapR');
  if (sh && sr) rows.push({ k: 'Shoulder', v: `${half((torso.inches.shoulder * wide(sh, sr)) / 2)} in` });
  const slO = at('slOL');
  if (slO) rows.push({ k: 'Sleeve', v: `${half((slO.x / 100) * (torso.inches.arm / 2))} in` });
  return rows;
}

export function buildFlat(g: Garment, torso: TorsoProfile): FlatModel {
  const isTop = g.type === 'top' && !!g.top;
  const views = isTop ? topViews(g) : g.type === 'skirt' ? skirtViews(g) : jeansViews(g);
  const keyN = new Map<string, number>();
  const legend: LegendRow[] = [];
  for (const v of views)
    for (const a of v.anchors)
      if (!keyN.has(a.key)) {
        keyN.set(a.key, legend.length + 1);
        legend.push({ n: legend.length + 1, label: a.label, desc: a.desc });
      }
  const o = g.top;
  let spec: SpecRow[] = isTop ? (o?.block === 'Dress' ? dressSpec(g, torso) : computeTopSpec(g.points, torso)) : computeSpec(g);
  const materials: FlatModel['materials'] = [
    { k: 'Fabric', v: g.fabric },
    { k: 'Wash', v: g.wash, swatch: WASHES[g.wash] },
  ];
  const notes: string[] = ['Dashed lines are topstitching. Solid inner lines are seams.'];
  if (isTop && o) {
    materials.push({ k: 'Block', v: o.block }, { k: 'Fit', v: o.fit });
    if (o.block === 'Dress') {
      materials.push({ k: 'Silhouette', v: silhouetteOf(o) }, { k: 'Length', v: dressLenOf(o) }, { k: 'Top', v: dressTopOf(o) });
      if (silhouetteOf(o) === 'Slip') notes.push('Slip silhouette is cut on the bias, so it drapes close to the body.');
      if (silhouetteOf(o) === 'A-line') notes.push('A-line skirt is joined at the waist seam and flares to the hem.');
    } else {
      materials.push({ k: 'Length', v: o.length });
      if (o.block === 'Hoodie') materials.push({ k: 'Trim', v: '2x2 rib' });
      else if (o.block === 'Moto jacket') materials.push({ k: 'Hardware', v: 'Metal zips, snaps, buckle' });
      else materials.push({ k: 'Neck', v: o.neck });
    }
    if (o.block === 'Hoodie') notes.push('Rib trim is 2x2 rib in the body fabric colour.');
    if (o.block === 'Moto jacket') notes.push('Front zip runs on a slant from the chest to the left hip.');
  } else if (g.type === 'skirt' && g.skirt) {
    spec = [...spec];
    spec.splice(4, 0, { k: 'Waistband', v: `${half(bandHeight(g.parts.waist) / PX_IN_V)} in` });
    if (g.skirt.shape === 'Pleated') spec.splice(5, 0, { k: 'Pleats', v: '13' });
    materials.push({ k: 'Block', v: `${g.skirt.shape} skirt` }, { k: 'Length', v: `${g.skirt.length}, ${half(g.skirt.len)} in` }, { k: 'Waistband', v: g.parts.waist });
    if (g.skirt.shape === 'Wrap') notes.push('Wraps left over right. The overlap is shown on the front.');
    if (g.skirt.shape === 'Pencil') notes.push('Back vent is overlapped, with a topstitched bar at the top.');
    if (g.cropY != null) notes.push('Cropped: skirt is cut at the line shown, raw edge.');
  } else if (g.type === 'shorts') {
    const hemY = Math.max(findPoint(g.points, 'hemLo').y, findPoint(g.points, 'hemLi').y);
    spec = [...spec];
    spec.splice(4, 0, { k: 'Outseam', v: `${half(Math.max(0, Math.min(g.cropY ?? Infinity, hemY) - bandTop(g.points)) / PX_IN_V)} in` });
    materials.push({ k: 'Block', v: `${g.shorts?.length ?? 'Short'} shorts` }, { k: 'Fit', v: `${g.fit}, ${g.rise} rise` }, { k: 'Waistband', v: g.parts.waist }, { k: 'Front pockets', v: g.parts.pocket }, { k: 'Hem', v: g.parts.hem ?? 'Clean' });
    if (g.cropY != null) notes.push('Cropped: leg is cut at the line shown, raw edge.');
  } else {
    materials.push({ k: 'Block', v: 'Five pocket' }, { k: 'Fit', v: `${g.fit}, ${g.rise} rise` }, { k: 'Waistband', v: g.parts.waist }, { k: 'Front pockets', v: g.parts.pocket });
    if (g.cropY != null) notes.push('Cropped: leg is cut at the line shown, raw edge.');
  }
  if (g.holes.length) notes.push(`${g.holes.length} ripped ${g.holes.length === 1 ? 'opening' : 'openings'}, placement as drawn on the front.`);
  if (g.distress.length) notes.push(`${g.distress.length} distressed ${g.distress.length === 1 ? 'area' : 'areas'}, hand sanded.`);
  return { g, views, legend, spec, materials, notes, sheet: layout(views, keyN) };
}

// ---------- svg output ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const INK = '#111111';

const STYLE: Record<ShapeKind, string> = {
  line: `fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`,
  seam: `fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round"`,
  stitch: `fill="none" stroke="${INK}" stroke-width="0.8" stroke-dasharray="3 2"`,
  hole: `fill="#ffffff" stroke="${INK}" stroke-width="1" stroke-linejoin="round"`,
  rip: `fill="none" stroke="${INK}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"`,
  cut: `fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"`,
  rib: `fill="none" stroke="${INK}" stroke-width="0.55"`,
  edge: `fill="none" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`,
};
const shapeSvg = (sh: FlatShape) =>
  `<path d="${sh.d}" ${STYLE[sh.k]}${sh.fill ? ' fill="#ffffff"' : ''}${sh.t ? ` transform="translate(${sh.t[0]} ${sh.t[1]})"` : ''}/>`;

/** The flat sheet as svg markup, without the outer svg element. Sheet space, white background. */
export function flatSheetBody(m: FlatModel, font = "'IBM Plex Mono', Helvetica, Arial, sans-serif"): string {
  const { sheet } = m;
  const uid = m.g.id.replace(/[^\w-]/g, '');
  let s = `<rect x="0" y="0" width="${f1(sheet.w)}" height="${f1(sheet.h)}" fill="#ffffff"/>`;
  sheet.views.forEach((pv, i) => {
    const v = pv.view;
    const cid = `fc-${uid}-${i}`, kid = `fk-${uid}-${i}`;
    s += `<g transform="translate(${f1(pv.ox)} ${f1(pv.oy)})">`;
    s += `<defs><clipPath id="${cid}"><path d="${v.clip}"/></clipPath>`;
    if (v.cutY != null) s += `<clipPath id="${kid}"><rect x="-200" y="-200" width="900" height="${f1(v.cutY + 200)}"/></clipPath>`;
    s += `</defs>`;
    s += `<g${v.cutY != null ? ` clip-path="url(#${kid})"` : ''}>`;
    for (const sh of v.behind ?? []) s += shapeSvg(sh);
    s += `<path d="${v.outline}" fill="#ffffff" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
    s += `<g clip-path="url(#${cid})">`;
    for (const sh of v.shapes) s += shapeSvg(sh);
    s += `</g>`;
    for (const sh of v.over ?? []) s += shapeSvg(sh);
    for (const t of v.texts) {
      s += `<text x="${f1(t.x)}" y="${f1(t.y)}" text-anchor="middle" font-family="'Archivo Black', Helvetica, Arial, sans-serif" font-size="${f1(t.size)}" fill="${INK}">${esc(t.t)}</text>`;
    }
    s += `</g>`;
    // the cut edge sits on the crop line, so draw it outside the crop clip
    s += `</g>`;
    s += `<text x="${f1((pv.x0 + pv.x1) / 2)}" y="${f1(pv.y1 + 26)}" text-anchor="middle" font-family="${font}" font-size="11" letter-spacing="2" fill="${INK}">${v.label}</text>`;
  });
  for (const c of sheet.callouts) {
    const dx = c.ax - c.cx, dy = c.ay - c.cy, L = Math.hypot(dx, dy) || 1;
    const sx = c.cx + (dx / L) * 10, sy = c.cy + (dy / L) * 10;
    s += `<path d="M${f1(sx)},${f1(sy)} L${f1(c.ax)},${f1(c.ay)}" fill="none" stroke="${INK}" stroke-width="0.7"/>`;
    s += `<circle cx="${f1(c.ax)}" cy="${f1(c.ay)}" r="1.8" fill="${INK}"/>`;
    s += `<circle cx="${f1(c.cx)}" cy="${f1(c.cy)}" r="10" fill="#ffffff" stroke="${INK}" stroke-width="1"/>`;
    s += `<text x="${f1(c.cx)}" y="${f1(c.cy + 3.8)}" text-anchor="middle" font-family="${font}" font-size="11" font-weight="bold" fill="${INK}">${c.n}</text>`;
  }
  return s;
}

export function flatSheetSvg(m: FlatModel, font?: string): string {
  const { w, h } = m.sheet;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(w)} ${f1(h)}" width="${f1(w)}" height="${f1(h)}">${flatSheetBody(m, font)}</svg>`;
}

/** Every garment's flat stacked in one svg file, each with its name above. */
export function flatsFileSvg(models: FlatModel[]): string {
  const W = Math.max(...models.map((m) => m.sheet.w));
  let y = 0;
  let body = '';
  for (const m of models) {
    body += `<text x="24" y="${y + 30}" font-family="'IBM Plex Mono', Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="${INK}">${esc(m.g.name.toUpperCase())}</text>`;
    body += `<g transform="translate(${f1((W - m.sheet.w) / 2)} ${y + 44})">${flatSheetBody(m)}</g>`;
    y += m.sheet.h + 60;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(y)}" width="${f1(W)}" height="${f1(y)}"><rect width="${f1(W)}" height="${f1(y)}" fill="#ffffff"/>${body}</svg>`;
}

export const noteLines = (notes: Note[]) => notes.map((n) => n.text).filter(Boolean);
