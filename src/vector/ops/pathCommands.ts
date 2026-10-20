// Path commands: join, average, compound paths, clipping masks, offset, outline stroke, simplify and friends.
import type { Draft } from 'immer';
import {
  findItem,
  isEditable,
  makePath,
  orderedSelection,
  walkItems,
  type VectorDoc,
  type VGroup,
  type VItem,
  type VNode,
  type VPath,
  type VSub,
} from '../../model/vector';
import { removeIds, selectedItems, vdoc, vs } from '../edit';
import type { VCommand } from '../tools/types';
import { addAnchors, closeSub, joinSubs, offsetPath, outlineStroke, reverseSub, simplifySub, smoothSub } from './pathOps';
import { PF_LABEL, type PfOp } from './pathfinder';
import { newId } from '../../model/garment';
import {
  applyPathfinder,
  pfParams,
  pruneEmpty,
  replaceAbove,
  replaceInPlace,
  say,
  selectedShapes,
  wrapResults,
} from './pf_apply';
import { areaOf, closedGeom, cutShape, geomToPath, isShape, MIN_AREA, uniteAll } from './pf_geom';
import { strokeSubs } from './pf_stroke';

const clonePath = (p: VPath): VPath => structuredClone(p);

/** Change the sub paths of every selected path in place. Return null to leave one alone. */
function mutateSubs(fn: (p: VPath) => VSub[] | null): number {
  const { paths } = selectedShapes();
  const results = new Map<string, VSub[]>();
  for (const p of paths) {
    const subs = fn(p);
    if (subs) results.set(p.id, subs);
  }
  if (!results.size) return 0;
  vs().vstep((v) => {
    for (const [id, subs] of results) {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind === 'path') f.item.subs = subs as Draft<VSub>[];
    }
  });
  vs().setVNodes(vs().vnodes.filter((n) => !results.has(n.id)));
  return results.size;
}

const needPaths = () => {
  if (!selectedShapes().paths.length) {
    say('Select a path first');
    return false;
  }
  return true;
};

// ---------- join ----------

type Ref = { id: string; s: number; i: number };

function endOf(i: number): 'start' | 'end' {
  return i === 0 ? 'start' : 'end';
}

function joinAnchors(r1: Ref, r2: Ref) {
  const doc = vdoc();
  const f1 = findItem(doc, r1.id), f2 = findItem(doc, r2.id);
  if (f1?.item.kind !== 'path' || f2?.item.kind !== 'path') return;
  const s1 = f1.item.subs[r1.s], s2 = f2.item.subs[r2.s];
  vs().vstep((v) => {
    const a = findItem(v as VectorDoc, r1.id), b = findItem(v as VectorDoc, r2.id);
    if (a?.item.kind !== 'path' || b?.item.kind !== 'path') return;
    if (r1.id === r2.id && r1.s === r2.s) {
      a.item.subs[r1.s] = closeSub(s1) as Draft<VSub>;
      return;
    }
    const merged = joinSubs(s1, endOf(r1.i), s2, endOf(r2.i));
    a.item.subs[r1.s] = merged as Draft<VSub>;
    if (a.item === b.item) a.item.subs.splice(r2.s, 1);
    else {
      b.item.subs.splice(r2.s, 1);
      if (!b.item.subs.length) b.list.splice(b.index, 1);
    }
    pruneEmpty(v);
  });
  vs().setVNodes([]);
  vs().setVSel([r1.id]);
}

type Chain = { id: string; sub: VSub };

const endPts = (c: Chain) => [c.sub.nodes[0], c.sub.nodes[c.sub.nodes.length - 1]];

