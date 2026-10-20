// Pencil (N), Smooth, and Blob Brush (Shift+B).
import { createElement as h } from 'react';
import { findItem, textPaint, makePath, type VectorDoc, type VNode, type VPath, type VStyle } from '../../model/vector';
import { addItems, removeIds, selectedPaths, vdoc, vs } from '../edit';
import { ensurePaper, fromPaper, paperSubs, toPaper } from '../ops/paperScope';
import { PencilOpts, BlobOpts } from './t_opts';
import { usePencilOpts } from './t_state';
import type { Pt } from './t_geom';
import type { PtrEvt, ToolCtx, VToolDef } from './types';

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- Pencil ----------

let pts: Pt[] | null = null;
let cont: { id: string; s: number; atStart: boolean } | null = null;

/** An end of a selected open path near the point, so drawing can continue it. */
function findContinue(p: Pt, k: number) {
  for (const path of selectedPaths()) {
    for (let s = 0; s < path.subs.length; s++) {
      const sub = path.subs[s];
      if (sub.closed || sub.nodes.length < 2) continue;
      const first = sub.nodes[0], last = sub.nodes[sub.nodes.length - 1];
      if (dist(first, p) * k < 8) return { id: path.id, s, atStart: true };
      if (dist(last, p) * k < 8) return { id: path.id, s, atStart: false };
    }
  }
  return null;
}

const polyD = (ps: Pt[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

function strokeOnlyStyle(): VStyle {
  const s = structuredClone(vs().vstyle);
  s.fill = null;
  s.stroke ??= { kind: 'solid', color: '#141414' };
  return s;
}

function endPencil(ctx: ToolCtx) {
  pts = null;
  cont = null;
  ctx?.setPreview(null);
}

function finishPencil(ctx: ToolCtx) {
  const ps = pts, c = cont;
  endPencil(ctx);
  if (!ps || ps.length < 2) return;
  const k = ctx.k;
  const P = ensurePaper();
  const closing = !c && ps.length >= 8 && dist(ps[0], ps[ps.length - 1]) * k < 10;
  const use = closing ? [...ps.slice(0, -1), ps[0]] : ps;
  const path = new P.Path({ insert: false });
  for (const p of use) path.add(new P.Point(p.x, p.y));
  path.simplify(usePencilOpts.getState().fidelity / k);
  if (closing) path.closePath();
  const sub = paperSubs(path)[0];
  if (!sub || sub.nodes.length < 2) return;
  if (!c) {
    addItems([makePath([sub], strokeOnlyStyle(), 'Pencil')]);
    return;
  }
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, c.id);
    if (f?.item.kind !== 'path') return;
    const target = f.item.subs[c.s];
    if (c.atStart) {
      target.nodes.reverse();
      for (const n of target.nodes) [n.ix, n.iy, n.ox, n.oy] = [n.ox, n.oy, n.ix, n.iy];
    }
    const end = target.nodes[target.nodes.length - 1];
    const first = sub.nodes[0];
    end.ox = end.x + (first.ox - first.x);
    end.oy = end.y + (first.oy - first.y);
    end.smooth = false;
    target.nodes.push(...sub.nodes.slice(1));
  });
}

export const pencilTool: VToolDef = {
  id: 'pencil',
  title: 'Pencil',
  key: 'n',
  icon: 'M4,16 L5,12 L13,4 L16,7 L8,15 Z M11.5,5.5 L14.5,8.5',
  help: 'Drag to draw a freehand line. End near the start to close it. Start at the end of a selected open path to continue it.',
  group: 'draw',
  cursor: 'crosshair',
  snaps: false,
  down(e, _hit, ctx) {
    pts = [{ x: e.x, y: e.y }];
    cont = findContinue(e, ctx.k);
  },
  move(e, ctx) {
    if (!pts) return;
    const last = pts[pts.length - 1];
    if (dist(last, e) * ctx.k < 1.5) return;
    pts.push({ x: e.x, y: e.y });
    const col = textPaint(vs().vstyle.stroke);
    ctx.setPreview(h('path', { d: polyD(pts), fill: 'none', stroke: col === 'none' ? '#141414' : col, strokeWidth: vs().vstyle.width, strokeLinecap: 'round', strokeLinejoin: 'round' }));
  },
  up(_e, ctx) {
    finishPencil(ctx);
  },
  cancel: endPencil,
  options: () => h(PencilOpts),
};

