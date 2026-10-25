import { smooth, type TorsoProfile, type Vec } from '../model/figure';
import type { Garment } from '../model/garment';
import { mix } from '../model/color';
import { topForward, torsoPt, type TopShape } from '../model/top';

/** Everything the block specific drawing needs, in canvas space. */
export interface DetailCtx {
  g: Garment;
  t: TorsoProfile;
  shape: TopShape;
  stiff: number;
  rendered: boolean;
  view: 'front' | 'back';
  base: string;
  dark: boolean;
  /** Fabric fill (pattern in rendered mode). */
  fill: string;
  /** Body outline colour. */
  outline: string;
  hemV: number;
}

export const f1 = (n: number) => n.toFixed(1);
export const line = (pts: Vec[], closed = false) => (pts.length ? 'M' + pts.map((p) => `${f1(p.x)},${f1(p.y)}`).join(' L') + (closed ? ' Z' : '') : '');

export function helpers(c: DetailCtx) {
  const F = (u: number, v: number): Vec => topForward(c.t, torsoPt(u, v), c.stiff);
  /** A point sitting h canvas units above the shoulder line at u. */
  const U = (u: number, h: number): Vec => {
    const p = F(u, 0);
    return { x: p.x, y: p.y - h };
  };
  const A = (s: -1 | 1, a: number, o: number): Vec => topForward(c.t, { x: a * 100, y: 100 + o * 100, r: s < 0 ? 'armL' : 'armR' }, c.stiff);
  const ink = c.dark ? mix(c.base, '#ffffff', 0.5) : c.rendered ? c.outline : '#141414';
  const metal = c.dark ? '#cfcfd2' : '#7a7a7a';
  return { F, U, A, ink, metal };
}

/** Body hem as a polyline: the longest hem run. */
export function bodyHem(shape: TopShape): Vec[] {
  return shape.hems.reduce<Vec[]>((best, h) => (h.length > best.length ? h : best), []);
}

/** Band running up from the hem, as a closed polygon wider than the body (the body clip trims it). */
export function hemBand(shape: TopShape, h: number): { poly: Vec[]; top: Vec[]; hem: Vec[] } {
  const hem = bodyHem(shape);
  if (hem.length < 2) return { poly: [], top: [], hem: [] };
  const first = hem[0], last = hem[hem.length - 1];
  const ext = [{ x: first.x - 3, y: first.y }, ...hem, { x: last.x + 3, y: last.y }];
  const top = ext.map((p) => ({ x: p.x, y: p.y - h }));
  return { poly: [...ext, ...[...top].reverse()], top, hem: ext };
}

export const ribLines = (top: Vec[], hem: Vec[], step: number): string => {
  let d = '';
  for (let i = 0; i < hem.length; i += 1) {
    if (i % step) continue;
    d += `M${f1(top[i].x)},${f1(top[i].y)} L${f1(hem[i].x)},${f1(hem[i].y)} `;
  }
  return d;
};

/** Zipper: dashed teeth along a path with a pull at the start. */
export function Zip({ pts, c, pull = true, w = 2 }: { pts: Vec[]; c: DetailCtx; pull?: boolean; w?: number }) {
  const { ink, metal } = helpers(c);
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[1];
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return (
    <g fill="none" strokeLinecap="round" pointerEvents="none">
      <path d={smooth(pts)} stroke={ink} strokeWidth={w + 1.2} opacity={0.55} />
      <path d={smooth(pts)} stroke={c.rendered ? metal : ink} strokeWidth={w} strokeDasharray="0.9 1.1" />
      {pull && (
        <g transform={`translate(${f1(a.x)} ${f1(a.y)}) rotate(${f1(ang)})`}>
          <path d="M-1,-1.6 L-6,-2.6 L-6,2.6 L-1,1.6 Z" fill={c.rendered ? metal : c.fill} stroke={ink} strokeWidth={0.6} />
          <circle cx={-6.8} cy={0} r={1.1} fill="none" stroke={ink} strokeWidth={0.6} />
        </g>
      )}
    </g>
  );
}

/** Stitch line (dashed) in the detail colour. */
export const Stitch = ({ d, c, o = 0.7, w = 0.6 }: { d: string; c: DetailCtx; o?: number; w?: number }) => {
  const { ink } = helpers(c);
  return <path d={d} fill="none" stroke={ink} strokeWidth={w} strokeDasharray="1.8 1.4" opacity={o} pointerEvents="none" />;
};

export function RibBand({ poly, top, hem, c, id }: { poly: Vec[]; top: Vec[]; hem: Vec[]; c: DetailCtx; id: string }) {
  const { ink } = helpers(c);
  const trim = c.rendered ? mix(c.base, c.dark ? '#ffffff' : '#000000', c.dark ? 0.1 : 0.07) : c.fill;
  return (
    <g pointerEvents="none">
      <path d={line(poly, true)} fill={trim} />
      <path d={ribLines(top, hem, 1)} stroke={ink} strokeWidth={0.5} opacity={c.rendered ? 0.35 : 0.5} fill="none" />
      <path d={line(top)} fill="none" stroke={c.outline} strokeWidth={0.9} opacity={0.9} />
      <path d={line(hem)} fill="none" stroke={c.outline} strokeWidth={0.9} opacity={0.9} />
      <title>{id}</title>
    </g>
  );
}

/** Rib cuff on a sleeve: polygon in arm space with rib lines running along the arm. */
export function Cuff({ c, s, a0, a1, o0, o1 }: { c: DetailCtx; s: -1 | 1; a0: number; a1: number; o0: number; o1: number }) {
  const { A, ink } = helpers(c);
  const trim = c.rendered ? mix(c.base, c.dark ? '#ffffff' : '#000000', c.dark ? 0.1 : 0.07) : c.fill;
  const edge = (a: number) => o0 + ((o1 - o0) * (a - a0)) / (a1 - a0 || 1);
  const n = 6;
  const L: Vec[] = [], R: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    L.push(A(s, a, -edge(a)));
    R.push(A(s, a, edge(a)));
  }
  const poly = [...L, ...[...R].reverse()];
  let ribs = '';
  for (let k = 1; k < 8; k++) {
    const o = -1 + (2 * k) / 8;
    const p0 = A(s, a0, o * edge(a0)), p1 = A(s, a1, o * edge(a1));
    ribs += `M${f1(p0.x)},${f1(p0.y)} L${f1(p1.x)},${f1(p1.y)} `;
  }
  return (
    <g pointerEvents="none">
      <path d={smooth(poly, true)} fill={trim} />
      <path d={ribs} stroke={ink} strokeWidth={0.5} opacity={c.rendered ? 0.35 : 0.5} fill="none" />
      <path d={`M${f1(L[0].x)},${f1(L[0].y)} L${f1(R[0].x)},${f1(R[0].y)}`} stroke={c.outline} strokeWidth={0.9} fill="none" />
    </g>
  );
}

export const sleeveEdge = (a1: number, cuffO: number) => (a: number) => 1.04 + ((cuffO - 1.04) * (a - 0.1)) / (a1 - 0.1);

