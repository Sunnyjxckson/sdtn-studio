// Marker estimate: lay the cut pieces on a fabric width and report the length used per size.
import type { Garment } from './garment';
import type { TorsoProfile } from './figure';
import { rawFor, SIZES, type SheetOpts, type SizeName } from './pattern';
import { area, bbox, rowSpans, type P } from './patternGeo';

export interface MarkerRow {
  size: SizeName;
  lengthIn: number;
  yards: number;
  efficiency: number;
  pieces: number;
  tooWide: boolean;
}

const RES = 0.25;
const GAP = 0.25;
type Span = ([number, number] | null)[];

function spansOf(poly: P[], fold: boolean): { spans: Span; w: number; h: number; area: number } {
  const bb = bbox(poly);
  const rows = Math.ceil((bb.y1 - bb.y0) / RES) + 1;
  const raw = rowSpans(poly.map((p) => [p[0], p[1]] as P), RES, bb.y0, rows);
  if (fold) {
    const spans = raw.map((s) => (s ? ([-s[1], s[1]] as [number, number]) : null));
    return { spans: spans.map((s) => (s ? [s[0] - bb.x0 * 0 - 0, s[1]] : s)) as Span, w: bb.x1 * 2, h: bb.y1 - bb.y0, area: Math.abs(area(poly)) * 2 };
  }
  return { spans: raw.map((s) => (s ? ([s[0] - bb.x0, s[1] - bb.x0] as [number, number]) : null)), w: bb.x1 - bb.x0, h: bb.y1 - bb.y0, area: Math.abs(area(poly)) };
}

const rot180 = (poly: P[]): P[] => poly.map((p) => [-p[0], -p[1]] as P);

export function layMarker(items: { poly: P[]; fold: boolean; cut: number }[], fabricW: number) {
  const usable = Math.max(10, fabricW - 1);
  type Piece = { a: ReturnType<typeof spansOf>; b: ReturnType<typeof spansOf>; fold: boolean };
  const copies: Piece[] = [];
  for (const it of items) {
    const a = spansOf(it.poly, it.fold);
    // a folded piece mirrors about x = 0, so its rotated copy is the same shape
    const b = it.fold ? a : spansOf(rot180(it.poly), false);
    for (let i = 0; i < it.cut; i++) copies.push({ a: i % 2 ? b : a, b: a, fold: it.fold });
  }
  copies.sort((p, q) => q.a.area - p.a.area);
  const occ: [number, number][][] = [];
  let used = 0, areaSum = 0, tooWide = false;
  const fits = (s: ReturnType<typeof spansOf>, x: number, r0: number) => {
    for (let j = 0; j < s.spans.length; j++) {
      const sp = s.spans[j];
      if (!sp) continue;
      const row = occ[r0 + j];
      if (!row) continue;
      const lo = x + sp[0] - GAP, hi = x + sp[1] + GAP;
      for (const [a, b] of row) if (lo < b && hi > a) return false;
    }
    return true;
  };
  for (const c of copies) {
    const s = c.a;
    if (s.w > usable) tooWide = true;
    // fold pieces keep their span relative to the fold line at x = 0, so shift by half the width
    const shift = c.fold ? s.w / 2 : 0;
    let done = false;
    for (let y = 0; !done && y < 2000; y += 0.5) {
      const r0 = Math.round(y / RES);
      for (let x = 0; x <= Math.max(0, usable - s.w) + 1e-6; x += 0.5) {
        if (!fits(s, x + shift, r0)) continue;
        for (let j = 0; j < s.spans.length; j++) {
          const sp = s.spans[j];
          if (!sp) continue;
          (occ[r0 + j] ??= []).push([x + shift + sp[0], x + shift + sp[1]]);
        }
        used = Math.max(used, (r0 + s.spans.length) * RES);
        areaSum += s.area;
        done = true;
        break;
      }
      if (tooWide && !done && y > 4) {
        // cannot ever fit: place it anyway at the end
        used = Math.max(used, y + s.h);
        done = true;
      }
    }
  }
  return { length: used, efficiency: areaSum / (usable * Math.max(1, used)), tooWide };
}

export function markerEstimate(g: Garment, t: TorsoProfile, opts: SheetOpts, fabricW: number, sizes: readonly SizeName[] = SIZES): MarkerRow[] {
  return sizes.map((size) => {
    const items = rawFor(g, t, size, opts).map(({ raw, allow }) => ({ poly: allow, fold: !!raw.fold, cut: raw.cut }));
    const m = layMarker(items, fabricW);
    const lengthIn = m.length + 2;
    return {
      size,
      lengthIn,
      yards: Math.ceil((lengthIn / 36) * 8) / 8,
      efficiency: m.efficiency,
      pieces: items.reduce((a, i) => a + i.cut, 0),
      tooWide: m.tooWide,
    };
  });
}