function joinPaths() {
  const { paths } = selectedShapes();
  const open = paths.filter((p) => p.subs.some((s) => !s.closed && s.nodes.length >= 2));
  if (!open.length) {
    say('Select open paths or two end anchors');
    return;
  }
  if (paths.length === 1 || open.length === 1) {
    // one open path: close it
    const n = mutateSubs((p) => (p.subs.some((s) => !s.closed && s.nodes.length >= 2) ? p.subs.map((s) => (s.nodes.length >= 2 ? closeSub(s) : s)) : null));
    if (n) vs().setVSel(open.map((p) => p.id));
    return;
  }
  const singles = open.filter((p) => p.subs.length === 1 && !p.subs[0].closed);
  if (singles.length < 2) {
    say('Join needs open paths with one line each');
    return;
  }
  let chains: Chain[] = singles.map((p) => ({ id: p.id, sub: p.subs[0] }));
  const gone = new Set<string>();
  while (chains.length > 1) {
    let best = { d: Infinity, a: 0, b: 1, ea: 1, eb: 0 };
    for (let a = 0; a < chains.length; a++)
      for (let b = a + 1; b < chains.length; b++) {
        const pa = endPts(chains[a]), pb = endPts(chains[b]);
        for (let ea = 0; ea < 2; ea++)
          for (let eb = 0; eb < 2; eb++) {
            const d = Math.hypot(pa[ea].x - pb[eb].x, pa[ea].y - pb[eb].y);
            if (d < best.d) best = { d, a, b, ea, eb };
          }
      }
    const A = chains[best.a], B = chains[best.b];
    A.sub = joinSubs(A.sub, best.ea === 0 ? 'start' : 'end', B.sub, best.eb === 0 ? 'start' : 'end');
    gone.add(B.id);
    chains = chains.filter((_, i) => i !== best.b);
  }
  const keep = chains[0];
  vs().vstep((v) => {
    const f = findItem(v as VectorDoc, keep.id);
    if (f?.item.kind === 'path') f.item.subs = [keep.sub as Draft<VSub>];
    removeIds(v, [...gone]);
    pruneEmpty(v);
  });
  vs().setVSel([keep.id]);
  vs().setVNodes([]);
}

function join() {
  const doc = vdoc();
  const refs = vs().vnodes.filter((r) => {
    const f = findItem(doc, r.id);
    if (f?.item.kind !== 'path' || !isEditable(f)) return false;
    const sub = f.item.subs[r.s];
    return !!sub && !sub.closed && sub.nodes.length >= 2 && (r.i === 0 || r.i === sub.nodes.length - 1);
  });
  if (refs.length >= 2) joinAnchors(refs[0], refs[1]);
  else joinPaths();
}

// ---------- average ----------

function average(axis: 'both' | 'x' | 'y') {
  const doc = vdoc();
  let refs = vs().vnodes.filter((r) => findItem(doc, r.id)?.item.kind === 'path');
  if (refs.length < 2) {
    // no anchors picked: use every anchor of the selected paths
    refs = selectedShapes().paths.flatMap((p) => p.subs.flatMap((s, si) => s.nodes.map((_, i) => ({ id: p.id, s: si, i }))));
  }
  if (refs.length < 2) {
    say('Pick two or more anchors with Direct Selection');
    return;
  }
  const at = (r: Ref) => {
    const f = findItem(doc, r.id);
    return f?.item.kind === 'path' ? f.item.subs[r.s]?.nodes[r.i] : undefined;
  };
  const pts = refs.map(at).filter((n): n is VNode => !!n);
  const ax = pts.reduce((a, n) => a + n.x, 0) / pts.length;
  const ay = pts.reduce((a, n) => a + n.y, 0) / pts.length;
  vs().vstep((v) => {
    for (const r of refs) {
      const f = findItem(v as VectorDoc, r.id);
      const n = f?.item.kind === 'path' ? f.item.subs[r.s]?.nodes[r.i] : undefined;
      if (!n) continue;
      const dx = axis === 'y' ? 0 : ax - n.x, dy = axis === 'x' ? 0 : ay - n.y;
      n.x += dx;
      n.ix += dx;
      n.ox += dx;
      n.y += dy;
      n.iy += dy;
      n.oy += dy;
    }
  });
}

// ---------- compound paths and masks ----------

function makeCompound() {
  const { paths, topId } = selectedShapes();
  if (paths.length < 2 || !topId) {
    say('Select two or more paths');
    return;
  }
  const subs = paths.flatMap((p) => structuredClone(p.subs));
  const c = makePath(subs, { ...structuredClone(paths[0].style), fillRule: 'evenodd' }, 'Compound Path');
  replaceAbove(paths.map((p) => p.id), topId, [c]);
}

function releaseCompound() {
  const { paths } = selectedShapes();
  const compound = paths.filter((p) => p.subs.length > 1);
  if (!compound.length) {
    say('Select a compound path');
    return;
  }
  const repl = new Map<string, VItem[]>();
  for (const p of compound) repl.set(p.id, p.subs.map((s, i) => makePath([structuredClone(s)], p.style, `${p.name} ${i + 1}`)));
  const ids = replaceInPlace(repl);
  const keep = vs().vsel.filter((id) => !repl.has(id));
  vs().setVSel([...keep, ...ids]);
}

