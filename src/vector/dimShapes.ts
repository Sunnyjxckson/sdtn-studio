// Geometry for angular, radius and diameter dimensions. Linear ones are drawn by the original code.
import type { VDim } from '../model/vector';

export interface DimPart {
  d: string;
  /** Stroke width multiplier. */
  w: number;
  faint?: boolean;
}
export interface DimShape {
  parts: DimPart[];
  label: { x: number; y: number; rot: number; text: string };
}

const n2 = (n: number) => Math.round(n * 100) / 100;
const fmtIn = (n: number) => `${(Math.round(n * 100) / 100).toString()}"`;

export const isExtraDim = (d: VDim) => d.mode === 'angular' || d.mode === 'radius' || d.mode === 'diameter';

const flip = (deg: number) => (deg > 90 || deg < -90 ? deg + 180 : deg);

function arrow(tip: { x: number; y: number }, ux: number, uy: number, s = 6) {
  // ux, uy points from the tip back along the line
  const nx = -uy, ny = ux;
  return `M${n2(tip.x + ux * s + nx * s * 0.35)},${n2(tip.y + uy * s + ny * s * 0.35)} L${n2(tip.x)},${n2(tip.y)} L${n2(tip.x + ux * s - nx * s * 0.35)},${n2(tip.y + uy * s - ny * s * 0.35)}`;
}

export function dimShape(d: VDim): DimShape {
  if (d.mode === 'angular') {
    const v = { x: d.vx ?? d.ax, y: d.vy ?? d.ay };
    const a1 = Math.atan2(d.ay - v.y, d.ax - v.x);
    const a2 = Math.atan2(d.by - v.y, d.bx - v.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const la = Math.hypot(d.ax - v.x, d.ay - v.y), lb = Math.hypot(d.bx - v.x, d.by - v.y);
    const r = Math.max(18, Math.min(la, lb) * 0.7);
    const p = (a: number, rr: number) => ({ x: v.x + Math.cos(a) * rr, y: v.y + Math.sin(a) * rr });
    const s = p(a1, r), e = p(a2, r);
    const mid = a1 + delta / 2;
    const lp = p(mid, r + 12);
    const deg = Math.abs(delta) * (180 / Math.PI);
    return {
      parts: [
        { d: `M${n2(v.x)},${n2(v.y)} L${n2(d.ax)},${n2(d.ay)} M${n2(v.x)},${n2(v.y)} L${n2(d.bx)},${n2(d.by)}`, w: 0.6, faint: true },
        { d: `M${n2(s.x)},${n2(s.y)} A${n2(r)},${n2(r)} 0 0 ${delta > 0 ? 1 : 0} ${n2(e.x)},${n2(e.y)}`, w: 1 },
        { d: arrow(s, -Math.sin(a1) * Math.sign(delta || 1) * -1, Math.cos(a1) * Math.sign(delta || 1), 5) + ' ' + arrow(e, -Math.sin(a2) * Math.sign(delta || 1), Math.cos(a2) * -Math.sign(delta || 1), 5), w: 1 },
      ],
      label: { x: lp.x, y: lp.y + 4, rot: 0, text: `${n2(deg)}°` },
    };
  }
  const c = { x: d.ax, y: d.ay }, r = { x: d.bx, y: d.by };
  const len = Math.hypot(r.x - c.x, r.y - c.y) || 1;
  const ux = (c.x - r.x) / len, uy = (c.y - r.y) / len;
  const ang = (Math.atan2(r.y - c.y, r.x - c.x) * 180) / Math.PI;
  const inches = len / (d.ppi || 1);
  const cross = `M${n2(c.x - 3)},${n2(c.y)} L${n2(c.x + 3)},${n2(c.y)} M${n2(c.x)},${n2(c.y - 3)} L${n2(c.x)},${n2(c.y + 3)}`;
  if (d.mode === 'radius') {
    return {
      parts: [
        { d: `M${n2(c.x)},${n2(c.y)} L${n2(r.x)},${n2(r.y)}`, w: 1 },
        { d: arrow(r, ux, uy), w: 1 },
        { d: cross, w: 0.8 },
      ],
      label: { x: (c.x + r.x) / 2 + -uy * -9, y: (c.y + r.y) / 2 + ux * -9, rot: flip(ang), text: `R ${fmtIn(inches)}` },
    };
  }
  const o = { x: 2 * c.x - r.x, y: 2 * c.y - r.y };
  return {
    parts: [
      { d: `M${n2(o.x)},${n2(o.y)} L${n2(r.x)},${n2(r.y)}`, w: 1 },
      { d: arrow(r, ux, uy) + ' ' + arrow(o, -ux, -uy), w: 1 },
      { d: cross, w: 0.8 },
    ],
    label: { x: c.x + uy * 9, y: c.y - ux * 9, rot: flip(ang), text: `Ø ${fmtIn(inches * 2)}` },
  };
}
