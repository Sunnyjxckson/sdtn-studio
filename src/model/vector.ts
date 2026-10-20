// Vector mode: an Illustrator style document drawn over the croquis.
// Everything is in canvas units (the 600 x 980 artboard). Transforms are baked into
// the geometry, like Illustrator, so a path is always just its anchor points.
import { newId } from './garment';

/** One anchor. Handles are absolute positions; a handle equal to the anchor means no handle. */
export interface VNode {
  x: number;
  y: number;
  ix: number;
  iy: number;
  ox: number;
  oy: number;
  /** Smooth anchors keep their two handles in line when one is dragged. */
  smooth?: boolean;
}

export interface VSub {
  nodes: VNode[];
  closed: boolean;
}

export interface VStop {
  /** 0 to 1 along the gradient. */
  o: number;
  color: string;
  /** Opacity, 0 to 1. */
  a: number;
}

/** Gradient end points are in the item's bounding box, 0 to 1 on each axis. */
export type VPaint =
  | { kind: 'solid'; color: string }
  | { kind: 'linear' | 'radial'; stops: VStop[]; x1: number; y1: number; x2: number; y2: number };

export type VCap = 'butt' | 'round' | 'square';
export type VJoin = 'miter' | 'round' | 'bevel';
export type VBlend = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-burn' | 'color-dodge' | 'difference';
export const VBLENDS: VBlend[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-burn', 'color-dodge', 'difference'];

export interface VStyle {
  fill: VPaint | null;
  stroke: VPaint | null;
  width: number;
  /** Dash and gap lengths, empty for a solid line. */
  dash: number[];
  cap: VCap;
  join: VJoin;
  opacity: number;
  blend: VBlend;
  fillRule: 'nonzero' | 'evenodd';
}

interface Base {
  id: string;
  name: string;
  hidden?: boolean;
  locked?: boolean;
}

export interface VPath extends Base {
  kind: 'path';
  /** More than one sub path makes a compound path. */
  subs: VSub[];
  style: VStyle;
}

export interface VText extends Base {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  font: string;
  weight: number;
  anchor: 'start' | 'middle' | 'end';
  /** Degrees, around x, y. */
  rot: number;
  /** Letter spacing in canvas units. */
  letter: number;
  style: VStyle;
}

/** A measured line for tech packs: from a to b, drawn off to the side by off. */
export interface VDim extends Base {
  kind: 'dim';
  ax: number;
  ay: number;
  bx: number;
  by: number;
  off: number;
  /** Canvas units per inch. */
  ppi: number;
  style: VStyle;
}

export type VRepeat =
  | { kind: 'mirror'; axis: 'v' | 'h'; at: number }
  | { kind: 'radial'; cx: number; cy: number; count: number }
  | { kind: 'grid'; cols: number; rows: number; gx: number; gy: number };

export interface VGroup extends Base {
  kind: 'group';
  /** Bottom first. */
  children: VItem[];
  /** The bottom child clips the rest (a clipping mask). */
  clip?: boolean;
  /** Live repeat of the children. */
  repeat?: VRepeat;
}

export type VItem = VPath | VText | VDim | VGroup;

export interface VLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Selection color for this layer, like Illustrator. */
  color: string;
  /** Bottom first. */
  items: VItem[];
}

export interface VectorDoc {
  /** Bottom first. */
  layers: VLayer[];
  grid: boolean;
  gridSize: number;
  snap: boolean;
  smartGuides: boolean;
  /** Saved swatch colors. */
  swatches: string[];
}

export const LAYER_COLORS = ['#4F8DF7', '#E5484D', '#30A46C', '#F5A524', '#8E4EC6', '#12A594', '#E54D9E'];

export const newLayer = (n: number): VLayer => ({
  id: newId(),
  name: `Layer ${n}`,
  visible: true,
  locked: false,
  color: LAYER_COLORS[(n - 1) % LAYER_COLORS.length],
  items: [],
});

