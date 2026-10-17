import type { Garment } from './garment';
import type { Sex, View } from './croquis';

export interface Doc {
  name: string;
  base: { sex: Sex; view: View };
  /** Bottom of the stack first. */
  garments: Garment[];
}

export const emptyDoc = (): Doc => ({
  name: 'FW27 / Look 01',
  base: { sex: 'male', view: 'front' },
  garments: [],
});
