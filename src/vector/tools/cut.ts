// Scissors (C), Knife, Shape Builder (Shift+M), Eraser (Shift+E).
import { createElement as h, useState, type ReactNode } from 'react';
import {
  findItem,
  isEditable,
  itemBox,
  makePath,
  pathD,
  walkItems,
  type VectorDoc,
  type VItem,
  type VPath,
  type VStyle,
} from '../../model/vector';
import { vdoc, vs } from '../edit';
import { insertAt, openAt } from '../ops/pathOps';
import { runPathfinder } from '../ops/pathfinder';
import { replaceAbove, replaceInPlace, say, selectedShapes, setNotifier } from '../ops/pf_apply';
import { areaOf, closedGeom, cutShape, geomToPath, isShape, MIN_AREA, regions, uniteAll, type PItem } from '../ops/pf_geom';
import { ribbon, strokePolys, type Pt } from '../ops/pf_stroke';
import { ensurePaper, paperSubs, toPaper } from '../ops/paperScope';
import type { Draft } from 'immer';
import type { Hit, PtrEvt, ToolCtx, VToolDef } from './types';

const say2 = (ctx: ToolCtx, msg: string) => {
  setNotifier(ctx.toast);
  say(msg);
};

/** Editable, visible leaf paths of the document, bottom first. */
function editablePaths(): VPath[] {
  const doc = vdoc();
  const out: VPath[] = [];
  walkItems(doc, (it) => {
    if (it.kind !== 'path') return;
    const f = findItem(doc, it.id);
    if (f && isEditable(f)) out.push(it);
  });
  return out;
}

const bounds = (p: VPath, pad = 0) => {
  const b = itemBox(p);
  return b ? { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 } : null;
};

const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

// ---------- Scissors ----------

interface Spot {
  path: VPath;
  sub: number;
  seg: number;
  t: number;
  dist: number;
  x: number;
  y: number;
}

function nearestSpot(x: number, y: number, reach: number, prefer?: string): Spot | null {
  const P = ensurePaper();
  const pt = new P.Point(x, y);
  let best: Spot | null = null;
  for (const p of editablePaths()) {
    const b = bounds(p, reach);
    if (!b || x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) continue;
    const item = toPaper(p);
    const kids = (item.children?.length ? item.children : [item]) as paper.Path[];
    kids.forEach((k, si) => {
      const loc = k.getNearestLocation(pt);
      if (!loc) return;
      const d = loc.distance - (p.id === prefer ? 0.5 : 0);
      if (d <= reach && (!best || d < best.dist)) best = { path: p, sub: si, seg: loc.index, t: loc.time, dist: d, x: loc.point.x, y: loc.point.y };
    });
  }
  return best;
}

function cutAt(spot: Spot, ctx: ToolCtx) {
  const sub = spot.path.subs[spot.sub];
  if (!sub || sub.nodes.length < 2) return;
  const n = sub.nodes.length;
  let working = sub;
  let k: number;
  if (spot.t < 0.02) k = spot.seg;
  else if (spot.t > 0.98) k = (spot.seg + 1) % n;
  else {
    const r = insertAt(sub, spot.seg, spot.t);
    working = r.sub;
    k = r.index;
  }
  if (!sub.closed && (k === 0 || k === working.nodes.length - 1)) {
    say2(ctx, 'That is an end point already');
    return;
  }
  const parts = openAt(working, k);
  let second: VPath | null = null;
  const id = spot.path.id;
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, id);
    if (f?.item.kind !== 'path') return;
    const p = f.item;
    if (p.subs.length === 1 && parts.length === 2) {
      p.subs = [parts[0]] as Draft<VPath>['subs'];
      second = makePath([parts[1]], structuredClone(spot.path.style), spot.path.name);
      (f.list as VItem[]).splice(f.index + 1, 0, second);
    } else p.subs.splice(spot.sub, 1, ...(parts as Draft<VPath>['subs']));
  });
  vs().setVNodes([]);
  vs().setVSel(second ? [id, (second as VPath).id] : [id]);
}

