// Draw mode: Procreate style raster layers, kept as replayable strokes so undo and save stay small.
import { newId } from './garment';

export type BrushId =
  | 'hb' | 'pencil' | 'techpen' | 'monoline' | 'ink' | 'marker' | 'gouache' | 'charcoal' | 'pastel' | 'airbrush';

export type Grain = 'none' | 'fine' | 'coarse' | 'paper';

export interface BrushDef {
  id: BrushId;
  name: string;
  set: 'Sketching' | 'Inking' | 'Painting' | 'Airbrushing';
  /** Distance between stamps as a fraction of the stamp diameter. */
  spacing: number;
  /** How much pen pressure changes size (0 none, 1 full). */
  sizeP: number;
  /** How much pen pressure changes opacity. */
  opP: number;
  /** Alpha of each stamp. */
  flow: number;
  soft: boolean;
  grain: Grain;
  /** Random stamp offset as a fraction of the size. */
  jitter: number;
  /** Length in canvas units that tapers at each end. */
  taper: number;
  size: number;
  opacity: number;
  streamline: number;
}

export const BRUSHES: BrushDef[] = [
  { id: 'hb', name: 'HB Pencil', set: 'Sketching', spacing: 0.12, sizeP: 0.25, opP: 0.9, flow: 0.55, soft: false, grain: 'fine', jitter: 0, taper: 4, size: 1.4, opacity: 1, streamline: 0.2 },
  { id: 'pencil', name: '6B Pencil', set: 'Sketching', spacing: 0.12, sizeP: 0.4, opP: 0.8, flow: 0.75, soft: false, grain: 'fine', jitter: 0, taper: 6, size: 3, opacity: 1, streamline: 0.2 },
  { id: 'techpen', name: 'Technical Pen', set: 'Inking', spacing: 0.08, sizeP: 0.15, opP: 0, flow: 1, soft: false, grain: 'none', jitter: 0, taper: 2, size: 1.6, opacity: 1, streamline: 0.5 },
  { id: 'monoline', name: 'Monoline', set: 'Inking', spacing: 0.08, sizeP: 0, opP: 0, flow: 1, soft: false, grain: 'none', jitter: 0, taper: 0, size: 2, opacity: 1, streamline: 0.55 },
  { id: 'ink', name: 'Studio Ink', set: 'Inking', spacing: 0.06, sizeP: 1, opP: 0, flow: 1, soft: false, grain: 'none', jitter: 0, taper: 14, size: 4, opacity: 1, streamline: 0.45 },
  { id: 'marker', name: 'Marker', set: 'Painting', spacing: 0.08, sizeP: 0.1, opP: 0, flow: 1, soft: false, grain: 'none', jitter: 0, taper: 0, size: 12, opacity: 0.55, streamline: 0.3 },
  { id: 'gouache', name: 'Gouache', set: 'Painting', spacing: 0.1, sizeP: 0.5, opP: 0.3, flow: 0.9, soft: false, grain: 'paper', jitter: 0.04, taper: 4, size: 16, opacity: 1, streamline: 0.3 },
  { id: 'charcoal', name: 'Charcoal', set: 'Sketching', spacing: 0.1, sizeP: 0.5, opP: 0.6, flow: 0.8, soft: false, grain: 'coarse', jitter: 0.12, taper: 6, size: 8, opacity: 1, streamline: 0.15 },
  { id: 'pastel', name: 'Soft Pastel', set: 'Airbrushing', spacing: 0.08, sizeP: 0.3, opP: 0.9, flow: 0.22, soft: true, grain: 'paper', jitter: 0, taper: 0, size: 26, opacity: 1, streamline: 0.2 },
  { id: 'airbrush', name: 'Soft Airbrush', set: 'Airbrushing', spacing: 0.06, sizeP: 0.2, opP: 1, flow: 0.1, soft: true, grain: 'none', jitter: 0, taper: 0, size: 44, opacity: 1, streamline: 0.1 },
];

export const brushById = (id: BrushId): BrushDef => BRUSHES.find((b) => b.id === id) ?? BRUSHES[0];

export type StrokeOp = 'over' | 'atop' | 'out';

export interface PaintStroke {
  kind: 'paint';
  brush: BrushId;
  color: string;
  /** Diameter in canvas units at full pressure. */
  size: number;
  opacity: number;
  /** over = paint, atop = paint with alpha lock, out = erase */
  op: StrokeOp;
  /** x, y, pressure triplets in canvas units. */
  pts: number[];
  seed: number;
}

export interface SmudgeStroke {
  kind: 'smudge';
  brush: BrushId;
  size: number;
  strength: number;
  pts: number[];
  seed: number;
}

export interface FillStroke {
  kind: 'fill';
  color: string;
  opacity: number;
  op: StrokeOp;
  /** Filled pixel runs: y, x0, x1 triplets in layer pixels. */
  runs: number[];
}

export type Stroke = PaintStroke | SmudgeStroke | FillStroke;

export type Blend = 'normal' | 'multiply' | 'screen' | 'overlay';
export const BLENDS: Blend[] = ['normal', 'multiply', 'screen', 'overlay'];

export interface DrawLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blend: Blend;
  alphaLock: boolean;
  /** Fill uses this layer's lines as the boundary, like Procreate's Reference. */
  reference: boolean;
  strokes: Stroke[];
}

export interface Drawing {
  /** Bottom of the stack first. */
  layers: DrawLayer[];
  /** Croquis and garments under the drawing. */
  showRef: boolean;
  refOpacity: number;
}

export const MAX_DRAW_LAYERS = 16;

export const newDrawLayer = (n: number): DrawLayer => ({
  id: newId(),
  name: `Layer ${n}`,
  visible: true,
  opacity: 1,
  blend: 'normal',
  alphaLock: false,
  reference: false,
  strokes: [],
});

export const emptyDrawing = (): Drawing => ({ layers: [newDrawLayer(1)], showRef: true, refOpacity: 1 });

export function normalizeDrawing(d: Partial<Drawing> | undefined): Drawing {
  const e = emptyDrawing();
  if (!d || !Array.isArray(d.layers) || d.layers.length === 0) return e;
  return {
    ...e,
    ...d,
    layers: d.layers.map((l) => ({ ...newDrawLayer(1), ...l, strokes: Array.isArray(l.strokes) ? l.strokes : [] })),
  };
}

/** Sedition palette plus basics, shown under the color picker. */
export const PALETTE = [
  '#141414', '#3E3B35', '#8C877D', '#F4F2ED', '#FFFFFF', '#C8102E',
  '#7A0E1F', '#2F4A6D', '#5B7FA6', '#9FB7CF', '#3E5236', '#C9B48A',
  '#6B4430', '#B8743A', '#E3C04B', '#D98AA0', '#5C3F7A', '#E07A2B',
];