// ---------- Smooth ----------

let smoothing = false;

function smoothAt(p: Pt, k: number) {
  const radius = 20 / k;
  const ids = selectedPaths().map((x) => x.id);
  vs().vedit((v) => {
    for (const id of ids) {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind !== 'path') continue;
      for (const sub of f.item.subs) {
        const ns = sub.nodes as VNode[];
        const n = ns.length;
        if (n < 3) continue;
        for (let i = 0; i < n; i++) {
          if (!sub.closed && (i === 0 || i === n - 1)) continue;
          const a = ns[i];
          if (Math.hypot(a.x - p.x, a.y - p.y) > radius) continue;
          const prev = ns[(i - 1 + n) % n], next = ns[(i + 1) % n];
          a.x += ((prev.x + next.x) / 2 - a.x) * 0.15;
          a.y += ((prev.y + next.y) / 2 - a.y) * 0.15;
          let dx = next.x - prev.x, dy = next.y - prev.y;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          const l1 = Math.hypot(a.x - prev.x, a.y - prev.y) / 3, l2 = Math.hypot(next.x - a.x, next.y - a.y) / 3;
          a.ix = a.x - dx * l1;
          a.iy = a.y - dy * l1;
          a.ox = a.x + dx * l2;
          a.oy = a.y + dy * l2;
          a.smooth = true;
        }
      }
    }
  });
}

export const smoothTool: VToolDef = {
  id: 'smooth',
  title: 'Smooth',
  icon: 'M3,13 C6,5 9,15 12,8 S16,7 17,6 M3,17 H17',
  help: 'Drag along a selected path to smooth the anchors under the brush.',
  group: 'draw',
  decor: 'nodes',
  cursor: 'crosshair',
  snaps: false,
  down(e, hit, ctx) {
    if (hit?.kind === 'item' && !vs().vsel.includes(hit.top)) {
      vs().setVSel([hit.top]);
      return;
    }
    if (!selectedPaths().length) return;
    vs().checkpoint();
    smoothing = true;
    smoothAt(e, ctx.k);
  },
  move(e, ctx) {
    if (smoothing) smoothAt(e, ctx.k);
  },
  up() {
    smoothing = false;
  },
  cancel() {
    smoothing = false;
  },
};

// ---------- Blob Brush ----------

interface Sample extends Pt {
  r: number;
}
let blob: Sample[] | null = null;
let lastBlobs: string[] = [];

const blobRadius = (e: PtrEvt) => {
  const o = usePencilOpts.getState();
  const base = o.blobSize / 2;
  return e.pointerType === 'pen' && o.pressure ? base * (0.7 + 0.6 * e.pressure) : base;
};

/** Even spaced, lightly smoothed samples along the stroke. */
function resample(ps: Sample[], step: number): Sample[] {
  const out: Sample[] = [ps[0]];
  let carry = 0;
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i];
    const len = dist(a, b);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: a.r + (b.r - a.r) * t });
      d += step;
    }
    carry = len - (d - step);
  }
  const end = ps[ps.length - 1];
  if (dist(out[out.length - 1], end) > step * 0.3) out.push(end);
  return out.map((p, i) => {
    if (i === 0 || i === out.length - 1) return p;
    const a = out[i - 1], b = out[i + 1];
    return { x: (a.x + p.x * 2 + b.x) / 4, y: (a.y + p.y * 2 + b.y) / 4, r: p.r };
  });
}

