import { rng } from './rng';
import { findPoint, type Garment } from './garment';

export interface Stroke {
  d: string;
  w: number;
  o: number;
}

const n1 = (x: number) => x.toFixed(1);

const has = (g: Garment, ...keys: string[]) => keys.every((k) => g.points.some((p) => p.key === k));

function bottomY(g: Garment): number {
  const p = g.points;
  const ys = ['hemLo', 'hemLi', 'hemRo', 'hemRi'].filter((k) => has(g, k)).map((k) => findPoint(p, k).y);
  const hem = ys.length ? Math.max(...ys) : 0;
  return Math.min(g.cropY ?? Infinity, hem);
}

/** Short curved crease strokes at the knees, crotch and hem. Seeded by garment id. */
export function foldStrokes(g: Garment): Stroke[] {
  const r = rng(g.id + ':folds');
  const p = g.points;
  const out: Stroke[] = [];
  const bottom = bottomY(g);

  const across = (o: { x: number; y: number }, i: { x: number; y: number }, y: number, count: number, spread: number, lenMin: number, lenVar: number) => {
    const dir = Math.sign(i.x - o.x) || 1;
    const width = Math.abs(i.x - o.x);
    for (let k = 0; k < count; k++) {
      const yy = y + (k - (count - 1) / 2) * spread + (r() - 0.5) * 3;
      const fromOuter = r() < 0.5;
      const len = width * (lenMin + r() * lenVar);
      const sx = fromOuter ? o.x + dir * 2 : i.x - dir * 2;
      const ex = sx + (fromOuter ? dir : -dir) * len;
      const bend = 2.5 + r() * 3;
      out.push({ d: `M${n1(sx)},${n1(yy)} Q${n1((sx + ex) / 2)},${n1(yy + bend)} ${n1(ex)},${n1(yy + (r() - 0.5) * 2)}`, w: 1.4, o: 0.26 + r() * 0.1 });
    }
  };

  // knees: slim legs crease across the knee, loose legs mostly fall straight
  const kn = (lo: string, li: string, ho: string, hi: string) => {
    if (!has(g, lo, li)) return;
    const L = legLoose(g, ho, hi);
    const n = Math.round(4 * (1 - L * 0.75));
    if (n > 0) across(findPoint(p, lo), findPoint(p, li), findPoint(p, lo).y - 4, n, 11, 0.4 - L * 0.15, 0.35);
  };
  kn('kneeLo', 'kneeLi', 'hemLo', 'hemLi');
  kn('kneeRo', 'kneeRi', 'hemRo', 'hemRi');

  // crotch: strokes fanning up and out
  const cr = findPoint(p, 'crotch');
  for (let k = 0; k < (has(g, 'crotch', 'waistL') ? 4 : 0); k++) {
    const side = k % 2 ? 1 : -1;
    const sx = cr.x + side * (2 + r() * 3);
    const sy = cr.y - 2 - r() * 4;
    const ex = cr.x + side * (16 + r() * 30);
    const ey = cr.y - 10 - r() * 36;
    out.push({ d: `M${n1(sx)},${n1(sy)} Q${n1(cr.x + side * (8 + r() * 10))},${n1(cr.y - 8 - r() * 14)} ${n1(ex)},${n1(ey)}`, w: 1.2, o: 0.16 + r() * 0.08 });
  }

  // hem stacking
  const hemO = (k: string) => ({ x: findPoint(p, k).x, y: bottom });
  if (has(g, 'hemLo', 'hemLi')) across(hemO('hemLo'), hemO('hemLi'), bottom - 16, 2, 11, 0.3, 0.3);
  if (has(g, 'hemRo', 'hemRi')) across(hemO('hemRo'), hemO('hemRi'), bottom - 16, 2, 11, 0.3, 0.3);
  return out;
}

/** White highlight strokes running down each leg. */
export function highlightStrokes(g: Garment): Stroke[] {
  const r = rng(g.id + ':hi');
  const p = g.points;
  const out: Stroke[] = [];
  const legs: [string[], string[]][] = [
    [['hipL', 'kneeLo', 'hemLo'], ['crotch', 'kneeLi', 'hemLi']],
    [['hipR', 'kneeRo', 'hemRo'], ['crotch', 'kneeRi', 'hemRi']],
  ];
  const bottom = bottomY(g);
  const specs = [
    { f: 0.32, a: 0.25, b: 0.92, w: 3.4, o: 0.26 },
    { f: 0.55, a: 0.12, b: 0.55, w: 2.2, o: 0.3 },
    { f: 0.7, a: 0.5, b: 0.85, w: 1.6, o: 0.22 },
  ];
  for (const [outer, inner] of legs) {
    if (!has(g, ...outer, ...inner)) continue;
    const O = outer.map((k) => findPoint(p, k));
    const I = inner.map((k) => findPoint(p, k));
    for (const s of specs) {
      const f = s.f + (r() - 0.5) * 0.06;
      const L = O.map((o, i) => ({ x: o.x + (I[i].x - o.x) * f, y: o.y + (I[i].y - o.y) * f }));
      const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      // two segments: hip to knee, knee to hem
      const a = lerp(L[0], L[1], s.a);
      const m = L[1];
      const e = lerp(L[1], L[2], s.b);
      const ey = Math.min(e.y, bottom - 8);
      out.push({ d: `M${n1(a.x)},${n1(a.y)} Q${n1(m.x)},${n1(m.y)} ${n1(e.x)},${n1(ey)}`, w: s.w * 1.3, o: s.o * 0.5 });
    }
  }
  return out;
}

