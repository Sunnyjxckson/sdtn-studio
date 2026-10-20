// Pathfinder operations on VPaths, bottom first. Pure: paths in, new paths out.
import type { VPaint, VPath, VStyle } from '../../model/vector';
import { areaOf, closedGeom, geomToPath, isShape, MIN_AREA, regions, uniteAll, type PItem } from './pf_geom';

export type PfOp = 'unite' | 'minusFront' | 'intersect' | 'exclude' | 'divide' | 'trim' | 'merge' | 'crop' | 'outline' | 'minusBack';

export type PfResult = { ok: true; paths: VPath[]; grouped: boolean } | { ok: false; msg: string };

export const PF_MIN: Record<PfOp, number> = {
  unite: 1,
  minusFront: 2,
  intersect: 2,
  exclude: 2,
  divide: 1,
  trim: 1,
  merge: 1,
  crop: 2,
  outline: 1,
  minusBack: 2,
};

export const PF_LABEL: Record<PfOp, string> = {
  unite: 'Unite',
  minusFront: 'Minus Front',
  intersect: 'Intersect',
  exclude: 'Exclude',
  divide: 'Divide',
  trim: 'Trim',
  merge: 'Merge',
  crop: 'Crop',
  outline: 'Outline',
  minusBack: 'Minus Back',
};

const NO = { insert: false } as const;

interface Piece {
  geom: PItem;
  style: VStyle;
}

const noStroke = (s: VStyle): VStyle => ({ ...structuredClone(s), stroke: null, dash: [] });

/** Divide: every region of the overlap, each painted like the topmost object over it. */
function divideRegions(geoms: PItem[], styles: VStyle[]): Piece[] {
  let pieces: Piece[] = [];
  let cover: PItem | null = null;
  geoms.forEach((g, i) => {
    const next: Piece[] = [];
    for (const p of pieces) {
      const inter = p.geom.intersect(g, NO), diff = p.geom.subtract(g, NO);
      if (areaOf(inter) > MIN_AREA) next.push({ geom: inter, style: styles[i] });
      if (areaOf(diff) > MIN_AREA) next.push({ geom: diff, style: p.style });
    }
    const rest = cover ? g.subtract(cover, NO) : g.clone(NO);
    if (areaOf(rest) > MIN_AREA) next.push({ geom: rest, style: styles[i] });
    cover = cover ? cover.unite(g, NO) : g.clone(NO);
    pieces = next;
  });
  return pieces.flatMap((p) => regions(p.geom).map((r) => ({ geom: r, style: p.style })));
}

/** Trim: each object minus whatever is stacked above it. */
function trimPieces(geoms: PItem[], styles: VStyle[]): Piece[] {
  const out: Piece[] = [];
  let above: PItem | null = null;
  for (let i = geoms.length - 1; i >= 0; i--) {
    const vis = above ? geoms[i].subtract(above, NO) : geoms[i].clone(NO);
    for (const r of regions(vis)) out.unshift({ geom: r, style: noStroke(styles[i]) });
    above = above ? above.unite(geoms[i], NO) : geoms[i].clone(NO);
  }
  return out;
}

const fillKey = (p: VPaint | null, i: number) => (p?.kind === 'solid' ? p.color.toLowerCase() : `#${i}`);

function mergePieces(pieces: Piece[]): Piece[] {
  const groups = new Map<string, Piece[]>();
  pieces.forEach((p, i) => {
    const k = p.style.fill ? fillKey(p.style.fill, i) : `none${i}`;
    groups.set(k, [...(groups.get(k) ?? []), p]);
  });
  const out: Piece[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const u = uniteAll(list.map((p) => p.geom));
    for (const r of regions(u)) out.push({ geom: r, style: list[0].style });
  }
  return out;
}

const solidOf = (p: VPaint | null): VPaint | null =>
  !p ? null : p.kind === 'solid' ? { ...p } : { kind: 'solid', color: p.stops[0]?.color ?? '#141414' };

function build(pieces: Piece[], name: string): VPath[] {
  return pieces.map((p) => geomToPath(p.geom, p.style, name)).filter((x): x is VPath => !!x);
}

/** Run one pathfinder operation. Inputs without a closed area (plain lines) are ignored. */
export function runPathfinder(op: PfOp, input: VPath[]): PfResult {
  const paths = input.filter(isShape);
  if (paths.length < PF_MIN[op]) return { ok: false, msg: paths.length ? `${PF_LABEL[op]} needs more shapes` : 'Select closed shapes first' };
  try {
    const geoms = paths.map(closedGeom);
    const styles = paths.map((p) => p.style);
    const n = paths.length;
    const top = paths[n - 1];
    const single = (g: PItem | null, style: VStyle): PfResult => {
      const v = g && areaOf(g) > MIN_AREA ? geomToPath(g, structuredClone(style), 'Path') : null;
      return v ? { ok: true, paths: [v], grouped: false } : { ok: false, msg: 'Nothing left after that' };
    };
    switch (op) {
      case 'unite':
        return single(uniteAll(geoms), top.style);
      case 'minusFront': {
        let acc: PItem = geoms[0].clone(NO);
        for (let i = 1; i < n; i++) acc = acc.subtract(geoms[i], NO);
        return single(acc, paths[0].style);
      }
      case 'minusBack': {
        let acc: PItem = geoms[n - 1].clone(NO);
        for (let i = 0; i < n - 1; i++) acc = acc.subtract(geoms[i], NO);
        return single(acc, top.style);
      }
      case 'intersect': {
        let acc: PItem = geoms[0].clone(NO);
        for (let i = 1; i < n; i++) acc = acc.intersect(geoms[i], NO);
        return single(acc, top.style);
      }
      case 'exclude': {
        let acc: PItem = geoms[0].clone(NO);
        for (let i = 1; i < n; i++) acc = acc.exclude(geoms[i], NO);
        return single(acc, top.style);
      }
      case 'divide':
      case 'outline': {
        let pieces = divideRegions(geoms, styles);
        if (op === 'outline')
          pieces = pieces.map((p) => ({
            geom: p.geom,
            style: { ...structuredClone(p.style), fill: null, stroke: solidOf(p.style.fill) ?? solidOf(p.style.stroke) ?? { kind: 'solid', color: '#141414' }, width: 1, dash: [] },
          }));
        const out = build(pieces, op === 'divide' ? 'Piece' : 'Outline');
        return out.length ? { ok: true, paths: out, grouped: true } : { ok: false, msg: 'Nothing to divide' };
      }
      case 'trim':
      case 'merge': {
        let pieces = trimPieces(geoms, styles);
        if (op === 'merge') pieces = mergePieces(pieces);
        const out = build(pieces, op === 'trim' ? 'Trimmed' : 'Merged');
        return out.length ? { ok: true, paths: out, grouped: true } : { ok: false, msg: 'Nothing left after that' };
      }
      case 'crop': {
        const mask = geoms[n - 1];
        const pieces: Piece[] = [];
        for (let i = 0; i < n - 1; i++) for (const r of regions(geoms[i].intersect(mask, NO))) pieces.push({ geom: r, style: noStroke(styles[i]) });
        const out = build(pieces, 'Cropped');
        return out.length ? { ok: true, paths: out, grouped: true } : { ok: false, msg: 'Nothing inside the top shape' };
      }
    }
  } catch (err) {
    console.warn('pathfinder failed', op, err);
    return { ok: false, msg: `${PF_LABEL[op]} could not finish on these shapes` };
  }
}
