// Block specific drawing for flats: hoodie, moto jacket and dress on the tops engine, plus shorts and skirt.
// Everything is in flat sheet space (the same space topViews and jeansViews draw in).

import type { FlatAnchor, FlatShape } from './flats';
import type { Garment } from './garment';
import { dressTopOf, silhouetteOf, type TopOpts } from './top';

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

const f1 = (n: number) => n.toFixed(1);
const P = (p: V) => `${f1(p.x)},${f1(p.y)}`;
const poly = (pts: V[], closed = false) => 'M' + pts.map(P).join(' L') + (closed ? ' Z' : '');
const lerp = (a: V, b: V, k: number): V => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const circle = (c: V, r: number) => `M${f1(c.x - r)},${f1(c.y)} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`;
/** Smooth curve through points (Catmull Rom to bezier). */
function curve(pts: V[], closed = false): string {
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

const empty = (): BlockParts => ({ shapes: [], behind: [], over: [], anchors: [], drop: [], rename: {}, extent: [] });

/** Zip: a line with teeth beside it, and a pull at the start. */
function zip(pts: V[], pull = true): FlatShape[] {
  const out: FlatShape[] = [
    { d: curve(pts), k: 'line' },
    { d: curve(pts), k: 'stitch', t: [2.2, 0] },
  ];
  if (pull) out.push({ d: circle({ x: pts[0].x, y: pts[0].y - 3 }, 2), k: 'line' });
  return out;
}

/** Short rib ticks between two parallel polylines. */
function ticks(a: V[], b: V[], step: number): string {
  let d = '';
  for (let i = 0; i < a.length; i += step) d += `M${P(a[i])} L${P(b[i])} `;
  return d;
}

// ---------- hoodie ----------

function hoodie(c: TopCtx): BlockParts {
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
  if (!back) {
    const nf = at('neckF') as V;
    const y0 = nf.y + 3;
    for (const s of [-1, 1]) {
      const x0 = 150 + s * 11;
      const cord = [{ x: x0, y: y0 }, { x: x0 + s * 2, y: y0 + 28 }, { x: x0 - s * 1, y: y0 + 56 }, { x: x0 + s * 2, y: y0 + 82 }];
      r.shapes.push({ d: circle(cord[0], 1.7), k: 'line' }, { d: curve(cord), k: 'line' }, { d: `M${f1(cord[3].x)},${f1(cord[3].y)} l${f1(s * 0.4)},9`, k: 'line' });
    }
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

  // rib cuffs
  for (const K of ['L', 'R'] as const) {
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

export function blockParts(c: TopCtx): BlockParts | null {
  switch (c.o.block) {
    case 'Hoodie':
      return hoodie(c);
    case 'Moto jacket':
      return moto(c);
    case 'Dress':
      return dress(c);
    default:
      return null;
  }
}

