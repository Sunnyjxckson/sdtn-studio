// Posable 9-head croquis. The body is built from a skeleton: a chest frame, a pelvis frame,
// and bone chains for arms and legs. Contours are width profiles along each bone, smoothed
// with Catmull-Rom curves. The same bones drive the garment pose transforms, so jeans follow
// the legs. Canvas space matches croquis.ts: centre x = 300, head = about 100 units.

import type { Sex, View } from './croquis';

export type PoseId = 'stand' | 'walk' | 'shift' | 'turn';
export const POSES: { id: PoseId; label: string }[] = [
  { id: 'stand', label: 'Stand' },
  { id: 'walk', label: 'Walk' },
  { id: 'shift', label: 'Hip shift' },
  { id: 'turn', label: '3/4 turn' },
];

export interface Vec {
  x: number;
  y: number;
}
const P = (x: number, y: number): Vec => ({ x, y });
const RAD = Math.PI / 180;
/** Direction for an angle in degrees from straight down, positive toward screen right. */
const dirOf = (a: number) => P(Math.sin(a * RAD), Math.cos(a * RAD));
/** Screen-right normal of a downward pointing bone direction. */
const normalOf = (d: Vec) => P(d.y, -d.x);
const addv = (a: Vec, b: Vec) => P(a.x + b.x, a.y + b.y);
const scl = (a: Vec, k: number) => P(a.x * k, a.y * k);
const lerpv = (a: Vec, b: Vec, t: number) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const rot = (v: Vec, aDeg: number) => {
  const c = Math.cos(aDeg * RAD), s = Math.sin(aDeg * RAD);
  return P(c * v.x - s * v.y, s * v.x + c * v.y);
};

// ---------- affine matrices (SVG order a b c d e f) ----------
export type Mat = [number, number, number, number, number, number];
export const IDENT: Mat = [1, 0, 0, 1, 0, 0];
export const matMul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
export const matInv = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2] || 1;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};
export const matApply = (m: Mat, p: Vec): Vec => P(m[0] * p.x + m[2] * p.y + m[4], m[1] * p.x + m[3] * p.y + m[5]);
const mT = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const mR = (aDeg: number): Mat => {
  const c = Math.cos(aDeg * RAD), s = Math.sin(aDeg * RAD);
  return [c, s, -s, c, 0, 0];
};
const mS = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0];
export const matStr = (m: Mat) => `matrix(${m.map((v) => +v.toFixed(5)).join(' ')})`;

