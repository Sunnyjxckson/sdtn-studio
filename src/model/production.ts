// Production data on top of the sketch: graphics and prints, colorways, trims, construction and the bill of materials.
// Every field is optional on the document and the garment, so older saves load as they were.

import type { Garment, GarmentType } from './garment';
import { WASHES } from './garment';
import { uv } from './top';
import type { TorsoProfile } from './figure';

// ---------- graphics ----------

export type PrintMethod = 'Screen print' | 'Embroidery' | 'DTG' | 'Patch' | 'Puff print';
export const PRINT_METHODS: PrintMethod[] = ['Screen print', 'Embroidery', 'DTG', 'Patch', 'Puff print'];

export interface Graphic {
  id: string;
  name: string;
  /** PNG, JPG or SVG as a data URL. */
  src: string;
  /** Height over width of the artwork. */
  aspect: number;
  side: 'front' | 'back';
  /** Centre, in garment space (the same space as text). */
  x: number;
  y: number;
  /** Width in garment space. */
  w: number;
  /** Degrees. */
  rot: number;
  method: PrintMethod;
}

export interface AllOver {
  name: string;
  src: string;
  aspect: number;
  /** Tile width in garment space. */
  scale: number;
  rot: number;
}

const MAX_ART = 1200;

/** Size of an svg file from its width, height or viewBox, or null. */
function svgSize(text: string): { w: number; h: number } | null {
  try {
    const el = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    const num = (v: string | null) => (v && /^[\d.]+(px)?$/.test(v.trim()) ? parseFloat(v) : 0);
    const w = num(el.getAttribute('width')), h = num(el.getAttribute('height'));
    if (w && h) return { w, h };
    const vb = (el.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
  } catch {
    // fall through to the image's own size
  }
  return null;
}

/**
 * Read a PNG, JPG or SVG into a data URL and measure it. SVG and very large images are drawn
 * down to a PNG or JPG of at most 1200 px, so the document and the PDF stay small and every
 * renderer can draw them.
 */
export async function readArtwork(file: File): Promise<{ name: string; src: string; aspect: number }> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  const url = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read the file'));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
  const sz = isSvg ? svgSize(await file.text()) : null;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onerror = () => reject(new Error('Could not open the image'));
    im.onload = () => resolve(im);
    im.src = url;
  });
  const w = sz?.w || img.naturalWidth || 300, h = sz?.h || img.naturalHeight || 300;
  const name = file.name.replace(/\.[^.]+$/, '') || 'Artwork';
  if (!isSvg && Math.max(w, h) <= MAX_ART) return { name, src: url, aspect: h / w };
  const k = isSvg ? 1024 / Math.max(w, h) : MAX_ART / Math.max(w, h);
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d');
  if (!ctx) return { name, src: url, aspect: h / w };
  const jpeg = /jpe?g/i.test(file.type);
  if (jpeg) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.drawImage(img, 0, 0, cw, ch);
  return { name, src: jpeg ? cv.toDataURL('image/jpeg', 0.9) : cv.toDataURL('image/png'), aspect: ch / cw };
}

/** Scale between garment space and the drawn size on tops (text uses the same 0.8). */
export const TOP_GFX = 0.8;

