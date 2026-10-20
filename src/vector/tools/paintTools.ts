// Eyedropper (I) and Gradient (G).
import { createElement as h } from 'react';
import {
  findItem,
  isEditable,
  itemBox,
  orderedSelection,
  type Box,
  type VectorDoc,
  type VItem,
  type VPaint,
  type VStop,
} from '../../model/vector';
import { vdoc, vs } from '../edit';
import { leaves } from './t_common';
import type { Pt } from './t_geom';
import type { Hit, PtrEvt, ToolCtx, VToolDef } from './types';

/** Selected leaf items that can take a style. */
function selectedLeaves(v: VectorDoc = vdoc()): VItem[] {
  return orderedSelection(v, vs().vsel)
    .map((id) => findItem(v, id))
    .filter((f) => f && isEditable(f))
    .flatMap((f) => leaves(f!.item));
}

const sampleOf = (hit: Hit): VItem | null => {
  if (hit?.kind !== 'item') return null;
  const f = findItem(vdoc(), hit.id);
  if (!f) return null;
  return leaves(f.item)[0] ?? null;
};

// ---------- Eyedropper ----------

export const eyedropperTool: VToolDef = {
  id: 'eyedropper',
  title: 'Eyedropper',
  key: 'i',
  icon: 'M13,3 L17,7 L15,9 L11,5 Z M11,7 L4,14 L3.5,16.5 L6,16 L13,9',
  help: 'Click an object to copy its look to the selection. Shift click copies only the fill color.',
  group: 'paint',
  decor: 'box',
  cursor: 'crosshair',
  snaps: false,
  down(e, hit) {
    const src = sampleOf(hit);
    if (!src || src.kind === 'group') return;
    const st = vs();
    const style = structuredClone(src.style);
    const targets = selectedLeaves().map((x) => x.id);
    if (targets.length) {
      st.vstep((v) => {
        for (const id of targets) {
          const f = findItem(v as VectorDoc, id);
          if (!f || f.item.kind === 'group') continue;
          if (e.shift) f.item.style.fill = structuredClone(style.fill);
          else {
            Object.assign(f.item.style, structuredClone(style));
            if (src.kind === 'text' && f.item.kind === 'text') {
              f.item.font = src.font;
              f.item.size = src.size;
              f.item.weight = src.weight;
              f.item.anchor = src.anchor;
              f.item.letter = src.letter;
            }
          }
        }
      });
    }
    st.setVStyle((s) => {
      if (e.shift) s.fill = structuredClone(style.fill);
      else Object.assign(s, structuredClone(style));
    });
  },
};

// ---------- Gradient ----------

const DEFAULT_STOPS: VStop[] = [
  { o: 0, color: '#141414', a: 1 },
  { o: 1, color: '#FFFFFF', a: 1 },
];

function stopsFor(fill: VPaint | null): VStop[] {
  if (fill?.kind === 'solid') {
    const light = /^#f{3}$|^#f{6}$/i.test(fill.color);
    return [
      { o: 0, color: fill.color, a: 1 },
      { o: 1, color: light ? '#141414' : '#FFFFFF', a: 1 },
    ];
  }
  if (fill) return structuredClone(fill.stops);
  return structuredClone(DEFAULT_STOPS);
}

let drag: { a: Pt; hit: Hit; moved: boolean } | null = null;

function guide(a: Pt, b: Pt, stops: VStop[], radial: boolean, k: number) {
  const sorted = [...stops].sort((x, y) => x.o - y.o);
  const kids = [];
  if (radial) kids.push(h('circle', { key: 'r', cx: a.x, cy: a.y, r: Math.hypot(b.x - a.x, b.y - a.y), fill: 'none', stroke: '#4F8DF7', strokeWidth: 1 / k, strokeDasharray: `${4 / k} ${3 / k}` }));
  kids.push(h('path', { key: 'l', d: `M${a.x},${a.y} L${b.x},${b.y}`, stroke: '#4F8DF7', strokeWidth: 1.5 / k, fill: 'none' }));
  sorted.forEach((s, i) =>
    kids.push(h('circle', { key: `s${i}`, cx: a.x + (b.x - a.x) * s.o, cy: a.y + (b.y - a.y) * s.o, r: 4.5 / k, fill: s.color, stroke: '#fff', strokeWidth: 1.5 / k })),
  );
  return h('g', null, ...kids);
}