let scissorsOn = false;
export const scissorsTool: VToolDef = {
  id: 'scissors',
  title: 'Scissors',
  key: 'c',
  icon: 'M6,3 L13,12 M14,3 L7,12 M5,14.5 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0 M15,14.5 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0',
  help: 'Click a path or anchor to cut it there. A closed path opens, an open path becomes two.',
  group: 'transform',
  decor: 'nodes',
  cursor: 'crosshair',
  snaps: false,
  down(e, hit, ctx) {
    scissorsOn = true;
    const prefer = hit && (hit.kind === 'item' || hit.kind === 'node' || hit.kind === 'handle') ? hit.id : undefined;
    const spot = nearestSpot(e.rx, e.ry, Math.max(6 / ctx.k, 1.5), prefer);
    ctx.setPreview(null);
    if (!spot) return say2(ctx, 'Click right on a path or anchor');
    cutAt(spot, ctx);
  },
  hover(e, _hit: Hit, ctx) {
    const spot = nearestSpot(e.rx, e.ry, Math.max(6 / ctx.k, 1.5));
    ctx.setPreview(spot ? h('circle', { cx: spot.x, cy: spot.y, r: 4 / ctx.k, fill: '#fff', stroke: '#E5484D', strokeWidth: 1.5 / ctx.k }) : null);
  },
  cancel(ctx) {
    if (scissorsOn) ctx?.setPreview(null);
    scissorsOn = false;
  },
};

// ---------- Knife ----------

let knifePts: Pt[] = [];

const previewLine = (pts: Pt[], k: number, color = '#E5484D') =>
  h('polyline', { points: pts.map((p) => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: color, strokeWidth: 1.5 / k, strokeDasharray: `${4 / k} ${3 / k}`, strokeLinecap: 'round', strokeLinejoin: 'round' });

export function knifeCut(points: Pt[]): string[] | null {
  const rib = ribbon(points);
  if (!rib) return null;
  const sel = vs().vsel.length ? selectedShapes().paths : editablePaths();
  const rb = rib.bounds;
  const repl = new Map<string, VItem[]>();
  for (const t of sel) {
    if (!isShape(t) || !t.style.fill) continue;
    const b = bounds(t);
    if (!b || !overlap(b, { x: rb.x, y: rb.y, w: rb.width, h: rb.height })) continue;
    const cut = cutShape(closedGeom(t), { ribbon: rib });
    if (!cut) continue;
    const pieces = cut.filter((g) => areaOf(g) > MIN_AREA).map((g) => geomToPath(g, t.style, t.name)).filter((x): x is VPath => !!x);
    if (pieces.length > 1) repl.set(t.id, pieces);
  }
  if (!repl.size) return null;
  return replaceInPlace(repl);
}

export const knifeTool: VToolDef = {
  id: 'knife',
  title: 'Knife',
  icon: 'M3,17 L13,3 L17,6 L7,17 Z M13,3 L10,9',
  help: 'Drag across filled shapes to cut them into separate pieces. Cuts the selection, or everything when nothing is selected.',
  group: 'transform',
  decor: 'none',
  cursor: 'crosshair',
  snaps: false,
  down(e) {
    knifePts = [{ x: e.rx, y: e.ry }];
  },
  move(e, ctx) {
    if (!knifePts.length) return;
    const last = knifePts[knifePts.length - 1];
    if (Math.hypot(e.rx - last.x, e.ry - last.y) * ctx.k < 3) return;
    knifePts.push({ x: e.rx, y: e.ry });
    ctx.setPreview(previewLine(knifePts, ctx.k));
  },
  up(e, ctx) {
    if (!knifePts.length) return;
    knifePts.push({ x: e.rx, y: e.ry });
    const pts = knifePts;
    knifePts = [];
    ctx.setPreview(null);
    if (pts.length < 2 || Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) * ctx.k < 4) return;
    try {
      const ids = knifeCut(pts);
      if (!ids) return say2(ctx, 'The knife did not cross a filled shape');
      vs().setVSel(ids);
    } catch (err) {
      console.warn('knife failed', err);
      say2(ctx, 'The knife could not cut that shape');
    }
  },
  cancel(ctx) {
    knifePts = [];
    ctx?.setPreview(null);
  },
};