/** Faded whiskers fanning out from the crotch toward the hips, like a worn wash. */
export function whiskerStrokes(g: Garment): Stroke[] {
  if (!has(g, 'crotch', 'hipL', 'hipR')) return [];
  const r = rng(g.id + ':whisk');
  const p = g.points;
  const cr = findPoint(p, 'crotch');
  const out: Stroke[] = [];
  for (const side of [-1, 1]) {
    const hip = findPoint(p, side < 0 ? 'hipL' : 'hipR');
    for (let k = 0; k < 5; k++) {
      const sx = cr.x + side * (5 + k * 3 + r() * 3);
      const sy = cr.y - 4 - k * 7 - r() * 3;
      const ex = cr.x + (hip.x - cr.x) * (0.5 + r() * 0.25);
      const ey = sy - 5 - r() * 7 - k * 2;
      const cx = (sx + ex) / 2, cy = Math.min(sy, ey) - 2 - r() * 4;
      out.push({ d: `M${n1(sx)},${n1(sy)} Q${n1(cx)},${n1(cy)} ${n1(ex)},${n1(ey)}`, w: 2.6 - k * 0.3, o: 0.34 - k * 0.04 });
    }
  }
  return out;
}

export interface Spot {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  o: number;
}

/** Soft faded patches down the front of each thigh and over the knees. */
export function fadeSpots(g: Garment): Spot[] {
  const p = g.points;
  const out: Spot[] = [];
  for (const [hip, ko, ki] of [['hipL', 'kneeLo', 'kneeLi'], ['hipR', 'kneeRo', 'kneeRi']] as const) {
    if (!has(g, hip, ko, ki, 'crotch')) continue;
    const h = findPoint(p, hip), cr = findPoint(p, 'crotch'), o = findPoint(p, ko), i = findPoint(p, ki);
    const top = { x: (h.x + cr.x) / 2, y: (h.y + cr.y) / 2 };
    const knee = { x: (o.x + i.x) / 2, y: (o.y + i.y) / 2 };
    const kw = Math.abs(o.x - i.x);
    const tw = Math.abs(h.x - cr.x);
    out.push({ cx: top.x + (knee.x - top.x) * 0.42, cy: top.y + (knee.y - top.y) * 0.42, rx: tw * 0.28, ry: (knee.y - top.y) * 0.32, o: 0.2 });
    out.push({ cx: knee.x, cy: knee.y - 6, rx: kw * 0.3, ry: 18, o: 0.14 });
  }
  return out;
}

/** How loose the leg is, 0 for skinny to 1 for wide, from the hem opening. */
export function legLoose(g: Garment, lo: string, li: string): number {
  if (!has(g, lo, li)) return 0;
  return Math.max(0, Math.min(1, (Math.abs(findPoint(g.points, lo).x - findPoint(g.points, li).x) - 26) / 40));
}

/** Long soft drape folds that fall from the knee to the hem on looser legs. */
export function drapeFolds(g: Garment): { dark: Stroke[]; light: Stroke[] } {
  const r = rng(g.id + ':drape');
  const p = g.points;
  const dark: Stroke[] = [];
  const light: Stroke[] = [];
  for (const [ko, ki, ho, hi] of [['kneeLo', 'kneeLi', 'hemLo', 'hemLi'], ['kneeRo', 'kneeRi', 'hemRo', 'hemRi']] as const) {
    if (!has(g, ko, ki, ho, hi)) continue;
    const L = legLoose(g, ho, hi);
    const count = 1 + Math.round(L * 3);
    const K = [findPoint(p, ko), findPoint(p, ki)], H = [findPoint(p, ho), findPoint(p, hi)];
    for (let k = 0; k < count; k++) {
      const f = (k + 0.5 + (r() - 0.5) * 0.5) / count;
      const top = { x: K[0].x + (K[1].x - K[0].x) * (0.3 + f * 0.4), y: K[0].y - 30 - r() * 50 };
      const bot = { x: H[0].x + (H[1].x - H[0].x) * f, y: Math.max(H[0].y, H[1].y) - 4 };
      const mid = { x: (top.x + bot.x) / 2 + (r() - 0.5) * 10, y: (top.y + bot.y) / 2 };
      const d = `M${n1(top.x)},${n1(top.y)} Q${n1(mid.x)},${n1(mid.y)} ${n1(bot.x)},${n1(bot.y)}`;
      dark.push({ d, w: 3 + L * 3, o: 0.12 + L * 0.12 });
      light.push({ d: `M${n1(top.x + 4)},${n1(top.y + 10)} Q${n1(mid.x + 4)},${n1(mid.y)} ${n1(bot.x + 4)},${n1(bot.y - 6)}`, w: 2 + L * 2, o: 0.08 + L * 0.1 });
    }
    // break where the hem lands on the shoe
    const hy = Math.max(H[0].y, H[1].y);
    for (let k = 0; k < 2 + Math.round(L * 2); k++) {
      const f = 0.2 + r() * 0.6;
      const x = H[0].x + (H[1].x - H[0].x) * f;
      const y = hy - 10 - k * 9 - r() * 4;
      const span = Math.abs(H[1].x - H[0].x) * (0.18 + r() * 0.2);
      dark.push({ d: `M${n1(x - span)},${n1(y + 3)} Q${n1(x)},${n1(y - 4)} ${n1(x + span)},${n1(y + 2)}`, w: 2.4, o: 0.2 });
    }
  }
  return { dark, light };
}