function makeClip() {
  const items = selectedItems();
  if (items.length < 2) {
    say('Select two or more objects. The top one becomes the mask');
    return;
  }
  const ids = items.map((i) => i.id);
  const gid = newId();
  vs().vstep((v) => {
    const top = findItem(v as VectorDoc, ids[ids.length - 1]);
    if (!top) return;
    const g: VGroup = { kind: 'group', id: gid, name: 'Clip Group', children: [], clip: true };
    top.list.splice(top.index + 1, 0, g as Draft<VItem>);
    const moved = removeIds(v, ids);
    const gf = findItem(v as VectorDoc, gid);
    if (gf?.item.kind !== 'group' || !moved.length) return;
    const mask = moved[moved.length - 1];
    gf.item.children.push(mask, ...moved.slice(0, -1));
    pruneEmpty(v);
  });
  vs().setVSel([gid]);
}

function releaseClip() {
  const out: string[] = [];
  let any = false;
  vs().vstep((v) => {
    for (const id of orderedSelection(v as VectorDoc, vs().vsel)) {
      const f = findItem(v as VectorDoc, id);
      if (f?.item.kind !== 'group' || !f.item.clip || !isEditable(f)) {
        out.push(id);
        continue;
      }
      any = true;
      const [mask, ...rest] = f.item.children;
      const kids = mask ? [...rest, mask] : rest;
      f.item.clip = false;
      f.list.splice(f.index, 1, ...kids);
      out.push(...kids.map((k) => k.id));
    }
  });
  if (!any) say('Select a clipping group');
  else vs().setVSel(out);
}

// ---------- offset, outline, simplify, smooth, reverse, anchors ----------

function offset() {
  const { paths } = selectedShapes();
  if (!paths.length) return void say('Select a path first');
  const repl = new Map<string, VItem[]>();
  for (const p of paths) {
    const o = offsetPath(p, pfParams.offset, pfParams.join);
    if (o) repl.set(p.id, [clonePath(p), o]);
  }
  if (!repl.size) return void say('Nothing left at that offset');
  const ids = replaceInPlace(repl);
  const originals = new Set(repl.keys());
  vs().setVSel(ids.filter((id) => !originals.has(id)));
}

function outlineStrokeCmd() {
  const { paths } = selectedShapes();
  if (!paths.length) return void say('Select a path first');
  const repl = new Map<string, VItem[]>();
  for (const p of paths) {
    const o = outlineStroke(p);
    if (!o.length) continue;
    if (p.style.fill) {
      const fillOnly = clonePath(p);
      fillOnly.style.stroke = null;
      repl.set(p.id, wrapResults([fillOnly, ...o], `${p.name} outlined`));
    } else repl.set(p.id, o);
  }
  if (!repl.size) return void say('The selection has no stroke');
  vs().setVSel(replaceInPlace(repl));
}

function simplify() {
  if (!needPaths()) return;
  let before = 0, after = 0;
  const n = mutateSubs((p) => {
    const subs = p.subs.map((s) => {
      before += s.nodes.length;
      const r = s.nodes.length > 2 ? simplifySub(s, Math.max(0.05, pfParams.simplify)) : s;
      after += r.nodes.length;
      return r;
    });
    return subs;
  });
  if (n) say(`Anchors ${before} to ${after}`);
}

function smooth() {
  if (!needPaths()) return;
  const picked = vs().vnodes;
  mutateSubs((p) =>
    p.subs.map((s, si) => {
      if (!picked.length) return smoothSub(s);
      const only = new Set(picked.filter((r) => r.id === p.id && r.s === si).map((r) => r.i));
      return only.size ? smoothSub(s, only) : s;
    }),
  );
}

function reverse() {
  if (!needPaths()) return;
  mutateSubs((p) => p.subs.map(reverseSub));
  vs().setVNodes([]);
}

function addAnchorPoints() {
  if (!needPaths()) return;
  mutateSubs((p) => p.subs.map((s) => (s.nodes.length >= 2 ? addAnchors(s) : s)));
  vs().setVNodes([]);
}

// ---------- clean up and divide below ----------

