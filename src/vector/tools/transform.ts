// Rotate (R), Reflect (O), Scale (S) and Shear. Click sets the reference point, drag transforms.
import { createElement as h } from 'react';
import { rotateAt, scaleAt, type Mat } from '../../model/vector';
import { constrain45, setGuides } from '../snap';
import { XfOpts } from './t_opts';
import { applySession, beginSession, endSession, getRef, reflectMat, refPoint, setRef } from './t_common';
import type { Pt } from './t_geom';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

const deg = (rad: number) => (rad * 180) / Math.PI;

export type XfKind = 'rotate' | 'reflect' | 'scale' | 'shear';

/** Matrix for a drag from s to p around o. */
function dragMat(kind: XfKind, o: Pt, s: Pt, p: Pt, shift: boolean): Mat | null {
  if (kind === 'rotate') {
    let a = deg(Math.atan2(p.y - o.y, p.x - o.x) - Math.atan2(s.y - o.y, s.x - o.x));
    if (shift) a = Math.round(a / 45) * 45;
    return rotateAt(a, o.x, o.y);
  }
  if (kind === 'reflect') {
    let a = deg(Math.atan2(p.y - o.y, p.x - o.x));
    if (shift) a = Math.round(a / 45) * 45;
    return reflectMat(a, o);
  }
  if (kind === 'scale') {
    const ds = Math.hypot(s.x - o.x, s.y - o.y);
    if (ds < 2) return null;
    let sx: number, sy: number;
    if (shift) sx = sy = Math.hypot(p.x - o.x, p.y - o.y) / ds;
    else {
      sx = Math.abs(s.x - o.x) < 2 ? 1 : (p.x - o.x) / (s.x - o.x);
      sy = Math.abs(s.y - o.y) < 2 ? 1 : (p.y - o.y) / (s.y - o.y);
    }
    const fix = (v: number) => (Math.abs(v) < 0.01 ? 0.01 * Math.sign(v || 1) : v);
    return scaleAt(fix(sx), fix(sy), o.x, o.y);
  }
  const dx = p.x - s.x, dy = p.y - s.y;
  if (Math.abs(dx) >= Math.abs(dy)) return [1, 0, dx / 100, 1, (-dx / 100) * o.y, 0];
  return [1, dy / 100, 0, 1, 0, (-dy / 100) * o.x];
}

function cross(o: Pt, k: number) {
  const r = 7 / k;
  return h(
    'g',
    { stroke: '#E5484D', strokeWidth: 1 / k, fill: 'none' },
    h('path', { d: `M${o.x - r},${o.y} H${o.x + r} M${o.x},${o.y - r} V${o.y + r}` }),
    h('circle', { cx: o.x, cy: o.y, r: r * 0.55 }),
  );
}

function makeTool(kind: XfKind, def: Pick<VToolDef, 'id' | 'title' | 'key' | 'icon' | 'help'>): VToolDef {
  let mode: { s: Pt; o: Pt | null; started: boolean } | null = null;
  const end = (ctx: ToolCtx) => {
    endSession();
    mode = null;
    ctx?.setPreview(null);
    setGuides([]);
  };
  return {
    ...def,
    group: 'transform',
    cursor: 'crosshair',
    down(e) {
      mode = { s: { x: e.x, y: e.y }, o: null, started: false };
    },
    move(e, ctx) {
      const m = mode;
      if (!m) return;
      if (!m.started) {
        if (Math.hypot(e.rx - m.s.x, e.ry - m.s.y) * ctx.k < 3) return;
        const o = refPoint();
        if (!o) {
          ctx.toast('Select something first');
          mode = null;
          return;
        }
        if (!beginSession(e.alt)) {
          mode = null;
          return;
        }
        m.o = o;
        m.started = true;
      }
      const o = m.o!;
      let p = { x: e.x, y: e.y };
      if (kind === 'shear' && e.shift) p = constrain45(m.s, p);
      const mat = dragMat(kind, o, m.s, p, e.shift);
      if (mat) applySession(mat);
      ctx.setPreview(
        h(
          'g',
          null,
          cross(o, ctx.k),
          h('path', { d: `M${o.x},${o.y} L${p.x},${p.y}`, stroke: '#E5484D', strokeWidth: 1 / ctx.k, strokeDasharray: `${4 / ctx.k} ${3 / ctx.k}`, fill: 'none' }),
        ),
      );
    },
    up(e, ctx) {
      const m = mode;
      if (m && !m.started) {
        setRef({ x: e.x, y: e.y });
        end(ctx);
        ctx.setPreview(cross(getRef()!, ctx.k));
        return;
      }
      end(ctx);
      const o = refPoint();
      if (o) ctx.setPreview(cross(o, ctx.k));
    },
    hover(_e: PtrEvt, _hit, ctx) {
      const o = refPoint();
      ctx.setPreview(o ? cross(o, ctx.k) : null);
    },
    cancel(ctx) {
      end(ctx);
      setRef(null);
    },
    options: () => h(XfOpts, { kind }),
  };
}

export const rotateTool = makeTool('rotate', {
  id: 'rotate',
  title: 'Rotate',
  key: 'r',
  icon: 'M15.5,10 A5.5,5.5 0 1,1 10,4.5 M10,2 L12.5,4.5 L10,7',
  help: 'Click to set the center, drag to rotate. Shift for 45 degree steps, Alt drag to rotate a copy.',
});
export const reflectTool = makeTool('reflect', {
  id: 'reflect',
  title: 'Reflect',
  key: 'o',
  icon: 'M10,3 V17 M7,6 L3,14 H7 Z M13,6 L17,14 H13 Z',
  help: 'Click to set a point on the axis, drag to aim the axis. Shift for 45 degree steps, Alt drag to reflect a copy.',
});
export const scaleTool = makeTool('scale', {
  id: 'scale',
  title: 'Scale',
  key: 's',
  icon: 'M4,16 V8 H12 V16 Z M12,8 L17,3 M13,3 H17 V7',
  help: 'Click to set the center, drag to scale. Shift scales evenly, Alt drag to scale a copy.',
});
export const shearTool = makeTool('shear', {
  id: 'shear',
  title: 'Shear',
  icon: 'M6,15 H14 L17,6 H9 Z',
  help: 'Click to set the center, drag sideways to slant, up or down to slant the other way. Alt drag to shear a copy.',
});

export const transformTools: VToolDef[] = [rotateTool, reflectTool, scaleTool, shearTool];
