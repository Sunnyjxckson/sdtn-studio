import { normalizeGarment, type Garment } from './garment';
import { DEFAULT_SKIN, type Sex, type SkinId, type View } from './croquis';
import type { Note } from './note';
import type { PoseId } from './figure';

export type RenderMode = 'line' | 'rendered';

export interface Doc {
  name: string;
  base: { sex: Sex; view: View; skin: SkinId; pose: PoseId };
  settings: { render: RenderMode; shading: boolean };
  /** Bottom of the stack first. */
  garments: Garment[];
  notes: Note[];
}

export const emptyDoc = (): Doc => ({
  name: 'FW27 / Look 01',
  base: { sex: 'male', view: 'front', skin: DEFAULT_SKIN, pose: 'stand' },
  settings: { render: 'rendered', shading: true },
  garments: [],
  notes: [],
});

/** Fill in fields that older saved documents do not have. */
export function normalizeDoc(d: Doc): Doc {
  const e = emptyDoc();
  return {
    ...e,
    ...d,
    base: { ...e.base, ...d.base },
    settings: { ...e.settings, ...d.settings },
    garments: d.garments.map(normalizeGarment),
    notes: d.notes ?? [],
  };
}
