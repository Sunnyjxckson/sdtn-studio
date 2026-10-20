// Selection (V), Direct Selection (A), Hand (H) and Zoom (Z).
import { createElement as h } from 'react';
import type { Draft } from 'immer';
import {
  cloneItem,
  findItem,
  isEditable,
  itemBox,
  rotateAt,
  scaleAt,
  translate,
  walkItems,
  type Box,
  type VectorDoc,
  type VItem,
  type VNode,
  type VPath,
} from '../../model/vector';
import type { NodeRef } from '../../store';
import { applyTransform, beginTransform, endTransform, selectionBox, vdoc, vs } from '../edit';
import { constrain45, setGuides } from '../snap';
import { zoomAtClient } from '../view';
import type { BoxHandle, Hit, PtrEvt, ToolCtx, VToolDef } from './types';

type Pt = { x: number; y: number };

type Mode =
  | { t: 'move'; start: Pt; started: boolean; dup: boolean }
  | { t: 'scale'; h: BoxHandle; box: Box; started: boolean }
  | { t: 'rotate'; c: Pt; a0: number; started: boolean }
  | { t: 'marquee'; start: Pt; add: boolean; nodes: boolean }
  | { t: 'nodes'; start: Pt; started: boolean; orig: Map<string, VPath> }
  | { t: 'handle'; ref: NodeRef; side: 'in' | 'out'; started: boolean };

let mode: Mode | null = null;

const MOVE_EPS = 2;

export function marqueeRect(a: Pt, b: Pt) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export function marqueePreview(a: Pt, b: Pt, k: number) {
  const r = marqueeRect(a, b);
  return h('rect', { ...r, fill: 'rgba(79,141,247,0.08)', stroke: '#4F8DF7', strokeWidth: 1 / k, strokeDasharray: `${4 / k} ${3 / k}` });
}

const overlaps = (a: Box, b: Box) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** Top level items whose box touches the rectangle. */
function itemsInRect(r: Box): string[] {
  const v = vdoc();
  const out: string[] = [];
  for (const l of v.layers) {
    if (!l.visible || l.locked) continue;
    for (const it of l.items) {
      if (it.hidden || it.locked) continue;
      const b = itemBox(it);
      if (b && overlaps(r, { x: b.x, y: b.y, w: Math.max(b.w, 0.01), h: Math.max(b.h, 0.01) })) out.push(it.id);
    }
  }
  return out;
}

/** Duplicate the selection in place (Alt drag), selecting the copies. */
function duplicateInPlace() {
  const st = vs();
  const v0 = vdoc();
  const copies: { after: string; item: VItem }[] = [];
  for (const id of st.vsel) {
    const f = findItem(v0, id);
    if (f && isEditable(f)) copies.push({ after: id, item: cloneItem(f.item) });
  }
  st.vedit((v) => {
    for (const c of copies) {
      const f = findItem(v as VectorDoc, c.after);
      if (f) (f.list as VItem[]).splice(f.index + 1, 0, c.item);
    }
  });
  st.setVSel(copies.map((c) => c.item.id));
}

const handlePos = (b: Box, hh: BoxHandle): Pt => ({
  x: hh.includes('w') ? b.x : hh.includes('e') ? b.x + b.w : b.x + b.w / 2,
  y: hh.includes('n') ? b.y : hh.includes('s') ? b.y + b.h : b.y + b.h / 2,
});
const opposite: Record<BoxHandle, BoxHandle> = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };

/** Shared by Selection and Direct Selection: scale, rotate and move the selection. */
function startBoxModes(e: PtrEvt, hit: Hit): boolean {
  if (hit?.kind === 'box') {
    const b = selectionBox();
    if (b) mode = { t: 'scale', h: hit.h, box: b, started: false };
    return true;
  }
  if (hit?.kind === 'rotate') {
    const b = selectionBox();
    if (b) {
      const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      mode = { t: 'rotate', c, a0: Math.atan2(e.ry - c.y, e.rx - c.x), started: false };
    }
    return true;
  }
  return false;
}

