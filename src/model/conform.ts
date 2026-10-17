// Put a garment on the posed body for display. The outline is densified, carried onto the body by
// the smooth pose warp, then pushed out wherever it would cut into the croquis (plus a little ease),
// so slim fits hug thighs and calves and wide fits keep their shape. The waist edge gets a curve so
// the band wraps around the body, and the leg furthest away gets a shadow shape. Display only: the
// saved points, the spec and the pattern never see any of this.

import { poseWarp, type BodyProfile, type BoneProf, type PoseRigOut, type Vec } from './figure';
import type { Garment, Pt } from './garment';

const EASE = { leg: 2.2, hip: 1.6 };
/** Garment units between added points along the legs. */
const STEP = 8;

type Chain = 'waist' | 'outR' | 'hemR' | 'inR' | 'inL' | 'hemL' | 'outL' | 'none';

export interface Fitted {
  /** Copy of the garment with geometry already on the body (garment units, same transform). */
  g: Garment;
  /** Index into g.points for each original point. */
  index: number[];
  /** How far to pull the top corners of the waistband in, garment units, left and right. */
  bandInset: [number, number];
  /** When one leg is behind the other: draw `back` first, then `front` over it. */
  layers: { back: Layer; front: Layer } | null;
}

export interface Layer {
  g: Garment;
  /** Visible outline only, as an open path (the hidden join is left out). */
  edge: string;
}

const pathOf = (pts: Vec[], closed: boolean) =>
  'M' + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + (closed ? ' Z' : '');

function profAt(arr: [number, number][], t: number): number | null {
  if (!arr.length) return null;
  if (t <= arr[0][0]) return arr[0][1];
  for (let i = 0; i < arr.length - 1; i++) {
    const [t0, d0] = arr[i], [t1, d1] = arr[i + 1];
    if (t <= t1) return d0 + ((t - t0) / (t1 - t0 || 1)) * (d1 - d0);
  }
  return arr[arr.length - 1][1];
}

function hipAt(body: BodyProfile, y: number): { l: number; r: number } | null {
  const h = body.hips;
  if (!h.length || y < h[0].y - 14 || y > h[h.length - 1].y + 8) return null;
  if (y <= h[0].y) return h[0];
  for (let i = 0; i < h.length - 1; i++) {
    const a = h[i], b = h[i + 1];
    if (y <= b.y) {
      const t = (y - a.y) / (b.y - a.y || 1);
      return { l: a.l + (b.l - a.l) * t, r: a.r + (b.r - a.r) * t };
    }
  }
  return h[h.length - 1];
}

/** snap: near the top of the thigh, ease toward the hip ease so the side line runs on smoothly. */
function pushFromBone(bone: BoneProf, p: Vec, side: 'left' | 'right', snap?: { ease: number; until: number }): Vec {
  const dx = bone.b.x - bone.a.x, dy = bone.b.y - bone.a.y;
  const L = Math.hypot(dx, dy) || 1;
  const u = { x: dx / L, y: dy / L };
  const n = { x: u.y, y: -u.x };
  const t = ((p.x - bone.a.x) * u.x + (p.y - bone.a.y) * u.y) / L;
  if (t < -0.15 || t > 1.25) return p;
  const w = profAt(bone[side], Math.max(0, Math.min(1, t)));
  if (w == null) return p;
  const base = { x: bone.a.x + u.x * t * L, y: bone.a.y + u.y * t * L };
  let d = (p.x - base.x) * n.x + (p.y - base.y) * n.y;
  const need = w + EASE.leg;
  const d0 = d;
  if (side === 'left' && -d < need) d = -need;
  else if (side === 'right' && d < need) d = need;
  if (snap && t < snap.until) {
    const target = (w + snap.ease) * (side === 'left' ? -1 : 1);
    const k = Math.max(0, t) / snap.until;
    const blend = k * k * (3 - 2 * k);
    d = target + (d - target) * blend;
  }
  if (d === d0) return p;
  return { x: base.x + n.x * d, y: base.y + n.y * d };
}

