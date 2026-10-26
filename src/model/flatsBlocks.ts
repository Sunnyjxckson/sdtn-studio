// Block specific drawing for flats: hoodie, moto jacket and dress on the tops engine, plus shorts and skirt.
// Everything is in flat sheet space (the same space topViews and jeansViews draw in).

import type { FlatAnchor, FlatShape } from './flats';
import type { Garment } from './garment';
import { ribHemOn, streetParts, styleParts } from './flatsStreet';
import { dressTopOf, silhouetteOf, sleeveKindOf, type TopOpts } from './top';

export interface V {
  x: number;
  y: number;
}

export interface BlockParts {
  /** Clipped to the body outline. */
  shapes: FlatShape[];
  /** Drawn before the body, not clipped (hood behind the neck, straps). */
  behind: FlatShape[];
  /** Drawn after the body, not clipped (hood bunched at the back). */
  over: FlatShape[];
  anchors: FlatAnchor[];
  /** Anchor keys of the plain top drawing that this block replaces. */
  drop: string[];
  /** Replacement label or description for plain anchors. */
  rename: Record<string, { label?: string; desc?: string }>;
  /** Extra points the drawing reaches, so the view box includes them. */
  extent: V[];
  noHemStitch?: boolean;
  noSleeveStitch?: boolean;
  /** The block draws its own sleeve seam (raglan), so the set-in armhole seam is left out. */
  noArmhole?: boolean;
}

export interface TopCtx {
  g: Garment;
  o: TopOpts;
  back: boolean;
  /** Torso space (u across, v down) to flat space. */
  T: (u: number, v: number) => V;
  at: (k: string) => V | undefined;
  hemV: number;
  hemY: number;
  /** Unit vector along the sleeve, pointing at the cuff, for each side. */
  dir: (k: 'L' | 'R') => V;
  /** Point on the neckline curve, 0 at the right neck point and 1 at the left. */
  neck: (t: number) => V;
}