function applyGradient(a: Pt, b: Pt, radial: boolean) {
  const v = vdoc();
  const boxes = new Map<string, Box>();
  for (const it of selectedLeaves(v)) {
    if (it.kind === 'dim') continue;
    const bx = itemBox(it);
    if (bx) boxes.set(it.id, bx);
  }
  if (!boxes.size) return;
  vs().vstep((d) => {
    for (const [id, bx] of boxes) {
      const f = findItem(d as VectorDoc, id);
      if (!f || f.item.kind === 'group') continue;
      const w = bx.w || 1, hh = bx.h || 1;
      const stops = stopsFor(f.item.style.fill as VPaint | null);
      f.item.style.fill = {
        kind: radial ? 'radial' : 'linear',
        stops,
        x1: (a.x - bx.x) / w,
        y1: (a.y - bx.y) / hh,
        x2: (b.x - bx.x) / w,
        y2: (b.y - bx.y) / hh,
      };
    }
  });
}

/** The gradient line of the first selected item that has one, in canvas units. */
function shownGradient(): { a: Pt; b: Pt; stops: VStop[]; radial: boolean } | null {
  for (const it of selectedLeaves()) {
    if (it.kind === 'dim' || it.kind === 'group') continue;
    const f = it.style.fill;
    const bx = itemBox(it);
    if (!f || f.kind === 'solid' || !bx) continue;
    return {
      a: { x: bx.x + f.x1 * bx.w, y: bx.y + f.y1 * bx.h },
      b: { x: bx.x + f.x2 * bx.w, y: bx.y + f.y2 * bx.h },
      stops: f.stops,
      radial: f.kind === 'radial',
    };
  }
  return null;
}

const firstStops = (): VStop[] => {
  const it = selectedLeaves().find((x) => x.kind !== 'dim');
  return it && it.kind !== 'group' ? stopsFor(it.style.fill) : DEFAULT_STOPS;
};

function showHover(ctx: ToolCtx) {
  const g = shownGradient();
  ctx.setPreview(g ? guide(g.a, g.b, g.stops, g.radial, ctx.k) : null);
}

export const gradientTool: VToolDef = {
  id: 'gradient',
  title: 'Gradient',
  key: 'g',
  icon: 'M4,4 H16 V16 H4 Z M4,8 H16 M4,12 H16',
  help: 'Select items, then drag across them to set a gradient. Alt drag for a radial gradient from the center. A solid fill becomes a gradient to white.',
  group: 'paint',
  decor: 'none',
  cursor: 'crosshair',
  snaps: false,
  down(e, hit) {
    drag = { a: { x: e.x, y: e.y }, hit, moved: false };
  },
  move(e, ctx) {
    if (!drag) return;
    if (Math.hypot(e.x - drag.a.x, e.y - drag.a.y) * ctx.k < 3) return;
    drag.moved = true;
    ctx.setPreview(guide(drag.a, { x: e.x, y: e.y }, firstStops(), e.alt, ctx.k));
  },
  up(e, ctx) {
    const d = drag;
    drag = null;
    ctx?.setPreview(null);
    if (!d) return;
    if (!d.moved) {
      if (d.hit?.kind === 'item') vs().setVSel([d.hit.top]);
      showHover(ctx);
      return;
    }
    if (!vs().vsel.length) {
      ctx.toast('Select something first');
      return;
    }
    applyGradient(d.a, { x: e.x, y: e.y }, e.alt);
    showHover(ctx);
  },
  hover: (_e: PtrEvt, _hit, ctx) => showHover(ctx),
  cancel(ctx) {
    drag = null;
    ctx?.setPreview(null);
  },
};

export const paintTools: VToolDef[] = [eyedropperTool, gradientTool];

