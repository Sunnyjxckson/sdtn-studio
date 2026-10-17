// Croquis base settings. The figure itself is built in figure.ts.
// Canvas space matches the mockup: viewBox 0 20 600 980, head = about 100 units.

export type Sex = 'male' | 'female';
export type View = 'front' | 'back';

export const ARTBOARD = { x: 0, y: 20, w: 600, h: 980 };
export const CENTER_X = 300;
export const HEAD = 102;

export interface CroquisSpec {
  /** Where garments sit in the stand pose: waistband top and hem, in canvas space. */
  waistY: number;
  hemY: number;
  label: string;
}

export function getCroquis(sex: Sex, view: View): CroquisSpec {
  const male = sex === 'male';
  return {
    waistY: 352,
    hemY: male ? 884 : 894,
    label: `${male ? 'Male' : 'Female'} ${view}`,
  };
}

/** Head-line marks down the left edge. */
export const HEAD_LINES = [40, 142, 244, 346, 448, 550, 652, 754, 856, 958];
export const INK = '#3E3B35';
export const INK_WEIGHT = 1.4;

export type SkinId = 'Espresso' | 'Deep brown' | 'Brown' | 'Tan' | 'Light';
/** Dark tones first. */
export const SKINS: { id: SkinId; color: string }[] = [
  { id: 'Espresso', color: '#4A2E22' },
  { id: 'Deep brown', color: '#6B4430' },
  { id: 'Brown', color: '#8D5E43' },
  { id: 'Tan', color: '#C99A74' },
  { id: 'Light', color: '#EBC9A8' },
];
export const DEFAULT_SKIN: SkinId = 'Deep brown';
export const skinColor = (id: SkinId) => (SKINS.find((s) => s.id === id) ?? SKINS[1]).color;