function moveBoxModes(e: PtrEvt, ctx: ToolCtx): boolean {
  const m = mode;
  if (!m) return false;
  if (m.t === 'move') {
    let p = { x: e.x, y: e.y };
    if (e.shift) p = constrain45(m.start, p);
    const dx = p.x - m.start.x, dy = p.y - m.start.y;
    if (!m.started) {
      if (Math.hypot(e.rx - m.start.x, e.ry - m.start.y) * ctx.k < MOVE_EPS) return true;
      m.started = true;
      beginTransform();
      if (m.dup) {
        duplicateInPlace();
        beginTransform(undefined, false);
      }
    }
    applyTransform(translate(dx, dy));
    return true;
  }
  if (m.t === 'scale') {
    if (!m.started) {
      m.started = true;
      beginTransform();
    }
    const b = m.box;
    const anchor = e.alt ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : handlePos(b, opposite[m.h]);
    const from = handlePos(b, m.h);
    const ex = from.x - anchor.x, ey = from.y - anchor.y;
    let sx = m.h === 'n' || m.h === 's' || Math.abs(ex) < 1e-6 ? 1 : (e.x - anchor.x) / ex;
    let sy = m.h === 'e' || m.h === 'w' || Math.abs(ey) < 1e-6 ? 1 : (e.y - anchor.y) / ey;
    if (e.shift) {
      if (m.h.length === 2) {
        const s = Math.abs(sx) > Math.abs(sy) ? sx : sy;
        sx = Math.sign(sx || 1) * Math.abs(s);
        sy = Math.sign(sy || 1) * Math.abs(s);
      } else if (m.h === 'n' || m.h === 's') sx = Math.abs(sy);
      else sy = Math.abs(sx);
    }
    const min = 0.01;
    if (Math.abs(sx) < min) sx = min * Math.sign(sx || 1);
    if (Math.abs(sy) < min) sy = min * Math.sign(sy || 1);
    applyTransform(scaleAt(sx, sy, anchor.x, anchor.y));
    return true;
  }
  if (m.t === 'rotate') {
    if (!m.started) {
      m.started = true;
      beginTransform();
    }
    let a = ((Math.atan2(e.ry - m.c.y, e.rx - m.c.x) - m.a0) * 180) / Math.PI;
    if (e.shift) a = Math.round(a / 15) * 15;
    applyTransform(rotateAt(a, m.c.x, m.c.y));
    ctx.setPreview(
      h('text', { x: e.rx + 12 / ctx.k, y: e.ry - 12 / ctx.k, fontSize: 11 / ctx.k, fill: '#4F8DF7', fontFamily: 'IBM Plex Mono, monospace' }, `${Math.round(a)}°`),
    );
    return true;
  }
  return false;
}

function endModes(ctx: ToolCtx) {
  endTransform();
  mode = null;
  ctx.setPreview(null);
  setGuides([]);
}

export const selectTool: VToolDef = {
  id: 'select',
  title: 'Selection',
  key: 'v',
  icon: 'M5,3 L15,11 L10,12 L8,17 Z',
  help: 'Click to select, Shift click to add. Drag to move, Alt drag to copy. Drag the box handles to scale, just outside the corners to rotate.',
  group: 'select',
  decor: 'box',
  down(e, hit, ctx) {
    if (startBoxModes(e, hit)) return;
    const st = vs();
    if (hit?.kind === 'item' || hit?.kind === 'node' || hit?.kind === 'handle') {
      const id = hit.kind === 'item' ? hit.top : findItem(vdoc(), hit.id)?.top.id ?? hit.id;
      if (e.shift) {
        if (st.vsel.includes(id)) {
          st.setVSel(st.vsel.filter((x) => x !== id));
          return;
        }
        st.setVSel([...st.vsel, id]);
      } else if (!st.vsel.includes(id)) st.setVSel([id]);
      mode = { t: 'move', start: { x: e.x, y: e.y }, started: false, dup: e.alt };
      return;
    }
    if (!e.shift) st.setVSel([]);
    mode = { t: 'marquee', start: { x: e.rx, y: e.ry }, add: e.shift, nodes: false };
    void ctx;
  },
  move(e, ctx) {
    if (moveBoxModes(e, ctx)) return;
    if (mode?.t === 'marquee') ctx.setPreview(marqueePreview(mode.start, { x: e.rx, y: e.ry }, ctx.k));
  },
  up(e, ctx) {
    if (mode?.t === 'marquee') {
      const r = marqueeRect(mode.start, { x: e.rx, y: e.ry });
      if (r.w * ctx.k > 2 || r.h * ctx.k > 2) {
        const ids = itemsInRect(r);
        const st = vs();
        st.setVSel(mode.add ? [...new Set([...st.vsel, ...ids])] : ids);
      }
    }
    endModes(ctx);
  },
  cancel: endModes,
};

