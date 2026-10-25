// Dimension (Shift+D) and Measure.
import { createElement as h } from 'react';
import { newId } from '../../model/garment';
import { defaultStyle, dimGeom, findItem, type VectorDoc, type VDim } from '../../model/vector';
import { addItems, selectedItems, vs } from '../edit';
import { constrain45, setGuides } from '../snap';
import { DimOpts, MeasureOpts } from './t_opts';
import { useMeasureOpts } from './t_state';
import type { Pt } from './t_geom';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

const RED = '#C8102E';
const OFFSET = -14;

const endPoint = (a: Pt, e: PtrEvt): Pt => (e.shift ? constrain45(a, { x: e.x, y: e.y }) : { x: e.x, y: e.y });

const fmtIn = (n: number) => `${(Math.round(n * 100) / 100).toString()}"`;

function label(a: Pt, b: Pt, k: number, ppi: number, withAngle: boolean) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const txt = withAngle ? `${fmtIn(len / ppi)}  ${Math.round(len * 10) / 10} u  ${Math.round(ang * 10) / 10}°` : fmtIn(len / ppi);
  return {
    txt,
    node: h(
      'g',
      null,
      h('path', { d: `M${a.x},${a.y} L${b.x},${b.y}`, stroke: RED, strokeWidth: 1.2 / k, fill: 'none' }),
      h('circle', { cx: a.x, cy: a.y, r: 3 / k, fill: RED }),
      h('circle', { cx: b.x, cy: b.y, r: 3 / k, fill: RED }),
      h('text', { x: (a.x + b.x) / 2 + 8 / k, y: (a.y + b.y) / 2 - 8 / k, fontSize: 11 / k, fill: RED, fontFamily: 'IBM Plex Mono, monospace', stroke: '#F4F2ED', strokeWidth: 3 / k, paintOrder: 'stroke' }, txt),
    ),
  };
}

// ---------- Dimension ----------

function makeDim(g: { ax: number; ay: number; bx: number; by: number; mode?: VDim['mode']; vx?: number; vy?: number }): VDim {
  const style = defaultStyle();
  style.fill = null;
  style.stroke = { kind: 'solid', color: RED };
  style.width = 0.8;
  const names = { angular: 'Angle', radius: 'Radius', diameter: 'Diameter', linear: 'Dimension' };
  const dim: VDim = {
    kind: 'dim',
    id: newId(),
    name: names[g.mode ?? 'linear'],
    ax: g.ax,
    ay: g.ay,
    bx: g.bx,
    by: g.by,
    off: OFFSET,
    ppi: useMeasureOpts.getState().ppi,
    style,
  };
  if (g.mode) dim.mode = g.mode;
  if (g.vx !== undefined) {
    dim.vx = g.vx;
    dim.vy = g.vy;
  }
  return dim;
}

let start: Pt | null = null;
/** Clicks collected for an angular dimension: vertex, then the two arms. */
let angPts: Pt[] = [];
/** Dragging the offset of a selected dimension. */
let offDrag: { id: string; started: boolean } | null = null;

const end = (ctx: ToolCtx) => {
  start = null;
  angPts = [];
  offDrag = null;
  ctx?.setPreview(null);
  setGuides([]);
};

/** A selected dimension whose label is near the point. */
function dimNearLabel(p: Pt, k: number): VDim | null {
  for (const it of selectedItems()) {
    if (it.kind !== 'dim') continue;
    const g = dimGeom(it);
    if (Math.hypot((g.a.x + g.b.x) / 2 - p.x, (g.a.y + g.b.y) / 2 - p.y) * k < 26) return it;
  }
  return null;
}

