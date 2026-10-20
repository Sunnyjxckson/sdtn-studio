// Rounded Rectangle, Polygon and Star.
import { createElement as h } from 'react';
import { makePath, polygonSub, rectSub, starSub, subD, type VSub } from '../../model/vector';
import { addItems, vs } from '../edit';
import { setGuides } from '../snap';
import { boxShapeTool, previewProps } from './shapes';
import { RoundRectOpts, PolygonOpts, StarOpts } from './t_opts';
import { useShapeOpts } from './t_state';
import type { Pt } from './t_geom';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

// ---------- Rounded Rectangle ----------

const roundBase = boxShapeTool({
  id: 'roundrect',
  title: 'Rounded Rectangle',
  icon: 'M5,5 H15 Q17,5 17,7 V13 Q17,15 15,15 H5 Q3,15 3,13 V7 Q3,5 5,5 Z',
  help: 'Drag to draw. Shift for a square, Alt to draw from the center. Up and Down arrow keys change the corner radius while dragging.',
  group: 'shape',
  cursor: 'crosshair',
  name: 'Rounded Rectangle',
  build: (b) => [rectSub(b.x, b.y, b.w, b.h, useShapeOpts.getState().radius)],
  options: () => h(RoundRectOpts),
});

let roundDrag = false;
let roundLast: PtrEvt | null = null;

export const roundRectTool: VToolDef = {
  ...roundBase,
  down(e, hit, ctx) {
    roundDrag = true;
    roundLast = e;
    roundBase.down?.(e, hit, ctx);
  },
  move(e, ctx) {
    roundLast = e;
    roundBase.move?.(e, ctx);
  },
  up(e, ctx) {
    roundDrag = false;
    roundBase.up?.(e, ctx);
  },
  cancel(ctx) {
    roundDrag = false;
    if (ctx) roundBase.cancel?.(ctx);
  },
  keydown(e, ctx) {
    if (!roundDrag || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return false;
    const o = useShapeOpts.getState();
    o.set({ radius: Math.max(0, o.radius + (e.key === 'ArrowUp' ? 2 : -2)) });
    if (roundLast) roundBase.move?.(roundLast, ctx);
    return true;
  },
};

// ---------- Polygon and Star ----------

function radialTool(def: Omit<VToolDef, 'down' | 'move' | 'up' | 'cancel' | 'keydown'> & {
  name: string;
  build: (c: Pt, r: number, rot: number) => VSub;
  /** Up and Down arrows while dragging. */
  bump: (dir: number) => void;
}): VToolDef {
  let c: Pt | null = null;
  let last: PtrEvt | null = null;
  const calc = (e: PtrEvt) => {
    const dx = e.x - c!.x, dy = e.y - c!.y;
    return { r: Math.hypot(dx, dy), rot: e.shift ? 0 : Math.atan2(dy, dx) + Math.PI / 2 };
  };
  const show = (e: PtrEvt, ctx: ToolCtx) => {
    const { r, rot } = calc(e);
    ctx.setPreview(h('path', { d: subD(def.build(c!, r, rot)), ...previewProps(ctx.k) }));
  };
  const end = (ctx: ToolCtx) => {
    c = null;
    last = null;
    ctx?.setPreview(null);
    setGuides([]);
  };
  return {
    ...def,
    cursor: 'crosshair',
    down(e) {
      c = { x: e.x, y: e.y };
      last = e;
    },
    move(e, ctx) {
      if (!c) return;
      last = e;
      show(e, ctx);
    },
    up(e, ctx) {
      if (!c) return;
      let { r, rot } = calc(last ?? e);
      if (r * ctx.k < 3) {
        r = 40;
        rot = 0;
      }
      addItems([makePath([def.build(c, r, rot)], structuredClone(vs().vstyle), def.name)]);
      end(ctx);
    },
    cancel: end,
    keydown(e, ctx) {
      if (!c || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return false;
      def.bump(e.key === 'ArrowUp' ? 1 : -1);
      if (last) show(last, ctx);
      return true;
    },
  };
}

export const polygonTool = radialTool({
  id: 'polygon',
  title: 'Polygon',
  icon: 'M10,3 L16.5,8 L14,16 H6 L3.5,8 Z',
  help: 'Drag from the center. The drag sets size and rotation, Shift keeps it upright. Up and Down arrow keys change the sides.',
  group: 'shape',
  name: 'Polygon',
  build: (c, r, rot) => polygonSub(c.x, c.y, r, useShapeOpts.getState().sides, rot),
  bump: (d) => {
    const o = useShapeOpts.getState();
    o.set({ sides: Math.max(3, Math.min(60, o.sides + d)) });
  },
  options: () => h(PolygonOpts),
});

export const starTool = radialTool({
  id: 'star',
  title: 'Star',
  icon: 'M10,3 L12,8 L17,8.3 L13,11.7 L14.4,17 L10,14 L5.6,17 L7,11.7 L3,8.3 L8,8 Z',
  help: 'Drag from the center. The drag sets size and rotation, Shift keeps it upright. Up and Down arrow keys change the points.',
  group: 'shape',
  name: 'Star',
  build: (c, r, rot) => {
    const o = useShapeOpts.getState();
    return starSub(c.x, c.y, r, r * o.inner, o.points, rot);
  },
  bump: (d) => {
    const o = useShapeOpts.getState();
    o.set({ points: Math.max(3, Math.min(40, o.points + d)) });
  },
  options: () => h(StarOpts),
});

export const moreShapeTools: VToolDef[] = [roundRectTool, polygonTool, starTool];
