// Pen (P): click for corners, drag for curves, click the first anchor to close.
import { createElement as h } from 'react';
import { corner, findItem, makePath, type VectorDoc, type VNode, type VPath } from '../../model/vector';
import { addItems, vdoc, vs } from '../edit';
import { constrain45, setGuides } from '../snap';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

/** The open path being drawn. */
let cur: { id: string; s: number } | null = null;
/** Anchor being dragged out into a curve. */
let drag: { i: number; closing: boolean } | null = null;

function curPath(): VPath | null {
  if (!cur) return null;
  const f = findItem(vdoc(), cur.id);
  if (f?.item.kind !== 'path' || !f.item.subs[cur.s] || f.item.subs[cur.s].closed) {
    cur = null;
    return null;
  }
  return f.item;
}

export function endPen(ctx?: ToolCtx) {
  cur = null;
  drag = null;
  ctx?.setPreview(null);
  setGuides([]);
}

function rubber(e: PtrEvt, ctx: ToolCtx) {
  const p = curPath();
  if (!p || drag) return;
  const ns = p.subs[cur!.s].nodes;
  const a = ns[ns.length - 1];
  let q = { x: e.x, y: e.y };
  if (e.shift) q = constrain45(a, q);
  ctx.setPreview(
    h('path', {
      d: `M${a.x},${a.y} C${a.ox},${a.oy} ${q.x},${q.y} ${q.x},${q.y}`,
      fill: 'none',
      stroke: '#4F8DF7',
      strokeWidth: 1 / ctx.k,
    }),
  );
}

export const penTool: VToolDef = {
  id: 'pen',
  title: 'Pen',
  key: 'p',
  icon: 'M10,3 L15,12 L10,17 L5,12 Z M10,3 V10 M10,11 m-1,0 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0',
  help: 'Click for corners, drag for curves. Click the first anchor to close. Click an open end to keep drawing it. Enter or Esc to finish. Alt drag for a sharp curve.',
  group: 'draw',
  decor: 'nodes',
  cursor: 'crosshair',
  down(e, hit, ctx) {
    const st = vs();
    const p = curPath();
    // close on the first anchor
    if (p && hit?.kind === 'node' && hit.id === cur!.id && hit.s === cur!.s) {
      const ns = p.subs[cur!.s].nodes;
      if (hit.i === 0 && ns.length >= 2) {
        st.vstep((v) => {
          const f = findItem(v as VectorDoc, cur!.id);
          if (f?.item.kind === 'path') f.item.subs[cur!.s].closed = true;
        });
        drag = { i: 0, closing: true };
        return;
      }
      if (hit.i === ns.length - 1) {
        // click the last anchor: drop its out handle so the next segment starts straight
        st.vstep((v) => {
          const f = findItem(v as VectorDoc, cur!.id);
          if (f?.item.kind !== 'path') return;
          const n = f.item.subs[cur!.s].nodes[hit.i];
          n.ox = n.x;
          n.oy = n.y;
          n.smooth = false;
        });
        return;
      }
    }
    // continue an open path from one of its ends
    if (!p && hit?.kind === 'node') {
      const f = findItem(vdoc(), hit.id);
      const sub = f?.item.kind === 'path' ? f.item.subs[hit.s] : null;
      if (sub && !sub.closed && (hit.i === 0 || hit.i === sub.nodes.length - 1)) {
        if (hit.i === 0 && sub.nodes.length > 1) {
          st.vstep((v) => {
            const g = findItem(v as VectorDoc, hit.id);
            if (g?.item.kind !== 'path') return;
            const s = g.item.subs[hit.s];
            s.nodes.reverse();
            for (const n of s.nodes) [n.ix, n.iy, n.ox, n.oy] = [n.ox, n.oy, n.ix, n.iy];
          });
        }
        cur = { id: hit.id, s: hit.s };
        st.setVSel([hit.id]);
        st.setVNodes([]);
        return;
      }
    }
    if (!p) {
      const style = structuredClone(st.vstyle);
      const path = makePath([{ closed: false, nodes: [corner(e.x, e.y)] }], style, 'Path');
      addItems([path]);
      cur = { id: path.id, s: 0 };
      drag = { i: 0, closing: false };
      return;
    }
    const ns = p.subs[cur!.s].nodes;
    let q = { x: e.x, y: e.y };
    if (e.shift) q = constrain45(ns[ns.length - 1], q);
    st.vstep((v) => {
      const f = findItem(v as VectorDoc, cur!.id);
      if (f?.item.kind === 'path') f.item.subs[cur!.s].nodes.push(corner(q.x, q.y));
    });
    drag = { i: ns.length, closing: false };
    ctx.setPreview(null);
  },
  move(e, ctx) {
    if (!drag || !cur) return;
    const c = cur, d = drag;
    vs().vedit((v) => {
      const f = findItem(v as VectorDoc, c.id);
      if (f?.item.kind !== 'path') return;
      const n: VNode = f.item.subs[c.s].nodes[d.i];
      if (!n) return;
      let q = { x: e.x, y: e.y };
      if (e.shift) q = constrain45(n, q);
      if (Math.hypot(q.x - n.x, q.y - n.y) * ctx.k < 2) return;
      if (d.closing) {
        // dragging on the first anchor shapes the closing curve
        n.ix = 2 * n.x - q.x;
        n.iy = 2 * n.y - q.y;
        if (!e.alt) {
          n.ox = q.x;
          n.oy = q.y;
          n.smooth = true;
        }
        return;
      }
      n.ox = q.x;
      n.oy = q.y;
      if (!e.alt) {
        n.ix = 2 * n.x - q.x;
        n.iy = 2 * n.y - q.y;
        n.smooth = true;
      } else n.smooth = false;
    });
  },
  up(_e, ctx) {
    if (drag?.closing) endPen(ctx);
    drag = null;
  },
  hover: (e, _hit, ctx) => rubber(e, ctx),
  cancel: (ctx) => endPen(ctx),
  keydown(e, ctx) {
    if (!cur) return false;
    if (e.key === 'Enter' || e.key === 'Escape') {
      endPen(ctx);
      return true;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const c = cur;
      const p = curPath();
      if (!p) return false;
      const ns = p.subs[c.s].nodes;
      vs().vstep((v) => {
        const f = findItem(v as VectorDoc, c.id);
        if (f?.item.kind !== 'path') return;
        f.item.subs[c.s].nodes.pop();
      });
      if (ns.length <= 1) {
        vs().vstep((v) => {
          const f = findItem(v as VectorDoc, c.id);
          if (f) f.list.splice(f.index, 1);
        });
        endPen(ctx);
      }
      return true;
    }
    return false;
  },
};

export const penTools: VToolDef[] = [penTool];