// ---------- Shape Builder ----------

interface Region {
  geom: PItem;
  style: VStyle;
  d: string;
}

let sbCache: { doc: VectorDoc; key: string; regs: Region[]; inputs: VPath[]; topId: string | null } | null = null;
let sbVisited: number[] = [];
let sbDrag = false;
let sbHover = -1;
let sbAlt = false;

function sbRegions() {
  const doc = vdoc();
  const key = vs().vsel.join(',');
  if (sbCache && sbCache.doc === doc && sbCache.key === key) return sbCache;
  const { paths, topId } = selectedShapes();
  const inputs = paths.filter(isShape);
  let regs: Region[] = [];
  if (inputs.length) {
    const res = runPathfinder('divide', structuredClone(inputs));
    if (res.ok) regs = res.paths.map((p) => ({ geom: closedGeom(p), style: p.style, d: pathD(p) }));
  }
  sbCache = { doc, key, regs, inputs, topId };
  return sbCache;
}

function sbIndexAt(x: number, y: number): number {
  const P = ensurePaper();
  const pt = new P.Point(x, y);
  const { regs } = sbRegions();
  for (let i = regs.length - 1; i >= 0; i--) if (regs[i].geom.contains(pt)) return i;
  return -1;
}

function sbPreview(ctx: ToolCtx): ReactNode {
  const { regs } = sbRegions();
  const on = new Set(sbVisited);
  if (sbHover >= 0) on.add(sbHover);
  if (!on.size) return null;
  const color = sbAlt ? '#E5484D' : '#4F8DF7';
  return h('g', null, [...on].map((i) => h('path', { key: i, d: regs[i].d, fill: color, fillOpacity: 0.35, stroke: color, strokeWidth: 1.5 / ctx.k, fillRule: 'evenodd' })));
}

function sbApply(alt: boolean, ctx: ToolCtx) {
  const c = sbRegions();
  const vis = [...new Set(sbVisited)];
  if (!c.topId || !vis.length) return;
  const out: VPath[] = [];
  const toPath = (r: Region, name: string) => geomToPath(r.geom, r.style, name);
  if (alt) {
    c.regs.forEach((r, i) => {
      const p = vis.includes(i) ? null : toPath(r, 'Piece');
      if (p) out.push(p);
    });
  } else if (vis.length >= 2) {
    const merged = uniteAll(vis.map((i) => c.regs[i].geom));
    const mp = merged ? geomToPath(merged, c.regs[vis[0]].style, 'Shape') : null;
    let placed = false;
    c.regs.forEach((r, i) => {
      if (vis.includes(i)) {
        if (!placed && mp) out.push(mp);
        placed = true;
        return;
      }
      const p = toPath(r, 'Piece');
      if (p) out.push(p);
    });
  } else {
    // a click keeps the region as its own piece, so everything is split apart
    if (c.regs.length === c.inputs.length) return;
    for (const r of c.regs) {
      const p = toPath(r, 'Piece');
      if (p) out.push(p);
    }
  }
  if (!out.length && !alt) return;
  replaceAbove(c.inputs.map((p) => p.id), c.topId, out);
  sbCache = null;
  void ctx;
}

