// Tops are stored in body-relative space so they fit whatever croquis and pose they land on.
//
// Torso points: x = 150 + u * 100, y = 100 + v * 200. u is -1 at the body's left edge and +1 at the
// right edge (beyond 1 is ease). v is 0 at the neck base, 1 at the waist, 1.5 at the hip.
// Sleeve points (r = 'armL' or 'armR'): x = a * 100 along the arm (0 shoulder, 1 elbow, 2 wrist),
// y = 100 + o * 100 across it (-1 outer edge, +1 inner edge, beyond is ease).

import type { TorsoProfile, Vec } from './figure';
import type { Pt } from './garment';

export type TopBlock = 'Tank' | 'Tee' | 'Long sleeve';
export type TopFit = 'Fitted' | 'Regular' | 'Oversized';
export type TopLength = 'Crop' | 'Waist' | 'Hip' | 'Long';
export type NeckKind = 'Crew' | 'Scoop' | 'V';
export const TOP_BLOCKS: TopBlock[] = ['Tank', 'Tee', 'Long sleeve'];
export const TOP_FITS: TopFit[] = ['Fitted', 'Regular', 'Oversized'];
export const TOP_LENGTHS: TopLength[] = ['Crop', 'Waist', 'Hip', 'Long'];
export const NECKS: NeckKind[] = ['Crew', 'Scoop', 'V'];

export interface TopOpts {
  block: TopBlock;
  fit: TopFit;
  length: TopLength;
  neck: NeckKind;
  tuck: boolean;
}

export const torsoPt = (u: number, v: number, key?: string): Pt => ({ x: 150 + u * 100, y: 100 + v * 200, ...(key ? { key } : {}) });
const armPt = (side: 'armL' | 'armR', a: number, o: number, key?: string): Pt => ({ x: a * 100, y: 100 + o * 100, r: side, ...(key ? { key } : {}) });
export const uv = (p: { x: number; y: number }) => ({ u: (p.x - 150) / 100, v: (p.y - 100) / 200 });

const EASE: Record<TopFit, { body: number; waist: number; sleeve: number; shoulder: number; drop: number }> = {
  Fitted: { body: 1.04, waist: 1.0, sleeve: 1.1, shoulder: 1.04, drop: 0 },
  Regular: { body: 1.1, waist: 1.1, sleeve: 1.26, shoulder: 1.07, drop: 0.03 },
  Oversized: { body: 1.26, waist: 1.3, sleeve: 1.55, shoulder: 1.2, drop: 0.12 },
};
const LENGTH_V: Record<TopLength, number> = { Crop: 0.8, Waist: 1.04, Hip: 1.42, Long: 1.7 };
const NECK_V: Record<NeckKind, number> = { Crew: 0.07, Scoop: 0.17, V: 0.27 };

/** Keyed outline points, clockwise from the left neck, ending at the front neck point. */
export function buildTopPoints(o: TopOpts): Pt[] {
  const e = EASE[o.fit];
  const len = o.tuck ? 1.12 : LENGTH_V[o.length];
  const neckW = o.block === 'Tank' ? 0.36 : 0.3;
  const side = (s: -1 | 1): Pt[] => {
    const k = s < 0 ? 'L' : 'R';
    const arm = s < 0 ? 'armL' : 'armR';
    const out: Pt[] = [];
    if (o.block === 'Tank') {
      out.push(torsoPt(s * 0.6, 0.02, `strap${k}`));
      out.push(torsoPt(s * e.body, 0.36, `arm${k}`));
    } else {
      const sleeveLen = o.block === 'Long sleeve' ? 2.02 : o.fit === 'Fitted' && o.length === 'Crop' ? 0.3 : 0.44;
      out.push(torsoPt(s * e.shoulder, -0.015, `sh${k}`));
      // sleeves open out a little toward the hem
      out.push(armPt(arm, sleeveLen + e.drop, -(e.sleeve + 0.14), `slO${k}`));
      out.push(armPt(arm, sleeveLen + e.drop - 0.05, e.sleeve + 0.06, `slI${k}`));
      out.push(torsoPt(s * e.body, 0.32 + e.drop, `arm${k}`));
    }
    out.push(torsoPt(s * (o.length === 'Crop' && !o.tuck ? e.body * 0.97 : e.waist), Math.min(1, len - 0.02), `side${k}`));
    out.push(torsoPt(s * (len > 1.2 ? Math.max(e.waist, e.body) * 1.04 : e.waist), len, `hem${k}`));
    return out;
  };
  const left = side(-1);
  const right = side(1).reverse();
  return [torsoPt(-neckW, -0.01, 'neckL'), ...left, ...right, torsoPt(neckW, -0.01, 'neckR'), torsoPt(0, NECK_V[o.neck] + (o.block === 'Tank' ? 0.06 : 0), 'neckF')];
}

