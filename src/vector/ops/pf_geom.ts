// Shared paper.js helpers for pathfinder, path ops and the cut tools.
import { fromPaper, ensurePaper, toPaper } from './paperScope';
import { hasIn, hasOut, type VPath, type VStyle, type VSub } from '../../model/vector';

export type PItem = paper.PathItem;

const NO_INSERT = { insert: false } as const;

/** A copy of the path where every sub path is closed, as paper geometry (for fills and booleans). */
export function closedGeom(p: VPath): PItem {
  const subs = p.subs.filter((s) => s.nodes.length >= 2).map((s) => ({ ...s, closed: true }));
  return toPaper({ ...p, subs });
}

/** Net filled area. */
export const areaOf = (it: PItem | null | undefined) => (it ? Math.abs((it as unknown as { area: number }).area) : 0);

export const MIN_AREA = 0.05;

export function isShape(p: VPath): boolean {
  return p.subs.some((s) => s.nodes.length >= 3 || (s.closed && s.nodes.length >= 2));
}

/** Unite shapes by merging neighbours pairwise (keeps each boolean small). */
export function uniteTree(items: PItem[]): PItem | null {
  if (!items.length) return null;
  let level = items;
  while (level.length > 1) {
    const next: PItem[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? level[i].unite(level[i + 1], NO_INSERT) : level[i]);
    level = next;
  }
  return level[0];
}

/** Unite a list of shapes into one. A single shape has its own overlaps resolved. */
export function uniteAll(items: PItem[]): PItem | null {
  if (!items.length) return null;
  if (items.length === 1) {
    const one = items[0].clone(NO_INSERT) as PItem & { resolveCrossings?: () => PItem };
    try {
      return one.resolveCrossings ? one.resolveCrossings() : one;
    } catch {
      return one;
    }
  }
  return uniteTree(items);
}

/** Split a resolved result into separate regions. Holes stay with the region that contains them. */
export function regions(item: PItem | null | undefined): PItem[] {
  if (!item) return [];
  const P = ensurePaper();
  const kids: paper.Path[] = item instanceof P.Path ? [item] : ((item.children ?? []).filter((c) => c instanceof P.Path) as paper.Path[]);
  const live = kids.filter((k) => k.segments.length > 1 && Math.abs(k.area) > MIN_AREA / 4);
  live.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const parent: number[] = live.map(() => -1);
  const depth: number[] = live.map(() => 0);
  live.forEach((k, i) => {
    const pt = k.interiorPoint;
    let best = -1;
    for (let j = 0; j < i; j++) {
      if (live[j].contains(pt)) {
        depth[i]++;
        best = j;
      }
    }
    parent[i] = best;
  });
  const out: PItem[] = [];
  live.forEach((k, i) => {
    if (depth[i] % 2) return;
    const holes = live.filter((_, j) => depth[j] % 2 === 1 && parent[j] === i);
    if (!holes.length) out.push(k.clone(NO_INSERT));
    else {
      const c = new P.CompoundPath({ children: [k.clone(NO_INSERT), ...holes.map((h) => h.clone(NO_INSERT))], insert: false });
      c.fillRule = 'evenodd';
      out.push(c);
    }
  });
  return out.filter((r) => areaOf(r) > MIN_AREA);
}

/** Drop anchors that sit on a straight line between two straight segments. */
export function dropCollinear(sub: VSub, eps = 0.02): VSub {
  const n = sub.nodes.length;
  if (n < 3) return sub;
  const keep = sub.nodes.map((nd, i) => {
    if (!sub.closed && (i === 0 || i === n - 1)) return true;
    const a = sub.nodes[(i + n - 1) % n], b = sub.nodes[(i + 1) % n];
    if (hasIn(nd) || hasOut(nd) || hasOut(a) || hasIn(b)) return true;
    const cross = (nd.x - a.x) * (b.y - nd.y) - (nd.y - a.y) * (b.x - nd.x);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dot = (nd.x - a.x) * (b.x - nd.x) + (nd.y - a.y) * (b.y - nd.y);
    return !(Math.abs(cross) / len < eps && dot > 0);
  });
  const nodes = sub.nodes.filter((_, i) => keep[i]);
  return nodes.length >= (sub.closed ? 3 : 2) ? { nodes, closed: sub.closed } : sub;
}

/** Paper geometry as a VPath (compound results use even odd so holes always show). */
export function geomToPath(item: PItem, style: VStyle, name = 'Path'): VPath | null {
  const v = fromPaper(item, style, name);
  if (!v) return null;
  v.subs = v.subs.map((s) => dropCollinear(s));
  if (v.subs.length > 1) v.style.fillRule = 'evenodd';
  return v;
}

/** Cut a shape with an area (inside and outside pieces) and/or a hairline ribbon. Null when nothing was split. */
export function cutShape(geom: PItem, cut: { area?: PItem | null; ribbon?: PItem | null }): PItem[] | null {
  const base = regions(geom);
  let pieces: PItem[] = base;
  if (cut.area) {
    const a = cut.area;
    pieces = pieces.flatMap((p) => [...regions(p.intersect(a, NO_INSERT)), ...regions(p.subtract(a, NO_INSERT))]);
  }
  if (cut.ribbon) {
    const r = cut.ribbon;
    pieces = pieces.flatMap((p) => (p.getIntersections(r).length ? regions(p.subtract(r, NO_INSERT)) : [p]));
  }
  return pieces.length > base.length ? pieces : null;
}
