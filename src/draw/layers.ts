// One canvas per drawing layer, kept in step with the document. Appends draw only the new
// strokes; undo of the last stroke restores a snapshot; anything else replays the layer.
import type { DrawLayer, Stroke } from '../model/draw';
import { ctx2d, LH, LW, makeCanvas, renderStroke } from './engine';

interface Entry {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  strokes: Stroke[];
}

const entries = new Map<string, Entry>();
/** Strokes already painted live, so sync must not paint them twice. */
const committed = new WeakSet<Stroke>();
/** The layer as it was before the last live stroke, for an instant undo. */
let snap: { layerId: string; strokes: Stroke[]; canvas: HTMLCanvasElement } | null = null;
let snapCanvas: HTMLCanvasElement | null = null;

const listeners = new Set<() => void>();
let version = 0;
export const layersVersion = () => version;
export function onLayersChange(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function notifyLayers() {
  version++;
  listeners.forEach((f) => f());
}

export function layerEntry(id: string): Entry {
  let e = entries.get(id);
  if (!e) {
    const canvas = makeCanvas();
    canvas.className = 'drawlayer';
    e = { canvas, ctx: ctx2d(canvas), strokes: [] };
    entries.set(id, e);
  }
  return e;
}

export const layerCanvas = (id: string) => layerEntry(id).canvas;

export function markCommitted(s: Stroke) {
  committed.add(s);
}

/** Remember the layer pixels from before a live stroke (copied from the stroke's backup). */
export function saveSnap(layerId: string, strokes: Stroke[], backup: HTMLCanvasElement) {
  if (!snapCanvas) snapCanvas = makeCanvas();
  const x = ctx2d(snapCanvas);
  x.globalCompositeOperation = 'copy';
  x.drawImage(backup, 0, 0);
  x.globalCompositeOperation = 'source-over';
  snap = { layerId, strokes, canvas: snapCanvas };
}

function replay(e: Entry, strokes: Stroke[]) {
  e.ctx.clearRect(0, 0, LW, LH);
  for (const s of strokes) renderStroke(e.ctx, s);
}

export function syncLayers(layers: DrawLayer[]) {
  let changed = false;
  const live = new Set(layers.map((l) => l.id));
  for (const id of [...entries.keys()]) {
    if (!live.has(id)) {
      entries.delete(id);
      changed = true;
    }
  }
  for (const l of layers) {
    const e = layerEntry(l.id);
    if (e.strokes === l.strokes) continue;
    changed = true;
    if (snap && snap.layerId === l.id && snap.strokes === l.strokes) {
      const x = e.ctx;
      x.globalCompositeOperation = 'copy';
      x.drawImage(snap.canvas, 0, 0);
      x.globalCompositeOperation = 'source-over';
      e.strokes = l.strokes;
      continue;
    }
    const old = e.strokes;
    let prefix = old.length <= l.strokes.length;
    for (let i = 0; prefix && i < old.length; i++) if (old[i] !== l.strokes[i]) prefix = false;
    if (prefix) {
      for (let i = old.length; i < l.strokes.length; i++) {
        const s = l.strokes[i];
        if (committed.has(s)) committed.delete(s);
        else renderStroke(e.ctx, s);
      }
    } else {
      replay(e, l.strokes);
    }
    e.strokes = l.strokes;
  }
  if (changed) notifyLayers();
}

/** Composite every visible layer into one canvas (used by export and the eyedropper). */
export function flatten(layers: DrawLayer[], into: CanvasRenderingContext2D) {
  for (const l of layers) {
    if (!l.visible) continue;
    into.save();
    into.globalAlpha = l.opacity;
    into.globalCompositeOperation = l.blend === 'normal' ? 'source-over' : l.blend;
    into.drawImage(layerCanvas(l.id), 0, 0, into.canvas.width, into.canvas.height);
    into.restore();
  }
}