// ---------- mapping onto the body ----------

function sideX(pts: Vec[], y: number): number {
  if (y <= pts[0].y) return pts[0].x;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (y <= b.y) return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  return b.x + ((y - b.y) / (b.y - a.y || 1)) * (b.x - a.x) * 0.5;
}

/** Body left and right edge x at canvas y, above the armpit running up to the shoulder tip. */
function edges(t: TorsoProfile, y: number): [number, number] {
  const e = (s: 0 | 1) => {
    const tip = t.tip[s], pit = t.armpit[s];
    if (y < pit.y) {
      const k = Math.max(0, Math.min(1, (y - tip.y) / (pit.y - tip.y || 1)));
      return tip.x + (pit.x - tip.x) * k;
    }
    return sideX(t.sides[s], y);
  };
  return [e(0), e(1)];
}

const neckY = (t: TorsoProfile) => (t.neck[0].y + t.neck[1].y) / 2;

function vToY(t: TorsoProfile, v: number, u: number): number {
  const yN = neckY(t);
  let y = v <= 1 ? yN + v * (t.waistY - yN) : t.waistY + ((v - 1) / 0.5) * (t.hipY - t.waistY);
  // the shoulder line slopes down from the neck to the shoulder tip
  // the shoulder is rounded: it stays high, then drops toward the tip
  const k = Math.min(1.2, Math.max(0, (Math.abs(u) - 0.3) / 0.7));
  const tipDrop = ((t.tip[0].y + t.tip[1].y) / 2 - yN) * Math.pow(k, 1.8) - 2 * (1 - Math.min(1, v * 6));
  const vPit = ((t.armpit[0].y + t.armpit[1].y) / 2 - yN) / (t.waistY - yN);
  y += tipDrop * Math.max(0, 1 - v / vPit);
  return y;
}

function armHalf(arm: TorsoProfile['arms'][0], a: number): number {
  const h = arm.half;
  if (a <= h[0][0]) return h[0][1];
  for (let i = 0; i < h.length - 1; i++) if (a <= h[i + 1][0]) return h[i][1] + ((a - h[i][0]) / (h[i + 1][0] - h[i][0] || 1)) * (h[i + 1][1] - h[i][1]);
  return h[h.length - 1][1];
}

function armFrame(arm: TorsoProfile['arms'][0], a: number) {
  const seg = a <= 1 ? 0 : 1;
  const A = arm.bones[seg], B = arm.bones[seg + 1];
  const t = a - seg;
  const dx = B.x - A.x, dy = B.y - A.y;
  const L = Math.hypot(dx, dy) || 1;
  const u = { x: dx / L, y: dy / L };
  return { base: { x: A.x + dx * t, y: A.y + dy * t }, n: { x: u.y, y: -u.x }, u, A, L, seg };
}

/** Body half width at y, stiffened toward the chest width so looser tops hang straight. */
function halfAt(t: TorsoProfile, y: number, stiff: number): { c: number; h: number } {
  const [l, r] = edges(t, y);
  let h = (r - l) / 2;
  const c = (l + r) / 2;
  if (stiff > 0) {
    const yc = Math.max(...t.armpit.map((p) => p.y)) + 6;
    if (y > yc) {
      const [cl, cr] = edges(t, yc);
      h = h + (Math.max(h, (cr - cl) / 2) - h) * stiff;
    }
  }
  return { c, h };
}

/** Top space to posed canvas. stiff: 0 hugs the body, 1 hangs straight from the chest. */
export function topForward(t: TorsoProfile, p: Pt, stiff = 0): Vec {
  if (p.r === 'armL' || p.r === 'armR') {
    const s = p.r === 'armL' ? 0 : 1;
    const arm = t.arms[s];
    const a = p.x / 100, o = (p.y - 100) / 100;
    const f = armFrame(arm, a);
    const off = o * armHalf(arm, a) * (s === 0 ? 1 : -1);
    return { x: f.base.x + f.n.x * off, y: f.base.y + f.n.y * off };
  }
  const { u, v } = uv(p);
  const y = vToY(t, v, u);
  const { c, h } = halfAt(t, y, stiff);
  return { x: c + u * h, y };
}