export const shapeBuilderTool: VToolDef = {
  id: 'shapebuilder',
  title: 'Shape Builder',
  key: 'shift+m',
  icon: 'M3,3 H12 V12 H3 Z M8,8 H17 V17 H8 Z M14,3 V7 M12,5 H16',
  help: 'Select shapes first. Click a region to split it off, drag across regions to unite them, Alt click or Alt drag to delete regions.',
  group: 'transform',
  decor: 'none',
  cursor: 'crosshair',
  snaps: false,
  down(e, _hit, ctx) {
    const c = sbRegions();
    if (!c.regs.length) return say2(ctx, 'Select closed shapes first');
    sbDrag = true;
    sbAlt = e.alt;
    const i = sbIndexAt(e.rx, e.ry);
    sbVisited = i >= 0 ? [i] : [];
    ctx.setPreview(sbPreview(ctx));
  },
  move(e, ctx) {
    if (!sbDrag) return;
    sbAlt = e.alt;
    const i = sbIndexAt(e.rx, e.ry);
    if (i >= 0 && !sbVisited.includes(i)) sbVisited.push(i);
    sbHover = -1;
    ctx.setPreview(sbPreview(ctx));
  },
  up(e, ctx) {
    if (!sbDrag) return;
    sbDrag = false;
    try {
      sbApply(e.alt || sbAlt, ctx);
    } catch (err) {
      console.warn('shape builder failed', err);
      say2(ctx, 'Shape Builder could not finish');
    }
    sbVisited = [];
    sbHover = -1;
    ctx.setPreview(null);
  },
  hover(e, _hit, ctx) {
    sbAlt = e.alt;
    if (!vs().vsel.length) return;
    const i = sbIndexAt(e.rx, e.ry);
    if (i !== sbHover) {
      sbHover = i;
      ctx.setPreview(sbPreview(ctx));
    }
  },
  cancel(ctx) {
    sbDrag = false;
    sbVisited = [];
    sbHover = -1;
    sbCache = null;
    ctx?.setPreview(null);
  },
};

// ---------- Eraser ----------

let eraserSize = 12;
let eraserPts: Pt[] = [];

function EraserOptions() {
  const [size, setSize] = useState(eraserSize);
  const set = (n: number) => {
    eraserSize = Math.max(1, Math.min(200, n || 1));
    setSize(eraserSize);
  };
  return h(
    'label',
    { className: 'numfield', style: { display: 'flex', alignItems: 'center', gap: 8 } },
    h('span', { className: 'muted small' }, 'Size'),
    h('input', { type: 'range', min: 2, max: 80, value: Math.min(80, size), onChange: (e: { target: { value: string } }) => set(Number(e.target.value)), 'aria-label': 'Eraser size' }),
    h('input', { className: 'hexin small mono', style: { width: 48 }, value: size, inputMode: 'numeric', onChange: (e: { target: { value: string } }) => set(Number(e.target.value)), 'aria-label': 'Eraser size value' }),
  );
}

function eraseSub(t: VPath, rib: PItem): VPath[] | null {
  const P = ensurePaper();
  const out: VPath[] = [];
  let changed = false;
  for (const s of t.subs) {
    if (s.nodes.length < 2) continue;
    const nodes = s.closed ? [...s.nodes, { ...s.nodes[0] }] : s.nodes;
    const line = toPaper({ ...t, subs: [{ nodes, closed: false }] }) as paper.Path;
    const offs = line
      .getIntersections(rib)
      .map((l) => l.offset)
      .sort((a, b) => a - b)
      .filter((o, i, a) => i === 0 || o - a[i - 1] > 1e-3);
    const pieces: paper.Path[] = [];
    let cur = line, used = 0;
    for (const o of offs) {
      if (o <= used + 1e-3 || o >= cur.length + used - 1e-3) continue;
      const rest = cur.splitAt(o - used);
      pieces.push(cur);
      if (!rest) break;
      cur = rest;
      used = o;
    }
    pieces.push(cur);
    for (const piece of pieces) {
      if (piece.length < 0.1) {
        changed = true;
        continue;
      }
      const mid = piece.getPointAt(piece.length / 2);
      if (mid && rib.contains(mid)) {
        changed = true;
        continue;
      }
      const subs = paperSubs(piece);
      if (subs.length) out.push(makePath(subs, t.style, t.name));
    }
    if (offs.length) changed = true;
  }
  void P;
  return changed ? out : null;
}