// ---------- smooth paths ----------
const f1 = (n: number) => n.toFixed(1);
/** Catmull-Rom through the points, as cubic Beziers. */
export function smooth(pts: Vec[], closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M${f1(pts[0].x)},${f1(pts[0].y)} L${f1(pts[1].x)},${f1(pts[1].y)}`;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f1(pts[0].x)},${f1(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = P(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6);
    const c2 = P(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
    d += ` C${f1(c1.x)},${f1(c1.y)} ${f1(c2.x)},${f1(c2.y)} ${f1(p2.x)},${f1(p2.y)}`;
  }
  return closed ? d + ' Z' : d;
}

// ---------- body builds ----------
type Prof = [t: number, outer: number, inner: number][];

interface Build {
  /** Head outline, left half, head-local (origin at the chin, centre line x = 0). */
  head: Vec[];
  chinY: number;
  neckHalf: number;
  neckBaseY: number;
  hipJY: number;
  crotchY: number;
  /** Left neck and shoulder slope, absolute stand coords with x relative to centre, ending at the shoulder tip. */
  shoulder: Vec[];
  /** Left torso side from armpit to hip, same coords. */
  side: Vec[];
  shoulderJ: Vec;
  arm: [number, number, number];
  hipJx: number;
  leg: [number, number, number];
  upperArm: Prof;
  foreArm: Prof;
  hand: Prof;
  thumb: number;
  thigh: Prof;
  shin: Prof;
  foot: Prof;
  bust: Vec[];
  princess: Vec[];
  waistY: number;
  brief: Vec[];
  blades: Vec[];
  glute: Vec[];
  collar: Vec[];
}

const FEMALE: Build = {
  head: [P(0, -98), P(-17, -96), P(-27, -84), P(-30, -64), P(-29, -44), P(-25, -24), P(-17, -9), P(-8, -2), P(0, 0)],
  chinY: 142,
  neckHalf: 12,
  neckBaseY: 178,
  hipJY: 446,
  crotchY: 458,
  shoulder: [P(-14, 178), P(-26, 186), P(-46, 191), P(-64, 195), P(-76, 201), P(-81, 212)],
  side: [P(-66, 250), P(-63, 274), P(-58, 300), P(-51, 324), P(-47, 342), P(-50, 364), P(-59, 392), P(-68, 418), P(-71, 438)],
  shoulderJ: P(-69, 214),
  arm: [132, 116, 66],
  hipJx: -37,
  leg: [214, 222, 76],
  upperArm: [[0.1, 11.5, 0], [0.32, 10.5, 8], [0.55, 9.5, 8], [0.8, 8, 7], [1, 7, 6]],
  foreArm: [[0.18, 8.5, 7.5], [0.45, 7.2, 6.2], [0.75, 5.6, 4.8], [1, 4.6, 4]],
  hand: [[0.2, 6, 6.5], [0.5, 6.4, 6], [0.78, 4.6, 4], [0.94, 2.2, 1.8]],
  thumb: 8.5,
  thigh: [[0.03, 0, 36.5], [0.14, 33, 30], [0.36, 29, 22.5], [0.6, 23.5, 17.5], [0.85, 17.5, 14], [1, 15.5, 13]],
  shin: [[0.12, 16, 13.5], [0.3, 18, 15], [0.52, 14.5, 12], [0.78, 9.6, 8.2], [1, 7.2, 6.4]],
  foot: [[0.3, 8.6, 7.6], [0.62, 6, 5.5], [0.86, 3, 2.8]],
  bust: [P(-60, 258), P(-50, 281), P(-32, 293), P(-14, 287), P(-4, 274)],
  princess: [P(-40, 192), P(-31, 236), P(-29, 282), P(-25, 322), P(-23, 350), P(-25, 392)],
  waistY: 342,
  brief: [P(-62, 396), P(-46, 414), P(-26, 436), P(-9, 453), P(0, 458)],
  blades: [P(-50, 232), P(-44, 260), P(-30, 272), P(-16, 262)],
  glute: [P(-64, 436), P(-46, 456), P(-24, 460), P(-6, 448)],
  collar: [P(-6, 194), P(-20, 191), P(-38, 196)],
};

const MALE: Build = {
  head: [P(0, -102), P(-20, -100), P(-30, -88), P(-33, -66), P(-32, -44), P(-30, -24), P(-24, -10), P(-12, -2), P(0, 0)],
  chinY: 142,
  neckHalf: 18,
  neckBaseY: 180,
  hipJY: 446,
  crotchY: 456,
  shoulder: [P(-19, 176), P(-30, 186), P(-54, 193), P(-78, 198), P(-94, 205), P(-102, 218)],
  side: [P(-86, 254), P(-86, 278), P(-82, 306), P(-74, 330), P(-67, 350), P(-66, 376), P(-68, 402), P(-70, 426), P(-70, 444)],
  shoulderJ: P(-88, 216),
  arm: [140, 122, 74],
  hipJx: -40,
  leg: [210, 218, 68],
  upperArm: [[0.1, 14.5, 0], [0.32, 13.5, 11], [0.55, 12.5, 10.5], [0.8, 10, 9], [1, 9, 8]],
  foreArm: [[0.18, 11.5, 10], [0.45, 9.5, 8.2], [0.75, 7.4, 6.4], [1, 6.2, 5.4]],
  hand: [[0.2, 7.8, 8.2], [0.5, 8.2, 7.6], [0.78, 6, 5.2], [0.94, 3, 2.6]],
  thumb: 10.5,
  thigh: [[0.03, 0, 39.5], [0.14, 31, 31], [0.36, 29, 24], [0.6, 25, 20], [0.85, 20.5, 17], [1, 19, 16.5]],
  shin: [[0.12, 18.5, 16], [0.3, 20.5, 17.5], [0.52, 17, 14.5], [0.78, 12, 10.2], [1, 9.4, 8.4]],
  foot: [[0.3, 11.5, 10.5], [0.66, 10, 9.5], [0.92, 6, 6]],
  bust: [P(-74, 268), P(-56, 284), P(-32, 290), P(-12, 286), P(-4, 278)],
  princess: [P(-48, 194), P(-44, 240), P(-40, 290), P(-34, 330), P(-31, 360), P(-30, 400)],
  waistY: 350,
  brief: [P(-68, 414), P(-48, 428), P(-26, 442), P(-9, 452), P(0, 456)],
  blades: [P(-64, 236), P(-58, 266), P(-40, 280), P(-22, 268)],
  glute: [P(-68, 434), P(-48, 454), P(-24, 458), P(-6, 446)],
  collar: [P(-8, 194), P(-26, 190), P(-48, 196)],
};

export const getBuild = (sex: Sex) => (sex === 'male' ? MALE : FEMALE);

// ---------- poses ----------
interface Limb {
  /** Bone angles in degrees from straight down, positive toward screen right. */
  a: [number, number, number];
  /** Foreshortening of the last segment (feet stepping toward the viewer). */
  k?: number;
}
interface PoseDef {
  pelvis: { dx: number; tilt: number };
  chest: { dx: number; tilt: number };
  head: { dx: number; tilt: number };
  turn: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  /** Draw order, back to front. */
  order: Part[];
}
type Part = 'armL' | 'armR' | 'legL' | 'legR' | 'torso' | 'head';

const STD_ORDER: Part[] = ['legL', 'legR', 'armL', 'armR', 'torso', 'head'];

function poseDef(id: PoseId, sex: Sex): PoseDef {
  const m = sex === 'male';
  const stand: PoseDef = {
    pelvis: { dx: 0, tilt: 0 },
    chest: { dx: 0, tilt: 0 },
    head: { dx: 0, tilt: 0 },
    turn: 0,
    legs: [{ a: m ? [2.6, 1.2, 0.5] : [3.4, 1.6, 1.5] }, { a: m ? [-2.6, -1.2, -0.5] : [-3.4, -1.6, -1.5] }],
    arms: [{ a: m ? [-9, -4, -2] : [-7, -3, -1] }, { a: m ? [9, 4, 2] : [7, 3, 1] }],
    order: STD_ORDER,
  };
  if (id === 'walk') {
    return {
      pelvis: { dx: 6, tilt: -5 },
      chest: { dx: 2, tilt: 3 },
      head: { dx: 1, tilt: -2 },
      turn: 0,
      legs: [{ a: [5.5, 3, 1], k: 0.8 }, { a: [-4.5, -2, -2] }],
      arms: [{ a: [-11, -5, -3] }, { a: [9, 13, 10] }],
      order: ['legR', 'legL', 'armL', 'armR', 'torso', 'head'],
    };
  }
  if (id === 'shift') {
    return {
      pelvis: { dx: 14, tilt: -7 },
      chest: { dx: 2, tilt: 4 },
      head: { dx: 0, tilt: 3 },
      turn: 0,
      legs: [{ a: [4, -8, -16] }, { a: [-5.5, -1, -1] }],
      arms: [{ a: [-12, -7, -4] }, { a: [6, 3, 2] }],
      order: STD_ORDER,
    };
  }
  if (id === 'turn') {
    return {
      pelvis: { dx: 4, tilt: -3 },
      chest: { dx: -2, tilt: 2 },
      head: { dx: 3, tilt: 0 },
      turn: 0.75,
      legs: [{ a: [5, 1.5, 3] }, { a: [-1.5, -4, -8], k: 0.88 }],
      arms: [{ a: [-3, 3, 2] }, { a: [7, 3, 1] }],
      order: ['armL', 'legL', 'legR', 'torso', 'armR', 'head'],
    };
  }
  return stand;
}

// ---------- rig ----------
interface Frame {
  o: Vec;
  a: number;
}
interface Rig {
  b: Build;
  pose: PoseDef;
  C: Frame;
  Pv: Frame;
  H: Frame;
  /** Posed joint chains: [root, mid, end, tip]. */
  arm: [Vec[], Vec[]];
  leg: [Vec[], Vec[]];
}

const CX = 300;

function turnX(x: number, t: number) {
  return x < 0 ? x * (1 - 0.5 * t) : x * (1 + 0.04 * t);
}

/** Map a torso point (stand coords, x relative to centre) into the posed canvas. */
function torsoPt(r: Rig, p: Vec): Vec {
  const x = turnX(p.x, r.pose.turn);
  const c = addv(r.C.o, rot(P(x, p.y - r.b.neckBaseY), r.C.a));
  const v = addv(r.Pv.o, rot(P(x, p.y - r.b.hipJY), r.Pv.a));
  const t = Math.max(0, Math.min(1, (p.y - 268) / (404 - 268)));
  const w = t * t * (3 - 2 * t);
  return lerpv(c, v, w);
}
function pelvisPt(r: Rig, p: Vec): Vec {
  return addv(r.Pv.o, rot(P(turnX(p.x, r.pose.turn), p.y - r.b.hipJY), r.Pv.a));
}
function headPt(r: Rig, p: Vec): Vec {
  const t = r.pose.turn;
  return addv(r.H.o, rot(P(turnX(p.x, t), p.y), r.H.a));
}

function chain(root: Vec, lens: number[], angles: number[], k = 1): Vec[] {
  const out = [root];
  let at = root;
  lens.forEach((L, i) => {
    at = addv(at, scl(dirOf(angles[i]), L * (i === lens.length - 1 ? k : 1)));
    out.push(at);
  });
  return out;
}

function buildRig(sex: Sex, pose: PoseId): Rig {
  const b = getBuild(sex);
  const pd = poseDef(pose, sex);
  const C: Frame = { o: P(CX + pd.chest.dx, b.neckBaseY), a: pd.chest.tilt };
  const Pv: Frame = { o: P(CX + pd.pelvis.dx, b.hipJY), a: pd.pelvis.tilt };
  const r: Rig = { b, pose: pd, C, Pv, H: { o: P(0, 0), a: 0 }, arm: [[], []], leg: [[], []] };
  const neckTop = addv(C.o, rot(P(pd.head.dx, b.chinY - 8 - b.neckBaseY), C.a));
  r.H = { o: addv(neckTop, rot(P(0, 8), C.a + pd.head.tilt)), a: C.a + pd.head.tilt };
  [0, 1].forEach((s) => {
    const sign = s === 0 ? 1 : -1;
    const sj = torsoPt(r, P(b.shoulderJ.x * sign, b.shoulderJ.y));
    r.arm[s] = chain(sj, b.arm, pd.arms[s].a);
    const hj = pelvisPt(r, P(b.hipJx * sign, b.hipJY));
    r.leg[s] = chain(hj, b.leg, pd.legs[s].a, pd.legs[s].k ?? 1);
  });
  return r;
}

/** Points along a bone at width offsets. side = +1 means screen right of the bone. */
function along(a: Vec, b: Vec, t: number, off: number): Vec {
  const d = P(b.x - a.x, b.y - a.y);
  const L = Math.hypot(d.x, d.y) || 1;
  const u = P(d.x / L, d.y / L);
  return addv(lerpv(a, b, t), scl(normalOf(u), off));
}

// ---------- output ----------
export interface FigPart {
  id: Part;
  fill: string;
  lines: string[];
}
export interface Figure {
  parts: FigPart[];
  /** Thin construction lines (line mode only). */
  guides: string[];
  /** Face marks, front view line mode only. */
  face: string[];
  /** Hair shapes, filled dark in rendered mode. */
  hair: string;
  hairLines: string[];
  /** Soft light down the torso for the rendered look. */
  light: string;
  label: string;
}

function limbContours(chainPts: Vec[], profs: Prof[], outerSign: number, startOuter: Vec[], startInner: Vec[], tipRound: boolean) {
  const outer: Vec[] = [...startOuter];
  const inner: Vec[] = [...startInner];
  profs.forEach((prof, i) => {
    const a = chainPts[i], b = chainPts[i + 1];
    prof.forEach(([t, o, n]) => {
      if (o > 0) outer.push(along(a, b, t, o * outerSign));
      if (n > 0) inner.push(along(a, b, t, -n * outerSign));
    });
  });
  const tip = chainPts[chainPts.length - 1];
  if (tipRound) {
    const a = chainPts[chainPts.length - 2];
    outer.push(along(a, tip, 0.985, 0.8 * outerSign));
    inner.push(along(a, tip, 0.985, -0.8 * outerSign));
  }
  return { outer, inner, tip };
}

export function getFigure(sex: Sex, view: View, pose: PoseId): Figure {
  const r = buildRig(sex, pose);
  const b = r.b;
  const back = view === 'back';
  const parts: Record<Part, FigPart> = {} as Record<Part, FigPart>;

  // torso halves
  const sideL = (sign: number) => {
    const sh = b.shoulder.map((p) => torsoPt(r, P(p.x * sign, p.y)));
    const sd = b.side.map((p) => torsoPt(r, P(p.x * sign, p.y)));
    return { sh, sd };
  };
  const L = sideL(1), R = sideL(-1);
  const neckTopL = headPt(r, P(-b.neckHalf * 0.95, -14));
  const neckTopR = headPt(r, P(b.neckHalf * 0.95, -14));

  // legs
  const legs = [0, 1].map((s) => {
    const outerSign = s === 0 ? -1 : 1;
    const c = r.leg[s];
    const res = limbContours(c, [b.thigh, b.shin, b.foot], outerSign, [], [], sex === 'female');
    return res;
  });
  const crotch = pelvisPt(r, P(0, b.crotchY));
  const crotchL = pelvisPt(r, P(-1.5, b.crotchY - 1));
  const crotchR = pelvisPt(r, P(1.5, b.crotchY - 1));

  // arms
  const arms = [0, 1].map((s) => {
    const outerSign = s === 0 ? -1 : 1;
    const sign = s === 0 ? 1 : -1;
    const c = r.arm[s];
    const tipSh = (s === 0 ? L : R).sh;
    const armpit = torsoPt(r, P((b.side[0].x + 4) * sign, b.side[0].y - 8));
    const res = limbContours(c, [b.upperArm, b.foreArm, b.hand], outerSign, [tipSh[tipSh.length - 1]], [armpit], true);
    // thumb bump on the inner side of the hand
    const ha = c[2], hb = c[3];
    const thumb = along(ha, hb, 0.34, -b.thumb * outerSign);
    const idx = res.inner.length - 4;
    res.inner.splice(Math.max(1, idx), 0, thumb);
    return res;
  });

  // torso contour pieces
  const legTopOuter = legs.map((l) => l.outer[0]);
  const torsoSideL = [...L.sd, legTopOuter[0]];
  const torsoSideR = [...R.sd, legTopOuter[1]];
  const torsoFill = joinClosed([
    [neckTopL, ...L.sh],
    torsoSideL,
    [crotch],
    [...torsoSideR].reverse(),
    [...R.sh].reverse().concat([neckTopR]),
  ]);
  parts.torso = {
    id: 'torso',
    fill: torsoFill,
    lines: [smooth([neckTopL, ...L.sh.slice(0, 1)]), smooth([neckTopR, ...R.sh.slice(0, 1)]), smooth(L.sh), smooth(R.sh), smooth(torsoSideL), smooth(torsoSideR)],
  };

  ([0, 1] as const).forEach((s) => {
    const l = legs[s];
    const top = s === 0 ? crotchL : crotchR;
    const outerLine = l.outer;
    const innerLine = [top, ...l.inner];
    const hipPt = (s === 0 ? L : R).sd[(s === 0 ? L : R).sd.length - 2];
    parts[s === 0 ? 'legL' : 'legR'] = {
      id: s === 0 ? 'legL' : 'legR',
      fill: joinClosed([[...outerLine, l.tip], [...innerLine, l.tip].reverse(), [hipPt]]),
      lines: [smooth([...outerLine, l.tip]), smooth([...innerLine, l.tip])],
    };
    const a = arms[s];
    parts[s === 0 ? 'armL' : 'armR'] = {
      id: s === 0 ? 'armL' : 'armR',
      fill: joinClosed([[...a.outer, a.tip], [...a.inner, a.tip].reverse()]),
      lines: [smooth([...a.outer, a.tip]), smooth([...a.inner, a.tip])],
    };
  });

  // head
  const headL = b.head.map((p) => headPt(r, p));
  const headR = b.head.map((p) => headPt(r, P(-p.x, p.y)));
  const headLoop = [...headL, ...[...headR].reverse().slice(1, -1)];
  parts.head = { id: 'head', fill: smooth(headLoop, true), lines: [smooth(headLoop, true)] };

  // ears
  const ear = (sign: number) => {
    const e = [P(-29, -54), P(-34, -50), P(-34, -40), P(-30, -33)].map((p) => P(p.x * (sex === 'male' ? 1.08 : 1) * sign, p.y));
    return e.map((p) => headPt(r, p));
  };
  const t = r.pose.turn;
  const ears = t < 0.3 ? [ear(1), ear(-1)] : [ear(-1)];
  ears.forEach((e) => {
    parts.head.lines.push(smooth(e));
    parts.head.fill += ' ' + smooth([...e, lerpv(e[0], e[e.length - 1], 0.5)], true);
  });

  // hair
  let hair = '';
  const hairLines: string[] = [];
  if (sex === 'female') {
    const bunC = headPt(r, P(back ? 0 : 2, -104));
    const br = 14;
    hair = `M${f1(bunC.x - br)},${f1(bunC.y)} a${br},${br} 0 1,0 ${br * 2},0 a${br},${br} 0 1,0 ${-br * 2},0 Z`;
    const cap = [P(-27, -74), P(-24, -88), P(-12, -97), P(0, -99), P(12, -97), P(24, -88), P(27, -74), P(18, -82), P(0, -86), P(-18, -82)];
    hair += ' ' + smooth(cap.map((p) => headPt(r, p)), true);
    hairLines.push(smooth([P(-27, -72), P(-16, -86), P(-2, -94)].map((p) => headPt(r, p))));
    hairLines.push(smooth([P(27, -72), P(16, -86), P(2, -94)].map((p) => headPt(r, p))));
  } else {
    const cap = [P(-32, -62), P(-34, -84), P(-24, -102), P(0, -108), P(24, -102), P(34, -84), P(32, -62), P(28, -74), P(14, -80), P(0, -82), P(-14, -80), P(-28, -74)];
    hair = smooth(cap.map((p) => headPt(r, p)), true);
  }

  // face (front only)
  const face: string[] = [];
  if (!back) {
    const fx = (p: Vec) => headPt(r, P(p.x * (p.x < 0 ? 1 - 0.25 * t : 1) + t * 16, p.y));
    const line = (pts: Vec[]) => smooth(pts.map(fx));
    const eyeY = sex === 'male' ? -52 : -50;
    [1, -1].forEach((s) => {
      if (s === 1 && t > 0.45) return;
      const e = (x: number, y: number) => P(x * s, y);
      face.push(line([e(-20, eyeY), e(-13, eyeY - 4.5), e(-5, eyeY)]));
      face.push(line([e(-20, eyeY), e(-13, eyeY + 2.5), e(-5, eyeY)]));
      face.push(line(sex === 'male' ? [e(-22, eyeY - 10), e(-14, eyeY - 12), e(-5, eyeY - 10)] : [e(-21, eyeY - 9), e(-14, eyeY - 13), e(-6, eyeY - 10)]));
    });
    face.push(line([P(-2, -42), P(-3, -31), P(-6, -26)]));
    face.push(line([P(-4, -24), P(0, -22.5), P(4, -24)]));
    if (sex === 'female') {
      face.push(line([P(-9, -16), P(-4, -18.5), P(0, -17), P(4, -18.5), P(9, -16)]));
      face.push(line([P(-8, -15.5), P(0, -10), P(8, -15.5)]));
    } else {
      face.push(line([P(-10, -15), P(0, -14), P(10, -15)]));
      face.push(line([P(-5, -10), P(0, -9), P(5, -10)]));
    }
  }

  // construction guides
  const guides: string[] = [];
  const tp = (p: Vec, sign = 1) => torsoPt(r, P(p.x * sign, p.y));
  if (!back) {
    guides.push(smooth([P(0, b.neckBaseY + 12), P(0, 260), P(0, 320), P(0, b.waistY + 6), P(0, 410), P(0, b.crotchY)].map((p) => tp(p))));
    [1, -1].forEach((s) => {
      guides.push(smooth(b.princess.map((p) => tp(p, s))));
      guides.push(smooth(b.bust.map((p) => tp(p, s))));
      guides.push(smooth(b.brief.map((p) => (p.y > 430 ? pelvisPt(r, P(p.x * s, p.y)) : tp(p, s)))));
      guides.push(smooth(b.collar.map((p) => tp(p, s))));
    });
  } else {
    guides.push(smooth([P(0, b.neckBaseY - 6), P(0, 260), P(0, 330), P(0, 400), P(0, 436)].map((p) => tp(p))));
    [1, -1].forEach((s) => {
      guides.push(smooth(b.blades.map((p) => tp(p, s))));
      guides.push(smooth(b.glute.map((p) => pelvisPt(r, P(p.x * s, p.y)))));
    });
  }
  guides.push(smooth([P(-b.side[4].x * -1, b.waistY), P(-20, b.waistY + 5), P(0, b.waistY + 6), P(20, b.waistY + 5), P(-b.side[4].x, b.waistY)].map((p) => tp(p))));
  // leg centre lines and knees
  [0, 1].forEach((s) => {
    const l = legs[s];
    const n = Math.min(l.outer.length, l.inner.length);
    const mids: Vec[] = [];
    for (let i = 1; i < n - 1; i++) mids.push(lerpv(l.outer[i], l.inner[i], 0.5));
    guides.push(smooth(mids));
    const c = r.leg[s];
    if (!back) {
      const k1 = along(c[1], c[2], 0.02, -9), k2 = along(c[1], c[2], 0.06, 0), k3 = along(c[1], c[2], 0.02, 9);
      guides.push(smooth([k1, k2, k3]));
    }
  });
  // navel
  if (!back) {
    const nv = tp(P(0, b.waistY + 10));
    guides.push(`M${f1(nv.x - 2.5)},${f1(nv.y)} Q${f1(nv.x)},${f1(nv.y + 3)} ${f1(nv.x + 2.5)},${f1(nv.y)}`);
  }

  // soft light shape down the torso
  const light = smooth([tp(P(-24, 250)), tp(P(0, 236)), tp(P(24, 250)), tp(P(20, 330)), tp(P(18, 420)), tp(P(0, 440)), tp(P(-18, 420)), tp(P(-20, 330))], true);

  return {
    parts: r.pose.order.map((id) => parts[id]),
    guides,
    face,
    hair,
    hairLines,
    light,
    label: `${sex === 'male' ? 'Male' : 'Female'} ${view}`,
  };
}

/** Join open smooth pieces into one closed outline. */
function joinClosed(pieces: Vec[][]): string {
  return pieces.map((pc, i) => (i === 0 ? smooth(pc) : smooth(pc).replace(/^M/, ' L'))).join('') + ' Z';
}


// ---------- garment pose transforms ----------
export interface Region {
  id: string;
  /** Membership rectangle in stand canvas space. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  /** Clip rectangle, a little larger so pieces overlap at the joints. */
  clip: { x0: number; y0: number; x1: number; y1: number };
  m: Mat;
}
export interface PoseRigOut {
  identity: boolean;
  regions: Region[];
}

const BIG = 4000;

// Reference landmarks: where a default jeans block (Straight, Mid rise) lands with placeOnCroquis,
// in the uniform "garment canvas" space. The body fit maps these onto the croquis bones.
const REF = { top: 62, crotch: 184, knee: 330, hem: 486, legTop: 39, legKnee: 40, legHem: 46 };
/** Garment width on the body per unit of garment canvas width, for hips, thighs and shins. */
const ACROSS = { pelvis: 0.79, thigh: 0.81, shin: 0.86 };

/** Affine that carries bone a0->b0 onto bone a1->b1, scaling along the bone and across it. */
function boneFit(a0: Vec, b0: Vec, a1: Vec, b1: Vec, across: number): Mat {
  const ang0 = Math.atan2(b0.x - a0.x, b0.y - a0.y) / RAD;
  const ang1 = Math.atan2(b1.x - a1.x, b1.y - a1.y) / RAD;
  const along = Math.hypot(b1.x - a1.x, b1.y - a1.y) / (Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1);
  // mR(-a) turns straight down into direction a (see dirOf)
  return matMul(mT(a1.x, a1.y), matMul(mR(-ang1), matMul(mS(across, along), matMul(mR(ang0), mT(-a0.x, -a0.y)))));
}

const rigCache = new Map<string, PoseRigOut>();

/**
 * Piecewise transforms that carry garments from garment canvas space onto the posed croquis:
 * the hips ride the pelvis, each thigh and shin rides its bone. Rises and legs are stretched to
 * the 9-head proportions, and widths are scaled by ACROSS.
 */
/** What the garment fit needs from a croquis: the pelvis frame and the leg chains. */
interface Skel {
  Pv: Frame;
  turn: number;
  crotchY: number;
  hipJY: number;
  /** [hip joint, knee, ankle] per leg, screen left first. */
  legs: [Vec[], Vec[]];
  /** Back leg first. */
  legOrder: number[];
  /** Ankle height in the stand pose, so the hem sits the same distance past the ankle. */
  standAnkleY: [number, number];
}

/** Landmarks read off the licensed female walking croquis (front and back share them). */
const STOCK_WALK: Skel = {
  Pv: { o: P(300, 446), a: 0 },
  turn: 0,
  crotchY: 458,
  hipJY: 446,
  legs: [
    [P(264, 446), P(281, 658), P(312, 884)],
    [P(336, 446), P(335, 640), P(324, 790)],
  ],
  legOrder: [1, 0],
  standAnkleY: [884, 884],
};

/** True when this sex and pose use the licensed stock artwork instead of the built figure. */
export const usesStock = (sex: Sex, pose: PoseId) => sex === 'female' && pose === 'walk';

function skeletonOf(sex: Sex, pose: PoseId): Skel {
  if (usesStock(sex, pose)) return STOCK_WALK;
  const r = buildRig(sex, pose);
  const stand = buildRig(sex, 'stand');
  return {
    Pv: r.Pv,
    turn: r.pose.turn,
    crotchY: r.b.crotchY,
    hipJY: r.b.hipJY,
    legs: [r.leg[0].slice(0, 3), r.leg[1].slice(0, 3)],
    legOrder: r.pose.order.filter((p) => p === 'legL' || p === 'legR').map((p) => (p === 'legL' ? 0 : 1)),
    standAnkleY: [stand.leg[0][2].y, stand.leg[1][2].y],
  };
}

export function poseRig(sex: Sex, pose: PoseId, waistY: number, hemY: number): PoseRigOut {
  const key = `${sex}:${pose}:${waistY}:${hemY}`;
  const hit = rigCache.get(key);
  if (hit) return hit;
  const k = skeletonOf(sex, pose);
  const sc = (hemY - waistY) / (REF.hem - REF.top);
  const gy = (y: number) => waistY + (y - REF.top) * sc;
  const ref = { crotch: gy(REF.crotch), knee: gy(REF.knee), hem: hemY };
  const t = k.turn;
  const pelvis = (side: number): Mat => {
    const sx = side < 0 ? 1 - 0.5 * t : 1 + 0.04 * t;
    const ay = (k.crotchY - waistY) / (ref.crotch - waistY);
    const toStand = matMul(mT(CX, waistY), matMul(mS(ACROSS.pelvis, ay), mT(-CX, -waistY)));
    const toPose = matMul(mT(k.Pv.o.x, k.Pv.o.y), matMul(mR(k.Pv.a), matMul(mS(sx, 1), mT(-CX, -k.hipJY))));
    return matMul(toPose, toStand);
  };
  const regions: Region[] = [];
  const pad = 6;
  regions.push({ id: 'pL', rect: { x0: -BIG, y0: -BIG, x1: CX, y1: ref.crotch }, clip: { x0: -BIG, y0: -BIG, x1: CX + 0.5, y1: ref.crotch + pad }, m: pelvis(-1) });
  regions.push({ id: 'pR', rect: { x0: CX, y0: -BIG, x1: BIG, y1: ref.crotch }, clip: { x0: CX - 0.5, y0: -BIG, x1: BIG, y1: ref.crotch + pad }, m: pelvis(1) });
  k.legOrder.forEach((s) => {
    const sign = s === 0 ? -1 : 1;
    const c = k.legs[s];
    const thighLen = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) || 1;
    // body thigh point level with the crotch, and the hem point past the ankle
    const top1 = lerpv(c[0], c[1], (k.crotchY - k.hipJY) / thighLen);
    const shinDir = P(c[2].x - c[1].x, c[2].y - c[1].y);
    const shinLen = Math.hypot(shinDir.x, shinDir.y) || 1;
    const extra = hemY - k.standAnkleY[s];
    const hem1 = addv(c[2], scl(shinDir, extra / shinLen));
    const top0 = P(CX + sign * REF.legTop * sc, ref.crotch);
    const knee0 = P(CX + sign * REF.legKnee * sc, ref.knee);
    const hem0 = P(CX + sign * REF.legHem * sc, ref.hem);
    const xs = s === 0 ? { x0: -BIG, x1: CX } : { x0: CX, x1: BIG };
    regions.push({
      id: s === 0 ? 'tL' : 'tR',
      rect: { ...xs, y0: ref.crotch, y1: ref.knee },
      clip: { x0: xs.x0 - (s === 1 ? 0.5 : 0), x1: xs.x1 + (s === 0 ? 0.5 : 0), y0: ref.crotch - 2, y1: ref.knee + pad },
      m: boneFit(top0, knee0, top1, c[1], ACROSS.thigh),
    });
    regions.push({
      id: s === 0 ? 'sL' : 'sR',
      rect: { ...xs, y0: ref.knee, y1: BIG },
      clip: { x0: xs.x0 - (s === 1 ? 0.5 : 0), x1: xs.x1 + (s === 0 ? 0.5 : 0), y0: ref.knee - 2, y1: BIG },
      m: boneFit(knee0, hem0, c[1], hem1, ACROSS.shin),
    });
  });
  const out = { identity: false, regions };
  rigCache.set(key, out);
  return out;
}

export const IDENTITY_RIG: PoseRigOut = { identity: true, regions: [] };

const inRect = (r: Region['rect'], p: Vec) => p.x >= r.x0 && p.x < r.x1 && p.y >= r.y0 && p.y < r.y1;

/** Stand canvas point to posed canvas point. */
export function poseForward(rig: PoseRigOut, p: Vec): Vec {
  if (rig.identity) return p;
  const r = rig.regions.find((g) => inRect(g.rect, p)) ?? rig.regions[0];
  return matApply(r.m, p);
}

/** Posed canvas point back to stand canvas space. Front-most piece wins. */
export function poseInverse(rig: PoseRigOut, p: Vec): Vec {
  if (rig.identity) return p;
  for (let i = rig.regions.length - 1; i >= 0; i--) {
    const r = rig.regions[i];
    const q = matApply(matInv(r.m), p);
    if (inRect(r.rect, q)) return q;
  }
  return matApply(matInv(rig.regions[0].m), p);
}