/** Posed canvas back to top space, in the given region. */
export function topInverse(t: TorsoProfile, q: Vec, region?: Pt['r'], stiff = 0): Pt {
  if (region === 'armL' || region === 'armR') {
    const s = region === 'armL' ? 0 : 1;
    const arm = t.arms[s];
    let best = { a: 0, o: 0, d: Infinity };
    for (const seg of [0, 1]) {
      const A = arm.bones[seg], B = arm.bones[seg + 1];
      const dx = B.x - A.x, dy = B.y - A.y;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      let tt = ((q.x - A.x) * ux + (q.y - A.y) * uy) / L;
      const clamped = Math.max(seg === 0 ? -0.3 : 0, Math.min(seg === 0 ? 1 : 1.3, tt));
      const bx = A.x + dx * clamped, by = A.y + dy * clamped;
      const d = Math.hypot(q.x - bx, q.y - by);
      if (d < best.d) {
        tt = clamped;
        const a = seg + tt;
        const off = (q.x - bx) * uy + (q.y - by) * -ux;
        best = { a, o: (off / armHalf(arm, a)) * (s === 0 ? 1 : -1), d };
      }
    }
    return { x: best.a * 100, y: 100 + best.o * 100, r: region };
  }
  // solve v from y (the shoulder slope depends on u), then u from x
  let u = 0, v = 0;
  for (let i = 0; i < 6; i++) {
    const yN = neckY(t);
    // invert the piecewise v to y, then correct for the slope
    const y0 = q.y - (vToY(t, v, u) - (v <= 1 ? yN + v * (t.waistY - yN) : t.waistY + ((v - 1) / 0.5) * (t.hipY - t.waistY)));
    v = y0 <= t.waistY ? (y0 - yN) / (t.waistY - yN) : 1 + ((y0 - t.waistY) / (t.hipY - t.waistY)) * 0.5;
    const { c, h } = halfAt(t, q.y, stiff);
    u = (q.x - c) / (h || 1);
  }
  return torsoPt(u, v);
}

// ---------- outline for drawing ----------

const lerpPt = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, ...(a.r ? { r: a.r } : {}) });
const quad = (a: Pt, c: Pt, b: Pt, k: number): Pt => ({
  x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * c.x + k * k * b.x,
  y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * c.y + k * k * b.y,
  ...(a.r ? { r: a.r } : {}),
});

export interface TopShape {
  /** Closed outline in canvas space. */
  outline: Vec[];
  /** Index into outline for each original point. */
  index: number[];
  /** Open polylines in canvas space for the neckline, armholes and sleeve and body hems. */
  neckline: Vec[];
  hems: Vec[][];
  /** Sleeve shapes (canvas), for shading the underside. */
  sleeves: Vec[][];
}

/** Map the top onto the body, adding in-between points so every edge follows the body. */
/** How straight a fit hangs. */
export const stiffOf = (o?: TopOpts) => (o?.fit === 'Oversized' ? 1 : o?.fit === 'Regular' ? 0.65 : 0);

