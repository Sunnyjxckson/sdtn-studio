import { normalizeGarment, type Garment } from './garment';
import { DEFAULT_SKIN, type Sex, type SkinId, type View } from './croquis';
import type { Note } from './note';
import type { PoseId } from './figure';
import { emptyDrawing, normalizeDrawing, type Drawing } from './draw';
import type { Colorway, PaletteColor, SavedPalette } from './production';
import { emptyVector, normalizeVector, type VectorDoc } from './vector';

export type RenderMode = 'line' | 'rendered';

export interface Doc {
  name: string;
  base: { sex: Sex; view: View; skin: SkinId; pose: PoseId };
  settings: { render: RenderMode; shading: boolean };
  /** Bottom of the stack first. */
  garments: Garment[];
  notes: Note[];
  /** Draw mode layers, on top of the garments. */
  drawing: Drawing;
  /** Vector mode artwork, over the garments. */
  vector: VectorDoc;
  /** Custom named colors, and palettes saved from them. */
  palette?: PaletteColor[];
  palettes?: SavedPalette[];
  /** Colorways for the look: each one colors every garment at once. */
  colorways?: Colorway[];
  activeColorway?: string;
}

export const emptyDoc = (): Doc => ({
  name: 'FW27 / Look 01',
  base: { sex: 'female', view: 'front', skin: DEFAULT_SKIN, pose: 'walk' },
  settings: { render: 'rendered', shading: true },
  garments: [],
  notes: [],
  drawing: emptyDrawing(),
  vector: emptyVector(),
});

/** Fill in fields that older saved documents do not have. */
export function normalizeDoc(d: Doc): Doc {
  const e = emptyDoc();
  return {
    ...e,
    ...d,
    base: { ...e.base, ...d.base },
    settings: { ...e.settings, ...d.settings },
    garments: (d.garments ?? []).map(normalizeGarment),
    notes: d.notes ?? [],
    drawing: normalizeDrawing(d.drawing),
    vector: normalizeVector(d.vector),
  };
}