export const DEFAULT_SWATCHES = [
  '#141414', '#3E3B35', '#8C877D', '#F4F2ED', '#FFFFFF', '#C8102E',
  '#7A0E1F', '#2F4A6D', '#5B7FA6', '#9FB7CF', '#3E5236', '#C9B48A',
  '#6B4430', '#B8743A', '#E3C04B', '#D98AA0', '#5C3F7A', '#E07A2B',
];

export const emptyVector = (): VectorDoc => ({
  layers: [newLayer(1)],
  grid: false,
  gridSize: 10,
  snap: true,
  smartGuides: true,
  swatches: [...DEFAULT_SWATCHES],
});

export const defaultStyle = (): VStyle => ({
  fill: { kind: 'solid', color: '#FFFFFF' },
  stroke: { kind: 'solid', color: '#141414' },
  width: 1.4,
  dash: [],
  cap: 'round',
  join: 'round',
  opacity: 1,
  blend: 'normal',
  fillRule: 'nonzero',
});

export function normalizeVector(v: Partial<VectorDoc> | undefined): VectorDoc {
  const e = emptyVector();
  if (!v || !Array.isArray(v.layers) || v.layers.length === 0) return { ...e, ...(v ?? {}), layers: e.layers };
  return { ...e, ...v, layers: v.layers.map((l, i) => ({ ...newLayer(i + 1), ...l, items: Array.isArray(l.items) ? l.items : [] })) };
}

// ---------- node and path builders ----------

export const corner = (x: number, y: number): VNode => ({ x, y, ix: x, iy: y, ox: x, oy: y });

export const hasIn = (n: VNode) => n.ix !== n.x || n.iy !== n.y;
export const hasOut = (n: VNode) => n.ox !== n.x || n.oy !== n.y;

export function makePath(subs: VSub[], style: VStyle, name = 'Path'): VPath {
  return { kind: 'path', id: newId(), name, subs, style: structuredClone(style) };
}

export function rectSub(x: number, y: number, w: number, h: number, r = 0): VSub {
  const x0 = Math.min(x, x + w), y0 = Math.min(y, y + h);
  const W = Math.abs(w), H = Math.abs(h);
  const rr = Math.max(0, Math.min(r, W / 2, H / 2));
  if (rr <= 0) return { closed: true, nodes: [corner(x0, y0), corner(x0 + W, y0), corner(x0 + W, y0 + H), corner(x0, y0 + H)] };
  const k = rr * 0.5523;
  const n = (px: number, py: number, ix: number, iy: number, ox: number, oy: number): VNode => ({ x: px, y: py, ix, iy, ox, oy });
  return {
    closed: true,
    nodes: [
      n(x0 + rr, y0, x0 + rr - k, y0, x0 + rr, y0),
      n(x0 + W - rr, y0, x0 + W - rr, y0, x0 + W - rr + k, y0),
      n(x0 + W, y0 + rr, x0 + W, y0 + rr - k, x0 + W, y0 + rr),
      n(x0 + W, y0 + H - rr, x0 + W, y0 + H - rr, x0 + W, y0 + H - rr + k),
      n(x0 + W - rr, y0 + H, x0 + W - rr + k, y0 + H, x0 + W - rr, y0 + H),
      n(x0 + rr, y0 + H, x0 + rr, y0 + H, x0 + rr - k, y0 + H),
      n(x0, y0 + H - rr, x0, y0 + H - rr + k, x0, y0 + H - rr),
      n(x0, y0 + rr, x0, y0 + rr, x0, y0 + rr - k),
    ],
  };
}

export function ellipseSub(cx: number, cy: number, rx: number, ry: number): VSub {
  const kx = Math.abs(rx) * 0.5523, ky = Math.abs(ry) * 0.5523;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  return {
    closed: true,
    nodes: [
      { x: cx, y: cy - ry, ix: cx - kx, iy: cy - ry, ox: cx + kx, oy: cy - ry, smooth: true },
      { x: cx + rx, y: cy, ix: cx + rx, iy: cy - ky, ox: cx + rx, oy: cy + ky, smooth: true },
      { x: cx, y: cy + ry, ix: cx + kx, iy: cy + ry, ox: cx - kx, oy: cy + ry, smooth: true },
      { x: cx - rx, y: cy, ix: cx - rx, iy: cy + ky, ox: cx - rx, oy: cy - ky, smooth: true },
    ],
  };
}

