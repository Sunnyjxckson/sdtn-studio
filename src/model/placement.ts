import { CENTER_X, getCroquis, type Sex, type View } from './croquis';
import { bandTop, findPoint, GARMENT_W, type Garment, type Transform } from './garment';

/** Waistband near the hip line, hem near the ankles, centred on the body. */
export function placeOnCroquis(g: Pick<Garment, 'points'>, sex: Sex, view: View): Transform {
  const c = getCroquis(sex, view);
  const top = bandTop(g.points);
  const hem = Math.max(findPoint(g.points, 'hemLo').y, findPoint(g.points, 'hemLi').y);
  const scale = (c.hemY - c.waistY) / (hem - top);
  return {
    scale,
    x: CENTER_X - (GARMENT_W / 2) * scale,
    y: c.waistY - top * scale,
  };
}
