// Rectangle (M), Ellipse (L), Line Segment (\).
import { createElement as h } from 'react';
import { corner, ellipseSub, makePath, rectSub, subD, type VStyle, type VSub } from '../../model/vector';
import { addItems, vs } from '../edit';
import { constrain45, setGuides } from '../snap';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

type Pt = { x: number; y: number };

/** Box from a drag: Shift makes it square, Alt draws from the center. */
export function dragBox(a: Pt, e: PtrEvt) {
  let w = e.x - a.x, hh = e.y - a.y;
  if (e.shift) {
    const s = Math.max(Math.abs(w), Math.abs(hh));
    w = Math.sign(w || 1) * s;
    hh = Math.sign(hh || 1) * s;
  }
  if (e.alt) return { x: a.x - w, y: a.y - hh, w: w * 2, h: hh * 2 };
  return { x: a.x, y: a.y, w, h: hh };
}

export const previewProps = (k: number) => ({ fill: 'none', stroke: '#4F8DF7', strokeWidth: 1 / k });

/** Build a drag-to-draw shape tool from a function that turns the dragged box into a sub path. */
export function boxShapeTool(def: Omit<VToolDef, 'down' | 'move' | 'up' | 'cancel'> & {
  build: (b: { x: number; y: number; w: number; h: number }, e: PtrEvt) => VSub[];
  styleOf?: (s: VStyle) => VStyle;
  /** Size when the canvas is clicked instead of dragged. */
  clickSize?: number;
  name: string;
}): VToolDef {
  let start: Pt | null = null;
  let last: PtrEvt | null = null;
  const end = (ctx: ToolCtx) => {
    start = null;
    last = null;
    ctx.setPreview(null);
    setGuides([]);
  };
  return {
    ...def,
    down(e) {
      start = { x: e.x, y: e.y };
      last = e;
    },
    move(e, ctx) {
      if (!start) return;
      last = e;
      const b = dragBox(start, e);
      ctx.setPreview(h('path', { d: def.build(b, e).map(subD).join(' '), ...previewProps(ctx.k) }));
    },
    up(e, ctx) {
      if (!start) return;
      let b = dragBox(start, last ?? e);
      if (Math.abs(b.w) * ctx.k < 3 && Math.abs(b.h) * ctx.k < 3) {
        const s = def.clickSize ?? 60;
        b = { x: start.x - s / 2, y: start.y - s / 2, w: s, h: s };
      }
      const style = structuredClone(vs().vstyle);
      addItems([makePath(def.build(b, last ?? e), def.styleOf ? def.styleOf(style) : style, def.name)]);
      end(ctx);
    },
    cancel: end,
  };
}

export const rectTool = boxShapeTool({
  id: 'rect',
  title: 'Rectangle',
  key: 'm',
  icon: 'M3,5 H17 V15 H3 Z',
  help: 'Drag to draw. Shift for a square, Alt to draw from the center. Click for a 60 unit square.',
  group: 'shape',
  cursor: 'crosshair',
  name: 'Rectangle',
  build: (b) => [rectSub(b.x, b.y, b.w, b.h)],
});

export const ellipseTool = boxShapeTool({
  id: 'ellipse',
  title: 'Ellipse',
  key: 'l',
  icon: 'M10,10 m-7,0 a7,5 0 1,0 14,0 a7,5 0 1,0 -14,0',
  help: 'Drag to draw. Shift for a circle, Alt to draw from the center.',
  group: 'shape',
  cursor: 'crosshair',
  name: 'Ellipse',
  build: (b) => [ellipseSub(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2)],
});

let lineStart: Pt | null = null;
export const lineTool: VToolDef = {
  id: 'line',
  title: 'Line Segment',
  key: '\\',
  icon: 'M4,16 L16,4',
  help: 'Drag to draw a straight line. Shift for 45 degree steps, Alt to draw from the center.',
  group: 'shape',
  cursor: 'crosshair',
  down(e) {
    lineStart = { x: e.x, y: e.y };
  },
  move(e, ctx) {
    if (!lineStart) return;
    const [a, b] = lineEnds(lineStart, e);
    ctx.setPreview(h('path', { d: `M${a.x},${a.y} L${b.x},${b.y}`, ...previewProps(ctx.k) }));
  },
  up(e, ctx) {
    if (!lineStart) return;
    const [a, b] = lineEnds(lineStart, e);
    lineStart = null;
    ctx.setPreview(null);
    setGuides([]);
    if (Math.hypot(b.x - a.x, b.y - a.y) * ctx.k < 3) return;
    const style = structuredClone(vs().vstyle);
    style.fill = null;
    style.stroke ??= { kind: 'solid', color: '#141414' };
    addItems([makePath([{ closed: false, nodes: [corner(a.x, a.y), corner(b.x, b.y)] }], style, 'Line')]);
  },
  cancel(ctx) {
    lineStart = null;
    ctx.setPreview(null);
  },
};
function lineEnds(a: Pt, e: PtrEvt): [Pt, Pt] {
  let b = { x: e.x, y: e.y };
  if (e.shift) b = constrain45(a, b);
  if (e.alt) return [{ x: 2 * a.x - b.x, y: 2 * a.y - b.y }, b];
  return [a, b];
}

export const shapeTools: VToolDef[] = [rectTool, ellipseTool, lineTool];
