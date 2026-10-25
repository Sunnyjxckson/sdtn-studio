// Shoes: the model. Geometry for the body view is in shoeShapes.ts and for flats in flatsShoes.ts.

import { newId, type Garment, type WashName } from './garment';

export type ShoeKind = 'Sneaker' | 'High top' | 'Combat boot' | 'Chelsea boot' | 'Loafer' | 'Heel';
export const SHOE_KINDS: ShoeKind[] = ['Sneaker', 'High top', 'Combat boot', 'Chelsea boot', 'Loafer', 'Heel'];
export type HeelKind = 'Block' | 'Stiletto';
export const HEEL_KINDS: HeelKind[] = ['Stiletto', 'Block'];

export interface ShoeOpts {
  kind: ShoeKind;
  /** Colour of the sole and trim, a wash name. Default depends on the kind. */
  sole?: WashName;
  /** Heels only. */
  heel?: HeelKind;
}

export const SHOE_LOOK: Record<ShoeKind, { fabric: Garment['fabric']; wash: WashName; sole: WashName }> = {
  Sneaker: { fabric: 'Leather', wash: 'White', sole: 'Cream' },
  'High top': { fabric: 'Leather', wash: 'Black', sole: 'White' },
  'Combat boot': { fabric: 'Leather', wash: 'Black', sole: 'Black' },
  'Chelsea boot': { fabric: 'Leather', wash: 'Black', sole: 'Washed black' },
  Loafer: { fabric: 'Leather', wash: 'Crimson', sole: 'Black' },
  Heel: { fabric: 'Leather', wash: 'Black', sole: 'Black' },
};

export const soleOf = (o: ShoeOpts): WashName => o.sole ?? SHOE_LOOK[o.kind].sole;
export const heelKindOf = (o: ShoeOpts): HeelKind => o.heel ?? 'Stiletto';
export const shoeName = (o: ShoeOpts): string => (o.kind === 'Heel' ? `${heelKindOf(o) === 'Block' ? 'Block heel' : 'Stiletto heel'}` : o.kind);

export function createShoes(o: ShoeOpts): Garment {
  const look = SHOE_LOOK[o.kind];
  return {
    id: newId(),
    name: shoeName(o),
    type: 'shoes',
    block: o.kind,
    fit: 'Straight',
    rise: 'Mid',
    points: [],
    parts: { waist: 'Regular', pocket: 'None' },
    wash: look.wash,
    fabric: look.fabric,
    fabricScale: 1,
    holes: [],
    distress: [],
    texts: [],
    cropY: null,
    transform: { x: 0, y: 0, scale: 1 },
    visible: true,
    shoes: o,
  };
}