export interface GraphicMeasure {
  /** Inches from the centre front (or centre back) line to the centre of the artwork. */
  fromCenter: number;
  /** Inches down from the high point shoulder (tops) or from the top of the waistband (bottoms). */
  fromRef: number;
  refName: string;
  w: number;
  h: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Placement in inches. Width comes from the horizontal scale, height follows the artwork's proportions. */
export function measureGraphic(g: Garment, gr: Graphic, torso: TorsoProfile, bandTopY: number): GraphicMeasure {
  if (g.type === 'top') {
    const pxIn = 100 / (torso.inches.chest / 2);
    const neck = g.points.find((p) => p.key === 'neckL' || p.key === 'neckR');
    const nv = neck ? uv(neck).v : 0;
    const w = (gr.w * TOP_GFX) / pxIn;
    return {
      fromCenter: r1(Math.abs(gr.x - 150) / pxIn),
      fromRef: r1(Math.max(0, ((uv({ x: 0, y: gr.y }).v - nv) * torso.inches.torso))),
      refName: 'HPS',
      w: r1(w),
      h: r1(w * gr.aspect),
    };
  }
  if (g.type === 'shoes') {
    const wIn = (gr.w * 1.2) / 20;
    return { fromCenter: r1(Math.abs(gr.x - 150) * 0.06), fromRef: r1(Math.max(0.5, 1.2 + (150 - gr.y) * 0.06)), refName: 'sole', w: r1(wIn), h: r1(wIn * gr.aspect) };
  }
  const wIn = gr.w / 4.6;
  return {
    fromCenter: r1(Math.abs(gr.x - 150) / 4.6),
    fromRef: r1(Math.max(0, (gr.y - bandTopY) / 9.4)),
    refName: 'top of waistband',
    w: r1(wIn),
    h: r1(wIn * gr.aspect),
  };
}

export function newGraphic(art: { name: string; src: string; aspect: number }, g: Garment, side: 'front' | 'back'): Graphic {
  const top = g.type === 'top';
  // bottoms: on the thigh, not on the crotch seam where the legs split
  let px = 150, py = 150;
  if (g.type === 'jeans' || g.type === 'shorts') {
    const at = (k: string) => g.points.find((p) => p.key === k);
    const wl = at('waistL'), cr = at('crotch'), hl = at('hipL');
    if (wl && cr) {
      py = Math.round(wl.y + (cr.y - wl.y) * 0.45);
      px = Math.round(hl ? (hl.x + cr.x) / 2 + 4 : 118);
    }
  }
  return {
    id: uid(),
    name: art.name,
    src: art.src,
    aspect: art.aspect,
    side,
    x: px,
    y: top ? 195 : g.type === 'skirt' ? 250 : py,
    w: top ? 44 : g.type === 'shoes' ? 24 : 50,
    rot: 0,
    method: 'Screen print',
  };
}

// ---------- colors and colorways ----------

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
  /** Pantone TCX code, free text, e.g. 19-4052 TCX. */
  pantone?: string;
}
export interface SavedPalette {
  id: string;
  name: string;
  colors: PaletteColor[];
}
export interface ColorChoice {
  name: string;
  hex: string;
  pantone?: string;
}
export interface Colorway {
  id: string;
  name: string;
  /** Color of every garment in this colorway, by garment id. */
  colors: Record<string, ColorChoice>;
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** What a garment is colored: its own custom color, else its wash. */
export function garmentColor(g: Pick<Garment, 'wash' | 'colorHex' | 'colorName' | 'pantone'>): ColorChoice {
  if (g.colorHex) return { name: g.colorName || g.colorHex.toUpperCase(), hex: g.colorHex, pantone: g.pantone };
  return { name: g.wash, hex: WASHES[g.wash] };
}
export const garmentHex = (g: Pick<Garment, 'wash' | 'colorHex'>): string => g.colorHex ?? WASHES[g.wash];

export function isDarkHex(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), gg = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * gg + 0.114 * b < 150;
}

export const DEFAULT_PALETTE: PaletteColor[] = [
  { id: 'p-black', name: 'Jet black', hex: '#141414', pantone: '19-0303 TCX' },
  { id: 'p-bone', name: 'Bone', hex: '#E6DFD0', pantone: '11-0602 TCX' },
  { id: 'p-red', name: 'Sedition red', hex: '#C8102E', pantone: '19-1664 TCX' },
  { id: 'p-navy', name: 'Deep navy', hex: '#1F2A44', pantone: '19-3921 TCX' },
];

// ---------- trims and hardware ----------

export type TrimKind = 'Zipper' | 'Button' | 'Snap' | 'Rivet' | 'Drawcord' | 'Main label' | 'Care label' | 'Size label' | 'Hang tag';
export const TRIM_KINDS: TrimKind[] = ['Zipper', 'Button', 'Snap', 'Rivet', 'Drawcord', 'Main label', 'Care label', 'Size label', 'Hang tag'];

export interface Trim {
  id: string;
  kind: TrimKind;
  /** Type or material, from the choices for the kind. */
  type: string;
  /** Zipper and drawcord: length in inches. Button and snap: size in ligne. */
  size: number;
  color: string;
  qty: number;
  /** Cost per piece, for the bill of materials. */
  cost?: number;
}