function blobShape(ps: Sample[], k: number) {
  const P = ensurePaper();
  let len = 0;
  for (let i = 1; i < ps.length; i++) len += dist(ps[i - 1], ps[i]);
  const rmin = Math.min(...ps.map((p) => p.r));
  const step = Math.max(rmin * 0.7, 2 / k, len / 120);
  const rs = resample(ps, step);
  const pt = (x: number, y: number) => new P.Point(x, y);
  const circle = (p: Sample) => new P.Path.Circle({ center: pt(p.x, p.y), radius: p.r, insert: false });
  let acc: paper.PathItem = circle(rs[0]);
  for (let i = 1; i < rs.length; i++) {
    const p = rs[i - 1], q = rs[i];
    const l = dist(p, q) || 1;
    const dx = (q.x - p.x) / l, dy = (q.y - p.y) / l;
    const cap = new P.Path({ insert: false });
    cap.moveTo(pt(p.x - dy * p.r, p.y + dx * p.r));
    cap.lineTo(pt(q.x - dy * q.r, q.y + dx * q.r));
    cap.arcTo(pt(q.x + dx * q.r, q.y + dy * q.r), pt(q.x + dy * q.r, q.y - dx * q.r));
    cap.lineTo(pt(p.x + dy * p.r, p.y - dx * p.r));
    cap.arcTo(pt(p.x - dx * p.r, p.y - dy * p.r), pt(p.x - dy * p.r, p.y + dx * p.r));
    cap.closed = true;
    acc = acc.unite(cap, { insert: false });
  }
  return acc;
}

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function finishBlob(ctx: ToolCtx) {
  const ps = blob;
  blob = null;
  ctx?.setPreview(null);
  if (!ps) return;
  const st = vs();
  const col = textPaint(st.vstyle.stroke);
  const color = col === 'none' ? '#141414' : col;
  const style: VStyle = { ...structuredClone(st.vstyle), fill: { kind: 'solid', color }, stroke: null };
  let shape = blobShape(ps.length > 1 ? ps : [ps[0], { ...ps[0], x: ps[0].x + 0.01 }], ctx.k);
  // blobs of the same color that are selected or just made, and touch the new shape
  const pool = new Set([...st.vsel, ...lastBlobs]);
  const hits: VPath[] = [];
  for (const id of pool) {
    const f = findItem(vdoc(), id);
    const it = f?.item;
    if (!f || it?.kind !== 'path' || f.parent || it.style.stroke || it.style.fill?.kind !== 'solid' || !sameColor(it.style.fill.color, color)) continue;
    const pp = toPaper(it);
    const touch = shape.getIntersections(pp).length > 0 || shape.bounds.contains(pp.bounds) || pp.bounds.contains(shape.bounds);
    if (touch) {
      hits.push(it);
      shape = shape.unite(pp, { insert: false });
    }
  }
  const made = fromPaper(shape, style, 'Blob');
  if (!made) return;
  if (!hits.length) {
    addItems([made]);
    lastBlobs = [made.id];
    return;
  }
  made.id = hits[0].id;
  made.name = hits[0].name;
  const rest = hits.slice(1).map((x) => x.id);
  st.vstep((v) => {
    const f = findItem(v as VectorDoc, made.id);
    if (!f) return;
    (f.list as unknown[])[f.index] = made;
    if (rest.length) removeIds(v, rest);
  });
  st.setVSel([made.id]);
  lastBlobs = [made.id];
}

export const blobTool: VToolDef = {
  id: 'blob',
  title: 'Blob Brush',
  key: 'shift+b',
  icon: 'M5,13 C3,9 6,5 10,6 C14,4 17,8 15,12 C14,16 8,17 5,13 Z',
  help: 'Paint filled shapes with a round brush. Strokes of the same color that touch merge into one shape.',
  group: 'draw',
  cursor: 'crosshair',
  snaps: false,
  down(e) {
    blob = [{ x: e.x, y: e.y, r: blobRadius(e) }];
  },
  move(e, ctx) {
    if (!blob) return;
    const last = blob[blob.length - 1];
    if (dist(last, e) * ctx.k < 1.5) return;
    blob.push({ x: e.x, y: e.y, r: blobRadius(e) });
    const col = textPaint(vs().vstyle.stroke);
    const r = usePencilOpts.getState().blobSize;
    ctx.setPreview(h('path', { d: polyD(blob), fill: 'none', stroke: col === 'none' ? '#141414' : col, strokeWidth: r, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.8 }));
  },
  up(_e, ctx) {
    finishBlob(ctx);
  },
  cancel(ctx) {
    blob = null;
    ctx?.setPreview(null);
  },
  options: () => h(BlobOpts),
};

export const pencilTools: VToolDef[] = [pencilTool, smoothTool, blobTool];

