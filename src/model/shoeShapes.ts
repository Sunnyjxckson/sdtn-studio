// Shoes: geometry on the croquis feet. Everything is built in a frame at the ankle:
// d runs from the ankle to the toe, p across the foot, e up the shin.

import type { FootFrame, Vec } from './figure';
import type { ShoeKind, ShoeOpts } from './shoes';
import { heelKindOf } from './shoes';

export interface ShoeGeom {
  /** Closed outlines that share one fill (foot upper, shaft). */
  parts: string[];
  /** Sole, drawn behind the upper. */
  sole: string;
  /** Thin stroked details: seams, toe cap, creases. */
  lines: string;
  /** Laces and lace-like bars. */
  laces: string;
  /** Small filled dark shapes: eyelets, gussets, throat. */
  accent: string;
  /** Gussets and pads in a darker tone of the upper. */
  panels: string;
  /** Heel pin or block, if any, and whether it is drawn over the upper. */
  pin: string | null;
  pinOver: boolean;
  /** Where the sheen sits on the toe box. */
  sheen: { x: number; y: number; rx: number; ry: number; deg: number };
  /** Bounds for gradients. */
  top: number;
  bottom: number;
}

const f = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

function profAt(arr: [number, number][], t: number): number {
  if (!arr.length) return 8;
  if (t <= arr[0][0]) return arr[0][1];
  for (let i = 0; i < arr.length - 1; i++) {
    if (t <= arr[i + 1][0]) {
      const k = (t - arr[i][0]) / (arr[i + 1][0] - arr[i][0] || 1);
      return arr[i][1] + k * (arr[i + 1][1] - arr[i][1]);
    }
  }
  return arr[arr.length - 1][1];
}

interface Style {
  /** Shaft height as a fraction of the shin length. */
  shaft: number;
  /** Extra width over the shin at the top of the shaft. */
  flare: number;
  /** Toe roundness: lower is blunter. */
  toe: number;
  /** Ball width scale. */
  wide: number;
  /** Sole thickness. */
  sole: number;
  /** Where the toe box begins, as a fraction of the foot. */
  box: number;
}

const STYLE: Record<ShoeKind, Style> = {
  Sneaker: { shaft: 0.05, flare: 0.5, toe: 0.52, wide: 1, sole: 5.5, box: 0.6 },
  'High top': { shaft: 0.25, flare: 0.8, toe: 0.52, wide: 1, sole: 5.5, box: 0.6 },
  'Combat boot': { shaft: 0.31, flare: 1.8, toe: 0.48, wide: 1.07, sole: 8, box: 0.62 },
  'Chelsea boot': { shaft: 0.27, flare: 1.2, toe: 0.7, wide: 0.93, sole: 5, box: 0.64 },
  Loafer: { shaft: 0.03, flare: 0.3, toe: 0.58, wide: 0.97, sole: 3.2, box: 0.6 },
  Heel: { shaft: 0.0, flare: 0, toe: 1.25, wide: 0.82, sole: 2.4, box: 0.6 },
};

