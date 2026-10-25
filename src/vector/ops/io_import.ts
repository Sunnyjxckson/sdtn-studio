// SVG import (file, clipboard) and garment/croquis to vector conversion, through paper.js.
import type paper from 'paper/dist/paper-core';
import { useStore } from '../../store';
import { newId } from '../../model/garment';
import { garmentHex } from '../../model/production';
import { skinColor } from '../../model/croquis';
import {
  defaultStyle,
  itemsBox,
  newLayer,
  setScaleStrokes,
  getScaleStrokes,
  transformItem,
  type Mat,
  type VGroup,
  type VItem,
  type VPaint,
  type VPath,
  type VStyle,
} from '../../model/vector';
import { addItems, vs } from '../edit';
import { ensurePaper, fromPaper } from './paperScope';

const ART = { x: 0, y: 20, w: 600, h: 980 };

const hex = (c: paper.Color) => c.toCSS(true).toUpperCase();

function toPaint(P: typeof paper, c: paper.Color | null | undefined, b: paper.Rectangle): { paint: VPaint | null; alpha: number } {
  if (!c) return { paint: null, alpha: 1 };
  if (c.type === 'gradient' && c.gradient) {
    const g = c.gradient;
    const gc = c as unknown as { origin?: paper.Point; destination?: paper.Point };
    const rel = (p: paper.Point) => ({ x: b.width ? (p.x - b.x) / b.width : 0.5, y: b.height ? (p.y - b.y) / b.height : 0.5 });
    const o = rel(gc.origin ?? new P.Point(b.x, b.y + b.height / 2));
    const d = rel(gc.destination ?? new P.Point(b.x + b.width, b.y + b.height / 2));
    const stops = g.stops.map((s, i) => ({
      o: s.offset ?? i / Math.max(1, g.stops.length - 1),
      color: s.color ? hex(s.color) : '#000000',
      a: s.color ? s.color.alpha : 1,
    }));
    return { paint: { kind: g.radial ? 'radial' : 'linear', stops, x1: o.x, y1: o.y, x2: d.x, y2: d.y }, alpha: 1 };
  }
  if (c.alpha === 0) return { paint: null, alpha: 1 };
  try {
    return { paint: { kind: 'solid', color: hex(c) }, alpha: c.alpha };
  } catch {
    return { paint: null, alpha: 1 };
  }
}

function styleOf(P: typeof paper, it: paper.Item): VStyle {
  const s = defaultStyle();
  const b = it.bounds;
  const f = toPaint(P, it.fillColor, b);
  const k = toPaint(P, it.strokeColor, b);
  s.fill = f.paint;
  s.stroke = k.paint;
  s.width = k.paint ? it.strokeWidth : 0;
  s.dash = (it.dashArray ?? []).slice();
  s.cap = (it.strokeCap as VStyle['cap']) || 'butt';
  s.join = (it.strokeJoin as VStyle['join']) || 'miter';
  s.opacity = Math.max(0, Math.min(1, it.opacity * Math.min(f.alpha, k.paint ? k.alpha : 1)));
  s.fillRule = (it as paper.Path).fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
  return s;
}

/** The leaf with all matrices baked in. */
function baked(leaf: paper.Item): paper.Item {
  const c = leaf.clone({ insert: false, deep: true });
  c.applyMatrix = true;
  const pm = leaf.parent ? leaf.parent.globalMatrix : null;
  if (pm) c.transform(pm);
  return c;
}

const detScale = (m: paper.Matrix) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));

function leafPath(P: typeof paper, leaf: paper.Item): VPath | null {
  if (!(leaf instanceof P.Path || leaf instanceof P.CompoundPath)) return null;
  const parentScale = leaf.parent ? detScale(leaf.parent.globalMatrix) : 1;
  const style = styleOf(P, leaf);
  style.width = Math.round(style.width * parentScale * 100) / 100;
  const flat = baked(leaf);
  return fromPaper(flat, style, leaf.name || 'Path');
}