export function polygonSub(cx: number, cy: number, r: number, sides: number, rot = 0): VSub {
  const nodes: VNode[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot - Math.PI / 2 + (i / sides) * Math.PI * 2;
    nodes.push(corner(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return { closed: true, nodes };
}

export function starSub(cx: number, cy: number, r1: number, r2: number, points: number, rot = 0): VSub {
  const nodes: VNode[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 ? r2 : r1;
    nodes.push(corner(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return { closed: true, nodes };
}

// ---------- SVG output ----------

const f = (n: number) => (Math.round(n * 100) / 100).toString();

export function subD(s: VSub): string {
  const ns = s.nodes;
  if (ns.length === 0) return '';
  let d = `M${f(ns[0].x)},${f(ns[0].y)}`;
  const seg = (a: VNode, b: VNode) =>
    !hasOut(a) && !hasIn(b) ? ` L${f(b.x)},${f(b.y)}` : ` C${f(a.ox)},${f(a.oy)} ${f(b.ix)},${f(b.iy)} ${f(b.x)},${f(b.y)}`;
  for (let i = 1; i < ns.length; i++) d += seg(ns[i - 1], ns[i]);
  if (s.closed && ns.length > 1) {
    const a = ns[ns.length - 1], b = ns[0];
    if (hasOut(a) || hasIn(b)) d += seg(a, b);
    d += ' Z';
  }
  return d;
}

export const pathD = (p: VPath) => p.subs.map(subD).join(' ');

// ---------- geometry ----------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Mat = [number, number, number, number, number, number];
export const IDENT: Mat = [1, 0, 0, 1, 0, 0];
export const apply = (m: Mat, x: number, y: number) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
export const mul = (a: Mat, b: Mat): Mat => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
export const translate = (dx: number, dy: number): Mat => [1, 0, 0, 1, dx, dy];
export const scaleAt = (sx: number, sy: number, cx: number, cy: number): Mat => [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
export const rotateAt = (deg: number, cx: number, cy: number): Mat => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};
export const matStr = (m: Mat) => `matrix(${m.map((v) => Math.round(v * 10000) / 10000).join(' ')})`;

function cubicExtrema(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) > 1e-9) ts.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const r = Math.sqrt(disc);
      ts.push((-b + r) / (2 * a), (-b - r) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}
const cub = (t: number, a: number, b: number, c: number, d: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

export function segments(s: VSub): [VNode, VNode][] {
  const out: [VNode, VNode][] = [];
  for (let i = 1; i < s.nodes.length; i++) out.push([s.nodes[i - 1], s.nodes[i]]);
  if (s.closed && s.nodes.length > 1) out.push([s.nodes[s.nodes.length - 1], s.nodes[0]]);
  return out;
}

function pathBox(p: VPath): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const s of p.subs) {
    for (const n of s.nodes) add(n.x, n.y);
    for (const [a, b] of segments(s)) {
      for (const t of cubicExtrema(a.x, a.ox, b.ix, b.x)) add(cub(t, a.x, a.ox, b.ix, b.x), cub(t, a.y, a.oy, b.iy, b.y));
      for (const t of cubicExtrema(a.y, a.oy, b.iy, b.y)) add(cub(t, a.x, a.ox, b.ix, b.x), cub(t, a.y, a.oy, b.iy, b.y));
    }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

let measureCtx: CanvasRenderingContext2D | null = null;
export function textWidth(t: VText): number {
  try {
    measureCtx ??= document.createElement('canvas').getContext('2d');
    if (measureCtx) {
      measureCtx.font = `${t.weight} ${t.size}px ${t.font}`;
      return measureCtx.measureText(t.text).width + t.letter * Math.max(0, t.text.length - 1);
    }
  } catch {
    // no canvas (tests)
  }
  return t.text.length * t.size * 0.56;
}

/** Corners of a text box before rotation: x, y is the baseline anchor. */
export function textCorners(t: VText) {
  const w = textWidth(t);
  const x0 = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'end' ? t.x - w : t.x;
  const top = t.y - t.size * 0.8, bot = t.y + t.size * 0.22;
  const m = rotateAt(t.rot, t.x, t.y);
  return [apply(m, x0, top), apply(m, x0 + w, top), apply(m, x0 + w, bot), apply(m, x0, bot)];
}

const union = (a: Box | null, b: Box | null): Box | null => {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const ptsBox = (ps: { x: number; y: number }[]): Box | null => {
  if (!ps.length) return null;
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export function repeatMats(r: VRepeat): Mat[] {
  if (r.kind === 'mirror') return [r.axis === 'v' ? scaleAt(-1, 1, r.at, 0) : scaleAt(1, -1, 0, r.at)];
  if (r.kind === 'radial') {
    const out: Mat[] = [];
    for (let i = 1; i < Math.max(1, r.count); i++) out.push(rotateAt((360 * i) / r.count, r.cx, r.cy));
    return out;
  }
  const out: Mat[] = [];
  for (let j = 0; j < Math.max(1, r.rows); j++) for (let i = 0; i < Math.max(1, r.cols); i++) if (i || j) out.push(translate(i * r.gx, j * r.gy));
  return out;
}

export function dimGeom(d: VDim) {
  const dx = d.bx - d.ax, dy = d.by - d.ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const a = { x: d.ax + nx * d.off, y: d.ay + ny * d.off };
  const b = { x: d.bx + nx * d.off, y: d.by + ny * d.off };
  return { a, b, nx, ny, len, inches: len / (d.ppi || 1), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Bounding box of an item, ignoring stroke width. */
export function itemBox(it: VItem, withRepeat = true): Box | null {
  if (it.kind === 'path') return pathBox(it);
  if (it.kind === 'text') return ptsBox(textCorners(it));
  if (it.kind === 'dim') {
    const g = dimGeom(it);
    return ptsBox([{ x: it.ax, y: it.ay }, { x: it.bx, y: it.by }, g.a, g.b]);
  }
  let b: Box | null = null;
  const kids = it.clip && it.children.length ? [it.children[0]] : it.children;
  for (const c of kids) if (!c.hidden) b = union(b, itemBox(c));
  if (b && withRepeat && it.repeat) {
    const corners = [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ];
    for (const m of repeatMats(it.repeat)) b = union(b, ptsBox(corners.map((p) => apply(m, p.x, p.y))));
  }
  return b;
}

export function itemsBox(items: VItem[]): Box | null {
  let b: Box | null = null;
  for (const it of items) b = union(b, itemBox(it));
  return b;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Bake a transform into an item. Mutates it. */
export function transformItem(it: VItem, m: Mat): void {
  if (it.kind === 'path') {
    for (const s of it.subs)
      for (const n of s.nodes) {
        const p = apply(m, n.x, n.y), i = apply(m, n.ix, n.iy), o = apply(m, n.ox, n.oy);
        n.x = r3(p.x); n.y = r3(p.y); n.ix = r3(i.x); n.iy = r3(i.y); n.ox = r3(o.x); n.oy = r3(o.y);
      }
    // a mirror flips direction; keep handles where they are, geometry stays right
    const sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    if (it.style.stroke && sc > 0 && Math.abs(sc - 1) > 1e-6 && scaleStrokes) it.style.width = r3(it.style.width * sc);
    return;
  }
  if (it.kind === 'text') {
    const p = apply(m, it.x, it.y);
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
    const det = m[0] * m[3] - m[1] * m[2];
    it.x = r3(p.x);
    it.y = r3(p.y);
    it.size = r3(Math.max(1, it.size * Math.sqrt(sx * sy)));
    it.letter = r3(it.letter * sx);
    const ang = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    it.rot = r3(((it.rot + (det < 0 ? -ang : ang)) % 360 + 360) % 360);
    return;
  }
  if (it.kind === 'dim') {
    const a = apply(m, it.ax, it.ay), b = apply(m, it.bx, it.by);
    const det = m[0] * m[3] - m[1] * m[2];
    it.ax = r3(a.x); it.ay = r3(a.y); it.bx = r3(b.x); it.by = r3(b.y);
    if (det < 0) it.off = -it.off;
    return;
  }
  for (const c of it.children) transformItem(c, m);
  const r = it.repeat;
  if (r?.kind === 'mirror') {
    const p = r.axis === 'v' ? apply(m, r.at, 0) : apply(m, 0, r.at);
    r.at = r3(r.axis === 'v' ? p.x : p.y);
  } else if (r?.kind === 'radial') {
    const p = apply(m, r.cx, r.cy);
    r.cx = r3(p.x);
    r.cy = r3(p.y);
  } else if (r?.kind === 'grid') {
    r.gx = r3(r.gx * Math.hypot(m[0], m[1]));
    r.gy = r3(r.gy * Math.hypot(m[2], m[3]));
  }
}

/** Whether scaling also scales stroke widths (Illustrator's Scale Strokes and Effects). */
let scaleStrokes = true;
export const setScaleStrokes = (on: boolean) => void (scaleStrokes = on);
export const getScaleStrokes = () => scaleStrokes;

/** Deep copy with new ids. */
export function cloneItem<T extends VItem>(it: T): T {
  const c = structuredClone(it);
  const re = (x: VItem) => {
    x.id = newId();
    if (x.kind === 'group') x.children.forEach(re);
  };
  re(c);
  return c;
}

// ---------- tree helpers ----------

export interface Found {
  item: VItem;
  /** The array that holds the item. */
  list: VItem[];
  index: number;
  layer: VLayer;
  /** Top level item in the layer that contains it (itself when top level). */
  top: VItem;
  parent: VGroup | null;
}

export function findItem(v: VectorDoc, id: string): Found | null {
  for (const layer of v.layers) {
    const walk = (list: VItem[], top: VItem | null, parent: VGroup | null): Found | null => {
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const t = top ?? it;
        if (it.id === id) return { item: it, list, index: i, layer, top: t, parent };
        if (it.kind === 'group') {
          const r = walk(it.children, t, it);
          if (r) return r;
        }
      }
      return null;
    };
    const r = walk(layer.items, null, null);
    if (r) return r;
  }
  return null;
}

export function walkItems(v: VectorDoc, fn: (it: VItem, layer: VLayer, depth: number) => void) {
  for (const l of v.layers) {
    const w = (list: VItem[], d: number) => {
      for (const it of list) {
        fn(it, l, d);
        if (it.kind === 'group') w(it.children, d + 1);
      }
    };
    w(l.items, 0);
  }
}

/** All paths inside an item, groups included. */
export function pathsIn(it: VItem): VPath[] {
  if (it.kind === 'path') return [it];
  if (it.kind === 'group') return it.children.flatMap(pathsIn);
  return [];
}

export const isEditable = (f: Found) => f.layer.visible && !f.layer.locked && !f.top.locked && !f.top.hidden && !f.item.locked && !f.item.hidden;

/** Selected ids in stacking order, bottom first, dropping ids nested in another selected item. */
export function orderedSelection(v: VectorDoc, ids: string[]): string[] {
  const set = new Set(ids);
  const out: string[] = [];
  for (const l of v.layers) {
    const w = (list: VItem[], covered: boolean) => {
      for (const it of list) {
        const on = set.has(it.id) && !covered;
        if (on) out.push(it.id);
        if (it.kind === 'group') w(it.children, covered || on);
      }
    };
    w(l.items, false);
  }
  return out;
}

export function textPaint(p: VPaint | null) {
  return p?.kind === 'solid' ? p.color : p ? p.stops[0]?.color ?? '#000' : 'none';
}