/** Build the shoe for one foot. */
export function shoeGeom(o: ShoeOpts, fr: FootFrame, view: 'front' | 'back'): ShoeGeom {
  const st = STYLE[o.kind];
  const back = view === 'back';
  const O = fr.ankle;
  const dv = { x: fr.toe.x - O.x, y: fr.toe.y - O.y };
  const L = Math.hypot(dv.x, dv.y) || 70;
  const stockFoot = fr.halfW >= 12;
  // toes turn out a little, as on a croquis
  const sp = (fr.index === 0 ? -1 : 1) * (back ? 0.03 : stockFoot ? 0.05 : 0.07);
  const d0 = { x: dv.x / L, y: dv.y / L };
  const dl = Math.hypot(d0.x + d0.y * sp, d0.y - d0.x * sp) || 1;
  const d = { x: (d0.x + d0.y * sp) / dl, y: (d0.y - d0.x * sp) / dl };
  const p = { x: -d.y, y: d.x };
  const ev = { x: fr.knee.x - O.x, y: fr.knee.y - O.y };
  const shin = Math.hypot(ev.x, ev.y) || 200;
  const e = { x: ev.x / shin, y: ev.y / shin };
  const q = { x: e.y, y: -e.x }; // screen left of the shin
  const P = (u: number, v: number): Vec => ({ x: O.x + d.x * u + p.x * v, y: O.y + d.y * u + p.y * v });
  const Pt = (u: number, v: number) => {
    const a = P(u, v);
    return f(a.x, a.y);
  };

  // widths
  const A0 = (profAt(fr.shin.left, 1) + profAt(fr.shin.right, 1)) / 2;
  const A = A0 + 3;
  const stock = stockFoot;
  const W = (stock ? fr.halfW + 0.5 : fr.halfW * 1.25 + 4.5) * st.wide * (back ? 0.84 : 1) * (o.kind === 'Heel' ? 1 : 1);
  const open = o.kind === 'Heel' && !back;
  const u0 = open ? 0.26 * L : -0.06 * L;
  const tip = o.kind === 'Heel' && !back ? L * 0.8 : L + 3;
  const box = st.box * (tip / L);
  const start = box * L;

  const hw = (u: number): number => {
    if (u <= 0) return A;
    if (u < start) return A + (W - A) * smooth(u / start);
    const s = (u - start) / (tip - start);
    if (s >= 1) return 0;
    if (back) return W * Math.pow(Math.max(0, 1 - s * s), 0.5);
    return W * Math.pow(Math.max(0, 1 - Math.pow(s, 2 / st.toe + 0.4)), 0.62);
  };

  const N = 22;
  const us: number[] = [];
  for (let i = 0; i <= N; i++) us.push(u0 + ((tip - u0) * i) / N);
  const left = us.map((u) => Pt(u, -hw(u)));
  const right = us.map((u) => Pt(u, hw(u))).reverse();
  let upper = 'M' + left.join(' L') + ' L' + right.join(' L');
  if (open) upper += ' L' + Pt(0.46 * L, 0) + ' Z';
  else upper += ' Z';

  // sole: the upper pushed down the foot and a touch wider
  const sT = st.sole;
  const soleL = us.map((u) => Pt(u + sT * 0.9, -(hw(u) + 1.6)));
  const soleR = us.map((u) => Pt(u + sT * 0.9, hw(u) + 1.6)).reverse();
  const sole = 'M' + soleL.join(' L') + ' L' + soleR.join(' L') + ' Z';

  // shaft up the shin
  const parts: string[] = [upper];
  const H = shin * st.shaft;
  const shaftAt = (h: number) => {
    const t = Math.min(1, Math.max(0.5, 1 - h / shin));
    const pad = 3 + st.flare * Math.min(1, h / Math.max(H, 1));
    const dl = profAt(fr.shin.left, t) + pad;
    const dr = profAt(fr.shin.right, t) + pad;
    const c = { x: O.x + e.x * h, y: O.y + e.y * h };
    return { c, l: { x: c.x + q.x * dl, y: c.y + q.y * dl }, r: { x: c.x - q.x * dr, y: c.y - q.y * dr }, dl, dr };
  };
  const hs: number[] = [];
  if (H > 0) {
    const n = 7;
    for (let i = 0; i <= n; i++) hs.push(-3 + ((H + 3) * i) / n);
    const ls = hs.map((h) => shaftAt(h).l);
    const rs = hs.map((h) => shaftAt(h).r).reverse();
    // a slightly curved top, rising toward the middle
    const top = shaftAt(H);
    const mid = { x: top.c.x + e.x * (back ? 2.5 : 1.5), y: top.c.y + e.y * (back ? 2.5 : 1.5) };
    parts.push('M' + ls.map((a) => f(a.x, a.y)).join(' L') + ` Q${f(mid.x, mid.y)} ${f(top.r.x, top.r.y)} L` + rs.slice(1).map((a) => f(a.x, a.y)).join(' L') + ' Z');
  }

  let lines = '';
  let laces = '';
  let accent = '';
  let panels = '';
  const kind = o.kind;
  const sh = (h: number) => shaftAt(h);

  const eyelets = (rows: number[], frac: number) => {
    rows.forEach((h) => {
      const s = sh(h);
      const l = { x: s.c.x + q.x * s.dl * frac, y: s.c.y + q.y * s.dl * frac };
      const r = { x: s.c.x - q.x * s.dr * frac, y: s.c.y - q.y * s.dr * frac };
      accent += ` M${f(l.x - 0.9, l.y)} a0.9,0.9 0 1,0 1.8,0 a0.9,0.9 0 1,0 -1.8,0 M${f(r.x - 0.9, r.y)} a0.9,0.9 0 1,0 1.8,0 a0.9,0.9 0 1,0 -1.8,0`;
    });
  };

  if (!back) {
    if (kind === 'Sneaker' || kind === 'High top' || kind === 'Combat boot') {
      // toe cap
      const uc = start * 1.1;
      lines += ` M${Pt(uc, -hw(uc) * 0.96)} Q${Pt(uc + 8, 0)} ${Pt(uc, hw(uc) * 0.96)}`;
      if (kind === 'Sneaker' || kind === 'High top') {
        const uc2 = tip - 7;
        lines += ` M${Pt(uc2, -hw(uc2) * 0.8)} Q${Pt(uc2 + 3, 0)} ${Pt(uc2, hw(uc2) * 0.8)}`;
      }
      // lace stay and bars across the vamp
      const nU = kind === 'Combat boot' ? 4 : 4;
      for (let i = 0; i < nU; i++) {
        const u = 0.06 * L + ((start * 0.95 - 0.06 * L) * i) / (nU - 1);
        const w = hw(u) * 0.55;
        laces += ` M${Pt(u, -w)} L${Pt(u + 3.5, w)} M${Pt(u + 3.5, -w)} L${Pt(u, w)}`;
      }
      lines += ` M${Pt(0.02 * L, -hw(0.02 * L) * 0.72)} L${Pt(start * 1.02, -hw(start) * 0.5)} M${Pt(0.02 * L, hw(0.02 * L) * 0.72)} L${Pt(start * 1.02, hw(start) * 0.5)}`;
      if (H > 12) {
        const gap = kind === 'Combat boot' ? 8.5 : 9.5;
        const rows: number[] = [];
        for (let h = 5; h < H - 5; h += gap) rows.push(h);
        rows.forEach((h) => {
          const s = sh(h);
          const w = Math.min(s.dl, s.dr) * 0.6;
          const a = { x: s.c.x + q.x * w, y: s.c.y + q.y * w };
          const b = { x: s.c.x - q.x * w, y: s.c.y - q.y * w };
          const h2 = Math.min(H, h + 4);
          const s2 = sh(h2);
          const a2 = { x: s2.c.x + q.x * w, y: s2.c.y + q.y * w };
          const b2 = { x: s2.c.x - q.x * w, y: s2.c.y - q.y * w };
          laces += ` M${f(a.x, a.y)} L${f(b2.x, b2.y)} M${f(b.x, b.y)} L${f(a2.x, a2.y)}`;
        });
        if (kind === 'Combat boot') eyelets(rows, 0.78);
        const tp = sh(H);
        lines += ` M${f(tp.l.x - e.x * 5, tp.l.y - e.y * 5)} L${f(tp.r.x - e.x * 5, tp.r.y - e.y * 5)}`;
      } else {
        // a low collar: darker mouth, tongue
        const s = sh(H * 0.7);
        const w = Math.min(s.dl, s.dr) * 0.55;
        accent += ` M${f(s.c.x + q.x * w, s.c.y + q.y * w)} Q${f(s.c.x + e.x * 4, s.c.y + e.y * 4)} ${f(s.c.x - q.x * w, s.c.y - q.y * w)} Q${f(s.c.x - e.x * 1, s.c.y - e.y * 1)} ${f(s.c.x + q.x * w, s.c.y + q.y * w)} Z`;
      }
    } else if (kind === 'Chelsea boot') {
      const uc = start * 1.05;
      lines += ` M${Pt(uc, -hw(uc) * 0.9)} Q${Pt(uc + 9, 0)} ${Pt(uc, hw(uc) * 0.9)}`;
      // elastic gussets low on each side of the shaft
      for (const sd of [-1, 1]) {
        const s0 = sh(4), s1 = sh(H * 0.62);
        const k0 = sd < 0 ? s0.dl : s0.dr, k1 = sd < 0 ? s1.dl : s1.dr;
        const at = (s: ReturnType<typeof sh>, k: number, off: number) => {
          const m = sd < 0 ? 1 : -1;
          return { x: s.c.x + q.x * m * (k - off), y: s.c.y + q.y * m * (k - off) };
        };
        const a = at(s0, k0, 0.5), b = at(s0, k0, 6.5), c = at(s1, k1, 6.5), dd = at(s1, k1, 0.5);
        panels += ` M${f(a.x, a.y)} L${f(b.x, b.y)} L${f(c.x, c.y)} L${f(dd.x, dd.y)} Z`;
      }
      const tp = sh(H);
      // pull tab
      const tabA = { x: tp.c.x + e.x * 1, y: tp.c.y + e.y * 1 };
      panels += ` M${f(tabA.x - q.x * 3, tabA.y - q.y * 3)} L${f(tabA.x + e.x * 7 - q.x * 3, tabA.y + e.y * 7 - q.y * 3)} L${f(tabA.x + e.x * 7 + q.x * 3, tabA.y + e.y * 7 + q.y * 3)} L${f(tabA.x + q.x * 3, tabA.y + q.y * 3)} Z`;
    } else if (kind === 'Loafer') {
      const u1 = 0.3 * L, u2 = 0.4 * L;
      lines += ` M${Pt(u1, -hw(u1) * 0.98)} Q${Pt(u1 + 4, 0)} ${Pt(u1, hw(u1) * 0.98)} M${Pt(u2, -hw(u2) * 0.98)} Q${Pt(u2 + 4, 0)} ${Pt(u2, hw(u2) * 0.98)}`;
      accent += ` M${Pt(u1 + 2, -4.2)} L${Pt(u2 + 2, -4.2)} L${Pt(u2 + 2, 4.2)} L${Pt(u1 + 2, 4.2)} Z`;
      const uc = start * 1.15;
      lines += ` M${Pt(uc, -hw(uc) * 0.92)} Q${Pt(uc + 6, 0)} ${Pt(uc, hw(uc) * 0.92)}`;
      const s = sh(H * 0.6);
      const w = Math.min(s.dl, s.dr) * 0.6;
      accent += ` M${f(s.c.x + q.x * w, s.c.y + q.y * w)} Q${f(s.c.x + e.x * 3, s.c.y + e.y * 3)} ${f(s.c.x - q.x * w, s.c.y - q.y * w)} Q${f(s.c.x, s.c.y)} ${f(s.c.x + q.x * w, s.c.y + q.y * w)} Z`;
    } else {
      // pump: a seam along the vamp edge
      lines += ` M${Pt(0.3 * L, -hw(0.3 * L) * 0.9)} Q${Pt(0.4 * L, 0)} ${Pt(0.3 * L, hw(0.3 * L) * 0.9)}`;
    }
  } else {
    // back of the shoe: centre seam, heel counter and pull tab
    if (H > 0) {
      const tp = sh(H);
      lines += ` M${f(tp.c.x, tp.c.y)} L${Pt(0.1 * L, 0)}`;
      lines += ` M${f(tp.l.x - e.x * 5 + (tp.c.x - tp.l.x) * 0.0, tp.l.y - e.y * 5)} L${f(tp.r.x - e.x * 5, tp.r.y - e.y * 5)}`;
      if (kind === 'Chelsea boot') {
        for (const sd of [-1, 1]) {
          const s0 = sh(4), s1 = sh(H * 0.62);
          const m = sd < 0 ? 1 : -1;
          const k0 = sd < 0 ? s0.dl : s0.dr, k1 = sd < 0 ? s1.dl : s1.dr;
          const at = (s: ReturnType<typeof sh>, k: number, off: number) => ({ x: s.c.x + q.x * m * (k - off), y: s.c.y + q.y * m * (k - off) });
          const a = at(s0, k0, 0.5), b = at(s0, k0, 6.5), c = at(s1, k1, 6.5), dd = at(s1, k1, 0.5);
          panels += ` M${f(a.x, a.y)} L${f(b.x, b.y)} L${f(c.x, c.y)} L${f(dd.x, dd.y)} Z`;
        }
      }
      // tab
      const t0 = { x: tp.c.x + e.x * 0.5, y: tp.c.y + e.y * 0.5 };
      panels += ` M${f(t0.x - q.x * 3, t0.y - q.y * 3)} L${f(t0.x + e.x * 7 - q.x * 3, t0.y + e.y * 7 - q.y * 3)} L${f(t0.x + e.x * 7 + q.x * 3, t0.y + e.y * 7 + q.y * 3)} L${f(t0.x + q.x * 3, t0.y + q.y * 3)} Z`;
    } else {
      lines += ` M${Pt(0.05 * L, 0)} L${Pt(tip * 0.7, 0)}`;
    }
    // heel cup edge
    lines += ` M${Pt(tip * 0.6, -hw(tip * 0.6) * 0.95)} Q${Pt(tip * 0.7, 0)} ${Pt(tip * 0.6, hw(tip * 0.6) * 0.95)}`;
  }

  // heel pin or block
  let pin: string | null = null;
  let pinOver = false;
  if (kind === 'Heel') {
    const block = heelKindOf(o) === 'Block';
    const wTop = block ? 8.5 : 3.6;
    const wBot = block ? 7.5 : 1.7;
    if (!back) {
      const top = P(0.3 * L, 0);
      const bot = { x: top.x + d.x * 3, y: Math.max(P(tip, 0).y + 14, fr.toe.y + 4) };
      pin = `M${f(top.x - wTop, top.y)} L${f(top.x + wTop, top.y)} L${f(bot.x + wBot, bot.y)} L${f(bot.x - wBot, bot.y)} Z`;
    } else {
      const top = P(tip * 0.74, 0);
      const bot = { x: top.x, y: top.y + (block ? 16 : 22) };
      pin = `M${f(top.x - wTop, top.y)} L${f(top.x + wTop, top.y)} L${f(bot.x + wBot, bot.y)} L${f(bot.x - wBot, bot.y)} Z`;
      pinOver = true;
    }
  }

  const sc = P(start * 0.82, 0);
  const sheen = { x: sc.x - p.x * W * 0.25, y: sc.y - p.y * W * 0.25, rx: W * 0.28, ry: L * 0.16, deg: (Math.atan2(d.y, d.x) * 180) / Math.PI - 90 };
  const all = [O.y, O.y + e.y * H, fr.toe.y, ...(pin ? [fr.toe.y + 8] : [])];
  return { parts, sole, lines, laces, accent, panels, pin, pinOver, sheen, top: Math.min(...all), bottom: Math.max(...all) + 6 };
}