function convert(P: typeof paper, it: paper.Item, depth = 0): VItem | null {
  if (it instanceof P.Path || it instanceof P.CompoundPath) return leafPath(P, it);
  if (!(it instanceof P.Group) && !(it instanceof P.Layer)) return null;
  const kids = [...(it.children ?? [])];
  const clipped = (it as paper.Group).clipped && depth > 0;
  const out: VItem[] = [];
  for (const k of kids) {
    if (k.clipMask) {
      // the root clip is just the viewBox, drop it
      const mask = clipped && (k instanceof P.Path || k instanceof P.CompoundPath) ? convert(P, k, depth + 1) : null;
      if (mask && mask.kind === 'path') {
        mask.style.fill = { kind: 'solid', color: '#FFFFFF' };
        mask.style.stroke = null;
        out.unshift(mask);
      }
      continue;
    }
    const c = convert(P, k, depth + 1);
    if (c) out.push(c);
  }
  if (!out.length) return null;
  if (out.length === 1 && !clipped && depth > 0) return out[0];
  const g: VGroup = { kind: 'group', id: newId(), name: it.name || 'Group', children: out };
  if (clipped && out.length > 1 && out[0].kind === 'path' && out[0].style.stroke === null) g.clip = true;
  return g;
}

/** Parse SVG markup to vector items. Empty when it is not usable SVG. */
export function svgToItems(text: string): VItem[] {
  const P = ensurePaper();
  let root: paper.Item | null = null;
  try {
    root = P.project.importSVG(text, { expandShapes: true, insert: false }) as paper.Item;
  } catch {
    return [];
  }
  if (!root) return [];
  const prev = getScaleStrokes();
  setScaleStrokes(true);
  try {
    const it = convert(P, root);
    if (!it) return [];
    return [it];
  } finally {
    setScaleStrokes(prev);
  }
}

/** Center items on the artboard, shrinking them to fit when they are larger. */
export function fitToArtboard(items: VItem[]) {
  const b = itemsBox(items);
  if (!b || (b.w <= 0 && b.h <= 0)) return;
  const k = Math.min(1, ART.w / Math.max(b.w, 1e-6), ART.h / Math.max(b.h, 1e-6));
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const m: Mat = [k, 0, 0, k, ART.x + ART.w / 2 - k * cx, ART.y + ART.h / 2 - k * cy];
  const prev = getScaleStrokes();
  setScaleStrokes(true);
  for (const it of items) transformItem(it, m);
  setScaleStrokes(prev);
}

/** Import SVG markup as a group on the artboard. Returns false if nothing came in. */
export function placeSvg(text: string, name = 'Placed SVG'): boolean {
  const items = svgToItems(text);
  if (!items.length) return false;
  const g: VGroup = items.length === 1 && items[0].kind === 'group' ? items[0] : { kind: 'group', id: newId(), name, children: items };
  g.name = name;
  fitToArtboard([g]);
  addItems([g]);
  return true;
}

// ---------- garments and croquis ----------

const SHAPES = 'path, ellipse, circle, rect, line, polyline, polygon';
const flatColor = (v: string, fallback: string | null) => {
  if (!v || v === 'none' || v === 'transparent' || v.startsWith('rgba(0, 0, 0, 0)')) return null;
  if (v.startsWith('url')) return fallback;
  return v;
};

function skipEl(el: Element, root: Element): boolean {
  for (let p: Element | null = el; p && p !== root.parentElement; p = p.parentElement) {
    const tag = p.tagName.toLowerCase();
    if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'pattern' || tag === 'filter') return true;
    if (p.getAttribute('filter') || (p as SVGElement).style?.mixBlendMode) return true;
  }
  return false;
}

function opacityUp(el: Element, root: Element): number {
  let o = 1;
  for (let p: Element | null = el; p && p !== root.parentElement; p = p.parentElement) {
    const v = Number(getComputedStyle(p).opacity);
    if (Number.isFinite(v)) o *= v;
  }
  return o;
}

