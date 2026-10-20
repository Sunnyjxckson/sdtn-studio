// Blend engine: interpolate two paths into a group.
import { newId } from '../../model/garment';
import { findItem, orderedSelection, type VectorDoc, type VGroup, type VNode, type VPaint, type VPath, type VStyle, type VSub } from '../../model/vector';
import { vdoc, vs } from '../edit';
import { resampleSub } from './t_geom';
import { useBlendOpts } from './t_state';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function lerpHex(a: string, b: string, t: number): string {
  const p = (c: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a), y = p(b);
  if (!x || !y) return t < 0.5 ? a : b;
  const v = x.map((q, i) => Math.round(lerp(q, y[i], t)));
  return '#' + v.map((q) => q.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function lerpPaint(a: VPaint | null, b: VPaint | null, t: number): VPaint | null {
  if (a?.kind === 'solid' && b?.kind === 'solid') return { kind: 'solid', color: lerpHex(a.color, b.color, t) };
  if (!a || !b) return structuredClone(t < 0.5 ? a : b) ?? structuredClone(a ?? b);
  return structuredClone(t < 0.5 ? a : b);
}

function lerpStyle(a: VStyle, b: VStyle, t: number): VStyle {
  const s = structuredClone(a);
  s.fill = lerpPaint(a.fill, b.fill, t);
  s.stroke = lerpPaint(a.stroke, b.stroke, t);
  s.width = r3(lerp(a.width, b.width, t));
  s.opacity = r3(lerp(a.opacity, b.opacity, t));
  return s;
}

function lerpSub(a: VSub, b: VSub, t: number): VSub {
  const nodes: VNode[] = a.nodes.map((p, i) => {
    const q = b.nodes[i];
    return {
      x: r3(lerp(p.x, q.x, t)), y: r3(lerp(p.y, q.y, t)),
      ix: r3(lerp(p.ix, q.ix, t)), iy: r3(lerp(p.iy, q.iy, t)),
      ox: r3(lerp(p.ox, q.ox, t)), oy: r3(lerp(p.oy, q.oy, t)),
      smooth: p.smooth && q.smooth ? true : undefined,
    };
  });
  return { nodes, closed: t < 0.5 ? a.closed : b.closed };
}

/** Two paths with matching sub path counts and anchor counts, ready to interpolate. */
function matched(a: VPath, b: VPath): [VSub[], VSub[]] {
  const n = Math.min(a.subs.length, b.subs.length);
  const as: VSub[] = [], bs: VSub[] = [];
  for (let i = 0; i < n; i++) {
    const cnt = Math.max(a.subs[i].nodes.length, b.subs[i].nodes.length);
    as.push(resampleSub(a.subs[i], cnt));
    bs.push(resampleSub(b.subs[i], cnt));
  }
  return [as, bs];
}

export function makeBlend(a: VPath, b: VPath, steps: number): VGroup {
  const [as, bs] = matched(a, b);
  const kids: VPath[] = [structuredClone(a)];
  for (let j = 1; j <= steps; j++) {
    const t = j / (steps + 1);
    kids.push({
      kind: 'path',
      id: newId(),
      name: 'Blend step',
      subs: as.map((s, i) => lerpSub(s, bs[i], t)),
      style: lerpStyle(a.style, b.style, t),
    });
  }
  kids.push(structuredClone(b));
  return { kind: 'group', id: newId(), name: 'Blend', children: kids };
}

/** Replace two paths with a blend group. One undo step. */
export function blendPaths(idA: string, idB: string, steps: number): boolean {
  const v = vdoc();
  const fa = findItem(v, idA), fb = findItem(v, idB);
  if (!fa || !fb || fa.item.kind !== 'path' || fb.item.kind !== 'path' || idA === idB) return false;
  const g = makeBlend(fa.item, fb.item, steps);
  vs().vstep((d) => {
    const b = findItem(d as VectorDoc, idB);
    const a = findItem(d as VectorDoc, idA);
    if (!a || !b) return;
    (b.list as unknown[])[b.index] = g;
    const a2 = findItem(d as VectorDoc, idA);
    if (a2 && a2.item.id === idA) a2.list.splice(a2.index, 1);
  });
  vs().setVSel([g.id]);
  vs().setVNodes([]);
  return true;
}

/** Blend the two selected paths. Returns an error message, or null when done. */
export function blendSelected(): string | null {
  const v = vdoc();
  const ids = orderedSelection(v, vs().vsel).filter((id) => findItem(v, id)?.item.kind === 'path');
  if (ids.length !== 2) return 'Select exactly two paths';
  return blendPaths(ids[0], ids[1], useBlendOpts.getState().steps) ? null : 'Could not blend those';
}