export const dimensionTool: VToolDef = {
  id: 'dimension',
  title: 'Dimension',
  key: 'shift+d',
  icon: 'M3,6 V14 M17,6 V14 M3,10 H17 M3,10 L6,8 M3,10 L6,12 M17,10 L14,8 M17,10 L14,12',
  help: 'Pick a mode in the bar. Linear, radius and diameter: drag between two points (radius and diameter go from the center to the rim). Angular: click the vertex, then each arm. Shift for 45 degree steps.',
  group: 'measure',
  cursor: 'crosshair',
  down(e, _hit, ctx) {
    const d = dimNearLabel({ x: e.rx, y: e.ry }, ctx.k);
    if (d) {
      offDrag = { id: d.id, started: false };
      return;
    }
    if (useMeasureOpts.getState().dimMode === 'angular') {
      angPts.push({ x: e.x, y: e.y });
      if (angPts.length === 3) {
        const [v, a, b] = angPts;
        angPts = [];
        ctx.setPreview(null);
        if (Math.hypot(a.x - v.x, a.y - v.y) * ctx.k < 4 || Math.hypot(b.x - v.x, b.y - v.y) * ctx.k < 4) return;
        addItems([makeDim({ ax: a.x, ay: a.y, bx: b.x, by: b.y, mode: 'angular', vx: v.x, vy: v.y })]);
      }
      return;
    }
    start = { x: e.x, y: e.y };
  },
  move(e, ctx) {
    if (!offDrag && angPts.length) {
      const R = RED, k = ctx.k;
      const pts = [...angPts, { x: e.x, y: e.y }];
      const v = pts[0];
      ctx.setPreview(
        h(
          'g',
          null,
          ...pts.slice(1).map((p, i) => h('path', { key: i, d: `M${v.x},${v.y} L${p.x},${p.y}`, stroke: R, strokeWidth: 1.2 / k, fill: 'none', strokeDasharray: `${4 / k} ${3 / k}` })),
          ...pts.map((p, i) => h('circle', { key: 'c' + i, cx: p.x, cy: p.y, r: 3 / k, fill: R })),
        ),
      );
      return;
    }
    if (offDrag) {
      const id = offDrag.id;
      if (!offDrag.started) {
        offDrag.started = true;
        vs().checkpoint();
      }
      vs().vedit((v) => {
        const f = findItem(v as VectorDoc, id);
        if (f?.item.kind !== 'dim') return;
        const g = f.item;
        const dx = g.bx - g.ax, dy = g.by - g.ay;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        g.off = Math.round(((e.rx - g.ax) * nx + (e.ry - g.ay) * ny) * 10) / 10;
      });
      return;
    }
    if (!start) return;
    const b = endPoint(start, e);
    const mode = useMeasureOpts.getState().dimMode;
    const ppi = useMeasureOpts.getState().ppi;
    const r = label(start, b, ctx.k, ppi, false);
    if (mode === 'linear') ctx.setPreview(r.node);
    else {
      const len = Math.hypot(b.x - start.x, b.y - start.y) / ppi;
      const txt = mode === 'radius' ? `R ${fmtIn(len)}` : `\u00D8 ${fmtIn(len * 2)}`;
      ctx.setPreview(h('g', null, r.node, h('text', { x: b.x + 10 / ctx.k, y: b.y + 14 / ctx.k, fontSize: 11 / ctx.k, fill: RED, fontFamily: 'IBM Plex Mono, monospace' }, txt)));
    }
  },
  up(e, ctx) {
    if (offDrag) {
      end(ctx);
      return;
    }
    if (!start) return;
    const a = start, b = endPoint(start, e);
    end(ctx);
    if (Math.hypot(b.x - a.x, b.y - a.y) * ctx.k < 4) return;
    const mode = useMeasureOpts.getState().dimMode;
    addItems([makeDim({ ax: a.x, ay: a.y, bx: b.x, by: b.y, mode: mode === 'linear' ? undefined : mode })]);
  },
  cancel: end,
  options: () => h(DimOpts),
};

// ---------- Measure ----------

let mStart: Pt | null = null;

export const measureTool: VToolDef = {
  id: 'measure',
  title: 'Measure',
  icon: 'M3,13 L13,3 L17,7 L7,17 Z M6,10 L8,12 M8,8 L10,10 M10,6 L12,8',
  help: 'Drag to read a distance and angle. Nothing is added to the document.',
  group: 'measure',
  cursor: 'crosshair',
  down(e) {
    mStart = { x: e.x, y: e.y };
  },
  move(e, ctx) {
    if (!mStart) return;
    const b = endPoint(mStart, e);
    const r = label(mStart, b, ctx.k, useMeasureOpts.getState().ppi, true);
    useMeasureOpts.getState().set({ readout: r.txt });
    ctx.setPreview(r.node);
  },
  up(_e, ctx) {
    mStart = null;
    // leave the last reading on screen until the next action
    void ctx;
  },
  cancel(ctx) {
    mStart = null;
    ctx?.setPreview(null);
    setGuides([]);
  },
  options: () => h(MeasureOpts),
};

export const measureTools: VToolDef[] = [dimensionTool, measureTool];