export function eraseWith(points: Pt[], size: number): string[] | null {
  const pts = points.length ? points : [];
  const rib = strokePolys([{ pts, anchor: pts.map(() => false), closed: false }], { width: size, cap: 'round', join: 'round' });
  if (!rib) return null;
  const rb = rib.bounds;
  const box = { x: rb.x, y: rb.y, w: rb.width, h: rb.height };
  const hadSel = vs().vsel.length > 0;
  const targets = hadSel ? selectedShapes().paths : editablePaths();
  const repl = new Map<string, VItem[]>();
  for (const t of targets) {
    const b = bounds(t, t.style.stroke ? t.style.width / 2 : 0);
    if (!b || !overlap(b, box)) continue;
    let res: VPath[] | null = null;
    if (isShape(t) && t.style.fill) {
      const geom = closedGeom(t);
      const left = geom.subtract(rib, { insert: false });
      if (Math.abs(areaOf(geom) - areaOf(left)) < 1e-6) continue;
      res = regions(left).map((g) => geomToPath(g, t.style, t.name)).filter((x): x is VPath => !!x);
    } else res = eraseSub(t, rib);
    if (!res) continue;
    if (res.length === 1) res[0].id = t.id;
    repl.set(t.id, res);
  }
  if (!repl.size) return null;
  const made = replaceInPlace(repl);
  const gone = [...repl.keys()].filter((id) => !made.includes(id));
  if (hadSel) vs().setVSel([...vs().vsel.filter((id) => !gone.includes(id)), ...made.filter((id) => !vs().vsel.includes(id))]);
  else vs().setVSel([]);
  return made;
}

export const eraserTool: VToolDef = {
  id: 'eraser',
  title: 'Eraser',
  key: 'shift+e',
  icon: 'M4,12 L11,4 L17,9 L10,17 H7 Z M8,8 L14,13',
  help: 'Drag to rub out shapes and lines. Erases the selection, or everything when nothing is selected.',
  group: 'transform',
  decor: 'none',
  cursor: 'crosshair',
  snaps: false,
  options: () => h(EraserOptions),
  down(e, _hit, ctx) {
    eraserPts = [{ x: e.rx, y: e.ry }];
    ctx.setPreview(eraserPreview(e, ctx));
  },
  move(e, ctx) {
    if (!eraserPts.length) return;
    const last = eraserPts[eraserPts.length - 1];
    if (Math.hypot(e.rx - last.x, e.ry - last.y) >= Math.max(1, eraserSize / 6)) eraserPts.push({ x: e.rx, y: e.ry });
    ctx.setPreview(eraserPreview(e, ctx));
  },
  up(e, ctx) {
    if (!eraserPts.length) return;
    const last = eraserPts[eraserPts.length - 1];
    if (last.x !== e.rx || last.y !== e.ry) eraserPts.push({ x: e.rx, y: e.ry });
    const pts = eraserPts;
    eraserPts = [];
    ctx.setPreview(null);
    try {
      eraseWith(pts, eraserSize);
    } catch (err) {
      console.warn('eraser failed', err);
      say2(ctx, 'The eraser could not finish on that shape');
    }
  },
  hover(e, _hit, ctx) {
    ctx.setPreview(h('circle', { cx: e.rx, cy: e.ry, r: eraserSize / 2, fill: 'none', stroke: '#8C877D', strokeWidth: 1 / ctx.k }));
  },
  cancel(ctx) {
    eraserPts = [];
    ctx?.setPreview(null);
  },
};

function eraserPreview(e: PtrEvt, ctx: ToolCtx): ReactNode {
  return h(
    'g',
    null,
    eraserPts.length > 1
      ? h('polyline', {
          points: eraserPts.map((p) => `${p.x},${p.y}`).join(' '),
          fill: 'none',
          stroke: '#8C877D',
          strokeOpacity: 0.35,
          strokeWidth: eraserSize,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        })
      : null,
    h('circle', { cx: e.rx, cy: e.ry, r: eraserSize / 2, fill: 'none', stroke: '#8C877D', strokeWidth: 1 / ctx.k }),
  );
}

export const cutTools: VToolDef[] = [scissorsTool, knifeTool, shapeBuilderTool, eraserTool];
