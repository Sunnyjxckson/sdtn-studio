// Raster brush engine. Strokes are stamped onto layer canvases at a fixed resolution so a replay
// of the same strokes always gives the same pixels (undo and reload rebuild layers this way).
import { ARTBOARD } from '../model/croquis';
import { brushById, type FillStroke, type Grain, type PaintStroke, type SmudgeStroke, type Stroke, type StrokeOp } from '../model/draw';

/** Layer pixels per canvas unit. */
export const RES = 2;
export const LW = ARTBOARD.w * RES;
export const LH = ARTBOARD.h * RES;

export const toPx = (x: number, y: number) => ({ x: (x - ARTBOARD.x) * RES, y: (y - ARTBOARD.y) * RES });

export function makeCanvas(w = LW, h = LH) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: false })!;

// shared scratch canvases
let scratchA: HTMLCanvasElement | null = null; // stamps of the current stroke
let scratchB: HTMLCanvasElement | null = null; // grain applied
const scratch = () => {
  if (!scratchA) scratchA = makeCanvas();
  if (!scratchB) scratchB = makeCanvas();
  return { a: scratchA, b: scratchB };
};

function mulberry(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// grain textures: alpha only, fixed in layer space like paper under the pencil
const grains = new Map<Grain, CanvasPattern>();
function grainPattern(ctx: CanvasRenderingContext2D, g: Grain): CanvasPattern | null {
  if (g === 'none') return null;
  const hit = grains.get(g);
  if (hit) return hit;
  const N = 256;
  const c = makeCanvas(N, N);
  const x = ctx2d(c);
  const r = mulberry(g === 'fine' ? 11 : g === 'coarse' ? 23 : 37);
  if (g === 'fine') {
    const img = x.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = r();
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = v < 0.22 ? 40 : 120 + v * 135;
    }
    x.putImageData(img, 0, 0);
  } else {
    // blotchy texture: random soft dots on a mid alpha base
    x.fillStyle = g === 'coarse' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)';
    x.fillRect(0, 0, N, N);
    const n = g === 'coarse' ? 900 : 1400;
    for (let i = 0; i < n; i++) {
      const px = r() * N, py = r() * N;
      const rad = g === 'coarse' ? 1 + r() * 3.5 : 0.6 + r() * 1.8;
      const on = r() < 0.6;
      x.fillStyle = on ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,1)';
      x.globalCompositeOperation = on ? 'source-over' : 'destination-out';
      x.globalAlpha = on ? 0.9 : 0.55;
      for (const [ox, oy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
        x.beginPath();
        x.ellipse(px + ox, py + oy, rad * (g === 'paper' ? 1.8 : 1), rad, g === 'paper' ? 0.3 : 0, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  const p = ctx.createPattern(c, 'repeat')!;
  grains.set(g, p);
  return p;
}

const sprites = new Map<string, HTMLCanvasElement>();
function softSprite(color: string) {
  const hit = sprites.get(color);
  if (hit) return hit;
  const S = 64;
  const c = makeCanvas(S, S);
  const x = ctx2d(c);
  const { r, g, b } = hexRgb(color);
  const grad = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.3, `rgba(${r},${g},${b},0.72)`);
  grad.addColorStop(0.62, `rgba(${r},${g},${b},0.28)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);
  if (sprites.size > 64) sprites.clear();
  sprites.set(color, c);
  return c;
}

export function hexRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const gco = (op: StrokeOp): GlobalCompositeOperation => (op === 'out' ? 'destination-out' : op === 'atop' ? 'source-atop' : 'source-over');

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const emptyBox = (): Box => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
const boxOk = (b: Box) => b.x1 > b.x0 && b.y1 > b.y0;
function clampBox(b: Box): Box {
  return { x0: Math.max(0, Math.floor(b.x0)), y0: Math.max(0, Math.floor(b.y0)), x1: Math.min(LW, Math.ceil(b.x1)), y1: Math.min(LH, Math.ceil(b.y1)) };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Walks a stroke's points with Catmull-Rom curves and calls stamp() at even spacing.
 * Feed points as they arrive; finish() renders the last segment.
 */
class Walker {
  pts: number[] = []; // px triplets
  seg = 0; // next segment to render
  since = 0;
  travelled = 0;
  last: { x: number; y: number; p: number } | null = null;
  constructor(
    private spacingAt: (p: number) => number,
    private stamp: (x: number, y: number, p: number, dist: number) => void,
  ) {}
  setPoints(pts: number[]) {
    this.pts = pts;
  }
  reset() {
    this.seg = 0;
    this.since = 0;
    this.travelled = 0;
    this.last = null;
  }
  private feed(x: number, y: number, p: number) {
    const l = this.last;
    if (!l) {
      this.stamp(x, y, p, 0);
      this.last = { x, y, p };
      return;
    }
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < 1e-6) return;
    let rem = d, pos = 0;
    let sp = this.spacingAt(l.p);
    while (this.since + rem >= sp) {
      const step = sp - this.since;
      pos += step;
      rem -= step;
      const t = pos / d;
      const pp = l.p + (p - l.p) * t;
      this.stamp(l.x + (x - l.x) * t, l.y + (y - l.y) * t, pp, this.travelled + pos);
      this.since = 0;
      sp = this.spacingAt(pp);
    }
    this.since += rem;
    this.travelled += d;
    this.last = { x, y, p };
  }
  /** Render every segment whose curve is known. */
  advance(final: boolean) {
    const P = this.pts;
    const n = P.length / 3;
    if (n === 0) return;
    if (this.seg === 0 && !this.last) this.feed(P[0], P[1], P[2]);
    const lastSeg = final ? n - 1 : n - 2;
    for (; this.seg < lastSeg; this.seg++) {
      const i = this.seg;
      const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
      const x0 = P[i0 * 3], y0 = P[i0 * 3 + 1];
      const x1 = P[i * 3], y1 = P[i * 3 + 1], p1 = P[i * 3 + 2];
      const x2 = P[(i + 1) * 3], y2 = P[(i + 1) * 3 + 1], p2 = P[(i + 1) * 3 + 2];
      const x3 = P[i3 * 3], y3 = P[i3 * 3 + 1];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(L / 0.75));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3);
        const y = 0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3);
        this.feed(x, y, p1 + (p2 - p1) * t);
      }
    }
  }
}

const toPxPts = (pts: number[]) => {
  const out = new Array<number>(pts.length);
  for (let i = 0; i < pts.length; i += 3) {
    out[i] = (pts[i] - ARTBOARD.x) * RES;
    out[i + 1] = (pts[i + 1] - ARTBOARD.y) * RES;
    out[i + 2] = pts[i + 2];
  }
  return out;
};

/** Length of a stroke in px along its curve, for the end taper. */
function curveLength(pxPts: number[]): number {
  let len = 0;
  const w = new Walker(() => 1e9, () => {});
  w.setPoints(pxPts);
  w.advance(true);
  len = w.travelled;
  return len;
}

/** Stamps one paint stroke into scratch A, then composites it (with grain) onto a layer. */
export class PaintRun {
  box = emptyBox();
  private walker: Walker;
  private rnd: () => number;
  private total = Infinity;
  private a: CanvasRenderingContext2D;
  private b: CanvasRenderingContext2D;
  private brush;
  private sprite: HTMLCanvasElement | null;
  constructor(public s: PaintStroke) {
    const sc = scratch();
    this.a = ctx2d(sc.a);
    this.b = ctx2d(sc.b);
    this.brush = brushById(s.brush);
    this.rnd = mulberry(s.seed);
    this.sprite = this.brush.soft ? softSprite(s.color) : null;
    const R = (s.size * RES) / 2;
    this.walker = new Walker(
      (p) => Math.max(0.5, 2 * this.radius(p, 0) * this.brush.spacing, R * 2 * this.brush.spacing * 0.5),
      (x, y, p, d) => this.stampAt(x, y, p, d),
    );
    this.clearA();
  }
  private clearA() {
    this.a.setTransform(1, 0, 0, 1, 0, 0);
    this.a.globalCompositeOperation = 'source-over';
    this.a.clearRect(0, 0, LW, LH);
  }
  private taper(d: number) {
    const T = Math.min(this.brush.taper * RES, this.total / 2.5);
    if (T <= 0.5) return 1;
    const k = Math.min(1, d / T, (this.total - d) / T);
    return 0.12 + 0.88 * smooth(Math.max(0, k));
  }
  private radius(p: number, d: number) {
    const R = (this.s.size * RES) / 2;
    return Math.max(0.35, R * (1 - this.brush.sizeP * (1 - p)) * this.taper(d));
  }
  private stampAt(x: number, y: number, p: number, d: number) {
    const b = this.brush;
    let r = this.radius(p, d);
    // erasing with a soft brush should still clear paint in a pass or two
    const flow = this.s.op === 'out' ? Math.min(1, b.flow * 4) : b.flow;
    const alpha = flow * (1 - b.opP * (1 - p)) * (b.taper > 0 ? Math.min(1, 0.4 + 0.6 * this.taper(d)) : 1);
    if (b.jitter > 0) {
      const j = b.jitter * this.s.size * RES;
      x += (this.rnd() - 0.5) * 2 * j;
      y += (this.rnd() - 0.5) * 2 * j;
      r *= 0.85 + this.rnd() * 0.3;
    }
    const a = this.a;
    a.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (this.sprite) {
      a.drawImage(this.sprite, x - r, y - r, r * 2, r * 2);
    } else {
      a.fillStyle = this.s.color;
      a.beginPath();
      a.arc(x, y, r, 0, Math.PI * 2);
      a.fill();
    }
    const m = r + 2;
    const bx = this.box;
    if (x - m < bx.x0) bx.x0 = x - m;
    if (y - m < bx.y0) bx.y0 = y - m;
    if (x + m > bx.x1) bx.x1 = x + m;
    if (y + m > bx.y1) bx.y1 = y + m;
  }
  /** Points in canvas units. */
  update(pts: number[], final: boolean) {
    this.walker.setPoints(toPxPts(pts));
    this.walker.advance(final);
  }
  /** Start over, used when the end taper becomes known or QuickShape replaces the points. */
  restart(pts: number[], withEndTaper: boolean) {
    const px = toPxPts(pts);
    this.clearA();
    this.box = emptyBox();
    this.rnd = mulberry(this.s.seed);
    this.total = withEndTaper ? curveLength(px) : Infinity;
    this.walker.reset();
    this.walker.setPoints(px);
    this.walker.advance(withEndTaper);
  }
  /** Draw the stamps onto a layer, inside box only. */
  composite(dst: CanvasRenderingContext2D, box = this.box) {
    const B = clampBox(box);
    if (!boxOk(B)) return;
    const w = B.x1 - B.x0, h = B.y1 - B.y0;
    let src: HTMLCanvasElement = this.a.canvas;
    const pat = grainPattern(this.b, this.brush.grain);
    if (pat) {
      const b = this.b;
      b.globalCompositeOperation = 'source-over';
      b.globalAlpha = 1;
      b.clearRect(B.x0, B.y0, w, h);
      b.drawImage(this.a.canvas, B.x0, B.y0, w, h, B.x0, B.y0, w, h);
      b.globalCompositeOperation = 'destination-in';
      b.fillStyle = pat;
      b.fillRect(B.x0, B.y0, w, h);
      b.globalCompositeOperation = 'source-over';
      src = b.canvas;
    }
    dst.save();
    dst.globalAlpha = this.s.opacity;
    dst.globalCompositeOperation = gco(this.s.op);
    dst.drawImage(src, B.x0, B.y0, w, h, B.x0, B.y0, w, h);
    dst.restore();
  }
}

/** Smudge: carries paint from where the stamp was to where it is now. Works on the layer directly. */
export class SmudgeRun {
  box = emptyBox();
  private walker: Walker;
  private buf: HTMLCanvasElement;
  private bx: CanvasRenderingContext2D;
  private mask: HTMLCanvasElement;
  private mx: CanvasRenderingContext2D;
  private D: number;
  private started = false;
  constructor(
    public s: SmudgeStroke,
    private dst: CanvasRenderingContext2D,
  ) {
    const R = Math.max(2, (s.size * RES) / 2);
    this.D = Math.ceil(R * 2) + 2;
    this.buf = makeCanvas(this.D, this.D);
    this.bx = ctx2d(this.buf);
    this.mask = makeCanvas(this.D, this.D);
    this.mx = ctx2d(this.mask);
    this.walker = new Walker(() => Math.max(1, this.D * 0.12), (x, y, p) => this.stampAt(x, y, p));
  }
  private stampAt(x: number, y: number, p: number) {
    const D = this.D;
    const sx = Math.round(x - D / 2), sy = Math.round(y - D / 2);
    const bx = this.bx;
    if (!this.started) {
      this.started = true;
      bx.clearRect(0, 0, D, D);
      bx.drawImage(this.dst.canvas, sx, sy, D, D, 0, 0, D, D);
      return;
    }
    // shape the carried paint with a soft round tip
    const mx = this.mx;
    mx.globalCompositeOperation = 'source-over';
    mx.globalAlpha = 1;
    mx.clearRect(0, 0, D, D);
    mx.drawImage(this.buf, 0, 0);
    mx.globalCompositeOperation = 'destination-in';
    mx.drawImage(softSprite('#000000'), 0, 0, D, D);
    const k = this.s.strength * (0.45 + 0.55 * p);
    this.dst.save();
    this.dst.globalAlpha = k;
    this.dst.globalCompositeOperation = 'source-over';
    this.dst.drawImage(this.mask, sx, sy);
    this.dst.restore();
    // pick up a little of what is under the tip now
    bx.globalAlpha = 1 - this.s.strength * 0.85;
    bx.globalCompositeOperation = 'source-over';
    bx.drawImage(this.dst.canvas, sx, sy, D, D, 0, 0, D, D);
    bx.globalAlpha = 1;
    const b = this.box;
    b.x0 = Math.min(b.x0, sx - 1);
    b.y0 = Math.min(b.y0, sy - 1);
    b.x1 = Math.max(b.x1, sx + D + 1);
    b.y1 = Math.max(b.y1, sy + D + 1);
  }
  update(pts: number[], final: boolean) {
    this.walker.setPoints(toPxPts(pts));
    this.walker.advance(final);
  }
}

/** Flood fill: the region around (x, y) in layer pixels that matches the seed color. */
export function computeFill(ref: ImageData, x: number, y: number, tolerance = 0.28): number[] {
  const W = ref.width, H = ref.height, d = ref.data;
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return [];
  const pm = (i: number) => {
    const a = d[i + 3] / 255;
    return [d[i] * a, d[i + 1] * a, d[i + 2] * a, d[i + 3]];
  };
  const seed = pm((y * W + x) * 4);
  const tol = tolerance * 255;
  const match = (p: number) => {
    const i = p * 4;
    const a = d[i + 3] / 255;
    return (
      Math.abs(d[i] * a - seed[0]) <= tol &&
      Math.abs(d[i + 1] * a - seed[1]) <= tol &&
      Math.abs(d[i + 2] * a - seed[2]) <= tol &&
      Math.abs(d[i + 3] - seed[3]) <= tol
    );
  };
  const mask = new Uint8Array(W * H);
  const stack: number[] = [x, y];
  while (stack.length) {
    const sy = stack.pop()!, sx = stack.pop()!;
    let lx = sx;
    const row = sy * W;
    if (mask[row + lx] || !match(row + lx)) continue;
    while (lx > 0 && !mask[row + lx - 1] && match(row + lx - 1)) lx--;
    let rx = sx;
    while (rx < W - 1 && !mask[row + rx + 1] && match(row + rx + 1)) rx++;
    for (let i = lx; i <= rx; i++) mask[row + i] = 1;
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= H) continue;
      const nr = ny * W;
      let inRun = false;
      for (let i = lx; i <= rx; i++) {
        const ok = !mask[nr + i] && match(nr + i);
        if (ok && !inRun) {
          stack.push(i, ny);
          inRun = true;
        } else if (!ok) inRun = false;
      }
    }
  }
  // grow by 2 px so the fill tucks under anti-aliased line edges
  let m = mask;
  for (let pass = 0; pass < 2; pass++) {
    const g = new Uint8Array(m);
    for (let yy = 0; yy < H; yy++) {
      const r = yy * W;
      for (let xx = 0; xx < W; xx++) {
        if (m[r + xx]) continue;
        if ((xx > 0 && m[r + xx - 1]) || (xx < W - 1 && m[r + xx + 1]) || (yy > 0 && m[r - W + xx]) || (yy < H - 1 && m[r + W + xx])) g[r + xx] = 1;
      }
    }
    m = g;
  }
  const runs: number[] = [];
  for (let yy = 0; yy < H; yy++) {
    const r = yy * W;
    let xx = 0;
    while (xx < W) {
      if (!m[r + xx]) {
        xx++;
        continue;
      }
      const s = xx;
      while (xx < W && m[r + xx]) xx++;
      runs.push(yy, s, xx - 1);
    }
  }
  return runs;
}

export function renderFill(dst: CanvasRenderingContext2D, f: FillStroke) {
  const { a } = scratch();
  const ax = ctx2d(a);
  ax.setTransform(1, 0, 0, 1, 0, 0);
  ax.globalAlpha = 1;
  ax.globalCompositeOperation = 'source-over';
  ax.clearRect(0, 0, LW, LH);
  ax.fillStyle = f.color;
  const box = emptyBox();
  for (let i = 0; i < f.runs.length; i += 3) {
    const y = f.runs[i], x0 = f.runs[i + 1], x1 = f.runs[i + 2];
    ax.fillRect(x0, y, x1 - x0 + 1, 1);
    if (x0 < box.x0) box.x0 = x0;
    if (y < box.y0) box.y0 = y;
    if (x1 + 1 > box.x1) box.x1 = x1 + 1;
    if (y + 1 > box.y1) box.y1 = y + 1;
  }
  const B = clampBox(box);
  if (!boxOk(B)) return;
  dst.save();
  dst.globalAlpha = f.opacity;
  dst.globalCompositeOperation = gco(f.op);
  dst.drawImage(a, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  dst.restore();
}

/** Replay one finished stroke onto a layer. */
export function renderStroke(dst: CanvasRenderingContext2D, s: Stroke) {
  if (s.kind === 'fill') return renderFill(dst, s);
  if (s.kind === 'smudge') {
    const run = new SmudgeRun(s, dst);
    run.update(s.pts, true);
    return;
  }
  const run = new PaintRun(s);
  run.restart(s.pts, true);
  run.composite(dst);
}

/** Copy a box of one canvas onto the same box of another, replacing what was there. */
export function restoreBox(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, box: Box) {
  const B = clampBox(box);
  if (!boxOk(B)) return;
  const w = B.x1 - B.x0, h = B.y1 - B.y0;
  dst.save();
  dst.globalAlpha = 1;
  dst.globalCompositeOperation = 'source-over';
  dst.clearRect(B.x0, B.y0, w, h);
  dst.drawImage(src, B.x0, B.y0, w, h, B.x0, B.y0, w, h);
  dst.restore();
}