export const TRIM_TYPES: Record<TrimKind, string[]> = {
  Zipper: ['Metal, closed end', 'Metal, open end', 'Coil', 'Invisible', 'Two way'],
  Button: ['Shank', 'Sew through', 'Jeans tack button'],
  Snap: ['Ring snap', 'Prong snap', 'Cap snap'],
  Rivet: ['Copper', 'Antique brass', 'Nickel', 'Black'],
  Drawcord: ['Round cord', 'Flat cord', 'Cord with metal tips'],
  'Main label': ['Woven', 'Printed', 'Leather patch'],
  'Care label': ['Printed satin', 'Woven', 'Heat transfer'],
  'Size label': ['Printed satin', 'Woven', 'Heat transfer'],
  'Hang tag': ['Card', 'Card with string', 'Recycled kraft'],
};
/** Which kinds take a size, and what it measures. */
export const TRIM_SIZE: Partial<Record<TrimKind, { label: string; unit: string; def: number; min: number; max: number; step: number }>> = {
  Zipper: { label: 'Length', unit: 'in', def: 7, min: 2, max: 36, step: 0.5 },
  Button: { label: 'Size', unit: 'ligne', def: 24, min: 12, max: 60, step: 2 },
  Snap: { label: 'Size', unit: 'ligne', def: 16, min: 10, max: 30, step: 2 },
  Drawcord: { label: 'Length', unit: 'in', def: 48, min: 12, max: 90, step: 1 },
};
const TRIM_QTY: Record<TrimKind, number> = { Zipper: 1, Button: 1, Snap: 4, Rivet: 5, Drawcord: 1, 'Main label': 1, 'Care label': 1, 'Size label': 1, 'Hang tag': 1 };

export function newTrim(kind: TrimKind): Trim {
  const sz = TRIM_SIZE[kind];
  return { id: uid(), kind, type: TRIM_TYPES[kind][0], size: sz ? sz.def : 0, color: kind.endsWith('label') || kind === 'Hang tag' ? 'Black on white' : 'Antique brass', qty: TRIM_QTY[kind] };
}

export function trimDesc(t: Trim): string {
  const sz = TRIM_SIZE[t.kind];
  const s = sz ? `, ${t.size} ${sz.unit}` : '';
  return `${t.type}${s}, ${t.color}`;
}

// ---------- construction ----------

export type StitchType = '301' | '401' | '504' | '406';
export const STITCHES: { id: StitchType; name: string }[] = [
  { id: '301', name: 'Lockstitch' },
  { id: '401', name: 'Chainstitch' },
  { id: '504', name: 'Overlock' },
  { id: '406', name: 'Coverstitch' },
];
export const SEAM_FINISHES = ['Plain, pressed open', 'Overlocked', 'Flat felled', 'Bound', 'French seam', 'Topstitched'] as const;
export interface Construction {
  stitch: StitchType;
  spi: number;
  seam: string;
  /** Thread colors for the bill of materials. */
  threadMain?: string;
  threadTop?: string;
}
export const stitchName = (s: StitchType) => `${s} ${STITCHES.find((x) => x.id === s)?.name.toLowerCase() ?? ''}`.trim();

export function defaultConstruction(type: GarmentType): Construction {
  if (type === 'jeans' || type === 'shorts') return { stitch: '401', spi: 8, seam: 'Flat felled' };
  if (type === 'shoes') return { stitch: '301', spi: 10, seam: 'Topstitched' };
  if (type === 'skirt') return { stitch: '301', spi: 12, seam: 'Overlocked' };
  return { stitch: '504', spi: 12, seam: 'Overlocked' };
}
export const constructionOf = (g: Garment): Construction => ({ ...defaultConstruction(g.type), ...g.construction });

// ---------- fabric and bill of materials ----------

