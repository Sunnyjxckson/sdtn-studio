import { CENTER_X, getCroquis, type Sex, type View } from './croquis';
import { bandTop, findPoint, GARMENT_W, type Garment, type Transform } from './garment';

/** The default jeans block: band top and hem in garment space. Shorts and skirts share its scale. */
const REF_TOP = 62;
const REF_HEM = 486;

/** Waistband near the hip line, hem near the ankles, centred on the body. */
export function placeOnCroquis(g: Pick<Garment, 'points'> & Partial<Pick<Garment, 'type'>>, sex: Sex, view: View): Transform {
  const c = getCroquis(sex, view);
  const top = bandTop(g.points);
  if (g.type === 'shorts' || g.type === 'skirt') {
    // same scale as a full length block, so the pose fit lands the crotch, knees and ankles correctly
    const scale = (c.hemY - c.waistY) / (REF_HEM - REF_TOP);
    return { scale, x: CENTER_X - (GARMENT_W / 2) * scale, y: c.waistY - top * scale };
  }
  const hem = Math.max(findPoint(g.points, 'hemLo').y, findPoint(g.points, 'hemLi').y);
  const scale = (c.hemY - c.waistY) / (hem - top);
  return {
    scale,
    x: CENTER_X - (GARMENT_W / 2) * scale,
    y: c.waistY - top * scale,
  };
}