export const f1 = (n: number) => n.toFixed(1);
export const P = (p: V) => `${f1(p.x)},${f1(p.y)}`;
export const poly = (pts: V[], closed = false) => 'M' + pts.map(P).join(' L') + (closed ? ' Z' : '');
export const lerp = (a: V, b: V, k: number): V => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
export const circle = (c: V, r: number) => `M${f1(c.x - r)},${f1(c.y)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
/** Smooth curve through points (Catmull Rom to bezier). */
export function curve(pts: V[], closed = false): string {
  if (pts.length < 3) return poly(pts, closed);
  const n = pts.length;
  const g = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${P(pts[0])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d + (closed ? ' Z' : '');
}

export const empty = (): BlockParts => ({ shapes: [], behind: [], over: [], anchors: [], drop: [], rename: {}, extent: [] });

/** Zip: a line with teeth beside it, and a pull at the start. */
export function zip(pts: V[], pull = true): FlatShape[] {
  const out: FlatShape[] = [
    { d: curve(pts), k: 'line' },
    { d: curve(pts), k: 'stitch', t: [2.2, 0] },
  ];
  if (pull) out.push({ d: circle({ x: pts[0].x, y: pts[0].y - 3 }, 2), k: 'line' });
  return out;
}

/** Short rib ticks between two parallel polylines. */
export function ticks(a: V[], b: V[], step: number): string {
  let d = '';
  for (let i = 0; i < a.length; i += step) d += `M${P(a[i])} L${P(b[i])} `;
  return d;
}

// ---------- hoodie ----------

export interface HoodieOpt { noRib?: boolean; noCuffs?: boolean; noPocket?: boolean }
export function hoodie(c: TopCtx, zipped = false, opt: HoodieOpt = {}): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V;
  const wide = c.o.fit === 'Oversized';
  r.noHemStitch = true;
  r.noSleeveStitch = true;
  r.drop.push('sleeve', 'hem');

  // hood
  if (!back) {
    const rise = 60;
    const d = `M${f1(nL.x - 3)},${f1(nL.y + 2)} C${f1(nL.x - 22)},${f1(nL.y - rise)} ${f1(nR.x + 22)},${f1(nR.y - rise)} ${f1(nR.x + 3)},${f1(nR.y + 2)} Z`;
    const rim = `M${f1(nL.x + 7)},${f1(nL.y)} C${f1(nL.x + 2)},${f1(nL.y - rise * 0.62)} ${f1(nR.x - 2)},${f1(nR.y - rise * 0.62)} ${f1(nR.x - 7)},${f1(nR.y)}`;
    r.behind.push({ d, k: 'edge', fill: true }, { d: rim, k: 'seam' }, { d: rim, k: 'stitch', t: [0, 3] });
    r.extent.push({ x: nL.x - 20, y: nL.y - rise * 0.72 }, { x: nR.x + 20, y: nR.y - rise * 0.72 });
    r.anchors.push({ key: 'hood', label: 'Hood', desc: 'Double layer hood, topstitched rim, eyelets for drawcords', x: 150 + (nR.x - nL.x) * 0.3, y: nL.y - rise * 0.7 });
  } else {
    const top = nL.y - 8;
    const lx = T(-0.62, 0).x, rx = T(0.62, 0).x;
    const bot = T(0, 0.22).y;
    const d =
      `M${f1(lx)},${f1(nL.y + 1)} C${f1(lx - 12)},${f1(top - 34)} ${f1(150 - 36)},${f1(top - 56)} 150,${f1(top - 56)} ` +
      `C${f1(150 + 36)},${f1(top - 56)} ${f1(rx + 12)},${f1(top - 34)} ${f1(rx)},${f1(nR.y + 1)} ` +
      `C${f1(rx - 14)},${f1(bot - 12)} ${f1(150 + 30)},${f1(bot)} 150,${f1(bot)} C${f1(150 - 30)},${f1(bot)} ${f1(lx + 14)},${f1(bot - 12)} ${f1(lx)},${f1(nL.y + 1)} Z`;
    r.over.push(
      { d, k: 'edge', fill: true },
      { d: `M150,${f1(top - 56)} L150,${f1(bot)}`, k: 'seam' },
      { d: `M${f1(lx + 10)},${f1(nL.y - 6)} C${f1(lx + 26)},${f1(top - 20)} ${f1(150 - 24)},${f1(top - 38)} ${f1(150 - 6)},${f1(top - 44)}`, k: 'stitch' },
      { d: `M${f1(rx - 10)},${f1(nR.y - 6)} C${f1(rx - 26)},${f1(top - 20)} ${f1(150 + 24)},${f1(top - 38)} ${f1(150 + 6)},${f1(top - 44)}`, k: 'stitch' },
    );
    r.extent.push({ x: lx - 8, y: top - 58 });
    r.anchors.push({ key: 'hood', label: 'Hood', desc: 'Lined hood with centre seam, topstitched', x: 150 + 34, y: top - 36 });
  }

  // drawcords and kangaroo pocket (front only)
  if (!back && zipped) {
    const nf = at('neckF') as V;
    const zp = [{ x: 150, y: nf.y + 2 }, { x: 150, y: (nf.y + hemY) / 2 }, { x: 150, y: hemY - 14 }];
    r.shapes.push(...zip(zp));
    r.shapes.push({ d: `M${f1(150 - 7)},${f1(nf.y + 4)} L${f1(150 - 7)},${f1(hemY - 14)}`, k: 'stitch' });
    for (const s of [-1, 1]) {
      const a = T(s * 0.5, hemV - 0.4), b = T(s * 0.62, hemV - 0.2);
      r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' }, { d: `M${P({ x: a.x - s * 3, y: a.y })} L${P({ x: b.x - s * 3, y: b.y })}`, k: 'stitch' });
    }
    for (const s of [-1, 1]) {
      const y0 = nf.y + 4;
      r.shapes.push({ d: circle({ x: 150 + s * 10, y: y0 }, 1.7), k: 'line' }, { d: `M${f1(150 + s * 10)},${f1(y0)} l${f1(s * 0.4)},30`, k: 'line' });
    }
    const pa = T(0.56, hemV - 0.3);
    r.anchors.push(
      { key: 'fzip', label: 'Front zip', desc: 'Metal two way zip, storm placket, topstitched', x: 150 + 1, y: (nf.y + hemY) / 2 },
      { key: 'cord', label: 'Drawcords', desc: 'Flat drawcords with metal tips, 2 eyelets at the neck', x: 150 + 12, y: nf.y + 20 },
      { key: 'slant', label: 'Slant pockets', desc: 'Hand pockets with angled openings, topstitched', x: pa.x, y: pa.y },
    );
  } else if (!back) {
    const nf = at('neckF') as V;
    const y0 = nf.y + 3;
    for (const s of [-1, 1]) {
      const x0 = 150 + s * 11;
      const cord = [{ x: x0, y: y0 }, { x: x0 + s * 2, y: y0 + 28 }, { x: x0 - s * 1, y: y0 + 56 }, { x: x0 + s * 2, y: y0 + 82 }];
      r.shapes.push({ d: circle(cord[0], 1.7), k: 'line' }, { d: curve(cord), k: 'line' }, { d: `M${f1(cord[3].x)},${f1(cord[3].y)} l${f1(s * 0.4)},9`, k: 'line' });
    }
    if (!opt.noPocket) {
    const vt = hemV - 0.52, vb = hemV - 0.14;
    const pw = (v: number) => 0.44 + ((v - vt) / (vb - vt)) * 0.16;
    const pocket = [T(-pw(vt), vt), T(pw(vt), vt), T(pw(vb), vb), T(-pw(vb), vb)];
    r.shapes.push({ d: poly(pocket, true), k: 'line' });
    r.shapes.push({ d: poly(pocket, true), k: 'stitch', t: [0, 0] });
    for (const s of [-1, 1]) {
      const a = T(s * (pw(vt) - 0.01), vt + 0.01), b = T(s * (pw(vt) + 0.045), vt + 0.17);
      r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' });
    }
    const pm = lerp(lerp(pocket[0], pocket[1], 0.5), lerp(pocket[3], pocket[2], 0.5), 0.5);
    r.anchors.push(
      { key: 'cord', label: 'Drawcords', desc: 'Flat drawcords with metal tips, 2 eyelets at the neck', x: 150 + 13, y: y0 + 40 },
      { key: 'kanga', label: 'Kangaroo pocket', desc: 'Patch pocket with angled hand openings, topstitched', x: pm.x + 22, y: pm.y },
    );
    }
  }

  if (!opt.noRib) {
  // rib hem
  const bh = wide ? 15 : 13;
  const edge = (y: number): V[] => {
    const l = at('hemL') as V, rr = at('hemR') as V;
    return [l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y }));
  };
  const top = edge(hemY - bh);
  r.shapes.push({ d: poly(top), k: 'seam' }, { d: poly(edge(hemY - 2.5)), k: 'stitch' });
  {
    const n = 38;
    const a: V[] = [], b: V[] = [];
    const x0 = top[0].x, x1 = top[1].x;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      a.push({ x, y: hemY - bh });
      b.push({ x, y: hemY });
    }
    r.shapes.push({ d: ticks(a, b, 1), k: 'rib' });
  }
  r.anchors.push({ key: 'ribhem', label: 'Rib hem', desc: `Body hem, 2x2 rib band, ${f1(bh / 9.4)} in`, x: 150 + 62, y: hemY - bh / 2 });

  }
  // rib cuffs
  for (const K of opt.noCuffs ? [] : (['L', 'R'] as const)) {
    const so = at('slO' + K) as V, si = at('slI' + K) as V;
    const u = c.dir(K);
    const L = 26;
    const a = { x: so.x - u.x * L, y: so.y - u.y * L }, b = { x: si.x - u.x * L, y: si.y - u.y * L };
    r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' });
    const n = 7;
    let d = '';
    for (let i = 1; i < n; i++) {
      const p = lerp(a, b, i / n), q = lerp(so, si, i / n);
      d += `M${P(p)} L${P(q)} `;
    }
    r.shapes.push({ d, k: 'rib' });
    if (K === 'L') {
      const m = lerp(lerp(a, b, 0.5), lerp(so, si, 0.5), 0.5);
      r.anchors.push({ key: 'ribcuff', label: 'Rib cuffs', desc: 'Sleeve ends in 2x2 rib cuffs, 3 in', x: m.x, y: m.y });
    }
  }
  return r;
}

// ---------- moto jacket ----------

function moto(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V;
  r.noHemStitch = true;
  r.noSleeveStitch = true;
  r.drop.push('sleeve', 'hem');
  r.rename.neck = { label: back ? 'Collar stand' : 'Neck opening', desc: back ? 'Collar stand, topstitched' : 'Open V neck, lapels fold back, collar stand' };

  // collar stand behind the neck
  {
    const d = `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 2)},${f1(nL.y - 9)} Q150,${f1(nL.y - 17)} ${f1(nR.x + 2)},${f1(nR.y - 9)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`;
    r.behind.push({ d, k: 'edge', fill: true });
    r.extent.push({ x: nL.x - 2, y: nL.y - 17 });
  }

  if (!back) {
    const nf = at('neckF') as V;
    for (const s of [-1, 1]) {
      const n0 = s > 0 ? nR : nL;
      const tip = T(s * 0.84, 0.3), notch = T(s * 0.56, 0.14), ctip = T(s * 0.7, 0.045), brk = T(s * 0.08, 0.5);
      r.shapes.push({ d: poly([n0, nf, brk, tip, notch, ctip], true), k: 'line' });
      r.shapes.push({ d: poly([T(s * 0.62, 0.07), T(s * 0.75, 0.275), T(s * 0.28, 0.46)]), k: 'stitch' });
    }
    const zp = [T(0.02, 0.49), T(-0.04, 0.63), T(-0.16, 0.86), T(-0.3, 1.0), T(-0.3, (1 + hemV) / 2), T(-0.3, hemV - 0.1)];
    r.shapes.push(...zip(zp));
    r.shapes.push({ d: curve(zp.map((p) => ({ x: p.x + 9, y: p.y }))), k: 'seam' }, { d: curve(zp.map((p) => ({ x: p.x + 12, y: p.y }))), k: 'stitch' });
    for (const s of [-1, 1]) {
      const p = [T(s * 0.36, hemV - 0.46), T(s * 0.58, hemV - 0.38), T(s * 0.8, hemV - 0.29)];
      r.shapes.push(...zip(s > 0 ? p : [...p].reverse(), false));
      r.shapes.push({ d: curve(p.map((q) => ({ x: q.x, y: q.y + 4 }))), k: 'seam' });
    }
    const cp = [T(-0.72, 0.56), T(-0.5, 0.58), T(-0.32, 0.56)];
    r.shapes.push(...zip(cp, false), { d: curve(cp.map((q) => ({ x: q.x, y: q.y + 4 }))), k: 'stitch' });
    r.anchors.push(
      { key: 'lapel', label: 'Lapels', desc: 'Notched lapels, topstitched edge', x: tip0(c).x, y: tip0(c).y },
      { key: 'zip', label: 'Asymmetric zip', desc: 'Front zip runs on a slant to the left hip, storm flap with topstitch', x: zp[2].x, y: zp[2].y },
      { key: 'zpocket', label: 'Zip pockets', desc: 'Slanted hip pockets with zips', x: T(0.58, hemV - 0.38).x, y: T(0.58, hemV - 0.38).y },
      { key: 'cpocket', label: 'Chest pocket', desc: 'Zip chest pocket, left side', x: cp[1].x, y: cp[1].y },
    );
  } else {
    const yoke = [T(-0.98, 0.36), T(-0.5, 0.33), T(0, 0.32), T(0.5, 0.33), T(0.98, 0.36)];
    r.shapes.push({ d: curve(yoke), k: 'seam' }, { d: curve(yoke.map((p) => ({ x: p.x, y: p.y + 4 }))), k: 'stitch' });
    r.shapes.push({ d: `M150,${f1(T(0, 0.1).y)} L150,${f1(hemY - 14)}`, k: 'seam' }, { d: `M152.5,${f1(T(0, 0.34).y)} L152.5,${f1(hemY - 14)}`, k: 'stitch' });
    r.anchors.push(
      { key: 'yoke', label: 'Back yoke', desc: 'Curved yoke seam, topstitched, centre back seam', x: yoke[1].x, y: yoke[1].y },
    );
  }

  // epaulettes
  for (const s of [-1, 1]) {
    const a = [0.42, 0.9].map((u) => T(s * u, -0.004)), b = [0.9, 0.42].map((u) => T(s * u, 0.036));
    r.shapes.push({ d: poly([...a, ...b], true), k: 'line' });
    r.shapes.push({ d: circle(T(s * 0.52, 0.016), 2), k: 'line' });
  }
  const ep = T(0.66, 0.016);
  r.anchors.push({ key: 'epaulette', label: 'Epaulettes', desc: 'Shoulder straps, snap button', x: ep.x, y: ep.y });

  // belt band at the hem
  {
    const l = at('hemL') as V, rr = at('hemR') as V;
    const bt = [l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hemY - 15 }));
    r.shapes.push({ d: poly(bt), k: 'seam' }, { d: poly(bt.map((p) => ({ x: p.x, y: p.y + 3 }))), k: 'stitch' }, { d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hemY - 3 }))), k: 'stitch' });
    const bx = T(0.34, 0).x, by = hemY - 7.5;
    if (!back) {
      r.shapes.push({ d: `M${f1(bx - 6)},${f1(by - 6)} h12 v12 h-12 Z`, k: 'line' }, { d: `M${f1(bx)},${f1(by - 5)} V${f1(by + 5)}`, k: 'line' });
      for (let k = 1; k <= 3; k++) r.shapes.push({ d: circle({ x: bx + 8 + k * 5, y: by }, 1), k: 'line' });
    }
    r.anchors.push({ key: 'belt', label: 'Belt hem', desc: back ? 'Belt band at the hem, topstitched' : 'Belt band at the hem, metal buckle, 3 snap holes', x: back ? 150 + 55 : bx, y: back ? by : by });
  }

  // zip cuffs
  for (const K of ['L', 'R'] as const) {
    const so = at('slO' + K) as V, si = at('slI' + K) as V;
    const u = c.dir(K);
    const L = 30;
    const a = { x: so.x - u.x * L, y: so.y - u.y * L }, b = { x: si.x - u.x * L, y: si.y - u.y * L };
    r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' });
    const z0 = lerp(so, si, 0.78), z1 = lerp(a, b, 0.78);
    r.shapes.push(...zip([{ x: z0.x - u.x * 3, y: z0.y - u.y * 3 }, { x: z1.x + u.x * 3, y: z1.y + u.y * 3 }]).map((s) => (s.k === 'stitch' ? { ...s, t: [0, 2.2] as [number, number] } : s)));
    if (K === 'L') {
      const m = lerp(lerp(a, b, 0.5), lerp(so, si, 0.5), 0.5);
      r.anchors.push({ key: 'zcuff', label: 'Zip cuffs', desc: 'Cuff band with a short zip, topstitched', x: m.x, y: m.y });
    }
  }
  return r;
}

function tip0(c: TopCtx): V {
  return c.T(0.84, 0.3);
}

// ---------- dress ----------

function dress(c: TopCtx): BlockParts {
  const r = empty();
  const { T, back, o } = c;
  const top = dressTopOf(o), sil = silhouetteOf(o);
  const bare = top === 'Straps' || top === 'Strapless';

  if (top === 'Straps') {
    for (const s of [-1, 1]) {
      const a = c.neck(s > 0 ? 0.3 : 0.7);
      const b = T(s * 0.5, -0.012);
      r.behind.push({ d: poly([{ x: a.x - 1.8, y: a.y + 2 }, { x: b.x - 1.8, y: b.y }, { x: b.x + 1.8, y: b.y }, { x: a.x + 1.8, y: a.y + 2 }], true), k: 'edge', fill: true });
      r.extent.push({ x: b.x, y: b.y - 1 });
    }
    const a = c.neck(0.3);
    r.anchors.push({ key: 'straps', label: 'Straps', desc: 'Adjustable spaghetti straps, sewn into the neckline', x: (a.x + T(0.5, -0.012).x) / 2 + 4, y: (a.y + T(0.5, -0.012).y) / 2 });
  }
  if (bare) {
    r.rename.neck = {
      label: top === 'Strapless' ? 'Top edge' : 'Neckline',
      desc: top === 'Strapless' ? `${back ? 'Back' : 'Front'} top edge, faced, grip elastic inside` : `${back ? 'Back' : o.neck + ' neckline'}, self binding, topstitched`,
    };
  }

  // shaping by silhouette
  if (sil === 'A-line') {
    const pts: V[] = [];
    for (let k = 0; k <= 10; k++) pts.push(T(-1.1 + (2.2 * k) / 10, 1.0 + 0.012 * Math.sin((Math.PI * k) / 10)));
    r.shapes.push({ d: curve(pts), k: 'seam' }, { d: curve(pts.map((p) => ({ x: p.x, y: p.y + 3 }))), k: 'stitch' });
    r.anchors.push({ key: 'waistseam', label: 'Waist seam', desc: 'Seam joins the bodice to the flared skirt', x: T(-0.8, 1.0).x, y: T(-0.8, 1.0).y });
  } else if (sil === 'Bodycon') {
    for (const s of [-1, 1]) {
      const x = s * 0.34;
      r.shapes.push({ d: `M${P(T(x - 0.035, 1.0))} L${P(T(x, back ? 0.72 : 0.66))} L${P(T(x + 0.035, 1.0))}`, k: 'seam' });
    }
    r.anchors.push({ key: 'darts', label: back ? 'Back darts' : 'Waist darts', desc: 'Darts shape the waist, pressed toward the centre', x: T(-0.34, 0.9).x, y: T(-0.34, 0.9).y });
  } else {
    // slip: cut on the bias, so side seams run straight
    r.shapes.push({ d: `M${P(T(-0.97, 0.5))} L${P(T(-1.07, 1.5))}`, k: 'stitch', t: [3, 0] }, { d: `M${P(T(0.97, 0.5))} L${P(T(1.07, 1.5))}`, k: 'stitch', t: [-3, 0] });
  }

  if (back) {
    const z = [T(0, bare ? 0.36 : 0.08), T(0, 0.8), T(0, 1.5)];
    r.shapes.push(...zip(z, true));
    r.anchors.push({ key: 'czip', label: 'Centre back zip', desc: 'Invisible zip from the neckline to the hip', x: 150 + 2.2, y: z[1].y });
  }

  // hem
  r.noHemStitch = false;
  r.rename.hem = { label: 'Hem', desc: `${dressLenLabel(o)} hem, narrow rolled edge, topstitched` };
  return r;
}

function dressLenLabel(o: TopOpts): string {
  return o.dressLen ?? 'Midi';
}

// ---------- shared pieces for the newer blocks ----------

export const sleeveOf2 = (c: TopCtx, K: 'L' | 'R') => {
  const so = c.at('slO' + K) as V, si = c.at('slI' + K) as V;
  return { so, si, sh: c.at('sh' + K) as V, ar: c.at('arm' + K) as V, u: c.dir(K) };
};

/** Rib band across the body hem. */
export function ribHem(c: TopCtx, r: BlockParts, bh: number, label = 'Rib hem') {
  const { at, hemY } = c;
  const l = at('hemL') as V, rr = at('hemR') as V;
  const edge = (y: number): V[] => [l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y }));
  const top = edge(hemY - bh);
  r.shapes.push({ d: poly(top), k: 'seam' }, { d: poly(edge(hemY - 2.5)), k: 'stitch' });
  const a: V[] = [], b: V[] = [];
  const n = 38;
  for (let i = 0; i <= n; i++) {
    const x = top[0].x + ((top[1].x - top[0].x) * i) / n;
    a.push({ x, y: hemY - bh });
    b.push({ x, y: hemY });
  }
  r.shapes.push({ d: ticks(a, b, 1), k: 'rib' });
  r.anchors.push({ key: 'ribhem', label, desc: `Body hem, 2x2 rib band, ${f1(bh / 9.4)} in`, x: 150 + 62, y: hemY - bh / 2 });
}

/** Rib or plain band across each sleeve end. */
export function sleeveBand(c: TopCtx, r: BlockParts, L: number, key: string, label: string, desc: string, rib = true) {
  for (const K of ['L', 'R'] as const) {
    const { so, si, u } = sleeveOf2(c, K);
    const a = { x: so.x - u.x * L, y: so.y - u.y * L }, b = { x: si.x - u.x * L, y: si.y - u.y * L };
    r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' });
    if (rib) {
      let d = '';
      for (let i = 1; i < 7; i++) d += `M${P(lerp(a, b, i / 7))} L${P(lerp(so, si, i / 7))} `;
      r.shapes.push({ d, k: 'rib' });
    } else r.shapes.push({ d: `M${P(lerp(so, si, 0))} L${P(lerp(so, si, 1))}`, k: 'stitch', t: [-u.x * 2.5, -u.y * 2.5] });
    if (K === 'L') {
      const m = lerp(lerp(a, b, 0.5), lerp(so, si, 0.5), 0.5);
      r.anchors.push({ key, label, desc, x: m.x, y: m.y });
    }
  }
}

/** Rib band around the neck, following the neckline curve. */
export function ribNeck(c: TopCtx, r: BlockParts, w: number, label: string, desc: string) {
  const pts: V[] = [], inner: V[] = [];
  for (let i = 0; i <= 12; i++) {
    const p = c.neck(i / 12);
    pts.push(p);
    inner.push({ x: p.x + (150 - p.x) * 0.0, y: p.y + w });
  }
  r.shapes.push({ d: curve(inner), k: 'seam' }, { d: curve(inner.map((p) => ({ x: p.x, y: p.y + 2.8 }))), k: 'stitch' });
  let d = '';
  for (let i = 1; i < 12; i++) d += `M${P(pts[i])} L${P(inner[i])} `;
  r.shapes.push({ d, k: 'rib' });
  const m = c.neck(0.3);
  r.anchors.push({ key: 'ribneck', label, desc, x: m.x, y: m.y + w / 2 });
  r.drop.push('neck');
}

/** Folded shirt collar: stand behind the neck and two flaps over the body. */
export function shirtCollar(c: TopCtx, r: BlockParts, size: number, pointed: boolean) {
  const nL = c.at('neckL') as V, nR = c.at('neckR') as V, nf = c.at('neckF') as V;
  const top = nL.y - 8;
  r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 2)},${f1(top)} Q150,${f1(top - 8)} ${f1(nR.x + 2)},${f1(top)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
  r.extent.push({ x: nL.x - 2, y: top - 8 });
  if (!c.back) {
    for (const s of [-1, 1]) {
      const n0 = s < 0 ? nL : nR;
      const tip = { x: n0.x + s * (pointed ? 7 : 3), y: nf.y + size };
      const mid = { x: 150 + s * 1, y: nf.y + size * 0.55 };
      const d = `M${f1(n0.x + s * 1)},${f1(top + 2)} L${P(tip)} L${P(mid)} L${f1(150 + s * 1)},${f1(nf.y - 1)} Z`;
      r.over.push({ d, k: 'line', fill: true }, { d: `M${f1(n0.x + s * 3)},${f1(top + 6)} L${f1(tip.x - s * 2)},${f1(tip.y - 3)}`, k: 'stitch' });
    }
    r.extent.push({ x: nL.x, y: nf.y + size });
  }
}

/** A placket down the centre front with buttons. */
export function placket(_c: TopCtx, r: BlockParts, y0: number, y1: number, nBut: number, w = 6, tonal = true) {
  r.shapes.push(
    { d: `M${f1(150 - w)},${f1(y0)} L${f1(150 - w)},${f1(y1)}`, k: 'seam' },
    { d: `M${f1(150 + w)},${f1(y0)} L${f1(150 + w)},${f1(y1)}`, k: 'seam' },
    { d: `M${f1(150 - w + 2.4)},${f1(y0)} L${f1(150 - w + 2.4)},${f1(y1)}`, k: 'stitch' },
    { d: `M${f1(150 + w - 2.4)},${f1(y0)} L${f1(150 + w - 2.4)},${f1(y1)}`, k: 'stitch' },
  );
  for (let i = 0; i < nBut; i++) {
    const y = y0 + 8 + ((y1 - y0 - 12) * i) / Math.max(1, nBut - 1);
    r.shapes.push({ d: circle({ x: 150, y }, 2), k: 'line' });
    if (tonal) r.shapes.push({ d: `M${f1(150 - 0.7)},${f1(y)} h1.4 M150,${f1(y - 0.7)} v1.4`, k: 'rib' });
  }
}

/** Slanted welt or flap pocket between two points, with a flap if asked. */
export function pocketAt(r: BlockParts, a: V, b: V, flap: number, k: 'flap' | 'welt') {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const q = (p: V, d: number): V => ({ x: p.x + nx * d, y: p.y + ny * d });
  if (k === 'flap') {
    const fl = [a, b, q(b, flap), q(lerp(a, b, 0.5), flap + 3), q(a, flap)];
    r.shapes.push({ d: poly(fl, true), k: 'line' }, { d: poly([q(a, flap - 2.6), q(lerp(a, b, 0.5), flap + 0.4), q(b, flap - 2.6)]), k: 'stitch' });
    r.shapes.push({ d: poly([q(a, flap + 18), q(b, flap + 18)]), k: 'stitch' });
  } else {
    r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'line' }, { d: `M${P(q(a, 3.5))} L${P(q(b, 3.5))}`, k: 'line' }, { d: poly([a, q(a, 3.5)]), k: 'line' }, { d: poly([b, q(b, 3.5)]), k: 'line' });
  }
}

// ---------- button-up shirt ----------

function buttonUp(c: TopCtx, r = empty(), camp = false): BlockParts {
  const { T, at, hemY, back, o } = c;
  const nf = at('neckF') as V;
  const long = sleeveKindOf(o) === 'Long';
  shirtCollar(c, r, 15, true);
  r.rename.neck = { label: 'Collar', desc: back ? 'Collar with stand, topstitched' : 'Point collar on a band, interlined, topstitched' };
  r.noSleeveStitch = long;
  r.drop.push(...(long ? ['sleeve'] : []));
  if (!back) {
    placket(c, r, nf.y + 4, hemY - 2, 6, 6);
    const pc = [T(0.3, 0.21), T(0.62, 0.21), T(0.62, 0.38), T(0.46, 0.43), T(0.3, 0.38)];
    r.shapes.push({ d: poly(pc, true), k: 'line' }, { d: `M${P(T(0.3, 0.235))} L${P(T(0.62, 0.235))}`, k: 'stitch' });
    r.anchors.push(
      { key: 'placket', label: 'Button placket', desc: 'Front placket, 6 buttons, topstitched both edges', x: 150 + 6, y: nf.y + 56 },
      { key: 'pocket', label: 'Chest pocket', desc: 'Patch pocket, pointed bottom, topstitched', x: pc[2].x - 2, y: pc[2].y - 6 },
    );
  } else {
    const yoke = [T(-0.96, 0.17), T(-0.5, 0.2), T(0, 0.22), T(0.5, 0.2), T(0.96, 0.17)];
    r.shapes.push({ d: curve(yoke), k: 'seam' }, { d: curve(yoke.map((p) => ({ x: p.x, y: p.y + 3 }))), k: 'stitch' });
    r.shapes.push({ d: `M${P(T(-0.1, 0.22))} L${P(T(-0.1, 0.4))} M${P(T(0.1, 0.22))} L${P(T(0.1, 0.4))}`, k: 'seam' });
    r.anchors.push(
      { key: 'yoke', label: 'Back yoke', desc: 'Shoulder yoke, topstitched, box pleat below', x: yoke[1].x, y: yoke[1].y },
      { key: 'pleat', label: 'Box pleat', desc: 'Centre back box pleat', x: 150 + 10, y: T(0, 0.34).y },
    );
  }
  if (long) {
    for (const K of ['L', 'R'] as const) {
      const { so, si, u } = sleeveOf2(c, K);
      const L = 22;
      const a = { x: so.x - u.x * L, y: so.y - u.y * L }, b = { x: si.x - u.x * L, y: si.y - u.y * L };
      r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' }, { d: `M${P(lerp(a, b, 0.0))} L${P(lerp(a, b, 1))}`, k: 'stitch', t: [u.x * 3, u.y * 3] });
      const bc = lerp(lerp(a, b, 0.7), lerp(so, si, 0.7), 0.5);
      r.shapes.push({ d: circle({ x: bc.x, y: bc.y }, 1.8), k: 'line' });
      if (K === 'L') {
        const m = lerp(lerp(a, b, 0.5), lerp(so, si, 0.5), 0.5);
        r.anchors.push({ key: 'cuff', label: 'Buttoned cuffs', desc: 'Cuff with 1 button, sleeve placket', x: m.x, y: m.y });
      }
    }
  }
  r.noHemStitch = false;
  r.rename.hem = { label: 'Shirttail hem', desc: camp ? 'Straight hem, narrow topstitched' : 'Curved shirttail hem, narrow rolled' };
  return r;
}

// ---------- polo ----------

function polo(c: TopCtx): BlockParts {
  const r = empty();
  const { at, hemY, back } = c;
  const nf = at('neckF') as V;
  shirtCollar(c, r, 12, false);
  r.rename.neck = { label: 'Collar', desc: 'Knit collar, self fabric, topstitched' };
  r.drop.push('sleeve');
  r.noSleeveStitch = true;
  if (!back) {
    const y1 = nf.y + 56;
    r.shapes.push(
      { d: `M${f1(150 - 5)},${f1(nf.y + 2)} L${f1(150 - 5)},${f1(y1)} L${f1(150 + 5)},${f1(y1)} L${f1(150 + 5)},${f1(nf.y + 2)}`, k: 'line' },
      { d: `M150,${f1(nf.y + 2)} L150,${f1(y1)}`, k: 'seam' },
    );
    for (const dy of [14, 34]) r.shapes.push({ d: circle({ x: 150, y: nf.y + dy }, 1.9), k: 'line' });
    r.anchors.push({ key: 'placket', label: 'Placket', desc: 'Half placket, 2 buttons, topstitched', x: 150 + 5, y: nf.y + 42 });
  }
  sleeveBand(c, r, 13, 'sband', 'Sleeve bands', 'Ribbed sleeve bands, 1.3 in');
  // side vents
  const l = at('hemL') as V, rr = at('hemR') as V;
  r.shapes.push({ d: `M${f1(l.x + 4)},${f1(hemY - 22)} L${f1(l.x + 4)},${f1(hemY)}`, k: 'seam' }, { d: `M${f1(rr.x - 4)},${f1(hemY - 22)} L${f1(rr.x - 4)},${f1(hemY)}`, k: 'seam' });
  r.anchors.push({ key: 'vent', label: 'Side vents', desc: 'Side vents, 2.3 in, bar tacked', x: rr.x - 4, y: hemY - 11 });
  return r;
}

// ---------- sweatshirt ----------

export function sweatshirt(c: TopCtx): BlockParts {
  const r = empty();
  const wide = c.o.fit === 'Oversized';
  r.noHemStitch = true;
  r.noSleeveStitch = true;
  r.drop.push('sleeve', 'hem');
  ribNeck(c, r, 8, 'Rib collar', 'Crew neck, 1x1 rib collar, topstitched');
  if (ribHemOn(c.o)) ribHem(c, r, wide ? 15 : 13);
  sleeveBand(c, r, 26, 'ribcuff', 'Rib cuffs', 'Sleeve ends in 2x2 rib cuffs, 3 in');
  const { T, hemV, back } = c;
  if (!back) {
    const v = [T(-0.08, 0.1), T(0, 0.17), T(0.08, 0.1)];
    r.shapes.push({ d: poly(v), k: 'seam' });
    r.anchors.push({ key: 'vins', label: 'V insert', desc: 'Stitched V insert at the neck, bar tacked', x: v[1].x + 8, y: v[1].y + 2 });
  } else void hemV;
  return r;
}

// ---------- bomber ----------

function bomber(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V, nf = at('neckF') as V;
  r.noHemStitch = true;
  r.noSleeveStitch = true;
  r.drop.push('sleeve', 'hem');
  r.rename.neck = { label: 'Rib collar', desc: 'Stand collar in 2x2 rib, zip to the top' };
  // rib collar standing up around the neck
  {
    const top = nL.y - 11;
    r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 3)},${f1(top)} Q150,${f1(top - 9)} ${f1(nR.x + 3)},${f1(top)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
    let d = '';
    for (let i = 1; i < 12; i++) {
      const x = nL.x - 2 + ((nR.x - nL.x + 4) * i) / 12;
      d += `M${f1(x)},${f1(top - 1)} L${f1(x)},${f1(nL.y + 1)} `;
    }
    r.behind.push({ d, k: 'rib' });
    r.extent.push({ x: nL.x - 3, y: top - 9 });
  }
  if (!back) {
    const zp = [{ x: 150, y: nf.y + 1 }, { x: 150, y: (nf.y + hemY) / 2 }, { x: 150, y: hemY - 15 }];
    r.shapes.push(...zip(zp));
    r.shapes.push({ d: `M${f1(150 + 8)},${f1(nf.y + 4)} L${f1(150 + 8)},${f1(hemY - 15)}`, k: 'seam' });
    for (const s of [-1, 1]) pocketAt(r, T(s * 0.4, hemV - 0.4), T(s * 0.56, hemV - 0.2), 0, 'welt');
    // sleeve pocket on the left sleeve (screen right)
    const { sh, so, u } = sleeveOf2(c, 'R');
    const a0 = { x: sh.x + u.x * 34 + u.y * 3, y: sh.y + u.y * 34 - u.x * 3 };
    const a1 = { x: sh.x + u.x * 58 + u.y * 3, y: sh.y + u.y * 58 - u.x * 3 };
    r.shapes.push(...zip([a0, a1], false), { d: poly([{ x: a0.x - u.y * 9, y: a0.y + u.x * 9 }, { x: a1.x - u.y * 9, y: a1.y + u.x * 9 }]), k: 'stitch' });
    void so;
    r.anchors.push(
      { key: 'fzip', label: 'Front zip', desc: 'Metal zip, rib to the top of the collar', x: 150 + 1, y: (nf.y + hemY) / 2 },
      { key: 'welt', label: 'Welt pockets', desc: 'Slant welt pockets, bar tacked', x: T(0.5, hemV - 0.3).x, y: T(0.5, hemV - 0.3).y },
      { key: 'spock', label: 'Sleeve pocket', desc: 'Zip pocket on the left upper sleeve', x: lerp(a0, a1, 0.5).x, y: lerp(a0, a1, 0.5).y },
    );
  } else {
    r.shapes.push({ d: `M150,${f1(T(0, 0.04).y)} L150,${f1(hemY - 15)}`, k: 'seam' });
    r.anchors.push({ key: 'cb', label: 'Centre back seam', desc: 'Centre back seam, overlocked and topstitched', x: 152, y: T(0, 0.5).y });
  }
  ribHem(c, r, 15);
  sleeveBand(c, r, 24, 'ribcuff', 'Rib cuffs', 'Sleeve ends in 2x2 rib cuffs, 2.5 in');
  return r;
}

// ---------- denim trucker ----------

function trucker(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nf = at('neckF') as V;
  shirtCollar(c, r, 15, true);
  r.rename.neck = { label: 'Point collar', desc: 'Point collar, double needle topstitch' };
  r.noHemStitch = true;
  r.drop.push('hem');
  const hb = hemY - 15;
  const l = at('hemL') as V, rr = at('hemR') as V;
  r.shapes.push({ d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hb }))), k: 'seam' }, { d: poly([l, rr].map((p, i) => ({ x: p.x + (i ? 3 : -3), y: hb + 3 }))), k: 'stitch' });
  // yoke and vertical seams, double stitched
  const side = (s: -1 | 1) => {
    const yk = back ? [T(s * 0.96, 0.17), T(s * 0.6, 0.2), T(s * 0.2, 0.24)] : [T(s * 0.94, 0.14), T(s * 0.58, 0.17), T(s * 0.22, 0.12)];
    r.shapes.push({ d: curve(yk), k: 'seam' }, { d: curve(yk.map((p) => ({ x: p.x, y: p.y + 2.6 }))), k: 'stitch' });
    const a = T(s * 0.5, back ? 0.2 : 0.16), b = T(s * 0.44, hemV - 0.12);
    r.shapes.push({ d: `M${P(a)} L${P(b)}`, k: 'seam' }, { d: `M${P({ x: a.x + s * 2.6, y: a.y })} L${P({ x: b.x + s * 2.6, y: b.y })}`, k: 'stitch' });
  };
  side(-1);
  side(1);
  if (!back) {
    placket(c, r, nf.y + 4, hb, 6, 5);
    for (const s of [-1, 1]) {
      const a = T(s * 0.3, 0.2), b = T(s * 0.62, 0.2);
      const poc = [a, b, { x: b.x, y: b.y + 24 }, { x: a.x, y: a.y + 24 }];
      r.shapes.push({ d: poly(poc, true), k: 'line' });
      const fl = [a, b, { x: b.x, y: b.y + 11 }, { x: lerp(a, b, 0.5).x, y: a.y + 15 }, { x: a.x, y: a.y + 11 }];
      r.shapes.push({ d: poly(fl, true), k: 'line' }, { d: circle({ x: lerp(a, b, 0.5).x, y: a.y + 10 }, 1.7), k: 'line' });
    }
    const pa = T(0.46, 0.22);
    r.anchors.push(
      { key: 'placket', label: 'Button front', desc: 'Front placket, 6 metal shank buttons, double needle', x: 150 + 5, y: nf.y + 56 },
      { key: 'pocket', label: 'Chest flap pockets', desc: 'Patch pockets with pointed flaps, button closure', x: pa.x, y: pa.y + 4 },
    );
  } else r.shapes.push({ d: `M150,${f1(T(0, 0.24).y)} L150,${f1(hb)}`, k: 'seam' });
  const yy = T(0.5, back ? 0.2 : 0.16);
  r.anchors.push({ key: 'yoke', label: 'Yokes and seams', desc: 'Pointed yokes, vertical seams, double needle topstitch', x: yy.x + 4, y: yy.y + 38 });
  // waistband adjuster tabs
  for (const s of [-1, 1]) {
    const p = { x: s < 0 ? l.x + 4 : rr.x - 4, y: hb + 6 };
    const tab = [{ x: p.x, y: hb - 2 }, { x: p.x - s * 14, y: hb - 2 }, { x: p.x - s * 14, y: hb + 12 }, { x: p.x, y: hb + 12 }];
    r.shapes.push({ d: poly(tab, true), k: 'line' }, { d: circle({ x: p.x - s * 7, y: hb + 5 }, 1.7), k: 'line' });
  }
  r.anchors.push({ key: 'tab', label: 'Waistband tabs', desc: 'Adjuster tabs at the hem, button', x: rr.x - 14, y: hb + 7 });
  sleeveBand(c, r, 20, 'cuff', 'Cuffs', 'Button cuffs, double needle topstitch', false);
  return r;
}

// ---------- puffer ----------

function puffer(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back, o } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V, nf = at('neckF') as V;
  r.noHemStitch = true;
  r.noSleeveStitch = true;
  r.drop.push('sleeve', 'hem');
  // baffles across the body and sleeves
  const top = nf.y + 14;
  const gap = Math.max(26, (hemY - top) / Math.round((hemY - top) / 30));
  let d = '';
  for (let y = top; y < hemY - 6; y += gap) d += `M${f1(T(-1.6, 0).x)},${f1(y)} Q150,${f1(y + 3)} ${f1(T(1.6, 0).x)},${f1(y)} `;
  r.shapes.push({ d, k: 'stitch' });
  for (const K of ['L', 'R'] as const) {
    const { so, si, sh, ar } = sleeveOf2(c, K);
    let sd = '';
    for (let f = 0.22; f < 0.92; f += 0.22) sd += `M${P(lerp(sh, so, f))} L${P(lerp(ar, si, f))} `;
    r.shapes.push({ d: sd, k: 'stitch' });
  }
  if (o.hood) {
    if (!back) {
      const rise = 56;
      r.behind.push(
        { d: `M${f1(nL.x - 3)},${f1(nL.y + 2)} C${f1(nL.x - 22)},${f1(nL.y - rise)} ${f1(nR.x + 22)},${f1(nR.y - rise)} ${f1(nR.x + 3)},${f1(nR.y + 2)} Z`, k: 'edge', fill: true },
        { d: `M${f1(nL.x + 7)},${f1(nL.y)} C${f1(nL.x + 2)},${f1(nL.y - rise * 0.62)} ${f1(nR.x - 2)},${f1(nR.y - rise * 0.62)} ${f1(nR.x - 7)},${f1(nR.y)}`, k: 'seam' },
      );
      r.extent.push({ x: nL.x - 20, y: nL.y - rise * 0.72 });
      r.anchors.push({ key: 'hood', label: 'Hood', desc: 'Quilted hood, elastic binding at the face opening', x: 150 + (nR.x - nL.x) * 0.3, y: nL.y - rise * 0.7 });
    } else {
      const topY = nL.y - 8;
      const lx = T(-0.55, 0).x, rx = T(0.55, 0).x, bot = T(0, 0.2).y;
      r.over.push(
        { d: `M${f1(lx)},${f1(nL.y + 1)} C${f1(lx - 10)},${f1(topY - 30)} ${f1(150 - 32)},${f1(topY - 50)} 150,${f1(topY - 50)} C${f1(150 + 32)},${f1(topY - 50)} ${f1(rx + 10)},${f1(topY - 30)} ${f1(rx)},${f1(nR.y + 1)} C${f1(rx - 12)},${f1(bot - 8)} ${f1(150 + 26)},${f1(bot)} 150,${f1(bot)} C${f1(150 - 26)},${f1(bot)} ${f1(lx + 12)},${f1(bot - 8)} ${f1(lx)},${f1(nL.y + 1)} Z`, k: 'edge', fill: true },
        { d: `M150,${f1(topY - 50)} L150,${f1(bot)}`, k: 'seam' },
      );
      r.extent.push({ x: lx - 8, y: topY - 52 });
      r.anchors.push({ key: 'hood', label: 'Hood', desc: 'Quilted hood with centre seam', x: 150 + 30, y: topY - 30 });
    }
  } else {
    const top2 = nL.y - 10;
    r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 3)},${f1(top2)} Q150,${f1(top2 - 9)} ${f1(nR.x + 3)},${f1(top2)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
    r.extent.push({ x: nL.x - 3, y: top2 - 9 });
    r.anchors.push({ key: 'collar', label: 'Stand collar', desc: 'Quilted stand collar, zip to the chin', x: nL.x + 2, y: top2 + 4 });
  }
  if (!back) {
    const zp = [{ x: 150, y: nf.y + 1 }, { x: 150, y: (nf.y + hemY) / 2 }, { x: 150, y: hemY - 6 }];
    r.shapes.push(...zip(zp));
    r.shapes.push({ d: `M${f1(150 + 9)},${f1(nf.y + 4)} L${f1(150 + 9)},${f1(hemY - 4)}`, k: 'seam' });
    for (const s of [-1, 1]) pocketAt(r, T(s * 0.4, hemV - 0.42), T(s * 0.58, hemV - 0.24), 0, 'welt');
    r.anchors.push(
      { key: 'fzip', label: 'Front zip', desc: 'Two way zip with storm flap and snaps', x: 150 + 1, y: (nf.y + hemY) / 2 },
      { key: 'zpock', label: 'Zip pockets', desc: 'Slant hand pockets with zips', x: T(0.5, hemV - 0.33).x, y: T(0.5, hemV - 0.33).y },
    );
  }
  r.anchors.push({ key: 'baffle', label: 'Baffles', desc: 'Horizontal baffles, down fill, stitched through', x: T(0.55, 0).x, y: top + gap });
  sleeveBand(c, r, 9, 'cuffb', 'Elastic cuffs', 'Elastic binding at the cuffs', false);
  r.shapes.push({ d: `M${P({ x: (at('hemL') as V).x + 2, y: hemY - 8 })} L${P({ x: (at('hemR') as V).x - 2, y: hemY - 8 })}`, k: 'seam' });
  r.anchors.push({ key: 'bind', label: 'Hem binding', desc: 'Elastic binding at the hem', x: 150 + 60, y: hemY - 8 });
  return r;
}

// ---------- trench coat ----------

function trench(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V, nf = at('neckF') as V;
  r.noHemStitch = false;
  r.drop.push('sleeve');
  r.noSleeveStitch = true;
  r.rename.neck = { label: back ? 'Collar' : 'Notch collar', desc: back ? 'Collar with stand, storm tab' : 'Notched collar with throat latch' };
  const top = nL.y - 8;
  r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 3)},${f1(top)} Q150,${f1(top - 9)} ${f1(nR.x + 3)},${f1(top)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
  r.extent.push({ x: nL.x - 3, y: top - 9 });
  const beltV = 1.0;
  if (!back) {
    for (const s of [-1, 1]) {
      const n0 = s > 0 ? nR : nL;
      const tip = T(s * 0.78, 0.34), notch = T(s * 0.5, 0.2), ctip = T(s * 0.62, 0.05), brk = T(s * 0.18, 0.62);
      r.shapes.push({ d: poly([n0, nf, brk, tip, notch, ctip], true), k: 'line' });
      r.shapes.push({ d: poly([T(s * 0.56, 0.08), T(s * 0.68, 0.32), T(s * 0.26, 0.58)]), k: 'stitch' });
    }
    // double breasted closure: the overlap edge and two columns of buttons
    const ov = [T(0.18, 0.62), T(0.2, 1.0), T(0.2, (hemV + 1) / 2), T(0.2, hemV - 0.02)];
    r.shapes.push({ d: curve(ov), k: 'seam' }, { d: curve(ov.map((p) => ({ x: p.x - 3, y: p.y }))), k: 'stitch' });
    const vs = [0.7, 0.94, 1.18, hemV - 0.14].filter((v) => v < hemV - 0.08);
    for (const s of [-1, 1]) for (const v of vs) r.shapes.push({ d: circle(T(s * 0.3, v), 2.6), k: 'line' }, { d: circle(T(s * 0.3, v), 1.1), k: 'rib' });
    // storm flap over the right chest
    const sf = [T(0.18, 0.22), T(0.78, 0.2), T(0.74, 0.42), T(0.28, 0.5)];
    r.shapes.push({ d: poly(sf, true), k: 'seam' }, { d: poly(sf.map((p) => ({ x: p.x, y: p.y - 3 }))), k: 'stitch' });
    // slanted pockets
    for (const s of [-1, 1]) pocketAt(r, T(s * 0.5, hemV - 0.34), T(s * 0.62, hemV - 0.14), 0, 'welt');
    r.anchors.push(
      { key: 'lapel', label: 'Notch lapels', desc: 'Wide notch lapels, topstitched edge', x: T(0.7, 0.28).x, y: T(0.7, 0.28).y },
      { key: 'db', label: 'Double breasted', desc: 'Two columns of 4 buttons, overlap closes left over right', x: T(-0.3, 0.94).x, y: T(-0.3, 0.94).y },
      { key: 'storm', label: 'Storm flap', desc: 'Gun flap over the right chest, snap closed', x: T(0.52, 0.34).x, y: T(0.52, 0.34).y },
      { key: 'pocket', label: 'Slant pockets', desc: 'Slant pockets in the side seams', x: T(0.56, hemV - 0.24).x, y: T(0.56, hemV - 0.24).y },
    );
  } else {
    const yoke = [T(-0.98, 0.2), T(-0.5, 0.22), T(0, 0.23), T(0.5, 0.22), T(0.98, 0.2)];
    r.shapes.push({ d: curve(yoke), k: 'seam' }, { d: curve(yoke.map((p) => ({ x: p.x, y: p.y + 3 }))), k: 'stitch' });
    r.shapes.push({ d: `M150,${f1(T(0, 0.23).y)} L150,${f1(hemY)}`, k: 'seam' });
    const vent = [T(-0.1, hemV - 0.5), T(0.1, hemV - 0.5)];
    r.shapes.push({ d: poly([vent[0], { x: vent[0].x, y: hemY }]), k: 'seam' }, { d: poly([vent[1], { x: vent[1].x, y: hemY }]), k: 'seam' }, { d: poly([vent[0], vent[1]]), k: 'stitch' });
    r.anchors.push(
      { key: 'yoke', label: 'Back yoke', desc: 'Raglan style yoke with rain shield, topstitched', x: yoke[1].x, y: yoke[1].y },
      { key: 'vent', label: 'Back vent', desc: 'Centre back vent, overlapped, bar tacked', x: T(0.1, hemV - 0.3).x, y: T(0.1, hemV - 0.3).y },
    );
  }
  // belt at the waist with buckle
  const wl = T(-1.3, beltV), wr = T(1.3, beltV);
  const bh = 10;
  r.shapes.push({ d: `M${P(wl)} L${P(wr)} M${P({ x: wl.x, y: wl.y + bh })} L${P({ x: wr.x, y: wr.y + bh })}`, k: 'line' });
  if (!back) {
    r.shapes.push({ d: `M${f1(150 - 7)},${f1(wl.y - 2)} h14 v${bh + 4} h-14 Z`, k: 'line' }, { d: `M${f1(150 - 3)},${f1(wl.y + 2)} h6`, k: 'line' });
    r.anchors.push({ key: 'belt', label: 'Belt', desc: 'Self belt, 2 in, metal buckle and D rings', x: T(-0.9, beltV).x, y: wl.y + bh / 2 });
  } else r.anchors.push({ key: 'belt', label: 'Belt', desc: 'Belt through loops at the side seams', x: T(-0.9, beltV).x, y: wl.y + bh / 2 });
  for (const s of [-1, 1]) r.shapes.push({ d: `M${f1(T(s * 0.96, 0).x)},${f1(wl.y - 3)} v${bh + 6}`, k: 'line' });
  sleeveBand(c, r, 16, 'cuffs', 'Cuff straps', 'Strap and buckle at each cuff', false);
  return r;
}

// ---------- blazer ----------

function blazer(c: TopCtx): BlockParts {
  const r = empty();
  const { T, at, hemY, hemV, back } = c;
  const nL = at('neckL') as V, nR = at('neckR') as V, nf = at('neckF') as V;
  r.noHemStitch = false;
  r.drop.push('sleeve', 'hem');
  r.noSleeveStitch = true;
  r.rename.neck = { label: back ? 'Collar' : 'Notch lapel', desc: back ? 'Under collar and collar stand, felt' : 'Notch lapels, hand padded, pick stitched' };
  const top = nL.y - 8;
  r.behind.push({ d: `M${f1(nL.x - 1)},${f1(nL.y + 1)} L${f1(nL.x - 2)},${f1(top)} Q150,${f1(top - 8)} ${f1(nR.x + 2)},${f1(top)} L${f1(nR.x + 1)},${f1(nR.y + 1)} Z`, k: 'edge', fill: true });
  r.extent.push({ x: nL.x - 2, y: top - 8 });
  if (!back) {
    for (const s of [-1, 1]) {
      const n0 = s > 0 ? nR : nL;
      const tip = T(s * 0.62, 0.36), notch = T(s * 0.42, 0.24), ctip = T(s * 0.52, 0.06), brk = T(s * 0.06, 0.78);
      r.shapes.push({ d: poly([n0, nf, brk, tip, notch, ctip], true), k: 'line' });
      r.shapes.push({ d: poly([T(s * 0.46, 0.09), T(s * 0.56, 0.34), T(s * 0.2, 0.72)]), k: 'stitch' });
    }
    // front edge with a cutaway, two buttons
    const fe = [T(0.02, 0.78), T(0.0, 1.0), T(-0.08, hemV - 0.2), T(-0.3, hemV)];
    r.shapes.push({ d: curve(fe), k: 'seam' }, { d: curve(fe.map((p) => ({ x: p.x - 3, y: p.y }))), k: 'stitch' });
    for (const v of [0.82, 1.04]) r.shapes.push({ d: circle(T(0.0, v), 2.8), k: 'line' }, { d: circle(T(0.0, v), 1.2), k: 'rib' });
    // darts and princess seams
    for (const s of [-1, 1]) {
      const pr = [T(s * 0.5, 0.36), T(s * 0.44, 0.7), T(s * 0.4, 1.0), T(s * 0.42, hemV - 0.1)];
      r.shapes.push({ d: curve(pr), k: 'seam' });
      // flap pockets
      pocketAt(r, T(s * 0.3, hemV - 0.42), T(s * 0.7, hemV - 0.38), 11, 'flap');
    }
    const bp = [T(0.34, 0.4), T(0.64, 0.38)];
    pocketAt(r, bp[0], bp[1], 0, 'welt');
    r.anchors.push(
      { key: 'lapel', label: 'Notch lapels', desc: 'Notch lapels, canvas front, pick stitched edge', x: T(0.58, 0.28).x, y: T(0.58, 0.28).y },
      { key: 'btn', label: 'Two buttons', desc: 'Single breasted, 2 horn buttons, cutaway front', x: T(0.0, 0.93).x + 3, y: T(0.0, 0.93).y },
      { key: 'flap', label: 'Flap pockets', desc: 'Jetted pockets with flaps, lined', x: T(0.5, hemV - 0.38).x, y: T(0.5, hemV - 0.38).y + 6 },
      { key: 'welt', label: 'Breast pocket', desc: 'Welt breast pocket, left side', x: lerp(bp[0], bp[1], 0.5).x, y: lerp(bp[0], bp[1], 0.5).y },
      { key: 'princess', label: 'Princess seams', desc: 'Shaped seams from the armhole to the hem', x: T(0.42, 0.9).x, y: T(0.42, 0.9).y },
    );
  } else {
    r.shapes.push({ d: `M150,${f1(T(0, 0.06).y)} L150,${f1(hemY)}`, k: 'seam' });
    for (const s of [-1, 1]) {
      const sd = [T(s * 0.5, 0.36), T(s * 0.4, 1.0), T(s * 0.42, hemV)];
      r.shapes.push({ d: curve(sd), k: 'seam' });
    }
    r.shapes.push({ d: `M${P(T(-0.07, hemV - 0.42))} L${P({ x: T(-0.07, 0).x, y: hemY })} M${P(T(0.07, hemV - 0.42))} L${P({ x: T(0.07, 0).x, y: hemY })}`, k: 'seam' });
    r.anchors.push(
      { key: 'cb', label: 'Back seam', desc: 'Centre back seam, lined', x: 152, y: T(0, 0.6).y },
      { key: 'vent', label: 'Centre vent', desc: 'Centre back vent, overlapped', x: T(0.07, hemV - 0.26).x + 4, y: T(0.07, hemV - 0.26).y },
    );
  }
  // working buttons on the cuffs
  for (const K of ['L', 'R'] as const) {
    const { so, si, u } = sleeveOf2(c, K);
    const L = 12;
    const cc = lerp({ x: so.x - u.x * L, y: so.y - u.y * L }, { x: si.x - u.x * L, y: si.y - u.y * L }, 0.5);
    const dx = si.x - so.x, dy = si.y - so.y, n = Math.hypot(dx, dy) || 1;
    for (let i = -1; i <= 1; i++) r.shapes.push({ d: circle({ x: cc.x + (dx / n) * i * 8, y: cc.y + (dy / n) * i * 8 }, 1.8), k: 'line' });
    if (K === 'L') r.anchors.push({ key: 'cuffbtn', label: 'Cuff buttons', desc: '3 buttons at the cuff, working vent', x: cc.x, y: cc.y });
  }
  r.anchors.push({ key: 'hemline', label: 'Hem', desc: 'Blind stitched hem, fully lined', x: 150 + 55, y: hemY - 7 });
  return r;
}

export function blockParts(c: TopCtx): BlockParts | null {
  switch (c.o.block) {
    case 'Hoodie':
      return styleParts(c, hoodie(c, false, { noRib: !ribHemOn(c.o) }));
    case 'Moto jacket':
      return moto(c);
    case 'Dress':
      return dress(c);
    case 'Zip hoodie':
      return styleParts(c, hoodie(c, true, { noRib: !ribHemOn(c.o) }));
    case 'Button-up':
      return buttonUp(c);
    case 'Polo':
      return polo(c);
    case 'Sweatshirt':
      return styleParts(c, sweatshirt(c));
    case 'Bomber':
      return bomber(c);
    case 'Trucker':
      return trucker(c);
    case 'Puffer':
      return puffer(c);
    case 'Trench':
      return trench(c);
    case 'Blazer':
      return blazer(c);
    case 'Mock neck': case 'Quarter zip': case 'Anorak': case 'Work jacket': case 'Coach jacket':
      return streetParts(c);
    default:
      return styleParts(c);
  }
}