export function topShape(t: TorsoProfile, points: Pt[], stiff = 0): TopShape {
  const n = points.length;
  const F = (p: Pt) => topForward(t, p, stiff);
  const outline: Vec[] = [];
  const index: number[] = new Array(n).fill(0);
  const iNF = points.findIndex((p) => p.key === 'neckF');
  const neckline: Vec[] = [];
  const hems: Vec[][] = [];
  const sleeveRun: { L: Vec[]; R: Vec[] } = { L: [], R: [] };
  const key = (p: Pt) => p.key ?? '';

  for (let i = 0; i < n; i++) {
    if (i === iNF) continue;
    const a = points[i];
    let b = points[(i + 1) % n];
    const steps: Pt[] = [];
    if (a.key === 'neckR' && iNF >= 0) {
      // neckline: one curve from neckR through neckF round to neckL
      const f = points[iNF];
      b = points[(iNF + 1) % n];
      const c = { x: 2 * f.x - (a.x + b.x) / 2, y: 2 * f.y - (a.y + b.y) / 2 } as Pt;
      for (let k = 1; k < 16; k++) steps.push(quad(a, c, b, k / 16));
      index[i] = outline.length;
      outline.push(F(a));
      index[iNF] = outline.length + 7;
      steps.forEach((p) => outline.push(F(p)));
      neckline.push(F(a), ...steps.map(F), F(b));
      continue;
    }
    if ((a.r ?? 't') === (b.r ?? 't')) {
      const armhole = (/^strap/.test(key(a)) && /^arm/.test(key(b))) || (/^arm/.test(key(a)) && /^strap/.test(key(b)));
      const cnt = 10;
      if (armhole) {
        const strap = /^strap/.test(key(a)) ? a : b, pit = strap === a ? b : a;
        const c = torsoPt(uv(strap).u * 1.02, uv(pit).v * 0.92);
        for (let k = 1; k < cnt; k++) steps.push(quad(a, c, b, k / cnt));
      } else {
        for (let k = 1; k < cnt; k++) steps.push(lerpPt(a, b, k / cnt));
      }
    } else {
      // shoulder to sleeve or sleeve to underarm: run along the arm so the sleeve wraps it
      const arm = (a.r ?? b.r) as 'armL' | 'armR';
      const tp = a.r ? b : a, ap = a.r ? a : b;
      const start = topInverse(t, F(tp), arm, stiff);
      const runA = Math.max(0.04, Math.min(start.x / 100, 0.14));
      // the cap hugs the arm (outer side from the shoulder, inner side from the underarm) and eases out to the hem
      const oHem = (ap.y - 100) / 100;
      const oCap = /^sh/.test(key(tp)) ? -1.04 : 0.8;
      const mid: Pt[] = [];
      for (let k = 1; k <= 6; k++) {
        const f = k / 7;
        mid.push({ x: (runA + (ap.x / 100 - runA) * f) * 100, y: 100 + (oCap + (oHem - oCap) * f) * 100, r: arm });
      }
      if (a.r) mid.reverse();
      steps.push(...mid);
    }
    index[i] = outline.length;
    outline.push(F(a));
    steps.forEach((p) => outline.push(F(p)));
    if ((key(a) === 'slOL' && key(b) === 'slIL') || (key(a) === 'slIR' && key(b) === 'slOR')) hems.push([F(a), F(b)]);
    if (key(a) === 'hemL' && key(b) === 'hemR') hems.push([F(a), ...steps.map(F), F(b)]);
    if (a.r === 'armL' || b.r === 'armL') sleeveRun.L.push(F(a), ...steps.map(F));
    if (a.r === 'armR' || b.r === 'armR') sleeveRun.R.push(F(a), ...steps.map(F));
  }
  // where an arm hangs over the body, keep the sleeve's inner edge on the body's side seam
  // instead of drawing a seam line across the front
  const ease = (k: string) => Math.abs(uv(points.find((p) => p.key === k) ?? torsoPt(1, 0)).u);
  const eL = ease('armL'), eR = ease('armR');
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i === iNF) continue;
    const a = points[i];
    const start = index[i];
    const end = i + 1 < n && i + 1 !== iNF ? index[i + 1] : outline.length;
    const b = points[(i + 1) % n];
    const inner = (/^slI/.test(key(a)) && /^arm/.test(key(b))) || (/^arm/.test(key(a)) && /^slI/.test(key(b)));
    if (inner) {
      // the run between the sleeve's inner hem and the underarm
      const side = (a.r ?? b.r) as 'armL' | 'armR';
      for (j = start; j <= Math.min(end, outline.length - 1); j++) {
        const p = outline[j];
        const { c, h } = halfAt(t, p.y, stiff);
        if (side === 'armL') outline[j] = { x: Math.min(p.x, c - h * eL), y: p.y };
        else outline[j] = { x: Math.max(p.x, c + h * eR), y: p.y };
      }
    }
  }
  const sleeves = [sleeveRun.L, sleeveRun.R].filter((x) => x.length > 2);
  return { outline, index, neckline, hems, sleeves };
}

// ---------- spec ----------

const half = (n: number) => (Math.round(n * 2) / 2).toString();

export function computeTopSpec(points: Pt[], t: TorsoProfile): { k: string; v: string }[] {
  const at = (k: string) => points.find((p) => p.key === k);
  const aL = at('armL'), aR = at('armR'), hL = at('hemL'), hR = at('hemR');
  const sL = at('shL') ?? at('strapL'), sR = at('shR') ?? at('strapR');
  const slO = at('slOL');
  const rows: { k: string; v: string }[] = [];
  if (aL && aR) rows.push({ k: 'Chest', v: `${half((t.inches.chest * (uv(aR).u - uv(aL).u)) / 2)} in` });
  if (hL && hR) rows.push({ k: 'Hem', v: `${half((t.inches.chest * 0.92 * (uv(hR).u - uv(hL).u)) / 2)} in` });
  if (sL && sR) rows.push({ k: 'Shoulder', v: `${half((t.inches.shoulder * (uv(sR).u - uv(sL).u)) / 2)} in` });
  if (hL) {
    const v = uv(hL).v;
    const len = v <= 1 ? v * t.inches.torso : t.inches.torso + (v - 1) * 2 * 7;
    rows.push({ k: 'Body length', v: `${half(len + 2)} in` });
  }
  if (slO) rows.push({ k: 'Sleeve', v: `${half((slO.x / 100) * (t.inches.arm / 2))} in` });
  return rows;
}
