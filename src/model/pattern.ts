// Sewing pattern sheet: pieces from the garment, graded to sizes, laid out at real scale.
// All construction is in inches; the placed output is in pixels at 96 px per inch.
import type { Garment } from './garment';
import type { TorsoProfile } from './figure';
import { offsetEdges, nearestEdge, bbox, dedupe, type P } from './patternGeo';
import { piecesFor, saFor, SIZES, DEFAULT_RULES, type GradeRules, type RawPiece, type SizeName } from './patternPieces';

export { SIZES, DEFAULT_RULES, RULE_LABELS, measures } from './patternPieces';
export type { GradeRules, SizeName, Measures } from './patternPieces';
export const PPI = 96;
export const SEAM_ALLOWANCE = 0.375;

export interface SheetOpts {
  /** The size shown (and labelled) when not nested. */
  size: SizeName;
  /** The size the garment is drawn at. */
  base: SizeName;
  rules: GradeRules;
  nested: boolean;
  /** Sizes drawn when nested. */
  sizes: SizeName[];
  maxRowIn: number;
}
export const defaultOpts = (): SheetOpts => ({ size: 'M', base: 'M', rules: { ...DEFAULT_RULES }, nested: false, sizes: ['S', 'M', 'L'], maxRowIn: 38 });

export interface PlacedPiece {
  id: string;
  name: string;
  size: SizeName;
  /** Draws the name and cut count (one size per nested group). */
  primary: boolean;
  cut: number;
  cutText: string;
  notes: string[];
  /** Placed on the sheet, inches. */
  seam: P[];
  allowance: P[];
  grain: [P, P];
  notches: P[][];
  lines: { pts: P[]; kind: 'pleat' | 'place' | 'fold' | 'mark' }[];
  foldEdge: [P, P] | null;
  label: P;
  widthIn: number;
  heightIn: number;
  fold: boolean;
  mirror: boolean;
}

export interface Sheet {
  pieces: PlacedPiece[];
  wIn: number;
  hIn: number;
  w: number;
  h: number;
  ruler: number;
  sizes: SizeName[];
  nested: boolean;
  activeSize: SizeName;
  title: string;
}

export const sortSizes = (s: SizeName[]) => [...s].sort((a, b) => SIZES.indexOf(a) - SIZES.indexOf(b));

interface Built {
  raw: RawPiece;
  seam: P[];
  allow: P[];
  notchTris: P[][];
}

function build(r: RawPiece): Built {
  const seam = dedupe(r.poly);
  const fn = saFor({ ...r, poly: seam });
  const d = seam.map((a, i) => fn(a, seam[(i + 1) % seam.length]));
  const allow = offsetEdges(seam, d);
  const tris: P[][] = [];
  for (const np of r.notches) {
    const e = nearestEdge(seam, np);
    if (d[e.i] < 0.01) continue;
    const { at, normal: nn, tangent: t } = e;
    const w = 0.07, len = Math.min(0.28, d[e.i] * 0.8);
    tris.push([
      [at[0] - t[0] * w, at[1] - t[1] * w],
      [at[0] + nn[0] * len, at[1] + nn[1] * len],
      [at[0] + t[0] * w, at[1] + t[1] * w],
    ]);
  }
  return { raw: r, seam, allow, notchTris: tris };
}

export function cutText(r: Pick<RawPiece, 'cut' | 'fold' | 'mirror'>): string {
  if (r.fold) return `cut ${r.cut} on fold`;
  if (r.mirror && r.cut > 1) return `cut ${r.cut}, mirror pair`;
  return `cut ${r.cut}`;
}

export function sheetTitle(g: Garment): string {
  return g.name;
}