// ---------- Direct Selection ----------

const nodeKey = (n: NodeRef) => `${n.id}:${n.s}:${n.i}`;

function moveNode(n: Draft<VNode> | VNode, o: VNode, dx: number, dy: number) {
  n.x = o.x + dx; n.y = o.y + dy;
  n.ix = o.ix + dx; n.iy = o.iy + dy;
  n.ox = o.ox + dx; n.oy = o.oy + dy;
}

/** Anchors inside a rectangle, across every editable path. */
function nodesInRect(r: Box): NodeRef[] {
  const out: NodeRef[] = [];
  const v = vdoc();
  walkItems(v, (it) => {
    if (it.kind !== 'path') return;
    const f = findItem(v, it.id);
    if (!f || !isEditable(f)) return;
    it.subs.forEach((s, si) =>
      s.nodes.forEach((n, i) => {
        if (n.x >= r.x && n.x <= r.x + r.w && n.y >= r.y && n.y <= r.y + r.h) out.push({ id: it.id, s: si, i });
      }),
    );
  });
  return out;
}

export const directTool: VToolDef = {
  id: 'direct',
  title: 'Direct Selection',
  key: 'a',
  icon: 'M5,3 L15,11 L10,12 L8,17 Z M13,14 h4 v4 h-4 Z',
  help: 'Click an anchor or a path. Drag anchors and handles to reshape. Alt drag a handle to break a smooth point. Drag empty canvas to select anchors.',
  group: 'select',
  decor: 'nodes',
  down(e, hit, ctx) {
    const st = vs();
    if (hit?.kind === 'node') {
      const ref = { id: hit.id, s: hit.s, i: hit.i };
      const on = st.vnodes.some((n) => nodeKey(n) === nodeKey(ref));
      if (!st.vsel.includes(hit.id)) st.setVSel(e.shift ? [...st.vsel, hit.id] : [hit.id]);
      if (e.shift) {
        st.setVNodes(on ? st.vnodes.filter((n) => nodeKey(n) !== nodeKey(ref)) : [...vs().vnodes, ref]);
        if (on) return;
      } else if (!on) st.setVNodes([ref]);
      mode = { t: 'nodes', start: { x: e.x, y: e.y }, started: false, orig: new Map() };
      return;
    }
    if (hit?.kind === 'handle') {
      mode = { t: 'handle', ref: { id: hit.id, s: hit.s, i: hit.i }, side: hit.side, started: false };
      return;
    }
    if (hit?.kind === 'item') {
      if (e.shift) {
        if (st.vsel.includes(hit.id)) {
          st.setVSel(st.vsel.filter((x) => x !== hit.id));
          return;
        }
        st.setVSel([...st.vsel, hit.id]);
      } else if (!st.vsel.includes(hit.id)) st.setVSel([hit.id]);
      st.setVNodes([]);
      mode = { t: 'move', start: { x: e.x, y: e.y }, started: false, dup: e.alt };
      return;
    }
    if (!e.shift) {
      st.setVSel([]);
      st.setVNodes([]);
    }
    mode = { t: 'marquee', start: { x: e.rx, y: e.ry }, add: e.shift, nodes: true };
    void ctx;
  },
  move(e, ctx) {
    if (moveBoxModes(e, ctx)) return;
    const m = mode;
    if (!m) return;
    if (m.t === 'marquee') {
      ctx.setPreview(marqueePreview(m.start, { x: e.rx, y: e.ry }, ctx.k));
      return;
    }
    if (m.t === 'nodes') {
      const p = e.shift ? constrain45(m.start, { x: e.x, y: e.y }) : { x: e.x, y: e.y };
      if (!m.started) {
        if (Math.hypot(e.rx - m.start.x, e.ry - m.start.y) * ctx.k < MOVE_EPS) return;
        m.started = true;
        vs().checkpoint();
        const v = vdoc();
        for (const n of vs().vnodes) {
          const f = findItem(v, n.id);
          if (f?.item.kind === 'path' && !m.orig.has(n.id)) m.orig.set(n.id, structuredClone(f.item));
        }
      }
      const dx = p.x - m.start.x, dy = p.y - m.start.y;
      const refs = vs().vnodes;
      vs().vedit((v) => {
        for (const r of refs) {
          const f = findItem(v as VectorDoc, r.id);
          const o = m.orig.get(r.id);
          if (f?.item.kind !== 'path' || !o) continue;
          const n = f.item.subs[r.s]?.nodes[r.i];
          const on = o.subs[r.s]?.nodes[r.i];
          if (n && on) moveNode(n, on, dx, dy);
        }
      });
      return;
    }
    if (m.t === 'handle') {
      if (!m.started) {
        m.started = true;
        vs().checkpoint();
      }
      const r = m.ref;
      vs().vedit((v) => {
        const f = findItem(v as VectorDoc, r.id);
        if (f?.item.kind !== 'path') return;
        const n = f.item.subs[r.s]?.nodes[r.i];
        if (!n) return;
        if (m.side === 'in') {
          n.ix = e.x;
          n.iy = e.y;
        } else {
          n.ox = e.x;
          n.oy = e.y;
        }
        if (e.alt) n.smooth = false;
        if (n.smooth) {
          // keep the other handle in line, at its own length
          const [ax, ay, bx, by] = m.side === 'in' ? [n.ix, n.iy, n.ox, n.oy] : [n.ox, n.oy, n.ix, n.iy];
          const len = Math.hypot(bx - n.x, by - n.y);
          const dl = Math.hypot(ax - n.x, ay - n.y) || 1;
          const ux = (n.x - ax) / dl, uy = (n.y - ay) / dl;
          if (len > 0.01) {
            if (m.side === 'in') {
              n.ox = n.x + ux * len;
              n.oy = n.y + uy * len;
            } else {
              n.ix = n.x + ux * len;
              n.iy = n.y + uy * len;
            }
          }
        }
      });
    }
  },
  up(e, ctx) {
    const m = mode;
    if (m?.t === 'marquee') {
      const r = marqueeRect(m.start, { x: e.rx, y: e.ry });
      if (r.w * ctx.k > 2 || r.h * ctx.k > 2) {
        const found = nodesInRect(r);
        const st = vs();
        const nodes = m.add ? [...st.vnodes, ...found.filter((f) => !st.vnodes.some((n) => nodeKey(n) === nodeKey(f)))] : found;
        const ids = [...new Set([...(m.add ? st.vsel : []), ...nodes.map((n) => n.id)])];
        st.setVSel(ids);
        st.setVNodes(nodes);
      }
    }
    endModes(ctx);
  },
  cancel: endModes,
};

// ---------- view tools ----------

export const handTool: VToolDef = {
  id: 'hand',
  title: 'Hand',
  key: 'h',
  icon: 'M10,3 V17 M3,10 H17 M10,3 L8,5 M10,3 L12,5 M10,17 L8,15 M10,17 L12,15 M3,10 L5,8 M3,10 L5,12 M17,10 L15,8 M17,10 L15,12',
  help: 'Drag to pan. Hold Space with any tool to pan.',
  group: 'view',
  decor: 'none',
  cursor: 'grab',
};

export const zoomTool: VToolDef = {
  id: 'zoom',
  title: 'Zoom',
  key: 'z',
  icon: 'M8.5,8.5 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0 M12.5,12.5 L17,17 M6,8.5 H11 M8.5,6 V11',
  help: 'Click to zoom in, Alt click to zoom out.',
  group: 'view',
  decor: 'none',
  cursor: 'zoom-in',
  snaps: false,
  down(e) {
    zoomAtClient(e.alt ? 1 / 1.5 : 1.5, e.clientX, e.clientY);
  },
};

export const selectTools: VToolDef[] = [selectTool, directTool];
export const viewTools: VToolDef[] = [handTool, zoomTool];