/** Convert one rendered SVG group in the main canvas to vector paths in canvas units. */
function groupToVector(src: Element, world: SVGGElement, name: string, flat: string): VGroup | null {
  const P = ensurePaper();
  const wi = world.getCTM()?.inverse();
  if (!wi) return null;
  const out: VItem[] = [];
  const prev = getScaleStrokes();
  setScaleStrokes(true);
  for (const el of Array.from(src.querySelectorAll(SHAPES))) {
    if (skipEl(el, src)) continue;
    const cs = getComputedStyle(el);
    const stroked = flatColor(cs.stroke, '#141414');
    // a pattern fill with no outline is a shading overlay, not a shape
    const fill = cs.fill.startsWith('url') && !stroked && el.getAttribute('data-kind') !== 'garment' ? null : flatColor(cs.fill, flat);
    const stroke = stroked;
    if (!fill && !stroke) continue;
    const op = opacityUp(el, src);
    if (op < 0.05) continue;
    const ctm = (el as SVGGraphicsElement).getCTM();
    if (!ctm) continue;
    const r = wi.multiply(ctm);
    const c = el.cloneNode(false) as Element;
    for (const a of ['transform', 'clip-path', 'mask', 'filter', 'style', 'class', 'id']) c.removeAttribute(a);
    c.setAttribute('fill', fill ?? 'none');
    c.setAttribute('stroke', stroke ?? 'none');
    if (stroke) {
      c.setAttribute('stroke-width', String(parseFloat(cs.strokeWidth) || 1));
      c.setAttribute('stroke-linecap', cs.strokeLinecap);
      c.setAttribute('stroke-linejoin', cs.strokeLinejoin);
      if (cs.strokeDasharray && cs.strokeDasharray !== 'none') c.setAttribute('stroke-dasharray', cs.strokeDasharray.replace(/px/g, '').replace(/,/g, ' '));
    }
    const fo = Number(cs.fillOpacity), so = Number(cs.strokeOpacity);
    const total = op * Math.min(Number.isFinite(fo) ? fo : 1, stroke && !fill ? (Number.isFinite(so) ? so : 1) : 1);
    if (total < 1) c.setAttribute('opacity', String(total));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg">${new XMLSerializer().serializeToString(c)}</svg>`;
    const root = P.project.importSVG(svg, { expandShapes: true, insert: false }) as paper.Item | null;
    const leaf = root ? firstLeaf(P, root) : null;
    if (!leaf) continue;
    const vp = leafPath(P, leaf);
    if (!vp) continue;
    const m: Mat = [r.a, r.b, r.c, r.d, r.e, r.f];
    transformItem(vp, m);
    out.push(vp);
  }
  setScaleStrokes(prev);
  if (!out.length) return null;
  return { kind: 'group', id: newId(), name, children: out };
}

function firstLeaf(P: typeof paper, it: paper.Item): paper.Item | null {
  if (it instanceof P.Path || it instanceof P.CompoundPath) return it;
  for (const c of it.children ?? []) {
    const l = firstLeaf(P, c);
    if (l) return l;
  }
  return null;
}

const world = () => document.querySelector('svg.canvas > g') as SVGGElement | null;

function pushLayer(name: string, items: VGroup[], locked: boolean, bottom: boolean) {
  const st = vs();
  const nl = newLayer(st.doc.vector.layers.length + 1);
  nl.name = name;
  nl.locked = locked;
  nl.items = items;
  st.vstep((v) => {
    const at = v.layers.findIndex((l) => l.name === name);
    if (at >= 0) v.layers.splice(at, 1);
    if (bottom) v.layers.unshift(nl);
    else v.layers.push(nl);
  });
  if (!locked) {
    st.setVLayer(nl.id);
    st.setVSel(items.map((i) => i.id));
  }
}

/** Garments on the croquis as editable paths in a "Garments" layer. Returns the count. */
export function garmentsToVector(): number {
  const w = world();
  if (!w) return 0;
  const groups: VGroup[] = [];
  const doc = useStore.getState().doc;
  const seen = new Set<Element>();
  for (const el of Array.from(w.querySelectorAll('g[id^="garment-"]'))) {
    if (el.closest('#croquis-art') || seen.has(el)) continue;
    seen.add(el);
    const gid = el.getAttribute('data-gid');
    const g = doc.garments.find((x) => x.id === gid);
    const v = groupToVector(el, w, g?.name || 'Garment', g ? garmentHex(g) : '#F4F2ED');
    if (v) groups.push(v);
  }
  if (!groups.length) return 0;
  pushLayer('Garments', groups, false, false);
  return groups.length;
}

/** The croquis figure as paths in a locked "Croquis" layer at the bottom. */
export function croquisToVector(): number {
  const w = world();
  const src = document.querySelector('#croquis-art');
  if (!w || !src) return 0;
  const g = groupToVector(src, w, 'Croquis', skinColor(useStore.getState().doc.base.skin));
  if (!g) return 0;
  pushLayer('Croquis', [g], true, true);
  return 1;
}