export function buildSheet(g: Garment, t: TorsoProfile, opts: SheetOpts): Sheet {
  const sizes: SizeName[] = opts.nested ? sortSizes(opts.sizes.length ? opts.sizes : [opts.size]) : [opts.size];
  const active: SizeName = sizes.includes(opts.size) ? opts.size : sizes.includes(opts.base) ? opts.base : sizes[0];
  const ruler = 0.6;
  const gap = 0.6;

  // build every size, then group by piece id so nested sizes share one spot
  const perSize = sizes.map((s) => ({ s, built: piecesFor(g, t, s, opts.base, opts.rules).map(build) }));
  const ids = perSize[0].built.map((b) => b.raw.id);
  const groups = ids.map((id) => {
    const members = perSize.map(({ s, built }) => ({ s, b: built.find((x) => x.raw.id === id) })).filter((m): m is { s: SizeName; b: Built } => !!m.b);
    const all = members.flatMap((m) => m.b.allow);
    const bb = bbox(all);
    return { id, members, bb, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 };
  });
  groups.sort((a, b) => b.h - a.h);

  let x = ruler, y = ruler, rowH = 0, maxX = 0;
  const placed: PlacedPiece[] = [];
  for (const grp of groups) {
    if (x > ruler && x + grp.w > opts.maxRowIn) {
      x = ruler;
      y += rowH + gap;
      rowH = 0;
    }
    const ox = x - grp.bb.x0, oy = y - grp.bb.y0;
    const T = (p: P): P => [p[0] + ox, p[1] + oy];
    for (const m of grp.members) {
      const r = m.b.raw;
      const bb = bbox(m.b.seam);
      const gr = r.grain;
      let g1: P, g2: P;
      if (gr.horizontal) {
        const span = gr.span ?? 5;
        g1 = [gr.x - span, gr.y ?? (bb.y0 + bb.y1) / 2];
        g2 = [gr.x + span, gr.y ?? (bb.y0 + bb.y1) / 2];
      } else {
        const y0 = gr.y ?? bb.y0 + (bb.y1 - bb.y0) * 0.14;
        g1 = [gr.x, y0];
        g2 = [gr.x, bb.y1 - (bb.y1 - bb.y0) * 0.1];
      }
      placed.push({
        id: r.id,
        name: r.name,
        size: m.s,
        primary: m.s === active,
        cut: r.cut,
        cutText: cutText(r),
        notes: r.notes ?? [],
        seam: m.b.seam.map(T),
        allowance: m.b.allow.map(T),
        grain: [T(g1), T(g2)],
        notches: m.b.notchTris.map((tri) => tri.map(T)),
        lines: (r.lines ?? []).map((l) => ({ kind: l.kind, pts: l.pts.map(T) })),
        foldEdge: r.fold ? [T([0, bb.y0 + (bb.y1 - bb.y0) * 0.12]), T([0, bb.y1 - (bb.y1 - bb.y0) * 0.12])] : null,
        label: T(r.label),
        widthIn: bb.x1 - bb.x0,
        heightIn: bb.y1 - bb.y0,
        fold: !!r.fold,
        mirror: !!r.mirror,
      });
    }
    x += grp.w + gap;
    maxX = Math.max(maxX, x - gap);
    rowH = Math.max(rowH, grp.h);
  }
  const wIn = Math.max(maxX + ruler, 20);
  const hIn = y + rowH + ruler + 1.6;
  return { pieces: placed, wIn, hIn, w: wIn * PPI, h: hIn * PPI, ruler, sizes, nested: opts.nested, activeSize: active, title: sheetTitle(g) };
}

export const toPath = (pts: P[], scale = PPI, close = true) =>
  'M' + pts.map((p) => `${(p[0] * scale).toFixed(1)},${(p[1] * scale).toFixed(1)}`).join(' L') + (close ? ' Z' : '');

/** Raw pieces for one size, for the marker and tests. */
export function rawFor(g: Garment, t: TorsoProfile, size: SizeName, opts: SheetOpts): { raw: RawPiece; allow: P[] }[] {
  return piecesFor(g, t, size, opts.base, opts.rules).map((r) => ({ raw: r, allow: build(r).allow }));
}