/** Move points below the crop line up onto it, along their side of the leg. */
function cropPoints(points: Pt[], cropY: number | null, chainOf: (i: number) => Chain): Pt[] {
  if (cropY == null) return points;
  const n = points.length;
  return points.map((p, i) => {
    if (p.y <= cropY) return p;
    const c = chainOf(i);
    // walk toward the waist along the outline to find the segment crossing the crop line
    const dir = c === 'outR' || c === 'hemR' || c === 'inL' || c === 'hemL' ? -1 : 1;
    let a = p;
    for (let k = 1; k < n; k++) {
      const b = points[(i + dir * k + n * 2) % n];
      if (b.y <= cropY) {
        const t = (cropY - a.y) / (b.y - a.y || 1);
        return { ...p, x: a.x + (b.x - a.x) * t, y: cropY };
      }
      a = b;
    }
    return { ...p, y: cropY };
  });
}

export function fitGarment(g: Garment, rig: PoseRigOut, body: BodyProfile, sag: number): Fitted {
  const points = g.points;
  const t = g.transform;
  const at = (k: string) => points.findIndex((p) => p.key === k);
  const iWL = at('waistL'), iWR = at('waistR'), iHRo = at('hemRo'), iHRi = at('hemRi'), iCr = at('crotch'), iHLi = at('hemLi'), iHLo = at('hemLo');
  if (rig.identity || [iWL, iWR, iHRo, iHRi, iCr, iHLi, iHLo].some((i) => i < 0)) {
    return { g, index: points.map((_, i) => i), layers: null, bandInset: [0, 0] };
  }

  const n = points.length;
  const segChain: Chain[] = new Array(n).fill('none');
  const marks: [number, Chain][] = [[iWL, 'waist'], [iWR, 'outR'], [iHRo, 'hemR'], [iHRi, 'inR'], [iCr, 'inL'], [iHLi, 'hemL'], [iHLo, 'outL']];
  let cur: Chain = 'outL';
  for (let s = 0; s < n; s++) {
    const i = (iWL + s) % n;
    const m = marks.find((x) => x[0] === i);
    if (m) cur = m[1];
    segChain[i] = cur;
  }
  const pointChain = (i: number): Chain => {
    if (i === iCr) return 'none';
    if (i === iWL || i === iHLo) return 'outL';
    if (i === iWR || i === iHRo) return 'outR';
    if (i === iHRi) return 'inR';
    if (i === iHLi) return 'inL';
    return segChain[i];
  };

  const src = cropPoints(points, g.cropY, pointChain);
  const crotchY = points[iCr].y;

  // densify
  const pts: { p: Pt; chain: Chain; srcY: number }[] = [];
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = src[i], b = src[(i + 1) % n];
    index.push(pts.length);
    pts.push({ p: a, chain: pointChain(i), srcY: a.y });
    const c = segChain[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (c === 'waist') {
      for (let j = 1; j < 10; j++) {
        const u = j / 10;
        pts.push({ p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + sag * 4 * u * (1 - u) }, chain: 'none', srcY: a.y });
      }
    } else {
      const k = Math.floor(len / STEP);
      for (let j = 1; j < k; j++) {
        const u = j / k;
        pts.push({ p: { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, chain: c, srcY: a.y + (b.y - a.y) * u });
      }
    }
  }

  // garment units to canvas, warp onto the body, push out of the body, and back to garment units
  const toCanvas = (p: Vec) => ({ x: t.x + p.x * t.scale, y: t.y + p.y * t.scale });
  const toGarment = (q: Vec) => ({ x: (q.x - t.x) / t.scale, y: (q.y - t.y) / t.scale });
  const regionOf = (q: Vec) => rig.regions.find((r) => q.x >= r.rect.x0 && q.x < r.rect.x1 && q.y >= r.rect.y0 && q.y < r.rect.y1);

  // how loose the garment is over the hips: the hips and waist follow the body at that ease
  const hipEase = (key: string, side: 'l' | 'r') => {
    const hp = points.find((p) => p.key === key);
    if (!hp) return EASE.hip;
    const w = poseWarp(rig, toCanvas(hp));
    const h = hipAt(body, w.y);
    if (!h) return EASE.hip;
    const e = side === 'l' ? h.l - w.x : w.x - h.r;
    return Math.max(EASE.hip, Math.min(16, e));
  };
  const easeL = hipEase('hipL', 'l'), easeR = hipEase('hipR', 'r');

  const placed = pts.map(({ p, chain }) => {
    const q = toCanvas(p);
    let w = poseWarp(rig, q);
    if (chain !== 'none' && chain !== 'waist' && chain !== 'hemR' && chain !== 'hemL') {
      const r = regionOf(q);
      if (r && (r.id === 'pL' || r.id === 'pR')) {
        if (chain === 'outL' || chain === 'outR') {
          const h = hipAt(body, w.y);
          if (h) w = chain === 'outL' ? { x: h.l - easeL, y: w.y } : { x: h.r + easeR, y: w.y };
        }
      } else if (r) {
        const s = r.id.endsWith('L') ? 0 : 1;
        const bone = body.legs[s][r.id.startsWith('t') ? 0 : 1];
        const outer = chain === 'outL' || chain === 'outR';
        const snap = outer && r.id.startsWith('t') ? { ease: chain === 'outL' ? easeL : easeR, until: 0.35 } : undefined;
        if (bone) w = pushFromBone(bone, w, chain === 'outL' || chain === 'inR' ? 'left' : 'right', snap);
      }
    }
    return { ...p, ...toGarment(w) };
  });

  // rebuild the waist edge between the fitted waist corners, with the curve
  const wl = placed[index[iWL]], wr = placed[index[iWR]];
  for (let i = index[iWL] + 1, j = 1; i < index[iWR]; i++, j++) {
    const u = j / (index[iWR] - index[iWL]);
    placed[i] = { ...placed[i], x: wl.x + (wr.x - wl.x) * u, y: wl.y + (wr.y - wl.y) * u + sag * 4 * u * (1 - u) };
  }
  // the body narrows above the waist, so the top of the band comes in with it
  const bandInset: [number, number] = [0, 0];
  {
    const cw = (p: Vec) => toCanvas(p);
    const yW = cw(wl).y, yT = yW - 14 * t.scale;
    const hW = hipAt(body, yW), hT = hipAt(body, yT);
    if (hW && hT) {
      bandInset[0] = Math.max(0, Math.min(10, (hT.l - hW.l) / t.scale));
      bandInset[1] = Math.max(0, Math.min(10, (hW.r - hT.r) / t.scale));
    }
  }

  const warpPt = <T extends { x: number; y: number }>(o: T): T => ({ ...o, ...toGarment(poseWarp(rig, toCanvas(o))) });

  const fitted: Garment = {
    ...g,
    points: placed,
    holes: g.holes.map(warpPt),
    distress: g.distress.map(warpPt),
    texts: g.texts.map(warpPt),
    cropY: null,
  };

  // one leg behind the other: split into a back leg layer and a front layer (hips plus near leg)
  let layers: Fitted['layers'] = null;
  const backR = rig.regions.find((r) => r.back);
  if (backR) {
    const iCrD = index[iCr];
    const iWRD = index[iWR];
    const N = placed.length;
    if (backR.id.endsWith('R')) {
      // hip point on the right outer side, level with the crotch
      let iH = -1;
      for (let i = iWRD; i < iCrD; i++) if (pts[i].chain === 'outR' && pts[i].srcY >= crotchY) { iH = i; break; }
      if (iH > 0) {
        const front = [...placed.slice(0, iH + 1), ...placed.slice(iCrD)];
        const back = placed.slice(iWRD, iCrD + 1);
        layers = {
          back: { g: { ...fitted, points: back }, edge: pathOf(placed.slice(iH, iCrD + 1), false) },
          front: { g: { ...fitted, points: front }, edge: pathOf([...placed.slice(iCrD), ...placed.slice(0, iH + 1)], false) },
        };
      }
    } else {
      let iH = -1;
      for (let i = N - 1; i > iCrD; i--) if (pts[i].chain === 'outL' && pts[i].srcY >= crotchY) { iH = i; break; }
      if (iH > 0) {
        const front = [...placed.slice(0, iCrD + 1), ...placed.slice(iH)];
        const back = placed.slice(iCrD);
        layers = {
          back: { g: { ...fitted, points: back }, edge: pathOf(placed.slice(iCrD, iH + 1), false) },
          front: { g: { ...fitted, points: front }, edge: pathOf([...placed.slice(iH), ...placed.slice(0, iCrD + 1)], false) },
        };
      }
    }
  }

  return { g: fitted, index, layers, bandInset };
}