function cleanUp() {
  const doc = vdoc();
  const dead: string[] = [];
  walkItems(doc, (it) => {
    const f = findItem(doc, it.id);
    if (!f || !isEditable(f)) return;
    if (it.kind === 'path' && it.subs.every((s) => s.nodes.length < 2)) dead.push(it.id);
    if (it.kind === 'text' && !it.text.trim()) dead.push(it.id);
  });
  if (!dead.length) return void say('No stray points found');
  vs().vstep((v) => {
    removeIds(v, dead);
    pruneEmpty(v);
  });
  vs().setVSel(vs().vsel.filter((id) => findItem(vdoc(), id)));
  say(`Removed ${dead.length} stray ${dead.length === 1 ? 'object' : 'objects'}`);
}

function divideBelow() {
  const doc = vdoc();
  const cutters = selectedShapes().paths;
  if (!cutters.length) return void say('Select the path to cut with');
  const cutIds = new Set(cutters.map((c) => c.id));
  const order: VPath[] = [];
  walkItems(doc, (it) => void (it.kind === 'path' && order.push(it)));
  const topIdx = Math.max(...cutters.map((c) => order.findIndex((o) => o.id === c.id)));
  const closed = cutters.flatMap((c) => c.subs.filter((s) => s.closed && s.nodes.length >= 3).map((s) => closedGeom({ ...c, subs: [s] })));
  const lines = cutters.flatMap((c) => c.subs.filter((s) => !s.closed && s.nodes.length >= 2));
  const area = closed.length ? uniteAll(closed) : null;
  const ribbon = lines.length ? strokeSubs(lines, { width: 0.06, cap: 'butt', join: 'bevel' }) : null;
  if (!area && !ribbon) return void say('The cutting path needs at least two anchors');
  const repl = new Map<string, VItem[]>();
  for (const t of order.slice(0, Math.max(0, topIdx))) {
    if (cutIds.has(t.id) || !isShape(t) || !t.style.fill) continue;
    const f = findItem(doc, t.id);
    if (!f || !isEditable(f)) continue;
    const cut = cutShape(closedGeom(t), { area, ribbon });
    const pieces = (cut ?? [])
      .filter((g) => areaOf(g) > MIN_AREA)
      .map((g) => geomToPath(g, t.style, t.name))
      .filter((x): x is VPath => !!x);
    if (pieces.length > 1) repl.set(t.id, pieces);
  }
  if (!repl.size) return void say('Nothing underneath was cut');
  const ids = replaceInPlace(repl, [...cutIds]);
  vs().setVSel(ids);
}

const pfCommands: VCommand[] = (Object.keys(PF_LABEL) as PfOp[]).map((op) => ({
  id: `pf-${op}`,
  title: `Pathfinder: ${PF_LABEL[op]}`,
  run: () => void applyPathfinder(op),
}));

export const pathCommands: VCommand[] = [
  { id: 'join', title: 'Join', keys: ['mod+j'], run: join },
  { id: 'average', title: 'Average', keys: ['mod+alt+j'], run: () => average('both') },
  { id: 'averageX', title: 'Average Horizontal', run: () => average('x') },
  { id: 'averageY', title: 'Average Vertical', run: () => average('y') },
  { id: 'makeCompound', title: 'Make Compound Path', keys: ['mod+8'], run: makeCompound },
  { id: 'releaseCompound', title: 'Release Compound Path', keys: ['mod+alt+8'], run: releaseCompound },
  { id: 'makeClip', title: 'Make Clipping Mask', keys: ['mod+7'], run: makeClip },
  { id: 'releaseClip', title: 'Release Clipping Mask', keys: ['mod+alt+7'], run: releaseClip },
  { id: 'offsetPath', title: 'Offset Path', run: offset },
  { id: 'outlineStroke', title: 'Outline Stroke', run: outlineStrokeCmd },
  { id: 'simplify', title: 'Simplify', run: simplify },
  { id: 'smooth', title: 'Smooth', run: smooth },
  { id: 'reversePath', title: 'Reverse Path Direction', run: reverse },
  { id: 'addAnchors', title: 'Add Anchor Points', run: addAnchorPoints },
  { id: 'cleanUp', title: 'Remove Stray Points', run: cleanUp },
  { id: 'divideBelow', title: 'Divide Objects Below', run: divideBelow },
  ...pfCommands,
];