export interface FabricInfo {
  content: string;
  /** Weight, e.g. 14 oz or 180 gsm. */
  weight: string;
  /** Yards per unit. */
  yards: number;
  /** Cost per yard. */
  cost?: number;
}
export function defaultFabricInfo(g: Garment): FabricInfo {
  switch (g.fabric) {
    case 'Denim': return { content: '100% cotton', weight: '14 oz', yards: g.type === 'jeans' ? 1.8 : g.type === 'top' ? 1.9 : 1 };
    case 'Leather': return g.type === 'shoes' ? { content: 'Calf leather', weight: '1.2 mm', yards: 0.4 } : { content: 'Lambskin leather', weight: '0.8 mm', yards: 1.6 };
    case 'Satin': return { content: '100% polyester satin', weight: '90 gsm', yards: 1.6 };
    case 'Knit': return { content: '100% cotton knit', weight: '280 gsm', yards: 1.5 };
    case 'Rib': return { content: '95% cotton, 5% elastane rib', weight: '220 gsm', yards: 1.1 };
    case 'Jersey': return { content: '100% cotton jersey', weight: '180 gsm', yards: g.top?.block === 'Hoodie' ? 2.3 : 1.5 };
    default: return { content: '100% cotton', weight: '8 oz', yards: 1.6 };
  }
}
export const fabricInfoOf = (g: Garment): FabricInfo => ({ ...defaultFabricInfo(g), ...g.fabricInfo });

export interface BomRow {
  key: string;
  group: 'Fabric' | 'Trim' | 'Label' | 'Thread' | 'Graphic';
  item: string;
  detail: string;
  qty: number;
  unit: string;
  /** Cost per unit, empty until filled in. */
  cost?: number;
}

const LABEL_KINDS: TrimKind[] = ['Main label', 'Care label', 'Size label', 'Hang tag'];

export function buildBom(g: Garment, graphicSizes?: Map<string, GraphicMeasure>): BomRow[] {
  const rows: BomRow[] = [];
  const fi = fabricInfoOf(g);
  const col = garmentColor(g);
  rows.push({
    key: 'fabric',
    group: 'Fabric',
    item: `Main fabric, ${g.fabric.toLowerCase()}`,
    detail: `${fi.content}, ${fi.weight}, ${col.name}${col.pantone ? ` (${col.pantone})` : ''}`,
    qty: fi.yards,
    unit: 'yd',
    cost: fi.cost,
  });
  if (g.allOver) {
    rows.push({ key: 'allover', group: 'Fabric', item: 'All-over print', detail: `${g.allOver.name}, ${g.allOver.scale} tile`, qty: 1, unit: 'set', cost: g.bomCost?.allover });
  }
  for (const t of g.trims ?? []) {
    const isLabel = LABEL_KINDS.includes(t.kind);
    rows.push({ key: `trim:${t.id}`, group: isLabel ? 'Label' : 'Trim', item: t.kind, detail: trimDesc(t), qty: t.qty, unit: 'pc', cost: t.cost });
  }
  const c = constructionOf(g);
  const body = col.name;
  rows.push({ key: 'thread-main', group: 'Thread', item: 'Thread, main', detail: `${stitchName(c.stitch)}, ${c.threadMain || `${body}, tonal`}`, qty: 1, unit: 'cone', cost: g.bomCost?.['thread-main'] });
  rows.push({ key: 'thread-top', group: 'Thread', item: 'Thread, topstitch', detail: c.threadTop || (g.type === 'jeans' || g.type === 'shorts' ? 'Gold, heavy weight' : `${body}, tonal`), qty: 1, unit: 'cone', cost: g.bomCost?.['thread-top'] });
  for (const gr of g.graphics ?? []) {
    const m = graphicSizes?.get(gr.id);
    rows.push({ key: `gfx:${gr.id}`, group: 'Graphic', item: gr.method, detail: `${gr.name}, ${gr.side}${m ? `, ${m.w} x ${m.h} in` : ''}`, qty: 1, unit: 'pc', cost: g.bomCost?.[`gfx:${gr.id}`] });
  }
  return rows;
}

export const rowTotal = (r: BomRow) => (r.cost != null && !Number.isNaN(r.cost) ? r.cost * r.qty : 0);
export const bomTotal = (rows: BomRow[]) => rows.reduce((a, r) => a + rowTotal(r), 0);
export const money = (n: number) => `$${n.toFixed(2)}`;

let counter = 0;
function uid(): string {
  counter += 1;
  return `x${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}
export const newProdId = uid;
